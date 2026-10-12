import {
  detectRecords,
  estimateOneRepMax,
  exerciseRecords,
  RECORD_KINDS_BY_INPUT,
  sessionVolume,
  workingSets,
  type ExerciseRecords,
  type InputType,
  type RecordKind,
  type SetLike,
} from '@/data';
import type { Day } from './dates';
import { prepareSeries, type SeriesPoint } from './series';

/** Ce que l'on peut suivre pour un exercice. */
export type LoadMetric =
  'oneRepMax' | 'maxWeight' | 'volume' | 'maxReps' | 'maxDuration' | 'maxDistance';

export const LOAD_METRIC_LABELS: Record<LoadMetric, string> = {
  oneRepMax: '1RM estimé',
  maxWeight: 'Charge max',
  volume: 'Volume',
  maxReps: 'Répétitions max',
  maxDuration: 'Durée max',
  maxDistance: 'Distance max',
};

/** Courbes proposées selon le type de saisie de l'exercice (la première est celle par défaut). */
export const METRICS_BY_INPUT: Record<InputType, readonly LoadMetric[]> = {
  weight_reps: ['oneRepMax', 'maxWeight', 'volume'],
  bodyweight_load: ['maxReps', 'maxWeight', 'volume'],
  reps: ['maxReps'],
  duration: ['maxDuration'],
  distance: ['maxDistance'],
  weight_distance: ['maxWeight', 'maxDistance'],
};

/** Types de saisie où la charge compte : on peut leur fixer un objectif de charge. */
export const LOAD_GOAL_INPUTS: readonly InputType[] = [
  'weight_reps',
  'bodyweight_load',
  'weight_distance',
];

/** Les cumuls s'additionnent par semaine / mois, les meilleurs se comparent. */
export function isSummedMetric(metric: LoadMetric): boolean {
  return metric === 'volume';
}

/** Chiffres d'un exercice sur une séance (échauffements exclus). */
export interface SessionStat {
  sessionId: string;
  /** Jour de la séance. */
  date: Day;
  setCount: number;
  oneRepMax: number | null;
  maxWeight: number | null;
  /** Somme charge × répétitions (kg). */
  volume: number;
  maxReps: number | null;
  maxDuration: number | null;
  maxDistance: number | null;
}

const best = (current: number | null, value: number | null | undefined): number | null =>
  value != null && Number.isFinite(value) && value > 0
    ? current === null || value > current
      ? value
      : current
    : current;

/**
 * Une ligne par séance où l'exercice a été fait (au moins une série de travail), triée par date.
 * `sessionDays` : jour de chaque séance (par identifiant) ; une série dont la séance est inconnue
 * (supprimée) est ignorée. Réutilise `estimateOneRepMax` et `sessionVolume` de `@/data`.
 */
export function exerciseSessionStats(
  sets: readonly SetLike[],
  sessionDays: ReadonlyMap<string, Day>,
): SessionStat[] {
  const bySession = new Map<string, SetLike[]>();
  for (const set of workingSets(sets)) {
    if (!sessionDays.has(set.sessionId)) continue;
    const list = bySession.get(set.sessionId);
    if (list) list.push(set);
    else bySession.set(set.sessionId, [set]);
  }
  const stats: SessionStat[] = [];
  for (const [sessionId, list] of bySession) {
    const stat: SessionStat = {
      sessionId,
      date: sessionDays.get(sessionId) as Day,
      setCount: list.length,
      oneRepMax: null,
      maxWeight: null,
      volume: sessionVolume(list),
      maxReps: null,
      maxDuration: null,
      maxDistance: null,
    };
    for (const set of list) {
      stat.oneRepMax = best(stat.oneRepMax, estimateOneRepMax(set.weight, set.reps));
      stat.maxWeight = best(stat.maxWeight, set.weight);
      stat.maxReps = best(stat.maxReps, set.reps);
      stat.maxDuration = best(stat.maxDuration, set.durationSeconds);
      stat.maxDistance = best(stat.maxDistance, set.distanceMeters);
    }
    stats.push(stat);
  }
  return stats.sort(
    (a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId),
  );
}

/**
 * Courbe d'un indicateur, un point par jour (plusieurs séances le même jour : la meilleure,
 * ou la somme pour le volume). Les séances sans valeur pour cet indicateur sont ignorées.
 */
