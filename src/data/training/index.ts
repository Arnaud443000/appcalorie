/**
 * Logique pure de l'entraînement (sans React ni base de données), partagée entre les lots :
 * 1RM, volume, records, suggestion de charge, dernière performance, fourchettes de répétitions,
 * formatage (nombres, poids kg/lb, durées, distances, dates).
 * Venue du lot Entraînement (src/features/workouts/logic), voir docs/CONTRACTS.md.
 */
export * from './format';
export * from './lastPerformance';
export * from './oneRepMax';
export * from './recordFormat';
export * from './records';
export * from './repRange';
export * from './suggestion';
export * from './types';
export * from './volume';
