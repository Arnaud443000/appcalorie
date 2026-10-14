import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router';
import {
  EQUIPMENT,
  EXERCISE_LEVELS,
  exerciseRepo,
  getExerciseImages,
  labelOf,
  MUSCLE_GROUPS,
  type ExerciseImages,
} from '@/data';
import { Card, Chip, EmptyState, Screen } from '@/ui';
import { atlasPath } from './atlas';
import { ImagePlayer } from './ImagePlayer';
import { MyPerformance } from './MyPerformance';
import { parseVariation } from './variations';
import styles from './ExerciseDetailScreen.module.css';

/** Fiche détail d'un exercice. */
export function ExerciseDetailScreen() {
  const { exerciseId = '' } = useParams();
  const all = useLiveQuery(() => exerciseRepo.list(), []);
  const exercise = all?.find((e) => e.id === exerciseId);
  const [images, setImages] = useState<ExerciseImages | null>(null);

  useEffect(() => {
    if (!exercise) return;
    let cancelled = false;
    void getExerciseImages(exercise).then((found) => {
      if (!cancelled) setImages(found);
    });
    return () => {
      cancelled = true;
    };
  }, [exercise]);

  if (!all)
    return (
      <Screen title="Exercice" backTo="/exercices">
        {null}
      </Screen>
    );
  if (!exercise) {
    return (
      <Screen title="Exercice" backTo="/exercices">
        <EmptyState
          icon="exercises"
          title="Exercice introuvable"
          message="Cette fiche n’existe plus."
          action={
            <Link to="/exercices" className={styles.link}>
              Retour aux exercices
            </Link>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen title={exercise.name} backTo="/exercices">
      <div className={styles.detail}>
        <div className={styles.meta}>
          <Chip>{labelOf(EXERCISE_LEVELS, exercise.level)}</Chip>
          {exercise.equipment.map((id) => (
            <Chip key={id}>{labelOf(EQUIPMENT, id)}</Chip>
          ))}
        </div>

        {images && <ImagePlayer key={exercise.id} images={images} name={exercise.name} />}

        <Card>
          <h2 className={styles.sectionTitle}>Muscles travaillés</h2>
          <div className={styles.meta}>
            {exercise.primaryMuscles.map((id) => (
              <span key={id} className={styles.primary} data-muscle="primary">
                <Chip>{labelOf(MUSCLE_GROUPS, id)}</Chip>
              </span>
            ))}
            {exercise.secondaryMuscles.map((id) => (
              <span key={id} className={styles.secondary} data-muscle="secondary">
                <Chip>{labelOf(MUSCLE_GROUPS, id)}</Chip>
              </span>
            ))}
          </div>
          <p className={styles.note}>Rouge : muscles principaux. Rose : muscles secondaires.</p>
          <Link to={atlasPath('/exercices/atlas', { exerciseId: exercise.id })}>
            Voir sur l’Atlas 3D
          </Link>
        </Card>

        {exercise.steps.length > 0 && (
          <Card>
            <h2 className={styles.sectionTitle}>Exécution</h2>
            <ol className={styles.list}>
              {exercise.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </Card>
        )}

        {exercise.mistakes.length > 0 && (
          <Card>
            <h2 className={styles.sectionTitle}>Erreurs à éviter</h2>
            <ul className={styles.list}>
              {exercise.mistakes.map((mistake, index) => (
                <li key={index}>{mistake}</li>
              ))}
            </ul>
          </Card>
        )}

        {(exercise.loadAdvice || exercise.safety) && (
          <Card>
            {exercise.loadAdvice && (
              <>
                <h2 className={styles.sectionTitle}>Charge conseillée</h2>
                <p className={styles.note}>{exercise.loadAdvice}</p>
              </>
            )}
            {exercise.safety && (
              <>
                <h2 className={styles.sectionTitle}>Sécurité</h2>
                <p className={styles.note}>{exercise.safety}</p>
              </>
            )}
          </Card>
        )}

        {exercise.variations.length > 0 && (
          <Card>
            <h2 className={styles.sectionTitle}>Variantes</h2>
            <ul className={styles.variations}>
              {exercise.variations.map((text, index) => {
                const variation = parseVariation(text, all);
                return (
                  <li key={index}>
                    {variation.kind && <span className={styles.kind}>{variation.kind} : </span>}
                    {variation.target ? (
                      <Link to={`/exercices/${variation.target.id}`} className={styles.link}>
                        {variation.target.name}
                      </Link>
                    ) : (
                      <span className={styles.plain}>{variation.name}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <MyPerformance exercise={exercise} />
      </div>
    </Screen>
  );
}
