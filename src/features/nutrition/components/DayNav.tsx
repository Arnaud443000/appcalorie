import { Icon } from '@/ui';
import { addDays, dayTitle, isValidDay, todayDay } from '../logic';
import styles from './DayNav.module.css';

export interface DayNavProps {
  day: string;
  onChange: (day: string) => void;
}

/** Navigation entre les jours : précédent, suivant, choix d'une date. */
export function DayNav({ day, onChange }: DayNavProps) {
  const today = todayDay();
  return (
    <div className={styles.nav}>
      <button
        type="button"
        className={styles.arrow}
        aria-label="Jour précédent"
        onClick={() => onChange(addDays(day, -1))}
      >
        <Icon name="back" />
      </button>
      <div className={styles.center}>
        <span className={styles.title}>{dayTitle(day, today)}</span>
        {/* Le champ date couvre le titre : un toucher ouvre le sélecteur de date du téléphone. */}
        <input
          type="date"
          className={styles.picker}
          aria-label="Choisir une date"
          value={day}
          onChange={(event) => {
            if (isValidDay(event.target.value)) onChange(event.target.value);
          }}
        />
      </div>
      <button
        type="button"
        className={styles.arrow}
        aria-label="Jour suivant"
        onClick={() => onChange(addDays(day, 1))}
      >
        <Icon name="chevron" />
      </button>
      {day !== today && (
        <button type="button" className={styles.today} onClick={() => onChange(today)}>
          Aujourd’hui
        </button>
      )}
    </div>
  );
}
