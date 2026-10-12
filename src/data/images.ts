import { z } from 'zod';
import type { Exercise } from './schemas';

/**
 * Images d'un exercice, d'après `public/exercises/manifest.json` (généré par
 * `npm run images:manifest`). Convention des fichiers : `<imageSlug>_depart.webp`,
 * `<imageSlug>_fin.webp`, ou `<imageSlug>_unique.webp` (voir public/exercises/README.md).
 */
export type ExerciseImages =
  | { kind: 'none' }
  /** Une seule image (exercice statique, ou une seule des deux positions disponible). */
  | { kind: 'single'; src: string }
  /** Positions de départ et de fin. */
  | { kind: 'pair'; start: string; end: string };

const manifestSchema = z.object({
  version: z.literal(1),
  images: z.record(z.string(), z.array(z.enum(['depart', 'fin', 'unique']))),
});

type Manifest = z.infer<typeof manifestSchema>['images'];

const NONE: ExerciseImages = { kind: 'none' };
const folder = () => `${import.meta.env.BASE_URL}exercises/`;

let manifest: Promise<Manifest> | null = null;

async function fetchManifest(): Promise<Manifest> {
  const response = await fetch(`${folder()}manifest.json`);
  if (!response.ok) throw new Error(`Manifeste des images introuvable (${response.status}).`);
  return manifestSchema.parse(await response.json()).images;
}

/** Lu une seule fois ; en cas d'échec (hors ligne sans cache…), on réessaiera au prochain appel. */
function loadManifest(): Promise<Manifest> {
  manifest ??= fetchManifest().catch((error: unknown) => {
    manifest = null;
    throw error;
  });
  return manifest;
}

/** Oublie le manifeste lu (pour les tests). */
export function resetExerciseImagesCache(): void {
  manifest = null;
}

/** Adresses des images d'un exercice, ou `{ kind: 'none' }` s'il n'en a pas ou si le manifeste manque. */
export async function getExerciseImages(
  exercise: Pick<Exercise, 'imageSlug'>,
): Promise<ExerciseImages> {
  const slug = exercise.imageSlug;
  if (!slug) return NONE;
  let kinds: string[] | undefined;
  try {
    kinds = (await loadManifest())[slug];
  } catch {
    return NONE;
  }
  if (!kinds || kinds.length === 0) return NONE;
  const url = (kind: string) => `${folder()}${slug}_${kind}.webp`;
  const has = (kind: string) => kinds.includes(kind);
  if (has('depart') && has('fin')) return { kind: 'pair', start: url('depart'), end: url('fin') };
  if (has('unique')) return { kind: 'single', src: url('unique') };
  return { kind: 'single', src: url(has('depart') ? 'depart' : 'fin') };
}
