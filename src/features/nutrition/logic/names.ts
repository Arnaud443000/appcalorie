import type { FoodState } from '../foods';

const STATE_WORD: Record<FoodState, string> = { raw: 'cru', cooked: 'cuit', unknown: '' };

/** Nom proposé pour une moyenne : la recherche avec une majuscule, + « cru » / « cuit » si l'état est connu et absent. */
export function defaultAverageName(query: string, state: FoodState): string {
  const base = query.trim().replace(/\s+/g, ' ');
  const word = STATE_WORD[state];
  const named = word && !new RegExp(`\\b${word}e?s?\\b`, 'i').test(base) ? `${base} ${word}` : base;
  return named.charAt(0).toUpperCase() + named.slice(1);
}
