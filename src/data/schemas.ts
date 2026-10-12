/**
 * Schémas Zod et types TypeScript de toutes les entités.
 * Conventions :
 *  - poids en kg, longueurs en cm, durées en secondes, distances en mètres
 *    (la conversion d'unités se fait uniquement à l'affichage) ;
 *  - dates-heures en ISO 8601 (`2026-10-12T08:30:00.000Z`),
 *    jours calendaires en `AAAA-MM-JJ` (`2026-10-12`).
 */
import { z } from 'zod';
import {
  EQUIPMENT,
  EXERCISE_LEVELS,
  GENERAL_GOALS,
  GOAL_TYPES,
  INPUT_TYPES,
  MEAL_TYPES,
  MEASUREMENTS,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  SEXES,
} from './constants';

const ids = <T extends readonly { id: string }[]>(list: T) =>
  z.enum(list.map((item) => item.id) as [T[number]['id'], ...T[number]['id'][]]);

export const muscleGroupIdSchema = ids(MUSCLE_GROUPS);
export const movementPatternIdSchema = ids(MOVEMENT_PATTERNS);
export const equipmentIdSchema = ids(EQUIPMENT);
export const exerciseLevelIdSchema = ids(EXERCISE_LEVELS);
export const inputTypeIdSchema = ids(INPUT_TYPES);
export const measurementIdSchema = ids(MEASUREMENTS);
export const mealTypeIdSchema = ids(MEAL_TYPES);
export const goalTypeIdSchema = ids(GOAL_TYPES);
export const sexIdSchema = ids(SEXES);
export const generalGoalIdSchema = ids(GENERAL_GOALS);

const isoDateTime = z.iso.datetime();
const day = z.iso.date();
const positive = z.number().nonnegative();

