#!/usr/bin/env python3
"""Export a puppet rig as pre-cut layers + a tiny JSON for the WebGL player (player.js).

Instead of a video, the phone receives: one static body image, a few small RGBA
cut-outs (plates, arms) and the motion parameters. The player recomputes the pose
for every screen refresh (60 or 120 Hz), so playback is as smooth as the screen
allows, at any speed, with no compression artefacts.

Usage: python export_web.py exercises/bench_press/rig.json --out demo/web/bench_press --lama big-lama.pt
"""
import argparse
import json
import math
import os

import cv2
import numpy as np

import animate as an


def write_rgba(path, premult, alpha, scale, quality):
    """Save premultiplied layer as straight-alpha WebP, downscaled."""
    a = np.clip(alpha, 0, 1)
    col = np.where(a[..., None] > 1e-3, premult / np.maximum(a[..., None], 1e-3), 255.0)
    rgba = np.dstack([np.clip(col, 0, 255), a * 255.0]).astype(np.float32)
    # downscale in premultiplied space to avoid dark fringes
    pm = np.dstack([rgba[..., :3] * a[..., None], rgba[..., 3]])
    h, w = a.shape
    size = (max(int(round(w * scale)), 1), max(int(round(h * scale)), 1))
    pm = cv2.resize(pm, size, interpolation=cv2.INTER_AREA)
    a2 = np.clip(pm[..., 3] / 255.0, 0, 1)
    col2 = np.where(a2[..., None] > 1e-3, pm[..., :3] / np.maximum(a2[..., None], 1e-3), 255.0)
    out = np.dstack([np.clip(col2, 0, 255), a2 * 255.0]).astype(np.uint8)
    bgra = cv2.cvtColor(out, cv2.COLOR_RGBA2BGRA)
    cv2.imwrite(path, bgra, [cv2.IMWRITE_WEBP_QUALITY, quality])
    return size


def crop_box(alpha, pad=3):
    bb = an.bbox_of(alpha, pad)
    return bb


