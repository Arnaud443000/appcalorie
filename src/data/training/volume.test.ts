import { describe, expect, it } from 'vitest';
import type { SetLike } from './types';
import { sessionVolume, setVolume, workingSets } from './volume';

function set(patch: Partial<SetLike> = {}): SetLike {
  return {
    exerciseId: 'e1',
    sessionId: 's1',
    weight: 50,
    reps: 10,
    durationSeconds: null,
    distanceMeters: null,
    isWarmup: false,
    ...patch,
  };
}

describe('sessionVolume', () => {
  it('vaut 0 sans aucune série', () => {
    expect(sessionVolume([])).toBe(0);
  });

  it('additionne charge × répétitions', () => {
    expect(sessionVolume([set(), set({ weight: 60, reps: 8 })])).toBe(500 + 480);
  });

  it("ne compte pas les séries d'échauffement", () => {
    expect(sessionVolume([set({ isWarmup: true, weight: 20, reps: 15 }), set()])).toBe(500);
    expect(sessionVolume([set({ isWarmup: true })])).toBe(0);
  });

  it('ignore les valeurs nulles sans planter', () => {
    expect(
      sessionVolume([
        set({ weight: null }),
        set({ reps: null }),
        set({ weight: null, reps: null }),
      ]),
    ).toBe(0);
    expect(sessionVolume([set({ weight: null }), set()])).toBe(500);
  });

  it('au poids du corps sans lest, la série vaut 0', () => {
    expect(sessionVolume([set({ weight: 0, reps: 12 }), set({ weight: null, reps: 12 })])).toBe(0);
  });

  it('au poids du corps avec lest, le volume est lest × répétitions', () => {
    expect(sessionVolume([set({ weight: 10, reps: 6 }), set({ weight: 0, reps: 12 })])).toBe(60);
  });

  it('ignore les valeurs négatives ou invalides', () => {
    expect(setVolume({ weight: -10, reps: 5 })).toBe(0);
    expect(setVolume({ weight: 10, reps: Number.NaN })).toBe(0);
  });

  it('gère les décimales', () => {
    expect(sessionVolume([set({ weight: 62.5, reps: 8 })])).toBe(500);
  });
});

describe('workingSets', () => {
  it('retire les échauffements', () => {
    const a = set();
    const b = set({ isWarmup: true });
    expect(workingSets([a, b])).toEqual([a]);
  });
});
