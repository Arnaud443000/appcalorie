/** Types communs de la logique des aliments (lot 4). Valeurs nutritionnelles toujours pour 100 g. */

export const NUTRIENT_KEYS = ['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** Les quatre valeurs indispensables pour créer un `Food` (les fibres sont facultatives). */
export const REQUIRED_NUTRIENT_KEYS = ['kcal', 'proteinG', 'carbsG', 'fatG'] as const;

/** État de cuisson d'un aliment. `unknown` = on ne sait pas (ou les indices se contredisent). */
export type FoodState = 'raw' | 'cooked' | 'unknown';

/**
 * Un produit tel que le reçoit `aggregateFoods`.
 * Une valeur absente (`undefined` ou `null`) veut dire « inconnue », jamais « zéro ».
 */
export interface Product {
  name: string;
  brand?: string;
  /** Texte libre de catégorie (sert à deviner cru / cuit). */
  category?: string;
  barcode?: string | null;
  kcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
}

/** Valeurs nutritionnelles pour 100 g, où `null` = inconnue. */
export type Nutrients = Record<NutrientKey, number | null>;

/** Produit venant d'une base externe (CIQUAL ou Open Food Facts), déjà converti. */
export interface CatalogProduct extends Nutrients {
  source: 'ciqual' | 'openfoodfacts';
  /** Identifiant dans la base d'origine (code CIQUAL, code-barres OFF). */
  code: string;
  name: string;
  brand: string;
  category: string;
  barcode: string | null;
}

/** Libellés français (pour les messages). */
export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  kcal: 'Calories',
  proteinG: 'Protéines',
  carbsG: 'Glucides',
  fatG: 'Lipides',
  fiberG: 'Fibres',
};
