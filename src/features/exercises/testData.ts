import { exerciseRepo, setEntryRepo, workoutSessionRepo, type Exercise } from '@/data';
import { samples } from '@/test/fixtures';

/** Crée trois exercices de test : une paire d'images, une image unique, aucune image. */
export async function seedTestExercises(): Promise<Record<'pair' | 'single' | 'none', Exercise>> {
  const pair = await exerciseRepo.create({
    ...samples.exercise,
    name: 'Pompes test',
    aliases: ['Push-up'],
    imageSlug: 'pompes-test',
    variations: ['Plus facile : Squat test', 'Plus difficile : Pompes lestées inconnues'],
  });
  const single = await exerciseRepo.create({
    ...samples.exercise,
    name: 'Gainage test',
    aliases: [],
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    movementPattern: 'core',
    inputType: 'duration',
    imageSlug: 'gainage-test',
  });
  const none = await exerciseRepo.create({
    ...samples.exercise,
    name: 'Squat test',
    aliases: [],
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes'],
    equipment: ['barbell'],
    movementPattern: 'squat',
    inputType: 'weight_reps',
    imageSlug: undefined,
  });
  // L'écran de la bibliothèque compte aussi cet exercice : on le garde hors du compte (3 au total).
  return { pair, single, none };
}

/** Une séance avec deux séries de squat (80 kg × 5 et 85 kg × 3). */
export async function seedSquatHistory(exerciseId: string) {
  const session = await workoutSessionRepo.create({
    ...samples.workoutSession,
    startedAt: '2026-10-10T08:00:00.000Z',
    endedAt: '2026-10-10T09:00:00.000Z',
  });
  for (const [order, weight, reps] of [
    [0, 80, 5],
    [1, 85, 3],
  ] as const) {
    await setEntryRepo.create({
      ...samples.setEntry,
      sessionId: session.id,
      exerciseId,
      order,
      weight,
      reps,
    });
  }
}
