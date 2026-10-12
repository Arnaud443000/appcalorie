import type {
  BodyMetric,
  CiqualFood,
  Exercise,
  Food,
  FoodLogEntry,
  Goal,
  Meal,
  Muscle,
  NewRecord,
  Routine,
  SetEntry,
  WorkoutSession,
} from '@/data';
import { db } from '@/data';

export async function resetDb() {
  await Promise.all(db.tables.map((table) => table.clear()));
}

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

export const samples = {
  muscle: { name: 'Grand pectoral', group: 'chest' } satisfies NewRecord<Muscle>,
  exercise: {
    name: 'Pompes',
    aliases: ['Push-up'],
    equipment: ['bodyweight'],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps'],
    movementPattern: 'horizontal_push',
    level: 'beginner',
    steps: ['Descendre', 'Pousser'],
    mistakes: ['Bassin bas'],
    variations: ['Pompes déclinées'],
    loadAdvice: '3 × 10',
    safety: 'Poignets alignés',
    inputType: 'reps',
  } satisfies NewRecord<Exercise>,
  routine: {
    name: 'Haut du corps',
    note: '',
    items: [{ exerciseId: ID_A, targetSets: 3, targetReps: '8-12', restSeconds: 90, note: '' }],
  } satisfies NewRecord<Routine>,
  workoutSession: {
    routineId: null,
    name: 'Séance libre',
    startedAt: '2026-10-12T08:00:00.000Z',
    endedAt: null,
    note: '',
    plan: [
      {
        exerciseId: ID_B,
        targetSets: 3,
        targetReps: '8-12',
        restSeconds: 90,
        note: '',
        skipped: false,
      },
    ],
  } satisfies NewRecord<WorkoutSession>,
  setEntry: {
    sessionId: ID_A,
    exerciseId: ID_B,
    order: 0,
    weight: 60,
    reps: 8,
    durationSeconds: null,
    distanceMeters: null,
    rpe: 8,
    isWarmup: false,
    note: '',
  } satisfies NewRecord<SetEntry>,
  bodyMetric: {
    date: '2026-10-12',
    weightKg: 78.4,
    waistCm: 82,
    measurements: { arm: 36, chest: 102 },
  } satisfies NewRecord<BodyMetric>,
  food: {
    name: 'Flocons d’avoine',
    brand: '',
    barcode: null,
    kcal: 370,
    proteinG: 13,
    carbsG: 60,
    fatG: 7,
    fiberG: 10,
    servingG: 50,
  } satisfies NewRecord<Food>,
  averageFood: {
    name: 'Filet de poulet cru',
    brand: '',
    barcode: null,
    kcal: 110,
    proteinG: 23,
    carbsG: 0,
    fatG: 1.5,
    fiberG: null,
    servingG: null,
    source: 'average',
    average: {
      sourceCount: 7,
      rejectedCount: 1,
      confidence: 'medium',
      state: 'raw',
      ranges: { proteinG: { min: 21, max: 24 }, kcal: { min: 104, max: 118 } },
      computedAt: '2026-10-12T08:00:00.000Z',
    },
  } satisfies NewRecord<Food>,
  ciqualFood: {
    id: '36018',
    name: 'Poulet, filet, sans peau, cru',
    category: 'viandes crues',
    kcal: 121,
    proteinG: 23.4,
    carbsG: 0,
    fatG: 2.9,
    fiberG: null,
  } satisfies CiqualFood,
  meal: {
    name: 'Petit-déj habituel',
    items: [{ foodId: ID_A, grams: 80 }],
  } satisfies NewRecord<Meal>,
  foodLogEntry: {
    date: '2026-10-12',
    mealType: 'breakfast',
    foodId: ID_A,
    grams: 80,
  } satisfies NewRecord<FoodLogEntry>,
  goal: {
    type: 'load',
    targetValue: 100,
    targetDate: null,
    exerciseId: ID_B,
    measurement: null,
  } satisfies NewRecord<Goal>,
};
