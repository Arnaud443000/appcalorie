import { Chip } from '@/ui';
import { SOURCE_LABELS } from '../format';
import type { Food } from '@/data';
import styles from './FoodTag.module.css';

/** Badge « Moyenne » + niveau de confiance pour un aliment calculé, sinon rien. */
export function AverageBadge({ food }: { food: Pick<Food, 'source' | 'average'> }) {
  if (food.source !== 'average') return null;
  return (
    <span className={styles.badge}>
      <Chip>{SOURCE_LABELS.average}</Chip>
      {food.average && (
        <span className={styles.count}>
          {food.average.sourceCount} produit{food.average.sourceCount > 1 ? 's' : ''}
        </span>
      )}
    </span>
  );
}
