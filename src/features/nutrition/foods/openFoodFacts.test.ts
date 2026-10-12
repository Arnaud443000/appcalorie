import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenFoodFactsClient, parseOffProduct } from './openFoodFacts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const chickenRaw = {
  code: '3250390000001',
  product_name: 'Chicken fillet',
  product_name_fr: 'Filet de poulet',
  brands: 'Le Gaulois, Autre',
  categories: 'Viandes, Volailles',
  categories_tags: ['en:meats', 'en:raw-poultry'],
  nutriments: {
    'energy-kcal_100g': 110,
    proteins_100g: 22.5,
    carbohydrates_100g: 0.5,
    fat_100g: 2.1,
    fiber_100g: 0,
  },
};

/** Client avec un faux `fetch` : aucun appel réseau réel. */
function makeClient(
  impl: (url: string, init?: RequestInit) => Promise<Response> | Response,
  extra: Parameters<typeof createOpenFoodFactsClient>[0] = {},
) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    impl(String(url), init),
  );
  const client = createOpenFoodFactsClient({
    fetch: fetchMock as unknown as typeof fetch,
    isOnline: () => true,
    ...extra,
  });
  return { client, fetchMock };
}

afterEach(() => vi.useRealTimers());

describe('parseOffProduct', () => {
  it('convertit un produit complet', () => {
    expect(parseOffProduct(chickenRaw)).toEqual({
      source: 'openfoodfacts',
      code: '3250390000001',
      name: 'Filet de poulet',
      brand: 'Le Gaulois',
      category: 'Viandes, Volailles en:meats en:raw-poultry',
      barcode: '3250390000001',
      kcal: 110,
      proteinG: 22.5,
      carbsG: 0.5,
      fatG: 2.1,
      fiberG: 0,
    });
  });

  it('garde « inconnu » (null) pour les valeurs manquantes, jamais 0', () => {
    const product = parseOffProduct({ code: '1', product_name: 'Mystère', nutriments: {} });
    expect(product).toMatchObject({
      kcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: null,
    });
  });

  it('accepte les nombres écrits en texte, refuse le reste', () => {
    const product = parseOffProduct({
      product_name: 'X',
      nutriments: {
        'energy-kcal_100g': '120',
        proteins_100g: '12,5',
        carbohydrates_100g: '',
        fat_100g: 'abc',
        fiber_100g: NaN,
      },
    });
    expect(product).toMatchObject({
      kcal: 120,
      proteinG: 12.5,
      carbsG: null,
      fatG: null,
      fiberG: null,
    });
  });

  it('retombe sur les kJ quand les kcal manquent', () => {
    const product = parseOffProduct({ product_name: 'X', nutriments: { energy_100g: 1046 } });
    expect(product?.kcal).toBe(250);
  });

  it('ignore un produit sans nom ou une entrée invalide', () => {
    expect(parseOffProduct({ code: '1', nutriments: {} })).toBeNull();
    expect(parseOffProduct({ product_name: '   ' })).toBeNull();
    expect(parseOffProduct(null)).toBeNull();
    expect(parseOffProduct('texte')).toBeNull();
  });

  it('utilise le nom d’origine si le nom français manque', () => {
    expect(parseOffProduct({ product_name: 'Chicken' })?.name).toBe('Chicken');
  });

  it('sans code-barres : barcode null', () => {
    expect(parseOffProduct({ product_name: 'X' })).toMatchObject({ code: '', barcode: null });
  });
});

