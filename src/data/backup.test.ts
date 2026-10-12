import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, samples } from '../test/fixtures';
import { exportData, exportToJson, importData, importFromJson } from './backup';
import { ciqualFoodRepo } from './ciqual';
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
  await foodRepo.create(samples.averageFood);
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

describe('Sauvegarde et table CIQUAL', () => {
  it("n'exporte pas la table CIQUAL et ne la touche pas à l'import", async () => {
    await fillEveryTable();
    await ciqualFoodRepo.replaceAll([samples.ciqualFood]);
    const backup = await exportData();
    expect(Object.keys(backup.tables)).not.toContain('ciqualFoods');
    expect(JSON.stringify(backup)).not.toContain(samples.ciqualFood.name);

    await importData(backup);
    expect(await ciqualFoodRepo.list()).toEqual([samples.ciqualFood]);
    expect((await exportData()).tables).toEqual(backup.tables);
  });

  it('importe une sauvegarde de la version 1 en complétant les nouveaux champs', async () => {
    await fillEveryTable();
    const v2 = await exportData();
    const v1 = structuredClone(v2) as unknown as {
      schemaVersion: number;
      tables: Record<string, Record<string, unknown>[]>;
    };
    v1.schemaVersion = 1;
    for (const session of v1.tables.workoutSessions ?? []) delete session.plan;
    for (const food of v1.tables.foods ?? []) {
      delete food.source;
      delete food.average;
    }
    for (const settings of v1.tables.settings ?? []) delete settings.defaultRestSeconds;

    await importData(v1);
    const [session] = await workoutSessionRepo.list();
    expect(session?.plan).toEqual([]);
    expect((await foodRepo.list()).map((f) => f.source)).toEqual([null, null]);
    expect((await getSettings()).defaultRestSeconds).toBe(90);
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
