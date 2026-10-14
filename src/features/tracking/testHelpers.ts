import { createElement } from 'react';
import { render } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { dayFromDate, seedDemoData } from '@/data';
import { ToastProvider } from '@/ui';
import { addDays } from './logic';
import { trackingRoutes } from './routes';

/** Id fixes des exercices de démonstration (voir docs/CONTRACTS.md). */
export const BENCH = '0d1e1a00-0000-4000-8000-000000000001';
export const SQUAT = '0d1e1a00-0000-4000-8000-000000000003';

export const todayDay = () => dayFromDate(new Date());
export const daysAgo = (n: number) => addDays(todayDay(), -n);

export async function seedExercises() {
  await seedDemoData();
}

/** Affiche l'onglet Suivi (sans la coque de l'app). */
export function renderTracking(path = '/suivi') {
  const router = createMemoryRouter(
    [
      {
        element: createElement(ToastProvider, null, createElement(Outlet)),
        children: [{ path: 'suivi', children: trackingRoutes }],
      },
    ],
    { initialEntries: [path] },
  );
  render(createElement(RouterProvider, { router }));
  return router;
}
