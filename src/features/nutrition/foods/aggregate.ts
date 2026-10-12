import { detectFoodState } from './foodState';
import { NUTRIENT_KEYS, NUTRIENT_LABELS } from './types';
import type { FoodState, NutrientKey, Nutrients, Product } from './types';

/* ------------------------------------------------------------------ */
/* Règles de nettoyage (réglages en un seul endroit)                   */
/* ------------------------------------------------------------------ */

/**
 * Tolérance sur les calories. On recalcule 4 × protéines + 4 × glucides + 9 × lipides
 * et on compare aux calories annoncées. Les deux ne collent jamais pile : arrondis des
 * étiquettes, fibres (≈ 2 kcal/g), alcool, polyols… On accepte donc un écart de 20 %
 * du calcul, avec un minimum de 20 kcal (pour ne pas rejeter un légume à 15 kcal
 * à cause d'un arrondi). Au-delà, c'est presque toujours une erreur de saisie
 * (kJ notés comme kcal, valeur pour une portion, chiffre manquant…).
 */
export const KCAL_TOLERANCE = { relative: 0.2, minimum: 20 } as const;

/** Marge pour « plus de 100 g de macros pour 100 g » : les arrondis donnent parfois 100,4. */
export const MACRO_SUM_MARGIN_G = 1;

/** À partir de ce nombre de produits on retire les valeurs extrêmes (voir `summarize`). */
export const TRIM_FROM = 5;

/** Écart toléré avec la valeur CIQUAL pour dire « proche » : 15 % (ou le minimum ci-dessous). */
export const REFERENCE_TOLERANCE = {
  relative: 0.15,
  minimum: { kcal: 15, proteinG: 2, carbsG: 2, fatG: 2, fiberG: 2 },
} as const;

/* ------------------------------------------------------------------ */
/* Types du résultat                                                   */
/* ------------------------------------------------------------------ */

export type RejectionReason =
  | 'other_state' //        état différent de celui du groupe (cru / cuit / inconnu)
  | 'ambiguous_state' //    autant de crus que de cuits : impossible de choisir seul
  | 'missing_value' //      calories, protéines, glucides ou lipides absents
  | 'negative_value' //     une valeur négative
  | 'impossible_value' //   plus de 100 g pour 100 g
  | 'inconsistent_kcal'; // calories ≠ 4/4/9 hors tolérance

export const REJECTION_LABELS: Record<RejectionReason, string> = {
  other_state: 'État différent (cru, cuit ou inconnu)',
  ambiguous_state: 'État ambigu (autant de crus que de cuits)',
  missing_value: 'Valeur manquante',
  negative_value: 'Valeur négative',
  impossible_value: 'Valeur impossible (plus de 100 g pour 100 g)',
  inconsistent_kcal: 'Calories incohérentes avec les macros',
};

export interface Rejection {
  product: Product;
  reason: RejectionReason;
  /** Phrase en français expliquant précisément le rejet. */
  detail: string;
}

export type AggregateMethod = 'single' | 'mean' | 'median' | 'trimmed_mean';

export interface NutrientStat {
  /** Valeur retenue (arrondie à 0,1). */
  value: number;
  /** Fourchette de TOUS les produits retenus (extrêmes comprises). */
  min: number;
  max: number;
  /** Nombre de valeurs réellement entrées dans le calcul. */
  used: number;
  /** Nombre de valeurs extrêmes écartées. */
  trimmed: number;
  method: AggregateMethod;
  /** Écart entre la valeur la plus haute et la plus basse « normales » (sert à la confiance). */
  spread: number;
}

export type Confidence = 'low' | 'medium' | 'high';
export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Bonne',
};

export type ComparisonStatus = 'close' | 'gap';
export interface ReferenceComparison {
  byNutrient: Partial<
    Record<
      NutrientKey,
      { reference: number; value: number; difference: number; status: ComparisonStatus }
    >
  >;
  /** Vrai si tous les nutriments comparables sont proches de la référence. */
  consistent: boolean;
}

