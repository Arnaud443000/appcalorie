#!/usr/bin/env python3
"""Build and compare several animation approaches on the same timeline.

Approaches (all rendered at 960x640, same 60 fps timing unless noted):
  rife_original : plain RIFE between A and B, like the first attempt
                  (symmetric smoothstep, 30 fps, 1.45 s each way, no holds)
  rife          : plain RIFE between A and B, new timing (60 fps, holds, 1.0 s up / 1.3 s down)
  layered       : approach A - static plate kept pixel-identical, RIFE only inside the motion zone
  puppet        : approach B - 2D skeletal puppet, one source per part (no cross-dissolve)
  puppet_dual   : approach B variant - limbs cross-dissolve from source A to source B
  hybrid        : approach C - puppet geometry, RIFE blends the two pre-aligned limb renders

Outputs (in --out): contact sheets, comparison sheet, side-by-side video,
metrics.json / metrics.md and plots.

Usage: python compare.py exercises/bench_press/rig.json --out demo/comparison --lama big-lama.pt
"""
import argparse
import json
import os
import subprocess

import cv2
import numpy as np

import animate as an

W, H = 960, 640


def to_u8(img):
    return np.clip(img + 0.5, 0, 255).astype(np.uint8)


def small(img):
    return cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)


def render_rife(rife, A, B, svals, cache):
    out = []
    a = cv2.resize(A, (1024, 683), interpolation=cv2.INTER_AREA)
    b = cv2.resize(B, (1024, 683), interpolation=cv2.INTER_AREA)
    for s in svals:
        k = round(float(s), 6)
        if k not in cache:
            if k <= 0:
                f = a
            elif k >= 1:
                f = b
            else:
                f = rife.interp(a, b, k)
            cache[k] = to_u8(cv2.resize(f, (W, H), interpolation=cv2.INTER_AREA))
        out.append(cache[k])
    return out


def motion_zone(pup, svals):
    """Union of every moving layer's footprint over the whole loop, plus both source poses."""
    h, w = pup.ctx.shape[:2]
    z = np.zeros((h, w), np.float32)
    for s in np.unique(np.round(svals, 3)):
        for L in pup.layers:
            if L is None:
                continue
            _, a, _ = L.render(float(s))
            z = np.maximum(z, a)
    z = (z > 0.02).astype(np.uint8)
    z |= an.union_mask(pup.ctx, "A", 0).astype(np.uint8)
    z |= an.union_mask(pup.ctx, "B", 0).astype(np.uint8)
    return cv2.resize(z, (W, H), interpolation=cv2.INTER_NEAREST).astype(bool)


def metrics(frames, zone, fps, svals):
    F = np.stack(frames).astype(np.float32)
    n = len(F)
    static = ~cv2.dilate(zone.astype(np.uint8), np.ones((31, 31), np.uint8)).astype(bool)
    diffs_static, diffs_zone, changed = [], [], []
    for i in range(n):
        d = np.abs(F[(i + 1) % n] - F[i]).max(axis=2)
        diffs_static.append(float(d[static].mean()))
        changed.append(float((d[static] > 2).mean() * 100))
        diffs_zone.append(float(d[zone].mean()))
    lum = F.mean(axis=3)
    region = np.zeros((H, W), bool)
    region[: int(0.55 * H), int(0.69 * W):] = True
    dark = (lum < 45) & region[None]
    area = dark.reshape(n, -1).sum(1).astype(np.float64)
    ys = np.array([np.nonzero(dark[i])[0].mean() if area[i] > 0 else np.nan for i in range(n)])
    # expected plate darkness: interpolate between this variant's own start and end frames
    sv = np.asarray(svals)
    i0, i1 = int(np.argmin(sv)), int(np.argmax(sv))
    expected = area[i0] + (area[i1] - area[i0]) * (sv - sv[i0]) / max(sv[i1] - sv[i0], 1e-6)
    area_ratio = area / expected
    # sharpness in the motion zone (variance of the Laplacian)
    sharp = np.array([cv2.Laplacian(cv2.cvtColor(f, cv2.COLOR_RGB2GRAY), cv2.CV_32F)[zone].var() for f in frames])
    sharp_exp = sharp[i0] + (sharp[i1] - sharp[i0]) * (sv - sv[i0]) / max(sv[i1] - sv[i0], 1e-6)
    sharp_ratio = sharp / sharp_exp
    # motion smoothness of the plate centroid
    v = np.diff(np.concatenate([ys, ys[:1]]))
    acc = np.diff(np.concatenate([v, v[:1]]))
    sign_changes = int(np.sum(np.abs(np.diff(np.sign(np.where(np.abs(v) < 0.05, 0, v)))) == 2))
    seam = diffs_zone[-1] / (np.median(diffs_zone) + 1e-6)
    return {
        "static_flicker_mean": float(np.mean(diffs_static)),
        "static_flicker_max": float(np.max(diffs_static)),
        "static_pixels_changing_pct": float(np.mean(changed)),
        "plate_dark_area_min_ratio": float(np.nanmin(area_ratio)),
        "sharpness_min_ratio": float(np.min(sharp_ratio)),
        "velocity_reversals": sign_changes,
        "accel_rms_px": float(np.sqrt(np.nanmean(acc ** 2))),
        "loop_seam_ratio": float(seam),
        "series": {"y": ys.tolist(), "area_ratio": area_ratio.tolist(), "static": diffs_static,
                   "sharp_ratio": sharp_ratio.tolist()},
    }


