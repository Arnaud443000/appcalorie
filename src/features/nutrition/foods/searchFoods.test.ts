import { foodRepo } from '@/data';
import { resetDb, samples } from '@/test/fixtures';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OffResult } from './openFoodFacts';
import { searchFoods, setCiqualCatalog } from './searchFoods';
import type { CatalogProduct } from './types';

const catalogProduct = (patch: Partial<CatalogProduct>): CatalogProduct => ({
  source: 'ciqual',
  code: '1',
  name: 'Poulet, blanc, sans peau, cru',
  brand: '',
  category: '',
  barcode: null,
  kcal: 110,
  proteinG: 22.5,
  carbsG: 0,
  fatG: 2.2,
  fiberG: 0,
  ...patch,
});
const offProduct = (patch: Partial<CatalogProduct>) =>
  catalogProduct({
    source: 'openfoodfacts',
    code: '3250390000001',
    barcode: '3250390000001',
    ...patch,
  });

/** Faux client Open Food Facts : jamais de réseau. */
const fakeOff = (result: OffResult<CatalogProduct[]>) => ({
  searchProducts: vi.fn(async () => result),
});
const offOk = (...products: CatalogProduct[]) => fakeOff({ ok: true, data: products });

beforeEach(async () => {
  await resetDb();
  setCiqualCatalog([]);
});

describe('searchFoods — sources', () => {
  it('combine mes aliments, CIQUAL et Open Food Facts, dans cet ordre', async () => {
    await foodRepo.create({ ...samples.food, name: 'Poulet maison' });
    setCiqualCatalog([catalogProduct({ name: 'Poulet, blanc, cru' })]);
    const off = offOk(offProduct({ name: 'Poulet rôti', brand: 'Marque' }));

    const { hits, remote } = await searchFoods('poulet', { deps: { openFoodFacts: off } });

    expect(hits.map((h) => [h.source, h.name])).toEqual([
      ['local', 'Poulet maison'],
      ['ciqual', 'Poulet, blanc, cru'],
      ['openfoodfacts', 'Poulet rôti'],
    ]);
    expect(remote).toBe('ok');
  });

  it('un résultat local porte l’identifiant du Food enregistré', async () => {
    const food = await foodRepo.create(samples.food);
    const { hits } = await searchFoods('avoine', { remote: false });
    expect(hits[0]).toMatchObject({ source: 'local', foodId: food.id, kcal: 370, servingG: 50 });
  });

  it('les résultats externes n’ont pas d’identifiant', async () => {
    setCiqualCatalog([catalogProduct({})]);
    const { hits } = await searchFoods('poulet', { remote: false });
    expect(hits[0]).toMatchObject({ source: 'ciqual', foodId: null, servingG: null });
  });

  it('ne trouve pas les aliments supprimés', async () => {
    const food = await foodRepo.create(samples.food);
    await foodRepo.remove(food.id);
    expect((await searchFoods('avoine', { remote: false })).hits).toEqual([]);
  });

  it('ignore accents, majuscules et ordre des mots', async () => {
    await foodRepo.create({ ...samples.food, name: 'Flocons d’avoine' });
    setCiqualCatalog([catalogProduct({ name: 'Épinards, cuits' })]);
    expect((await searchFoods('AVOINE flocons', { remote: false })).hits).toHaveLength(1);
    expect((await searchFoods('epinard', { remote: false })).hits).toHaveLength(1);
  });

  it('cherche aussi dans la marque des aliments enregistrés', async () => {
    await foodRepo.create({ ...samples.food, name: 'Skyr', brand: 'Danone' });
    expect((await searchFoods('danone', { remote: false })).hits).toHaveLength(1);
  });

  it('classe d’abord les noms qui commencent par la recherche', async () => {
    await foodRepo.create({ ...samples.food, name: 'Salade de poulet' });
    await foodRepo.create({ ...samples.food, name: 'Poulet rôti' });
    const { hits } = await searchFoods('poulet', { remote: false });
    expect(hits.map((h) => h.name)).toEqual(['Poulet rôti', 'Salade de poulet']);
  });

  it('un texte trop court ne cherche rien et n’appelle pas OFF', async () => {
    const off = offOk();
    expect(await searchFoods(' a ', { deps: { openFoodFacts: off } })).toEqual({
      hits: [],
      remote: 'skipped',
      message: null,
    });
    expect(off.searchProducts).not.toHaveBeenCalled();
  });

  it('respecte la limite de résultats', async () => {
    setCiqualCatalog(Array.from({ length: 10 }, (_, i) => catalogProduct({ name: `Poulet ${i}` })));
    expect((await searchFoods('poulet', { remote: false, limit: 3 })).hits).toHaveLength(3);
  });
});

