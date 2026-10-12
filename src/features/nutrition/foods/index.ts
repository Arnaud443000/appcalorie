/** Point d'entrée de la logique des aliments (lot 4). Les écrans importent d'ici, pas des fichiers internes. */
export {
  aggregateFoods,
  checkProduct,
  compareWithReference,
  CONFIDENCE_LABELS,
  REJECTION_LABELS,
  type AggregateOptions,
  type AggregateResult,
  type Confidence,
  type NutrientStat,
  type Rejection,
  type RejectionReason,
  type ReferenceComparison,
} from './aggregate';
export { parseCiqualCsv, type ParsedCiqual } from './ciqual';
export { restoreCiqualCatalog, saveCiqualCatalog } from './ciqualStore';
export { detectFoodState } from './foodState';
export {
  createOpenFoodFactsClient,
  openFoodFacts,
  type OffErrorCode,
  type OffResult,
  type OpenFoodFactsClient,
} from './openFoodFacts';
export {
  searchFoods,
  setCiqualCatalog,
  type RemoteStatus,
  type SearchOptions,
  type SearchOutcome,
} from './searchFoods';
export {
  aggregateToNewFood,
  hitToNewFood,
  saveAggregatedFood,
  type AggregatedFoodInfo,
} from './toFood';
export type { CatalogProduct, FoodHit, FoodState, NutrientKey, Nutrients, Product } from './types';
