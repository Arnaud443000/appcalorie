import { describe, expect, it } from 'vitest';
import {
  aggregateFoods,
  checkProduct,
  compareWithReference,
  expectedKcal,
  summarize,
} from './aggregate';
import type { Product } from './types';

/** Produit « filet de poulet cru » dont les calories collent avec les macros (sauf si on les force). */
function chicken(protein: number, extra: Partial<Product> = {}, name = 'Filet de poulet cru') {
  const carbs = 0;
  const fat = 2;
  return {
    name,
    brand: 'Marque',
    kcal: Math.round(expectedKcal(protein, carbs, fat)),
    proteinG: protein,
    carbsG: carbs,
    fatG: fat,
    fiberG: null,
    ...extra,
  } satisfies Product;
}
const chickens = (...proteins: number[]) => proteins.map((p) => chicken(p));

describe('aggregateFoods — l’exemple de référence', () => {
  it('20 g et 22 g de protéines → 21 g', () => {
    const result = aggregateFoods(chickens(20, 22));
    expect(result.nutrients.proteinG).toMatchObject({
      value: 21,
      min: 20,
      max: 22,
      method: 'mean',
    });
    expect(result.keptCount).toBe(2);
    expect(result.rejected).toEqual([]);
    expect(result.state).toBe('raw');
  });
});

describe('aggregateFoods — peu de produits', () => {
  it('aucun produit : rien à retenir, confiance faible', () => {
    const result = aggregateFoods([]);
    expect(result.keptCount).toBe(0);
    expect(result.nutrients.kcal).toBeNull();
    expect(result.confidence).toBe('low');
  });

  it('1 produit : la valeur est reprise telle quelle, confiance faible', () => {
    const result = aggregateFoods(chickens(23));
    expect(result.nutrients.proteinG).toMatchObject({
      value: 23,
      min: 23,
      max: 23,
      method: 'single',
    });
    expect(result.confidence).toBe('low');
  });

  it('2 produits : moyenne, confiance faible même si les valeurs sont proches', () => {
    const result = aggregateFoods(chickens(21, 22));
    expect(result.nutrients.proteinG?.value).toBe(21.5);
    expect(result.confidence).toBe('low');
  });

  it('3 produits : médiane, une valeur folle ne pèse pas', () => {
    const result = aggregateFoods(chickens(20, 22, 30));
    expect(result.nutrients.proteinG).toMatchObject({
      value: 22,
      min: 20,
      max: 30,
      method: 'median',
      used: 1,
      trimmed: 2,
    });
  });

  it('3 produits proches : confiance moyenne (trop peu pour « bonne »)', () => {
    const result = aggregateFoods(chickens(20, 21, 22));
    expect(result.nutrients.proteinG?.value).toBe(21);
    expect(result.confidence).toBe('medium');
  });

  it('4 produits : moyenne des deux valeurs du milieu', () => {
    const result = aggregateFoods(chickens(20, 21, 23, 40));
    expect(result.nutrients.proteinG).toMatchObject({ value: 22, method: 'median', used: 2 });
  });

  it("l'ordre des produits ne change pas le résultat", () => {
    const a = aggregateFoods(chickens(30, 20, 22));
    const b = aggregateFoods(chickens(22, 30, 20));
    expect(a.nutrients).toEqual(b.nutrients);
  });
});

