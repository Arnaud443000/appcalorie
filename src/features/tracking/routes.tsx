import type { RouteObject } from 'react-router';
import { TrackingScreen } from './TrackingScreen';

/** Routes de l'onglet Suivi, montées sous son chemin par src/app/router.tsx. */
export const trackingRoutes: RouteObject[] = [{ index: true, element: <TrackingScreen /> }];
