import { z } from 'zod';
import type { InputType, RoutineItem } from '@/data';

/**
 * Plan d'une séance : la liste des exercices prévus, dans l'ordre.
 * Il est copié depuis le programme au démarrage, puis modifié librement
 * (exercice ajouté, remplacé ou sauté) sans toucher au programme lui-même.
 */
export const planItemSchema = z.object({
  exerciseId: z.uuid(),
  targetSets: z.number().int().positive(),
  targetReps: z.string(),
  restSeconds: z.number().int().nonnegative().nullable(),
  note: z.string(),
  skipped: z.boolean(),
});
export const planSchema = z.array(planItemSchema);

export type PlanItem = z.infer<typeof planItemSchema>;
export type Plan = PlanItem[];

export const DEFAULT_TARGET_SETS = 3;

/** Objectif proposé quand on ajoute un exercice à un programme, selon son type de saisie. */
export function defaultTarget(inputType: InputType): string {
  switch (inputType) {
    case 'weight_reps':
    case 'bodyweight_load':
      return '8-12';
    case 'reps':
      return '10-15';
    case 'duration':
      return '45 s';
    case 'distance':
    case 'weight_distance':
      return '';
  }
}

export function planFromRoutine(items: readonly RoutineItem[]): Plan {
  return items.map((item) => ({ ...item, skipped: false }));
}

/** Lit un plan enregistré (JSON inconnu) ; `null` si le contenu est invalide. */
export function parsePlan(value: unknown): Plan | null {
  const result = planSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function newPlanItem(exerciseId: string): PlanItem {
  return {
    exerciseId,
    targetSets: DEFAULT_TARGET_SETS,
    targetReps: '',
    restSeconds: null,
    note: '',
    skipped: false,
  };
}

/** Ajoute un exercice en fin de plan (ignoré s'il y est déjà). */
export function addToPlan(plan: Plan, exerciseId: string): Plan {
  if (plan.some((item) => item.exerciseId === exerciseId)) return plan;
  return [...plan, newPlanItem(exerciseId)];
}

/** Remplace un exercice par un autre, au même endroit, en gardant les objectifs. */
export function replaceInPlan(plan: Plan, fromId: string, toId: string): Plan {
  if (fromId === toId) return plan;
  if (plan.some((item) => item.exerciseId === toId)) return plan;
  return plan.map((item) => (item.exerciseId === fromId ? { ...item, exerciseId: toId } : item));
}

export function setSkipped(plan: Plan, exerciseId: string, skipped: boolean): Plan {
  return plan.map((item) => (item.exerciseId === exerciseId ? { ...item, skipped } : item));
}

export interface ExerciseBlock<S> {
  exerciseId: string;
  /** Objectifs prévus (null pour un exercice fait sans être prévu). */
  item: PlanItem | null;
  /** Séries enregistrées, dans l'ordre. */
  sets: S[];
  skipped: boolean;
}

/**
 * Blocs d'exercices de la séance : d'abord ceux du plan (dans l'ordre), puis ceux qui ont des séries
 * sans être au plan (par exemple après un remplacement), dans l'ordre de leur première série.
 */
export function buildBlocks<S extends { exerciseId: string; order: number }>(
  plan: Plan,
  sets: readonly S[],
): ExerciseBlock<S>[] {
  const sorted = [...sets].sort((a, b) => a.order - b.order);
  const byExercise = new Map<string, S[]>();
  for (const set of sorted) {
    const list = byExercise.get(set.exerciseId);
    if (list) list.push(set);
    else byExercise.set(set.exerciseId, [set]);
  }
  const blocks: ExerciseBlock<S>[] = plan.map((item) => ({
    exerciseId: item.exerciseId,
    item,
    sets: byExercise.get(item.exerciseId) ?? [],
    skipped: item.skipped && !byExercise.has(item.exerciseId),
  }));
  const planned = new Set(plan.map((item) => item.exerciseId));
  for (const [exerciseId, list] of byExercise) {
    if (!planned.has(exerciseId))
      blocks.push({ exerciseId, item: null, sets: list, skipped: false });
  }
  return blocks;
}

/**
 * Plan d'une nouvelle séance copiée depuis une séance passée : mêmes exercices, même ordre,
 * même nombre de séries de travail. Les objectifs de répétitions et de repos reviennent
 * du programme d'origine quand il existe encore.
 */
export function planFromSets(
  sets: readonly { exerciseId: string; order: number; isWarmup: boolean }[],
  routineItems: readonly RoutineItem[] = [],
): Plan {
  const sorted = [...sets].sort((a, b) => a.order - b.order);
  const counts = new Map<string, number>();
  for (const set of sorted) {
    counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + (set.isWarmup ? 0 : 1));
  }
  return [...counts].map(([exerciseId, working]) => {
    const original = routineItems.find((item) => item.exerciseId === exerciseId);
    return {
      exerciseId,
      targetSets: Math.max(1, working),
      targetReps: original?.targetReps ?? '',
      restSeconds: original?.restSeconds ?? null,
      note: original?.note ?? '',
      skipped: false,
    };
  });
}
