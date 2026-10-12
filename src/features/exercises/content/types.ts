import type { Exercise, NewRecord } from '@/data';

/** Une fiche du catalogue : un exercice complet avec son identifiant fixe. */
export type ExerciseSheet = NewRecord<Exercise> & { id: string };

/**
 * Identifiant fixe d'une fiche : `0d1e1a00-0000-4000-8000-` + numéro sur 12 chiffres.
 * Les numéros 1 à 5 sont ceux des exercices de démonstration (src/data/seed.ts).
 * Un identifiant ne change JAMAIS : l'historique des séances s'y réfère.
 */
export function exerciseId(n: number): string {
  return `0d1e1a00-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Fabrique une fiche à partir de son numéro et de son contenu. */
export function sheet(n: number, content: NewRecord<Exercise>): ExerciseSheet {
  return { ...content, id: exerciseId(n) };
}
