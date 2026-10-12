import type { Table } from 'dexie';
import { db } from './db';
import { createRepository, type Repository } from './repository';
import {
  bodyMetricSchema,
  exerciseSchema,
  foodLogEntrySchema,
  foodSchema,
  goalSchema,
  mealSchema,
  muscleSchema,
  profileSchema,
  routineSchema,
  setEntrySchema,
  settingsSchema,
  workoutSessionSchema,
  type BaseRecord,
  type NewRecord,
  type Profile,
  type Settings,
} from './schemas';

export const muscleRepo = createRepository(db.muscles, muscleSchema);
export const exerciseRepo = createRepository(db.exercises, exerciseSchema);
export const routineRepo = createRepository(db.routines, routineSchema);
export const workoutSessionRepo = createRepository(db.workoutSessions, workoutSessionSchema);
export const setEntryRepo = createRepository(db.setEntries, setEntrySchema);
export const bodyMetricRepo = createRepository(db.bodyMetrics, bodyMetricSchema);
export const foodRepo = createRepository(db.foods, foodSchema);
export const mealRepo = createRepository(db.meals, mealSchema);
export const foodLogEntryRepo = createRepository(db.foodLogEntries, foodLogEntrySchema);
export const goalRepo = createRepository(db.goals, goalSchema);

const profileRepo = createRepository(db.profiles, profileSchema);
const settingsRepo = createRepository(db.settings, settingsSchema);

export const DEFAULT_PROFILE: NewRecord<Profile> = {
  sex: null,
  age: null,
  heightCm: null,
  generalGoal: null,
};

export const DEFAULT_SETTINGS: NewRecord<Settings> = {
  weightUnit: 'kg',
  lengthUnit: 'cm',
};

/** Profil et Réglages sont uniques : on les crée avec des valeurs par défaut au premier accès. */
function singleton<T extends BaseRecord>(
  repo: Repository<T>,
  table: Table<T, string>,
  defaults: NewRecord<T>,
) {
  async function get(): Promise<T> {
    return db.transaction('rw', table, async () => {
      const [existing] = await repo.list();
      return existing ?? repo.create(defaults);
    });
  }
  async function save(patch: Partial<NewRecord<T>>): Promise<T> {
    const current = await get();
    return repo.update(current.id, patch);
  }
  return { get, save };
}

const profile = singleton(profileRepo, db.profiles, DEFAULT_PROFILE);
const settings = singleton(settingsRepo, db.settings, DEFAULT_SETTINGS);

export const getProfile = profile.get;
export const saveProfile = profile.save;
export const getSettings = settings.get;
export const saveSettings = settings.save;
