import { Chip } from '@/ui';
import { formatField } from '@/data';
import { quickPortions } from '../logic';
import styles from './QuickPortions.module.css';

export interface QuickPortionsProps {
  servingG: number | null;
  /** Grammes actuellement saisis (texte) : la portion correspondante est mise en avant. */
  value: string;
  onPick: (grams: string) => void;
}

/** Portions rapides : portion habituelle de l'aliment, puis 50 / 100 / 150 / 200 g. */
export function QuickPortions({ servingG, value, onPick }: QuickPortionsProps) {
  return (
    <div className={styles.row} role="group" aria-label="Portions rapides">
      {quickPortions(servingG).map(({ grams, label }) => (
        <Chip
          key={grams}
          selected={value === formatField(grams)}
          onClick={() => onPick(formatField(grams))}
        >
          {label}
        </Chip>
      ))}
    </div>
  );
}
