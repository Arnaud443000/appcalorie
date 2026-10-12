import { afterEach, describe, expect, it, vi } from 'vitest';
import { getExerciseImages, resetExerciseImagesCache } from './images';

function serveManifest(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, status: ok ? 200 : 404, json: async () => body }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const manifest = {
  version: 1,
  images: {
    'squat-barre': ['depart', 'fin'],
    'gainage-planche': ['unique'],
    'face-pull': ['depart'],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetExerciseImagesCache();
});

describe('getExerciseImages', () => {
  it('renvoie le départ et la fin', async () => {
    serveManifest(manifest);
    expect(await getExerciseImages({ imageSlug: 'squat-barre' })).toEqual({
      kind: 'pair',
      start: '/exercises/squat-barre_depart.webp',
      end: '/exercises/squat-barre_fin.webp',
    });
  });

  it('renvoie une image unique (gainage) ou la seule position disponible', async () => {
    serveManifest(manifest);
    expect(await getExerciseImages({ imageSlug: 'gainage-planche' })).toEqual({
      kind: 'single',
      src: '/exercises/gainage-planche_unique.webp',
    });
    expect(await getExerciseImages({ imageSlug: 'face-pull' })).toEqual({
      kind: 'single',
      src: '/exercises/face-pull_depart.webp',
    });
  });

  it('renvoie « aucune » sans image, sans imageSlug ou sans manifeste', async () => {
    serveManifest(manifest);
    expect(await getExerciseImages({ imageSlug: 'curl-marteau' })).toEqual({ kind: 'none' });
    expect(await getExerciseImages({})).toEqual({ kind: 'none' });

    resetExerciseImagesCache();
    serveManifest(null, false);
    expect(await getExerciseImages({ imageSlug: 'squat-barre' })).toEqual({ kind: 'none' });
  });

  it('ne lit le manifeste qu’une fois, mais réessaie après un échec', async () => {
    const failing = serveManifest(null, false);
    await getExerciseImages({ imageSlug: 'squat-barre' });
    await getExerciseImages({ imageSlug: 'squat-barre' });
    expect(failing).toHaveBeenCalledTimes(2);

    const working = serveManifest(manifest);
    await getExerciseImages({ imageSlug: 'squat-barre' });
    await getExerciseImages({ imageSlug: 'gainage-planche' });
    expect(working).toHaveBeenCalledTimes(1);
  });
});
