import type { ReactNode } from 'react';
import styles from './Chip.module.css';

export interface ChipProps {
  children: ReactNode;
  /** Si fourni, la puce devient un bouton à bascule. */
  onClick?: () => void;
  selected?: boolean;
}

export function Chip({ children, onClick, selected = false }: ChipProps) {
  const classes = [styles.chip, selected && styles.selected].filter(Boolean).join(' ');
  if (!onClick) {
    return <span className={classes}>{children}</span>;
  }
  return (
    <button type="button" className={classes} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}
