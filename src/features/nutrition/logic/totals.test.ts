import { describe, expect, it } from 'vitest';
import type { Food } from '@/data';
import {
  entriesOfMeal,
  nutritionFor,
  progressRatio,
  remainingKcal,
  roundNutrition,
  sumNutrition,
  totalsOf,
} from './totals';

type FoodValues = Pick<Food, 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'>;

const chicken: FoodValues = { kcal: 110, proteinG: 22.5, carbsG: 0, fatG: 2.2, fiberG: null };
const rice: FoodValues = { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4 };

describe('totaux', () => {
  it('calcule l’apport pour une quantité (valeurs pour 100 g)', () => {
    expect(nutritionFor(chicken, 150)).toEqual({
      kcal: 165,
      proteinG: 33.75,
      carbsG: 0,
      fatG: 3.3000000000000003,
      fiberG: 0,
    });
  });
  it('additionne un journal et ignore un aliment introuvable', () => {
    const foods = new Map<string, FoodValues>([
      ['p', chicken],
      ['r', rice],
    ]);
    const total = roundNutrition(
      totalsOf(
        [
          { foodId: 'p', grams: 200 },
          { foodId: 'r', grams: 100 },
          { foodId: 'supprimé', grams: 500 },
        ],
        foods,
      ),
    );
    expect(total).toEqual({ kcal: 350, proteinG: 47.7, carbsG: 28, fatG: 4.7, fiberG: 0.4 });
  });
  it('somme vide = zéro', () => {
    expect(sumNutrition([]).kcal).toBe(0);
  });
  it('calcule le reste à manger et le dépassement', () => {
    expect(remainingKcal(2000, 1250.4)).toEqual({ kcal: 750, over: 0 });
    expect(remainingKcal(2000, 2100)).toEqual({ kcal: 0, over: 100 });
    expect(remainingKcal(null, 500)).toBeNull();
  });
  it('borne la progression entre 0 et 1', () => {
    expect(progressRatio(500, 2000)).toBe(0.25);
    expect(progressRatio(3000, 2000)).toBe(1);
    expect(progressRatio(100, null)).toBe(0);
    expect(progressRatio(100, 0)).toBe(0);
  });
  it('trie un repas dans l’ordre de saisie', () => {
    const list = [
      { mealType: 'lunch', createdAt: '2026-10-12T12:05:00.000Z', n: 2 },
      { mealType: 'lunch', createdAt: '2026-10-12T12:00:00.000Z', n: 1 },
      { mealType: 'dinner', createdAt: '2026-10-12T20:00:00.000Z', n: 3 },
    ] as const;
    expect(entriesOfMeal([...list], 'lunch').map((e) => e.n)).toEqual([1, 2]);
  });
});
