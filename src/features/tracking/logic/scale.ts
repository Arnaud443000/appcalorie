import {
  addDays,
  addMonths,
  diffDays,
  formatMonthShort,
  formatShortDay,
  startOfMonth,
  type Day,
} from './dates';

export interface NiceScale {
  min: number;
  max: number;
  ticks: number[];
}

/** Plus proche « beau » pas (1, 2, 2,5, 5 × 10ⁿ) supérieur ou égal à `raw`. */
function niceStep(raw: number): number {
  const exponent = Math.floor(Math.log10(raw));
  const base = 10 ** exponent;
  const fraction = raw / base;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

/**
 * Graduations « rondes » pour l'axe vertical. L'intervalle est élargi d'un peu de marge, puis
 * arrondi à des graduations lisibles. Une seule valeur (min = max) donne un intervalle autour d'elle.
 */
export function niceScale(min: number, max: number, targetTicks = 4): NiceScale {
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, ticks: [0, 1] };
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.05 || 1;
    lo -= pad;
    hi += pad;
  } else {
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
  }
  // Pas de valeurs négatives pour une courbe qui n'en a pas (poids, charges, mesures).
  if (min >= 0 && lo < 0) lo = 0;
  const step = niceStep((hi - lo) / Math.max(1, targetTicks - 1));
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const round = (n: number) => Number(n.toFixed(decimals));
  const first = round(Math.floor(lo / step) * step);
  const last = round(Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let i = 0; first + i * step <= last + step / 1000; i++) ticks.push(round(first + i * step));
  return { min: first, max: last, ticks };
}

export interface TimeTick {
  date: Day;
  label: string;
}

const DAY_STEPS = [1, 2, 3, 7, 14, 30];
const MONTH_STEPS = [1, 2, 3, 6, 12, 24];

/**
 * Graduations de l'axe horizontal : des jours régulièrement espacés pour une période courte,
 * des débuts de mois au-delà de deux mois. Jamais plus de `maxTicks`.
 */
export function timeTicks(start: Day, end: Day, maxTicks = 5): TimeTick[] {
  const span = diffDays(start, end);
  if (span <= 0) return [{ date: start, label: formatShortDay(start) }];

  if (span <= 60) {
    const step = DAY_STEPS.find((s) => Math.floor(span / s) + 1 <= maxTicks) ?? 30;
    const ticks: TimeTick[] = [];
    for (let day = start; day <= end; day = addDays(day, step)) {
      ticks.push({ date: day, label: formatShortDay(day) });
    }
    return ticks;
  }

  const monthSpan = diffDays(startOfMonth(start), startOfMonth(end)) / 30.4375;
  const first = start === startOfMonth(start) ? start : addMonths(startOfMonth(start), 1);
  const crossesYears = start.slice(0, 4) !== end.slice(0, 4);
  const step = MONTH_STEPS.find((s) => Math.floor(monthSpan / s) + 1 <= maxTicks) ?? 24;
  const ticks: TimeTick[] = [];
  for (let day = first; day <= end; day = addMonths(day, step)) {
    ticks.push({ date: day, label: formatMonthShort(day, crossesYears) });
  }
  return ticks.length > 0 ? ticks : [{ date: start, label: formatShortDay(start) }];
}

/** Position horizontale d'un jour entre `left` et `right` ; au milieu si l'intervalle est vide. */
export function xPosition(day: Day, start: Day, end: Day, left: number, right: number): number {
  const span = diffDays(start, end);
  if (span <= 0) return (left + right) / 2;
  return left + (diffDays(start, day) / span) * (right - left);
}

/** Indice du plus proche de `xs` (trié croissant) autour de `x`. -1 si vide. */
export function nearestIndex(xs: readonly number[], x: number): number {
  if (xs.length === 0) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((xs[mid] ?? 0) < x) lo = mid + 1;
    else hi = mid;
  }
  const after = xs[lo] ?? 0;
  const before = xs[lo - 1];
  if (before !== undefined && x - before <= after - x) return lo - 1;
  return lo;
}
