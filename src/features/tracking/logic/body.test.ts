import { describe, expect, it } from 'vitest';
import type { BodyMetric } from '@/data';
import { bodySeries, bodyValue, cmToUnit, isEmptyMetric, MEASURE_KEYS, unitToCm } from './body';

let n = 0;
const metric = (date: string, patch: Partial<BodyMetric> = {}): BodyMetric => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  deletedAt: null,
  date,
  weightKg: null,
  waistCm: null,
  measurements: {},
  ...patch,
});

describe('bodySeries', () => {
  const metrics = [
    metric('2026-10-03', { weightKg: 79, waistCm: 84, measurements: { arm: 36 } }),
    metric('2026-10-01', { weightKg: 80 }),
    metric('2026-10-02', { waistCm: 85 }),
  ];
  it('poids, taille et mensurations, triés par date', () => {
    expect(bodySeries(metrics, 'weight').map((p) => p.value)).toEqual([80, 79]);
    expect(bodySeries(metrics, 'waist').map((p) => p.date)).toEqual(['2026-10-02', '2026-10-03']);
    expect(bodySeries(metrics, 'arm')).toEqual([{ date: '2026-10-03', value: 36 }]);
    expect(bodySeries(metrics, 'neck')).toEqual([]);
  });
  it('la dernière saisie du jour l’emporte', () => {
    const two = [
      metric('2026-10-01', { weightKg: 80, updatedAt: '2026-10-01T08:00:00.000Z' }),
      metric('2026-10-01', { weightKg: 81, updatedAt: '2026-10-01T20:00:00.000Z' }),
    ];
    expect(bodySeries(two, 'weight')).toEqual([{ date: '2026-10-01', value: 81 }]);
    expect(bodySeries([...two].reverse(), 'weight')).toEqual([{ date: '2026-10-01', value: 81 }]);
  });
  it('zéro ou aucune donnée : série vide', () => {
    expect(bodySeries([], 'weight')).toEqual([]);
    expect(bodySeries([metric('2026-10-01', { weightKg: 0 })], 'weight')).toEqual([]);
  });
  it('bodyValue', () => {
    expect(bodyValue(metric('2026-10-01', { waistCm: 82 }), 'waist')).toBe(82);
    expect(bodyValue(metric('2026-10-01'), 'chest')).toBeNull();
  });
});

describe('MEASURE_KEYS', () => {
  it('commence par le tour de taille puis les mensurations du socle', () => {
    expect(MEASURE_KEYS[0]).toEqual({ id: 'waist', label: 'Tour de taille' });
    expect(MEASURE_KEYS.map((k) => k.id)).toContain('chest');
    expect(MEASURE_KEYS).toHaveLength(9);
  });
});

describe('isEmptyMetric', () => {
  it('vide quand plus aucune mesure', () => {
    expect(isEmptyMetric({ weightKg: null, waistCm: null, measurements: {} })).toBe(true);
    expect(isEmptyMetric({ weightKg: null, waistCm: null, measurements: { arm: 0 } })).toBe(true);
    expect(isEmptyMetric({ weightKg: 80, waistCm: null, measurements: {} })).toBe(false);
    expect(isEmptyMetric({ weightKg: null, waistCm: null, measurements: { arm: 36 } })).toBe(false);
  });
});

describe('unités de longueur', () => {
  it('cm ↔ pouces', () => {
    expect(cmToUnit(82, 'cm')).toBe(82);
    expect(cmToUnit(82, 'in')).toBe(32.3);
    expect(unitToCm(32.3, 'in')).toBeCloseTo(82.04, 2);
    expect(unitToCm(82, 'cm')).toBe(82);
  });
});
