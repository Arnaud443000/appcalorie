import { useMemo, useState } from 'react';
import {
  GOAL_TYPES,
  goalRepo,
  parseDecimal,
  type Exercise,
  type Goal,
  type GoalTypeId,
} from '@/data';
import { Button, Chip, Input, NumberStepper, Sheet, useToast } from '@/ui';
import {
  bodySeries,
  exerciseSessionStats,
  LOAD_GOAL_INPUTS,
  MEASURE_KEYS,
  metricSeries,
  type Day,
} from '../logic';
import {
  calorieQuantity,
  lengthQuantity,
  toFieldText,
  weightQuantity,
  type Quantity,
} from '../format';
import type { TrackingData } from '../data/useTrackingData';
import { ExerciseList } from './ExerciseSearchSheet';
import styles from './GoalSheet.module.css';

type MeasurementKey = NonNullable<Goal['measurement']>;

export interface GoalSheetProps {
  open: boolean;
  onClose: () => void;
  data: TrackingData;
  /** Objectif à modifier, ou `null` pour en créer un. */
  goal: Goal | null;
  sessionCounts: ReadonlyMap<string, number>;
}

const TYPE_HINTS: Record<GoalTypeId, string> = {
  weight: 'Atteindre un poids de corps.',
  load: 'Soulever une charge cible sur un exercice.',
  measurement: 'Atteindre une mensuration (taille, bras…).',
  calories: 'Tenir une moyenne de calories par jour.',
};

const isLoadExercise = (exercise: Exercise) => LOAD_GOAL_INPUTS.includes(exercise.inputType);

