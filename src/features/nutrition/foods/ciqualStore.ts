import { ciqualFoodRepo, type CiqualFood } from '@/data';
import { setCiqualCatalog } from './searchFoods';
import type { CatalogProduct } from './types';

function toRow(food: CatalogProduct): CiqualFood {
  return {
    id: food.code,
    name: food.name,
    category: food.category,
    kcal: food.kcal,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    fiberG: food.fiberG,
  };
}

function fromRow(row: CiqualFood): CatalogProduct {
  return {
    source: 'ciqual',
    code: row.id,
    name: row.name,
    brand: '',
    category: row.category,
    barcode: null,
    kcal: row.kcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    fiberG: row.fiberG,
  };
}

/**
 * Enregistre le catalogue CIQUAL (résultat de `parseCiqualCsv`) dans la base et l'active
 * pour la recherche. Il sera rechargé au prochain démarrage sans relire le fichier.
 */
export async function saveCiqualCatalog(foods: CatalogProduct[]): Promise<void> {
  await ciqualFoodRepo.replaceAll(foods.map(toRow));
  setCiqualCatalog(foods);
}

/** Au démarrage : remet en mémoire le catalogue CIQUAL enregistré. Renvoie le nombre d'aliments. */
export async function restoreCiqualCatalog(): Promise<number> {
  const rows = await ciqualFoodRepo.list();
  if (rows.length > 0) setCiqualCatalog(rows.map(fromRow));
  return rows.length;
}
