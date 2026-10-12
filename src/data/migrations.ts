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
import { z } from 'zod';

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
  {
    // Version 2 (intégration vague B) :
    //  - séances : champ `plan` (exercices prévus) et index `endedAt` ;
    //  - aliments : champs `source` et `average` (null pour les anciens) ;
    //  - réglages : `defaultRestSeconds` (90 s) ;
    //  - nouvelle table `ciqualFoods` (référence CIQUAL, hors sauvegarde).
    version: 2,
    stores: {
      workoutSessions: 'id, routineId, startedAt, endedAt, updatedAt',
      ciqualFoods: 'id, name',
    },
    upgrade: async (tx) => {
      await tx
        .table('workoutSessions')
        .toCollection()
        .modify((session: { id: string; plan?: unknown }) => {
          if (!Array.isArray(session.plan)) session.plan = readLegacyPlan(session.id);
        });
      await tx
        .table('foods')
        .toCollection()
        .modify((food: { source?: unknown; average?: unknown }) => {
          food.source ??= null;
          food.average ??= null;
        });
      await tx
        .table('settings')
        .toCollection()
        .modify((settings: { defaultRestSeconds?: unknown }) => {
          settings.defaultRestSeconds ??= 90;
        });
    },
  },
];

/**
 * Avant la version 2, le plan d'une séance était gardé dans le navigateur (localStorage,
 * clé `atlas.workouts.plan.<id>`) par le lot Entraînement. On le reprend s'il est lisible,
 * sinon plan vide. Schéma figé ici (copie de la forme en version 2) : une migration ne doit
 * pas changer si le schéma courant évolue plus tard.
 */
export const LEGACY_PLAN_KEY_PREFIX = 'atlas.workouts.plan.';

const legacyPlanSchema = z.array(
  z.object({
    exerciseId: z.uuid(),
    targetSets: z.number().int().positive(),
    targetReps: z.string(),
    restSeconds: z.number().int().nonnegative().nullable(),
    note: z.string(),
    skipped: z.boolean(),
  }),
);

function readLegacyPlan(sessionId: string): z.infer<typeof legacyPlanSchema> {
  try {
    const raw = globalThis.localStorage?.getItem(LEGACY_PLAN_KEY_PREFIX + sessionId);
    if (!raw) return [];
    const parsed = legacyPlanSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Version actuelle de la base, reprise dans les sauvegardes JSON. */
export const SCHEMA_VERSION = DB_VERSIONS[DB_VERSIONS.length - 1]?.version ?? 1;
