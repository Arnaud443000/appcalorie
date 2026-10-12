import { useMemo, useState } from 'react';
import type { Exercise, SetEntry } from '@/data';
import { Button, Card, Chip } from '@/ui';
import {
  emptyForm,
  formatDuration,
  formatSetSummary,
  formatWeight,
  formFromSet,
  matchingLastSet,
  parseRepRange,
  prefillNextSet,
  RECORD_LABELS,
  formatRecordValue,
  suggestNextLoad,
  type ExerciseBlock,
  type InputType,
  type LastPerformance,
  type RecordBreak,
  type SetValues,
  type WeightUnit,
} from '../logic';
import { SetRow } from './SetRow';
import styles from './ExerciseBlockView.module.css';

export interface ExerciseBlockViewProps {
  block: ExerciseBlock<SetEntry>;
  /** `undefined` si l'exercice n'existe plus dans la bibliothèque. */
  exercise: Exercise | undefined;
  last: LastPerformance<SetEntry> | null;
  breaks: RecordBreak[];
  unit: WeightUnit;
  onAddSet: (values: SetValues) => Promise<void>;
  onSaveSet: (setId: string, values: SetValues) => void;
  onDeleteSet: (setId: string) => void;
  onSkip: () => void;
  onRestore: () => void;
  onReplace: () => void;
}

export function ExerciseBlockView({
  block,
  exercise,
  last,
  breaks,
  unit,
  onAddSet,
  onSaveSet,
  onDeleteSet,
  onSkip,
  onRestore,
  onReplace,
}: ExerciseBlockViewProps) {
  const inputType: InputType = exercise?.inputType ?? 'weight_reps';
  const dumbbell = exercise?.equipment.includes('dumbbell') ?? false;
  const name = exercise?.name ?? 'Exercice supprimé';
  const { item, sets } = block;
  const [appliedWeight, setAppliedWeight] = useState<number | null>(null);

  const working = sets.filter((set) => !set.isWarmup);
  const range = parseRepRange(item?.targetReps);
  const suggestion = useMemo(
    () =>
      suggestNextLoad({
        lastSets: last?.sets ?? [],
        range,
        targetSets: item?.targetSets ?? null,
        equipment: exercise?.equipment,
      }),
    [last, range, item?.targetSets, exercise?.equipment],
  );

  // Rang de chaque série enregistrée dans son type (travail / échauffement), pour « dernière fois ».
  const rows = useMemo(() => {
    const result: { set: SetEntry; label: string; rank: number }[] = [];
    let work = 0;
    let warm = 0;
    for (const set of sets) {
      if (set.isWarmup) {
        warm += 1;
        result.push({ set, label: `Échauffement ${warm}`, rank: warm - 1 });
      } else {
        work += 1;
        result.push({ set, label: `Série ${work}`, rank: work - 1 });
      }
    }
    return result;
  }, [sets]);

  if (block.skipped) {
    return (
      <Card className={styles.skipped}>
        <div className={styles.skippedRow}>
          <div>
            <h3 className={styles.name}>{name}</h3>
            <p className={styles.muted}>Passé pour aujourd’hui</p>
          </div>
          <Button variant="secondary" onClick={onRestore}>
            Rétablir
          </Button>
        </div>
      </Card>
    );
  }

  const hintFor = (isWarmup: boolean, rank: number) => {
    const prev = matchingLastSet(last, isWarmup, rank);
    return prev ? `Dernière fois : ${formatSetSummary(prev, inputType, unit)}` : undefined;
  };

  const prefill = prefillNextSet(last, working, false);
  const draftForm = {
    ...(prefill ? formFromSet(prefill, unit) : emptyForm()),
  };
  if (appliedWeight !== null)
    draftForm.weight = formFromSet({ weight: appliedWeight }, unit).weight;

  const target = item
    ? [
        `${item.targetSets} série${item.targetSets > 1 ? 's' : ''}`,
        item.targetReps ? item.targetReps : null,
        item.restSeconds ? `repos ${formatDuration(item.restSeconds)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;
  const nextIndex = working.length + 1;
  const draftLabel =
    item && nextIndex <= item.targetSets
      ? `Série ${nextIndex} / ${item.targetSets}`
      : `Série ${nextIndex}`;

  return (
    <Card className={styles.block}>
      <div className={styles.head}>
        <div className={styles.titles}>
          <h3 className={styles.name}>{name}</h3>
          {target && <p className={styles.muted}>Objectif : {target}</p>}
          {item?.note && <p className={styles.muted}>{item.note}</p>}
        </div>
        {sets.length === 0 && (
          <div className={styles.menu}>
            <Button variant="ghost" className={styles.menuButton} onClick={onReplace}>
              Remplacer
            </Button>
            <Button variant="ghost" className={styles.menuButton} onClick={onSkip}>
              Passer
            </Button>
          </div>
        )}
      </div>

      {breaks.length > 0 && (
        <ul className={styles.records} aria-label="Records battus">
          {breaks.map((record) => (
            <li key={record.kind}>
              <Chip>
                Record · {RECORD_LABELS[record.kind]} :{' '}
                {formatRecordValue(record.kind, record.value, unit)}
              </Chip>
            </li>
          ))}
        </ul>
      )}

      {suggestion.kind === 'increase' && (
        <div className={styles.suggestion}>
          <p>
            <strong>Suggestion : {formatWeight(suggestion.weight, unit)}</strong> (+
            {formatWeight(suggestion.increment, unit)}). La dernière fois, toutes tes séries ont
            atteint le haut de la fourchette ({range?.max} répétitions).
          </p>
          <Button
            variant="secondary"
            onClick={() => setAppliedWeight(suggestion.weight)}
            disabled={sets.length > 0}
          >
            Utiliser {formatWeight(suggestion.weight, unit)}
          </Button>
        </div>
      )}
      {suggestion.kind === 'keep' && suggestion.reason === 'range_not_reached' && range && (
        <p className={styles.muted}>
          Garde la même charge : atteins {range.max} répétitions sur toutes tes séries pour
          l’augmenter.
        </p>
      )}
      {range && (
        <details className={styles.rule}>
          <summary>Comment est calculée la suggestion de charge ?</summary>
          <p>
            Si toutes tes séries de travail atteignent le haut de la fourchette de répétitions du
            programme ({range.max} ici), l’appli te propose d’ajouter 2,5 kg à la séance suivante (1
            kg pour les haltères). Les échauffements ne comptent pas. Sinon, garde la même charge et
            vise le haut de la fourchette.
          </p>
        </details>
      )}

      <div className={styles.rows}>
        {rows.map(({ set, label, rank }) => (
          <SetRow
            key={set.id}
            mode="saved"
            label={label}
            inputType={inputType}
            unit={unit}
            dumbbell={dumbbell}
            initial={formFromSet(set, unit)}
            hint={hintFor(set.isWarmup, rank)}
            onSave={(values) => onSaveSet(set.id, values)}
            onDelete={() => onDeleteSet(set.id)}
          />
        ))}
        <SetRow
          // Nouvelle ligne (et nouveau pré-remplissage) après chaque série validée.
          key={`draft-${sets.length}-${last?.sessionId ?? ''}-${appliedWeight ?? ''}`}
          mode="draft"
          label={draftLabel}
          inputType={inputType}
          unit={unit}
          dumbbell={dumbbell}
          initial={draftForm}
          hint={hintFor(false, working.length)}
          onSubmit={onAddSet}
        />
      </div>
    </Card>
  );
}
