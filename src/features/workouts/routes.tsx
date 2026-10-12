import type { RouteObject } from 'react-router';
import { WorkoutsScreen } from './WorkoutsScreen';

/** Routes de l'onglet Entraînement, montées sous son chemin par src/app/router.tsx. */
export const workoutsRoutes: RouteObject[] = [{ index: true, element: <WorkoutsScreen /> }];
