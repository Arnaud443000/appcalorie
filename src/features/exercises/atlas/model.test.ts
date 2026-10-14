import { beforeAll, describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS } from '@/data';
import {
  buildGroupGeometries,
  dequantizePositions,
  expectedBinarySize,
  parseManifest,
  readIndices,
  sliceTriangles,
  unionBounds,
  type ManifestEntry,
} from './model';

/** Construit un .bin minuscule au format réel : Int16 décalés de 32768, Uint16, blocs alignés sur 4. */
function pack(muscles: { group: string; name: string; quantized: number[]; indices: number[] }[]): {
  entries: unknown[];
  buffer: ArrayBuffer;
} {
  const parts: Uint8Array[] = [];
  const entries: unknown[] = [];
  let offset = 0;
  const push = (bytes: Uint8Array) => {
    parts.push(bytes);
    offset += bytes.byteLength;
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      parts.push(new Uint8Array(pad));
      offset += pad;
    }
  };
  for (const muscle of muscles) {
    const positions = new Int16Array(muscle.quantized.map((value) => value - 32768));
    const indices = new Uint16Array(muscle.indices);
    const pOff = offset;
    push(new Uint8Array(positions.buffer));
    const iOff = offset;
    push(new Uint8Array(indices.buffer));
    entries.push({
      group: muscle.group,
      name: muscle.name,
      side: 'left',
      min: [1, 2, 3],
      scale: [0.5, 0.25, 2],
      pOff,
      pLen: positions.byteLength,
      iOff,
      iLen: indices.byteLength,
    });
  }
  const buffer = new Uint8Array(offset);
  let at = 0;
  for (const part of parts) {
    buffer.set(part, at);
    at += part.byteLength;
  }
  return { entries, buffer: buffer.buffer };
}

const TRIANGLE = [0, 0, 0, 2, 0, 0, 0, 4, 0];

describe('Lecture du modèle quantifié', () => {
  const { entries: raw, buffer } = pack([
    { group: 'chest', name: 'A', quantized: TRIANGLE, indices: [0, 1, 2] },
    {
      group: 'lats',
      name: 'B',
      quantized: [...TRIANGLE, 65535, 65535, 65535],
      indices: [0, 1, 2, 1, 3, 2],
    },
    { group: 'chest', name: 'C', quantized: TRIANGLE, indices: [2, 1, 0] },
  ]);
  const entries = parseManifest(raw);

  it('dé-quantifie : position = min + (valeur + 32768) × échelle', () => {
    const positions = dequantizePositions(entries[0] as ManifestEntry, buffer);
    expect([...positions]).toEqual([1, 2, 3, 2, 2, 3, 1, 3, 3]);
    const far = dequantizePositions(entries[1] as ManifestEntry, buffer);
    expect([...far.slice(9)]).toEqual([1 + 65535 * 0.5, 2 + 65535 * 0.25, 3 + 65535 * 2]);
  });

  it('lit les indices et la taille attendue du fichier', () => {
    expect([...readIndices(entries[1] as ManifestEntry, buffer)]).toEqual([0, 1, 2, 1, 3, 2]);
    expect(expectedBinarySize(entries)).toBe(buffer.byteLength - 2); // dernier bloc de 6 octets + 2 de bourrage
  });

  it('fusionne par groupe en décalant les indices, et garde la plage de chaque muscle', () => {
    const groups = buildGroupGeometries(entries, buffer);
    expect(groups.map((g) => g.group)).toEqual(['chest', 'lats']);
    const [chest] = groups;
    if (!chest) throw new Error('groupe manquant');
    expect(chest.positions.length).toBe(18);
    expect([...chest.indices]).toEqual([0, 1, 2, 5, 4, 3]);
    // Boîte de chaque muscle : min … min + 65535 × scale (min [1, 2, 3], scale [0,5 ; 0,25 ; 2]).
    const box = [1, 2, 3, 1 + 65535 * 0.5, 2 + 65535 * 0.25, 3 + 65535 * 2];
    expect(chest.muscles).toMatchObject([
      { name: 'A', side: 'left', firstTriangle: 0, triangleCount: 1, bounds: box },
      { name: 'C', side: 'left', firstTriangle: 1, triangleCount: 1, bounds: box },
    ]);
    expect(chest.muscles[1]?.chunks).toEqual([
      { firstTriangle: 1, triangleCount: 1, bounds: [1, 2, 3, 2, 3, 3] },
    ]);
    expect(unionBounds(groups)[0]).toBe(1);
  });

  it('range les triangles d’un muscle en tranches le long de son axe le plus long', () => {
    // 6 triangles minces alignés sur X (x = 0 … 5), stockés dans le désordre.
    const order = [3, 0, 5, 1, 4, 2];
    const positions = new Float32Array(order.length * 9);
    order.forEach((x, t) => {
      positions.set([x, 0, 0, x + 0.5, 0, 0, x, 1, 0], t * 9);
    });
    const indices = Uint32Array.from({ length: 18 }, (_, i) => i);
    const chunks = sliceTriangles(positions, indices, 0, 6, [0, 0, 0, 5.5, 1, 0], 2);
    expect(chunks.map((c) => [c.firstTriangle, c.triangleCount])).toEqual([
      [0, 2],
      [2, 2],
      [4, 2],
    ]);
    expect(chunks[0]?.bounds).toEqual([0, 0, 0, 1.5, 1, 0]);
    expect(chunks[2]?.bounds).toEqual([4, 0, 0, 5.5, 1, 0]);
    // Mêmes triangles, simplement réordonnés (chaque triple d'indices est conservé).
    const triangles = (list: Uint32Array) =>
      Array.from({ length: list.length / 3 }, (_, t) => list.slice(t * 3, t * 3 + 3).join())
        .sort()
        .join('|');
    expect(triangles(indices)).toBe(triangles(Uint32Array.from({ length: 18 }, (_, i) => i)));
  });

  it('refuse un manifeste invalide ou un fichier tronqué', () => {
    expect(() => parseManifest([{ ...(raw[0] as object), group: 'wings' }])).toThrow();
    expect(() => parseManifest([])).toThrow();
    expect(() => buildGroupGeometries(entries, buffer.slice(0, 10))).toThrow(/incomplet/);
  });
});

