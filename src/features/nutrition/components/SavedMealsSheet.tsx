import { foodLogEntryRepo, mealRepo } from '@/data';
import type { Food, Meal, MealTypeId } from '@/data';
import { Card, EmptyState, Icon, Sheet, useToast } from '@/ui';
import { kcalText } from '../format';
import { entriesFromMeal, mealNutrition } from '../logic';
import styles from './SavedMealsSheet.module.css';

export interface SavedMealsSheetProps {
  open: boolean;
  onClose: () => void;
  day: string;
  mealType: MealTypeId;
  mealLabel: string;
  meals: Meal[];
  foods: ReadonlyMap<string, Food>;
}

/** Ajouter un repas enregistré au journal en un geste (ou le supprimer de la liste). */
export function SavedMealsSheet({
  open,
  onClose,
  day,
  mealType,
  mealLabel,
  meals,
  foods,
}: SavedMealsSheetProps) {
  const toast = useToast();
  const sorted = [...meals].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  async function add(meal: Meal) {
    const entries = entriesFromMeal(meal, day, mealType, new Set(foods.keys()));
    if (entries.length === 0) {
      toast.show('Les aliments de ce repas n’existent plus');
      return;
    }
    for (const entry of entries) await foodLogEntryRepo.create(entry);
    toast.show(`« ${meal.name} » ajouté à ${mealLabel}`);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Repas enregistrés · ${mealLabel}`}>
      {sorted.length === 0 ? (
        <EmptyState
          icon="nutrition"
          title="Aucun repas enregistré"
          message="Saisis les aliments d’un repas, puis touche « Enregistrer ce repas » pour le réutiliser en un geste."
        />
      ) : (
        <Card flush>
          <ul className={styles.list}>
            {sorted.map((meal) => {
              const n = mealNutrition(meal, foods);
              return (
                <li key={meal.id} className={styles.item}>
                  <button
                    type="button"
                    className={styles.main}
                    aria-label={`Ajouter le repas ${meal.name}`}
                    onClick={() => void add(meal)}
                  >
                    <span className={styles.name}>{meal.name}</span>
                    <span className={styles.detail}>
                      {meal.items.length} aliment{meal.items.length > 1 ? 's' : ''} ·{' '}
                      {kcalText(n.kcal)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Supprimer le repas ${meal.name}`}
                    onClick={() => {
                      void mealRepo.remove(meal.id);
                      toast.show('Repas supprimé');
                    }}
                  >
                    <Icon name="trash" size={20} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Sheet>
  );
}
