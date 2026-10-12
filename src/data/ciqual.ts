import { db } from './db';
import { ciqualFoodSchema, type CiqualFood } from './schemas';

/**
 * Table de référence CIQUAL (environ 3 000 aliments génériques).
 * Pas de suppression douce ni de dates : elle est remplacée d'un bloc à chaque nouveau fichier,
 * et n'est jamais incluse dans l'export / import de sauvegarde.
 */
export const ciqualFoodRepo = {
  /** Remplace toute la table. Tout est vérifié avant d'écrire : un aliment invalide ne change rien. */
  async replaceAll(foods: readonly CiqualFood[]): Promise<void> {
    const valid = foods.map((food) => ciqualFoodSchema.parse(food));
    await db.transaction('rw', db.ciqualFoods, async () => {
      await db.ciqualFoods.clear();
      await db.ciqualFoods.bulkPut(valid);
    });
  },

  /** Tous les aliments CIQUAL enregistrés (liste vide si le fichier n'a jamais été chargé). */
  list(): Promise<CiqualFood[]> {
    return db.ciqualFoods.toArray();
  },

  count(): Promise<number> {
    return db.ciqualFoods.count();
  },
};
