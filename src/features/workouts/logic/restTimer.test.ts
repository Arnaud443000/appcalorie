import { describe, expect, it } from 'vitest';
import {
  adjustRest,
  isFinished,
  MAX_REST_SECONDS,
  remainingSeconds,
  restProgress,
  secondsLate,
  startRest,
} from './restTimer';

const T0 = 1_700_000_000_000;

describe('chrono de repos (heure de fin)', () => {
  it("calcule l'heure de fin à partir de maintenant", () => {
    const state = startRest(T0, 90);
    expect(state).toEqual({ endsAt: T0 + 90_000, totalSeconds: 90, alerted: false });
  });

  it("reste juste même si aucun « tick » n'a eu lieu (écran verrouillé)", () => {
    const state = startRest(T0, 90);
    // 60 s plus tard, sans qu'aucun compteur n'ait tourné entre-temps
    expect(remainingSeconds(state, T0 + 60_000)).toBe(30);
    expect(isFinished(state, T0 + 60_000)).toBe(false);
    expect(remainingSeconds(state, T0 + 10 * 60_000)).toBe(0);
    expect(isFinished(state, T0 + 10 * 60_000)).toBe(true);
  });

  it('arrondit au-dessus et ne descend jamais sous zéro', () => {
    const state = startRest(T0, 10);
    expect(remainingSeconds(state, T0 + 100)).toBe(10);
    expect(remainingSeconds(state, T0 + 9_001)).toBe(1);
    expect(remainingSeconds(state, T0 + 10_000)).toBe(0);
    expect(remainingSeconds(state, T0 + 99_000)).toBe(0);
  });

  it('mesure le retard depuis la fin', () => {
    const state = startRest(T0, 30);
    expect(secondsLate(state, T0 + 29_000)).toBe(0);
    expect(secondsLate(state, T0 + 75_000)).toBe(45);
  });

  it('borne la durée choisie', () => {
    expect(startRest(T0, 0).totalSeconds).toBe(1);
    expect(startRest(T0, 99999).totalSeconds).toBe(MAX_REST_SECONDS);
  });

  it('ajoute et retire du temps', () => {
    const state = startRest(T0, 60);
    const more = adjustRest(state, 15, T0 + 20_000);
    expect(remainingSeconds(more, T0 + 20_000)).toBe(55);
    expect(more.totalSeconds).toBe(60);
    const less = adjustRest(state, -15, T0 + 20_000);
    expect(remainingSeconds(less, T0 + 20_000)).toBe(25);
  });

  it('retirer du temps ne passe pas sous 1 s, et prolonge un repos terminé', () => {
    const state = startRest(T0, 20);
    expect(remainingSeconds(adjustRest(state, -60, T0 + 5_000), T0 + 5_000)).toBe(1);
    const late = adjustRest({ ...state, alerted: true }, 15, T0 + 40_000);
    expect(remainingSeconds(late, T0 + 40_000)).toBe(15);
    expect(late.alerted).toBe(false);
  });

  it('indique la progression entre 0 et 1', () => {
    const state = startRest(T0, 100);
    expect(restProgress(state, T0)).toBe(0);
    expect(restProgress(state, T0 + 50_000)).toBeCloseTo(0.5);
    expect(restProgress(state, T0 + 500_000)).toBe(1);
  });
});
