/** Point d'entrée unique de la couche de données : importer depuis 'src/data' (jamais ses fichiers internes). */
export * from './constants';
export * from './schemas';
export { db, TABLE_NAMES, TABLE_SCHEMAS, type TableName } from './db';
export { SCHEMA_VERSION } from './migrations';
export { type Repository } from './repository';
export * from './repositories';
export {
  BACKUP_FORMAT,
  exportData,
  exportToJson,
  importData,
  importFromJson,
  type Backup,
} from './backup';
export { DEMO_EXERCISES, seedDemoData } from './seed';
export * from './training';
