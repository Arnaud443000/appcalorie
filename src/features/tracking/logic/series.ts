import { addDays, addMonths, dayNumber, diffDays, type Day } from './dates';

/** Un point d'une courbe : un jour et une valeur (en unité stockée : kg, cm…). */
export interface SeriesPoint {
  date: Day;
  value: number;
}

/** Garde les points valides (date réelle, nombre fini) et les trie par date (tri stable). */
export function cleanSeries<T extends SeriesPoint>(points: readonly T[]): T[] {
  return points
    .filter((p) => Number.isFinite(p.value) && !Number.isNaN(dayNumber(p.date)))
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p.date.localeCompare(b.p.date) || a.index - b.index)
    .map(({ p }) => p);
}

export type SameDayRule = 'last' | 'first' | 'mean' | 'max';

/** Ne garde qu'un point par jour (série triée en entrée ; l'ordre d'origine décide de « dernier »). */
export function mergeSameDay(
  points: readonly SeriesPoint[],
  rule: SameDayRule = 'last',
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  const counts: number[] = [];
  for (const point of points) {
    const lastPoint = out[out.length - 1];
    if (lastPoint && lastPoint.date === point.date) {
      const index = out.length - 1;
      switch (rule) {
        case 'last':
          out[index] = point;
          break;
        case 'max':
          out[index] = { date: point.date, value: Math.max(lastPoint.value, point.value) };
          break;
        case 'mean': {
          const n = (counts[index] ?? 1) + 1;
          out[index] = {
            date: point.date,
            value: (lastPoint.value * (n - 1) + point.value) / n,
          };
          counts[index] = n;
          break;
        }
        case 'first':
          break;
      }
    } else {
      out.push(point);
      counts.push(1);
    }
  }
  return out;
}

/** Série prête à tracer : valide, triée, un seul point par jour. */
export function prepareSeries(points: readonly SeriesPoint[], rule: SameDayRule = 'last') {
  return mergeSameDay(cleanSeries(points), rule);
}

export const PERIODS = [
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: '3m', label: '3 mois' },
  { id: '6m', label: '6 mois' },
  { id: '1y', label: '1 an' },
  { id: 'all', label: 'Tout' },
] as const;

export type PeriodId = (typeof PERIODS)[number]['id'];

/**
 * Premier jour inclus d'une période qui se termine aujourd'hui, ou `null` pour « Tout ».
 * « 7 jours » = aujourd'hui et les 6 jours précédents ; les mois sont des mois calendaires.
 */
export function periodStart(period: PeriodId, today: Day): Day | null {
  switch (period) {
    case '7d':
      return addDays(today, -6);
    case '30d':
      return addDays(today, -29);
    case '3m':
      return addMonths(today, -3);
    case '6m':
      return addMonths(today, -6);
    case '1y':
      return addMonths(today, -12);
    case 'all':
      return null;
  }
}

/** Points de la période (bornes comprises). Les points futurs sont aussi écartés. */
export function filterPeriod<T extends SeriesPoint>(
  points: readonly T[],
  period: PeriodId,
  today: Day,
): T[] {
  const start = periodStart(period, today);
  return points.filter((p) => (start === null || p.date >= start) && p.date <= today);
}

/**
 * Moyenne glissante sur `windowDays` jours calendaires (7 par défaut) : pour chaque point,
 * moyenne des points des `windowDays` derniers jours, lui compris. Les trous ne faussent rien
 * (c'est la date qui compte, pas le nombre de points). Série triée en entrée.
 */
export function rollingAverage(points: readonly SeriesPoint[], windowDays = 7): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  let start = 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;
    sum += point.value;
    const earliest = dayNumber(point.date) - (windowDays - 1);
    while (start < i && dayNumber(points[start]?.date ?? point.date) < earliest) {
      sum -= points[start]?.value ?? 0;
      start++;
    }
    out.push({ date: point.date, value: sum / (i - start + 1) });
  }
  return out;
}

export interface Variation {
  from: SeriesPoint;
  to: SeriesPoint;
  delta: number;
  /** En pourcentage de la valeur de départ ; `null` si elle est nulle. */
  percent: number | null;
  days: number;
}

/** Écart entre le premier et le dernier point. `null` s'il y a moins de 2 points. */
export function variation(points: readonly SeriesPoint[]): Variation | null {
  const from = points[0];
  const to = points[points.length - 1];
  if (!from || !to || points.length < 2) return null;
  const delta = to.value - from.value;
  return {
    from,
    to,
    delta,
    percent: from.value !== 0 ? (delta / from.value) * 100 : null,
    days: diffDays(from.date, to.date),
  };
}

export type TrendDirection = 'down' | 'stable' | 'up';

export interface Trend {
  direction: TrendDirection;
  /** Variation par semaine (régression linéaire), dans l'unité de la série. */
  perWeek: number;
}

/** Il faut au moins ce nombre de jours entre le premier et le dernier point pour parler de tendance. */
export const MIN_TREND_DAYS = 3;

/**
 * Tendance par régression linéaire (moindres carrés). `null` si moins de 2 points ou si
 * tous les points sont trop proches dans le temps. « Stable » en dessous de 0,1 % de la valeur
 * moyenne par semaine (ou de `stableBelow` si fourni, dans l'unité de la série).
 */
export function trend(points: readonly SeriesPoint[], stableBelow?: number): Trend | null {
  const slope = slopePerDay(points);
  if (slope === null) return null;
  const perWeek = slope * 7;
  const mean = points.reduce((total, p) => total + p.value, 0) / points.length;
  const threshold = stableBelow ?? Math.abs(mean) * 0.001;
  const direction: TrendDirection =
    Math.abs(perWeek) < threshold ? 'stable' : perWeek > 0 ? 'up' : 'down';
  return { direction, perWeek };
}

/** Pente (valeur par jour) de la droite des moindres carrés ; `null` si indéfinie. */
export function slopePerDay(points: readonly SeriesPoint[]): number | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return null;
  if (diffDays(first.date, last.date) < MIN_TREND_DAYS) return null;
  const origin = dayNumber(first.date);
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += dayNumber(p.date) - origin;
    sumY += p.value;
  }
  const n = points.length;
  const meanX = sumX / n;
  const meanY = sumY / n;
  let covariance = 0;
  let spread = 0;
  for (const p of points) {
    const dx = dayNumber(p.date) - origin - meanX;
    covariance += dx * (p.value - meanY);
    spread += dx * dx;
  }
  return spread === 0 ? null : covariance / spread;
}
