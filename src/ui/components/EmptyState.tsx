import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  /** Bouton ou lien proposé à l'utilisateur. */
  action?: ReactNode;
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {icon && <Icon name={icon} size={40} className={styles.icon} />}
      <h2 className={styles.title}>{title}</h2>
      {message && <p className={styles.message}>{message}</p>}
      {action}
    </div>
  );
}
