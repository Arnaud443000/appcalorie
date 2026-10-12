import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';
import styles from './ListRow.module.css';

export interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Élément à gauche (icône, vignette). */
  leading?: ReactNode;
  /** Élément à droite (valeur, puce). */
  trailing?: ReactNode;
  /** Lien interne : la ligne devient cliquable. */
  to?: string;
  onClick?: () => void;
}

export function ListRow({ title, subtitle, leading, trailing, to, onClick }: ListRowProps) {
  const interactive = Boolean(to || onClick);
  const content = (
    <>
      {leading && <span className={styles.leading}>{leading}</span>}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
      {interactive && <Icon name="chevron" size={18} className={styles.chevron} />}
    </>
  );
  const className = [styles.row, interactive && styles.interactive].filter(Boolean).join(' ');

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
