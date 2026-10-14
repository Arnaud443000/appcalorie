import { z } from 'zod';
import { muscleGroupIdSchema, type MuscleGroupId } from '@/data';

/**
 * Lecture du modèle anatomique quantifié (public/atlas3d/muscles_q.*), sans Three.js.
 *
 * Format réel (vérifié sur le fichier, voir assets/atlas3d/scripts/pack.py) :
 * - positions : Int16 petit-boutiste, `position = min + (valeur + 32768) × scale` ;
 * - indices : Uint16, locaux à chaque muscle ;
 * - chaque bloc commence sur un multiple de 4 octets.
 */

const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const manifestEntrySchema = z.object({
  group: muscleGroupIdSchema,
  name: z.string().min(1),
  side: z.enum(['left', 'right']),
  min: vec3Schema,
  scale: vec3Schema,
  pOff: z.number().int().nonnegative(),
  pLen: z.number().int().positive(),
  iOff: z.number().int().nonnegative(),
  iLen: z.number().int().positive(),
});

export type ManifestEntry = z.infer<typeof manifestEntrySchema>;

/** Valide le contenu de muscles_q.json (lève une erreur si le fichier est abîmé). */
export function parseManifest(json: unknown): ManifestEntry[] {
  const entries = z.array(manifestEntrySchema).min(1).parse(json);
  for (const entry of entries) {
    if (entry.pLen % 6 !== 0 || entry.iLen % 6 !== 0 || entry.pOff % 2 !== 0) {
      throw new Error(`Muscle « ${entry.name} » : tailles de blocs incohérentes`);
    }
  }
  return entries;
}

/** Taille attendue du .bin (fin du dernier bloc), pour afficher la progression. */
export function expectedBinarySize(entries: readonly ManifestEntry[]): number {
  return entries.reduce(
    (size, entry) => Math.max(size, entry.pOff + entry.pLen, entry.iOff + entry.iLen),
    0,
  );
}

/** Positions en mètres (x, y, z à la suite) d'un muscle. */
export function dequantizePositions(entry: ManifestEntry, buffer: ArrayBuffer): Float32Array {
  const quantized = new Int16Array(buffer, entry.pOff, entry.pLen / 2);
  const positions = new Float32Array(quantized.length);
  const [minX, minY, minZ] = entry.min;
  const [scaleX, scaleY, scaleZ] = entry.scale;
  for (let i = 0; i < quantized.length; i += 3) {
    positions[i] = minX + ((quantized[i] ?? 0) + 32768) * scaleX;
    positions[i + 1] = minY + ((quantized[i + 1] ?? 0) + 32768) * scaleY;
    positions[i + 2] = minZ + ((quantized[i + 2] ?? 0) + 32768) * scaleZ;
  }
  return positions;
}

/** Indices des triangles d'un muscle (locaux au muscle). */
export function readIndices(entry: ManifestEntry, buffer: ArrayBuffer): Uint16Array {
  return new Uint16Array(buffer, entry.iOff, entry.iLen / 2);
}

/** Plage de triangles d'un muscle dans la géométrie fusionnée de son groupe. */
export interface MuscleRange {
  name: string;
  side: 'left' | 'right';
  firstTriangle: number;
  triangleCount: number;
  /** Boîte englobante du muscle [minX, minY, minZ, maxX, maxY, maxZ] (mètres). */
  bounds: Bounds;
  /** Tranches du muscle (triangles contigus et proches), pour un lancer de rayon rapide. */
  chunks: TriangleChunk[];
}

export interface TriangleChunk {
  firstTriangle: number;
  triangleCount: number;
  bounds: Bounds;
}

/** Triangles par tranche (environ). */
export const CHUNK_TRIANGLES = 1024;

export type Bounds = [number, number, number, number, number, number];

/** Géométrie fusionnée d'un groupe musculaire : un seul maillage (un seul appel de dessin). */
export interface GroupGeometry {
  group: MuscleGroupId;
  positions: Float32Array;
  indices: Uint32Array;
  muscles: MuscleRange[];
  /** Boîte englobante [minX, minY, minZ, maxX, maxY, maxZ] en mètres. */
  bounds: Bounds;
}

