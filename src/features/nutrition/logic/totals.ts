import type { Food, FoodLogEntry, MealTypeId } from '@/data';

export interface Nutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export const ZERO_NUTRITION: Nutrition = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

type FoodValues = Pick<Food, 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'>;

/** Arrondi à 0,1 (les totaux affichés ne montrent jamais de chiffres parasites). */
export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Apport d'un aliment pour une quantité en grammes (les valeurs de l'aliment sont pour 100 g). */
export function nutritionFor(food: FoodValues, grams: number): Nutrition {
  const k = grams / 100;
  return {
    kcal: food.kcal * k,
    proteinG: food.proteinG * k,
    carbsG: food.carbsG * k,
    fatG: food.fatG * k,
    fiberG: (food.fiberG ?? 0) * k,
  };
}

export function sumNutrition(parts: Nutrition[]): Nutrition {
  return parts.reduce(
    (total, p) => ({
      kcal: total.kcal + p.kcal,
      proteinG: total.proteinG + p.proteinG,
      carbsG: total.carbsG + p.carbsG,
      fatG: total.fatG + p.fatG,
      fiberG: total.fiberG + p.fiberG,
    }),
    ZERO_NUTRITION,
  );
}

export function roundNutrition(n: Nutrition): Nutrition {
  return {
    kcal: Math.round(n.kcal),
    proteinG: round1(n.proteinG),
    carbsG: round1(n.carbsG),
    fatG: round1(n.fatG),
    fiberG: round1(n.fiberG),
  };
}

/** Total d'une liste de lignes du journal. Une ligne dont l'aliment est introuvable est ignorée. */
export function totalsOf(
  entries: Pick<FoodLogEntry, 'foodId' | 'grams'>[],
  foods: ReadonlyMap<string, FoodValues>,
): Nutrition {
  return sumNutrition(
    entries.flatMap((entry) => {
      const food = foods.get(entry.foodId);
      return food ? [nutritionFor(food, entry.grams)] : [];
    }),
  );
}

/** Lignes du journal d'un repas, dans l'ordre où elles ont été saisies. */
export function entriesOfMeal<T extends Pick<FoodLogEntry, 'mealType' | 'createdAt'>>(
  entries: T[],
  mealType: MealTypeId,
): T[] {
  return entries
    .filter((e) => e.mealType === mealType)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface Remaining {
  /** Calories qu'il reste à manger (0 si l'objectif est atteint ou dépassé). */
  kcal: number;
  /** Calories en trop (0 tant que l'objectif n'est pas dépassé). */
  over: number;
}

/** Reste à manger par rapport à l'objectif calories (`null` sans objectif). */
export function remainingKcal(goalKcal: number | null, eatenKcal: number): Remaining | null {
  if (goalKcal === null) return null;
  const diff = Math.round(goalKcal - eatenKcal);
  return { kcal: Math.max(0, diff), over: Math.max(0, -diff) };
}

/** Part de l'objectif atteinte, entre 0 et 1 pour une barre de progression (0 sans objectif). */
export function progressRatio(value: number, target: number | null): number {
  if (target === null || target <= 0) return 0;
  return Math.min(1, Math.max(0, value / target));
}
