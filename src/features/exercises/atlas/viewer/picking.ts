import {
  Box3,
  BufferGeometry,
  Mesh,
  Sphere,
  Vector2,
  Vector3,
  type Camera,
  type Intersection,
  type Material,
  type Object3D,
  type Raycaster,
} from 'three';
import type { MuscleGroupId } from '@/data';
import type { GroupGeometry } from '../model';

/**
 * Choix du muscle touché. Règle : on choisit le muscle **visible**, c'est-à-dire la face tournée
 * vers la caméra la plus proche d'elle, sous le doigt.
 *
 * - Un rayon n'est pas un doigt : sur un bord de membre ou dans une fente du modèle (le droit de
 *   l'abdomen manque, il reste un sillon au milieu du ventre), un rayon unique passe à côté du
 *   muscle de devant et touche celui de derrière. On lance donc 13 rayons sur la surface du doigt.
 * - Le rayon central l'emporte, sauf si la majorité des autres trouvent une surface nettement
 *   plus proche de la caméra (plus de DEPTH_TOLERANCE) : le centre est alors passé à travers
 *   (voir chooseCandidate).
 * - Les faces qui tournent le dos à la caméra sont ignorées explicitement, et les impacts sont
 *   triés par distance, quel que soit le matériau.
 * - Une cible sans groupe (la tête stylisée) fait écran : la toucher ne choisit rien.
 */

export interface PickResult {
  group: MuscleGroupId;
  muscle: string;
}

export interface Candidate {
  /** null : surface qui n'est pas un muscle (tête stylisée) ; elle cache ce qui est derrière. */
  group: MuscleGroupId | null;
  muscle: string;
  /** Distance caméra → impact (mètres). */
  distance: number;
}

/** Rayon du doigt (pixels CSS). */
export const FINGER_RADIUS = 12;
/** Écart de profondeur au-delà duquel un muscle est « nettement plus proche » (mètres). */
export const DEPTH_TOLERANCE = 0.015;

const worldNormal = new Vector3();

/** La face touchée regarde-t-elle vers l'origine du rayon ? */
export function isFrontFacing(hit: Intersection, direction: Vector3): boolean {
  if (!hit.face) return false;
  worldNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
  return worldNormal.dot(direction) < 0;
}

/** Premier impact visible le long du rayon (face avant la plus proche), ou null. */
export function firstVisibleHit(
  raycaster: Raycaster,
  targets: readonly Object3D[],
): Candidate | null {
  const hits = raycaster
    .intersectObjects([...targets], false)
    .sort((a, b) => a.distance - b.distance);
  for (const hit of hits) {
    if (!isFrontFacing(hit, raycaster.ray.direction)) continue;
    const { group = null, muscle = '' } = hit.object.userData as Partial<PickResult>;
    return { group, muscle, distance: hit.distance };
  }
  return null;
}

/** Groupe le plus représenté (à égalité : le plus proche), et son impact le plus proche. */
function mostCommon(list: readonly Candidate[]): Candidate | null {
  const votes = new Map<MuscleGroupId | null, { count: number; nearest: Candidate }>();
  for (const hit of list) {
    const vote = votes.get(hit.group);
    if (!vote) votes.set(hit.group, { count: 1, nearest: hit });
    else {
      vote.count++;
      if (hit.distance < vote.nearest.distance) vote.nearest = hit;
    }
  }
  let best: { count: number; nearest: Candidate } | null = null;
  for (const vote of votes.values()) {
    if (
      !best ||
      vote.count > best.count ||
      (vote.count === best.count && vote.nearest.distance < best.nearest.distance)
    ) {
      best = vote;
    }
  }
  return best?.nearest ?? null;
}

/**
 * Arbitrage entre le rayon central et ceux de la surface du doigt.
 * - Le rayon central l'emporte : c'est ce qu'on voit sous le centre du doigt.
 * - Sauf s'il est passé « à travers » : la majorité des autres rayons qui touchent le corps
 *   trouvent une surface nettement plus proche (fente du modèle, bord de membre effleuré). On
 *   prend alors le groupe le plus représenté parmi ces surfaces de devant.
 * - Sans impact au centre (trou traversant, bord de la silhouette) : le groupe le plus
 *   représenté autour du doigt.
 */
export function chooseCandidate(
  center: Candidate | null,
  around: readonly Candidate[],
): Candidate | null {
  if (!center) return mostCommon(around);
  const inFront = around.filter((hit) => hit.distance < center.distance - DEPTH_TOLERANCE);
  return inFront.length * 2 > around.length ? mostCommon(inFront) : center;
}

/** Décalages (coordonnées normalisées) de 12 rayons sur deux cercles autour du doigt. */
export function fingerOffsets(
  width: number,
  height: number,
  radius = FINGER_RADIUS,
): [number, number][] {
  const offsets: [number, number][] = [];
  for (const [ring, shift] of [
    [radius / 2, 0],
    [radius, Math.PI / 6],
  ] as const) {
    for (let k = 0; k < 6; k++) {
      const angle = shift + (k * Math.PI) / 3;
      offsets.push([
        (2 * ring * Math.cos(angle)) / Math.max(width, 1),
        (2 * ring * Math.sin(angle)) / Math.max(height, 1),
      ]);
    }
  }
  return offsets;
}

const ndc = new Vector2();

/** Muscle visible sous le doigt posé en (x, y), coordonnées normalisées de l'écran. */
export function pickAt(
  raycaster: Raycaster,
  camera: Camera,
  targets: readonly Object3D[],
  x: number,
  y: number,
  offsets: readonly [number, number][],
): PickResult | null {
  const cast = (dx: number, dy: number) => {
    raycaster.setFromCamera(ndc.set(x + dx, y + dy), camera);
    return firstVisibleHit(raycaster, targets);
  };
  const center = cast(0, 0);
  const around = offsets.map(([dx, dy]) => cast(dx, dy)).filter((hit) => hit !== null);
  const chosen = chooseCandidate(center, around);
  return chosen?.group ? { group: chosen.group, muscle: chosen.muscle } : null;
}

/**
 * Cibles de lancer de rayon, jamais affichées : une par tranche de muscle (≈ 1 000 triangles,
 * voir sliceTriangles). Elles partagent les tampons du maillage de leur groupe et ont leur
 * propre boîte englobante : un rayon ne teste que les quelques tranches qu'il traverse, au lieu
 * des 813 000 triangles du corps.
 */
export function createPickTargets(
  group: GroupGeometry,
  geometry: BufferGeometry,
  material: Material,
): Mesh[] {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  return group.muscles.flatMap((muscle) =>
    muscle.chunks.map((chunk) => {
      const target = new BufferGeometry();
      target.setAttribute('position', position);
      target.setIndex(index);
      target.setDrawRange(chunk.firstTriangle * 3, chunk.triangleCount * 3);
      const [minX, minY, minZ, maxX, maxY, maxZ] = chunk.bounds;
      target.boundingBox = new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ));
      target.boundingSphere = target.boundingBox.getBoundingSphere(new Sphere());
      const mesh = new Mesh(target, material);
      mesh.visible = false;
      mesh.matrixAutoUpdate = false;
      mesh.userData = { group: group.group, muscle: muscle.name } satisfies PickResult;
      return mesh;
    }),
  );
}
