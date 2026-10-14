import { describe, expect, it } from 'vitest';
import { dailyCalories } from './calories';
import { describeSeries, seriesSpan } from './chart';
import { sessionsInLastDays, weightSummary } from './summary';

const p = (date: string, value: number) => ({ date, value });
const today = '2026-10-12';

describe('weightSummary', () => {
  it('aucune pesée', () => {
    expect(weightSummary([], today)).toEqual({ current: null, variation30: null });
  });
  it('une pesée : poids actuel sans variation', () => {
    const s = weightSummary([p('2026-10-01', 80)], today);
    expect(s.current?.value).toBe(80);
    expect(s.variation30).toBeNull();
  });
  it('variation sur 30 jours, anciennes pesées ignorées', () => {
    const s = weightSummary([p('2026-06-01', 95), p('2026-09-20', 82), p('2026-10-12', 80)], today);
    expect(s.current?.value).toBe(80);
    expect(s.variation30?.delta).toBe(-2);
  });
  it('pesée dans le futur ignorée', () => {
    expect(weightSummary([p('2026-10-01', 80), p('2027-01-01', 50)], today).current?.value).toBe(
      80,
    );
  });
});

describe('sessionsInLastDays', () => {
  it('compte aujourd’hui et les 6 jours précédents', () => {
    const days = ['2026-10-05', '2026-10-06', '2026-10-06', '2026-10-12', '2026-10-13'];
    expect(sessionsInLastDays(days, today)).toBe(3);
    expect(sessionsInLastDays([], today)).toBe(0);
  });
});

describe('dailyCalories', () => {
  const foods = new Map([
    ['a', { kcal: 400 }],
    ['b', { kcal: 100 }],
  ]);
  it('somme par jour (kcal pour 100 g × grammes)', () => {
    const out = dailyCalories(
      [
        { date: '2026-10-02', foodId: 'a', grams: 50 },
        { date: '2026-10-01', foodId: 'b', grams: 200 },
        { date: '2026-10-01', foodId: 'a', grams: 100 },
        { date: '2026-10-01', foodId: 'inconnu', grams: 100 },
      ],
      foods,
    );
    expect(out).toEqual([p('2026-10-01', 600), p('2026-10-02', 200)]);
  });
  it('journal vide', () => {
    expect(dailyCalories([], foods)).toEqual([]);
  });
});

describe('describeSeries / seriesSpan', () => {
  const f = (n: number) => `${n} kg`;
  it('série vide, un point, plusieurs points', () => {
    expect(describeSeries([], f)).toBe('Aucune donnée pour le moment.');
    expect(describeSeries([p('2026-10-12', 80)], f)).toContain('1 mesure : 80 kg');
    const text = describeSeries([p('2026-06-03', 83), p('2026-10-12', 80)], f);
    expect(text).toContain('2 mesures');
    expect(text).toContain('Dernière valeur : 80 kg');
    expect(text).toContain('Minimum 80 kg, maximum 83 kg');
  });
  it('seriesSpan réunit plusieurs courbes', () => {
    expect(seriesSpan([], [])).toBeNull();
    expect(seriesSpan([p('2026-06-03', 1)], [p('2026-05-01', 1), p('2026-10-12', 1)])).toEqual([
      '2026-05-01',
      '2026-10-12',
    ]);
  });
});
