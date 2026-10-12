import type { Nutrition } from './totals';

export interface DayTotals {
  day: string;
  /** Nombre de lignes saisies ce jour-là (0 = jour sans saisie). */
  entryCount: number;
  totals: Nutrition;
}

export interface WeeklySummary {
  days: DayTotals[];
  /** Jours avec au moins une ligne. */
  loggedDays: number;
  /** Jours sans aucune saisie, dans l'ordre. */
  missingDays: string[];
  /** Moyennes sur les jours saisis seulement (un jour oublié ne tire pas la moyenne vers 0). `null` si aucun jour saisi. */
  averageKcal: number | null;
  averageProteinG: number | null;
}

/** Résumé d'une période : moyennes des jours saisis, jours sans saisie signalés. */
export function summarizeWeek(days: DayTotals[]): WeeklySummary {
  const logged = days.filter((d) => d.entryCount > 0);
  const average = (pick: (n: Nutrition) => number): number | null =>
    logged.length === 0
      ? null
      : Math.round((logged.reduce((sum, d) => sum + pick(d.totals), 0) / logged.length) * 10) / 10;
  const kcal = average((n) => n.kcal);
  return {
    days,
    loggedDays: logged.length,
    missingDays: days.filter((d) => d.entryCount === 0).map((d) => d.day),
    averageKcal: kcal === null ? null : Math.round(kcal),
    averageProteinG: average((n) => n.proteinG),
  };
}

export interface Bar {
  day: string;
  value: number;
  /** Hauteur relative, entre 0 et 1. */
  ratio: number;
  missing: boolean;
}

/** Barres d'un graphique : hauteur proportionnelle à la plus grande valeur (ou à l'objectif s'il est plus haut). */
export function barsOf(
  days: DayTotals[],
  pick: (n: Nutrition) => number,
  goal: number | null,
): Bar[] {
  const values = days.map((d) => pick(d.totals));
  const scale = Math.max(1, goal ?? 0, ...values);
  return days.map((d, i) => ({
    day: d.day,
    value: values[i] ?? 0,
    ratio: (values[i] ?? 0) / scale,
    missing: d.entryCount === 0,
  }));
}

/** Position (0 à 1) de la ligne d'objectif sur le même repère que `barsOf`. */
export function goalRatio(
  days: DayTotals[],
  pick: (n: Nutrition) => number,
  goal: number | null,
): number | null {
  if (goal === null || goal <= 0) return null;
  const scale = Math.max(goal, ...days.map((d) => pick(d.totals)));
  return goal / scale;
}
