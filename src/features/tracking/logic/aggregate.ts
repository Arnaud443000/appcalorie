import { addDays, endOfMonth, startOfMonth, startOfWeek, type Day } from './dates';
import type { SeriesPoint } from './series';

export type Granularity = 'session' | 'week' | 'month';

export const GRANULARITIES = [
  { id: 'session', label: 'Séance' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
] as const;

/** Comment réunir plusieurs séances dans une semaine ou un mois. */
export type AggregateMode = 'max' | 'sum';

export interface BucketPoint extends SeriesPoint {
  /** Dernier jour de la période regroupée (= `date` pour une séance). */
  end: Day;
  /** Nombre de séances regroupées. */
  count: number;
  /** La période n'est pas terminée (une somme est donc partielle). */
  inProgress: boolean;
}

/** Premier jour de la semaine ou du mois qui contient `day` (le jour lui-même par séance). */
export function bucketStart(day: Day, granularity: Granularity): Day {
  switch (granularity) {
    case 'session':
      return day;
    case 'week':
      return startOfWeek(day);
    case 'month':
      return startOfMonth(day);
  }
}

function bucketEnd(start: Day, granularity: Granularity): Day {
  switch (granularity) {
    case 'session':
      return start;
    case 'week':
      return addDays(start, 6);
    case 'month':
      return endOfMonth(start);
  }
}

/**
 * Regroupe une série (un point par séance) par semaine ou par mois.
 * `max` garde le meilleur (1RM, charge max), `sum` additionne (volume). Chaque groupe est placé
 * au premier jour de sa période (lundi, ou 1er du mois). Une période vide n'a pas de point.
 * Par séance, plusieurs séances le même jour restent des points distincts.
 */
export function aggregateSeries(
  points: readonly SeriesPoint[],
  granularity: Granularity,
  mode: AggregateMode,
  today: Day,
): BucketPoint[] {
  if (granularity === 'session') {
    return points.map((p) => ({ ...p, end: p.date, count: 1, inProgress: false }));
  }
  const buckets = new Map<Day, BucketPoint>();
  for (const point of points) {
    const start = bucketStart(point.date, granularity);
    const existing = buckets.get(start);
    if (!existing) {
      const end = bucketEnd(start, granularity);
      buckets.set(start, {
        date: start,
        value: point.value,
        end,
        count: 1,
        inProgress: end >= today,
      });
    } else {
      existing.value =
        mode === 'sum' ? existing.value + point.value : Math.max(existing.value, point.value);
      existing.count += 1;
    }
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}
