import type { SetLike } from './types';

/** Volume d'une série : charge × répétitions. 0 si l'une des deux valeurs manque. */
export function setVolume(set: Pick<SetLike, 'weight' | 'reps'>): number {
  const { weight, reps } = set;
  if (weight == null || reps == null) return 0;
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  return weight * reps;
}

/**
 * Volume d'une séance (en kg) : somme de charge × répétitions.
 * Les séries d'échauffement ne comptent pas. Les séries au poids du corps sans lest
 * (charge vide ou 0) valent 0 : le volume mesure la charge soulevée en plus du corps.
 */
export function sessionVolume(sets: readonly SetLike[]): number {
  return sets.reduce((total, set) => (set.isWarmup ? total : total + setVolume(set)), 0);
}

/** Séries qui comptent pour les statistiques et les records (hors échauffement). */
export function workingSets<T extends Pick<SetLike, 'isWarmup'>>(sets: readonly T[]): T[] {
  return sets.filter((set) => !set.isWarmup);
}
