import { describe, expect, it } from 'vitest';
import { nearestIndex, niceScale, timeTicks, xPosition } from './scale';

describe('niceScale', () => {
  it('encadre les données avec des graduations rondes', () => {
    const s = niceScale(78.2, 83.4);
    expect(s.min).toBeLessThanOrEqual(78.2);
    expect(s.max).toBeGreaterThanOrEqual(83.4);
    expect(s.ticks[0]).toBe(s.min);
    expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
    expect(s.ticks.length).toBeGreaterThanOrEqual(3);
    expect(s.ticks.length).toBeLessThanOrEqual(8);
  });
  it('les graduations sont régulièrement espacées et sans bruit décimal', () => {
    const s = niceScale(0.1, 0.7);
    const steps = s.ticks.slice(1).map((t, i) => Number((t - (s.ticks[i] ?? 0)).toFixed(6)));
    expect(new Set(steps).size).toBe(1);
    for (const tick of s.ticks) expect(String(tick).length).toBeLessThan(8);
  });
  it('une seule valeur : intervalle autour d’elle', () => {
    const s = niceScale(80, 80);
    expect(s.min).toBeLessThan(80);
    expect(s.max).toBeGreaterThan(80);
  });
  it('valeur nulle unique', () => {
    const s = niceScale(0, 0);
    expect(s.max).toBeGreaterThan(s.min);
  });
  it('ne descend pas sous zéro pour des données positives', () => {
    expect(niceScale(1, 10).min).toBe(0);
  });
  it('accepte des valeurs négatives', () => {
    const s = niceScale(-5, 5);
    expect(s.min).toBeLessThanOrEqual(-5);
    expect(s.max).toBeGreaterThanOrEqual(5);
  });
  it('grandes valeurs (volumes)', () => {
    const s = niceScale(4200, 12800);
    expect(s.ticks.every((t) => Number.isInteger(t))).toBe(true);
  });
  it('valeurs invalides : intervalle par défaut', () => {
    expect(niceScale(Number.NaN, 3)).toEqual({ min: 0, max: 1, ticks: [0, 1] });
  });
});

describe('timeTicks', () => {
  it('un seul jour', () => {
    expect(timeTicks('2026-10-12', '2026-10-12')).toEqual([
      { date: '2026-10-12', label: '12 oct.' },
    ]);
  });
  it('période courte : des jours régulièrement espacés, 5 au plus', () => {
    const ticks = timeTicks('2026-10-06', '2026-10-12');
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks[0]?.date).toBe('2026-10-06');
  });
  it('un mois : jamais plus de 5 graduations', () => {
    expect(timeTicks('2026-09-13', '2026-10-12').length).toBeLessThanOrEqual(5);
  });
  it('plusieurs mois : des débuts de mois', () => {
    const ticks = timeTicks('2026-04-12', '2026-10-12');
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks.every((t) => t.date.endsWith('-01'))).toBe(true);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });
  it('plusieurs années : l’année est indiquée', () => {
    const ticks = timeTicks('2025-10-12', '2026-10-12');
    expect(ticks.every((t) => /\d{2}$/.test(t.label))).toBe(true);
    expect(ticks.length).toBeLessThanOrEqual(5);
  });
  it('quelques années : pas plus de graduations que demandé', () => {
    expect(timeTicks('2020-01-01', '2026-10-12', 4).length).toBeLessThanOrEqual(4);
  });
  it('plus de 60 jours mais sans début de mois dedans', () => {
    // 2 octobre → 5 décembre : contient le 1er novembre et le 1er décembre.
    expect(timeTicks('2026-10-02', '2026-12-05').map((t) => t.date)).toEqual([
      '2026-11-01',
      '2026-12-01',
    ]);
  });
});

describe('xPosition / nearestIndex', () => {
  it('place les jours proportionnellement', () => {
    expect(xPosition('2026-10-01', '2026-10-01', '2026-10-11', 10, 110)).toBe(10);
    expect(xPosition('2026-10-06', '2026-10-01', '2026-10-11', 10, 110)).toBe(60);
    expect(xPosition('2026-10-11', '2026-10-01', '2026-10-11', 10, 110)).toBe(110);
  });
  it('intervalle d’un seul jour : au centre', () => {
    expect(xPosition('2026-10-01', '2026-10-01', '2026-10-01', 10, 110)).toBe(60);
  });
  it('nearestIndex : le plus proche, y compris aux bords', () => {
    const xs = [10, 20, 50, 100];
    expect(nearestIndex(xs, 0)).toBe(0);
    expect(nearestIndex(xs, 14)).toBe(0);
    expect(nearestIndex(xs, 16)).toBe(1);
    expect(nearestIndex(xs, 35)).toBe(1);
    expect(nearestIndex(xs, 36)).toBe(2);
    expect(nearestIndex(xs, 500)).toBe(3);
    expect(nearestIndex([], 5)).toBe(-1);
    expect(nearestIndex([7], 500)).toBe(0);
  });
});
