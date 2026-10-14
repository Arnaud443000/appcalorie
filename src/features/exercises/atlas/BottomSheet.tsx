import { useId, type ReactNode } from 'react';
import { Icon } from '@/ui';
import styles from './BottomSheet.module.css';

export interface BottomSheetProps {
  title: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * Feuille du bas non modale : repliée, elle montre le titre et un résumé sans cacher le corps ;
 * dépliée, elle monte par-dessus la vue 3D avec la liste complète.
 */
export function BottomSheet({ title, summary, open, onToggle, children }: BottomSheetProps) {
  const bodyId = useId();
  return (
    <section
      className={styles.sheet}
      data-open={open}
      aria-label={title}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') onToggle();
      }}
    >
      <div className={styles.header} onClick={onToggle}>
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.row}>
          <div className={styles.text}>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.summary} aria-live="polite">
              {summary}
            </p>
          </div>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            {open ? 'Réduire' : 'Voir'}
            <Icon name="chevron" size={18} className={styles.chevron} />
          </button>
        </div>
      </div>
      <div id={bodyId} className={styles.body} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
