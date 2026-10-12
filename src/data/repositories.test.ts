import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, samples } from '../test/fixtures';
import { db } from './db';
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
  saveProfile,
  saveSettings,
  setEntryRepo,
  workoutSessionRepo,
} from './repositories';
import type { Repository } from './repository';
import type { BaseRecord } from './schemas';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Pour chaque entité : nom de table, dépôt, exemple valide, une modification, un index à interroger.
const cases: [string, Repository<BaseRecord>, object, object, string][] = [
  ['muscles', muscleRepo, samples.muscle, { name: 'Petit pectoral' }, 'group'],
  ['exercises', exerciseRepo, samples.exercise, { name: 'Pompes larges' }, 'movementPattern'],
  ['routines', routineRepo, samples.routine, { name: 'Push' }, 'name'],
  [
    'workoutSessions',
    workoutSessionRepo,
    samples.workoutSession,
    { note: 'Bonne forme' },
    'startedAt',
  ],
  ['setEntries', setEntryRepo, samples.setEntry, { reps: 10 }, 'sessionId'],
  ['bodyMetrics', bodyMetricRepo, samples.bodyMetric, { weightKg: 78 }, 'date'],
  ['foods', foodRepo, samples.food, { kcal: 380 }, 'name'],
  ['meals', mealRepo, samples.meal, { name: 'Petit-déj' }, 'name'],
  ['foodLogEntries', foodLogEntryRepo, samples.foodLogEntry, { grams: 100 }, 'date'],
  ['goals', goalRepo, samples.goal, { targetValue: 110 }, 'type'],
] as never;

beforeEach(resetDb);

describe.each(cases)('table %s', (tableName, repo, sample, patch, index) => {
  it('crée un enregistrement avec id UUID et dates', async () => {
    const record = await repo.create(sample as never);
    expect(record.id).toMatch(UUID);
    expect(record.createdAt).toBe(record.updatedAt);
    expect(record.deletedAt).toBeNull();
    expect(await repo.get(record.id)).toEqual(record);
    expect(await repo.list()).toEqual([record]);
  });

  it('modifie un enregistrement et met à jour updatedAt', async () => {
    const record = await repo.create(sample as never);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const updated = await repo.update(record.id, patch as never);
    expect(updated).toMatchObject(patch);
    expect(updated.createdAt).toBe(record.createdAt);
    expect(updated.updatedAt > record.updatedAt).toBe(true);
    expect(await repo.get(record.id)).toEqual(updated);
  });

  it('retrouve un enregistrement par index', async () => {
    const record = await repo.create(sample as never);
    const value = (record as unknown as Record<string, string>)[index] as string;
    expect(await repo.findBy(index, value)).toEqual([record]);
  });

  it('supprime en douceur', async () => {
    const record = await repo.create(sample as never);
    await repo.remove(record.id);
    expect(await repo.get(record.id)).toBeUndefined();
    expect(await repo.list()).toEqual([]);
    expect(await repo.findBy(index, (record as never)[index])).toEqual([]);
    const raw = (await db.table(tableName).get(record.id)) as BaseRecord;
    expect(raw.deletedAt).not.toBeNull();
    await expect(repo.update(record.id, patch as never)).rejects.toThrow();
  });

  it('refuse des données invalides', async () => {
    await expect(repo.create({} as never)).rejects.toThrow();
    expect(await repo.list()).toEqual([]);
  });
});

describe('Profil et Réglages', () => {
  it('crée les valeurs par défaut au premier accès, une seule fois', async () => {
    const settings = await getSettings();
    expect(settings).toMatchObject({ weightUnit: 'kg', lengthUnit: 'cm' });
    expect(await getSettings()).toEqual(settings);
    expect(await db.settings.count()).toBe(1);

    const profile = await getProfile();
    expect(profile).toMatchObject({ sex: null, age: null, heightCm: null, generalGoal: null });
    expect(await db.profiles.count()).toBe(1);
  });

  it('enregistre les modifications', async () => {
    await saveProfile({ sex: 'male', age: 34, heightCm: 180, generalGoal: 'muscle_gain' });
    expect(await getProfile()).toMatchObject({ sex: 'male', age: 34, heightCm: 180 });
    await saveSettings({ weightUnit: 'lb' });
    expect((await getSettings()).weightUnit).toBe('lb');
    await expect(saveProfile({ age: -3 })).rejects.toThrow();
  });
});

describe('Modifications simultanées', () => {
  it('deux modifications lancées en même temps ne s’écrasent pas', async () => {
    const session = await workoutSessionRepo.create(samples.workoutSession);
    const endedAt = '2026-10-12T09:00:00.000Z';
    await Promise.all([
      workoutSessionRepo.update(session.id, { plan: [] }),
      workoutSessionRepo.update(session.id, { endedAt }),
    ]);
    const saved = await workoutSessionRepo.get(session.id);
    expect(saved?.endedAt).toBe(endedAt);
    expect(saved?.plan).toEqual([]);
  });
});
