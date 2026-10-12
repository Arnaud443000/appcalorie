import { describe, expect, it } from 'vitest';
import {
  cleanSeries,
  filterPeriod,
  mergeSameDay,
  periodStart,
  prepareSeries,
  rollingAverage,
  slopePerDay,
  trend,
  variation,
  type SeriesPoint,
} from './series';

const p = (date: string, value: number): SeriesPoint => ({ date, value });

describe('cleanSeries / mergeSameDay', () => {
  it('trie par date et écarte les valeurs ou dates invalides', () => {
    const out = cleanSeries([
      p('2026-10-03', 3),
      p('2026-10-01', 1),
      p('pas-une-date', 9),
      p('2026-10-02', Number.NaN),
      p('2026-10-04', Number.POSITIVE_INFINITY),
    ]);
    expect(out).toEqual([p('2026-10-01', 1), p('2026-10-03', 3)]);
  });
  it('le tri est stable pour une même date', () => {
    const out = cleanSeries([p('2026-10-01', 5), p('2026-10-01', 6), p('2026-09-30', 1)]);
    expect(out.map((x) => x.value)).toEqual([1, 5, 6]);
  });
  it('fusionne les points du même jour selon la règle', () => {
    const pts = [
      p('2026-10-01', 80),
      p('2026-10-01', 82),
      p('2026-10-01', 81),
      p('2026-10-02', 70),
    ];
    expect(mergeSameDay(pts, 'last')).toEqual([p('2026-10-01', 81), p('2026-10-02', 70)]);
    expect(mergeSameDay(pts, 'first')).toEqual([p('2026-10-01', 80), p('2026-10-02', 70)]);
    expect(mergeSameDay(pts, 'max')).toEqual([p('2026-10-01', 82), p('2026-10-02', 70)]);
    expect(mergeSameDay(pts, 'mean')).toEqual([p('2026-10-01', 81), p('2026-10-02', 70)]);
  });
  it('gère les séries vides ou d’un seul point', () => {
    expect(prepareSeries([])).toEqual([]);
    expect(prepareSeries([p('2026-10-01', 1)])).toEqual([p('2026-10-01', 1)]);
  });
});

describe('périodes', () => {
  const today = '2026-10-12';
  it('début de chaque période', () => {
    expect(periodStart('7d', today)).toBe('2026-10-06');
    expect(periodStart('30d', today)).toBe('2026-09-13');
    expect(periodStart('3m', today)).toBe('2026-07-12');
    expect(periodStart('6m', today)).toBe('2026-04-12');
    expect(periodStart('1y', today)).toBe('2025-10-12');
    expect(periodStart('all', today)).toBeNull();
  });
  it('« 3 mois » au 31 mai ne dépasse pas le mois', () => {
    expect(periodStart('3m', '2026-05-31')).toBe('2026-02-28');
    expect(periodStart('1y', '2028-02-29')).toBe('2027-02-28');
  });
  it('filtre bornes comprises et écarte les points futurs', () => {
    const pts = [p('2026-10-05', 1), p('2026-10-06', 2), p('2026-10-12', 3), p('2026-10-13', 4)];
    expect(filterPeriod(pts, '7d', today).map((x) => x.value)).toEqual([2, 3]);
    expect(filterPeriod(pts, 'all', today).map((x) => x.value)).toEqual([1, 2, 3]);
    expect(filterPeriod([], '30d', today)).toEqual([]);
  });
});

