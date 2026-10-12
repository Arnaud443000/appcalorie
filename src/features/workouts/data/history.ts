import { setEntryRepo, workoutSessionRepo, type SetEntry, type WorkoutSession } from '@/data';

export interface ExerciseHistory {
  /** Séries enregistrées pour ces exercices, dans toutes les séances encore existantes. */
  sets: SetEntry[];
  sessions: WorkoutSession[];
}

/**
 * Historique de quelques exercices. Passe par l'index `exerciseId` de la base.
 * Les séries d'une séance supprimée restent en base mais sont écartées ici.
 */
export async function loadExerciseHistory(
  exerciseIds: readonly string[],
): Promise<ExerciseHistory> {
  const sessions = await workoutSessionRepo.list();
  const perExercise = await Promise.all(
    exerciseIds.map((id) => setEntryRepo.findBy('exerciseId', id)),
  );
  const alive = new Set(sessions.map((session) => session.id));
  const sets = perExercise.flat().filter((set) => alive.has(set.sessionId));
  return { sets, sessions };
}

/** Toutes les séances avec leurs séries (écrans Historique et Records). */
export async function loadEverything(): Promise<ExerciseHistory> {
  const [sessions, sets] = await Promise.all([workoutSessionRepo.list(), setEntryRepo.list()]);
  const alive = new Set(sessions.map((session) => session.id));
  return { sessions, sets: sets.filter((set) => alive.has(set.sessionId)) };
}
