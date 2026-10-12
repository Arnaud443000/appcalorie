import { db, exerciseSchema } from '@/data';
import { EXERCISE_CATALOG } from './catalog';

/**
 * Charge le catalogue dans la base : ajoute les fiches absentes, met à jour les autres
 * (par identifiant). Une fiche que l'utilisateur a supprimée n'est pas recréée.
 * À appeler au démarrage (voir DEMANDES.md). Peut être relancé sans risque.
 */
export async function loadExerciseCatalog(): Promise<{ added: number; updated: number }> {
  return db.transaction('rw', db.exercises, async () => {
    const existing = await db.exercises.bulkGet(EXERCISE_CATALOG.map((e) => e.id));
    const now = new Date().toISOString();
    let added = 0;
    let updated = 0;
    const records = EXERCISE_CATALOG.map((sheet, i) => {
      const previous = existing[i];
      if (previous) updated += 1;
      else added += 1;
      return exerciseSchema.parse({
        ...sheet,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        deletedAt: previous?.deletedAt ?? null,
      });
    });
    await db.exercises.bulkPut(records);
    return { added, updated };
  });
}