export function metricSeries(stats: readonly SessionStat[], metric: LoadMetric): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const stat of stats) {
    const value = stat[metric];
    if (value !== null && value > 0) points.push({ date: stat.date, value });
  }
  if (!isSummedMetric(metric)) return prepareSeries(points, 'max');
  // Le volume du jour est la somme des séances du jour.
  const sums = new Map<Day, number>();
  for (const p of points) sums.set(p.date, (sums.get(p.date) ?? 0) + p.value);
  return prepareSeries([...sums].map(([date, value]) => ({ date, value })));
}

/** Meilleure valeur atteinte jusqu'à chaque point (série qui ne descend jamais). */
export function runningMax(points: readonly SeriesPoint[]): SeriesPoint[] {
  let top = Number.NEGATIVE_INFINITY;
  return points.map((p) => {
    top = Math.max(top, p.value);
    return { date: p.date, value: top };
  });
}

export interface RecordRow {
  kind: RecordKind;
  value: number;
  /** Jour de la séance qui l'a établi, si elle est connue. */
  date: Day | null;
}

/** Records d'un exercice dans l'ordre d'affichage habituel, avec la date de la séance. */
export function recordRows(
  sets: readonly SetLike[],
  inputType: InputType,
  sessionDays: ReadonlyMap<string, Day>,
): RecordRow[] {
  const records: ExerciseRecords = exerciseRecords(
    sets.filter((s) => sessionDays.has(s.sessionId)),
    inputType,
  );
  const rows: RecordRow[] = [];
  for (const kind of RECORD_KINDS_BY_INPUT[inputType]) {
    const record = records[kind];
    if (record) {
      rows.push({
        kind,
        value: record.value,
        date: sessionDays.get(record.sessionId) ?? null,
      });
    }
  }
  return rows;
}

export interface RecordEvent {
  exerciseId: string;
  sessionId: string;
  kind: RecordKind;
  value: number;
  previous: number;
  date: Day;
}

/** Quel record annoncer quand une séance en bat plusieurs. */
const KIND_PRIORITY: readonly RecordKind[] = [
  'maxWeight',
  'oneRepMax',
  'maxReps',
  'maxVolume',
  'maxDistance',
  'maxDuration',
];

/**
 * Records battus lors des dernières séances de chaque exercice (les `lastSessions` plus récentes),
 * du plus récent au plus ancien. Un record bat strictement les séances précédentes ; la première
 * séance d'un exercice n'en annonce aucun (voir `detectRecords`).
 */
export function recentRecordEvents(
  sets: readonly SetLike[],
  sessionDays: ReadonlyMap<string, Day>,
  inputTypes: ReadonlyMap<string, InputType>,
  lastSessions = 3,
): RecordEvent[] {
  const byExercise = new Map<string, Map<string, SetLike[]>>();
  for (const set of sets) {
    if (!sessionDays.has(set.sessionId)) continue;
    let sessions = byExercise.get(set.exerciseId);
    if (!sessions) byExercise.set(set.exerciseId, (sessions = new Map()));
    const list = sessions.get(set.sessionId);
    if (list) list.push(set);
    else sessions.set(set.sessionId, [set]);
  }

  const events: RecordEvent[] = [];
  for (const [exerciseId, sessions] of byExercise) {
    const inputType = inputTypes.get(exerciseId);
    if (!inputType) continue;
    const ordered = [...sessions].sort(
      ([a], [b]) =>
        (sessionDays.get(a) ?? '').localeCompare(sessionDays.get(b) ?? '') || a.localeCompare(b),
    );
    for (let i = ordered.length - 1; i >= 1 && i >= ordered.length - lastSessions; i--) {
      const [sessionId, current] = ordered[i] ?? [];
      if (!sessionId || !current) continue;
      const previous = ordered.slice(0, i).flatMap(([, list]) => list);
      const breaks = detectRecords(previous, current, inputType);
      const top = KIND_PRIORITY.map((kind) => breaks.find((b) => b.kind === kind)).find(Boolean);
      if (top) {
        events.push({
          exerciseId,
          sessionId,
          kind: top.kind,
          value: top.value,
          previous: top.previous,
          date: sessionDays.get(sessionId) as Day,
        });
      }
    }
  }
  return events.sort(
    (a, b) => b.date.localeCompare(a.date) || a.exerciseId.localeCompare(b.exerciseId),
  );
}
