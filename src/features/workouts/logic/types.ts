import type { SetEntry, WorkoutSession } from '@/data';

/**
 * Forme minimale d'une série pour les calculs : un `SetEntry` complet convient,
 * mais les tests (et le futur lot des courbes) peuvent passer des objets plus légers.
 */
export type SetLike = Pick<
  SetEntry,
  'exerciseId' | 'sessionId' | 'weight' | 'reps' | 'durationSeconds' | 'distanceMeters' | 'isWarmup'
> &
  Partial<Pick<SetEntry, 'id' | 'order' | 'rpe' | 'note'>>;

export type SessionLike = Pick<WorkoutSession, 'id' | 'startedAt'>;

export type InputType = 'weight_reps' | 'reps' | 'duration' | 'distance' | 'bodyweight_load';
