import { describe, expect, it } from 'vitest';
import { lastPerformance, matchingLastSet } from './lastPerformance';
import type { SetLike } from './types';

type S = SetLike & { order: number };

function set(sessionId: string, order: number, patch: Partial<S> = {}): S {
  return {
    exerciseId: 'bench',
    sessionId,
    order,
    weight: 60,
    reps: 8,
    durationSeconds: null,
    distanceMeters: null,
    isWarmup: false,
    ...patch,
  };
}

const sessions = [
  { id: 'old', startedAt: '2026-10-01T08:00:00.000Z' },
  { id: 'recent', startedAt: '2026-10-08T08:00:00.000Z' },
  { id: 'today', startedAt: '2026-10-12T08:00:00.000Z' },
];

describe('lastPerformance', () => {
  it("renvoie null sans historique ou sans série pour l'exercice", () => {
    expect(lastPerformance('bench', [], sessions)).toBeNull();
    expect(lastPerformance('bench', [set('old', 0, { exerciseId: 'squat' })], sessions)).toBeNull();
  });

  it('prend la séance la plus récente, séries triées', () => {
    const sets = [set('old', 0), set('recent', 1, { reps: 7 }), set('recent', 0, { reps: 9 })];
    const result = lastPerformance('bench', sets, sessions);
    expect(result?.sessionId).toBe('recent');
    expect(result?.sets.map((s) => s.reps)).toEqual([9, 7]);
  });

  it('ignore la séance en cours', () => {
    const sets = [set('old', 0), set('today', 0, { reps: 12 })];
    expect(lastPerformance('bench', sets, sessions, { excludeSessionId: 'today' })?.sessionId).toBe(
      'old',
    );
    expect(lastPerformance('bench', sets, sessions)?.sessionId).toBe('today');
  });

  it("ignore les séries d'une séance inconnue ou supprimée", () => {
    const sets = [set('deleted', 0), set('old', 0)];
    expect(lastPerformance('bench', sets, sessions)?.sessionId).toBe('old');
  });

  it('ne mélange pas les exercices', () => {
    const sets = [set('recent', 0), set('recent', 1, { exerciseId: 'squat', reps: 3 })];
    expect(lastPerformance('bench', sets, sessions)?.sets).toHaveLength(1);
  });
});

describe('matchingLastSet', () => {
  const last = lastPerformance(
    'bench',
    [
      set('recent', 0, { isWarmup: true, weight: 30, reps: 10 }),
      set('recent', 1, { weight: 60, reps: 8 }),
      set('recent', 2, { weight: 62.5, reps: 6 }),
    ],
    sessions,
  );

  it('renvoie null sans historique', () => {
    expect(matchingLastSet(null, false, 0)).toBeNull();
  });

  it('compare séries de travail entre elles, échauffements entre eux', () => {
    expect(matchingLastSet(last, false, 0)?.weight).toBe(60);
    expect(matchingLastSet(last, false, 1)?.weight).toBe(62.5);
    expect(matchingLastSet(last, true, 0)?.weight).toBe(30);
  });

  it('reprend la dernière série du même type quand il y en avait moins', () => {
    expect(matchingLastSet(last, false, 5)?.weight).toBe(62.5);
    expect(matchingLastSet(last, true, 3)?.weight).toBe(30);
  });

  it("renvoie null s'il n'y avait aucune série de ce type", () => {
    const onlyWork = lastPerformance('bench', [set('recent', 0)], sessions);
    expect(matchingLastSet(onlyWork, true, 0)).toBeNull();
  });
});
