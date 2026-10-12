import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { AtlasDatabase } from './db';
import { DB_VERSIONS, LEGACY_PLAN_KEY_PREFIX, SCHEMA_VERSION } from './migrations';
import {
  foodSchema,
  routineSchema,
  setEntrySchema,
  settingsSchema,
  workoutSessionSchema,
} from './schemas';

/** Une base dans l'état exact de la version 1 (avant l'intégration de la vague B). */
function openVersion1(name: string) {
  const v1 = DB_VERSIONS.find((v) => v.version === 1);
  if (!v1) throw new Error('Version 1 introuvable');
  const legacy = new Dexie(name);
  legacy.version(1).stores(v1.stores);
  return legacy;
}

const T = '2026-10-01T08:00:00.000Z';
const base = (id: string) => ({ id, createdAt: T, updatedAt: T, deletedAt: null });
const EXERCISE = '0d1e1a00-0000-4000-8000-000000000001';
const SESSION_WITH_PLAN = '11111111-1111-4111-8111-111111111111';
const SESSION_WITHOUT_PLAN = '22222222-2222-4222-8222-222222222222';

const legacyPlan = [
  {
    exerciseId: EXERCISE,
    targetSets: 4,
    targetReps: '6-8',
    restSeconds: 150,
    note: '',
    skipped: false,
  },
];

const v1Data = {
  routines: [
    {
      ...base('33333333-3333-4333-8333-333333333333'),
      name: 'Lundi Push',
      note: '',
      items: [
        { exerciseId: EXERCISE, targetSets: 4, targetReps: '6-8', restSeconds: 150, note: '' },
      ],
    },
  ],
  workoutSessions: [
    {
      ...base(SESSION_WITH_PLAN),
      routineId: null,
      name: 'Séance en cours',
      startedAt: T,
      endedAt: null,
      note: '',
    },
    {
      ...base(SESSION_WITHOUT_PLAN),
      routineId: null,
      name: 'Séance finie',
      startedAt: T,
      endedAt: '2026-10-01T09:00:00.000Z',
      note: 'Bien',
    },
  ],
  setEntries: [
    {
      ...base('44444444-4444-4444-8444-444444444444'),
      sessionId: SESSION_WITHOUT_PLAN,
      exerciseId: EXERCISE,
      order: 0,
      weight: 80,
      reps: 8,
      durationSeconds: null,
      distanceMeters: null,
      rpe: null,
      isWarmup: false,
      note: '',
    },
  ],
  foods: [
    {
      ...base('55555555-5555-4555-8555-555555555555'),
      name: 'Riz basmati',
      brand: '',
      barcode: null,
      kcal: 350,
      proteinG: 8,
      carbsG: 77,
      fatG: 1,
      fiberG: null,
      servingG: 80,
    },
  ],
  settings: [
    { ...base('66666666-6666-4666-8666-666666666666'), weightUnit: 'lb', lengthUnit: 'cm' },
  ],
};

let dbName = '';
afterEach(async () => {
  localStorage.clear();
  await Dexie.delete(dbName);
});

describe('Migration de la version 1 vers la version 2', () => {
  it('garde toutes les données, complète les nouveaux champs et reprend le plan du navigateur', async () => {
    dbName = 'migration-v1-v2';
    const legacy = openVersion1(dbName);
    for (const [table, rows] of Object.entries(v1Data)) await legacy.table(table).bulkAdd(rows);
    legacy.close();
    localStorage.setItem(LEGACY_PLAN_KEY_PREFIX + SESSION_WITH_PLAN, JSON.stringify(legacyPlan));

    const current = new AtlasDatabase(dbName);
    await current.open();
    expect(current.verno).toBe(SCHEMA_VERSION);

    // Rien n'est perdu, et tout respecte le schéma actuel.
    const routines = await current.routines.toArray();
    expect(routines).toEqual(v1Data.routines);
    for (const r of routines) routineSchema.parse(r);
    expect(await current.setEntries.toArray()).toEqual(v1Data.setEntries);
    for (const s of await current.setEntries.toArray()) setEntrySchema.parse(s);

    const withPlan = await current.workoutSessions.get(SESSION_WITH_PLAN);
    expect(withPlan).toEqual({ ...v1Data.workoutSessions[0], plan: legacyPlan });
    const withoutPlan = await current.workoutSessions.get(SESSION_WITHOUT_PLAN);
    expect(withoutPlan).toEqual({ ...v1Data.workoutSessions[1], plan: [] });
    for (const s of await current.workoutSessions.toArray()) workoutSessionSchema.parse(s);

    const [food] = await current.foods.toArray();
    expect(food).toEqual({ ...v1Data.foods[0], source: null, average: null });
    foodSchema.parse(food);

    const [settings] = await current.settings.toArray();
    expect(settings).toEqual({ ...v1Data.settings[0], defaultRestSeconds: 90 });
    settingsSchema.parse(settings);

    // Nouvel index : les séances terminées se retrouvent par `endedAt`.
    const ended = await current.workoutSessions.where('endedAt').above('').primaryKeys();
    expect(ended).toEqual([SESSION_WITHOUT_PLAN]);
    // Nouvelle table, vide.
    expect(await current.ciqualFoods.count()).toBe(0);
    current.close();
  });

  it('ignore un plan illisible laissé dans le navigateur', async () => {
    dbName = 'migration-v1-v2-plan-casse';
    const legacy = openVersion1(dbName);
    await legacy.table('workoutSessions').bulkAdd(v1Data.workoutSessions);
    legacy.close();
    localStorage.setItem(LEGACY_PLAN_KEY_PREFIX + SESSION_WITH_PLAN, '{pas du json');

    const current = new AtlasDatabase(dbName);
    expect((await current.workoutSessions.get(SESSION_WITH_PLAN))?.plan).toEqual([]);
    current.close();
  });
});

describe('Historique des versions', () => {
  it('a des numéros de version croissants, sans doublon', () => {
    const numbers = DB_VERSIONS.map((v) => v.version);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(SCHEMA_VERSION).toBe(2);
  });
});
