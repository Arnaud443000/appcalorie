import { useEffect, useState } from 'react';
import { getExerciseImages, type Exercise } from '@/data';
import { Icon } from '@/ui';
import styles from './ExerciseThumb.module.css';

/** Miniature (image « départ ») ou pastille d'icône quand l'exercice n'a pas d'image. */
export function ExerciseThumb({ exercise }: { exercise: Pick<Exercise, 'imageSlug' | 'name'> }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getExerciseImages(exercise).then((images) => {
      if (cancelled) return;
      setSrc(images.kind === 'pair' ? images.start : images.kind === 'single' ? images.src : null);
    });
    return () => {
      cancelled = true;
    };
  }, [exercise]);

  if (!src) {
    return (
      <span className={`${styles.thumb} ${styles.empty}`} aria-hidden="true">
        <Icon name="exercises" size={22} />
      </span>
    );
  }
  return (
    <span className={styles.thumb}>
      <img src={src} alt="" loading="lazy" decoding="async" />
    </span>
  );
}
