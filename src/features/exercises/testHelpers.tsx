import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { resetExerciseImagesCache } from '@/data';
import { exercisesRoutes } from './routes';

/** Affiche l'onglet Exercices à l'adresse donnée (sans la coque de l'app). */
export function renderExercises(path = '/exercices') {
  const router = createMemoryRouter([{ path: 'exercices', children: exercisesRoutes }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}

/** Manifeste d'images simulé : `{ slug: ['depart', 'fin'] }`. */
export function stubManifest(images: Record<string, string[]>) {
  resetExerciseImagesCache();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ version: 1, images }), { status: 200 })),
  );
}

/** Fait « charger » les images tout de suite (jsdom ne charge rien). */
export function stubImageLoading(options: { fail?: (src: string) => boolean } = {}) {
  class FakeImage {
    naturalWidth = 300;
    naturalHeight = 200;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      queueMicrotask(() => (options.fail?.(value) ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

/** Simule la préférence « réduire les animations ». */
export function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduced && query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}
