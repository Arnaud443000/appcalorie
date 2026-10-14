import { describe, expect, it } from 'vitest';
import type { Food } from '@/data';
import { entriesCopiedTo, entriesFromMeal, mealItemsFrom, mealNutrition } from './meals';
import { quickPortions, validGrams } from './servings';

describe('repas enregistrés', () => {
  it('transforme des lignes du journal en éléments de repas', () => {
    expect(mealItemsFrom([{ foodId: 'a', grams: 120 }])).toEqual([{ foodId: 'a', grams: 120 }]);
  });
  it('rajoute un repas sur un jour, sans les aliments supprimés', () => {
    const meal = {
      items: [
        { foodId: 'a', grams: 100 },
        { foodId: 'b', grams: 50 },
      ],
    };
    expect(entriesFromMeal(meal, '2026-10-12', 'lunch', new Set(['a']))).toEqual([
      { date: '2026-10-12', mealType: 'lunch', foodId: 'a', grams: 100 },
    ]);
  });
  it('copie un jour en gardant le repas et l’ordre', () => {
    const copy = entriesCopiedTo(
      [
        { mealType: 'dinner', foodId: 'b', grams: 10, createdAt: '2026-10-11T20:00:00.000Z' },
        { mealType: 'lunch', foodId: 'a', grams: 20, createdAt: '2026-10-11T12:00:00.000Z' },
      ],
      '2026-10-12',
    );
    expect(copy.map((e) => [e.foodId, e.mealType, e.date])).toEqual([
      ['a', 'lunch', '2026-10-12'],
      ['b', 'dinner', '2026-10-12'],
    ]);
  });
  it('calcule l’apport d’un repas enregistré', () => {
    const food = { kcal: 200, proteinG: 10, carbsG: 20, fatG: 5, fiberG: null } as Food;
    expect(mealNutrition({ items: [{ foodId: 'a', grams: 150 }] }, new Map([['a', food]]))).toEqual(
      { kcal: 300, proteinG: 15, carbsG: 30, fatG: 7.5, fiberG: 0 },
    );
  });
});

describe('portions rapides', () => {
  it('met la portion habituelle en premier sans doublon', () => {
    expect(quickPortions(150).map((p) => p.grams)).toEqual([150, 50, 100, 200]);
    expect(quickPortions(null).map((p) => p.grams)).toEqual([50, 100, 150, 200]);
    expect(quickPortions(30)[0]?.label).toBe('1 portion · 30 g');
  });
  it('valide les grammes', () => {
    expect(validGrams(0)).toBeNull();
    expect(validGrams(null)).toBeNull();
    expect(validGrams(6000)).toBeNull();
    expect(validGrams(125.04)).toBe(125);
  });
});
