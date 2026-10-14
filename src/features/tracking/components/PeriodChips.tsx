import { Chip } from '@/ui';
import { PERIODS, type PeriodId } from '../logic';
import styles from './PeriodChips.module.css';

export interface PeriodChipsProps {
  value: PeriodId;
  onChange: (period: PeriodId) => void;
}

/** Choix de la période affichée : 7 jours · 30 jours · 3 mois · 6 mois · 1 an · tout. */
export function PeriodChips({ value, onChange }: PeriodChipsProps) {
  return (
    <div role="group" aria-label="Période" className={styles.chips}>
      {PERIODS.map((period) => (
        <Chip key={period.id} selected={period.id === value} onClick={() => onChange(period.id)}>
          {period.label}
        </Chip>
      ))}
    </div>
  );
}
