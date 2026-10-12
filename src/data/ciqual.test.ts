import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, samples } from '../test/fixtures';
import { ciqualFoodRepo } from './ciqual';

beforeEach(resetDb);

describe('ciqualFoodRepo', () => {
  it('remplace toute la table et la relit', async () => {
    await ciqualFoodRepo.replaceAll([samples.ciqualFood, { ...samples.ciqualFood, id: '2' }]);
    await ciqualFoodRepo.replaceAll([samples.ciqualFood]);
    expect(await ciqualFoodRepo.list()).toEqual([samples.ciqualFood]);
    expect(await ciqualFoodRepo.count()).toBe(1);
  });

  it('ne change rien si un aliment est invalide', async () => {
    await ciqualFoodRepo.replaceAll([samples.ciqualFood]);
    await expect(
      ciqualFoodRepo.replaceAll([{ ...samples.ciqualFood, id: '3', kcal: -5 }]),
    ).rejects.toThrow();
    expect(await ciqualFoodRepo.list()).toEqual([samples.ciqualFood]);
  });
});
