import { describe, expect, it } from 'vitest';
import { loadIncrement, suggestNextLoad } from './suggestion';
import type { SetLike } from './types';

function set(patch: Partial<SetLike> = {}): SetLike {
  return {
    exerciseId: 'bench',
    sessionId: 'last',
    weight: 60,
    reps: 12,
    durationSeconds: null,
    distanceMeters: null,
    isWarmup: false,
    ...patch,
  };
}
const range = { min: 8, max: 12 };

describe('suggestNextLoad', () => {
  it('propose +2,5 kg quand toutes les séries atteignent le haut de la fourchette', () => {
    expect(suggestNextLoad({ lastSets: [set(), set(), set()], range })).toEqual({
      kind: 'increase',
      weight: 62.5,
      previousWeight: 60,
      increment: 2.5,
    });
  });

  it('propose +1 kg pour des haltères', () => {
    expect(
      suggestNextLoad({
        lastSets: [set({ weight: 14 }), set({ weight: 14 })],
        range,
        equipment: ['dumbbell'],
      }),
    ).toMatchObject({ kind: 'increase', weight: 15, increment: 1 });
  });

  it('dépasser le haut de la fourchette compte aussi', () => {
    expect(suggestNextLoad({ lastSets: [set({ reps: 14 }), set({ reps: 12 })], range }).kind).toBe(
      'increase',
    );
  });

  it('garde la charge si une série reste sous le haut de la fourchette', () => {
    expect(suggestNextLoad({ lastSets: [set(), set({ reps: 11 })], range })).toEqual({
      kind: 'keep',
      reason: 'range_not_reached',
    });
  });

  it('ne compte pas les échauffements (ni leur charge, ni leurs répétitions)', () => {
    const sets = [set({ isWarmup: true, weight: 30, reps: 5 }), set(), set()];
    expect(suggestNextLoad({ lastSets: sets, range })).toMatchObject({
      kind: 'increase',
      previousWeight: 60,
    });
  });

  it('part de la charge la plus lourde si elle a varié', () => {
    expect(
      suggestNextLoad({ lastSets: [set({ weight: 55 }), set({ weight: 60 })], range }),
    ).toMatchObject({ kind: 'increase', weight: 62.5, previousWeight: 60 });
  });

  it('exige le nombre de séries prévu', () => {
    expect(suggestNextLoad({ lastSets: [set(), set()], range, targetSets: 3 })).toEqual({
      kind: 'keep',
      reason: 'not_enough_sets',
    });
    expect(suggestNextLoad({ lastSets: [set(), set(), set()], range, targetSets: 3 }).kind).toBe(
      'increase',
    );
  });

  it('ne propose rien sans historique, sans fourchette ou sans charge', () => {
    expect(suggestNextLoad({ lastSets: [], range })).toEqual({
      kind: 'keep',
      reason: 'no_history',
    });
    expect(suggestNextLoad({ lastSets: [set({ isWarmup: true })], range })).toEqual({
      kind: 'keep',
      reason: 'no_history',
    });
    expect(suggestNextLoad({ lastSets: [set()], range: null })).toEqual({
      kind: 'keep',
      reason: 'no_range',
    });
    expect(
      suggestNextLoad({ lastSets: [set({ weight: null }), set({ weight: 0 })], range }),
    ).toEqual({
      kind: 'keep',
      reason: 'no_weight',
    });
  });

  it('ignore les séries sans répétitions', () => {
    expect(suggestNextLoad({ lastSets: [set({ reps: null })], range })).toEqual({
      kind: 'keep',
      reason: 'no_history',
    });
  });

  it('fonctionne avec une fourchette réduite à un nombre', () => {
    expect(suggestNextLoad({ lastSets: [set({ reps: 5 })], range: { min: 5, max: 5 } }).kind).toBe(
      'increase',
    );
  });

  it('arrondit proprement les décimales', () => {
    expect(suggestNextLoad({ lastSets: [set({ weight: 61.25 })], range })).toMatchObject({
      weight: 63.75,
    });
  });
});

describe('loadIncrement', () => {
  it('vaut 1 kg pour les haltères, 2,5 kg sinon', () => {
    expect(loadIncrement(['dumbbell'])).toBe(1);
    expect(loadIncrement(['barbell'])).toBe(2.5);
    expect(loadIncrement([])).toBe(2.5);
    expect(loadIncrement()).toBe(2.5);
  });
});
