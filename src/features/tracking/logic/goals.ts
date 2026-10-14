import { diffDays, type Day } from './dates';
import { projectReach, recentRate, type Projection, type Rate } from './projection';
import type { SeriesPoint } from './series';

export type GoalStatus =
  /** Objectif atteint. */
  | 'reached'
  /** En avance sur la date cible. */
  | 'ahead'
  /** Dans les temps. */
  | 'on_track'
  /** En retard, ou date dépassée sans avoir atteint la cible. */
  | 'late'
  /** Pas de date cible : pas de retard possible. */
  | 'no_deadline'
  /** Pas assez de mesures pour juger. */
  | 'no_data';

export interface GoalAssessment {
  direction: 'up' | 'down';
  start: number | null;
  current: number | null;
  target: number;
  /** Avancement de 0 à 1 (borné), `null` sans mesure. */
  progress: number | null;
  /** Reste à parcourir (positif), 0 si atteint ; `null` sans mesure. */
  remaining: number | null;
  reached: boolean;
  rate: Rate | null;
  projection: Projection;
  status: GoalStatus;
  /** Sur quoi repose le statut : le rythme récent, l'avancement prévu, ou rien. */
  basis: 'pace' | 'plan' | 'none';
  /** Jours restants avant la date cible (négatif si dépassée), `null` sans date. */
  daysLeft: number | null;
}

export interface AssessGoalInput {
  /** Mesures du critère suivi, triées par date (poids, mensuration, meilleure charge atteinte…). */
  series: readonly SeriesPoint[];
  target: number;
  targetDate: Day | null;
  /** Jour de création de l'objectif : la valeur de départ en est la mesure la plus proche. */
  createdDay: Day;
  today: Day;
}

/** Marge de tolérance : 10 % du temps restant, au moins 3 jours. */
function slackDays(daysLeft: number): number {
  return Math.max(3, Math.round(daysLeft * 0.1));
}

/** Écart toléré (en points d'avancement) entre l'avancement réel et l'avancement prévu. */
export const PLAN_TOLERANCE = 0.1;

/** Valeur de départ : dernière mesure au plus tard le jour de création, sinon la première après. */
export function startValue(series: readonly SeriesPoint[], createdDay: Day): number | null {
  let before: SeriesPoint | null = null;
  for (const point of series) {
    if (point.date <= createdDay) before = point;
    else break;
  }
  return (before ?? series.find((p) => p.date > createdDay))?.value ?? null;
}

/**
 * Évalue un objectif à valeur cible (poids, charge, mensuration) : départ, valeur actuelle,
 * avancement, rythme récent, date estimée d'atteinte, statut.
 * Statut : atteint ; sinon, sans date cible → « sans échéance » ; sinon on compare la date
 * estimée (rythme des 6 dernières semaines) à la date cible, et à défaut de rythme mesurable,
 * l'avancement réel à l'avancement prévu en ligne droite entre la création et la date cible.
 */
export function assessGoal(input: AssessGoalInput): GoalAssessment {
  const { series, target, targetDate, createdDay, today } = input;
  const past = series.filter((p) => p.date <= today);
  const current = past[past.length - 1]?.value ?? null;
  const start = startValue(past, createdDay);
  const direction: 'up' | 'down' =
    start !== null
      ? target >= start
        ? 'up'
        : 'down'
      : current !== null && current > target
        ? 'down'
        : 'up';
  const reached = current !== null && (direction === 'up' ? current >= target : current <= target);
  const rate = recentRate(past, today);
  const projection = reached
    ? ({ kind: 'reached' } as const)
    : projectReach(current, target, direction, rate, today);
  const daysLeft = targetDate ? diffDays(today, targetDate) : null;

  let progress: number | null = null;
  if (current !== null) {
    if (reached) progress = 1;
    else if (start === null || start === target) progress = 0;
    else progress = Math.min(1, Math.max(0, (current - start) / (target - start)));
  }
  const remaining =
    current === null ? null : Math.max(0, direction === 'up' ? target - current : current - target);

  const base = {
    direction,
    start,
    current,
    target,
    progress,
    remaining,
    reached,
    rate,
    projection,
    daysLeft,
  };

  if (current === null) return { ...base, status: 'no_data', basis: 'none' };
  if (reached) return { ...base, status: 'reached', basis: 'none' };
  if (daysLeft === null) return { ...base, status: 'no_deadline', basis: 'none' };
  if (daysLeft <= 0) return { ...base, status: 'late', basis: 'none' };

  switch (projection.kind) {
    case 'eta': {
      const slack = slackDays(daysLeft);
      const status =
        projection.days < daysLeft - slack
          ? 'ahead'
          : projection.days <= daysLeft + slack
            ? 'on_track'
            : 'late';
      return { ...base, status, basis: 'pace' };
    }
    case 'wrong_way':
    case 'stalled':
      return { ...base, status: 'late', basis: 'pace' };
    default: {
      // Pas de rythme mesurable : avancement réel contre avancement prévu.
      const total = diffDays(createdDay, targetDate ?? today);
      if (start === null || progress === null || total <= 0) {
        return { ...base, status: 'no_data', basis: 'none' };
      }
      const expected = Math.min(1, Math.max(0, diffDays(createdDay, today) / total));
      const gap = progress - expected;
      const status = gap > PLAN_TOLERANCE ? 'ahead' : gap >= -PLAN_TOLERANCE ? 'on_track' : 'late';
      return { ...base, status, basis: 'plan' };
    }
  }
}

/** Marge autour de la cible calorique pour parler de « dans la cible » (5 %). */
export const CALORIE_TOLERANCE = 0.05;

export interface CalorieAssessment {
  average: number | null;
  target: number;
  /** Écart relatif à la cible (+0,1 = 10 % au-dessus), `null` sans donnée. */
  gap: number | null;
  status: 'reached' | 'late' | 'no_data';
}

/** Objectif de calories : on le tient (ou pas) chaque jour, il n'y a ni départ ni projection. */
export function assessCalorieGoal(average: number | null, target: number): CalorieAssessment {
  if (average === null) return { average, target, gap: null, status: 'no_data' };
  const gap = target > 0 ? (average - target) / target : 0;
  return { average, target, gap, status: Math.abs(gap) <= CALORIE_TOLERANCE ? 'reached' : 'late' };
}

/** Moyenne des jours renseignés sur les `days` derniers jours (hors aujourd'hui s'il y en a d'autres). */
export function recentDailyAverage(
  daily: readonly SeriesPoint[],
  today: Day,
  days = 7,
): number | null {
  const window = daily.filter(
    (p) => p.value > 0 && p.date <= today && diffDays(p.date, today) < days,
  );
  const complete = window.filter((p) => p.date !== today);
  const used = complete.length > 0 ? complete : window;
  if (used.length === 0) return null;
  return used.reduce((total, p) => total + p.value, 0) / used.length;
}
