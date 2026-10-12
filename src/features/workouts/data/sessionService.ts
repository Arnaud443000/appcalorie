import {
  type Routine,
  routineRepo,
  type SetEntry,
  setEntryRepo,
  type WorkoutSession,
  workoutSessionRepo,
} from '@/data';
import { planFromRoutine, planFromSets, type Plan, type SetValues } from '../logic';

export const FREE_SESSION_NAME = 'Séance libre';

export async function startSession(input: {
  name: string;
  routineId: string | null;
  plan: Plan;
}): Promise<WorkoutSession> {
  const session = await workoutSessionRepo.create({
    routineId: input.routineId,
    name: input.name,
    startedAt: new Date().toISOString(),
    endedAt: null,
    note: '',
    plan: input.plan,
  });
  return session;
}

export function startFreeSession(): Promise<WorkoutSession> {
  return startSession({ name: FREE_SESSION_NAME, routineId: null, plan: [] });
}

export function startFromRoutine(routine: Routine): Promise<WorkoutSession> {
  return startSession({
    name: routine.name,
    routineId: routine.id,
    plan: planFromRoutine(routine.items),
  });
}

export async function finishSession(sessionId: string): Promise<WorkoutSession> {
  return workoutSessionRepo.update(sessionId, { endedAt: new Date().toISOString() });
}

/** Abandonne une séance : elle et ses séries sont supprimées (suppression douce). */
export async function discardSession(sessionId: string): Promise<void> {
  const sets = await setEntryRepo.findBy('sessionId', sessionId);
  await Promise.all(sets.map((set) => setEntryRepo.remove(set.id)));
  await workoutSessionRepo.remove(sessionId);
}

/** Enregistre une série tout de suite ; elle prend la place suivante dans la séance. */
export async function addSet(
  sessionId: string,
  exerciseId: string,
  values: SetValues,
): Promise<SetEntry> {
  const existing = await setEntryRepo.findBy('sessionId', sessionId);
  const order = existing.reduce((max, set) => Math.max(max, set.order + 1), 0);
  return setEntryRepo.create({ sessionId, exerciseId, order, ...values });
}

export function updateSet(setId: string, patch: Partial<SetValues>): Promise<SetEntry> {
  return setEntryRepo.update(setId, patch);
}

export function deleteSet(setId: string): Promise<void> {
  return setEntryRepo.remove(setId);
}

/** Nouvelle séance (vide) qui reprend les exercices d'une séance passée. */
export async function copySession(sourceId: string): Promise<WorkoutSession> {
  const source = await workoutSessionRepo.get(sourceId);
  if (!source) throw new Error('Séance introuvable.');
  const sets = await setEntryRepo.findBy('sessionId', sourceId);
  const routine = source.routineId ? await routineRepo.get(source.routineId) : undefined;
  return startSession({
    name: source.name || FREE_SESSION_NAME,
    routineId: routine ? routine.id : null,
    plan: planFromSets(sets, routine?.items),
  });
}
