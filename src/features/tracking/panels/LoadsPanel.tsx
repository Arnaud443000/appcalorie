import { useMemo, useState } from 'react';
import {
  formatNumber,
  formatRecordValue,
  RECORD_LABELS,
  type Exercise,
  type InputType,
} from '@/data';
import { Button, Card, Chip, EmptyState, ListRow, Stat, Tabs } from '@/ui';
import { CompareTool } from '../components/CompareTool';
import { ExerciseSearchSheet } from '../components/ExerciseSearchSheet';
import { LineChart } from '../components/LineChart';
import { PeriodChips } from '../components/PeriodChips';
import type { TrackingData } from '../data/useTrackingData';
import { formatStored, loadQuantity, toChartPoints } from '../format';
import {
  aggregateSeries,
  exerciseSessionStats,
  filterPeriod,
  formatLongDay,
  formatMonthLong,
  formatShortDayYear,
  formatSigned,
  GRANULARITIES,
  isSummedMetric,
  LOAD_METRIC_LABELS,
  metricSeries,
  METRICS_BY_INPUT,
  periodStart,
  recordRows,
  runningMax,
  variation,
  type Granularity,
  type LoadMetric,
  type PeriodId,
} from '../logic';
import styles from './panels.module.css';
import loadStyles from './LoadsPanel.module.css';

const STORAGE_KEY = 'atlas.tracking.exercise';

function readStoredExercise(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeExercise(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Stockage indisponible (navigation privée…) : on garde juste le choix en mémoire.
  }
}

/** Date de début d'une semaine / d'un mois, ou le jour de la séance. */
function bucketLabel(date: string, granularity: Granularity, inProgress: boolean): string {
  const base =
    granularity === 'week'
      ? `Semaine du ${formatShortDayYear(date)}`
      : granularity === 'month'
        ? formatMonthLong(date)
        : formatShortDayYear(date);
  return inProgress ? `${base} (en cours)` : base;
}