// Lecture du vrai fichier via node:fs. Import dynamique non typé : les types Node ne sont pas
// chargés dans src/ (tsconfig.app.json).
interface NodeFs {
  readFileSync(path: string, encoding?: 'utf8'): string & Uint8Array;
}
const NODE_FS = 'node:fs';

describe('Modèle livré (public/atlas3d)', () => {
  let entries: ManifestEntry[] = [];
  let buffer = new ArrayBuffer(0);
  beforeAll(async () => {
    const { readFileSync } = (await import(/* @vite-ignore */ NODE_FS)) as NodeFs;
    // Chemins relatifs à la racine du projet (dossier de lancement de Vitest).
    const dir = 'public/atlas3d/';
    entries = parseManifest(JSON.parse(readFileSync(`${dir}muscles_q.json`, 'utf8')));
    const file: Uint8Array = readFileSync(`${dir}muscles_q.bin`);
    buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  });

  it('contient 130 muscles couvrant les 15 groupes de l’app', () => {
    expect(entries).toHaveLength(130);
    expect(new Set(entries.map((e) => e.group))).toEqual(new Set(MUSCLE_GROUPS.map((g) => g.id)));
    expect(expectedBinarySize(entries)).toBeLessThanOrEqual(buffer.byteLength);
  });

  it('a des indices valides et un corps à l’échelle humaine (mètres, Y vers le haut)', () => {
    const groups = buildGroupGeometries(entries, buffer);
    expect(groups).toHaveLength(15);
    for (const group of groups) {
      const vertices = group.positions.length / 3;
      expect(group.indices.reduce((max, index) => Math.max(max, index), 0)).toBeLessThan(vertices);
    }
    const [minX, minY, , maxX, maxY] = unionBounds(groups);
    expect(maxY - minY).toBeGreaterThan(1.4);
    expect(maxY - minY).toBeLessThan(2);
    expect(Math.abs(minX + maxX)).toBeLessThan(0.02); // symétrique autour de x = 0
  });
});
