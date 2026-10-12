import { beforeEach, describe, expect, it } from 'vitest';
import { db, exerciseRepo } from '@/data';
import { resetDb } from '@/test/fixtures';
import { EXERCISE_CATALOG } from './catalog';
import { loadExerciseCatalog } from './load';

function firstSheet() {
  const first = EXERCISE_CATALOG[0];
  if (!first) throw new Error('Catalogue vide');
  return first;
}

async function stored(id: string) {
  const record = await db.exercises.get(id);
  if (!record) throw new Error(`Fiche absente : ${id}`);
  return record;
}

describe('loadExerciseCatalog', () => {
  beforeEach(resetDb);

  it('ajoute toutes les fiches, puis les met à jour sans doublon', async () => {
    const first = await loadExerciseCatalog();
    expect(first).toEqual({ added: EXERCISE_CATALOG.length, updated: 0 });
    expect(await db.exercises.count()).toBe(EXERCISE_CATALOG.length);

    const second = await loadExerciseCatalog();
    expect(second).toEqual({ added: 0, updated: EXERCISE_CATALOG.length });
    expect(await db.exercises.count()).toBe(EXERCISE_CATALOG.length);
  });

  it('met à jour une fiche existante (même identifiant) en gardant sa date de création', async () => {
    const target = firstSheet();
    await loadExerciseCatalog();
    const before = await stored(target.id);
    await db.exercises.update(target.id, { name: 'Ancien nom' });
    await loadExerciseCatalog();
    const after = await stored(target.id);
    expect(after.name).toBe(target.name);
    expect(after.createdAt).toBe(before.createdAt);
  });

  it('ne recrée pas une fiche supprimée', async () => {
    const target = firstSheet();
    await loadExerciseCatalog();
    await exerciseRepo.remove(target.id);
    await loadExerciseCatalog();
    expect(await exerciseRepo.get(target.id)).toBeUndefined();
  });
});
