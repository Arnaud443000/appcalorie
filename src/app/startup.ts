import { seedDemoData } from '@/data';
import { loadExerciseCatalog } from '@/features/exercises/content';
import { restoreCiqualCatalog } from '@/features/nutrition/foods';

/**
 * Prépare les données au démarrage, dans l'ordre : exercices de démonstration, puis les
 * 120 fiches du catalogue (qui prennent le dessus sur la démo, mêmes identifiants),
 * puis remise en mémoire du catalogue CIQUAL enregistré (recherche d'aliments).
 * Chaque étape est indépendante : si l'une échoue, les suivantes sont quand même tentées.
 */
export async function prepareData(): Promise<void> {
  const steps: [string, () => Promise<unknown>][] = [
    ['exercices de démonstration', seedDemoData],
    ['catalogue des exercices', loadExerciseCatalog],
    ['catalogue CIQUAL', restoreCiqualCatalog],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (error) {
      console.error(`Démarrage : échec de l'étape « ${label} »`, error);
    }
  }
}
