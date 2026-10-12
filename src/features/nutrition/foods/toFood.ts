import { foodRepo } from '@/data';
import type { Food, NewRecord } from '@/data';
import type { AggregateResult, Confidence, ReferenceComparison } from './aggregate';
import type { FoodHit, FoodState, NutrientKey } from './types';

/**
 * Informations sur la moyenne qui ne tiennent pas dans le type `Food` actuel
 * (pas de champ pour la fourchette ni le nombre de sources : voir DEMANDES.md).
 * En attendant, elles sont renvoyées à côté du `Food` et ne sont PAS conservées en base :
 * l'écran qui enregistre doit les afficher tout de suite ou les garder lui-même.
 */
export interface AggregatedFoodInfo {
  state: FoodState;
  /** Nombre de produits retenus / écartés. */
  keptCount: number;
  rejectedCount: number;
  confidence: Confidence;
  confidenceReasons: string[];
  /** Fourchette min-max de chaque nutriment (pour 100 g). */
  ranges: Partial<Record<NutrientKey, { min: number; max: number }>>;
  comparison: ReferenceComparison | null;
  /** Date-heure ISO du calcul. */
  computedAt: string;
}

const NO_DATA_MESSAGE =
  'Impossible de créer cet aliment : aucun produit utilisable n’a été retenu pour calculer la moyenne.';

/**
 * Transforme le résultat d'une moyenne en `Food` enregistrable (pas encore enregistré).
 * Le nom est choisi par l'appelant (ex. « Filet de poulet cru »).
 */
export function aggregateToNewFood(
  result: AggregateResult,
  name: string,
): { food: NewRecord<Food>; info: AggregatedFoodInfo } {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Le nom de l’aliment est obligatoire.');

  const { kcal, proteinG, carbsG, fatG, fiberG } = result.nutrients;
  if (!kcal || !proteinG || !carbsG || !fatG) throw new Error(NO_DATA_MESSAGE);

  const ranges: AggregatedFoodInfo['ranges'] = {};
  for (const [key, stat] of Object.entries(result.nutrients) as [
    NutrientKey,
    AggregateResult['nutrients'][NutrientKey],
  ][]) {
    if (stat) ranges[key] = { min: stat.min, max: stat.max };
  }

  return {
    food: {
      name: cleanName,
      brand: '',
      barcode: null,
      kcal: kcal.value,
      proteinG: proteinG.value,
      carbsG: carbsG.value,
      fatG: fatG.value,
      fiberG: fiberG?.value ?? null,
      servingG: null,
    },
    info: {
      state: result.state,
      keptCount: result.keptCount,
      rejectedCount: result.rejected.length,
      confidence: result.confidence,
      confidenceReasons: result.confidenceReasons,
      ranges,
      comparison: result.comparison,
      computedAt: new Date().toISOString(),
    },
  };
}

/** Comme `aggregateToNewFood`, et enregistre l'aliment via `foodRepo` (utilisable ensuite comme tout autre aliment). */
export async function saveAggregatedFood(
  result: AggregateResult,
  name: string,
): Promise<{ food: Food; info: AggregatedFoodInfo }> {
  const { food, info } = aggregateToNewFood(result, name);
  return { food: await foodRepo.create(food), info };
}

/** Prépare l'enregistrement d'un résultat de recherche externe (CIQUAL, Open Food Facts) dans « Mes aliments ». */
export function hitToNewFood(hit: FoodHit): NewRecord<Food> {
  return {
    name: hit.name,
    brand: hit.brand,
    barcode: hit.barcode,
    kcal: hit.kcal,
    proteinG: hit.proteinG,
    carbsG: hit.carbsG,
    fatG: hit.fatG,
    fiberG: hit.fiberG,
    servingG: hit.servingG,
  };
}