describe('searchFoods — doublons', () => {
  it('même code-barres : le produit enregistré l’emporte sur Open Food Facts', async () => {
    await foodRepo.create({ ...samples.food, name: 'Mon skyr', barcode: '3250390000001' });
    const off = offOk(offProduct({ name: 'Skyr nature' }));
    const { hits } = await searchFoods('skyr', { deps: { openFoodFacts: off } });
    expect(hits.map((h) => h.name)).toEqual(['Mon skyr']);
  });

  it('même nom et même marque : un seul résultat, la source la plus prioritaire', async () => {
    await foodRepo.create({ ...samples.food, name: 'Poulet rôti', brand: '' });
    setCiqualCatalog([catalogProduct({ name: 'Poulet rôti' })]);
    const off = offOk(offProduct({ name: 'poulet  RÔTI', barcode: null, code: 'x' }));
    const { hits } = await searchFoods('poulet', { deps: { openFoodFacts: off } });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.source).toBe('local');
  });

  it('même nom mais marques différentes : les deux sont gardés', async () => {
    const off = offOk(
      offProduct({ name: 'Filet de poulet', brand: 'A', barcode: '1111111111111' }),
      offProduct({ name: 'Filet de poulet', brand: 'B', barcode: '2222222222222' }),
    );
    const { hits } = await searchFoods('poulet', { deps: { openFoodFacts: off } });
    expect(hits).toHaveLength(2);
  });

  it('deux doublons dans Open Food Facts : un seul gardé', async () => {
    const same = offProduct({ name: 'Filet de poulet', brand: 'A' });
    const { hits } = await searchFoods('poulet', { deps: { openFoodFacts: offOk(same, same) } });
    expect(hits).toHaveLength(1);
  });

  it('deux de mes aliments au même nom sont tous les deux conservés', async () => {
    await foodRepo.create({ ...samples.food, name: 'Pain' });
    await foodRepo.create({ ...samples.food, name: 'Pain' });
    expect((await searchFoods('pain', { remote: false })).hits).toHaveLength(2);
  });
});

describe('searchFoods — Open Food Facts incomplet ou en panne', () => {
  it('écarte les produits OFF incomplets ou incohérents', async () => {
    const off = offOk(
      offProduct({ name: 'Poulet sans kcal', kcal: null, barcode: '1' }),
      offProduct({ name: 'Poulet kJ en kcal', kcal: 460, barcode: '2' }),
      offProduct({ name: 'Poulet correct', barcode: '3' }),
    );
    const { hits } = await searchFoods('poulet', { deps: { openFoodFacts: off } });
    expect(hits.map((h) => h.name)).toEqual(['Poulet correct']);
  });

  it('hors ligne : renvoie le local et CIQUAL, avec un message', async () => {
    await foodRepo.create({ ...samples.food, name: 'Poulet maison' });
    setCiqualCatalog([catalogProduct({ name: 'Poulet cru' })]);
    const off = fakeOff({ ok: false, error: 'offline', message: 'Pas de connexion.' });

    const outcome = await searchFoods('poulet', { deps: { openFoodFacts: off } });

    expect(outcome.hits.map((h) => h.source)).toEqual(['local', 'ciqual']);
    expect(outcome.remote).toBe('offline');
    expect(outcome.message).toBe('Pas de connexion.');
  });

  it.each([
    ['network', 'error'],
    ['server', 'error'],
    ['timeout', 'error'],
    ['invalid_response', 'error'],
    ['rate_limited', 'rate_limited'],
  ] as const)('erreur « %s » → statut « %s » sans planter', async (error, status) => {
    await foodRepo.create({ ...samples.food, name: 'Poulet maison' });
    const off = fakeOff({ ok: false, error, message: 'Oups.' });
    const outcome = await searchFoods('poulet', { deps: { openFoodFacts: off } });
    expect(outcome.hits).toHaveLength(1);
    expect(outcome.remote).toBe(status);
  });

  it('remote: false n’appelle jamais OFF', async () => {
    const off = offOk(offProduct({ name: 'Poulet OFF' }));
    const outcome = await searchFoods('poulet', { remote: false, deps: { openFoodFacts: off } });
    expect(off.searchProducts).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ hits: [], remote: 'skipped', message: null });
  });

  it('sans aucun réseau simulé : OFF hors ligne par défaut, le local reste utilisable', async () => {
    // Le client réel refuse d'appeler OFF quand `navigator.onLine` est faux.
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await foodRepo.create({ ...samples.food, name: 'Poulet maison' });

    const outcome = await searchFoods('poulet');

    expect(outcome.hits.map((h) => h.name)).toEqual(['Poulet maison']);
    expect(outcome.remote).toBe('offline');
    expect(fetchSpy).not.toHaveBeenCalled();
    online.mockRestore();
    fetchSpy.mockRestore();
  });
});
