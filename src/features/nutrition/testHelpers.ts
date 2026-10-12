import { createElement } from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { foodLogEntryRepo, foodRepo, type Food, type MealTypeId } from '@/data';
import { ToastProvider } from '@/ui';
import { nutritionRoutes } from './routes';

/** Affiche les écrans de l'onglet Nutrition à l'adresse donnée (sans la coque de l'app). */
export function renderNutrition(path = '/nutrition') {
  const router = createMemoryRouter(
    [
      {
        element: createElement(ToastProvider, null, createElement(Outlet)),
        children: [{ path: 'nutrition', children: nutritionRoutes }],
      },
    ],
    { initialEntries: [path] },
  );
  render(createElement(RouterProvider, { router }));
  return router;
}

export async function createFood(overrides: Partial<Parameters<typeof foodRepo.create>[0]> = {}) {
  return foodRepo.create({
    name: 'Blanc de poulet',
    brand: '',
    barcode: null,
    kcal: 110,
    proteinG: 22.5,
    carbsG: 0,
    fatG: 2.2,
    fiberG: null,
    servingG: null,
    source: 'manual',
    average: null,
    ...overrides,
  });
}

export async function logFood(food: Food, date: string, mealType: MealTypeId, grams: number) {
  return foodLogEntryRepo.create({ date, mealType, foodId: food.id, grams });
}

/* ------------------------------------------------------------------ */
/* Réseau simulé (Open Food Facts)                                     */
/* ------------------------------------------------------------------ */

/**
 * Attention : le client Open Food Facts de l'application limite à 8 recherches par minute
 * pour toute la durée d'un fichier de test. Un fichier doit donc rester sous ce plafond.
 */

export interface OffTestProduct {
  code: string;
  name: string;
  brand: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const offProduct = (p: OffTestProduct) => ({
  code: p.code,
  product_name_fr: p.name,
  brands: p.brand,
  categories: 'Viandes, Volailles',
  nutriments: {
    'energy-kcal_100g': p.kcal,
    proteins_100g: p.proteinG,
    carbohydrates_100g: p.carbsG,
    fat_100g: p.fatG,
  },
});

/** Remplace `fetch` : chaque appel reçoit une nouvelle réponse (`status` 200 par défaut). */
export function mockFetchJson(body: unknown, status = 200) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Remplace `fetch` par un réseau qui échoue (coupure, DNS…). */
export function mockFetchNetworkError() {
  const fetchMock = vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Simule un téléphone hors ligne (`navigator.onLine`). */
export function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}
