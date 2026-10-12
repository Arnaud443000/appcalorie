import { BACK_SHEETS } from './back';
import { CHEST_SHEETS } from './chest';
import type { ExerciseSheet } from './types';

/** Les 120 fiches d'exercices de l'application (identifiants fixes, voir types.ts). */
export const EXERCISE_CATALOG: ExerciseSheet[] = [...CHEST_SHEETS, ...BACK_SHEETS];