describe('searchProducts', () => {
  it('appelle OFF avec les bons paramètres et renvoie les produits', async () => {
    const { client, fetchMock } = makeClient(() => json({ products: [chickenRaw] }));
    const result = await client.searchProducts('filet de poulet', 10);

    expect(result.ok && result.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin).toBe('https://fr.openfoodfacts.org');
    expect(url.pathname).toBe('/cgi/search.pl');
    expect(url.searchParams.get('search_terms')).toBe('filet de poulet');
    expect(url.searchParams.get('json')).toBe('1');
    expect(url.searchParams.get('page_size')).toBe('10');
    expect(url.searchParams.get('fields')).toContain('nutriments');
  });

  it('plafonne la taille de page', async () => {
    const { client, fetchMock } = makeClient(() => json({ products: [] }));
    await client.searchProducts('poulet', 5000);
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get('page_size')).toBe('50');
  });

  it('ne fait aucun appel pour un texte trop court', async () => {
    const { client, fetchMock } = makeClient(() => json({ products: [] }));
    expect(await client.searchProducts(' a ')).toEqual({ ok: true, data: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('écarte les produits sans nom', async () => {
    const { client } = makeClient(() => json({ products: [chickenRaw, { code: '2' }, null] }));
    const result = await client.searchProducts('poulet');
    expect(result.ok && result.data.map((p) => p.name)).toEqual(['Filet de poulet']);
  });

  it('aucun résultat : liste vide', async () => {
    const { client } = makeClient(() => json({ products: [] }));
    expect(await client.searchProducts('xyzxyz')).toEqual({ ok: true, data: [] });
  });

  it('hors ligne : pas d’appel, erreur « offline »', async () => {
    const { client, fetchMock } = makeClient(() => json({}), { isOnline: () => false });
    const result = await client.searchProducts('poulet');
    expect(result).toMatchObject({ ok: false, error: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('erreur réseau (fetch qui échoue) → « network »', async () => {
    const { client } = makeClient(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(await client.searchProducts('poulet')).toMatchObject({ ok: false, error: 'network' });
  });

  it('coupure détectée pendant la requête → « offline »', async () => {
    let online = true;
    const { client } = makeClient(
      () => {
        online = false;
        throw new TypeError('Failed to fetch');
      },
      { isOnline: () => online },
    );
    expect(await client.searchProducts('poulet')).toMatchObject({ ok: false, error: 'offline' });
  });

  it('erreur serveur (500) → « server »', async () => {
    const { client } = makeClient(() => new Response('oups', { status: 503 }));
    expect(await client.searchProducts('poulet')).toMatchObject({ ok: false, error: 'server' });
  });

  it('refus 429 d’OFF → « rate_limited »', async () => {
    const { client } = makeClient(() => new Response('', { status: 429 }));
    expect(await client.searchProducts('poulet')).toMatchObject({
      ok: false,
      error: 'rate_limited',
    });
  });

  it('réponse qui n’est pas du JSON → « invalid_response »', async () => {
    const { client } = makeClient(() => new Response('<html>', { status: 200 }));
    expect(await client.searchProducts('poulet')).toMatchObject({
      ok: false,
      error: 'invalid_response',
    });
  });

  it('JSON sans liste de produits → « invalid_response »', async () => {
    const { client } = makeClient(() => json({ autre: 1 }));
    expect(await client.searchProducts('poulet')).toMatchObject({
      ok: false,
      error: 'invalid_response',
    });
  });

  it('requête trop longue → « timeout »', async () => {
    vi.useFakeTimers();
    const { client } = makeClient(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')));
        }),
      { timeoutMs: 5000 },
    );
    const promise = client.searchProducts('poulet');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await promise).toMatchObject({ ok: false, error: 'timeout' });
  });

  it('respecte la limite de débit : 8 recherches par minute, puis refus sans appel', async () => {
    let time = 0;
    const { client, fetchMock } = makeClient(() => json({ products: [] }), { now: () => time });
    for (let i = 0; i < 8; i++) expect((await client.searchProducts('poulet')).ok).toBe(true);
    expect(await client.searchProducts('poulet')).toMatchObject({
      ok: false,
      error: 'rate_limited',
    });
    expect(fetchMock).toHaveBeenCalledTimes(8);

    time = 61_000; // la minute est écoulée
    expect((await client.searchProducts('poulet')).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });
});

describe('getProductByBarcode', () => {
  it('renvoie le produit trouvé', async () => {
    const { client, fetchMock } = makeClient(() =>
      json({ code: '3250390000001', status: 1, product: chickenRaw }),
    );
    const result = await client.getProductByBarcode('3250 3900 00001');
    expect(result).toMatchObject({ ok: true, data: { name: 'Filet de poulet', kcal: 110 } });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v2/product/3250390000001.json');
  });

  it('produit introuvable (status 0)', async () => {
    const { client } = makeClient(() => json({ status: 0, status_verbose: 'product not found' }));
    expect(await client.getProductByBarcode('3250390000001')).toMatchObject({
      ok: false,
      error: 'not_found',
    });
  });

  it('produit introuvable (HTTP 404)', async () => {
    const { client } = makeClient(() => json({ status: 0 }, 404));
    expect(await client.getProductByBarcode('3250390000001')).toMatchObject({
      ok: false,
      error: 'not_found',
    });
  });

  it('produit trouvé mais sans nom → introuvable', async () => {
    const { client } = makeClient(() => json({ status: 1, product: { nutriments: {} } }));
    expect(await client.getProductByBarcode('3250390000001')).toMatchObject({
      ok: false,
      error: 'not_found',
    });
  });

  it('produit sans nutriments : valeurs inconnues (null)', async () => {
    const { client } = makeClient(() =>
      json({ status: 1, product: { product_name: 'Sans info' } }),
    );
    const result = await client.getProductByBarcode('3250390000001');
    expect(result).toMatchObject({
      ok: true,
      data: { code: '3250390000001', kcal: null, proteinG: null },
    });
  });

  it.each(['', 'abc', '123', '12345678901234567', '32503900000a1'])(
    'refuse le code-barres invalide « %s » sans appeler OFF',
    async (barcode) => {
      const { client, fetchMock } = makeClient(() => json({}));
      expect(await client.getProductByBarcode(barcode)).toMatchObject({
        ok: false,
        error: 'invalid_barcode',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('hors ligne et erreur réseau', async () => {
    const offline = makeClient(() => json({}), { isOnline: () => false });
    expect(await offline.client.getProductByBarcode('3250390000001')).toMatchObject({
      error: 'offline',
    });
    const broken = makeClient(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(await broken.client.getProductByBarcode('3250390000001')).toMatchObject({
      error: 'network',
    });
  });

  it('les recherches et les lectures ont des compteurs séparés', async () => {
    const { client } = makeClient((url) =>
      url.includes('/api/v2/') ? json({ status: 1, product: chickenRaw }) : json({ products: [] }),
    );
    for (let i = 0; i < 8; i++) await client.searchProducts('poulet');
    expect(await client.searchProducts('poulet')).toMatchObject({ error: 'rate_limited' });
    expect((await client.getProductByBarcode('3250390000001')).ok).toBe(true);
  });
});
