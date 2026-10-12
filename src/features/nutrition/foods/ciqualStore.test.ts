import { beforeEach, describe, expect, it } from 'vitest';
import { ciqualFoodRepo } from '@/data';
import { resetDb } from '@/test/fixtures';
import sample from './fixtures/ciqual-exemple.csv?raw';
import { parseCiqualCsv } from './ciqual';
import { restoreCiqualCatalog, saveCiqualCatalog } from './ciqualStore';
import { searchFoods, setCiqualCatalog } from './searchFoods';

beforeEach(async () => {
  await resetDb();
  setCiqualCatalog([]);
});

describe('catalogue CIQUAL conservé en base', () => {
  it('enregistre le catalogue puis le retrouve au démarrage suivant', async () => {
    const { foods } = parseCiqualCsv(sample);
    await saveCiqualCatalog(foods);
    expect(await ciqualFoodRepo.count()).toBe(foods.length);

    // « Redémarrage » : la mémoire est vide, la base est pleine.
    setCiqualCatalog([]);
    expect(await restoreCiqualCatalog()).toBe(foods.length);
    const outcome = await searchFoods('poulet blanc cru', { remote: false });
    expect(outcome.hits.some((hit) => hit.source === 'ciqual')).toBe(true);
  });

  it('ne fait rien si aucun catalogue n’a été enregistré', async () => {
    expect(await restoreCiqualCatalog()).toBe(0);
  });
});
