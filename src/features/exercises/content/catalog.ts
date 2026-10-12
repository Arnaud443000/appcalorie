import { ABS_SHEETS } from './abs';
import { BACK_SHEETS } from './back';
import { BICEPS_SHEETS } from './biceps';
import { CHEST_SHEETS } from './chest';
import { FOREARMS_SHEETS } from './forearms';
import { SHOULDERS_SHEETS } from './shoulders';
import { TRICEPS_SHEETS } from './triceps';
import type { ExerciseSheet } from './types';

/** Les 120 fiches d'exercices de l'application (identifiants fixes, voir types.ts). */
export const EXERCISE_CATALOG: ExerciseSheet[] = [
  ...CHEST_SHEETS,
  ...BACK_SHEETS,
  ...SHOULDERS_SHEETS,
  ...BICEPS_SHEETS,
  ...TRICEPS_SHEETS,
  ...FOREARMS_SHEETS,
  ...ABS_SHEETS,
];
