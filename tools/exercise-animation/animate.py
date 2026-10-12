#!/usr/bin/env python3
"""Exercise animation pipeline (2D puppet / layered compositing).

Turns two still images of the same exercise (A = start pose, B = end pose) plus a
small rig JSON into a seamless ping-pong loop:

  * a static plate (background, bench, body) built once from B, A and inpainting,
    so static regions are pixel-identical in every frame (no shimmer);
  * moving layers (barbell plates, bar shaft, arms) that are real geometric
    transformations of the original pixels (rigid affine for objects, inverse
    linear-blend skinning on a 2-bone IK chain for limbs);
  * an ease curve with holds and a loop point placed inside a hold.

Usage:
  python animate.py exercises/bench_press/rig.json --out demo/bench_press
  python animate.py RIG --out DIR --variant dual      # A/B cross-dissolve on limbs
  python animate.py RIG --out DIR --debug             # rig overlays, plate, masks

Requires: numpy, opencv-python-headless. Optional: torch + LaMa weights
(--lama path/to/big-lama.pt) for better inpainting of the static plate.
"""
import argparse
import json
import math
import os
import subprocess
import sys

import cv2
import numpy as np

# --------------------------------------------------------------------------
# Image and mask helpers
# --------------------------------------------------------------------------


def load_rgb(path):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(path)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32)


