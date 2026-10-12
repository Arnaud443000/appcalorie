import { createHashRouter, type RouteObject } from 'react-router';
import { exercisesRoutes } from '../features/exercises/routes';
import { nutritionRoutes } from '../features/nutrition/routes';
import { trackingRoutes } from '../features/tracking/routes';
import { workoutsRoutes } from '../features/workouts/routes';
import { AppLayout } from './AppLayout';
import { SettingsScreen } from './screens/SettingsScreen';
import { TodayScreen } from './screens/TodayScreen';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'reglages', element: <SettingsScreen /> },
      { path: 'entrainement', children: workoutsRoutes },
      { path: 'exercices', children: exercisesRoutes },
      { path: 'nutrition', children: nutritionRoutes },
      { path: 'suivi', children: trackingRoutes },
      { path: '*', element: <TodayScreen /> },
    ],
  },
];

/**
 * Routeur « hash » (#/exercices) : fonctionne sur GitHub Pages et hors ligne
 * sans configuration serveur.
 */
export function createAppRouter() {
  return createHashRouter(routes);
}
