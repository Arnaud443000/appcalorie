import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { foodLogEntryRepo, foodRepo } from '@/data';
import { resetDb } from '@/test/fixtures';
import { parseCiqualCsv, saveCiqualCatalog, setCiqualCatalog } from './foods';
import sample from './foods/fixtures/ciqual-exemple.csv?raw';
import { todayDay } from './logic';
import {
  createFood,
  logFood,
  mockFetchJson,
  mockFetchNetworkError,
  offProduct,
  renderNutrition,
  setOnline,
} from './testHelpers';

// Ce fichier fait au plus 8 recherches Open Food Facts (limite du client, voir testHelpers).

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  setCiqualCatalog([]); // le catalogue en mémoire survit à resetDb()
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openAddSheet() {
  const user = userEvent.setup();
  renderNutrition();
  await user.click(await screen.findByRole('button', { name: /Ajouter un aliment.*Déjeuner/ }));
  const sheet = await screen.findByRole('dialog');
  return { user, sheet: within(sheet) };
}

const chickenOff = (n: number, kcal = 110) =>
  offProduct({
    code: `32500000000${n}`,
    name: `Filet de poulet cru marque ${n}`,
    brand: `Marque ${n}`,
    kcal,
    proteinG: 22 + (n % 3) * 0.5,
    carbsG: 0.3,
    fatG: 2 + (n % 2) * 0.4,
  });

describe('Ajouter un aliment — hors ligne', () => {
  it('fonctionne hors ligne sur ce qui est déjà enregistré et le dit clairement', async () => {
    setOnline(false);
    const fetchMock = mockFetchJson({ products: [] });
    await createFood({ name: 'Blanc de poulet', servingG: 125 });
    await createFood({ name: 'Riz cuit' });
    const { user, sheet } = await openAddSheet();

    expect(sheet.getByText(/Tu es hors ligne/)).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Chercher en ligne' })).toBeDisabled();

    await user.type(sheet.getByLabelText('Rechercher un aliment'), 'poulet');
    const result = await sheet.findByRole('button', { name: /Blanc de poulet/ });
    expect(sheet.queryByText('Riz cuit')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(result);
    // la portion habituelle (125 g) est proposée et choisie par défaut
    expect(sheet.getByLabelText('Quantité (g)')).toHaveValue('125');
    await user.click(sheet.getByRole('button', { name: 'Ajouter à Déjeuner' }));

    await waitFor(async () => expect(await foodLogEntryRepo.list()).toHaveLength(1));
    const [entry] = await foodLogEntryRepo.list();
    expect(entry).toMatchObject({ date: todayDay(), mealType: 'lunch', grams: 125 });
    expect(await screen.findByText(/125 g · 138 kcal/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cherche dans le catalogue CIQUAL enregistré, sans réseau', async () => {
    setOnline(false);
    await saveCiqualCatalog(parseCiqualCsv(sample).foods);
    const { user, sheet } = await openAddSheet();
    await user.type(sheet.getByLabelText('Rechercher un aliment'), 'poulet blanc');
    const result = await sheet.findByRole('button', { name: /Poulet, blanc, sans peau, cru/ });
    expect(result).toHaveTextContent('CIQUAL');
    await user.click(result);
    await user.click(sheet.getByRole('button', { name: '150 g' }));
    await user.click(sheet.getByRole('button', { name: 'Ajouter à Déjeuner' }));

    await waitFor(async () => expect(await foodRepo.list()).toHaveLength(1));
    expect((await foodRepo.list())[0]).toMatchObject({ source: 'ciqual' });
    expect((await foodLogEntryRepo.list())[0]?.grams).toBe(150);
  });

  it('signale que le catalogue CIQUAL n’est pas chargé', async () => {
    const { sheet } = await openAddSheet();
    expect(await sheet.findByText(/catalogue CIQUAL n’est pas chargé/)).toBeInTheDocument();
    expect(sheet.getByRole('link', { name: 'Le charger' })).toHaveAttribute(
      'href',
      '/nutrition/catalogue',
    );
  });
});

describe('Ajouter un aliment — Open Food Facts', () => {
  it('succès : n’appelle le réseau qu’à la validation, cite la source et enregistre l’aliment', async () => {
    const fetchMock = mockFetchJson({ products: [chickenOff(1), chickenOff(2)] });
    const { user, sheet } = await openAddSheet();

    await user.type(sheet.getByLabelText('Rechercher un aliment'), 'filet de poulet');
    await sheet.findByText(/Touche « Chercher en ligne »/);
    expect(fetchMock).not.toHaveBeenCalled(); // rien pendant la frappe

    await user.click(sheet.getByRole('button', { name: 'Chercher en ligne' }));
    const result = await sheet.findByRole('button', { name: /Filet de poulet cru marque 1/ });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sheet.getByRole('link', { name: 'Open Food Facts' })).toHaveAttribute(
      'href',
      'https://world.openfoodfacts.org',
    );

    await user.click(result);
    await user.clear(sheet.getByLabelText('Quantité (g)'));
    await user.type(sheet.getByLabelText('Quantité (g)'), '180');
    await user.click(sheet.getByRole('button', { name: 'Ajouter à Déjeuner' }));

    await waitFor(async () => expect(await foodLogEntryRepo.list()).toHaveLength(1));
    const foods = await foodRepo.list();
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ source: 'openfoodfacts', brand: 'Marque 1' });
  });

  it('touche Entrée = recherche en ligne', async () => {
    const fetchMock = mockFetchJson({ products: [chickenOff(3)] });
    const { user, sheet } = await openAddSheet();
    await user.type(sheet.getByLabelText('Rechercher un aliment'), 'poulet{Enter}');
    await sheet.findByRole('button', { name: /marque 3/ });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('échec du serveur : message clair et résultats déjà enregistrés conservés', async () => {
    mockFetchJson({}, 500);
    await createFood({ name: 'Poulet rôti maison' });
    const { user, sheet } = await openAddSheet();
    await user.type(sheet.getByLabelText('Rechercher un aliment'), 'poulet');
    await sheet.findByRole('button', { name: /Poulet rôti maison/ });
    await user.click(sheet.getByRole('button', { name: 'Chercher en ligne' }));

    const alert = await sheet.findByRole('alert');
    expect(alert).toHaveTextContent(/déjà enregistré/);
    expect(sheet.getByRole('button', { name: /Poulet rôti maison/ })).toBeInTheDocument();
    expect(sheet.queryByRole('link', { name: 'Open Food Facts' })).not.toBeInTheDocument();
  });

  it('coupure réseau : message clair, pas de plantage', async () => {
    mockFetchNetworkError();
    const { user, sheet } = await openAddSheet();
    await user.type(sheet.getByLabelText('Rechercher un aliment'), 'poulet');
    await user.click(sheet.getByRole('button', { name: 'Chercher en ligne' }));
    expect(await sheet.findByRole('alert')).toHaveTextContent(
      /Impossible de joindre Open Food Facts/,
    );
    expect(sheet.getByText('Aucun résultat')).toBeInTheDocument();
  });

  it('n’affiche pas les produits incomplets ou incohérents', async () => {
    mockFetchJson({
      products: [chickenOff(4), chickenOff(5, 900), { code: '1', product_name: 'Sans valeurs' }],
    });
    const { user, sheet } = await openAddSheet();
    await user.type(sheet.getByLabelText('Rechercher un aliment'), 'poulet{Enter}');
    await sheet.findByRole('button', { name: /marque 4/ });
    expect(sheet.queryByRole('button', { name: /marque 5/ })).not.toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: /Sans valeurs/ })).not.toBeInTheDocument();
  });
});

