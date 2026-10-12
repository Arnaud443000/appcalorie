import { ABS_SHEETS } from './abs';
import { ADDUCTORS_SHEETS } from './adductors';
import { BACK_SHEETS } from './back';
import { BICEPS_SHEETS } from './biceps';
import { CALVES_SHEETS } from './calves';
import { CHEST_SHEETS } from './chest';
import { FOREARMS_SHEETS } from './forearms';
import { GLUTES_SHEETS } from './glutes';
import { HAMSTRINGS_SHEETS } from './hamstrings';
import { KETTLEBELL_SHEETS } from './kettlebell';
import { LOWER_BACK_SHEETS } from './lower_back';
import { QUADS_SHEETS } from './quads';
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
  ...LOWER_BACK_SHEETS,
  ...QUADS_SHEETS,
  ...HAMSTRINGS_SHEETS,
  ...GLUTES_SHEETS,
  ...ADDUCTORS_SHEETS,
  ...CALVES_SHEETS,
  ...KETTLEBELL_SHEETS,
];
