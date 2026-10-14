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
}

/** Géométrie fusionnée d'un groupe musculaire : un seul maillage (un seul appel de dessin). */
export interface GroupGeometry {
  group: MuscleGroupId;
  positions: Float32Array;
  indices: Uint32Array;
  muscles: MuscleRange[];
  /** Boîte englobante [minX, minY, minZ, maxX, maxY, maxZ] en mètres. */
  bounds: [number, number, number, number, number, number];
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
    const bounds: GroupGeometry['bounds'] = [
      Infinity,
      Infinity,
      Infinity,
      -Infinity,
      -Infinity,
      -Infinity,
    ];
    let vertexBase = 0;
    let indexBase = 0;
    for (const entry of list) {
      const local = dequantizePositions(entry, buffer);
      positions.set(local, vertexBase * 3);
      const localIndices = readIndices(entry, buffer);
      for (let i = 0; i < localIndices.length; i++) {
        indices[indexBase + i] = (localIndices[i] ?? 0) + vertexBase;
      }
      for (let axis = 0; axis < 3; axis++) {
        const min = entry.min[axis] ?? 0;
        const max = min + 65535 * (entry.scale[axis] ?? 0);
        bounds[axis] = Math.min(bounds[axis] ?? Infinity, min);
        bounds[axis + 3] = Math.max(bounds[axis + 3] ?? -Infinity, max);
      }
      muscles.push({
        name: entry.name,
        side: entry.side,
        firstTriangle: indexBase / 3,
        triangleCount: localIndices.length / 3,
      });
      vertexBase += local.length / 3;
      indexBase += localIndices.length;
    }
    return { group, positions, indices, muscles, bounds };
  });
}

/** Muscle auquel appartient un triangle de la géométrie fusionnée (recherche dichotomique). */
export function muscleAtTriangle(
  muscles: readonly MuscleRange[],
  triangle: number,
): MuscleRange | undefined {
  let low = 0;
  let high = muscles.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const range = muscles[middle];
    if (!range) return undefined;
    if (triangle < range.firstTriangle) high = middle - 1;
    else if (triangle >= range.firstTriangle + range.triangleCount) low = middle + 1;
    else return range;
  }
  return undefined;
}

/** Boîte englobante de plusieurs groupes. */
export function unionBounds(groups: readonly GroupGeometry[]): GroupGeometry['bounds'] {
  return groups.reduce<GroupGeometry['bounds']>(
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
