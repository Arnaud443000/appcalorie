import type { Food, FoodLogEntry, Meal, MealItem, MealTypeId, NewRecord } from '@/data';
import { nutritionFor, roundNutrition, sumNutrition, type Nutrition } from './totals';

/** Aliments d'un repas du journal → éléments d'un repas réutilisable. */
export function mealItemsFrom(entries: Pick<FoodLogEntry, 'foodId' | 'grams'>[]): MealItem[] {
  return entries.map(({ foodId, grams }) => ({ foodId, grams }));
}

/** Lignes du journal à créer pour rajouter un repas enregistré (aliments supprimés ignorés). */
export function entriesFromMeal(
  meal: Pick<Meal, 'items'>,
  day: string,
  mealType: MealTypeId,
  knownFoodIds: ReadonlySet<string>,
): NewRecord<FoodLogEntry>[] {
  return meal.items
    .filter((item) => knownFoodIds.has(item.foodId))
    .map((item) => ({ date: day, mealType, foodId: item.foodId, grams: item.grams }));
}

/** Lignes à créer pour copier un jour (ou un repas) sur un autre jour. */
export function entriesCopiedTo(
  source: Pick<FoodLogEntry, 'mealType' | 'foodId' | 'grams' | 'createdAt'>[],
  targetDay: string,
): NewRecord<FoodLogEntry>[] {
  return [...source]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ mealType, foodId, grams }) => ({ date: targetDay, mealType, foodId, grams }));
}

/** Apport total d'un repas enregistré. */
export function mealNutrition(
  meal: Pick<Meal, 'items'>,
  foods: ReadonlyMap<string, Food>,
): Nutrition {
  return roundNutrition(
    sumNutrition(
      meal.items.flatMap((item) => {
        const food = foods.get(item.foodId);
        return food ? [nutritionFor(food, item.grams)] : [];
      }),
    ),
  );
}
