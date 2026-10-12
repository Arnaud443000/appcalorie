import { findExerciseByName, type Exercise } from '@/data';

export interface ParsedVariation {
  /** « Plus facile », « Plus difficile », « Autre matériel »… ou null. */
  kind: string | null;
  /** Nom de la variante, sans le préfixe. */
  name: string;
  /** Fiche retrouvée par son nom ou un alias. */
  target: Exercise | undefined;
}

const PREFIX = /^(Plus facile|Plus difficile|Autre matériel)\s*:\s*/i;

/** Sépare le préfixe d'une variante et retrouve la fiche correspondante (si elle existe). */
export function parseVariation(text: string, all: readonly Exercise[]): ParsedVariation {
  const match = PREFIX.exec(text);
  const name = match ? text.slice(match[0].length).trim() : text.trim();
  return { kind: match?.[1] ?? null, name, target: findExerciseByName(all, name) };
}
