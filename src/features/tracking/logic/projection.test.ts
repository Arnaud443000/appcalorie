import { describe, expect, it } from 'vitest';
import { projectReach, recentRate } from './projection';
import type { SeriesPoint } from './series';

const p = (date: string, value: number): SeriesPoint => ({ date, value });
const today = '2026-10-12';

const weekly = (values: number[], lastDay = today): SeriesPoint[] => {
  const end = Date.UTC(+lastDay.slice(0, 4), +lastDay.slice(5, 7) - 1, +lastDay.slice(8, 10));
  return values.map((value, i) => ({
    date: new Date(end - (values.length - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10),
    value,
  }));
};

describe('recentRate', () => {
  it('null sans point, avec un point, ou sur moins de 7 jours', () => {
    expect(recentRate([], today)).toBeNull();
    expect(recentRate([p(today, 80)], today)).toBeNull();
    expect(recentRate([p('2026-10-08', 80), p('2026-10-12', 79)], today)).toBeNull();
  });
  it('mesure la pente par semaine', () => {
    const rate = recentRate(weekly([82, 81.5, 81, 80.5, 80]), today);
    expect(rate?.perWeek).toBeCloseTo(-0.5);
    expect(rate?.count).toBe(5);
    expect(rate?.spanDays).toBe(28);
  });
  it('ignore ce qui est plus vieux que la fenêtre de 6 semaines', () => {
    const old = [p('2026-06-01', 100), p('2026-06-08', 100)];
    const rate = recentRate([...old, ...weekly([80, 80, 80])], today);
    expect(rate?.perDay).toBeCloseTo(0);
    expect(rate?.count).toBe(3);
  });
  it('ignore les points futurs', () => {
    const rate = recentRate([...weekly([80, 79]), p('2026-12-25', 10)], today);
    expect(rate?.perWeek).toBeCloseTo(-1);
  });
  it('2 points à 7 jours d’écart suffisent', () => {
    expect(recentRate([p('2026-10-05', 80), p('2026-10-12', 79)], today)?.perWeek).toBeCloseTo(-1);
  });
});

describe('projectReach', () => {
  const rateDown = recentRate(weekly([82, 81, 80]), today); // −1 kg / semaine
  const rateUp = recentRate(weekly([60, 62, 64]), today); // +2 kg / semaine

  it('atteint : sans projection', () => {
    expect(projectReach(75, 75, 'down', rateDown, today)).toEqual({ kind: 'reached' });
    expect(projectReach(74, 75, 'down', rateDown, today)).toEqual({ kind: 'reached' });
    expect(projectReach(105, 100, 'up', rateUp, today)).toEqual({ kind: 'reached' });
  });
  it('estime la date au rythme actuel (baisse)', () => {
    const out = projectReach(80, 75, 'down', rateDown, today);
    expect(out).toEqual({ kind: 'eta', days: 35, date: '2026-11-16' });
  });
  it('estime la date au rythme actuel (hausse)', () => {
    const out = projectReach(64, 100, 'up', rateUp, today);
    expect(out.kind).toBe('eta');
    if (out.kind === 'eta') expect(out.days).toBe(126); // 36 kg à 2 kg / semaine = 18 semaines
  });
  it('mauvais sens', () => {
    expect(projectReach(80, 90, 'up', rateDown, today).kind).toBe('wrong_way');
    expect(projectReach(64, 60, 'down', rateUp, today).kind).toBe('wrong_way');
  });
  it('rythme nul ou dérisoire : à l’arrêt', () => {
    const flat = recentRate(weekly([80, 80, 80]), today);
    expect(projectReach(80, 75, 'down', flat, today).kind).toBe('stalled');
    const tiny = recentRate(weekly([80, 79.9999, 79.9998]), today);
    expect(projectReach(80, 75, 'down', tiny, today).kind).toBe('stalled');
  });
  it('pas de données', () => {
    expect(projectReach(null, 75, 'down', rateDown, today).kind).toBe('no_data');
    expect(projectReach(80, 75, 'down', null, today).kind).toBe('no_data');
  });
});
