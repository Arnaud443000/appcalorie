import { MUSCLE_GROUPS, type MuscleGroupId } from '@/data';

/**
 * Ce que l'adresse demande à l'Atlas :
 * - `?exercice=<id>` : mode exercice (muscles de l'exercice en rouge et rose) ;
 * - `?muscle=<groupe>` : un groupe musculaire déjà choisi ;
 * - rien (ou une valeur inconnue) : aucun choix.
 * `exercice` l'emporte sur `muscle` si les deux sont présents.
 */
export type AtlasParams =
  | { kind: 'exercise'; exerciseId: string }
  | { kind: 'muscle'; group: MuscleGroupId }
  | { kind: 'none' };

export const EXERCISE_PARAM = 'exercice';
export const MUSCLE_PARAM = 'muscle';

export function isMuscleGroupId(value: string): value is MuscleGroupId {
  return MUSCLE_GROUPS.some((item) => item.id === value);
}

export function readAtlasParams(params: URLSearchParams): AtlasParams {
  const exerciseId = params.get(EXERCISE_PARAM)?.trim();
  if (exerciseId) return { kind: 'exercise', exerciseId };
  const group = params.get(MUSCLE_PARAM)?.trim().toLowerCase();
  if (group && isMuscleGroupId(group)) return { kind: 'muscle', group };
  return { kind: 'none' };
}

/** Paramètres d'adresse pour un groupe choisi (ou aucun). */
export function atlasSearch(group: MuscleGroupId | null): URLSearchParams {
  return new URLSearchParams(group ? { [MUSCLE_PARAM]: group } : {});
}

/** Adresse de l'Atlas, à utiliser depuis une fiche (ex. `atlasPath({ exerciseId })`). */
export function atlasPath(
  base: string,
  target: { exerciseId: string } | { group: MuscleGroupId },
): string {
  const params =
    'exerciseId' in target
      ? new URLSearchParams({ [EXERCISE_PARAM]: target.exerciseId })
      : atlasSearch(target.group);
  return `${base}?${params.toString()}`;
}

/** Fiche d'un exercice (route du lot Fiches). */
export function exercisePath(id: string): string {
  return `/exercices/${id}`;
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? 's' : ''}`;
}
