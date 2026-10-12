import { db } from './db';
import type { WorkoutSession } from './schemas';

/**
 * Séance non terminée la plus récente (à proposer à la réouverture de l'app), ou `undefined`.
 * Une séance terminée figure dans l'index `endedAt` ; une séance en cours (endedAt null) n'y
 * est pas. On ne lit donc en entier que les séances absentes de cet index.
 */
export async function findUnfinishedSession(): Promise<WorkoutSession | undefined> {
  const [allIds, endedIds] = await Promise.all([
    db.workoutSessions.toCollection().primaryKeys(),
    db.workoutSessions.orderBy('endedAt').primaryKeys(),
  ]);
  const ended = new Set(endedIds);
  const candidates = await db.workoutSessions.bulkGet(allIds.filter((id) => !ended.has(id)));
  return candidates
    .filter(
      (s): s is WorkoutSession => s !== undefined && s.deletedAt === null && s.endedAt === null,
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}
