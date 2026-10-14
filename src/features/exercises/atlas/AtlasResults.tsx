import { EQUIPMENT, labelOf, MUSCLE_GROUPS, type Exercise, type MuscleGroupId } from '@/data';
import { Card, Chip, EmptyState, ListRow } from '@/ui';
import styles from './AtlasResults.module.css';
import { exercisePath } from './params';

const groupLabel = (id: MuscleGroupId) => labelOf(MUSCLE_GROUPS, id);
const groupList = (ids: readonly MuscleGroupId[]) => ids.map(groupLabel).join(', ');

function ExerciseList({
  title,
  exercises,
  subtitle,
}: {
  title: string;
  exercises: readonly Exercise[];
  subtitle: (exercise: Exercise) => string;
}) {
  if (exercises.length === 0) return null;
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>
        {title} <span className={styles.count}>{exercises.length}</span>
      </h3>
      <Card flush>
        {exercises.map((exercise) => (
          <ListRow
            key={exercise.id}
            title={exercise.name}
            subtitle={subtitle(exercise)}
            to={exercisePath(exercise.id)}
          />
        ))}
      </Card>
    </section>
  );
}

export function GroupResults({
  group,
  primary,
  secondary,
  synergists,
}: {
  group: MuscleGroupId;
  primary: readonly Exercise[];
  secondary: readonly Exercise[];
  synergists: readonly MuscleGroupId[];
}) {
  if (primary.length === 0 && secondary.length === 0) {
    return (
      <EmptyState
        icon="exercises"
        title="Aucun exercice"
        message={`Aucune fiche ne travaille encore ce muscle (${groupLabel(group).toLowerCase()}).`}
      />
    );
  }
  return (
    <>
      {synergists.length > 0 && (
        <p className={styles.note}>
          <span className={styles.dotSecondary} aria-hidden="true" />
          Souvent sollicités avec : {groupList(synergists)}
        </p>
      )}
      <ExerciseList
        title="Muscle principal"
        exercises={primary}
        subtitle={(exercise) =>
          exercise.equipment.map((id) => labelOf(EQUIPMENT, id)).join(' · ') || 'Sans matériel'
        }
      />
      <ExerciseList
        title="Muscle secondaire"
        exercises={secondary}
        subtitle={(exercise) => `Surtout : ${groupList(exercise.primaryMuscles)}`}
      />
    </>
  );
}

export function ExerciseResults({ exercise }: { exercise: Exercise }) {
  const secondary = exercise.secondaryMuscles.filter((id) => !exercise.primaryMuscles.includes(id));
  return (
    <>
      <section className={styles.section}>
        <h3 className={styles.heading}>
          <span className={styles.dotPrimary} aria-hidden="true" />
          Muscles principaux
        </h3>
        <div className={styles.chips}>
          {exercise.primaryMuscles.map((id) => (
            <Chip key={id}>{groupLabel(id)}</Chip>
          ))}
        </div>
      </section>
      {secondary.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>
            <span className={styles.dotSecondary} aria-hidden="true" />
            Muscles secondaires
          </h3>
          <div className={styles.chips}>
            {secondary.map((id) => (
              <Chip key={id}>{groupLabel(id)}</Chip>
            ))}
          </div>
        </section>
      )}
      <Card flush>
        <ListRow title="Voir la fiche" to={exercisePath(exercise.id)} />
      </Card>
    </>
  );
}

export function Credits() {
  return (
    <p className={styles.credits}>
      Modèle 3D : BodyParts3D, © The Database Center for Life Science, licence CC BY-SA 2.1 JP. Le
      grand dorsal est reconstruit ; les abdos sont figurés par les obliques et les dentelés.
    </p>
  );
}
