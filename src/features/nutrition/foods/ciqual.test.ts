import { describe, expect, it } from 'vitest';
import sample from './fixtures/ciqual-exemple.csv?raw';
import { parseCiqualCsv, parseCiqualNumber } from './ciqual';
import { detectFoodState } from './foodState';

describe('parseCiqualNumber', () => {
  it.each([
    ['22,5', 22.5],
    ['22.5', 22.5],
    [' 7 ', 7],
    ['0', 0],
    ['traces', 0],
    ['Traces', 0],
    ['< 0,5', 0],
    ['<1', 0],
    ['-', null],
    ['', null],
    ['   ', null],
    ['n.d.', null],
  ])('« %s » → %s', (cell, expected) => {
    expect(parseCiqualNumber(cell)).toBe(expected);
  });

  it('une cellule absente est inconnue (null)', () => {
    expect(parseCiqualNumber(undefined)).toBeNull();
  });
});

describe('parseCiqualCsv', () => {
  const { foods, skipped } = parseCiqualCsv(sample);
  const byName = (name: string) => foods.find((f) => f.name === name);

  it('lit les aliments complets et compte les lignes ignorées', () => {
    expect(foods).toHaveLength(8);
    expect(skipped).toBe(1); // l'aliment sans énergie
    expect(byName('Aliment à valeur énergétique inconnue')).toBeUndefined();
  });

  it('convertit un aliment (virgules décimales, source, catégorie)', () => {
    expect(byName('Poulet, blanc, sans peau, cru')).toEqual({
      source: 'ciqual',
      code: '36014',
      name: 'Poulet, blanc, sans peau, cru',
      brand: '',
      category: 'viandes, œufs, poissons et assimilés > viandes crues > volailles crues',
      barcode: null,
      kcal: 110,
      proteinG: 22.5,
      carbsG: 0,
      fatG: 2.2,
      fiberG: 0,
    });
  });

  it('traces et « < x » valent 0, « - » est inconnu', () => {
    const salad = byName('Salade verte, crue');
    expect(salad).toMatchObject({ fatG: 0, fiberG: 0, kcal: 14 });
    expect(byName("Huile d'olive vierge extra")?.fiberG).toBeNull();
  });

  it('se rabat sur la colonne d’énergie « Jones » quand la valeur UE manque', () => {
    expect(byName('Lentilles vertes, cuites')?.kcal).toBe(114);
  });

  it('gère les guillemets doublés et un point-virgule dans un nom', () => {
    expect(byName('Pâtes alimentaires, cuites, "al dente"; sans sel')).toMatchObject({
      code: '9810',
      kcal: 148,
    });
  });

  it('ignore la catégorie « - »', () => {
    const csv = [
      'alim_code;alim_nom_fr;alim_grp_nom_fr;alim_ssgrp_nom_fr;Energie (kcal/100 g);Protéines;Glucides;Lipides',
      '1;Test;-;sous-groupe;100;10;10;2',
    ].join('\n');
    expect(parseCiqualCsv(csv).foods[0]?.category).toBe('sous-groupe');
  });

  it("l'état cru / cuit se devine à partir des noms CIQUAL", () => {
    expect(detectFoodState(byName('Poulet, blanc, sans peau, cru')?.name ?? '')).toBe('raw');
    expect(detectFoodState(byName('Poulet, blanc, sans peau, cuit')?.name ?? '')).toBe('cooked');
    expect(detectFoodState(byName('Riz blanc, cuit, non salé')?.name ?? '')).toBe('cooked');
  });

  it('accepte les fins de ligne Windows et le BOM', () => {
    const windows = '\uFEFF' + sample.replace(/\n/g, '\r\n');
    expect(parseCiqualCsv(windows).foods).toEqual(foods);
  });

  it('accepte une tabulation ou une virgule comme séparateur', () => {
    const csv = [
      [
        'alim_code',
        'alim_nom_fr',
        'Energie (kcal/100 g)',
        'Protéines (g/100 g)',
        'Glucides (g/100 g)',
        'Lipides (g/100 g)',
      ],
      ['1', 'Pain, cuit', '250', '8', '50', '1.5'],
    ];
    const asTab = csv.map((r) => r.join('\t')).join('\n');
    const asComma = csv.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    expect(parseCiqualCsv(asTab).foods[0]).toMatchObject({
      name: 'Pain, cuit',
      kcal: 250,
      fatG: 1.5,
    });
    expect(parseCiqualCsv(asComma).foods).toEqual(parseCiqualCsv(asTab).foods);
  });

  it('colonne des fibres facultative', () => {
    const csv = 'alim_nom_fr;Energie (kcal/100 g);Protéines;Glucides;Lipides\nPain;250;8;50;1,5';
    expect(parseCiqualCsv(csv).foods[0]).toMatchObject({ name: 'Pain', fiberG: null, code: '' });
  });

  it('fichier non reconnu → erreur claire en français', () => {
    expect(() => parseCiqualCsv('a;b;c\n1;2;3')).toThrow(/Fichier CIQUAL non reconnu/);
    expect(() => parseCiqualCsv('')).toThrow(/vide/);
  });

  it('fichier avec seulement l’en-tête : aucun aliment', () => {
    const header = sample.split('\n')[0] ?? '';
    expect(parseCiqualCsv(header)).toEqual({ foods: [], skipped: 0 });
  });

  it('est pure : même texte, même résultat', () => {
    expect(parseCiqualCsv(sample)).toEqual({ foods, skipped });
  });
});
