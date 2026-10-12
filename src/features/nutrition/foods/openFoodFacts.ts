import type { CatalogProduct } from './types';

/**
 * Client Open Food Facts (OFF) : recherche par texte et par code-barres.
 *
 * Conditions d'utilisation d'OFF respectées ici :
 * - limites de débit : 10 recherches par minute et 100 lectures de produit par minute.
 *   On s'impose une marge (8 et 80) et on refuse d'appeler OFF au-delà ;
 * - pas de requêtes à chaque lettre tapée : l'appelant ne doit chercher qu'à la validation
 *   (voir README) ;
 * - on ne demande que les champs utiles (`fields`) ;
 * - les données sont sous licence ODbL : l'écran doit citer « Open Food Facts » (voir README).
 * Un navigateur ne permet pas de fixer l'en-tête `User-Agent` demandé par OFF aux applications ;
 * on n'ajoute volontairement aucun en-tête personnalisé (cela déclencherait une requête de
 * pré-vérification CORS inutile).
 */

const BASE_URL = 'https://fr.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_fr,brands,categories,categories_tags,nutriments';
const TIMEOUT_MS = 10_000;
const SEARCH_LIMIT_PER_MINUTE = 8;
const PRODUCT_LIMIT_PER_MINUTE = 80;

export type OffErrorCode =
  | 'offline' //          l'appareil n'a pas de connexion
  | 'network' //          la requête n'a pas abouti
  | 'timeout' //          trop long
  | 'rate_limited' //     limite de débit atteinte (ou refus 429 d'OFF)
  | 'server' //           erreur côté OFF
  | 'invalid_response' // réponse illisible
  | 'invalid_barcode' //  code-barres impossible
  | 'not_found'; //       produit introuvable

export type OffResult<T> =
  { ok: true; data: T } | { ok: false; error: OffErrorCode; message: string };

const MESSAGES: Record<OffErrorCode, string> = {
  offline: 'Pas de connexion : Open Food Facts n’est pas joignable.',
  network: 'Impossible de joindre Open Food Facts. Réessaie dans un instant.',
  timeout: 'Open Food Facts met trop de temps à répondre.',
  rate_limited: 'Trop de recherches d’affilée. Patiente une minute avant de réessayer.',
  server: 'Open Food Facts rencontre un problème. Réessaie plus tard.',
  invalid_response: 'Réponse d’Open Food Facts illisible.',
  invalid_barcode: 'Ce code-barres n’est pas valide.',
  not_found: 'Produit introuvable dans Open Food Facts.',
};

const fail = (error: OffErrorCode): OffResult<never> => ({
  ok: false,
  error,
  message: MESSAGES[error],
});

/* ------------------------------------------------------------------ */
/* Conversion d'un produit OFF                                         */
/* ------------------------------------------------------------------ */

/** Nombre lisible ou `null`. Une valeur absente n'est JAMAIS transformée en 0. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Convertit un produit brut OFF ; `null` si le produit n'a pas de nom exploitable. */
export function parseOffProduct(raw: unknown): CatalogProduct | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const product = raw as Record<string, unknown>;
  const name = text(product.product_name_fr) || text(product.product_name);
  if (!name) return null;

  const nutriments =
    typeof product.nutriments === 'object' && product.nutriments !== null
      ? (product.nutriments as Record<string, unknown>)
      : {};

  // Énergie : OFF donne parfois seulement les kJ (`energy_100g`) ; 1 kcal = 4,184 kJ.
  const kJ = toNumber(nutriments['energy_100g']);
  const kcal =
    toNumber(nutriments['energy-kcal_100g']) ??
    (kJ === null ? null : Math.round((kJ / 4.184) * 10) / 10);

  const code = text(product.code);
  const tags = Array.isArray(product.categories_tags) ? product.categories_tags.join(' ') : '';

  return {
    source: 'openfoodfacts',
    code,
    name,
    // « brands » est une liste séparée par des virgules : on garde la première marque.
    brand: text(product.brands).split(',')[0]?.trim() ?? '',
    category: `${text(product.categories)} ${tags}`.trim(),
    barcode: code || null,
    kcal,
    proteinG: toNumber(nutriments['proteins_100g']),
    carbsG: toNumber(nutriments['carbohydrates_100g']),
    fatG: toNumber(nutriments['fat_100g']),
    fiberG: toNumber(nutriments['fiber_100g']),
  };
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export interface OffClientOptions {
  /** `fetch` à utiliser (les tests injectent un faux). */
  fetch?: typeof fetch;
  /** Horloge en millisecondes (les tests injectent une fausse). */
  now?: () => number;
  /** Vrai si l'appareil a du réseau. */
  isOnline?: () => boolean;
  timeoutMs?: number;
}

