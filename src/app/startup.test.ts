import { beforeEach, describe, expect, it } from 'vitest';
import { exerciseRepo } from '@/data';
import { EXERCISE_CATALOG } from '@/features/exercises/content';
import { resetDb } from '@/test/fixtures';
import { prepareData } from './startup';

describe('prepareData', () => {
  beforeEach(resetDb);

  it('charge les 120 fiches au démarrage, sans doublon si on relance', async () => {
    await prepareData();
    await prepareData();
    const exercises = await exerciseRepo.list();
    expect(EXERCISE_CATALOG).toHaveLength(120);
    expect(exercises).toHaveLength(120);
    // Le catalogue remplace la démo (mêmes identifiants, noms plus précis).
    expect(exercises.map((e) => e.name)).toContain('Développé couché barre');
  });
});