function Form({ onClose, data, goal, sessionCounts }: Omit<GoalSheetProps, 'open'>) {
  const toast = useToast();
  const { today } = data;
  const editing = goal !== null;

  const [type, setType] = useState<GoalTypeId>(goal?.type ?? 'weight');
  const [exerciseId, setExerciseId] = useState<string | null>(goal?.exerciseId ?? null);
  const [measurement, setMeasurement] = useState<MeasurementKey>(goal?.measurement ?? 'waist');
  const [typed, setTyped] = useState<string | null>(
    goal ? toFieldText(quantityFor(goal.type, data), goal.targetValue) : null,
  );
  const [date, setDate] = useState<Day>(goal?.targetDate ?? '');
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const quantity = quantityFor(type, data);

  // Valeur proposée tant que rien n'est tapé : la valeur actuelle, pour n'ajuster que de quelques crans.
  const suggestion = useMemo(() => {
    if (type === 'calories') return 2000;
    if (type === 'weight') return bodySeries(data.metrics, 'weight').at(-1)?.value ?? null;
    if (type === 'measurement') return bodySeries(data.metrics, measurement).at(-1)?.value ?? null;
    if (!exerciseId) return null;
    const sets = data.sets.filter((s) => s.exerciseId === exerciseId);
    const series = metricSeries(exerciseSessionStats(sets, data.sessionDays), 'maxWeight');
    return Math.max(0, ...series.map((p) => p.value)) || null;
  }, [type, measurement, exerciseId, data]);

  const text = typed ?? toFieldText(quantity, suggestion);
  const exercise = exerciseId ? data.exerciseById.get(exerciseId) : undefined;

  async function save() {
    if (type === 'load' && !exerciseId) {
      setError('Choisis l’exercice concerné.');
      return;
    }
    const shown = parseDecimal(text);
    if (shown === null || shown <= 0) {
      setError('Entre une valeur cible supérieure à 0.');
      return;
    }
    if (date && date < today && date !== goal?.targetDate) {
      setError('La date cible doit être aujourd’hui ou plus tard.');
      return;
    }
    const input = {
      type,
      targetValue: quantity.fromDisplay(shown),
      targetDate: date || null,
      exerciseId: type === 'load' ? exerciseId : null,
      measurement: type === 'measurement' ? measurement : null,
    };
    setBusy(true);
    try {
      if (goal) await goalRepo.update(goal.id, input);
      else await goalRepo.create(input);
      toast.show(editing ? 'Objectif modifié' : 'Objectif créé');
      onClose();
    } catch {
      setError('Impossible d’enregistrer pour le moment. Réessaie.');
      setBusy(false);
    }
  }

  async function remove() {
    if (!goal) return;
    setBusy(true);
    try {
      await goalRepo.remove(goal.id);
      toast.show('Objectif supprimé');
      onClose();
    } catch {
      setError('Impossible de supprimer pour le moment. Réessaie.');
      setBusy(false);
    }
  }

  if (picking) {
    return (
      <div className={styles.form}>
        <Button variant="ghost" onClick={() => setPicking(false)}>
          ← Retour à l’objectif
        </Button>
        <ExerciseList
          exercises={data.exercises}
          sessionCounts={sessionCounts}
          filter={isLoadExercise}
          onPick={(picked) => {
            setExerciseId(picked.id);
            setTyped(null);
            setPicking(false);
          }}
        />
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className={styles.group}>
        <span className={styles.groupLabel}>Type d’objectif</span>
        <div className={styles.chips} role="group" aria-label="Type d’objectif">
          {GOAL_TYPES.map((t) => (
            <Chip
              key={t.id}
              selected={t.id === type}
              onClick={() => {
                setType(t.id);
                setTyped(null);
                setError(null);
              }}
            >
              {t.label}
            </Chip>
          ))}
        </div>
        <p className={styles.hint}>{TYPE_HINTS[type]}</p>
      </div>

      {type === 'load' && (
        <div className={styles.group}>
          <span className={styles.groupLabel}>Exercice</span>
          <Button variant="secondary" block onClick={() => setPicking(true)}>
            {exercise ? exercise.name : 'Choisir un exercice'}
          </Button>
        </div>
      )}

      {type === 'measurement' && (
        <div className={styles.group}>
          <span className={styles.groupLabel}>Mesure</span>
          <div className={styles.chips} role="group" aria-label="Mesure">
            {MEASURE_KEYS.map((m) => (
              <Chip
                key={m.id}
                selected={m.id === measurement}
                onClick={() => {
                  setMeasurement(m.id);
                  setTyped(null);
                }}
              >
                {m.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <NumberStepper
        label={`Valeur cible (${type === 'calories' ? 'kcal par jour' : quantity.unit})`}
        value={text}
        step={quantity.step}
        min={0}
        onChange={(value) => {
          setTyped(value);
          setError(null);
        }}
      />

      <div className={styles.group}>
        <Input
          label="Date cible (facultatif)"
          type="date"
          value={date}
          min={today}
          hint="Avec une date, tu sauras si tu es en avance, dans les temps ou en retard."
          onChange={(event) => setDate(event.target.value)}
        />
        {date && (
          <Button variant="ghost" onClick={() => setDate('')}>
            Retirer la date cible
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button type="submit" block disabled={busy}>
        {editing ? 'Enregistrer' : 'Créer l’objectif'}
      </Button>

      {editing &&
        (confirming ? (
          <div className={styles.confirm} role="group" aria-label="Confirmer la suppression">
            <p className={styles.confirmText}>Supprimer cet objectif ?</p>
            <div className={styles.confirmButtons}>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                Annuler
              </Button>
              <Button variant="secondary" onClick={() => void remove()} disabled={busy}>
                Oui, supprimer
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" block onClick={() => setConfirming(true)}>
            Supprimer l’objectif
          </Button>
        ))}
    </form>
  );
}

function quantityFor(type: GoalTypeId, data: TrackingData): Quantity {
  switch (type) {
    case 'weight':
    case 'load':
      return weightQuantity(data.weightUnit);
    case 'measurement':
      return lengthQuantity(data.lengthUnit);
    case 'calories':
      return calorieQuantity;
  }
}

/** Création ou modification d'un objectif. */
export function GoalSheet({ open, goal, ...rest }: GoalSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={rest.onClose}
      title={goal ? 'Modifier l’objectif' : 'Nouvel objectif'}
    >
      <Form goal={goal} {...rest} />
    </Sheet>
  );
}
