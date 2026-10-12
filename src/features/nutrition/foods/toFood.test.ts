import { foodRepo } from '@/data';
import { resetDb } from '@/test/fixtures';
import { beforeEach, describe, expect, it } from 'vitest';
import { aggregateFoods } from './aggregate';
import { aggregateToNewFood, hitToNewFood, saveAggregatedFood } from './toFood';
import type { FoodHit, Product } from './types';

const chicken = (protein: number, fiber: number | null = null): Product => ({
  name: 'Filet de poulet cru',
  kcal: Math.round(4 * protein + 18),
  proteinG: protein,
  carbsG: 0,
  fatG: 2,
  fiberG: fiber,
});

beforeEach(resetDb);

describe('aggregateToNewFood', () => {
  it('convertit la moyenne en Food et garde la fourchette à part', () => {
    const result = aggregateFoods([chicken(20), chicken(22)], {
      reference: { proteinG: 22 },
    });
    const { food, info } = aggregateToNewFood(result, '  Filet de poulet cru ');

    expect(food).toEqual({
      name: 'Filet de poulet cru',
      brand: '',
      barcode: null,
      kcal: 102,
      proteinG: 21,
      carbsG: 0,
      fatG: 2,
      fiberG: null,
      servingG: null,
    });
    expect(info).toMatchObject({
      state: 'raw',
      keptCount: 2,
      rejectedCount: 0,
      confidence: 'low',
      ranges: { proteinG: { min: 20, max: 22 }, kcal: { min: 98, max: 106 } },
    });
    expect(info.ranges.fiberG).toBeUndefined();
    expect(info.comparison?.consistent).toBe(true);
    expect(Number.isNaN(Date.parse(info.computedAt))).toBe(false);
  });

  it('reprend les fibres quand elles existent', () => {
    const result = aggregateFoods([chicken(20, 1), chicken(22, 3)]);
    expect(aggregateToNewFood(result, 'X').food.fiberG).toBe(2);
  });

  it('compte les produits écartés', () => {
    const result = aggregateFoods([chicken(20), chicken(22), { ...chicken(21), kcal: null }]);
    expect(aggregateToNewFood(result, 'X').info.rejectedCount).toBe(1);
  });

  it('refuse un nom vide', () => {
    expect(() => aggregateToNewFood(aggregateFoods([chicken(20)]), '   ')).toThrow(/nom/);
  });

  it('refuse quand aucun produit n’est retenu', () => {
    const result = aggregateFoods([{ ...chicken(20), kcal: null }]);
    expect(() => aggregateToNewFood(result, 'X')).toThrow(/aucun produit utilisable/);
    expect(() => aggregateToNewFood(aggregateFoods([]), 'X')).toThrow(/aucun produit utilisable/);
  });

  it('accepte des valeurs à zéro (glucides à 0 ne sont pas « manquants »)', () => {
    // Régression : `!stat` ne doit pas confondre une statistique à 0 avec une absence.
    const result = aggregateFoods([chicken(20), chicken(22)]);
    expect(result.nutrients.carbsG?.value).toBe(0);
    expect(() => aggregateToNewFood(result, 'X')).not.toThrow();
  });
});

describe('saveAggregatedFood', () => {
  it('enregistre le Food dans foodRepo, relisible comme n’importe quel aliment', async () => {
    const result = aggregateFoods([chicken(20), chicken(22)]);
    const { food, info } = await saveAggregatedFood(result, 'Filet de poulet cru');

    expect(food.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await foodRepo.get(food.id)).toEqual(food);
    expect((await foodRepo.list()).map((f) => f.name)).toEqual(['Filet de poulet cru']);
    expect(info.keptCount).toBe(2);
  });

  it('n’enregistre rien en cas d’erreur', async () => {
    await expect(saveAggregatedFood(aggregateFoods([]), 'X')).rejects.toThrow();
    expect(await foodRepo.list()).toEqual([]);
  });
});

describe('hitToNewFood', () => {
  it('prépare l’enregistrement d’un résultat externe', async () => {
    const hit: FoodHit = {
      source: 'openfoodfacts',
      foodId: null,
      name: 'Skyr',
      brand: 'Marque',
      barcode: '3250390000001',
      kcal: 63,
      proteinG: 11,
      carbsG: 4,
      fatG: 0.2,
      fiberG: null,
      servingG: null,
    };
    const created = await foodRepo.create(hitToNewFood(hit));
    expect(created).toMatchObject({ name: 'Skyr', barcode: '3250390000001', kcal: 63 });
  });
});
