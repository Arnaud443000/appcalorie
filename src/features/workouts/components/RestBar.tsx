import { Button } from '@/ui';
import { formatClock } from '@/data';
import type { RestTimer } from '../hooks/useRestTimer';
import styles from './RestBar.module.css';

/** Barre de repos collée au-dessus de la barre d'onglets. */
export function RestBar({ timer }: { timer: RestTimer }) {
  const { state, remaining, progress, finished, late } = timer;
  if (!state) return null;

  return (
    <div className={styles.bar} role="group" aria-label="Chrono de repos">
      <div
        className={[styles.fill, finished && styles.done].filter(Boolean).join(' ')}
        style={{ transform: `scaleX(${finished ? 1 : progress})` }}
        aria-hidden="true"
      />
      <div className={styles.content}>
        {finished ? (
          <p className={styles.text} role="status">
            <strong>Repos terminé</strong>
            {late >= 5 && <span className={styles.late}> depuis {formatClock(late)}</span>}
          </p>
        ) : (
          <p className={styles.text}>
            <span className={styles.caption}>Repos </span>
            <strong className={styles.clock} role="timer" aria-live="off">
              {formatClock(remaining)}
            </strong>
          </p>
        )}
        <div className={styles.buttons}>
          <Button variant="secondary" className={styles.btn} onClick={() => timer.adjust(-15)}>
            −15 s
          </Button>
          <Button variant="secondary" className={styles.btn} onClick={() => timer.adjust(15)}>
            +15 s
          </Button>
          <Button
            variant={finished ? 'primary' : 'ghost'}
            className={styles.btn}
            onClick={timer.stop}
          >
            {finished ? 'OK' : 'Passer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