describe('aggregateFoods — valeurs extrêmes (5 produits et plus)', () => {
  it('5 produits : la plus basse et la plus haute sont écartées', () => {
    const result = aggregateFoods(chickens(20, 21, 22, 23, 50));
    expect(result.nutrients.proteinG).toMatchObject({
      value: 22,
      min: 20,
      max: 50,
      used: 3,
      trimmed: 2,
      method: 'trimmed_mean',
    });
  });

  it('une valeur extrêmement basse est écartée aussi', () => {
    const result = aggregateFoods(chickens(2, 21, 22, 23, 24));
    expect(result.nutrients.proteinG?.value).toBe(22);
  });

  it('10 produits : toujours une valeur retirée de chaque côté', () => {
    const result = aggregateFoods(chickens(1, 20, 21, 21, 22, 22, 23, 23, 24, 60));
    expect(result.nutrients.proteinG).toMatchObject({ used: 8, trimmed: 2 });
  });

  it('20 produits : 10 % de chaque côté, soit 2 valeurs', () => {
    const proteins = Array.from({ length: 20 }, (_, i) => 15 + i);
    const result = aggregateFoods(chickens(...proteins));
    expect(result.nutrients.proteinG).toMatchObject({ used: 16, trimmed: 4 });
  });

  it('égalités : valeurs identiques → même résultat, écart nul, bonne confiance', () => {
    const result = aggregateFoods(chickens(21, 21, 21, 21, 21, 21));
    expect(result.nutrients.proteinG).toMatchObject({ value: 21, min: 21, max: 21, spread: 0 });
    expect(result.confidence).toBe('high');
  });

  it('égalités partielles : les doublons aux extrémités comptent chacun', () => {
    // triées : 20 20 20 22 22 → on retire un 20 et un 22 → (20 + 20 + 22) / 3
    const result = aggregateFoods(chickens(22, 20, 20, 22, 20));
    expect(result.nutrients.proteinG?.value).toBeCloseTo(20.7, 5);
  });

  it('arrondit à 0,1 pour éviter les 21,333333', () => {
    expect(summarize([20, 21, 21, 22, 22, 22, 22])?.value).toBe(21.6);
  });
});