describe('Moyenne de plusieurs marques', () => {
  it('calcule, détaille (fourchette, produits retenus/écartés, confiance, rejets) puis enregistre', async () => {
    mockFetchJson({
      products: [
        chickenOff(1),
        chickenOff(2),
        chickenOff(3),
        chickenOff(4),
        chickenOff(5),
        chickenOff(6, 480), // calories incohérentes : écarté
      ],
    });
    const { user, sheet } = await openAddSheet();
    await user.type(sheet.getByLabelText('Rechercher un aliment'), 'filet de poulet cru{Enter}');
    await user.click(await sheet.findByRole('button', { name: /Filet de poulet cru marque 1/ }));
    await user.click(sheet.getByRole('button', { name: 'Moyenne de plusieurs marques' }));

    expect(
      await sheet.findByText('Valeur moyenne pour 100 g (fourchette min–max)'),
    ).toBeInTheDocument();
    expect(sheet.getByLabelText('Produits')).toHaveTextContent('5 produits retenus · 1 écarté');
    expect(sheet.getByLabelText('Valeurs moyennes pour 100 g')).toHaveTextContent('110 kcal');
    expect(sheet.getByLabelText('Valeurs moyennes pour 100 g')).toHaveTextContent('(110–110)');
    expect(sheet.getByLabelText('Confiance')).toHaveTextContent(
      /Niveau de confiance : (Bonne|Moyenne|Faible)/,
    );

    await user.click(sheet.getByText(/Produits écartés \(1\)/));
    expect(sheet.getByText(/Calories incohérentes avec les macros/)).toBeInTheDocument();
    expect(sheet.getByText(/Filet de poulet cru marque 6/)).toBeInTheDocument();

    expect(sheet.getByLabelText('Nom de l’aliment')).toHaveValue('Filet de poulet cru');
    await user.click(sheet.getByRole('button', { name: 'Enregistrer cette moyenne' }));

    // on arrive sur la fiche de l'aliment enregistré, reconnaissable comme moyenne
    expect(await sheet.findByText('Moyenne')).toBeInTheDocument();
    expect(
      sheet.getByText(/Fourchette : 110 à 110 kcal pour 100 g, sur 5 produits/),
    ).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Ajouter à Déjeuner' }));

    await waitFor(async () => expect(await foodLogEntryRepo.list()).toHaveLength(1));
    const foods = await foodRepo.list();
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ source: 'average', name: 'Filet de poulet cru' });
    expect(foods[0]?.average).toMatchObject({ sourceCount: 5, rejectedCount: 1, state: 'raw' });
    expect(await screen.findByText('5 produits')).toBeInTheDocument();
  });
});

