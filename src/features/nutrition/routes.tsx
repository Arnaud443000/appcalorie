import type { RouteObject } from 'react-router';
import { NutritionScreen } from './NutritionScreen';

/** Routes de l'onglet Nutrition, montées sous son chemin par src/app/router.tsx. */
export const nutritionRoutes: RouteObject[] = [{ index: true, element: <NutritionScreen /> }];
