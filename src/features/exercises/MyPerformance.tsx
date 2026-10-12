import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  estimateOneRepMax,
  exerciseRecords,
  formatDay,
  formatRecordValue,
  formatSetSummary,
  formatWeight,
  getSettings,
  lastPerformance,
  RECORD_LABELS,
  RECORD_KINDS_BY_INPUT,
  setEntryRepo,
  workoutSessionRepo,
  type Exercise,
  type WeightUnit,
} from '@/data';
import { Card, Stat } from '@/ui';
import styles from './MyPerformance.module.css';

const HISTORY_SIZE = 5;

/** Section « Mes performances » : dernière séance, records et petit historique. */
export function MyPerformance({ exercise }: { exercise: Exercise }) {
  const [unit, setUnit] = useState<WeightUnit>('kg');
  useEffect(() => {
    let cancelled = false;
    void getSettings().then((settings) => {
      if (!cancelled) setUnit(settings.weightUnit);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useLiveQuery(async () => {
    const [sets, sessions] = await Promise.all([
      setEntryRepo.findBy('exerciseId', exercise.id),
      workoutSessionRepo.list(),
    ]);
    return { sets, sessions };
  }, [exercise.id]);

  if (!data) return null;
  const known = new Set(data.sessions.map((s) => s.id));
  const sets = data.sets.filter((s) => known.has(s.sessionId));
  const last = lastPerformance(exercise.id, sets, data.sessions);

  const heading = <h2>Mes performances</h2>;
  if (!last) {
    return (
      <Card>
        {heading}
        <p className={styles.muted}>
          Tu n’as pas encore fait cet exercice. Tes séries apparaîtront ici après ta première
          séance.
        </p>
      </Card>
    );
  }

  const records = exerciseRecords(sets, exercise.inputType);
  const kinds = RECORD_KINDS_BY_INPUT[exercise.inputType].filter((kind) => records[kind]);

  const startedAt = new Map(data.sessions.map((s) => [s.id, s.startedAt]));
  const sessionIds = [...new Set(sets.map((s) => s.sessionId))]
    .sort((a, b) => (startedAt.get(b) ?? '').localeCompare(startedAt.get(a) ?? ''))
    .slice(0, HISTORY_SIZE);

  return (
    <Card>
      {heading}
      <h3>Dernière fois</h3>
      <p className={styles.sub}>{formatDay(last.startedAt)}</p>
      <ul className={styles.history} aria-label="Séries de la dernière séance">
        {last.sets.map((set, index) => (
          <li key={set.id ?? index}>
            <span>{set.isWarmup ? 'Échauffement' : `Série ${index + 1}`}</span>
            <span>{formatSetSummary(set, exercise.inputType, unit)}</span>
          </li>
        ))}
      </ul>

      {kinds.length > 0 && (
        <>
          <h3>Records</h3>
          <div className={styles.stats}>
            {kinds.map((kind) => (
              <Stat
                key={kind}
                label={RECORD_LABELS[kind]}
                value={formatRecordValue(kind, records[kind]?.value ?? 0, unit)}
              />
            ))}
          </div>
        </>
      )}

      <h3>Historique</h3>
      <ul className={styles.history} aria-label="Historique des séances">
        {sessionIds.map((sessionId) => {
          const own = sets.filter((s) => s.sessionId === sessionId && !s.isWarmup);
          const best = own.reduce<(typeof own)[number] | null>(
            (acc, s) =>
              !acc || (s.weight ?? 0) * (s.reps ?? 1) > (acc.weight ?? 0) * (acc.reps ?? 1)
                ? s
                : acc,
            null,
          );
          const oneRm = best ? estimateOneRepMax(best.weight, best.reps) : null;
          return (
            <li key={sessionId}>
              <span className={styles.date}>{formatDay(startedAt.get(sessionId) ?? '')}</span>
              <span>
                {own.length} série{own.length > 1 ? 's' : ''}
                {best ? ` · meilleure : ${formatSetSummary(best, exercise.inputType, unit)}` : ''}
                {oneRm !== null && exercise.inputType === 'weight_reps'
                  ? ` · 1RM ≈ ${formatWeight(oneRm, unit)}`
                  : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
