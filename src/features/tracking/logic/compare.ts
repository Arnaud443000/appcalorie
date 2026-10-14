import { diffDays, relativeDayLabel, type Day } from './dates';
import type { SeriesPoint } from './series';

export interface ComparisonEnd {
  /** Jour demandé. */
  requested: Day;
  /** Mesure retenue : la plus proche du jour demandé. */
  point: SeriesPoint;
  /** Écart en jours entre le jour demandé et la mesure retenue. */
  gapDays: number;
}

export interface Comparison {
  from: ComparisonEnd;
  to: ComparisonEnd;
  delta: number;
  /** En pourcentage de la valeur de départ ; `null` si elle est nulle. */
  percent: number | null;
}

/** Mesure la plus proche d'un jour (à égalité : la plus ancienne). `null` si la série est vide. */
export function nearestPoint(points: readonly SeriesPoint[], day: Day): SeriesPoint | null {
  let best: SeriesPoint | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const gap = Math.abs(diffDays(day, point.date));
    // Série triée : à écart égal, on garde la première (la plus ancienne).
    if (gap < bestGap) {
      best = point;
      bestGap = gap;
    }
  }
  return best;
}

function end(points: readonly SeriesPoint[], day: Day): ComparisonEnd | null {
  const point = nearestPoint(points, day);
  return point ? { requested: day, point, gapDays: Math.abs(diffDays(day, point.date)) } : null;
}

/**
 * Compare la valeur à deux jours choisis (la mesure la plus proche de chaque jour).
 * `null` s'il n'y a aucune mesure, ou si les deux jours retombent sur la même mesure
 * (rien à comparer).
 */
export function compareDays(
  points: readonly SeriesPoint[],
  fromDay: Day,
  toDay: Day,
): Comparison | null {
  const from = end(points, fromDay);
  const to = end(points, toDay);
  if (!from || !to) return null;
  if (from.point === to.point) return null;
  const delta = to.point.value - from.point.value;
  return {
    from,
    to,
    delta,
    percent: from.point.value !== 0 ? (delta / from.point.value) * 100 : null,
  };
}

/** « Il y a 4 mois », « Aujourd'hui », « Hier »… (avec majuscule par défaut). */
export function comparisonLabel(day: Day, today: Day, capitalize = true): string {
  const text = relativeDayLabel(day, today);
  return capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Écart avec son signe : « +20 kg », « −2,5 kg », « 0 kg » (vrai signe moins). */
export function formatSigned(delta: number, format: (n: number) => string): string {
  const text = format(Math.abs(delta));
  if (text === format(0)) return text;
  return delta > 0 ? `+${text}` : `−${text}`;
}
