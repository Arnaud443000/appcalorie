import { z } from 'zod';
import { db, TABLE_NAMES, TABLE_SCHEMAS, type TableName } from './db';
import { SCHEMA_VERSION } from './migrations';

export const BACKUP_FORMAT = 'atlas-muscu-backup';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  /** Tous les enregistrements, y compris ceux supprimés en douceur. */
  tables: Record<TableName, unknown[]>;
}

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().positive().max(SCHEMA_VERSION, {
    message: "Cette sauvegarde vient d'une version plus récente de l'app.",
  }),
  exportedAt: z.iso.datetime(),
  tables: z.object(
    Object.fromEntries(
      TABLE_NAMES.map((name) => [name, z.array(TABLE_SCHEMAS[name]).default([])]),
    ) as { [K in TableName]: z.ZodDefault<z.ZodArray<(typeof TABLE_SCHEMAS)[K]>> },
  ),
});

/** Exporte toute la base dans un objet sérialisable en JSON. */
export async function exportData(): Promise<Backup> {
  const tables = {} as Record<TableName, unknown[]>;
  await db.transaction('r', db.tables, async () => {
    for (const name of TABLE_NAMES) {
      tables[name] = await db.table(name).toArray();
    }
  });
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export async function exportToJson(): Promise<string> {
  return JSON.stringify(await exportData(), null, 2);
}

/**
 * Remplace TOUTES les données par celles de la sauvegarde.
 * Tout est vérifié avant d'écrire : si un seul enregistrement est invalide, rien n'est modifié.
 */
export async function importData(input: unknown): Promise<void> {
  const backup = backupSchema.parse(input);
  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLE_NAMES) {
      const table = db.table(name);
      await table.clear();
      await table.bulkAdd(backup.tables[name]);
    }
  });
}

export async function importFromJson(json: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde valide (JSON illisible).");
  }
  await importData(parsed);
}
