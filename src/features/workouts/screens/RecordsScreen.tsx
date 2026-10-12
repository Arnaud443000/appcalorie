import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, EmptyState, Screen, Stat } from '@/ui';
import { loadEverything } from '../data';
import { useExercises } from '../hooks/useExercises';
import { useWeightUnit } from '../hooks/useSettings';
import { PATHS } from '../paths';
import { exerciseRecords, formatRecordValue, RECORD_KINDS_BY_INPUT, RECORD_LABELS } from '@/data';
import styles from './RecordsScreen.module.css';

/** Records personnels par exercice (échauffements exclus). */
export function RecordsScreen() {
  const data = useLiveQuery(loadEverything, []);
  const exercises = useExercises();
  const unit = useWeightUnit();

  const entries = useMemo(() => {
    if (!data || !exercises) return null;
    const byExercise = new Map<string, typeof data.sets>();
    for (const set of data.sets) {
      const list = byExercise.get(set.exerciseId);
      if (list) list.push(set);
      else byExercise.set(set.exerciseId, [set]);
    }
    return [...byExercise]
      .map(([exerciseId, sets]) => {
        const exercise = exercises.byId.get(exerciseId);
        const inputType = exercise?.inputType ?? 'weight_reps';
        return {
          exerciseId,
          name: exercise?.name ?? 'Exercice supprimé',
          kinds: RECORD_KINDS_BY_INPUT[inputType],
          records: exerciseRecords(sets, inputType),
        };
      })
      .filter((entry) => Object.keys(entry.records).length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [data, exercises]);

  return (
    <Screen title="Records" backTo={PATHS.home}>
      {entries && entries.length === 0 && (
        <EmptyState
          icon="workout"
          title="Pas encore de record"
          message="Note quelques séries : tes meilleures performances apparaîtront ici."
        />
      )}
      {entries?.map((entry) => (
        <Card key={entry.exerciseId} className={styles.card}>
          <h2 className={styles.name}>{entry.name}</h2>
          <div className={styles.grid}>
            {entry.kinds.map((kind) => {
              const record = entry.records[kind];
              return (
                <Stat
                  key={kind}
                  label={RECORD_LABELS[kind]}
                  value={record ? formatRecordValue(kind, record.value, unit) : '—'}
                />
              );
            })}
          </div>
        </Card>
      ))}
      <p className={styles.muted}>
        Le 1RM est une estimation (formule d’Epley : charge × (1 + répétitions ÷ 30)). Le volume max
        est le meilleur total « charge × répétitions » d’un exercice sur une séance. Les
        échauffements ne comptent pas.
      </p>
    </Screen>
  );
}
