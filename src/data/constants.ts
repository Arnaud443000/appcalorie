/**
 * Constantes partagées — CONTRAT entre les lots.
 * Les identifiants (`id`) sont stables : ne jamais les renommer ni les supprimer,
 * ils sont enregistrés dans la base et dans les sauvegardes.
 * Les libellés (`label`) peuvent évoluer.
 */

export const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Pectoraux' },
  { id: 'shoulders', label: 'Épaules' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'forearms', label: 'Avant-bras' },
  { id: 'abs', label: 'Abdos' },
  { id: 'traps', label: 'Trapèzes' },
  { id: 'lats', label: 'Dorsaux' },
  { id: 'lower_back', label: 'Lombaires' },
  { id: 'glutes', label: 'Fessiers' },
  { id: 'quads', label: 'Quadriceps' },
  { id: 'hamstrings', label: 'Ischio-jambiers' },
  { id: 'adductors', label: 'Adducteurs' },
  { id: 'calves', label: 'Mollets' },
  { id: 'neck', label: 'Cou' },
] as const;

export type MuscleGroupId = (typeof MUSCLE_GROUPS)[number]['id'];

export const MOVEMENT_PATTERNS = [
  { id: 'horizontal_push', label: 'Poussée horizontale' },
  { id: 'vertical_push', label: 'Poussée verticale' },
  { id: 'vertical_pull', label: 'Tirage vertical' },
  { id: 'horizontal_pull', label: 'Tirage horizontal' },
  { id: 'elbow_flexion', label: 'Flexion de coude' },
  { id: 'elbow_extension', label: 'Extension de coude' },
  { id: 'squat', label: 'Squat / presse' },
  { id: 'hip_hinge', label: 'Charnière de hanche' },
  { id: 'lunge', label: 'Fente' },
  { id: 'arm_raise', label: 'Élévation de bras' },
  { id: 'core', label: 'Gainage / abdos' },
  { id: 'calves', label: 'Mollets' },
] as const;

export type MovementPatternId = (typeof MOVEMENT_PATTERNS)[number]['id'];

export const EQUIPMENT = [
  { id: 'bodyweight', label: 'Poids du corps' },
  { id: 'dumbbell', label: 'Haltères' },
  { id: 'barbell', label: 'Barre' },
  { id: 'machine', label: 'Machine' },
  { id: 'cable', label: 'Poulie' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'band', label: 'Élastique' },
  { id: 'cardio', label: 'Cardio' },
] as const;

export type EquipmentId = (typeof EQUIPMENT)[number]['id'];

export const EXERCISE_LEVELS = [
  { id: 'beginner', label: 'Débutant' },
  { id: 'intermediate', label: 'Intermédiaire' },
  { id: 'advanced', label: 'Avancé' },
] as const;

export type ExerciseLevelId = (typeof EXERCISE_LEVELS)[number]['id'];

/** Comment on saisit une série pour cet exercice. */
export const INPUT_TYPES = [
  { id: 'weight_reps', label: 'Charge + répétitions' },
  { id: 'reps', label: 'Répétitions' },
  { id: 'duration', label: 'Durée' },
  { id: 'distance', label: 'Distance' },
  { id: 'bodyweight_load', label: 'Poids du corps + lest' },
] as const;

export type InputTypeId = (typeof INPUT_TYPES)[number]['id'];

/** Mensurations suivies (en cm). Le tour de taille a son propre champ. */
export const MEASUREMENTS = [
  { id: 'neck', label: 'Cou' },
  { id: 'shoulders', label: 'Épaules' },
  { id: 'chest', label: 'Poitrine' },
  { id: 'arm', label: 'Bras' },
  { id: 'forearm', label: 'Avant-bras' },
  { id: 'hips', label: 'Hanches' },
  { id: 'thigh', label: 'Cuisse' },
  { id: 'calf', label: 'Mollet' },
] as const;

export type MeasurementId = (typeof MEASUREMENTS)[number]['id'];

export const MEAL_TYPES = [
  { id: 'breakfast', label: 'Petit-déjeuner' },
  { id: 'lunch', label: 'Déjeuner' },
  { id: 'dinner', label: 'Dîner' },
  { id: 'snack', label: 'Collation' },
] as const;

export type MealTypeId = (typeof MEAL_TYPES)[number]['id'];

export const GOAL_TYPES = [
  { id: 'weight', label: 'Poids' },
  { id: 'load', label: 'Charge' },
  { id: 'measurement', label: 'Mensuration' },
  { id: 'calories', label: 'Calories' },
] as const;

export type GoalTypeId = (typeof GOAL_TYPES)[number]['id'];

export const SEXES = [
  { id: 'male', label: 'Homme' },
  { id: 'female', label: 'Femme' },
] as const;

export type SexId = (typeof SEXES)[number]['id'];

export const GENERAL_GOALS = [
  { id: 'fat_loss', label: 'Perte de gras' },
  { id: 'maintenance', label: 'Maintien' },
  { id: 'muscle_gain', label: 'Prise de muscle' },
  { id: 'recomposition', label: 'Recomposition' },
] as const;

export type GeneralGoalId = (typeof GENERAL_GOALS)[number]['id'];

/** Retrouve le libellé français d'un identifiant dans une des listes ci-dessus. */
export function labelOf<T extends { id: string; label: string }>(
  list: readonly T[],
  id: T['id'],
): string {
  return list.find((item) => item.id === id)?.label ?? id;
}
