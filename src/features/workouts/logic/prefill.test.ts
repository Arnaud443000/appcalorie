import { describe, expect, it } from 'vitest';
import { lastPerformance, type SetLike } from '@/data';
import { prefillNextSet } from './prefill';

type S = SetLike & { order: number };
const base = { exerciseId: 'e', sessionId: 'last', durationSeconds: null, distanceMeters: null };
const lastSets: S[] = [
  { ...base, order: 0, weight: 60, reps: 10, isWarmup: false },
  { ...base, order: 1, weight: 62.5, reps: 8, isWarmup: false },
  { ...base, order: 2, weight: 65, reps: 6, isWarmup: false },
];
const last = lastPerformance('e', lastSets, [
  { id: 'last', startedAt: '2026-10-01T08:00:00.000Z' },
]);
const v = (weight: number, reps: number) => ({
  weight,
  reps,
  durationSeconds: null,
  distanceMeters: null,
});

describe('prefillNextSet', () => {
  it('rien du tout sans historique', () => {
    expect(prefillNextSet(null, [], false)).toBeNull();
  });

  it('première série : celle de la dernière fois', () => {
    expect(prefillNextSet(last, [], false)).toMatchObject({ weight: 60, reps: 10 });
  });

  it('si tu as refait la même chose, on continue avec la série suivante de la dernière fois', () => {
    expect(prefillNextSet(last, [v(60, 10)], false)).toMatchObject({ weight: 62.5, reps: 8 });
    expect(prefillNextSet(last, [v(60, 10), v(62.5, 8)], false)).toMatchObject({ weight: 65 });
  });

  it('si tu as fait autre chose, on reprend ta série précédente', () => {
    expect(prefillNextSet(last, [v(65, 10)], false)).toMatchObject({ weight: 65, reps: 10 });
  });

  it('sans historique, on reprend la série précédente d’aujourd’hui', () => {
    expect(prefillNextSet(null, [v(40, 12)], false)).toMatchObject({ weight: 40, reps: 12 });
  });

  it('au-delà du nombre de séries de la dernière fois, garde la dernière', () => {
    expect(prefillNextSet(last, [v(60, 10), v(62.5, 8), v(65, 6)], false)).toMatchObject({
      weight: 65,
      reps: 6,
    });
  });

  it('les échauffements sans équivalent ne proposent rien', () => {
    expect(prefillNextSet(last, [], true)).toBeNull();
  });
});
