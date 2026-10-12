import styles from './Stat.module.css';

export interface StatProps {
  label: string;
  value: string | number;
  unit?: string;
}

/** Chiffre clé : grande valeur + libellé. */
export function Stat({ label, value, unit }: StatProps) {
  return (
    <div className={styles.stat}>
      <span className={styles.value}>
        {value}
        {unit && <span className={styles.unit}> {unit}</span>}
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
