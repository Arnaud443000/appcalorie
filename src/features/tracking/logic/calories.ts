import type { Food, FoodLogEntry } from '@/data';
import { prepareSeries, type SeriesPoint } from './series';

/**
 * Calories de chaque jour du journal alimentaire : somme de kcal pour 100 g × grammes / 100.
 * Un aliment introuvable (supprimé) ne compte pas.
 */
export function dailyCalories(
  entries: readonly Pick<FoodLogEntry, 'date' | 'foodId' | 'grams'>[],
  foods: ReadonlyMap<string, Pick<Food, 'kcal'>>,
): SeriesPoint[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const food = foods.get(entry.foodId);
    if (!food) continue;
    totals.set(entry.date, (totals.get(entry.date) ?? 0) + (food.kcal * entry.grams) / 100);
  }
  return prepareSeries([...totals].map(([date, value]) => ({ date, value })));
}