describe('rollingAverage', () => {
  it('moyenne les 7 derniers jours calendaires', () => {
    const pts = [p('2026-10-01', 80), p('2026-10-02', 82), p('2026-10-03', 81)];
    const out = rollingAverage(pts);
    expect(out.map((x) => x.value)).toEqual([80, 81, 81]);
    expect(out.map((x) => x.date)).toEqual(pts.map((x) => x.date));
  });
  it('un trou fait sortir les anciens points de la fenêtre', () => {
    const pts = [p('2026-10-01', 90), p('2026-10-10', 80), p('2026-10-11', 82)];
    expect(rollingAverage(pts).map((x) => x.value)).toEqual([90, 80, 81]);
  });
  it('le 7e jour est inclus, le 8e est exclu', () => {
    const pts = [p('2026-10-01', 70), p('2026-10-07', 80), p('2026-10-08', 90)];
    expect(rollingAverage(pts).map((x) => x.value)).toEqual([70, 75, 85]);
  });
  it('0 et 1 point', () => {
    expect(rollingAverage([])).toEqual([]);
    expect(rollingAverage([p('2026-10-01', 80)])).toEqual([p('2026-10-01', 80)]);
  });
  it('traverse un changement de mois', () => {
    const pts = [p('2026-10-30', 80), p('2026-10-31', 82), p('2026-11-01', 84)];
    expect(rollingAverage(pts).map((x) => x.value)).toEqual([80, 81, 82]);
  });
  it('fenêtre personnalisable', () => {
    const pts = [p('2026-10-01', 10), p('2026-10-02', 20), p('2026-10-03', 30)];
    expect(rollingAverage(pts, 2).map((x) => x.value)).toEqual([10, 15, 25]);
  });
  it('reste rapide sur plusieurs milliers de points', () => {
    const pts = Array.from({ length: 5000 }, (_, i) => ({
      date: new Date(Date.UTC(2010, 0, 1 + i)).toISOString().slice(0, 10),
      value: i,
    }));
    const start = performance.now();
    const out = rollingAverage(pts);
    expect(out).toHaveLength(5000);
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe('variation', () => {
  it('null avec moins de 2 points', () => {
    expect(variation([])).toBeNull();
    expect(variation([p('2026-10-01', 80)])).toBeNull();
  });
  it('écart, pourcentage et durée entre le premier et le dernier point', () => {
    const v = variation([p('2026-10-01', 80), p('2026-10-05', 90), p('2026-10-11', 76)]);
    expect(v?.delta).toBe(-4);
    expect(v?.percent).toBeCloseTo(-5);
    expect(v?.days).toBe(10);
  });
  it('2 points le même jour : variation de 0 jour', () => {
    expect(variation([p('2026-10-01', 80), p('2026-10-01', 81)])?.days).toBe(0);
  });
  it('pas de pourcentage depuis zéro', () => {
    expect(variation([p('2026-10-01', 0), p('2026-10-02', 5)])?.percent).toBeNull();
  });
});

describe('tendance', () => {
  const line = (n: number, slopePerDayValue: number, from = 80) =>
    Array.from({ length: n }, (_, i) =>
      p(`2026-10-${String(i + 1).padStart(2, '0')}`, from + i * slopePerDayValue),
    );

  it('null sans assez de points ou de recul', () => {
    expect(trend([])).toBeNull();
    expect(trend([p('2026-10-01', 80)])).toBeNull();
    expect(trend([p('2026-10-01', 80), p('2026-10-02', 70)])).toBeNull();
  });
  it('détecte la baisse, la hausse et la stabilité', () => {
    expect(trend(line(14, -0.1))?.direction).toBe('down');
    expect(trend(line(14, 0.1))?.direction).toBe('up');
    expect(trend(line(14, 0))?.direction).toBe('stable');
  });
  it('donne la pente par semaine', () => {
    expect(trend(line(14, -0.1))?.perWeek).toBeCloseTo(-0.7);
  });
  it('seuil de stabilité personnalisable', () => {
    expect(trend(line(14, 0.02), 0.5)?.direction).toBe('stable');
    expect(trend(line(14, 0.2), 0.5)?.direction).toBe('up');
  });
  it('slopePerDay : null si tous les points sont le même jour', () => {
    expect(slopePerDay([p('2026-10-01', 1), p('2026-10-01', 2)])).toBeNull();
  });
  it('tient compte des trous (c’est la date qui compte)', () => {
    const pts = [p('2026-10-01', 80), p('2026-10-15', 78), p('2026-10-29', 76)];
    expect(slopePerDay(pts)).toBeCloseTo(-4 / 28);
  });
});
