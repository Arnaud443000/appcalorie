import type { IndexableType, Table } from 'dexie';
import type { z } from 'zod';
import type { BaseRecord, NewRecord } from './schemas';

export interface Repository<T extends BaseRecord> {
  /** Crée un enregistrement (id UUID et dates ajoutés automatiquement). */
  create(input: NewRecord<T>): Promise<T>;
  /** Lit un enregistrement actif (undefined s'il n'existe pas ou a été supprimé). */
  get(id: string): Promise<T | undefined>;
  /** Tous les enregistrements actifs. */
  list(): Promise<T[]>;
  /** Enregistrements actifs dont l'index `index` vaut `value`. */
  findBy(index: string, value: IndexableType): Promise<T[]>;
  /** Modifie les champs donnés ; `updatedAt` est mis à jour. */
  update(id: string, patch: Partial<NewRecord<T>>): Promise<T>;
  /** Suppression douce : renseigne `deletedAt`, l'enregistrement reste en base. */
  remove(id: string): Promise<void>;
}

const now = () => new Date().toISOString();
const isActive = (record: BaseRecord) => record.deletedAt === null;

export function createRepository<T extends BaseRecord>(
  table: Table<T, string>,
  schema: z.ZodType<T>,
): Repository<T> {
  async function getExisting(id: string): Promise<T> {
    const record = await table.get(id);
    if (!record || !isActive(record)) {
      throw new Error(`${table.name} : enregistrement introuvable (${id}).`);
    }
    return record;
  }

  return {
    async create(input) {
      const timestamp = now();
      const record = schema.parse({
        ...input,
        id: input.id ?? crypto.randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      });
      await table.add(record);
      return record;
    },

    async get(id) {
      const record = await table.get(id);
      return record && isActive(record) ? record : undefined;
    },

    async list() {
      return table.filter(isActive).toArray();
    },

    async findBy(index, value) {
      return table.where(index).equals(value).filter(isActive).toArray();
    },

    // Lecture et écriture dans la même transaction : deux modifications simultanées
    // (ex. plan de séance et fin de séance) ne s'écrasent pas.
    async update(id, patch) {
      return table.db.transaction('rw', table, async () => {
        const existing = await getExisting(id);
        const record = schema.parse({
          ...existing,
          ...patch,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: now(),
          deletedAt: null,
        });
        await table.put(record);
        return record;
      });
    },

    async remove(id) {
      await table.db.transaction('rw', table, async () => {
        const existing = await getExisting(id);
        const timestamp = now();
        await table.put({ ...existing, deletedAt: timestamp, updatedAt: timestamp });
      });
    },
  };
}
