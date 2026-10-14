import styles from './ProgressBar.module.css';

export interface ProgressBarProps {
  label: string;
  value: number;
  /** Objectif ; sans objectif la barre reste vide. */
  target: number | null;
  /** Texte lu par les lecteurs d'écran, ex. « 1 250 sur 2 000 kcal ». */
  valueText: string;
}

/** Barre de progression d'un nutriment par rapport à son objectif. */
export function ProgressBar({ label, value, target, valueText }: ProgressBarProps) {
  const ratio = target && target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  const over = target !== null && target > 0 && value > target;
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target ?? undefined}
      aria-valuenow={Math.round(value)}
      aria-valuetext={valueText}
    >
      <div
        className={[styles.fill, over && styles.over].filter(Boolean).join(' ')}
        style={{ width: `${Math.round(ratio * 100)}%` }}
      />
    </div>
  );
}