def save_rgb(path, img):
    cv2.imwrite(path, cv2.cvtColor(np.clip(img + 0.5, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR))


def poly_mask(shape, poly, ss=4):
    """Anti-aliased polygon mask in [0,1] (supersampled)."""
    h, w = shape[:2]
    big = np.zeros((h * ss, w * ss), np.uint8)
    pts = np.round(np.asarray(poly, np.float64) * ss).astype(np.int32)
    cv2.fillPoly(big, [pts], 255)
    return cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0


def fg_alpha(img, white=252.0, ramp=14.0):
    """Soft 'not background' alpha for drawings on a pure white background."""
    return np.clip((white - img.min(axis=2)) / ramp, 0.0, 1.0)


def fill_holes(binary):
    b = binary.astype(np.uint8)
    h, w = b.shape
    flood = b.copy()
    m = np.zeros((h + 2, w + 2), np.uint8)
    flood = cv2.copyMakeBorder(flood, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    cv2.floodFill(flood, None, (0, 0), 1)
    flood = flood[1:-1, 1:-1]
    return (b | (1 - flood)).astype(bool)


def cut_layer(img, poly):
    """Cut a layer out of an image along a polygon.

    Edges against the white background keep their natural anti-aliasing
    (un-blended from white); edges inside the drawing follow the polygon.
    Returns premultiplied RGB and alpha, full frame.
    """
    pm = poly_mask(img.shape, poly)
    fg = fg_alpha(img)
    core = fill_holes((fg > 0.5) & (pm > 0.5))
    core = cv2.erode(core.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    a_fg = np.maximum(fg, core.astype(np.float32))
    alpha = pm * a_fg
    premult = pm[..., None] * np.clip(img - (1.0 - a_fg[..., None]) * 255.0, 0, 255)
    return premult.astype(np.float32), alpha.astype(np.float32)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / max(e1 - e0, 1e-6), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# --------------------------------------------------------------------------
# 2D affine helpers
# --------------------------------------------------------------------------


def to3(M):
    return np.vstack([M, [0, 0, 1]])


def affine_from_points(src, dst):
    src = np.asarray(src, np.float64)
    dst = np.asarray(dst, np.float64)
    if len(src) == 2:
        M, _ = cv2.estimateAffinePartial2D(src, dst)
        if M is None:  # exactly 2 points: closed-form similarity
            s0, s1 = src
            d0, d1 = dst
            vs, vd = s1 - s0, d1 - d0
            sc = np.linalg.norm(vd) / np.linalg.norm(vs)
            ang = math.atan2(vd[1], vd[0]) - math.atan2(vs[1], vs[0])
            c, s = sc * math.cos(ang), sc * math.sin(ang)
            R = np.array([[c, -s], [s, c]])
            M = np.hstack([R, (d0 - R @ s0)[:, None]])
        return M
    X = np.hstack([src, np.ones((len(src), 1))])
    sol, *_ = np.linalg.lstsq(X, dst, rcond=None)
    return sol.T


def decompose(M):
    """M (2x3) -> (tx, ty, theta, log_sx, log_sy, shear) with L = R(theta) @ [[sx, k],[0, sy]]."""
    L = M[:, :2]
    Q, R = np.linalg.qr(L)
    # make the diagonal of R positive
    D = np.diag(np.sign(np.diag(R)))
    Q, R = Q @ D, D @ R
    theta = math.atan2(Q[1, 0], Q[0, 0])
    return np.array([M[0, 2], M[1, 2], theta, math.log(R[0, 0]), math.log(R[1, 1]), R[0, 1] / R[0, 0]])


def compose(p):
    tx, ty, th, lsx, lsy, k = p
    c, s = math.cos(th), math.sin(th)
    sx, sy = math.exp(lsx), math.exp(lsy)
    L = np.array([[c, -s], [s, c]]) @ np.array([[sx, k * sx], [0, sy]])
    return np.hstack([L, [[tx], [ty]]])


def interp_affine(M0, M1, s):
    """Interpolate two affines with a fixed pivot so rotation/scale do not swing translation."""
    p0, p1 = decompose(M0), decompose(M1)
    d = p1[2] - p0[2]
    p1[2] = p0[2] + (d + math.pi) % (2 * math.pi) - math.pi
    lin = compose((1 - s) * p0 + s * p1)[:, :2]
    return lin


def ecc_refine(src_img, dst_img, dst_mask, M, iters=200):
    """Refine an affine source->target with ECC, comparing only inside dst_mask."""
    g_src = cv2.cvtColor(np.clip(src_img, 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    g_dst = cv2.cvtColor(np.clip(dst_img, 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    # ECC samples inputImage at W(x) for every template pixel x. We want the
    # template = target region, input = source image, so W = inverse(M).
    Minv = cv2.invertAffineTransform(M).astype(np.float32)
    mask = (dst_mask > 0.5).astype(np.uint8)
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    tpl = g_dst[y0:y1, x0:x1].copy()
    tpl[mask[y0:y1, x0:x1] == 0] = 255
    T = np.array([[1, 0, x0], [0, 1, y0], [0, 0, 1]], np.float64)
    W = (to3(Minv) @ T)[:2].astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, iters, 1e-6)
    try:
        _, W = cv2.findTransformECC(tpl.astype(np.float32), g_src.astype(np.float32), W,
                                    cv2.MOTION_AFFINE, crit, None, 5)
    except cv2.error as e:
        print("  ECC failed, keeping keypoint fit:", str(e).splitlines()[-1])
        return M
    Minv2 = (to3(W.astype(np.float64)) @ np.linalg.inv(T))[:2]
    return cv2.invertAffineTransform(Minv2)


# --------------------------------------------------------------------------
# Timing
# --------------------------------------------------------------------------


def ease(x, kind):
    x = np.clip(x, 0.0, 1.0)
    if kind == "linear":
        return x
    if kind == "sine":
        return 0.5 - 0.5 * np.cos(np.pi * x)
    if kind == "smoothstep":
        return x * x * (3 - 2 * x)
    if kind == "smootherstep":
        return x * x * x * (x * (6 * x - 15) + 10)
    raise ValueError("unknown ease " + kind)


def timeline(timing):
    """Returns (list of s in [0,1] per frame, fps). s=0 -> pose A, s=1 -> pose B."""
    fps = timing.get("fps", 60)
    hA, up, hB, down = timing["hold_A"], timing["A_to_B"], timing["hold_B"], timing["B_to_A"]
    kind_up = timing.get("ease_A_to_B", timing.get("ease", "smootherstep"))
    kind_dn = timing.get("ease_B_to_A", timing.get("ease", "smootherstep"))
    total = hA + up + hB + down
    n = int(round(total * fps))
    offset = hA / 2 if timing.get("start", "mid_hold_A") == "mid_hold_A" else 0.0
    out = []
    for i in range(n):
        t = (i / fps + offset) % total
        if t < hA:
            s = 0.0
        elif t < hA + up:
            s = float(ease((t - hA) / up, kind_up))
        elif t < hA + up + hB:
            s = 1.0
        else:
            s = 1.0 - float(ease((t - hA - up - hB) / down, kind_dn))
        out.append(s)
    return out, fps


# --------------------------------------------------------------------------
# Layers
# --------------------------------------------------------------------------


class Ctx:
    def __init__(self, rig, base_dir):
        self.rig = rig
        self.img = {k: load_rgb(os.path.join(base_dir, v)) for k, v in rig["images"].items()}
        self.shape = self.img["A"].shape
        self.arc = np.array(rig.get("path", {}).get("arc", [0, 0]), np.float64)

    def arc_offset(self, s):
        return self.arc * 4.0 * s * (1.0 - s)


def bbox_of(alpha, pad=2):
    ys, xs = np.nonzero(alpha > 1e-3)
    if len(xs) == 0:
        return None
    h, w = alpha.shape
    return (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, w), min(ys.max() + pad + 1, h))


class RigidLayer:
    """A rigid object (e.g. a barbell plate) cut from one image and moved by an affine."""

    def __init__(self, ctx, spec):
        self.name = spec["name"]
        self.src = spec["source"]
        other = "A" if self.src == "B" else "B"
        src_img = ctx.img[self.src]
        if spec.get("complete"):
            # synthesise the parts of the object hidden behind other things (e.g. a
            # hand in front of a plate) so they can be revealed when it moves
            vis = poly_mask(ctx.shape, spec["mask"][self.src]) > 0.5
            full = poly_mask(ctx.shape, spec["complete"]) > 0.5
            iso = np.where(vis[..., None], src_img, 255.0).astype(np.float32)
            missing = cv2.dilate((full & ~vis).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & full
            src_img, how = inpaint(iso, missing, ctx.lama)
            print(f"  layer {self.name}: completed {int(missing.sum())} hidden px ({how})")
            self.completed = src_img
            self.premult, self.alpha = cut_layer(src_img, spec["complete"])
        else:
            self.premult, self.alpha = cut_layer(src_img, spec["mask"][self.src])
        if spec.get("hull_dark"):
            # keep only the convex hull of the object's dark pixels (e.g. a black plate),
            # so light pixels of whatever touches it (a face, a hand) do not travel with it
            lum = src_img.mean(axis=2)
            dark = ((lum < spec["hull_dark"]) & (self.alpha > 0.5)).astype(np.uint8)
            pts = cv2.findNonZero(dark)
            hull = np.zeros(dark.shape, np.uint8)
            cv2.fillConvexPoly(hull, cv2.convexHull(pts), 255)
            hm = cv2.GaussianBlur(hull.astype(np.float32) / 255.0, (0, 0), 0.7)
            self.premult *= hm[..., None]
            self.alpha *= hm
        M = affine_from_points(spec["points"][self.src], spec["points"][other])
        dmask = None
        if spec.get("refine") == "ecc" and other in spec["mask"]:
            dmask = poly_mask(ctx.shape, spec["mask"][other]) * fg_alpha(ctx.img[other])
            M = ecc_refine(ctx.img[self.src], ctx.img[other], dmask, M)
        ident = np.array([[1, 0, 0], [0, 1, 0]], np.float64)
        self.M = {self.src: ident, other: M}
        ys, xs = np.nonzero(self.alpha > 0.5)
        self.pivot = np.array([xs.mean(), ys.mean()])
        self.ctx = ctx
        self.score = self._fit_score(other, dmask)

    def _fit_score(self, other, dmask):
        p, a, _ = self._warp(self.M[other])
        tgt = self.ctx.img[other]
        comp = p + (1 - a[..., None]) * 255.0
        m = (a > 0.9)
        if dmask is not None:
            m &= dmask > 0.9
        return float(np.abs(comp - tgt)[m].mean()) if m.any() else float("nan")

    def transform(self, s):
        lin = interp_affine(self.M["A"], self.M["B"], s)
        # translate a pivot point (layer centroid) linearly so rotation does not swing the path
        c = np.r_[self.pivot, 1.0]
        cA, cB = self.M["A"] @ c, self.M["B"] @ c
        cs = (1 - s) * cA + s * cB + self.ctx.arc_offset(s)
        t = cs - lin @ c[:2]
        return np.hstack([lin, t[:, None]])

    def _warp(self, M):
        h, w = self.ctx.shape[:2]
        rgba = np.dstack([self.premult, self.alpha])
        out = cv2.warpAffine(rgba, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        return out[..., :3], np.clip(out[..., 3], 0, 1), None

    def render(self, s):
        return self._warp(self.transform(s))


class ShaftLayer:
    """The barbell shaft, re-synthesised from a clean cross-section profile."""

    def __init__(self, ctx, spec):
        self.name = spec["name"]
        self.ctx = ctx
        self.ends = {k: np.asarray(v, np.float64) for k, v in spec["ends"].items()}
        self.thick = spec["thickness"]
        self.fade = spec.get("fade_start", 0)
        pr = spec["profile"]
        img = ctx.img[pr["image"]]
        p0, p1 = np.asarray(pr["from"], np.float64), np.asarray(pr["to"], np.float64)
        d = (p1 - p0) / np.linalg.norm(p1 - p0)
        n = np.array([-d[1], d[0]])
        T = self.thick[pr["image"]]
        self.vs = np.linspace(-0.5, 0.5, 65)
        ts = np.linspace(0, 1, 40)
        mx, my = [], []
        for v in self.vs:
            pts = p0[None] + ts[:, None] * (p1 - p0)[None] + (v * (T - 1.5)) * n[None]
            mx.append(pts[:, 0])
            my.append(pts[:, 1])
        mx = np.array(mx, np.float32)
        my = np.array(my, np.float32)
        samp = cv2.remap(img, mx, my, cv2.INTER_LINEAR)
        self.profile = np.median(samp, axis=1)  # (65, 3)

    def render(self, s):
        h, w = self.ctx.shape[:2]
        off = self.ctx.arc_offset(s)
        P0 = (1 - s) * self.ends["A"][0] + s * self.ends["B"][0] + off
        P1 = (1 - s) * self.ends["A"][1] + s * self.ends["B"][1] + off
        T = (1 - s) * self.thick["A"] + s * self.thick["B"]
        L = np.linalg.norm(P1 - P0)
        d = (P1 - P0) / L
        n = np.array([-d[1], d[0]])
        x0 = int(max(min(P0[0], P1[0]) - T, 0)); x1 = int(min(max(P0[0], P1[0]) + T, w))
        y0 = int(max(min(P0[1], P1[1]) - T, 0)); y1 = int(min(max(P0[1], P1[1]) + T, h))
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float64)
        rx, ry = xx - P0[0], yy - P0[1]
        t = rx * d[0] + ry * d[1]
        v = rx * n[0] + ry * n[1]
        a = np.clip(T / 2 - np.abs(v) + 0.5, 0, 1)
        a *= np.clip(t + 0.5, 0, 1) * np.clip(L - t + 0.5, 0, 1)
        if self.fade:
            a *= smoothstep(0, self.fade, t)
        vn = np.clip(v / T, -0.5, 0.5)
        idx = (vn + 0.5) * (len(self.vs) - 1)
        col = np.stack([np.interp(idx, np.arange(len(self.vs)), self.profile[:, c]) for c in range(3)], -1)
        premult = np.zeros((h, w, 3), np.float32)
        alpha = np.zeros((h, w), np.float32)
        premult[y0:y1, x0:x1] = col * a[..., None]
        alpha[y0:y1, x0:x1] = a
        return premult, alpha, (x0, y0, x1, y1)


def ik_elbow(G, S, L1, L2, sign):
    v = S - G
    d = np.linalg.norm(v)
    u = v / max(d, 1e-6)
    n = np.array([-u[1], u[0]])
    if d >= L1 + L2:  # out of reach: keep the chain straight, stretch proportionally
        return G + u * d * L1 / (L1 + L2)
    d = max(d, abs(L1 - L2) + 1e-3)
    a = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
    hh = math.sqrt(max(L1 * L1 - a * a, 0.0))
    return G + a * u + sign * hh * n


def side_of(G, S, E):
    v = S - G
    e = E - G
    return float(v[0] * e[1] - v[1] * e[0]) / max(np.linalg.norm(v), 1e-6)


class LimbLayer:
    """A 2-bone limb (hand/forearm, upper arm) driven by IK.

    Joint order: [grip (on the bar), elbow, root (shoulder)]. The grip follows the
    bar path, the root is fixed on the body (interpolated between A and B), the
    elbow comes from 2-bone IK with interpolated bone lengths. The source pixels
    are mapped with inverse linear-blend skinning (one affine per bone, blended
    smoothly near the joint), which bends without tearing.
    """

    def __init__(self, ctx, spec, variant):
        self.name = spec["name"]
        self.ctx = ctx
        self.spec = spec
        J = {k: [None if p is None else np.asarray(p, np.float64) for p in v] for k, v in spec["joints"].items()}
        self.J = J
        self.W = {k: np.asarray(v, np.float64) for k, v in spec.get("widths", {}).items()}
        # bone lengths per pose; fall back to the other pose when a joint is hidden
        L = {}
        for k in ("A", "B"):
            if J[k][1] is not None:
                L[k] = (np.linalg.norm(J[k][1] - J[k][0]), np.linalg.norm(J[k][2] - J[k][1]))
        for k, o in (("A", "B"), ("B", "A")):
            if k not in L:
                L[k] = L[o]
        self.L = L
        # bend side: from the pose with the clearest bend
        cands = []
        for k in ("A", "B"):
            E = J[k][1] if J[k][1] is not None else np.asarray(spec.get("elbow_hint_" + k), np.float64)
            cands.append(side_of(J[k][0], J[k][2], E))
        self.sign = 1.0 if cands[int(np.argmax(np.abs(cands)))] >= 0 else -1.0
        # endpoint corrections so the IK reproduces the given elbows exactly
        self.corr = {}
        for k in ("A", "B"):
            E_ik = ik_elbow(J[k][0], J[k][2], *L[k], self.sign)
            self.corr[k] = (J[k][1] - E_ik) if J[k][1] is not None else np.zeros(2)
        # sources
        self.sources = [spec["source"]]
        if variant in ("dual", "hybrid") and spec.get("alt_source"):
            self.sources.append(spec["alt_source"])
        self.cut = {k: cut_layer(ctx.img[k], spec["mask"][k]) for k in self.sources}
        fe = spec.get("feather_end", 0)
        if fe:
            for k in self.sources:
                self.cut[k] = self._feather_root(k, fe)
        self.xfade = tuple(spec.get("crossfade", [0.3, 0.7]))

    def _feather_root(self, k, fe):
        premult, alpha = self.cut[k]
        E, S = self.J[k][1], self.J[k][2]
        h, w = alpha.shape
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        d = (S - E) / np.linalg.norm(S - E)
        L2 = np.linalg.norm(S - E)
        t = (xx - E[0]) * d[0] + (yy - E[1]) * d[1]
        f = 1.0 - smoothstep(L2 - fe, L2 + 6, t)
        return premult * f[..., None], alpha * f

    def pose(self, s):
        J, L = self.J, self.L
        G = (1 - s) * J["A"][0] + s * J["B"][0] + self.ctx.arc_offset(s)
        S = (1 - s) * J["A"][2] + s * J["B"][2]
        L1 = (1 - s) * L["A"][0] + s * L["B"][0]
        L2 = (1 - s) * L["A"][1] + s * L["B"][1]
        E = ik_elbow(G, S, L1, L2, self.sign) + (1 - s) * self.corr["A"] + s * self.corr["B"]
        if "A" in self.W and "B" in self.W:
            Wd = (1 - s) * self.W["A"] + s * self.W["B"]
        else:
            Wd = None
        return [G, E, S], Wd

    def _render_source(self, k, joints, widths):
        premult, alpha = self.cut[k]
        src = self.J[k]
        if src[1] is None:
            raise ValueError(f"{self.name}: source {k} needs a visible elbow")
        h, w = alpha.shape
        # target bbox
        pts = np.array(joints)
        pad = 160
        x0 = int(max(pts[:, 0].min() - pad, 0)); x1 = int(min(pts[:, 0].max() + pad, w))
        y0 = int(max(pts[:, 1].min() - pad, 0)); y1 = int(min(pts[:, 1].max() + pad, h))
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float64)
        P = np.stack([xx, yy], -1)
        maps, dists = [], []
        for b in range(2):
            t0, t1 = joints[b], joints[b + 1]
            s0, s1 = src[b], src[b + 1]
            Lt, Ls = np.linalg.norm(t1 - t0), np.linalg.norm(s1 - s0)
            dt, ds = (t1 - t0) / Lt, (s1 - s0) / Ls
            nt, ns = np.array([-dt[1], dt[0]]), np.array([-ds[1], ds[0]])
            k_w = 1.0
            if widths is not None and k in self.W:
                k_w = (widths[b] + widths[b + 1]) / (self.W[k][b] + self.W[k][b + 1])
            R = P - t0
            u = (R @ dt) / Lt
            v = (R @ nt) / k_w
            Q = s0[None, None] + u[..., None] * (Ls * ds)[None, None] + v[..., None] * ns[None, None]
            maps.append(Q)
            uc = np.clip(u, 0, 1)
            closest = t0 + uc[..., None] * (t1 - t0)
            dists.append(np.linalg.norm(P - closest, axis=-1))
        tau = 10.0
        d0, d1 = dists
        w1 = 1.0 / (1.0 + np.exp((d1 - d0) / tau))  # weight of bone 1 (upper arm)
        Q = maps[0] * (1 - w1[..., None]) + maps[1] * w1[..., None]
        mx, my = Q[..., 0].astype(np.float32), Q[..., 1].astype(np.float32)
        rgba = np.dstack([premult, alpha])
        out = cv2.remap(rgba, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        full_p = np.zeros((h, w, 3), np.float32)
        full_a = np.zeros((h, w), np.float32)
        full_p[y0:y1, x0:x1] = out[..., :3]
        full_a[y0:y1, x0:x1] = np.clip(out[..., 3], 0, 1)
        return full_p, full_a, (x0, y0, x1, y1)

    def render(self, s, return_both=False):
        joints, widths = self.pose(s)
        main = self._render_source(self.sources[0], joints, widths)
        if len(self.sources) == 1:
            return main
        alt = self._render_source(self.sources[1], joints, widths)
        # alt source is A (start pose): weight of B grows with s
        wB = float(smoothstep(self.xfade[0], self.xfade[1], s))
        if self.sources[0] == "A":
            wB = 1 - wB
        if return_both:
            return main, alt, wB
        p = main[0] * wB + alt[0] * (1 - wB)
        a = main[1] * wB + alt[1] * (1 - wB)
        bb = (min(main[2][0], alt[2][0]), min(main[2][1], alt[2][1]), max(main[2][2], alt[2][2]), max(main[2][3], alt[2][3]))
        return p, a, bb


# --------------------------------------------------------------------------
# Static plate
# --------------------------------------------------------------------------


def union_mask(ctx, key, dilate=4):
    h, w = ctx.shape[:2]
    m = np.zeros((h, w), np.uint8)
    for L in ctx.rig["layers"]:
        poly = L.get("mask", {}).get(key)
        if poly:
            m |= (poly_mask(ctx.shape, poly) > 0.05).astype(np.uint8)
    if dilate:
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * dilate + 1, 2 * dilate + 1)))
    return m.astype(bool)


_LAMA = {}


def inpaint(img, hole, weights=None):
    """Inpaint `hole` (bool mask) in an RGB float image: LaMa if available, else OpenCV Telea."""
    if weights and os.path.exists(weights):
        try:
            return lama_inpaint(img, hole, weights), "LaMa"
        except Exception as e:  # pragma: no cover - optional dependency
            print("  LaMa unavailable (" + str(e).splitlines()[0] + "), falling back to OpenCV")
    u8 = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
    u8 = cv2.inpaint(u8, hole.astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)
    return cv2.cvtColor(u8, cv2.COLOR_BGR2RGB).astype(np.float32), "OpenCV"


def lama_inpaint(img, hole, weights):
    import torch
    torch.set_num_threads(max(os.cpu_count() or 1, 1))
    if weights not in _LAMA:
        _LAMA[weights] = torch.jit.load(weights, map_location="cpu").eval()
    model = _LAMA[weights]
    ys, xs = np.nonzero(hole)
    h, w = hole.shape
    pad = 96
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, w)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, h)
    # sizes multiple of 8
    x1 = x0 + ((x1 - x0) // 8) * 8
    y1 = y0 + ((y1 - y0) // 8) * 8
    crop = img[y0:y1, x0:x1] / 255.0
    m = hole[y0:y1, x0:x1].astype(np.float32)
    ti = torch.from_numpy(crop.transpose(2, 0, 1)[None].astype(np.float32))
    tm = torch.from_numpy(m[None, None])
    with torch.no_grad():
        res = model(ti * (1 - tm), tm)[0].permute(1, 2, 0).numpy() * 255.0
    out = img.copy()
    sub = out[y0:y1, x0:x1]
    sub[m > 0.5] = res[m > 0.5]
    return out


def build_static(ctx, lama=None, debug_dir=None):
    st = ctx.rig.get("static", {})
    base, fill = st.get("base", "B"), st.get("fill_from", "A")
    movB = union_mask(ctx, base, 4)
    if st.get("fill_mode", "background") == "background":
        # only borrow pure background pixels from the other image: body pixels of
        # the other image are drawn slightly differently and would leave seams
        bg = (fg_alpha(ctx.img[fill]) < 0.02).astype(np.uint8)
        movA = ~cv2.erode(bg, np.ones((7, 7), np.uint8)).astype(bool)
        # optional regions where the other image's body pixels are known to be clean
        # (visible there and not covered by its own moving parts)
        if st.get("fill_regions"):
            allow = np.zeros(movA.shape, bool)
            for poly in st["fill_regions"]:
                allow |= poly_mask(ctx.shape, poly) > 0.5
            movA &= ~(allow & ~union_mask(ctx, fill, 3))
    else:
        movA = union_mask(ctx, fill, 4)
    fillable = movB & ~movA
    hole = movB & movA
    # soft blend of the fill near the boundary of the base's moving region
    wfill = cv2.GaussianBlur(movB.astype(np.float32), (0, 0), 2.0)
    wfill = np.where(movB, 1.0, wfill) * (~movA)
    plate = ctx.img[base] * (1 - wfill[..., None]) + ctx.img[fill] * wfill[..., None]
    hole_d = cv2.dilate(hole.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    if hole_d.any():
        plate, how = inpaint(plate, hole_d, lama)
        print(f"  static plate: {how} inpainting of {int(hole_d.sum())} px")
    # body silhouette (everything that is not pure white background)
    fg = fg_alpha(plate)
    core = (fg > 0.5).astype(np.uint8)
    core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    core = fill_holes(core)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(core.astype(np.uint8))
    keep = np.zeros_like(core)
    for i in range(1, n):
        if stats[i, 4] > 400:
            keep |= lab == i
    er = cv2.erode(keep.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32)
    body_alpha = np.maximum(fg * keep, er)
    if debug_dir:
        save_rgb(os.path.join(debug_dir, "static_plate.png"), plate)
        dbg = plate.copy()
        dbg[fillable] = dbg[fillable] * 0.5 + np.array([0, 120, 255]) * 0.5
        dbg[hole_d] = dbg[hole_d] * 0.4 + np.array([255, 0, 0]) * 0.6
        save_rgb(os.path.join(debug_dir, "static_plate_regions.png"), dbg)
        cv2.imwrite(os.path.join(debug_dir, "body_alpha.png"), (body_alpha * 255).astype(np.uint8))
    return plate.astype(np.float32), body_alpha.astype(np.float32)


# --------------------------------------------------------------------------
# Rig and rendering
# --------------------------------------------------------------------------


class Puppet:
    def __init__(self, rig_path, variant="single", lama=None, debug_dir=None):
        with open(rig_path) as f:
            self.rig = json.load(f)
        self.ctx = Ctx(self.rig, os.path.dirname(os.path.abspath(rig_path)))
        self.ctx.lama = lama
        self.variant = variant
        print("building static plate...")
        self.plate, self.body_alpha = build_static(self.ctx, lama, debug_dir)
        self.layers = []
        for spec in self.rig["layers"]:
            t = spec["type"]
            if t == "body":
                self.layers.append(None)
            elif t == "rigid":
                L = RigidLayer(self.ctx, spec)
                print(f"  layer {L.name}: rigid, fit error {L.score:.1f}/255")
                self.layers.append(L)
            elif t == "shaft":
                self.layers.append(ShaftLayer(self.ctx, spec))
            elif t == "limb":
                self.layers.append(LimbLayer(self.ctx, spec, variant))
            else:
                raise ValueError("unknown layer type " + t)

    def render(self, s, limb_override=None):
        canvas = self.plate.copy()
        for L in self.layers:
            if L is None:
                a = self.body_alpha[..., None]
                canvas = self.plate * a + canvas * (1 - a)
                continue
            if limb_override is not None and L.name in limb_override:
                p, a, bb = limb_override[L.name]
            else:
                p, a, bb = L.render(s)
            if bb is None:
                canvas = p + (1 - a[..., None]) * canvas
            else:
                x0, y0, x1, y1 = bb
                canvas[y0:y1, x0:x1] = p[y0:y1, x0:x1] + (1 - a[y0:y1, x0:x1, None]) * canvas[y0:y1, x0:x1]
        return canvas

    def debug_overlay(self, out_dir):
        for k in ("A", "B"):
            im = cv2.cvtColor(self.ctx.img[k].astype(np.uint8), cv2.COLOR_RGB2BGR)
            colors = [(255, 0, 0), (0, 160, 0), (0, 0, 255), (200, 0, 200), (0, 160, 200), (120, 120, 0)]
            for i, spec in enumerate(self.rig["layers"]):
                poly = spec.get("mask", {}).get(k)
                c = colors[i % len(colors)]
                if poly:
                    cv2.polylines(im, [np.round(np.asarray(poly)).astype(np.int32)], True, c, 1, cv2.LINE_AA)
                for j in spec.get("joints", {}).get(k, []):
                    if j is not None:
                        cv2.circle(im, (int(j[0]), int(j[1])), 5, c, -1)
                for p in spec.get("points", {}).get(k, []):
                    cv2.drawMarker(im, (int(p[0]), int(p[1])), c, cv2.MARKER_CROSS, 12, 2)
                for p in spec.get("ends", {}).get(k, []):
                    cv2.drawMarker(im, (int(p[0]), int(p[1])), c, cv2.MARKER_DIAMOND, 10, 2)
            cv2.imwrite(os.path.join(out_dir, f"rig_overlay_{k}.png"), im)


def frame_size(rig, w_override=None):
    W = w_override or rig.get("output", {}).get("width", 960)
    h, w = 1024, 1536
    H = int(round(W * h / w / 2)) * 2
    return W, H


def encode(frames, fps, size, out_base, crf_h264=24, crf_vp9=36):
    """Encode RGB uint8 frames to H.264 MP4 (iPhone-safe) and VP9 WebM, keyframe only at loop start."""
    W, H = size
    n = len(frames)
    raw = b"".join(f.tobytes() for f in frames)
    src = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(fps), "-i", "-"]
    vf = ["-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
    mp4, webm = out_base + ".mp4", out_base + ".webm"
    subprocess.run(src + vf + ["-c:v", "libx264", "-preset", "veryslow", "-crf", str(crf_h264),
                               "-profile:v", "high", "-level", "4.2", "-tune", "animation",
                               "-x264-params", f"keyint={n}:min-keyint={n}:scenecut=0",
                               "-movflags", "+faststart", "-an", mp4], input=raw, check=True)
    subprocess.run(src + vf + ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(crf_vp9),
                               "-row-mt", "1", "-deadline", "good", "-cpu-used", "1", "-g", str(n),
                               "-an", webm], input=raw, check=True)
    return {p: os.path.getsize(p) for p in (mp4, webm)}


def contact_sheet(frames, idxs, path, cols=6, label=""):
    tiles = []
    for i in idxs:
        f = cv2.cvtColor(frames[i], cv2.COLOR_RGB2BGR).copy()
        f = cv2.resize(f, (480, int(round(480 * f.shape[0] / f.shape[1]))), interpolation=cv2.INTER_AREA)
        cv2.putText(f, f"#{i}", (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2, cv2.LINE_AA)
        tiles.append(f)
    while len(tiles) % cols:
        tiles.append(np.full_like(tiles[0], 255))
    rows = [np.hstack(tiles[r:r + cols]) for r in range(0, len(tiles), cols)]
    sheet = np.vstack(rows)
    if label:
        bar = np.full((36, sheet.shape[1], 3), 255, np.uint8)
        cv2.putText(bar, label, (8, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2, cv2.LINE_AA)
        sheet = np.vstack([bar, sheet])
    cv2.imwrite(path, sheet, [cv2.IMWRITE_JPEG_QUALITY, 78])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("rig")
    ap.add_argument("--out", required=True, help="output path prefix, e.g. demo/bench_press")
    ap.add_argument("--variant", default="single", choices=["single", "dual", "hybrid"],
                    help="single: one source per part (no cross-dissolve). dual: A/B cross-dissolve on limbs. "
                         "hybrid: dual, with the dissolve replaced by RIFE on pre-aligned layers.")
    ap.add_argument("--lama", default=os.environ.get("LAMA_WEIGHTS"), help="path to big-lama.pt (optional)")
    ap.add_argument("--rife", default=os.environ.get("RIFE_WEIGHTS"), help="path to RIFE flownet .pkl (hybrid)")
    ap.add_argument("--width", type=int, default=None)
    ap.add_argument("--crf-h264", type=int, default=None)
    ap.add_argument("--crf-vp9", type=int, default=None)
    ap.add_argument("--debug", action="store_true")
    ap.add_argument("--frames-dir", default=None, help="also save every frame as PNG here")
    ap.add_argument("--no-video", action="store_true")
    args = ap.parse_args()

    out_dir = os.path.dirname(os.path.abspath(args.out))
    os.makedirs(out_dir, exist_ok=True)
    debug_dir = None
    if args.debug:
        debug_dir = args.out + "_debug"
        os.makedirs(debug_dir, exist_ok=True)
    pup = Puppet(args.rig, args.variant, args.lama, debug_dir)
    if debug_dir:
        pup.debug_overlay(debug_dir)
    svals, fps = timeline(pup.rig["timing"])
    size = frame_size(pup.rig, args.width)
    blender = None
    if args.variant == "hybrid":
        from rife_blend import RifeBlender
        blender = RifeBlender(args.rife)

    print(f"rendering {len(svals)} frames at {fps} fps, {size[0]}x{size[1]} ({args.variant})")
    cache = {}
    frames = []
    for i, s in enumerate(svals):
        key = round(s, 6)
        if key not in cache:
            if blender is not None:
                full = blender.render(pup, s)
            else:
                full = pup.render(s)
            fr = cv2.resize(full, size, interpolation=cv2.INTER_AREA)
            cache[key] = np.clip(fr + 0.5, 0, 255).astype(np.uint8)
        frames.append(cache[key])
        if args.frames_dir:
            os.makedirs(args.frames_dir, exist_ok=True)
            cv2.imwrite(os.path.join(args.frames_dir, f"{i:04d}.png"), cv2.cvtColor(frames[-1], cv2.COLOR_RGB2BGR))
    np.save(args.out + "_s.npy", np.array(svals))
    n = len(frames)
    contact_sheet(frames, np.linspace(0, n - 1, 18).round().astype(int), args.out + "_contact.jpg",
                  label=f"{os.path.basename(args.out)} - {args.variant}")
    if not args.no_video:
        o = pup.rig.get("output", {})
        sizes = encode(frames, fps, size, args.out, args.crf_h264 or o.get("crf_h264", 24),
                       args.crf_vp9 or o.get("crf_vp9", 36))
        for p, b in sizes.items():
            print(f"  {p}: {b / 1024:.0f} KB")
    if args.debug:
        np.save(args.out + "_frames.npy", np.stack(frames))


if __name__ == "__main__":
    main()