/** Dé-quantifie tous les muscles et les fusionne par groupe (ordre d'apparition conservé). */
export function buildGroupGeometries(
  entries: readonly ManifestEntry[],
  buffer: ArrayBuffer,
): GroupGeometry[] {
  if (buffer.byteLength < expectedBinarySize(entries)) {
    throw new Error('Fichier du modèle 3D incomplet');
  }
  const byGroup = new Map<MuscleGroupId, ManifestEntry[]>();
  for (const entry of entries) {
    const list = byGroup.get(entry.group) ?? [];
    list.push(entry);
    byGroup.set(entry.group, list);
  }

  return [...byGroup].map(([group, list]) => {
    const vertexCount = list.reduce((sum, entry) => sum + entry.pLen / 6, 0);
    const indexCount = list.reduce((sum, entry) => sum + entry.iLen / 2, 0);
    const positions = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(indexCount);
    const muscles: MuscleRange[] = [];
    const bounds: Bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    let vertexBase = 0;
    let indexBase = 0;
    for (const entry of list) {
      const local = dequantizePositions(entry, buffer);
      positions.set(local, vertexBase * 3);
      const localIndices = readIndices(entry, buffer);
      for (let i = 0; i < localIndices.length; i++) {
        indices[indexBase + i] = (localIndices[i] ?? 0) + vertexBase;
      }
      // La quantification couvre exactement l'étendue du muscle : min … min + 65535 × scale.
      const own: Bounds = [
        entry.min[0],
        entry.min[1],
        entry.min[2],
        entry.min[0] + 65535 * entry.scale[0],
        entry.min[1] + 65535 * entry.scale[1],
        entry.min[2] + 65535 * entry.scale[2],
      ];
      for (let axis = 0; axis < 3; axis++) {
        bounds[axis] = Math.min(bounds[axis] ?? Infinity, own[axis] ?? Infinity);
        bounds[axis + 3] = Math.max(bounds[axis + 3] ?? -Infinity, own[axis + 3] ?? -Infinity);
      }
      muscles.push({
        name: entry.name,
        side: entry.side,
        firstTriangle: indexBase / 3,
        triangleCount: localIndices.length / 3,
        bounds: own,
        chunks: sliceTriangles(positions, indices, indexBase / 3, localIndices.length / 3, own),
      });
      vertexBase += local.length / 3;
      indexBase += localIndices.length;
    }
    return { group, positions, indices, muscles, bounds };
  });
}

/**
 * Range les triangles d'un muscle en tranches le long de son axe le plus long (tri par comptage,
 * en temps linéaire) et renvoie la boîte englobante de chaque tranche. L'ordre des triangles
 * ne change rien à l'affichage ; il permet au lancer de rayon de ne tester que les tranches
 * traversées au lieu de tout le muscle.
 */
export function sliceTriangles(
  positions: Float32Array,
  indices: Uint32Array,
  firstTriangle: number,
  triangleCount: number,
  bounds: Bounds,
  chunkTriangles = CHUNK_TRIANGLES,
): TriangleChunk[] {
  const slices = Math.max(1, Math.ceil(triangleCount / chunkTriangles));
  const extents = [0, 1, 2].map((axis) => (bounds[axis + 3] ?? 0) - (bounds[axis] ?? 0));
  const axis = extents.indexOf(Math.max(...extents));
  const start = bounds[axis] ?? 0;
  const length = extents[axis] || 1;
  const begin = firstTriangle * 3;
  const sliceOf = new Uint32Array(triangleCount);
  const counts = new Uint32Array(slices + 1);
  for (let t = 0; t < triangleCount; t++) {
    let centroid = 0;
    for (let k = 0; k < 3; k++)
      centroid += positions[(indices[begin + t * 3 + k] ?? 0) * 3 + axis] ?? 0;
    const slice = Math.min(
      slices - 1,
      Math.max(0, Math.floor(((centroid / 3 - start) / length) * slices)),
    );
    sliceOf[t] = slice;
    counts[slice + 1] = (counts[slice + 1] ?? 0) + 1;
  }
  for (let i = 1; i <= slices; i++) counts[i] = (counts[i] ?? 0) + (counts[i - 1] ?? 0);
  const sorted = new Uint32Array(triangleCount * 3);
  const cursor = counts.slice(0, slices);
  for (let t = 0; t < triangleCount; t++) {
    const slice = sliceOf[t] ?? 0;
    const at = cursor[slice] ?? 0;
    cursor[slice] = at + 1;
    const from = begin + t * 3;
    sorted[at * 3] = indices[from] ?? 0;
    sorted[at * 3 + 1] = indices[from + 1] ?? 0;
    sorted[at * 3 + 2] = indices[from + 2] ?? 0;
  }
  indices.set(sorted, begin);

  const chunks: TriangleChunk[] = [];
  for (let slice = 0; slice < slices; slice++) {
    const from = counts[slice] ?? 0;
    const to = counts[slice + 1] ?? 0;
    if (to === from) continue;
    const box: Bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = from * 3; i < to * 3; i++) {
      const vertex = (sorted[i] ?? 0) * 3;
      for (let k = 0; k < 3; k++) {
        const value = positions[vertex + k] ?? 0;
        if (value < (box[k] ?? Infinity)) box[k] = value;
        if (value > (box[k + 3] ?? -Infinity)) box[k + 3] = value;
      }
    }
    chunks.push({ firstTriangle: firstTriangle + from, triangleCount: to - from, bounds: box });
  }
  return chunks;
}

/** Boîte englobante de plusieurs groupes. */
export function unionBounds(groups: readonly GroupGeometry[]): Bounds {
  return groups.reduce<Bounds>(
    (acc, { bounds }) => [
      Math.min(acc[0], bounds[0]),
      Math.min(acc[1], bounds[1]),
      Math.min(acc[2], bounds[2]),
      Math.max(acc[3], bounds[3]),
      Math.max(acc[4], bounds[4]),
      Math.max(acc[5], bounds[5]),
    ],
    [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity],
  );
}
