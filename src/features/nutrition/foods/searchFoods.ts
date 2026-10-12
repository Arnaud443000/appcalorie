import { foodRepo } from '@/data';
import type { Food } from '@/data';
import { checkProduct } from './aggregate';
import { openFoodFacts } from './openFoodFacts';
import type { OpenFoodFactsClient } from './openFoodFacts';
import { normalizeText } from './text';
import type { CatalogProduct, FoodHit } from './types';

/* ------------------------------------------------------------------ */
/* Catalogue CIQUAL en mémoire                                         */
/* ------------------------------------------------------------------ */

// L'import réel (téléchargement + lecture du fichier) sera branché par l'écran, qui appelle
// `setCiqualCatalog(parseCiqualCsv(texte).foods)`. Tant qu'il n'est pas chargé, la recherche
// se fait sans CIQUAL. (Pour le conserver entre deux lancements : voir DEMANDES.md.)
let ciqualCatalog: CatalogProduct[] = [];

export function setCiqualCatalog(foods: CatalogProduct[]): void {
  ciqualCatalog = foods;
}

/* ------------------------------------------------------------------ */
/* Recherche                                                           */
/* ------------------------------------------------------------------ */

/** Pourquoi Open Food Facts n'a pas (ou pas bien) répondu. */
export type RemoteStatus = 'ok' | 'skipped' | 'offline' | 'rate_limited' | 'error';

export interface SearchOutcome {
  /** Mes aliments d'abord, puis CIQUAL, puis Open Food Facts ; sans doublons. */
  hits: FoodHit[];
  remote: RemoteStatus;
  /** Message à afficher quand `remote` n'est pas `ok` ni `skipped`. */
  message: string | null;
}

export interface SearchOptions {
  /**
   * Interroger Open Food Facts ? (défaut : oui). À mettre à `false` pendant la frappe :
   * OFF limite à 10 recherches par minute. Hors ligne, il est sauté tout seul.
   */
  remote?: boolean;
  /** Nombre maximum de résultats (défaut 40). */
  limit?: number;
  /** Remplacements pour les tests. */
  deps?: {
    listLocalFoods?: () => Promise<Food[]>;
    getCiqualFoods?: () => CatalogProduct[];
    openFoodFacts?: Pick<OpenFoodFactsClient, 'searchProducts'>;
  };
}

type Candidate = Omit<FoodHit, 'servingG'> & { servingG?: number | null };

/** 0 = le nom commence par la recherche, 1 = la contient, 2 = les mots y sont séparément. */
function relevance(name: string, query: string): number {
  if (name.startsWith(query)) return 0;
  return name.includes(query) ? 1 : 2;
}

/** Garde ce qui contient tous les mots recherchés (nom + marque), classé du plus au moins pertinent. */
function filterAndRank<T>(items: T[], query: string, labelOf: (item: T) => string): T[] {
  const words = query.split(' ');
  return items
    .map((item) => ({ item, label: normalizeText(labelOf(item)) }))
    .filter(({ label }) => words.every((word) => label.includes(word)))
    .map((entry, order) => ({ ...entry, order, score: relevance(entry.label, query) }))
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map(({ item }) => item);
}

const nameKey = (hit: Pick<FoodHit, 'name' | 'brand'>) =>
  `n:${normalizeText(hit.name)}|${normalizeText(hit.brand)}`;
const barcodeKey = (hit: Pick<FoodHit, 'barcode'>) => (hit.barcode ? `b:${hit.barcode}` : null);

function fromCatalog(product: CatalogProduct): Candidate | null {
  const { kcal, proteinG, carbsG, fatG } = product;
  if (kcal === null || proteinG === null || carbsG === null || fatG === null) return null;
  return {
    source: product.source,
    foodId: null,
    name: product.name,
    brand: product.brand,
    barcode: product.barcode,
    kcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: product.fiberG,
  };
}

/**
 * Cherche un aliment dans mes aliments enregistrés, dans CIQUAL et dans Open Food Facts.
 *
 * - Hors ligne (ou si OFF ne répond pas) : renvoie quand même le local + CIQUAL, jamais d'erreur.
 * - Doublons : un résultat est écarté s'il a le même code-barres ou le même nom + marque
 *   qu'un résultat d'une source plus prioritaire (mes aliments > CIQUAL > Open Food Facts).
 * - Les produits Open Food Facts incomplets ou incohérents (voir `checkProduct`) sont écartés :
 *   ils ne pourraient pas être enregistrés comme aliments.
 */
export async function searchFoods(
  text: string,
  options: SearchOptions = {},
): Promise<SearchOutcome> {
  const query = normalizeText(text);
  const limit = options.limit ?? 40;
  const deps = options.deps ?? {};
  if (query.length < 2) return { hits: [], remote: 'skipped', message: null };

  // 1. Mes aliments.
  const localFoods = await (deps.listLocalFoods ?? (() => foodRepo.list()))();
  const local: FoodHit[] = filterAndRank(localFoods, query, (f) => `${f.name} ${f.brand}`).map(
    (food) => ({
      source: 'local',
      foodId: food.id,
      name: food.name,
      brand: food.brand,
      barcode: food.barcode,
      kcal: food.kcal,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      fiberG: food.fiberG,
      servingG: food.servingG,
    }),
  );

  // 2. CIQUAL (en mémoire).
  const ciqual = filterAndRank(
    (deps.getCiqualFoods ?? (() => ciqualCatalog))(),
    query,
    (p) => p.name,
  ).flatMap((p) => fromCatalog(p) ?? []);

  // 3. Open Food Facts (seulement si demandé ; une erreur n'empêche jamais le reste).
  let remote: RemoteStatus = 'skipped';
  let message: string | null = null;
  let off: Candidate[] = [];
  if (options.remote !== false) {
    const result = await (deps.openFoodFacts ?? openFoodFacts).searchProducts(text);
    if (result.ok) {
      remote = 'ok';
      off = result.data.flatMap((p) => (checkProduct(p) === null ? (fromCatalog(p) ?? []) : []));
    } else {
      remote =
        result.error === 'offline'
          ? 'offline'
          : result.error === 'rate_limited'
            ? 'rate_limited'
            : 'error';
      message = result.message;
    }
  }

  // Dédoublonnage : mes aliments sont tous conservés ; CIQUAL et OFF sont comparés à ce qui précède.
  const seen = new Set<string>();
  const remember = (hit: FoodHit) => {
    seen.add(nameKey(hit));
    const barcode = barcodeKey(hit);
    if (barcode) seen.add(barcode);
  };
  local.forEach(remember);

  const external: FoodHit[] = [];
  for (const candidate of [...ciqual, ...off]) {
    const hit: FoodHit = { ...candidate, servingG: candidate.servingG ?? null };
    const barcode = barcodeKey(hit);
    if (seen.has(nameKey(hit)) || (barcode && seen.has(barcode))) continue;
    remember(hit);
    external.push(hit);
  }

  return { hits: [...local, ...external].slice(0, limit), remote, message };
}
