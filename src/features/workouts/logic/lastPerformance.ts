import type { SessionLike, SetLike } from './types';

export interface LastPerformance<S extends SetLike = SetLike> {
  sessionId: string;
  startedAt: string;
  /** Séries de cette séance pour l'exercice, dans l'ordre (échauffements compris). */
  sets: S[];
}

export interface LastPerformanceOptions {
  /** Séance à ignorer (la séance en cours). */
  excludeSessionId?: string;
}

/**
 * Dernière séance où l'exercice a été fait : ses séries, dans l'ordre.
 * - seules les séances connues (`sessions`) comptent : les séries d'une séance supprimée sont ignorées ;
 * - une séance sans aucune série pour cet exercice est sautée ;
 * - la séance la plus récente (`startedAt`) gagne.
 */
export function lastPerformance<S extends SetLike>(
  exerciseId: string,
  sets: readonly S[],
  sessions: readonly SessionLike[],
  options: LastPerformanceOptions = {},
): LastPerformance<S> | null {
  const startedAtById = new Map(sessions.map((s) => [s.id, s.startedAt]));
  const bySession = new Map<string, S[]>();
  for (const set of sets) {
    if (set.exerciseId !== exerciseId) continue;
    if (set.sessionId === options.excludeSessionId) continue;
    if (!startedAtById.has(set.sessionId)) continue;
    const list = bySession.get(set.sessionId);
    if (list) list.push(set);
    else bySession.set(set.sessionId, [set]);
  }

  let best: { sessionId: string; startedAt: string } | null = null;
  for (const sessionId of bySession.keys()) {
    const startedAt = startedAtById.get(sessionId) as string;
    if (!best || startedAt > best.startedAt) best = { sessionId, startedAt };
  }
  if (!best) return null;

  const found = [...(bySession.get(best.sessionId) ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  return { sessionId: best.sessionId, startedAt: best.startedAt, sets: found };
}

/**
 * Série de la dernière fois qui correspond à la série n°`index` d'aujourd'hui
 * (les échauffements se comparent aux échauffements, les séries de travail entre elles).
 * S'il y a moins de séries qu'hier, on reprend la dernière du même type.
 */
export function matchingLastSet<S extends SetLike>(
  last: LastPerformance<S> | null,
  isWarmup: boolean,
  index: number,
): S | null {
  if (!last) return null;
  const sameKind = last.sets.filter((set) => set.isWarmup === isWarmup);
  if (sameKind.length === 0) return null;
  return sameKind[Math.min(index, sameKind.length - 1)] ?? null;
}
