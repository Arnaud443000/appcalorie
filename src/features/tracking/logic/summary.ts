import { diffDays, type Day } from './dates';
import { filterPeriod, variation, type SeriesPoint, type Variation } from './series';

export interface WeightSummary {
  current: SeriesPoint | null;
  /** Variation sur les 30 derniers jours, `null` s'il y a moins de 2 pesées. */
  variation30: Variation | null;
}

export function weightSummary(weights: readonly SeriesPoint[], today: Day): WeightSummary {
  const past = weights.filter((p) => p.date <= today);
  return {
    current: past[past.length - 1] ?? null,
    variation30: variation(filterPeriod(past, '30d', today)),
  };
}

/** Nombre de séances des 7 derniers jours (aujourd'hui et les 6 jours précédents). */
export function sessionsInLastDays(sessionDays: readonly Day[], today: Day, days = 7): number {
  return sessionDays.filter((day) => day <= today && diffDays(day, today) < days).length;
}