def label(img, text):
    im = img.copy()
    cv2.rectangle(im, (0, 0), (im.shape[1], 34), (255, 255, 255), -1)
    cv2.putText(im, text, (8, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 0), 2, cv2.LINE_AA)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("rig")
    ap.add_argument("--out", required=True)
    ap.add_argument("--lama", default=None)
    ap.add_argument("--cache", default=None, help="directory to cache rendered frames (npy)")
    ap.add_argument("--only", default=None, help="comma list of variants to (re)compute")
    ap.add_argument("--best", default="puppet", help="variant highlighted in the table")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    cache_dir = args.cache or args.out
    os.makedirs(cache_dir, exist_ok=True)

    pup = an.Puppet(args.rig, "single", args.lama)
    svals, fps = an.timeline(pup.rig["timing"])
    zone = motion_zone(pup, svals)
    A, B = pup.ctx.img["A"], pup.ctx.img["B"]
    plate_s = small(pup.plate)

    # the first attempt's timing: symmetric smoothstep ping-pong, 30 fps, 1.45 s each way
    orig_t = {"fps": 30, "hold_A": 0.0, "A_to_B": 1.45, "hold_B": 0.0, "B_to_A": 1.45,
              "ease": "smoothstep", "start": "zero"}
    s_orig, _ = an.timeline(orig_t)

    variants = {}
    wanted = None if not args.only else set(args.only.split(","))

    def cached(name, fn):
        p = os.path.join(cache_dir, name + ".npy")
        if os.path.exists(p) and (wanted is None or name not in wanted):
            return list(np.load(p))
        print("rendering", name)
        fr = fn()
        np.save(p, np.stack(fr))
        return fr

    rife = None
    rcache = {}

    def get_rife():
        nonlocal rife
        if rife is None:
            from rife_blend import Rife
            rife = Rife(scale=0.5)
        return rife

    variants["rife_original"] = cached("rife_original", lambda: render_rife(get_rife(), A, B, s_orig, rcache))
    variants["rife"] = cached("rife", lambda: render_rife(get_rife(), A, B, svals, rcache))

    def layered():
        fr = []
        m = cv2.GaussianBlur(cv2.dilate(zone.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32), (0, 0), 3)[..., None]
        for f in variants["rife"]:
            fr.append(to_u8(f.astype(np.float32) * m + plate_s * (1 - m)))
        return fr

    variants["layered"] = cached("layered", layered)

    def puppet_frames(variant):
        p = pup if variant == "single" else an.Puppet(args.rig, variant, args.lama)
        blender = None
        if variant == "hybrid":
            from rife_blend import RifeBlender
            blender = RifeBlender()
        cache, out = {}, []
        for s in svals:
            k = round(s, 6)
            if k not in cache:
                full = blender.render(p, s) if blender else p.render(s)
                cache[k] = to_u8(small(full))
            out.append(cache[k])
        return out

    variants["puppet"] = cached("puppet", lambda: puppet_frames("single"))
    variants["puppet_dual"] = cached("puppet_dual", lambda: puppet_frames("dual"))
    variants["hybrid"] = cached("hybrid", lambda: puppet_frames("hybrid"))

    # ---- metrics
    res = {}
    for name, fr in variants.items():
        sv = s_orig if name == "rife_original" else svals
        f_ = 30 if name == "rife_original" else fps
        res[name] = metrics(fr, zone, f_, sv)
        res[name]["fps"] = f_
        res[name]["frames"] = len(fr)
        print(f"{name:14s} flicker {res[name]['static_flicker_mean']:.3f} (max {res[name]['static_flicker_max']:.3f}) "
              f"changing {res[name]['static_pixels_changing_pct']:.2f}%  darkmin {res[name]['plate_dark_area_min_ratio']:.2f} "
              f"sharpmin {res[name]['sharpness_min_ratio']:.2f} rev {res[name]['velocity_reversals']} "
              f"acc {res[name]['accel_rms_px']:.3f} seam {res[name]['loop_seam_ratio']:.2f}")
    with open(os.path.join(args.out, "metrics.json"), "w") as f:
        json.dump(res, f)
    labels = {"rife_original": "RIFE seul (essai d'origine, 30 i/s)", "rife": "RIFE seul, nouveau rythme",
              "layered": "A · Calques + RIFE", "puppet": "B · Marionnette (1 source)",
              "puppet_dual": "B' · Marionnette + fondu A/B", "hybrid": "C · Hybride marionnette + RIFE"}
    table = []
    for name, r in res.items():
        table.append({"key": name, "label": labels.get(name, name), "best": name == args.best,
                      "flicker": f"{r['static_flicker_mean']:.2f}", "changing": f"{r['static_pixels_changing_pct']:.2f} %",
                      "dark": f"{r['plate_dark_area_min_ratio']:.2f}", "sharp": f"{r['sharpness_min_ratio']:.2f}",
                      "seam": f"{r['loop_seam_ratio']:.2f}"})
    with open(os.path.join(args.out, "metrics_table.json"), "w") as f:
        json.dump(table, f, ensure_ascii=False, indent=1)

    # ---- plots
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(2, 2, figsize=(13, 8))
    for name, r in res.items():
        t = np.arange(len(r["series"]["y"])) / r["fps"]
        ax[0, 0].plot(t, r["series"]["y"], label=name)
        ax[0, 1].plot(t, r["series"]["area_ratio"], label=name)
        ax[1, 0].plot(t, r["series"]["static"], label=name)
        ax[1, 1].plot(t, r["series"]["sharp_ratio"], label=name)
    ax[0, 0].set_title("Hauteur du disque proche (px, bas = grand)")
    ax[0, 0].invert_yaxis()
    ax[0, 1].set_title("Noirceur des disques / attendue (<1 = disques transparents)")
    ax[1, 0].set_title("Scintillement zones fixes (diff. moyenne image a image)")
    ax[1, 1].set_title("Nettete zone en mouvement / attendue (<1 = flou)")
    for a in ax.flat:
        a.set_xlabel("temps (s)")
        a.grid(alpha=0.3)
    ax[0, 0].legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(args.out, "metrics.png"), dpi=90)

    # ---- comparison sheet: rows = approaches, cols = moments of the upward phase
    up_idx = [i for i in range(len(svals) - 1) if svals[i + 1] > svals[i]]
    picks = []
    for target in (0.15, 0.35, 0.5, 0.65, 0.85):
        picks.append(min(up_idx, key=lambda i: abs(svals[i] - target)))
    rows = []
    for name in ("rife", "layered", "puppet", "puppet_dual", "hybrid"):
        tiles = []
        for i in picks:
            crop = variants[name][i][0:420, 380:900]
            tiles.append(label(cv2.cvtColor(crop, cv2.COLOR_RGB2BGR), f"{name}  s={svals[i]:.2f}"))
        rows.append(np.hstack(tiles))
    cv2.imwrite(os.path.join(args.out, "comparison_sheet.jpg"), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])
    for name, fr in variants.items():
        an.contact_sheet(fr, np.linspace(0, len(fr) - 1, 18).round().astype(int),
                         os.path.join(args.out, f"contact_{name}.jpg"), label=name)

    # ---- side-by-side video (60 fps; the 30 fps original is shown with each frame doubled)
    names = ["rife_original", "rife", "layered", "puppet", "puppet_dual", "hybrid"]
    n = len(svals)
    tw, th = 480, 320
    grid = []
    for i in range(n):
        tiles = []
        for name in names:
            fr = variants[name]
            j = int(i * 30 / fps) % len(fr) if name == "rife_original" else i
            t = cv2.resize(fr[j], (tw, th), interpolation=cv2.INTER_AREA)
            tiles.append(label(t, name))
        grid.append(np.vstack([np.hstack(tiles[:3]), np.hstack(tiles[3:])]))
    raw = b"".join(g.tobytes() for g in grid)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{tw * 3}x{th * 2}",
                    "-r", str(fps), "-i", "-", "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", os.path.join(args.out, "side_by_side.mp4")], input=raw, check=True)
    print("done")


if __name__ == "__main__":
    main()
