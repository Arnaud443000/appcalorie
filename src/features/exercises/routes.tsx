import type { RouteObject } from 'react-router';
import { ExerciseDetailScreen } from './ExerciseDetailScreen';
import { ExercisesScreen } from './ExercisesScreen';

/** Routes de l'onglet Exercices, montées sous son chemin par src/app/router.tsx. */
export const exercisesRoutes: RouteObject[] = [
  { index: true, element: <ExercisesScreen /> },
  { path: ':exerciseId', element: <ExerciseDetailScreen /> },
];
