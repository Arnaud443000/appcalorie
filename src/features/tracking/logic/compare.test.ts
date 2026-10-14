import { describe, expect, it } from 'vitest';
import { compareDays, comparisonLabel, formatSigned, nearestPoint } from './compare';
import type { SeriesPoint } from './series';

const p = (date: string, value: number): SeriesPoint => ({ date, value });
const fmt = (n: number) => String(n).replace('.', ',');

describe('nearestPoint', () => {
  const pts = [p('2026-06-01', 60), p('2026-06-10', 62), p('2026-10-12', 80)];
  it('prend la mesure la plus proche', () => {
    expect(nearestPoint(pts, '2026-06-02')?.value).toBe(60);
    expect(nearestPoint(pts, '2026-06-08')?.value).toBe(62);
    expect(nearestPoint(pts, '2030-01-01')?.value).toBe(80);
    expect(nearestPoint(pts, '2020-01-01')?.value).toBe(60);
  });
  it('à égalité, la plus ancienne', () => {
    expect(nearestPoint([p('2026-06-01', 1), p('2026-06-03', 2)], '2026-06-02')?.value).toBe(1);
  });
  it('null si la série est vide', () => {
    expect(nearestPoint([], '2026-06-01')).toBeNull();
  });
});

describe('compareDays', () => {
  const pts = [p('2026-06-12', 60), p('2026-09-01', 70), p('2026-10-12', 80)];
  it('compare deux jours', () => {
    const c = compareDays(pts, '2026-06-12', '2026-10-12');
    expect(c?.from.point.value).toBe(60);
    expect(c?.to.point.value).toBe(80);
    expect(c?.delta).toBe(20);
    expect(c?.percent).toBeCloseTo(33.33, 1);
    expect(c?.from.gapDays).toBe(0);
  });
  it('signale l’écart avec le jour demandé', () => {
    const c = compareDays(pts, '2026-06-20', '2026-10-12');
    expect(c?.from.point.date).toBe('2026-06-12');
    expect(c?.from.gapDays).toBe(8);
  });
  it('fonctionne dans le sens inverse (baisse)', () => {
    expect(compareDays(pts, '2026-10-12', '2026-06-12')?.delta).toBe(-20);
  });
  it('null sans mesure, ou si les deux jours donnent la même mesure', () => {
    expect(compareDays([], '2026-06-12', '2026-10-12')).toBeNull();
    expect(compareDays([p('2026-06-12', 60)], '2026-06-12', '2026-10-12')).toBeNull();
    expect(compareDays(pts, '2026-10-12', '2026-10-12')).toBeNull();
  });
  it('pas de pourcentage depuis zéro', () => {
    expect(
      compareDays([p('2026-06-12', 0), p('2026-10-12', 5)], '2026-06-12', '2026-10-12')?.percent,
    ).toBeNull();
  });
});

describe('textes', () => {
  it('libellés relatifs avec majuscule', () => {
    expect(comparisonLabel('2026-06-12', '2026-10-12')).toBe('Il y a 4 mois');
    expect(comparisonLabel('2026-06-12', '2026-10-12', false)).toBe('il y a 4 mois');
    expect(comparisonLabel('2026-10-12', '2026-10-12')).toBe('Aujourd’hui');
  });
  it('formatSigned : plus, vrai moins, zéro sans signe', () => {
    expect(formatSigned(20, fmt)).toBe('+20');
    expect(formatSigned(-2.5, fmt)).toBe('−2,5');
    expect(formatSigned(0, fmt)).toBe('0');
    expect(formatSigned(-0, fmt)).toBe('0');
  });
  it('formatSigned : un écart qui s’arrondit à zéro n’a pas de signe', () => {
    const round = (n: number) => String(Math.round(n));
    expect(formatSigned(-0.2, round)).toBe('0');
  });
});