export function LoadsPanel({ data }: { data: TrackingData }) {
  const { today, weightUnit, sets, sessionDays, exercises, exerciseById } = data;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(readStoredExercise);
  const [metricChoice, setMetricChoice] = useState<LoadMetric | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('session');
  const [period, setPeriod] = useState<PeriodId>('all');

  // Exercices qui ont au moins une série de travail dans une séance existante.
  const sessionCounts = useMemo(() => {
    const perExercise = new Map<string, Set<string>>();
    for (const set of sets) {
      if (set.isWarmup || !sessionDays.has(set.sessionId)) continue;
      const list = perExercise.get(set.exerciseId) ?? new Set<string>();
      list.add(set.sessionId);
      perExercise.set(set.exerciseId, list);
    }
    return new Map([...perExercise].map(([id, list]) => [id, list.size]));
  }, [sets, sessionDays]);

  // Exercice affiché : le choix, sinon le dernier utilisé, sinon le plus fait.
  const exercise: Exercise | null = useMemo(() => {
    const chosen = chosenId ? exerciseById.get(chosenId) : undefined;
    if (chosen) return chosen;
    let bestId: string | null = null;
    let bestCount = 0;
    for (const [id, count] of sessionCounts) {
      if (count > bestCount && exerciseById.has(id)) {
        bestId = id;
        bestCount = count;
      }
    }
    return bestId ? (exerciseById.get(bestId) ?? null) : null;
  }, [chosenId, exerciseById, sessionCounts]);

  const exerciseSets = useMemo(
    () => (exercise ? sets.filter((s) => s.exerciseId === exercise.id) : []),
    [sets, exercise],
  );
  const inputType: InputType = exercise?.inputType ?? 'weight_reps';
  const stats = useMemo(
    () => exerciseSessionStats(exerciseSets, sessionDays),
    [exerciseSets, sessionDays],
  );

  const metrics = METRICS_BY_INPUT[inputType];
  const metric: LoadMetric =
    metricChoice && metrics.includes(metricChoice) ? metricChoice : (metrics[0] ?? 'maxWeight');
  const quantity = loadQuantity(metric, weightUnit);
  const summed = isSummedMetric(metric);

  const perSession = useMemo(() => metricSeries(stats, metric), [stats, metric]);
  // Le regroupement est calculé sur tout l'historique, puis la période est appliquée.
  const grouped = useMemo(
    () => aggregateSeries(perSession, granularity, summed ? 'sum' : 'max', today),
    [perSession, granularity, summed, today],
  );
  const windowed = useMemo(() => filterPeriod(grouped, period, today), [grouped, period, today]);
  const records = useMemo(
    () => recordRows(exerciseSets, inputType, sessionDays),
    [exerciseSets, inputType, sessionDays],
  );

  // Objectif de charge : sa ligne apparaît sur la courbe de charge max.
  const goal = useMemo(() => {
    if (!exercise || metric !== 'maxWeight') return null;
    return (
      data.goals
        .filter((g) => g.type === 'load' && g.exerciseId === exercise.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }, [data.goals, exercise, metric]);

  const start = periodStart(period, today) ?? perSession[0]?.date ?? today;
  const change = variation(windowed);
  const best = useMemo(() => runningMax(perSession).at(-1) ?? null, [perSession]);
  const lastPoint = perSession.at(-1) ?? null;

  const chartPoints = toChartPoints(
    windowed.map((p) => ({ ...p, label: bucketLabel(p.date, granularity, p.inProgress) })),
    quantity,
  );

  if (exercises.length === 0 || sessionCounts.size === 0) {
    return (
      <div className={styles.panel}>
        <Card>
          <EmptyState
            icon="workout"
            title="Pas encore de séance"
            message="Fais une séance dans l’onglet Entraînement : tes charges, ton 1RM estimé et ton volume apparaîtront ici."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <Card>
        <div className={styles.stack}>
          <button
            type="button"
            className={loadStyles.picker}
            onClick={() => setPickerOpen(true)}
            aria-label={`Exercice : ${exercise?.name ?? 'aucun'}. Changer d’exercice`}
          >
            <span className={loadStyles.pickerLabel}>Exercice</span>
            <span className={loadStyles.pickerName}>{exercise?.name ?? 'Choisir un exercice'}</span>
          </button>

          {exercise && stats.length === 0 ? (
            <EmptyState
              icon="workout"
              title="Pas encore d’historique"
              message={`Fais « ${exercise.name} » dans une séance : ses courbes apparaîtront ici.`}
              action={
                <Button variant="secondary" onClick={() => setPickerOpen(true)}>
                  Choisir un autre exercice
                </Button>
              }
            />
          ) : (
            <>
              {metrics.length > 1 && (
                <div role="group" aria-label="Indicateur" className={loadStyles.chips}>
                  {metrics.map((id) => (
                    <Chip key={id} selected={id === metric} onClick={() => setMetricChoice(id)}>
                      {LOAD_METRIC_LABELS[id]}
                    </Chip>
                  ))}
                </div>
              )}
              <Tabs
                label="Regroupement"
                items={GRANULARITIES}
                value={granularity}
                onChange={setGranularity}
              />
              <PeriodChips value={period} onChange={setPeriod} />
              <div className={styles.stats}>
                <Stat
                  label="Dernière"
                  value={lastPoint ? formatNumber(quantity.toDisplay(lastPoint.value)) : '—'}
                  unit={lastPoint ? quantity.unit : undefined}
                />
                <Stat
                  label="Meilleure"
                  value={best ? formatNumber(quantity.toDisplay(best.value)) : '—'}
                  unit={best ? quantity.unit : undefined}
                />
                <Stat
                  label="Variation"
                  value={
                    change ? formatSigned(quantity.toDisplay(change.delta), formatNumber) : '—'
                  }
                  unit={change ? quantity.unit : undefined}
                />
              </div>
              {summed && granularity !== 'session' && (
                <p className={styles.muted}>
                  Le volume est additionné par {granularity === 'week' ? 'semaine' : 'mois'}.
                </p>
              )}
              <LineChart
                title={`${LOAD_METRIC_LABELS[metric]} · ${exercise?.name ?? ''}`}
                series={[
                  {
                    id: metric,
                    name: LOAD_METRIC_LABELS[metric],
                    points: chartPoints,
                    variant: 'main',
                  },
                ]}
                goal={
                  goal
                    ? {
                        value: quantity.toDisplay(goal.targetValue),
                        label: `Objectif ${formatStored(quantity, goal.targetValue)}`,
                      }
                    : null
                }
                formatValue={quantity.formatDisplay}
                formatAxis={quantity.formatAxis}
                noun={
                  granularity === 'session' ? 'séance' : granularity === 'week' ? 'semaine' : 'mois'
                }
                domain={[start, today]}
                emptyMessage="Aucune séance sur cette période. Choisis « Tout » pour voir l’ensemble."
              />
            </>
          )}
        </div>
      </Card>

      {exercise && stats.length > 0 && (
        <>
          <Card>
            <CompareTool
              key={`${exercise.id}-${metric}`}
              points={perSession}
              quantity={quantity}
              today={today}
              subject={`« ${LOAD_METRIC_LABELS[metric].toLowerCase()} »`}
            />
          </Card>

          <Card flush>
            <div className={styles.sectionHead}>
              <h2>Records</h2>
              <span className={styles.muted}>{exercise.name}</span>
            </div>
            {records.length === 0 ? (
              <p className={loadStyles.noRecords}>
                Pas encore de record : ils apparaissent dès la première série de travail.
              </p>
            ) : (
              <ul className={styles.list}>
                {records.map((record) => (
                  <li key={record.kind}>
                    <ListRow
                      title={RECORD_LABELS[record.kind]}
                      subtitle={record.date ? formatLongDay(record.date) : undefined}
                      trailing={
                        <strong>{formatRecordValue(record.kind, record.value, weightUnit)}</strong>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <ExerciseSearchSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        exercises={exercises}
        sessionCounts={sessionCounts}
        onPick={(picked) => {
          setChosenId(picked.id);
          setMetricChoice(null);
          storeExercise(picked.id);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
