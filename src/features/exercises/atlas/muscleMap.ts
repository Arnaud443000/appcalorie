import { MUSCLE_GROUPS, type Exercise, type MuscleGroupId } from '@/data';

/** Mise en avant d'un groupe sur le corps : rouge (principal) ou rose (secondaire). */
export type Emphasis = 'primary' | 'secondary';
export type Highlight = Partial<Record<MuscleGroupId, Emphasis>>;

/** Les quatre vues proposées. Gauche / droite = côté gauche / droit du corps face à toi. */
export type ViewName = 'front' | 'back' | 'left' | 'right';

/** Groupes surtout visibles de dos : le corps se retourne quand on les choisit. */
const BACK_GROUPS: ReadonlySet<MuscleGroupId> = new Set([
  'triceps',
  'traps',
  'lats',
  'lower_back',
  'glutes',
  'hamstrings',
  'calves',
]);

export function preferredView(group: MuscleGroupId): ViewName {
  return BACK_GROUPS.has(group) ? 'back' : 'front';
}

const byName = (a: Exercise, b: Exercise) =>
  a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });

/**
 * Exercices qui travaillent un groupe : d'abord ceux où c'est un muscle principal,
 * puis ceux où il n'est que secondaire. Chaque liste est triée par nom.
 */
export function exercisesForGroup(
  exercises: readonly Exercise[],
  group: MuscleGroupId,
): { primary: Exercise[]; secondary: Exercise[] } {
  const primary = exercises.filter((exercise) => exercise.primaryMuscles.includes(group));
  const secondary = exercises.filter(
    (exercise) =>
      !exercise.primaryMuscles.includes(group) && exercise.secondaryMuscles.includes(group),
  );
  return { primary: primary.sort(byName), secondary: secondary.sort(byName) };
}

/**
 * Muscles « sollicités aussi » quand on travaille un groupe : ceux qui accompagnent ce groupe
 * (en principal ou en secondaire) dans au moins `minShare` des exercices où il est principal.
 * Au plus `max` groupes, les plus fréquents d'abord.
 */
export function synergistsOf(
  exercises: readonly Exercise[],
  group: MuscleGroupId,
  { minShare = 0.4, max = 3 }: { minShare?: number; max?: number } = {},
): MuscleGroupId[] {
  const working = exercises.filter((exercise) => exercise.primaryMuscles.includes(group));
  if (working.length === 0) return [];
  const counts = new Map<MuscleGroupId, number>();
  for (const exercise of working) {
    const others = new Set([...exercise.primaryMuscles, ...exercise.secondaryMuscles]);
    others.delete(group);
    for (const other of others) counts.set(other, (counts.get(other) ?? 0) + 1);
  }
  const order = (id: MuscleGroupId) => MUSCLE_GROUPS.findIndex((item) => item.id === id);
  return [...counts]
    .filter(([, count]) => count / working.length >= minShare)
    .sort(([a, countA], [b, countB]) => countB - countA || order(a) - order(b))
    .slice(0, max)
    .map(([id]) => id);
}

/** Groupe choisi en rouge, groupes qui l'accompagnent en rose. */
export function groupHighlight(
  group: MuscleGroupId,
  synergists: readonly MuscleGroupId[],
): Highlight {
  const highlight: Highlight = {};
  for (const id of synergists) highlight[id] = 'secondary';
  highlight[group] = 'primary';
  return highlight;
}

/** Muscles principaux d'un exercice en rouge, secondaires en rose. */
export function exerciseHighlight(
  exercise: Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>,
): Highlight {
  const highlight: Highlight = {};
  for (const id of exercise.secondaryMuscles) highlight[id] = 'secondary';
  for (const id of exercise.primaryMuscles) highlight[id] = 'primary';
  return highlight;
}

/** Groupes d'une mise en avant, dans l'ordre de MUSCLE_GROUPS. */
export function groupsWith(highlight: Highlight, emphasis: Emphasis): MuscleGroupId[] {
  return MUSCLE_GROUPS.map((item) => item.id).filter((id) => highlight[id] === emphasis);
}