describe('Créer un aliment à la main', () => {
  it('valide les champs puis crée l’aliment et ouvre sa fiche', async () => {
    const { user, sheet } = await openAddSheet();
    await user.type(sheet.getByLabelText('Rechercher un aliment'), 'Pain maison');
    await user.click(sheet.getByRole('button', { name: 'Créer un aliment à la main' }));

    expect(sheet.getByLabelText('Nom')).toHaveValue('Pain maison');
    await user.click(sheet.getByRole('button', { name: 'Créer l’aliment' }));
    expect(sheet.getAllByText('Obligatoire').length).toBeGreaterThanOrEqual(4);
    expect(await foodRepo.list()).toHaveLength(0);

    await user.type(sheet.getByLabelText('Calories'), '250');
    await user.type(sheet.getByLabelText('Protéines'), '8,5');
    await user.type(sheet.getByLabelText('Glucides'), '48');
    await user.type(sheet.getByLabelText('Lipides'), '1.5');
    await user.type(sheet.getByLabelText('Portion habituelle (facultatif)'), '40');
    await user.click(sheet.getByRole('button', { name: 'Créer l’aliment' }));

    expect(await sheet.findByRole('heading', { name: 'Pain maison' })).toBeInTheDocument();
    const [food] = await foodRepo.list();
    expect(food).toMatchObject({
      name: 'Pain maison',
      kcal: 250,
      proteinG: 8.5,
      carbsG: 48,
      fatG: 1.5,
      fiberG: null,
      servingG: 40,
      source: 'manual',
    });
    expect(sheet.getByLabelText('Quantité (g)')).toHaveValue('40');
  });

  it('refuse des valeurs impossibles', async () => {
    const { user, sheet } = await openAddSheet();
    await user.click(sheet.getByRole('button', { name: 'Créer un aliment à la main' }));
    await user.type(sheet.getByLabelText('Nom'), 'Bizarre');
    await user.type(sheet.getByLabelText('Calories'), '2000');
    await user.type(sheet.getByLabelText('Protéines'), '150');
    await user.type(sheet.getByLabelText('Glucides'), 'abc');
    await user.type(sheet.getByLabelText('Lipides'), '1');
    await user.click(sheet.getByRole('button', { name: 'Créer l’aliment' }));
    expect(sheet.getByText('Maximum 900 kcal pour 100 g')).toBeInTheDocument();
    expect(sheet.getByText('Maximum 100 g pour 100 g')).toBeInTheDocument();
    expect(sheet.getByText('Nombre invalide')).toBeInTheDocument();
    expect(await foodRepo.list()).toHaveLength(0);
  });
});

describe('Récents et mes aliments', () => {
  it('propose les aliments récents puis la liste de mes aliments', async () => {
    const rice = await createFood({ name: 'Riz cuit' });
    await createFood({ name: 'Avocat' });
    await logFood(rice, todayDay(), 'dinner', 100);
    const { user, sheet } = await openAddSheet();

    const recent = await sheet.findByRole('button', { name: /Riz cuit/ });
    expect(recent).toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: /Avocat/ })).not.toBeInTheDocument();
    await user.click(sheet.getByRole('tab', { name: 'Mes aliments' }));
    expect(await sheet.findByRole('button', { name: /Avocat/ })).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: /Riz cuit/ })).toBeInTheDocument();
  });
});