export interface OpenFoodFactsClient {
  /** Recherche par texte. Les produits sans nom sont ignorés ; les valeurs manquantes valent `null`. */
  searchProducts(query: string, pageSize?: number): Promise<OffResult<CatalogProduct[]>>;
  /** Un produit par code-barres (EAN-8, UPC-A, EAN-13 ou GTIN-14). */
  getProductByBarcode(barcode: string): Promise<OffResult<CatalogProduct>>;
}

/** Limiteur « fenêtre glissante » : au plus `max` appels par minute. */
function createLimiter(max: number, now: () => number) {
  let calls: number[] = [];
  return () => {
    const t = now();
    calls = calls.filter((time) => t - time < 60_000);
    if (calls.length >= max) return false;
    calls.push(t);
    return true;
  };
}

export function createOpenFoodFactsClient(options: OffClientOptions = {}): OpenFoodFactsClient {
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const isOnline =
    options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const allowSearch = createLimiter(SEARCH_LIMIT_PER_MINUTE, now);
  const allowProduct = createLimiter(PRODUCT_LIMIT_PER_MINUTE, now);

  /** Appelle OFF et renvoie le JSON, ou l'erreur déjà formulée. */
  async function getJson(url: string, allow: () => boolean): Promise<OffResult<unknown>> {
    if (!isOnline()) return fail('offline');
    if (!allow()) return fail('rate_limited');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const fetchFn = options.fetch ?? fetch;
      const response = await fetchFn(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (response.status === 404) return fail('not_found');
      if (response.status === 429) return fail('rate_limited');
      if (!response.ok) return fail('server');
      try {
        return { ok: true, data: await response.json() };
      } catch {
        return fail('invalid_response');
      }
    } catch {
      if (controller.signal.aborted) return fail('timeout');
      return fail(isOnline() ? 'network' : 'offline');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async searchProducts(query, pageSize = 20) {
      const terms = query.trim();
      if (terms.length < 2) return { ok: true, data: [] };
      const params = new URLSearchParams({
        search_terms: terms,
        search_simple: '1',
        action: 'process',
        json: '1',
        page_size: String(Math.min(Math.max(1, Math.floor(pageSize)), 50)),
        fields: FIELDS,
      });
      const result = await getJson(`${BASE_URL}/cgi/search.pl?${params}`, allowSearch);
      if (!result.ok) return result.error === 'not_found' ? { ok: true, data: [] } : result;

      const products = (result.data as { products?: unknown } | null)?.products;
      if (!Array.isArray(products)) return fail('invalid_response');
      return {
        ok: true,
        data: products.flatMap((raw) => {
          const parsed = parseOffProduct(raw);
          return parsed ? [parsed] : [];
        }),
      };
    },

    async getProductByBarcode(barcode) {
      const code = barcode.replace(/\s+/g, '');
      if (!/^\d{8,14}$/.test(code)) return fail('invalid_barcode');

      const result = await getJson(
        `${BASE_URL}/api/v2/product/${code}.json?fields=${FIELDS}`,
        allowProduct,
      );
      if (!result.ok) return result;

      const body = result.data as { status?: unknown; product?: unknown } | null;
      // OFF répond status 0 (ou 404) quand le code est inconnu.
      if (!body || typeof body !== 'object') return fail('invalid_response');
      if (body.status === 0 || body.product === undefined) return fail('not_found');
      const product = parseOffProduct(
        typeof body.product === 'object' && body.product !== null
          ? { code, ...body.product }
          : body.product,
      );
      return product ? { ok: true, data: product } : fail('not_found');
    },
  };
}

/** Client prêt à l'emploi pour l'application (utilise le vrai `fetch`). */
export const openFoodFacts = createOpenFoodFactsClient();
