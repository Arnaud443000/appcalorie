import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';
import styles from './Screen.module.css';

export interface ScreenProps {
  title: string;
  /** Lien de retour affiché à gauche du titre. */
  backTo?: string;
  /** Action en haut à droite (ex. bouton Réglages). */
  action?: ReactNode;
  children: ReactNode;
}

/** Mise en page d'un écran : en-tête + contenu, avec marges de zones sûres. */
export function Screen({ title, backTo, action, children }: ScreenProps) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        {backTo && (
          <Link to={backTo} className={styles.iconButton} aria-label="Retour">
            <Icon name="back" />
          </Link>
        )}
        <h1 className={styles.title}>{title}</h1>
        {action && <div className={styles.action}>{action}</div>}
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
