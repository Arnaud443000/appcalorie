import type { RouteObject } from 'react-router';
import { ActiveSessionScreen } from './screens/ActiveSessionScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { RoutineEditScreen } from './screens/RoutineEditScreen';
import { SessionDetailScreen } from './screens/SessionDetailScreen';
import { WorkoutsScreen } from './screens/WorkoutsScreen';

/** Routes de l'onglet Entraînement, montées sous son chemin par src/app/router.tsx. */
export const workoutsRoutes: RouteObject[] = [
  { index: true, element: <WorkoutsScreen /> }, //  #/entrainement
  { path: 'programmes/nouveau', element: <RoutineEditScreen /> },
  { path: 'programmes/:routineId', element: <RoutineEditScreen /> },
  { path: 'seance/:sessionId', element: <ActiveSessionScreen /> },
  { path: 'historique', element: <HistoryScreen /> },
  { path: 'historique/:sessionId', element: <SessionDetailScreen /> },
  { path: 'records', element: <RecordsScreen /> },
];
