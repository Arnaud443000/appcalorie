import { createElement } from 'react';
import { render } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { seedDemoData } from '@/data';
import { ToastProvider } from '@/ui';
import { workoutsRoutes } from './routes';

/** Id fixes des exercices de démonstration (voir docs/CONTRACTS.md). */
export const BENCH = '0d1e1a00-0000-4000-8000-000000000001';
export const PULL_UPS = '0d1e1a00-0000-4000-8000-000000000002';
export const SQUAT = '0d1e1a00-0000-4000-8000-000000000003';
export const CURL = '0d1e1a00-0000-4000-8000-000000000004';
export const PLANK = '0d1e1a00-0000-4000-8000-000000000005';

export async function seedExercises() {
  await seedDemoData();
}

/** Affiche les écrans de l'onglet Entraînement à l'adresse donnée (sans la coque de l'app). */
export function renderWorkouts(path = '/entrainement') {
  const router = createMemoryRouter(
    [
      {
        element: createElement(ToastProvider, null, createElement(Outlet)),
        children: [{ path: 'entrainement', children: workoutsRoutes }],
      },
    ],
    { initialEntries: [path] },
  );
  render(createElement(RouterProvider, { router }));
  return router;
}
