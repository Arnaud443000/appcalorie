import { seedDemoData, seedMyProgram } from '@/data';
import { loadExerciseCatalog } from '@/features/exercises/content';
import { restoreCiqualCatalog } from '@/features/nutrition/foods';

async function step(label: string, run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (error) {
    console.error(`Démarrage : échec de l'étape « ${label} »`, error);
    return false;
  }
}

/**
 * Prépare les données au démarrage, dans l'ordre :
 * 1. exercices de démonstration ;
 * 2. les 120 fiches du catalogue (qui prennent le dessus sur la démo, mêmes identifiants) ;
 * 3. mes 5 programmes, une seule fois (seulement si les fiches sont bien chargées,
 *    pour retrouver les exercices par leur nom) ;
 * 4. remise en mémoire du catalogue CIQUAL enregistré (recherche d'aliments).
 * Une étape qui échoue n'empêche pas les suivantes (sauf 3, qui dépend de 2).
 */
export async function prepareData(): Promise<void> {
  await step('exercices de démonstration', seedDemoData);
  if (await step('catalogue des exercices', loadExerciseCatalog)) {
    await step('mes programmes', seedMyProgram);
  }
  await step('catalogue CIQUAL', restoreCiqualCatalog);
}
