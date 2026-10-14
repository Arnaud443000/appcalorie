import { useMemo, useState } from 'react';
import { labelOf, MUSCLE_GROUPS, type Exercise } from '@/data';
import { EmptyState, Input, ListRow, Sheet } from '@/ui';
import styles from './ExerciseSearchSheet.module.css';

export interface ExerciseListProps {
  onPick: (exercise: Exercise) => void;
  exercises: readonly Exercise[];
  /** Nombre de séances par exercice : ceux qui ont un historique passent en premier. */
  sessionCounts: ReadonlyMap<string, number>;
  /** Écarte des exercices (ex. ceux dont la charge ne se mesure pas). */
  filter?: (exercise: Exercise) => boolean;
}

export interface ExerciseSearchSheetProps extends ExerciseListProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Recherche d'un exercice par nom ou alias (champ + liste), utilisable dans une feuille ou une page. */
export function ExerciseList({ onPick, exercises, sessionCounts, filter }: ExerciseListProps) {
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    return exercises
      .filter((exercise) => (filter ? filter(exercise) : true))
      .filter(
        (exercise) =>
          q === '' || normalize([exercise.name, ...exercise.aliases].join(' ')).includes(q),
      )
      .sort(
        (a, b) =>
          (sessionCounts.get(b.id) ?? 0) - (sessionCounts.get(a.id) ?? 0) ||
          a.name.localeCompare(b.name, 'fr'),
      );
  }, [exercises, filter, query, sessionCounts]);

  return (
    <div className={styles.body}>
      <Input
        label="Rechercher"
        type="search"
        value={query}
        placeholder="Nom de l’exercice"
        onChange={(event) => setQuery(event.target.value)}
      />
      {exercises.length === 0 ? (
        <EmptyState
          title="Aucun exercice"
          message="Ajoute des exercices dans l’onglet Exercices, puis reviens ici."
        />
      ) : shown.length === 0 ? (
        <p className={styles.none}>Aucun exercice ne correspond.</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((exercise) => {
            const count = sessionCounts.get(exercise.id) ?? 0;
            return (
              <li key={exercise.id}>
                <ListRow
                  title={exercise.name}
                  subtitle={
                    count > 0
                      ? `${count} séance${count > 1 ? 's' : ''} · ${exercise.primaryMuscles.map((m) => labelOf(MUSCLE_GROUPS, m)).join(', ')}`
                      : 'Pas encore d’historique'
                  }
                  onClick={() => onPick(exercise)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Feuille de choix d'un exercice. Le champ de recherche repart de zéro à chaque ouverture. */
export function ExerciseSearchSheet({
  open,
  onClose,
  title = 'Choisir un exercice',
  ...list
}: ExerciseSearchSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ExerciseList {...list} />
    </Sheet>
  );
}
