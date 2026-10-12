import type { RepRange } from './repRange';
import type { SetLike } from './types';

/** Pas d'augmentation de charge, en kg. */
export const LOAD_STEP_KG = 2.5;
export const LOAD_STEP_DUMBBELL_KG = 1;

export type Suggestion =
  | { kind: 'increase'; weight: number; previousWeight: number; increment: number }
  | {
      kind: 'keep';
      reason: 'no_history' | 'no_range' | 'no_weight' | 'not_enough_sets' | 'range_not_reached';
    };

export interface SuggestInput {
  /** Séries de la dernière séance pour cet exercice. */
  lastSets: readonly SetLike[];
  /** Fourchette de répétitions du programme (null si séance libre). */
  range: RepRange | null;
  /** Nombre de séries prévues : si moins ont été faites, on ne propose pas d'augmenter. */
  targetSets?: number | null;
  /** Matériel de l'exercice (identifiants de `EQUIPMENT`). */
  equipment?: readonly string[];
}

/** +1 kg pour les haltères (on les prend par paires, les crans sont petits), sinon +2,5 kg. */
export function loadIncrement(equipment: readonly string[] = []): number {
  return equipment.includes('dumbbell') ? LOAD_STEP_DUMBBELL_KG : LOAD_STEP_KG;
}

/**
 * Charge suivante conseillée. Règle simple :
 * si TOUTES les séries de travail de la dernière fois ont atteint le haut de la fourchette
 * de répétitions, on ajoute 2,5 kg (1 kg pour des haltères) à la charge la plus lourde utilisée.
 * Sinon on garde la charge. Les échauffements ne comptent pas.
 */
export function suggestNextLoad(input: SuggestInput): Suggestion {
  const working = input.lastSets.filter((set) => !set.isWarmup && set.reps != null && set.reps > 0);
  if (working.length === 0) return { kind: 'keep', reason: 'no_history' };
  const range = input.range;
  if (!range) return { kind: 'keep', reason: 'no_range' };

  const weights = working
    .map((set) => set.weight)
    .filter((w): w is number => w != null && Number.isFinite(w) && w > 0);
  if (weights.length === 0) return { kind: 'keep', reason: 'no_weight' };

  if (input.targetSets != null && working.length < input.targetSets) {
    return { kind: 'keep', reason: 'not_enough_sets' };
  }
  if (!working.every((set) => (set.reps ?? 0) >= range.max)) {
    return { kind: 'keep', reason: 'range_not_reached' };
  }

  const previousWeight = Math.max(...weights);
  const increment = loadIncrement(input.equipment);
  const weight = Math.round((previousWeight + increment) * 100) / 100;
  return { kind: 'increase', weight, previousWeight, increment };
}
