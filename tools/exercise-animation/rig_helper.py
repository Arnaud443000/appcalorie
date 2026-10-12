#!/usr/bin/env python3
"""Small helpers to write a rig JSON for a new exercise.

  python rig_helper.py diff A.webp B.webp out.png
      Shows what moves between the two images (white = different).

  python rig_helper.py grid IMAGE x0 y0 x1 y1 out.png [--step 10] [--zoom 3]
      Zoomed crop with a labelled pixel grid, to read joint positions and
      polygon corners (red lines every 100 px).

  python animate.py RIG --out DIR/name --debug --no-video
      Then check DIR/name_debug/rig_overlay_A.png / _B.png (polygons, joints,
      keypoints drawn on the images) and static_plate.png.
"""
import argparse

import cv2
import numpy as np


def grid(im, x0, y0, x1, y1, step):
    c = im[y0:y1, x0:x1].copy()
    for x in range((x0 // step + 1) * step, x1, step):
        cv2.line(c, (x - x0, 0), (x - x0, y1 - y0), (0, 0, 255) if x % 100 == 0 else (255, 180, 180), 1)
    for y in range((y0 // step + 1) * step, y1, step):
        cv2.line(c, (0, y - y0), (x1 - x0, y - y0), (0, 0, 255) if y % 100 == 0 else (255, 180, 180), 1)
    for x in range((x0 // 100 + 1) * 100, x1, 100):
        cv2.putText(c, str(x), (x - x0 + 2, 12), 0, 0.4, (0, 0, 200), 1)
    for y in range((y0 // 100 + 1) * 100, y1, 100):
        cv2.putText(c, str(y), (2, y - y0 - 2), 0, 0.4, (0, 0, 200), 1)
    return c


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("diff")
    d.add_argument("a"); d.add_argument("b"); d.add_argument("out")
    g = sub.add_parser("grid")
    g.add_argument("image"); g.add_argument("x0", type=int); g.add_argument("y0", type=int)
    g.add_argument("x1", type=int); g.add_argument("y1", type=int); g.add_argument("out")
    g.add_argument("--step", type=int, default=10); g.add_argument("--zoom", type=float, default=3)
    a = ap.parse_args()
    if a.cmd == "diff":
        A = cv2.imread(a.a).astype(np.int16)
        B = cv2.imread(a.b).astype(np.int16)
        m = (np.abs(cv2.GaussianBlur(A, (5, 5), 0) - cv2.GaussianBlur(B, (5, 5), 0)).max(2) > 30).astype(np.uint8) * 255
        cv2.imwrite(a.out, m)
    else:
        im = cv2.imread(a.image)
        c = grid(im, a.x0, a.y0, a.x1, a.y1, a.step)
        cv2.imwrite(a.out, cv2.resize(c, None, fx=a.zoom, fy=a.zoom, interpolation=cv2.INTER_CUBIC))


if __name__ == "__main__":
    main()
