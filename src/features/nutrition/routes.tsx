import type { RouteObject } from 'react-router';
import { NutritionScreen } from './NutritionScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { WeekScreen } from './screens/WeekScreen';

/** Routes de l'onglet Nutrition, montées sous son chemin par src/app/router.tsx. */
export const nutritionRoutes: RouteObject[] = [
  { index: true, element: <NutritionScreen /> }, //            #/nutrition
  { path: 'semaine', element: <WeekScreen /> }, //             #/nutrition/semaine
  { path: 'catalogue', element: <CatalogScreen /> }, //        #/nutrition/catalogue
];
