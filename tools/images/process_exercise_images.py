#!/usr/bin/env python3
"""
Traite les images d'exercices générées (une paire départ/fin, ou une image unique).

Usage :
  python3 process_exercise_images.py <dossier_brut> <dossier_sortie> [--qa <dossier_qa>]

Le dossier brut contient des fichiers nommés <slug>_depart.<ext>, <slug>_fin.<ext>, <slug>_unique.<ext>
(ext : png, jpg, jpeg, webp). Pour chaque exercice, le script :
  1. recale l'image « fin » sur l'image « départ » (le décor et le corps doivent rester fixes),
  2. recadre les deux images à l'identique, en gardant la marge blanche,
  3. redimensionne à 1024 px de large et enregistre en WebP,
  4. écrit une planche de contrôle (QA) et un rapport JSON avec des alertes.
"""
import sys, os, json, glob, re
import cv2, numpy as np

WIDTH = 1024
WEBP_Q = 86
SHIFT_WARN = 6.0      # px (sur l'image d'origine) : décalage de cadrage
SCALE_WARN = 0.02     # 2 % : taille du personnage différente entre les deux images
STATIC_WARN = 0.45    # part minimale de l'image qui reste identique (décor, corps) après recalage

def imread(path):
    im = cv2.imread(path, cv2.IMREAD_COLOR)
    if im is None:
        raise RuntimeError(f"Image illisible : {path}")
    return im

def content_mask(im, thr=238):
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    return (g < thr).astype(np.uint8)

def align(a, b):
    """Recale b sur a (affine) ; renvoie b recalée, matrice, dx, dy, échelle, qualité ECC."""
    ga = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gb = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY).astype(np.float32)
    # masque : on ignore les zones très différentes (parties mobiles) pour que le décor fixe domine
    diff = cv2.GaussianBlur(np.abs(ga - gb), (0, 0), 3)
    mask = (diff < 40).astype(np.uint8) * 255
    warp = np.eye(2, 3, dtype=np.float32)
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-7)
    try:
        cc, warp = cv2.findTransformECC(ga, gb, warp, cv2.MOTION_AFFINE, crit, mask, 5)
    except cv2.error:
        cc = 0.0
    out = cv2.warpAffine(b, warp, (a.shape[1], a.shape[0]), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP,
                         borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))
    scale = float(np.sqrt(abs(np.linalg.det(warp[:, :2]))))
    return out, warp, float(warp[0, 2]), float(warp[1, 2]), scale, float(cc)

def union_bbox(images, margin=0.04):
    m = np.zeros(images[0].shape[:2], np.uint8)
    for im in images:
        m |= content_mask(im)
    ys, xs = np.where(m > 0)
    h, w = m.shape
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    mx, my = int((x1 - x0) * margin), int((y1 - y0) * margin)
    return max(0, x0 - mx), max(0, y0 - my), min(w, x1 + mx), min(h, y1 + my)

def save_webp(im, path):
    cv2.imwrite(path, im, [cv2.IMWRITE_WEBP_QUALITY, WEBP_Q])

def resize_w(im, w=WIDTH):
    h = int(round(im.shape[0] * w / im.shape[1]))
    return cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)

def find(raw, slug, kind):
    for ext in ("png", "jpg", "jpeg", "webp"):
        p = os.path.join(raw, f"{slug}_{kind}.{ext}")
        if os.path.exists(p):
            return p
    return None

def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    raw, outdir = sys.argv[1], sys.argv[2]
    qa = sys.argv[sys.argv.index("--qa") + 1] if "--qa" in sys.argv else None
    os.makedirs(outdir, exist_ok=True)
    if qa: os.makedirs(qa, exist_ok=True)
    slugs = sorted({re.sub(r"_(depart|fin|unique)\.[a-z]+$", "", os.path.basename(p))
                    for p in glob.glob(os.path.join(raw, "*_*.*")) if re.search(r"_(depart|fin|unique)\.", p)})
    report = []
    for slug in slugs:
        d, f, u = find(raw, slug, "depart"), find(raw, slug, "fin"), find(raw, slug, "unique")
        item = {"slug": slug, "warnings": []}
        try:
            if u and not (d or f):
                im = imread(u)
                x0, y0, x1, y1 = union_bbox([im])
                out = resize_w(im[y0:y1, x0:x1])
                save_webp(out, os.path.join(outdir, f"{slug}_unique.webp"))
                item["files"] = [f"{slug}_unique.webp"]
            elif d and f:
                a, b = imread(d), imread(f)
                if a.shape != b.shape:
                    b = cv2.resize(b, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_AREA)
                    item["warnings"].append("Les deux images n'avaient pas la même taille : redimensionnée.")
                b2, warp, dx, dy, sc, cc = align(a, b)
                un = content_mask(a) | content_mask(b2)
                same = (cv2.cvtColor(cv2.absdiff(a, b2), cv2.COLOR_BGR2GRAY) < 30).astype(np.uint8)
                static = float((same & un).sum() / max(1, un.sum()))
                item.update(shift_px=[round(dx, 2), round(dy, 2)], scale=round(sc, 4), ecc=round(cc, 3), partie_identique=round(static, 3))
                if abs(dx) > SHIFT_WARN or abs(dy) > SHIFT_WARN:
                    item["warnings"].append(f"Cadrage décalé de {dx:.0f}/{dy:.0f} px entre les deux images (recalé).")
                if abs(sc - 1) > SCALE_WARN:
                    item["warnings"].append(f"Taille du personnage différente de {abs(sc-1)*100:.1f} % entre les deux images (recalée).")
                if static < STATIC_WARN:
                    item["warnings"].append(f"Seulement {static*100:.0f} % de l'image reste identique entre les deux : le décor ou le personnage a trop changé.")
                if cc < 0.9:
                    item["warnings"].append("Recalage peu fiable : à regénérer avec le même cadrage.")
                x0, y0, x1, y1 = union_bbox([a, b2])
                ca, cb = a[y0:y1, x0:x1], b2[y0:y1, x0:x1]
                oa, ob = resize_w(ca), resize_w(cb)
                save_webp(oa, os.path.join(outdir, f"{slug}_depart.webp"))
                save_webp(ob, os.path.join(outdir, f"{slug}_fin.webp"))
                item["files"] = [f"{slug}_depart.webp", f"{slug}_fin.webp"]
                if qa:
                    dif = cv2.absdiff(oa, ob)
                    dif = 255 - cv2.cvtColor(np.clip(dif.astype(int) * 3, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY)
                    sheet = np.hstack([cv2.resize(oa, (512, int(oa.shape[0]*512/oa.shape[1]))),
                                       cv2.resize(ob, (512, int(ob.shape[0]*512/ob.shape[1]))),
                                       cv2.cvtColor(cv2.resize(dif, (512, int(oa.shape[0]*512/oa.shape[1]))), cv2.COLOR_GRAY2BGR)])
                    cv2.imwrite(os.path.join(qa, f"{slug}.jpg"), sheet, [cv2.IMWRITE_JPEG_QUALITY, 80])
            else:
                item["warnings"].append("Paire incomplète : il manque l'image départ ou l'image fin.")
        except Exception as e:
            item["warnings"].append(f"Erreur : {e}")
        report.append(item)
    json.dump(report, open(os.path.join(outdir, "_rapport.json"), "w"), ensure_ascii=False, indent=2)
    for it in report:
        flag = "OK " if not it["warnings"] else "ALERTE"
        print(f"[{flag}] {it['slug']}", *it["warnings"], sep="\n     " if it["warnings"] else "")
if __name__ == "__main__":
    main()