export interface AggregateResult {
  /** État du groupe retenu. */
  state: FoodState;
  /** Valeurs retenues ; `null` si personne n'a la donnée (ou aucun produit retenu). */
  nutrients: Record<NutrientKey, NutrientStat | null>;
  /** Produits qui ont passé le nettoyage. */
  kept: Product[];
  keptCount: number;
  rejected: Rejection[];
  confidence: Confidence;
  /** Pourquoi cette confiance, en français. */
  confidenceReasons: string[];
  /** Comparaison avec la référence (si fournie). */
  comparison: ReferenceComparison | null;
}

export interface AggregateOptions {
  /** Impose l'état du groupe (ex. déduit de la recherche « filet de poulet cru »). */
  state?: FoodState;
  /** Valeurs CIQUAL de référence à comparer au résultat. */
  reference?: Partial<Nutrients>;
}

/* ------------------------------------------------------------------ */
/* Nettoyage d'un produit                                              */
/* ------------------------------------------------------------------ */

const round1 = (n: number) => Math.round(n * 10) / 10;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Calories attendues d'après les macros (4 / 4 / 9). */
export function expectedKcal(proteinG: number, carbsG: number, fatG: number): number {
  return 4 * proteinG + 4 * carbsG + 9 * fatG;
}

/** Vérifie un produit. Renvoie la raison du rejet, ou `null` s'il est utilisable. */
export function checkProduct(product: Product): Pick<Rejection, 'reason' | 'detail'> | null {
  const { kcal, proteinG, carbsG, fatG, fiberG } = product;

  // 1. Champs manquants. Les fibres sont facultatives ; si elles sont données, elles comptent.
  if (!isNumber(kcal) || !isNumber(proteinG) || !isNumber(carbsG) || !isNumber(fatG)) {
    const missing = (['kcal', 'proteinG', 'carbsG', 'fatG'] as const).filter(
      (key) => !isNumber(product[key]),
    );
    return {
      reason: 'missing_value',
      detail: `Valeur manquante : ${missing.map((k) => NUTRIENT_LABELS[k].toLowerCase()).join(', ')}.`,
    };
  }
  if (fiberG !== null && fiberG !== undefined && !isNumber(fiberG)) {
    return { reason: 'missing_value', detail: 'Valeur illisible : fibres.' };
  }

  const present = NUTRIENT_KEYS.flatMap((key) => {
    const v = product[key];
    return isNumber(v) ? [[key, v] as const] : [];
  });

  // 2. Valeurs négatives.
  for (const [key, v] of present) {
    if (v < 0) {
      return { reason: 'negative_value', detail: `${NUTRIENT_LABELS[key]} est négatif (${v}).` };
    }
  }

  // 3. Impossible : plus de 100 g pour 100 g, ou plus de 900 kcal (100 g de lipides purs = 900 kcal,
  //    le maximum possible), avec la marge de tolérance.
  for (const [key, v] of present) {
    if (key !== 'kcal' && v > 100) {
      return {
        reason: 'impossible_value',
        detail: `${NUTRIENT_LABELS[key]} dépasse 100 g pour 100 g (${v}).`,
      };
    }
  }
  const macroSum = proteinG + carbsG + fatG;
  if (macroSum > 100 + MACRO_SUM_MARGIN_G) {
    return {
      reason: 'impossible_value',
      detail: `Protéines + glucides + lipides = ${round1(macroSum)} g pour 100 g.`,
    };
  }
  if (kcal > 900 * (1 + KCAL_TOLERANCE.relative)) {
    return { reason: 'impossible_value', detail: `${kcal} kcal pour 100 g est impossible.` };
  }

  // 4. Calories cohérentes avec les macros.
  const expected = expectedKcal(proteinG, carbsG, fatG);
  const allowed = Math.max(KCAL_TOLERANCE.minimum, expected * KCAL_TOLERANCE.relative);
  if (Math.abs(kcal - expected) > allowed) {
    return {
      reason: 'inconsistent_kcal',
      detail: `${kcal} kcal annoncées, mais les macros donnent environ ${Math.round(expected)} kcal.`,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Calcul de la valeur retenue                                         */
/* ------------------------------------------------------------------ */

const mean = (list: number[]) => list.reduce((sum, v) => sum + v, 0) / list.length;

/**
 * Valeur retenue pour un nutriment, selon le nombre de valeurs :
 * - 1 valeur : on la prend telle quelle ;
 * - 2 valeurs : la moyenne (20 et 22 → 21) ; impossible de repérer une valeur folle ;
 * - 3 ou 4 valeurs : la médiane (la valeur du milieu, ou la moyenne des deux du milieu) —
 *   une valeur aberrante ne peut pas peser sur le résultat ;
 * - 5 valeurs et plus : moyenne après avoir retiré les plus basses et les plus hautes
 *   (1 de chaque côté, puis 10 % de chaque côté à partir de 20 valeurs).
 */
export function summarize(values: number[]): NutrientStat | null {
  const n = values.length;
  if (n === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const min = Math.min(...sorted);
  const max = Math.max(...sorted);
  const base = { min, max, spread: max - min };

  if (n === 1) return { ...base, value: round1(min), used: 1, trimmed: 0, method: 'single' };
  if (n === 2) {
    return { ...base, value: round1(mean(sorted)), used: 2, trimmed: 0, method: 'mean' };
  }
  if (n < TRIM_FROM) {
    // 3 valeurs → la 2e ; 4 valeurs → les 2e et 3e.
    const middle = sorted.slice(Math.ceil(n / 2) - 1, Math.floor(n / 2) + 1);
    return {
      ...base,
      value: round1(mean(middle)),
      used: middle.length,
      trimmed: n - middle.length,
      method: 'median',
    };
  }
  const k = Math.max(1, Math.floor(n * 0.1));
  const kept = sorted.slice(k, n - k);
  return {
    min,
    max,
    // Pour juger l'écart, on ignore les extrêmes déjà écartées : elles ne faussent plus le résultat.
    spread: Math.max(...kept) - Math.min(...kept),
    value: round1(mean(kept)),
    used: kept.length,
    trimmed: 2 * k,
    method: 'trimmed_mean',
  };
}

/* ------------------------------------------------------------------ */
/* Confiance                                                           */
/* ------------------------------------------------------------------ */

// L'écart est rapporté à la valeur, mais jamais à moins de 10 g (50 kcal) :
// 0,5 g d'écart sur 1 g de lipides n'est pas un « grand écart ».
const SPREAD_FLOOR = { kcal: 50, proteinG: 10, carbsG: 10, fatG: 10 } as const;
const SPREAD_GOOD = 0.15;
const SPREAD_BAD = 0.3;

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

function judgeConfidence(
  count: number,
  state: FoodState,
  nutrients: AggregateResult['nutrients'],
): { confidence: Confidence; reasons: string[] } {
  if (count === 0) return { confidence: 'low', reasons: ['Aucun produit utilisable.'] };

  const reasons: string[] = [];
  let level: Confidence = 'high';
  const cap = (to: Confidence, reason: string) => {
    if (RANK[to] < RANK[level]) level = to;
    reasons.push(reason);
  };

  // Nombre de produits : moins de 3 = faible, moins de 5 = moyenne.
  if (count < 3) {
    cap('low', count === 1 ? 'Un seul produit retenu.' : `Seulement ${count} produits retenus.`);
  } else if (count < TRIM_FROM) {
    cap('medium', `Seulement ${count} produits retenus.`);
  }

  // Écart entre les produits : on prend le pire des quatre nutriments principaux.
  let worst = 0;
  for (const key of Object.keys(SPREAD_FLOOR) as (keyof typeof SPREAD_FLOOR)[]) {
    const stat = nutrients[key];
    if (stat) worst = Math.max(worst, stat.spread / Math.max(stat.value, SPREAD_FLOOR[key]));
  }
  if (worst > SPREAD_BAD) cap('low', 'Grand écart entre les produits.');
  else if (worst > SPREAD_GOOD) cap('medium', 'Écart moyen entre les produits.');

  // Si on ne sait pas si c'est du cru ou du cuit, on ne peut pas être sûr.
  if (state === 'unknown') cap('medium', 'État (cru ou cuit) inconnu.');

  if (reasons.length === 0) reasons.push('Assez de produits, valeurs proches.');
  return { confidence: level, reasons };
}

/* ------------------------------------------------------------------ */
/* Comparaison avec la référence CIQUAL                                */
/* ------------------------------------------------------------------ */

export function compareWithReference(
  nutrients: AggregateResult['nutrients'],
  reference: Partial<Nutrients>,
): ReferenceComparison {
  const byNutrient: ReferenceComparison['byNutrient'] = {};
  for (const key of NUTRIENT_KEYS) {
    const stat = nutrients[key];
    const ref = reference[key];
    if (!stat || !isNumber(ref)) continue;
    const allowed = Math.max(REFERENCE_TOLERANCE.minimum[key], ref * REFERENCE_TOLERANCE.relative);
    byNutrient[key] = {
      reference: ref,
      value: stat.value,
      difference: round1(stat.value - ref),
      status: Math.abs(stat.value - ref) <= allowed ? 'close' : 'gap',
    };
  }
  const entries = Object.values(byNutrient);
  return {
    byNutrient,
    consistent: entries.length > 0 && entries.every((e) => e.status === 'close'),
  };
}

/* ------------------------------------------------------------------ */
/* Fonction principale                                                 */
/* ------------------------------------------------------------------ */

const STATE_LABEL: Record<FoodState, string> = { raw: 'cru', cooked: 'cuit', unknown: 'inconnu' };

/**
 * Choisit l'état du groupe : celui qui a le plus de produits.
 * `null` si crus et cuits font jeu égal en tête (on ne devine pas).
 * À égalité avec « inconnu », l'état connu l'emporte.
 */
function pickState(states: FoodState[]): FoodState | null {
  if (states.length === 0) return 'unknown';
  const count = { raw: 0, cooked: 0, unknown: 0 };
  for (const s of states) count[s]++;
  if (count.raw > 0 && count.raw === count.cooked && count.raw >= count.unknown) return null;
  if (count.raw >= count.cooked && count.raw >= count.unknown) return 'raw';
  if (count.cooked >= count.unknown) return 'cooked';
  return 'unknown';
}

/**
 * Regroupe des produits équivalents et calcule les valeurs moyennes pour 100 g.
 * Fonction pure : aucun accès réseau ni base de données.
 */
export function aggregateFoods(
  products: Product[],
  options: AggregateOptions = {},
): AggregateResult {
  const entries = products.map((product) => ({
    product,
    productState: detectFoodState(product.name, product.category),
  }));
  const state = options.state ?? pickState(entries.map((e) => e.productState));
  const rejected: Rejection[] = [];
  const kept: Product[] = [];

  entries.forEach(({ product, productState }) => {
    if (state === null) {
      rejected.push({
        product,
        reason: 'ambiguous_state',
        detail: 'Autant de produits crus que de cuits : précise l’état voulu.',
      });
    } else if (productState !== state) {
      rejected.push({
        product,
        reason: 'other_state',
        detail: `État « ${STATE_LABEL[productState]} » alors que le groupe est « ${STATE_LABEL[state]} ».`,
      });
    } else {
      const problem = checkProduct(product);
      if (problem) rejected.push({ product, ...problem });
      else kept.push(product);
    }
  });

  const nutrients = Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [
      key,
      summarize(kept.flatMap((p) => (isNumber(p[key]) ? [p[key]] : []))),
    ]),
  ) as AggregateResult['nutrients'];

  const finalState = state ?? 'unknown';
  const { confidence, reasons } = judgeConfidence(kept.length, finalState, nutrients);

  return {
    state: finalState,
    nutrients,
    kept,
    keptCount: kept.length,
    rejected,
    confidence,
    confidenceReasons: reasons,
    comparison: options.reference ? compareWithReference(nutrients, options.reference) : null,
  };
}
