import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Surface plus claire, pour une carte posée dans une carte. */
  raised?: boolean;
  /** Sans marge intérieure : pour une liste de ListRow. */
  flush?: boolean;
}

export function Card({ raised = false, flush = false, className, ...rest }: CardProps) {
  const classes = [styles.card, raised && styles.raised, flush && styles.flush, className]
    .filter(Boolean)
    .join(' ');
  return <section className={classes} {...rest} />;
}
