import { describe, expect, it } from 'vitest';
import { aggregateSeries, bucketStart } from './aggregate';
import type { SeriesPoint } from './series';

const p = (date: string, value: number): SeriesPoint => ({ date, value });
const today = '2026-10-12';

describe('bucketStart', () => {
  it('lundi de la semaine, 1er du mois, jour lui-même', () => {
    expect(bucketStart('2026-10-14', 'week')).toBe('2026-10-12');
    expect(bucketStart('2026-10-14', 'month')).toBe('2026-10-01');
    expect(bucketStart('2026-10-14', 'session')).toBe('2026-10-14');
  });
});

describe('aggregateSeries', () => {
  it('par séance : une entrée par point, rien n’est regroupé', () => {
    const out = aggregateSeries([p('2026-10-01', 5), p('2026-10-02', 6)], 'session', 'max', today);
    expect(out.map((x) => [x.date, x.value, x.count])).toEqual([
      ['2026-10-01', 5, 1],
      ['2026-10-02', 6, 1],
    ]);
    expect(out.every((x) => !x.inProgress)).toBe(true);
  });

  it('par semaine, meilleur de la semaine', () => {
    const out = aggregateSeries(
      [p('2026-09-28', 60), p('2026-09-30', 65), p('2026-10-05', 62), p('2026-10-08', 70)],
      'week',
      'max',
      today,
    );
    expect(out.map((x) => [x.date, x.value, x.count, x.end])).toEqual([
      ['2026-09-28', 65, 2, '2026-10-04'],
      ['2026-10-05', 70, 2, '2026-10-11'],
    ]);
  });

  it('par semaine, volume additionné', () => {
    const out = aggregateSeries(
      [p('2026-10-05', 1000), p('2026-10-07', 500)],
      'week',
      'sum',
      today,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.value).toBe(1500);
  });

  it('par mois : changement de mois et d’année', () => {
    const out = aggregateSeries(
      [p('2026-12-31', 1), p('2027-01-01', 2), p('2027-01-31', 3), p('2027-02-01', 4)],
      'month',
      'sum',
      '2027-03-01',
    );
    expect(out.map((x) => [x.date, x.value, x.end])).toEqual([
      ['2026-12-01', 1, '2026-12-31'],
      ['2027-01-01', 5, '2027-01-31'],
      ['2027-02-01', 4, '2027-02-28'],
    ]);
  });

  it('une semaine à cheval sur deux mois reste une seule semaine', () => {
    const out = aggregateSeries(
      [p('2026-10-29', 1), p('2026-11-01', 2)],
      'week',
      'max',
      '2026-12-01',
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.date).toBe('2026-10-26');
  });

  it('marque la période en cours', () => {
    const out = aggregateSeries([p('2026-10-05', 1), p('2026-09-15', 1)], 'month', 'sum', today);
    expect(out.find((x) => x.date === '2026-10-01')?.inProgress).toBe(true);
    expect(out.find((x) => x.date === '2026-09-01')?.inProgress).toBe(false);
    const weeks = aggregateSeries([p('2026-10-12', 1), p('2026-10-05', 1)], 'week', 'sum', today);
    expect(weeks.map((x) => x.inProgress)).toEqual([false, true]);
  });

  it('série vide, ou entrée non triée', () => {
    expect(aggregateSeries([], 'week', 'max', today)).toEqual([]);
    const out = aggregateSeries([p('2026-10-08', 1), p('2026-10-01', 2)], 'week', 'max', today);
    expect(out.map((x) => x.date)).toEqual(['2026-09-28', '2026-10-05']);
  });
});
