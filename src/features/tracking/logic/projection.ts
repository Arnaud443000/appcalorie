import { addDays, diffDays, type Day } from './dates';
import { slopePerDay, type SeriesPoint } from './series';

/** Fenêtre utilisée pour mesurer le rythme récent : les 6 dernières semaines. */
export const RATE_WINDOW_DAYS = 42;
/** Il faut au moins cet écart (en jours) entre les mesures pour oser parler de rythme. */
export const RATE_MIN_SPAN_DAYS = 7;
/** Au-delà, une estimation n'a plus de sens. */
export const MAX_PROJECTION_DAYS = 3650;

export interface Rate {
  perDay: number;
  perWeek: number;
  /** Nombre de mesures utilisées. */
  count: number;
  /** Jours entre la première et la dernière mesure utilisées. */
  spanDays: number;
  windowDays: number;
}

/**
 * Rythme récent (régression linéaire sur les dernières semaines, jusqu'à aujourd'hui).
 * `null` si moins de 2 mesures dans la fenêtre ou si elles couvrent moins de 7 jours.
 */
export function recentRate(
  points: readonly SeriesPoint[],
  today: Day,
  windowDays = RATE_WINDOW_DAYS,
): Rate | null {
  const window = points.filter((p) => p.date <= today && diffDays(p.date, today) < windowDays);
  const first = window[0];
  const last = window[window.length - 1];
  if (!first || !last || window.length < 2) return null;
  const spanDays = diffDays(first.date, last.date);
  if (spanDays < RATE_MIN_SPAN_DAYS) return null;
  const perDay = slopePerDay(window);
  if (perDay === null) return null;
  return { perDay, perWeek: perDay * 7, count: window.length, spanDays, windowDays };
}

export type Projection =
  /** L'objectif est déjà atteint. */
  | { kind: 'reached' }
  /** Au rythme actuel, il sera atteint à cette date. */
  | { kind: 'eta'; days: number; date: Day }
  /** Le rythme éloigne de l'objectif. */
  | { kind: 'wrong_way' }
  /** Aucune progression mesurable, ou date absurdement lointaine. */
  | { kind: 'stalled' }
  /** Pas assez de mesures. */
  | { kind: 'no_data' };

/**
 * Date estimée d'atteinte de la cible, par projection linéaire du rythme récent.
 * `direction` : 'up' s'il faut monter jusqu'à la cible, 'down' s'il faut descendre.
 */
export function projectReach(
  current: number | null,
  target: number,
  direction: 'up' | 'down',
  rate: Rate | null,
  today: Day,
): Projection {
  if (current === null) return { kind: 'no_data' };
  const remaining = direction === 'up' ? target - current : current - target;
  if (remaining <= 0) return { kind: 'reached' };
  if (!rate) return { kind: 'no_data' };
  const speed = direction === 'up' ? rate.perDay : -rate.perDay;
  if (speed < 0) return { kind: 'wrong_way' };
  if (speed === 0) return { kind: 'stalled' };
  const days = Math.ceil(remaining / speed);
  if (days > MAX_PROJECTION_DAYS) return { kind: 'stalled' };
  return { kind: 'eta', days, date: addDays(today, days) };
}
