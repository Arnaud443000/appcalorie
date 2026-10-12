import { useMemo, useState } from 'react';
import { labelOf, MUSCLE_GROUPS, type Exercise } from '@/data';
import { EmptyState, Input, ListRow, Sheet } from '@/ui';
import { useExercises } from '../hooks/useExercises';
import styles from './ExercisePicker.module.css';

export interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  title?: string;
  /** Exercices à ne pas proposer (déjà dans la séance). */
  excludeIds?: readonly string[];
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Sélecteur d'exercice (propre au lot Entraînement) : recherche par nom ou alias. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Choisir un exercice',
  excludeIds = [],
}: ExercisePickerProps) {
  const exercises = useExercises();
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    const excluded = new Set(excludeIds);
    return (exercises?.list ?? []).filter(
      (exercise) =>
        !excluded.has(exercise.id) &&
        (q === '' || normalize([exercise.name, ...exercise.aliases].join(' ')).includes(q)),
    );
  }, [exercises, excludeIds, query]);

  function close() {
    setQuery('');
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} title={title}>
      <div className={styles.body}>
        <Input
          label="Rechercher"
          type="search"
          value={query}
          placeholder="Nom de l’exercice"
          onChange={(event) => setQuery(event.target.value)}
        />
        {exercises && exercises.list.length === 0 ? (
          <EmptyState
            title="Aucun exercice"
            message="Ajoute des exercices dans l’onglet Exercices, puis reviens ici."
          />
        ) : shown.length === 0 ? (
          <p className={styles.none}>Aucun exercice ne correspond.</p>
        ) : (
          <ul className={styles.list}>
            {shown.map((exercise) => (
              <li key={exercise.id}>
                <ListRow
                  title={exercise.name}
                  subtitle={exercise.primaryMuscles
                    .map((muscle) => labelOf(MUSCLE_GROUPS, muscle))
                    .join(', ')}
                  onClick={() => {
                    setQuery('');
                    onPick(exercise);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