def limb_mesh(L, src, box, step=14):
    """Regular triangle grid over the cut-out, skinned to the source skeleton."""
    x0, y0, x1, y1 = box
    alpha = L.cut[src][1]
    xs = np.arange(x0, x1 + step, step, dtype=np.float64)
    ys = np.arange(y0, y1 + step, step, dtype=np.float64)
    nx, ny = len(xs), len(ys)
    occ = cv2.dilate((alpha > 0.002).astype(np.uint8), np.ones((2 * step + 1, 2 * step + 1), np.uint8))
    J = L.J[src]
    verts, tris, index = [], [], {}
    def vid(i, j):
        if (i, j) not in index:
            index[(i, j)] = len(verts)
            verts.append((xs[i], ys[j]))
        return index[(i, j)]
    for j in range(ny - 1):
        for i in range(nx - 1):
            cx, cy = int(min(xs[i] + step / 2, alpha.shape[1] - 1)), int(min(ys[j] + step / 2, alpha.shape[0] - 1))
            if not occ[cy, cx]:
                continue
            a, b, c, d = vid(i, j), vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1)
            tris += [a, b, c, a, c, d]
    V = np.array(verts)
    # per-bone local coordinates and blend weight, same rule as animate.LimbLayer (tau = 10 px)
    loc, dist = [], []
    for b in range(2):
        s0, s1 = J[b], J[b + 1]
        Ls = np.linalg.norm(s1 - s0)
        ds = (s1 - s0) / Ls
        ns = np.array([-ds[1], ds[0]])
        R = V - s0
        u = (R @ ds) / Ls
        v = R @ ns
        loc.append((u, v))
        uc = np.clip(u, 0, 1)
        dist.append(np.linalg.norm(V - (s0 + uc[:, None] * (s1 - s0)), axis=1))
    w1 = 1.0 / (1.0 + np.exp((dist[1] - dist[0]) / 10.0))
    attrs = np.stack([V[:, 0], V[:, 1], loc[0][0], loc[0][1], loc[1][0], loc[1][1], w1], 1)
    return attrs, tris


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rig")
    ap.add_argument("--out", required=True, help="output folder")
    ap.add_argument("--lama", default=None)
    ap.add_argument("--scale", type=float, default=0.75, help="texture scale vs source images")
    ap.add_argument("--quality", type=int, default=82)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    pup = an.Puppet(args.rig, "single", args.lama)
    h, w = pup.ctx.shape[:2]
    sc = args.scale
    data = {"name": pup.rig["name"], "width": w, "height": h, "timing": pup.rig["timing"],
            "arc": pup.ctx.arc.tolist(), "layers": []}

    # static body: un-blend from white so it can be drawn over a white clear colour
    ba = pup.body_alpha
    body_col = np.clip(pup.plate - (1 - ba[..., None]) * 255.0, 0, 255)  # = colour * alpha
    write_rgba(os.path.join(args.out, "body.webp"), body_col, ba, sc, args.quality)

    for L in pup.layers:
        if L is None:
            data["layers"].append({"type": "body", "image": "body.webp", "box": [0, 0, w, h]})
            continue
        if isinstance(L, an.RigidLayer):
            box = crop_box(L.alpha)
            x0, y0, x1, y1 = box
            fn = f"{L.name}.webp"
            write_rgba(os.path.join(args.out, fn), L.premult[y0:y1, x0:x1], L.alpha[y0:y1, x0:x1], sc, args.quality)
            pa, pb = an.decompose(L.M["A"]), an.decompose(L.M["B"])
            d = pb[2] - pa[2]
            pb[2] = pa[2] + (d + math.pi) % (2 * math.pi) - math.pi
            c = L.pivot
            data["layers"].append({"type": "rigid", "name": L.name, "image": fn, "box": list(map(int, box)),
                                   "pA": pa.tolist(), "pB": pb.tolist(), "pivot": c.tolist(),
                                   "cA": (L.M["A"] @ np.r_[c, 1]).tolist(), "cB": (L.M["B"] @ np.r_[c, 1]).tolist()})
        elif isinstance(L, an.ShaftLayer):
            data["layers"].append({"type": "shaft", "name": L.name,
                                   "ends": {k: v.tolist() for k, v in L.ends.items()},
                                   "thickness": L.thick, "fade": L.fade,
                                   "profile": np.round(L.profile).astype(int).tolist()})
        elif isinstance(L, an.LimbLayer):
            src = L.sources[0]
            premult, alpha = L.cut[src]
            box = crop_box(alpha)
            x0, y0, x1, y1 = box
            fn = f"{L.name}.webp"
            write_rgba(os.path.join(args.out, fn), premult[y0:y1, x0:x1], alpha[y0:y1, x0:x1], sc, args.quality)
            attrs, tris = limb_mesh(L, src, box)
            data["layers"].append({
                "type": "limb", "name": L.name, "image": fn, "box": list(map(int, box)),
                "joints": {k: [None if p is None else p.tolist() for p in v] for k, v in L.J.items()},
                "src": src, "lengths": {k: list(v) for k, v in L.L.items()}, "sign": L.sign,
                "corr": {k: v.tolist() for k, v in L.corr.items()},
                "widths": {k: v.tolist() for k, v in L.W.items()},
                "verts": [round(float(v), d) for row in attrs for v, d in zip(row, (1, 1, 4, 2, 4, 2, 3))],
                "tris": tris})
    with open(os.path.join(args.out, "anim.json"), "w") as f:
        json.dump(data, f, separators=(",", ":"))
    files = {p: os.path.getsize(os.path.join(args.out, p)) for p in sorted(os.listdir(args.out)) if p != "files.json"}
    total = sum(files.values()) + os.path.getsize(os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "player.js"))
    with open(os.path.join(args.out, "files.json"), "w") as f:
        json.dump({"files": files, "total": total, "note": "total includes player.js"}, f)
    print(f"exported to {args.out}: {total / 1024:.0f} KB")
    for p in sorted(os.listdir(args.out)):
        print(f"  {p}: {os.path.getsize(os.path.join(args.out, p)) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
