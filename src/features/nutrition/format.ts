import { formatNumber } from '@/data';
import type { Food } from '@/data';
import type { FoodHit } from './foods';
import type { Nutrition } from './logic';

export const kcalText = (kcal: number): string => `${formatNumber(Math.round(kcal))} kcal`;
export const gramsText = (grams: number): string => `${formatNumber(grams)} g`;

/** « P 22 · G 0 · L 2 » : macros d'une quantité. */
export function macrosText(n: Pick<Nutrition, 'proteinG' | 'carbsG' | 'fatG'>): string {
  return `P ${formatNumber(n.proteinG)} · G ${formatNumber(n.carbsG)} · L ${formatNumber(n.fatG)}`;
}

/** Résumé pour 100 g d'un aliment ou d'un résultat de recherche. */
export function per100Text(
  item:
    | Pick<Food, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>
    | Pick<FoodHit, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>,
): string {
  return `${kcalText(item.kcal)} · ${macrosText(item)} · pour 100 g`;
}

export const SOURCE_LABELS = {
  local: 'Mes aliments',
  manual: 'Mes aliments',
  ciqual: 'CIQUAL',
  openfoodfacts: 'Open Food Facts',
  average: 'Moyenne',
} as const;

/** Un aliment enregistré → résultat de recherche (pour l'afficher comme les autres). */
export function foodToHit(food: Food): FoodHit {
  return {
    source: 'local',
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    kcal: food.kcal,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    fiberG: food.fiberG,
    servingG: food.servingG,
  };
}

export const OFF_URL = 'https://world.openfoodfacts.org';
