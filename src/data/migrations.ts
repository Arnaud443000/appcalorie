/**
 * Historique des versions de la base IndexedDB.
 *
 * Pour faire évoluer la base : NE JAMAIS modifier une version existante.
 * Ajouter une nouvelle entrée à la fin, avec les index modifiés et,
 * si besoin, une fonction `upgrade` qui transforme les données existantes.
 * Exemple :
 *   {
 *     version: 2,
 *     stores: { exercises: 'id, name, movementPattern, *primaryMuscles, *equipment, updatedAt' },
 *     upgrade: (tx) => tx.table('exercises').toCollection().modify((e) => { e.nouveauChamp = ''; }),
 *   }
 * Puis mettre à jour les schémas Zod (schemas.ts) en conséquence.
 *
 * Syntaxe des index Dexie : premier = clé primaire, `*champ` = index sur un tableau.
 * `deletedAt` n'est pas indexé (null n'est pas une clé IndexedDB valide).
 */
import type { Transaction } from 'dexie';

export interface DbVersion {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => PromiseLike<unknown> | undefined;
}

export const DB_VERSIONS: DbVersion[] = [
  {
    version: 1,
    stores: {
      muscles: 'id, group, updatedAt',
      exercises: 'id, name, movementPattern, *primaryMuscles, updatedAt',
      routines: 'id, name, updatedAt',
      workoutSessions: 'id, routineId, startedAt, updatedAt',
      setEntries: 'id, sessionId, exerciseId, updatedAt',
      bodyMetrics: 'id, date, updatedAt',
      foods: 'id, name, barcode, updatedAt',
      meals: 'id, name, updatedAt',
      foodLogEntries: 'id, date, foodId, updatedAt',
      goals: 'id, type, updatedAt',
      profiles: 'id, updatedAt',
      settings: 'id, updatedAt',
    },
  },
];

/** Version actuelle de la base, reprise dans les sauvegardes JSON. */
export const SCHEMA_VERSION = DB_VERSIONS[DB_VERSIONS.length - 1]?.version ?? 1;