describe('aggregateFoods — produits incohérents', () => {
  const bad = (patch: Partial<Product>) => chicken(21, patch, 'Filet de poulet cru');

  it.each([
    ['valeur négative', bad({ proteinG: -3 }), 'negative_value'],
    ['fibres négatives', bad({ fiberG: -1 }), 'negative_value'],
    ['plus de 100 g d’un nutriment', bad({ carbsG: 130 }), 'impossible_value'],
    [
      'protéines + glucides + lipides > 100 g',
      bad({ proteinG: 60, carbsG: 40, fatG: 20 }),
      'impossible_value',
    ],
    [
      'calories hors de portée',
      bad({ kcal: 2000, proteinG: 0, carbsG: 0, fatG: 0 }),
      'impossible_value',
    ],
    ['kJ notés en kcal', bad({ kcal: 430 }), 'inconsistent_kcal'],
    [
      'calories à zéro alors que les macros en donnent',
      bad({ kcal: 0, proteinG: 30, fatG: 5 }),
      'inconsistent_kcal',
    ],
    ['calories absentes', bad({ kcal: null }), 'missing_value'],
    ['protéines absentes', bad({ proteinG: undefined }), 'missing_value'],
    ['glucides absents', bad({ carbsG: null }), 'missing_value'],
    ['lipides absents', bad({ fatG: null }), 'missing_value'],
    ['valeur NaN', bad({ proteinG: NaN }), 'missing_value'],
    ['valeur infinie', bad({ kcal: Infinity }), 'missing_value'],
  ])('écarte : %s', (_label, product, reason) => {
    const result = aggregateFoods([...chickens(20, 22), product]);
    expect(result.keptCount).toBe(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toMatchObject({ reason, product });
    expect(result.rejected[0]?.detail).not.toBe('');
    expect(result.nutrients.proteinG?.value).toBe(21);
  });

  it('une valeur à 0 n’est pas une valeur manquante (eau, huile pure…)', () => {
    const water = { name: 'Eau cuite', kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    expect(checkProduct(water)).toBeNull();
  });

  it('les fibres manquantes ne font pas écarter le produit', () => {
    const result = aggregateFoods([
      chicken(20, { fiberG: null }),
      chicken(22, { fiberG: undefined }),
    ]);
    expect(result.keptCount).toBe(2);
    expect(result.nutrients.fiberG).toBeNull();
  });

  it('les fibres sont moyennées sur les produits qui les donnent', () => {
    const result = aggregateFoods([
      chicken(20, { fiberG: 2 }),
      chicken(21, { fiberG: 4 }),
      chicken(22, { fiberG: null }),
    ]);
    expect(result.nutrients.fiberG).toMatchObject({ value: 3, used: 2 });
  });

  it('tolérance sur les calories : accepte un petit écart, refuse un grand', () => {
    // macros : 4×20 + 9×2 = 98 kcal ; tolérance = max(20, 20 % de 98) = 20
    expect(checkProduct(chicken(20, { kcal: 117 }))).toBeNull();
    expect(checkProduct(chicken(20, { kcal: 79 }))).toBeNull();
    expect(checkProduct(chicken(20, { kcal: 119 }))?.reason).toBe('inconsistent_kcal');
    expect(checkProduct(chicken(20, { kcal: 77 }))?.reason).toBe('inconsistent_kcal');
    // aliment très calorique : 20 % de 900 = 180 kcal d'écart permis
    const oil = { name: 'Huile', kcal: 880, proteinG: 0, carbsG: 0, fatG: 100 };
    expect(checkProduct(oil)).toBeNull();
  });

  it('accepte 100,4 g de macros (arrondis), refuse 102 g', () => {
    expect(
      checkProduct({ name: 'x', kcal: 528, proteinG: 50, carbsG: 25.2, fatG: 25.2 }),
    ).toBeNull();
    expect(checkProduct({ name: 'x', kcal: 380, proteinG: 50, carbsG: 26, fatG: 26 })?.reason).toBe(
      'impossible_value',
    );
  });

  it('tous les produits mauvais : rien de retenu, aucun plantage', () => {
    const result = aggregateFoods([bad({ kcal: null }), bad({ proteinG: -1 })]);
    expect(result.keptCount).toBe(0);
    expect(result.rejected).toHaveLength(2);
    expect(result.nutrients.proteinG).toBeNull();
    expect(result.confidence).toBe('low');
  });

  it("une valeur aberrante qui passe le nettoyage est traitée par l'écart des extrêmes", () => {
    // 50 g de protéines est possible (donc gardé) mais reste une valeur extrême → écartée.
    const result = aggregateFoods(chickens(20, 21, 22, 23, 50));
    expect(result.keptCount).toBe(5);
    expect(result.nutrients.proteinG?.value).toBe(22);
  });

  it("ne modifie pas la liste d'entrée", () => {
    const input = chickens(22, 20);
    const copy = structuredClone(input);
    aggregateFoods(input);
    expect(input).toEqual(copy);
  });
});

describe('aggregateFoods — cru / cuit', () => {
  const cooked = (protein: number) =>
    chicken(
      protein,
      { kcal: Math.round(expectedKcal(protein, 0, 4)), fatG: 4 },
      'Filet de poulet cuit',
    );
  const unknown = (protein: number) => chicken(protein, {}, 'Filet de poulet');

  it('ne mélange jamais le cru et le cuit : le groupe majoritaire gagne', () => {
    const result = aggregateFoods([...chickens(20, 21, 22), cooked(31), cooked(32)]);
    expect(result.state).toBe('raw');
    expect(result.keptCount).toBe(3);
    expect(result.nutrients.proteinG?.value).toBe(21);
    expect(result.rejected.map((r) => r.reason)).toEqual(['other_state', 'other_state']);
  });

  it('un état imposé par la recherche prend le dessus sur la majorité', () => {
    const result = aggregateFoods([...chickens(20, 21, 22), cooked(31), cooked(32)], {
      state: 'cooked',
    });
    expect(result.state).toBe('cooked');
    expect(result.nutrients.proteinG?.value).toBe(31.5);
    expect(result.rejected).toHaveLength(3);
  });

  it('autant de crus que de cuits sans état imposé : tout est écarté (ambigu)', () => {
    const result = aggregateFoods([chicken(20), chicken(22), cooked(30), cooked(32)]);
    expect(result.keptCount).toBe(0);
    expect(result.state).toBe('unknown');
    expect(result.rejected.every((r) => r.reason === 'ambiguous_state')).toBe(true);
  });

  it('le même cas avec un état imposé fonctionne', () => {
    const result = aggregateFoods([chicken(20), chicken(22), cooked(30), cooked(32)], {
      state: 'raw',
    });
    expect(result.nutrients.proteinG?.value).toBe(21);
  });

  it('les produits à état inconnu forment leur propre groupe, jamais mêlés aux crus/cuits', () => {
    const result = aggregateFoods([unknown(20), unknown(22), unknown(21), chicken(25)]);
    expect(result.state).toBe('unknown');
    expect(result.keptCount).toBe(3);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toBe('other_state');
  });

  it('à égalité entre un état connu et « inconnu », l’état connu gagne', () => {
    const result = aggregateFoods([chicken(20), unknown(22)]);
    expect(result.state).toBe('raw');
    expect(result.keptCount).toBe(1);
  });

  it('un état inconnu plafonne la confiance à « moyenne »', () => {
    const result = aggregateFoods([21, 21, 21, 21, 21, 21].map(unknown));
    expect(result.state).toBe('unknown');
    expect(result.confidence).toBe('medium');
    expect(result.confidenceReasons).toContain('État (cru ou cuit) inconnu.');
  });

  it("utilise aussi la catégorie pour deviner l'état", () => {
    const products = [21, 22, 23].map((p) =>
      chicken(p, { category: 'Viandes crues' }, 'Filet de poulet'),
    );
    expect(aggregateFoods(products).state).toBe('raw');
  });
});

describe('aggregateFoods — confiance', () => {
  it('bonne : 6 produits proches', () => {
    const result = aggregateFoods(chickens(20, 21, 21, 22, 22, 23));
    expect(result.confidence).toBe('high');
  });

  it('faible : grand écart sur les calories même avec beaucoup de produits', () => {
    // Quatre produits « normaux » et deux très différents de chaque côté des extrêmes écartées ;
    // l'écart des valeurs utilisées reste grand.
    const spread = [10, 15, 20, 25, 30, 35, 40].map((p) => chicken(p));
    const result = aggregateFoods(spread);
    expect(result.keptCount).toBe(7);
    expect(result.confidence).toBe('low');
    expect(result.confidenceReasons).toContain('Grand écart entre les produits.');
  });

  it('moyenne : écart modéré', () => {
    // après retrait des extrêmes : protéines de 20 à 26 (écart 6 sur 23 = 26 %)
    const result = aggregateFoods(chickens(18, 20, 22, 24, 26, 28));
    expect(result.confidence).toBe('medium');
  });

  it('faible : grand écart avec 3 produits', () => {
    expect(aggregateFoods(chickens(10, 22, 40)).confidence).toBe('low');
  });

  it('un écart de 1 g sur de petites valeurs (lipides) n’alarme pas', () => {
    const products = [1, 1.5, 2, 2, 2.5, 3].map((fat) =>
      chicken(21, { fatG: fat, kcal: Math.round(expectedKcal(21, 0, fat)) }),
    );
    expect(aggregateFoods(products).confidence).toBe('high');
  });

  it('donne toujours au moins une raison', () => {
    expect(aggregateFoods(chickens(21, 21, 21, 21, 21)).confidenceReasons.length).toBeGreaterThan(
      0,
    );
  });
});

describe('comparaison avec la référence CIQUAL', () => {
  const reference = { kcal: 106, proteinG: 22, carbsG: 0, fatG: 2, fiberG: 0 };

  it('proche de la référence', () => {
    const result = aggregateFoods(chickens(20, 21, 22, 23, 24), { reference });
    expect(result.comparison?.consistent).toBe(true);
    expect(result.comparison?.byNutrient.proteinG).toMatchObject({
      reference: 22,
      value: 22,
      difference: 0,
      status: 'close',
    });
  });

  it('écart repéré quand la moyenne s’éloigne', () => {
    const result = aggregateFoods(chickens(28, 29, 30, 31, 32), { reference });
    expect(result.comparison?.consistent).toBe(false);
    expect(result.comparison?.byNutrient.proteinG?.status).toBe('gap');
    expect(result.comparison?.byNutrient.proteinG?.difference).toBe(8);
  });

  it('ignore les nutriments sans valeur ou sans référence', () => {
    const result = aggregateFoods(chickens(21, 22), { reference: { proteinG: 22 } });
    expect(Object.keys(result.comparison?.byNutrient ?? {})).toEqual(['proteinG']);
    expect(compareWithReference(result.nutrients, {}).consistent).toBe(false);
  });

  it('pas de référence → pas de comparaison', () => {
    expect(aggregateFoods(chickens(21, 22)).comparison).toBeNull();
  });
});