/** Champs communs à tous les enregistrements (prévus pour une future synchro cloud). */
export const baseRecordSchema = z.object({
  id: z.uuid(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  /** Suppression douce : date de suppression, ou null si l'enregistrement est actif. */
  deletedAt: isoDateTime.nullable(),
});

export const muscleSchema = baseRecordSchema.extend({
  name: z.string().min(1),
  /** Groupe musculaire auquel ce muscle appartient. */
  group: muscleGroupIdSchema,
});

export const exerciseSchema = baseRecordSchema.extend({
  name: z.string().min(1),
  aliases: z.array(z.string()),
  equipment: z.array(equipmentIdSchema),
  primaryMuscles: z.array(muscleGroupIdSchema).min(1),
  secondaryMuscles: z.array(muscleGroupIdSchema),
  movementPattern: movementPatternIdSchema,
  level: exerciseLevelIdSchema,
  steps: z.array(z.string()),
  mistakes: z.array(z.string()),
  variations: z.array(z.string()),
  loadAdvice: z.string(),
  safety: z.string(),
  inputType: inputTypeIdSchema,
});

export const routineItemSchema = z.object({
  exerciseId: z.uuid(),
  targetSets: z.number().int().positive(),
  /** Texte libre : « 8-12 », « 5 », « 45 s »… */
  targetReps: z.string(),
  restSeconds: z.number().int().nonnegative().nullable(),
  note: z.string(),
});

export const routineSchema = baseRecordSchema.extend({
  name: z.string().min(1),
  note: z.string(),
  items: z.array(routineItemSchema),
});

/**
 * Ligne du plan d'une séance : un exercice prévu, avec ses objectifs.
 * Copiée du programme au démarrage, puis modifiée librement (exercice ajouté, remplacé, sauté).
 */
export const planItemSchema = routineItemSchema.extend({
  /** Exercice sauté pendant cette séance. */
  skipped: z.boolean(),
});

export const workoutSessionSchema = baseRecordSchema.extend({
  routineId: z.uuid().nullable(),
  name: z.string(),
  startedAt: isoDateTime,
  endedAt: isoDateTime.nullable(),
  note: z.string(),
  /** Exercices prévus, dans l'ordre (vide pour une séance libre). Depuis la version 2. */
  plan: z.array(planItemSchema).default([]),
});

export const setEntrySchema = baseRecordSchema.extend({
  sessionId: z.uuid(),
  exerciseId: z.uuid(),
  /** Position de la série dans la séance (0, 1, 2…). */
  order: z.number().int().nonnegative(),
  /** Charge en kg (lest pour « poids du corps + lest »). */
  weight: positive.nullable(),
  reps: z.number().int().nonnegative().nullable(),
  durationSeconds: positive.nullable(),
  distanceMeters: positive.nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  isWarmup: z.boolean(),
  note: z.string(),
});

export const bodyMetricSchema = baseRecordSchema.extend({
  date: day,
  weightKg: positive.nullable(),
  /** Tour de taille, en cm. */
  waistCm: positive.nullable(),
  measurements: z.partialRecord(measurementIdSchema, positive),
});

/** D'où vient un aliment enregistré. */
export const FOOD_SOURCES = ['manual', 'ciqual', 'openfoodfacts', 'average'] as const;

/** Détail d'un aliment calculé comme moyenne de plusieurs produits (lot aliments). */
export const foodAverageSchema = z.object({
  /** Nombre de produits retenus pour la moyenne. */
  sourceCount: z.number().int().positive(),
  /** Nombre de produits écartés. */
  rejectedCount: z.number().int().nonnegative(),
  confidence: z.enum(['low', 'medium', 'high']),
  /** Cru, cuit, ou inconnu. */
  state: z.enum(['raw', 'cooked', 'unknown']),
  /** Fourchette min-max de chaque nutriment (`kcal`, `proteinG`…), pour 100 g. */
  ranges: z.record(z.string(), z.object({ min: z.number(), max: z.number() })),
  computedAt: isoDateTime,
});

export const foodSchema = baseRecordSchema.extend({
  name: z.string().min(1),
  brand: z.string(),
  barcode: z.string().nullable(),
  /** Valeurs nutritionnelles pour 100 g. */
  kcal: positive,
  proteinG: positive,
  carbsG: positive,
  fatG: positive,
  fiberG: positive.nullable(),
  /** Poids d'une portion habituelle, en grammes. */
  servingG: positive.nullable(),
  /** Origine de l'aliment (null : inconnue, aliments créés avant la version 2). */
  source: z.enum(FOOD_SOURCES).nullable().default(null),
  /** Pour une moyenne (`source: 'average'`) : nombre de produits, fourchettes, confiance. */
  average: foodAverageSchema.nullable().default(null),
});

export const mealItemSchema = z.object({
  foodId: z.uuid(),
  grams: positive,
});

/** Repas enregistré (modèle réutilisable composé d'aliments). */
export const mealSchema = baseRecordSchema.extend({
  name: z.string().min(1),
  items: z.array(mealItemSchema),
});

/** Ligne du journal alimentaire : un aliment mangé tel jour, à tel repas. */
export const foodLogEntrySchema = baseRecordSchema.extend({
  date: day,
  mealType: mealTypeIdSchema,
  foodId: z.uuid(),
  grams: positive,
});

export const goalSchema = baseRecordSchema.extend({
  type: goalTypeIdSchema,
  targetValue: positive,
  targetDate: day.nullable(),
  /** Pour un objectif de charge : l'exercice concerné. */
  exerciseId: z.uuid().nullable(),
  /** Pour un objectif de mensuration : `waist` ou une mensuration. */
  measurement: z.union([z.literal('waist'), measurementIdSchema]).nullable(),
});

export const profileSchema = baseRecordSchema.extend({
  sex: sexIdSchema.nullable(),
  age: z.number().int().positive().nullable(),
  heightCm: positive.nullable(),
  generalGoal: generalGoalIdSchema.nullable(),
});

export const settingsSchema = baseRecordSchema.extend({
  weightUnit: z.enum(['kg', 'lb']),
  lengthUnit: z.enum(['cm', 'in']),
  /** Repos entre deux séries quand le programme n'en précise pas, en secondes. Depuis la version 2. */
  defaultRestSeconds: z.number().int().nonnegative().default(90),
});

/**
 * Aliment de la table de référence CIQUAL (ANSES), valeurs pour 100 g, `null` = inconnue.
 * Donnée de référence re-téléchargeable : pas de champs communs, pas dans les sauvegardes.
 */
export const ciqualFoodSchema = z.object({
  /** Code CIQUAL de l'aliment. */
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  kcal: positive.nullable(),
  proteinG: positive.nullable(),
  carbsG: positive.nullable(),
  fatG: positive.nullable(),
  fiberG: positive.nullable(),
});

export type BaseRecord = z.infer<typeof baseRecordSchema>;
export type Muscle = z.infer<typeof muscleSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type RoutineItem = z.infer<typeof routineItemSchema>;
export type Routine = z.infer<typeof routineSchema>;
export type PlanItem = z.infer<typeof planItemSchema>;
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;
export type SetEntry = z.infer<typeof setEntrySchema>;
export type BodyMetric = z.infer<typeof bodyMetricSchema>;
export type FoodSource = (typeof FOOD_SOURCES)[number];
export type FoodAverage = z.infer<typeof foodAverageSchema>;
export type Food = z.infer<typeof foodSchema>;
export type MealItem = z.infer<typeof mealItemSchema>;
export type Meal = z.infer<typeof mealSchema>;
export type FoodLogEntry = z.infer<typeof foodLogEntrySchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type CiqualFood = z.infer<typeof ciqualFoodSchema>;

/**
 * Champs ajoutés après la version 1 et qui ont une valeur par défaut :
 * facultatifs à la création (`plan: []`, `source: null`, `average: null`, `defaultRestSeconds: 90`).
 */
type DefaultedField = 'plan' | 'source' | 'average' | 'defaultRestSeconds';

/** Données à fournir pour créer un enregistrement (id et dates sont gérés par la couche de données). */
export type NewRecord<T extends BaseRecord> = Omit<T, keyof BaseRecord | DefaultedField> &
  Partial<Pick<T, Extract<keyof T, DefaultedField>>> & { id?: string };
