import {
  buildGroupGeometries,
  expectedBinarySize,
  parseManifest,
  type GroupGeometry,
} from './model';

/**
 * Version du modèle : à augmenter si public/atlas3d/ change, pour que le cache hors ligne
 * (« premier servi » dans le service worker) reprenne les nouveaux fichiers.
 */
export const MODEL_VERSION = '1';

export function modelUrl(file: 'muscles_q.json' | 'muscles_q.bin'): string {
  return `${import.meta.env.BASE_URL}atlas3d/${file}?v=${MODEL_VERSION}`;
}

export interface LoadedModel {
  groups: GroupGeometry[];
  /** Octets reçus pour le .bin et le .json. */
  bytes: number;
}

async function fetchOk(url: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url} : HTTP ${response.status}`);
  return response;
}

/** Lit une réponse en entier en signalant la progression (0 → 1). */
async function readWithProgress(
  response: Response,
  expected: number,
  onProgress: (fraction: number) => void,
): Promise<ArrayBuffer> {
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(Math.min(1, received / expected));
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

/** Télécharge (ou lit dans le cache hors ligne) le modèle, puis le fusionne par groupe. */
export async function loadModel(
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<LoadedModel> {
  const manifestText = await (await fetchOk(modelUrl('muscles_q.json'), signal)).text();
  const entries = parseManifest(JSON.parse(manifestText));
  const expected = expectedBinarySize(entries);
  const response = await fetchOk(modelUrl('muscles_q.bin'), signal);
  const buffer = await readWithProgress(response, expected, onProgress);
  return {
    groups: buildGroupGeometries(entries, buffer),
    bytes: buffer.byteLength + manifestText.length,
  };
}
