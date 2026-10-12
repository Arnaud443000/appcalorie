import Dexie, { type Table } from 'dexie';
import { DB_VERSIONS } from './migrations';
import {
  bodyMetricSchema,
  type CiqualFood,
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
  type BodyMetric,
  type Exercise,
  type Food,
  type FoodLogEntry,
  type Goal,
  type Meal,
  type Muscle,
  type Profile,
  type Routine,
  type SetEntry,
  type Settings,
  type WorkoutSession,
} from './schemas';

/**
 * Chaque table de la base et le schéma Zod qui valide ses enregistrements.
 * Ce sont les tables de l'utilisateur, celles de la sauvegarde JSON.
 * `ciqualFoods` (donnée de référence re-téléchargeable) n'en fait volontairement pas partie.
 */
export const TABLE_SCHEMAS = {
  muscles: muscleSchema,
  exercises: exerciseSchema,
  routines: routineSchema,
  workoutSessions: workoutSessionSchema,
  setEntries: setEntrySchema,
  bodyMetrics: bodyMetricSchema,
  foods: foodSchema,
  meals: mealSchema,
  foodLogEntries: foodLogEntrySchema,
  goals: goalSchema,
  profiles: profileSchema,
  settings: settingsSchema,
} as const;

export type TableName = keyof typeof TABLE_SCHEMAS;
export const TABLE_NAMES = Object.keys(TABLE_SCHEMAS) as TableName[];

export class AtlasDatabase extends Dexie {
  declare muscles: Table<Muscle, string>;
  declare exercises: Table<Exercise, string>;
  declare routines: Table<Routine, string>;
  declare workoutSessions: Table<WorkoutSession, string>;
  declare setEntries: Table<SetEntry, string>;
  declare bodyMetrics: Table<BodyMetric, string>;
  declare foods: Table<Food, string>;
  declare meals: Table<Meal, string>;
  declare foodLogEntries: Table<FoodLogEntry, string>;
  declare goals: Table<Goal, string>;
  declare profiles: Table<Profile, string>;
  declare settings: Table<Settings, string>;
  /** Référence CIQUAL : hors sauvegarde (voir TABLE_SCHEMAS). */
  declare ciqualFoods: Table<CiqualFood, string>;

  constructor(name = 'atlas-muscu') {
    super(name);
    for (const { version, stores, upgrade } of DB_VERSIONS) {
      const v = this.version(version).stores(stores);
      if (upgrade) v.upgrade(upgrade);
    }
  }
}

/** Base unique de l'application. */
export const db = new AtlasDatabase();
