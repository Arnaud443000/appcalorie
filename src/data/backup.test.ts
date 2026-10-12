import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, samples } from '../test/fixtures';
import { exportData, exportToJson, importData, importFromJson } from './backup';
import { AtlasDatabase, db, TABLE_NAMES } from './db';
import {
  bodyMetricRepo,
  exerciseRepo,
  foodLogEntryRepo,
  foodRepo,
  getProfile,
  getSettings,
  goalRepo,
  mealRepo,
  muscleRepo,
  routineRepo,
  setEntryRepo,
  workoutSessionRepo,
} from './repositories';
import { seedDemoData } from './seed';

async function fillEveryTable() {
  await seedDemoData();
  await muscleRepo.create(samples.muscle);
  const deleted = await exerciseRepo.create(samples.exercise);
  await exerciseRepo.remove(deleted.id);
  await routineRepo.create(samples.routine);
  await workoutSessionRepo.create(samples.workoutSession);
  await setEntryRepo.create(samples.setEntry);
  await bodyMetricRepo.create(samples.bodyMetric);
  await foodRepo.create(samples.food);
  await mealRepo.create(samples.meal);
  await foodLogEntryRepo.create(samples.foodLogEntry);
  await goalRepo.create(samples.goal);
  await getProfile();
  await getSettings();
}

beforeEach(resetDb);

describe('Sauvegarde JSON', () => {
  it('export puis import redonne exactement les mêmes données', async () => {
    await fillEveryTable();
    const before = await exportData();
    for (const name of TABLE_NAMES) {
      expect(before.tables[name].length, name).toBeGreaterThan(0);
    }

    await resetDb();
    expect(await db.exercises.count()).toBe(0);

    await importFromJson(JSON.stringify(before));
    const after = await exportData();
    expect(after.tables).toEqual(before.tables);
    expect(after.schemaVersion).toBe(before.schemaVersion);
  });

  it('le texte JSON exporté est identique après un aller-retour', async () => {
    await fillEveryTable();
    const json = await exportToJson();
    await resetDb();
    await importFromJson(json);
    const again = JSON.parse(await exportToJson());
    expect(again.tables).toEqual(JSON.parse(json).tables);
  });

  it('refuse une sauvegarde invalide sans rien modifier', async () => {
    await fillEveryTable();
    const before = await exportData();
    const broken = structuredClone(before);
    (broken.tables.foods[0] as { kcal: unknown }).kcal = 'beaucoup';

    await expect(importData(broken)).rejects.toThrow();
    await expect(importFromJson('pas du json')).rejects.toThrow(/sauvegarde valide/);
    await expect(importData({ ...before, schemaVersion: 999 })).rejects.toThrow();
    expect((await exportData()).tables).toEqual(before.tables);
  });
});

describe('Persistance', () => {
  it('les données survivent à la fermeture et réouverture de la base', async () => {
    const record = await foodRepo.create(samples.food);
    db.close();
    const reopened = new AtlasDatabase();
    expect(await reopened.foods.get(record.id)).toEqual(record);
    reopened.close();
    await db.open();
  });
});
