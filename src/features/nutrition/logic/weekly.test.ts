import { describe, expect, it } from 'vitest';
import { barsOf, goalRatio, summarizeWeek, type DayTotals } from './weekly';

const day = (d: string, entryCount: number, kcal: number, proteinG: number): DayTotals => ({
  day: d,
  entryCount,
  totals: { kcal, proteinG, carbsG: 0, fatG: 0, fiberG: 0 },
});

const week = [
  day('2026-10-06', 3, 2000, 120),
  day('2026-10-07', 0, 0, 0),
  day('2026-10-08', 2, 1800, 100),
  day('2026-10-09', 0, 0, 0),
];

describe('résumé hebdomadaire', () => {
  it('moyenne les jours saisis seulement et signale les autres', () => {
    const summary = summarizeWeek(week);
    expect(summary.loggedDays).toBe(2);
    expect(summary.averageKcal).toBe(1900);
    expect(summary.averageProteinG).toBe(110);
    expect(summary.missingDays).toEqual(['2026-10-07', '2026-10-09']);
  });
  it('sans aucune saisie, pas de moyenne inventée', () => {
    const summary = summarizeWeek([day('2026-10-06', 0, 0, 0)]);
    expect(summary.averageKcal).toBeNull();
    expect(summary.averageProteinG).toBeNull();
    expect(summary.missingDays).toHaveLength(1);
  });
  it('dimensionne les barres sur la plus grande valeur ou l’objectif', () => {
    const bars = barsOf(week, (n) => n.kcal, null);
    expect(bars.map((b) => b.ratio)).toEqual([1, 0, 0.9, 0]);
    expect(bars[1]?.missing).toBe(true);
    const withGoal = barsOf(week, (n) => n.kcal, 4000);
    expect(withGoal[0]?.ratio).toBe(0.5);
    expect(goalRatio(week, (n) => n.kcal, 4000)).toBe(1);
    expect(goalRatio(week, (n) => n.kcal, 1000)).toBe(0.5);
    expect(goalRatio(week, (n) => n.kcal, null)).toBeNull();
  });
});
