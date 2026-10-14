import { formatNumber } from '@/data';
import type { Food, FoodLogEntry } from '@/data';
import { Button, Card, Icon } from '@/ui';
import { gramsText, kcalText, macrosText } from '../format';
import { nutritionFor, roundNutrition, totalsOf } from '../logic';
import { AverageBadge } from './FoodTag';
import styles from './MealSection.module.css';

export interface MealSectionProps {
  label: string;
  entries: FoodLogEntry[];
  foods: ReadonlyMap<string, Food>;
  onAdd: () => void;
  onAddSavedMeal: () => void;
  onSaveAsMeal: () => void;
  onEdit: (entry: FoodLogEntry) => void;
  onRemove: (entry: FoodLogEntry) => void;
}

/** Fourchette de calories d'une moyenne, pour la quantité mangée (ex. « entre 158 et 177 kcal »). */
function averageRange(food: Food, grams: number): string | null {
  const range = food.average?.ranges['kcal'];
  if (!range) return null;
  const k = grams / 100;
  return `entre ${formatNumber(Math.round(range.min * k))} et ${formatNumber(Math.round(range.max * k))} kcal`;
}

/** Un repas du journal : lignes d'aliments, total, et actions. */
export function MealSection({
  label,
  entries,
  foods,
  onAdd,
  onAddSavedMeal,
  onSaveAsMeal,
  onEdit,
  onRemove,
}: MealSectionProps) {
  const total = roundNutrition(totalsOf(entries, foods));
  return (
    <Card flush aria-label={label} className={styles.section}>
      <header className={styles.head}>
        <h2 className={styles.title}>{label}</h2>
        <span className={styles.total}>{kcalText(total.kcal)}</span>
      </header>

      {entries.length > 0 && (
        <ul className={styles.list}>
          {entries.map((entry) => {
            const food = foods.get(entry.foodId);
            if (!food) return null;
            const n = roundNutrition(nutritionFor(food, entry.grams));
            const range = averageRange(food, entry.grams);
            return (
              <li key={entry.id} className={styles.entry}>
                <button
                  type="button"
                  className={styles.main}
                  aria-label={`Modifier ${food.name}`}
                  onClick={() => onEdit(entry)}
                >
                  <span className={styles.name}>
                    {food.name}
                    {food.brand ? ` · ${food.brand}` : ''}
                  </span>
                  <span className={styles.detail}>
                    {gramsText(entry.grams)} · {kcalText(n.kcal)} · {macrosText(n)}
                  </span>
                  {food.source === 'average' && (
                    <span className={styles.average}>
                      <AverageBadge food={food} />
                      {range && <span className={styles.detail}>{range}</span>}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Supprimer ${food.name}`}
                  onClick={() => onRemove(entry)}
                >
                  <Icon name="trash" size={20} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {entries.length === 0 && <p className={styles.empty}>Rien de saisi pour ce repas.</p>}

      <div className={styles.actions}>
        <Button variant="secondary" className={styles.action} onClick={onAdd}>
          <Icon name="plus" size={18} />
          Ajouter un aliment
          <span className={styles.hidden}> à {label}</span>
        </Button>
        <Button variant="ghost" className={styles.action} onClick={onAddSavedMeal}>
          Repas enregistré
          <span className={styles.hidden}> pour {label}</span>
        </Button>
        {entries.length > 0 && (
          <Button variant="ghost" className={styles.action} onClick={onSaveAsMeal}>
            Enregistrer ce repas
            <span className={styles.hidden}> : {label}</span>
          </Button>
        )}
      </div>
    </Card>
  );
}
