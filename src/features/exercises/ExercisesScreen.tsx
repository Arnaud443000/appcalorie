import { useLiveQuery } from 'dexie-react-hooks';
import { exerciseRepo, labelOf, MUSCLE_GROUPS } from '@/data';
import { Card, EmptyState, ListRow, Screen } from '@/ui';

/** Écran provisoire (lot 0) : liste les exercices de démonstration. À remplacer par le lot Fiches. */
export function ExercisesScreen() {
  const exercises = useLiveQuery(() => exerciseRepo.list(), []);

  return (
    <Screen title="Exercices">
      {exercises && exercises.length === 0 && (
        <EmptyState icon="exercises" title="Aucun exercice" />
      )}
      {exercises && exercises.length > 0 && (
        <Card flush>
          {exercises.map((exercise) => (
            <ListRow
              key={exercise.id}
              title={exercise.name}
              subtitle={exercise.primaryMuscles.map((id) => labelOf(MUSCLE_GROUPS, id)).join(', ')}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
