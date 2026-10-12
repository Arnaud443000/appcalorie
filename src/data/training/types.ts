import type { InputTypeId } from '../constants';
import type { SetEntry, WorkoutSession } from '../schemas';

/**
 * Forme minimale d'une série pour les calculs : un `SetEntry` complet convient,
 * mais les tests (et le lot des courbes) peuvent passer des objets plus légers.
 */
export type SetLike = Pick<
  SetEntry,
  'exerciseId' | 'sessionId' | 'weight' | 'reps' | 'durationSeconds' | 'distanceMeters' | 'isWarmup'
> &
  Partial<Pick<SetEntry, 'id' | 'order' | 'rpe' | 'note'>>;

export type SessionLike = Pick<WorkoutSession, 'id' | 'startedAt'>;

/** Type de saisie d'un exercice (identifiants de `INPUT_TYPES`). */
export type InputType = InputTypeId;
