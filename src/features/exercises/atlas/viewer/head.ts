import { LatheGeometry, SplineCurve, Vector2, type BufferGeometry } from 'three';

/**
 * Tête et cou stylisés (le modèle de muscles s'arrête au cou), d'un seul tenant : un profil de
 * mannequin tourné autour de l'axe vertical, aplati sur les côtés et incliné vers l'avant.
 * Le bas du cou plonge entre les trapèzes et les sterno-cléido-mastoïdiens, sans vide.
 * Repère du modèle : mètres, Y vers le haut, avant vers +Z.
 */

/** Haut du crâne (mètres) : environ 1,73 m de la plante des pieds au sommet. */
export const HEAD_TOP = 1.668;

/**
 * Profil (rayon, hauteur) du bas du cou au sommet du crâne. Les sterno-cléido-mastoïdiens
 * s'arrêtent vers 1,50 m, à hauteur de l'angle de la mâchoire : la tête les recouvre.
 */
const PROFILE: [number, number][] = [
  [0.043, 1.36],
  [0.046, 1.42],
  [0.049, 1.46],
  [0.057, 1.48],
  [0.069, 1.5],
  [0.079, 1.53],
  [0.084, 1.57],
  [0.085, 1.6],
  [0.08, 1.63],
  [0.066, 1.652],
  [0.04, 1.664],
  [0, HEAD_TOP],
];

/** Largeur (X) et profondeur (Z) relatives : une tête est plus profonde que large. */
const WIDTH = 0.9;
const DEPTH = 1.12;
/** Axe (Z) en bas du cou puis au niveau de la mâchoire : la tête est en avant du cou. */
const NECK_Z = 0.045;
const SKULL_Z = 0.078;
const NECK_BOTTOM = 1.36;
const JAW = 1.52;

export function createHeadGeometry(): BufferGeometry {
  const curve = new SplineCurve(PROFILE.map(([radius, y]) => new Vector2(radius, y)));
  const geometry = new LatheGeometry(curve.getPoints(48), 56);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const t = Math.min(1, Math.max(0, (y - NECK_BOTTOM) / (JAW - NECK_BOTTOM)));
    position.setX(i, position.getX(i) * WIDTH);
    position.setZ(i, position.getZ(i) * DEPTH + NECK_Z + (SKULL_Z - NECK_Z) * t);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
