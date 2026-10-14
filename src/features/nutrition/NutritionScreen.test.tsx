import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { foodLogEntryRepo, goalRepo, mealRepo } from '@/data';
import { resetDb } from '@/test/fixtures';
import { addDays, todayDay } from './logic';
import { createFood, logFood, renderNutrition } from './testHelpers';

const today = () => todayDay();

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

const section = (name: string) => screen.getByRole('region', { name });

describe('Journal du jour', () => {
  it('affiche les repas, les aliments avec grammes, kcal et macros, et les totaux', async () => {
    const chicken = await createFood();
    await logFood(chicken, today(), 'lunch', 200);
    renderNutrition();

    const lunch = within(await screen.findByRole('region', { name: 'Déjeuner' }));
    expect(await lunch.findByText('Blanc de poulet')).toBeInTheDocument();
    expect(lunch.getByText(/200 g · 220 kcal · P 45 · G 0 · L 4,4/)).toBeInTheDocument();

    for (const name of ['Petit-déjeuner', 'Dîner', 'Collation']) {
      expect(within(section(name)).getByText('Rien de saisi pour ce repas.')).toBeInTheDocument();
    }
    const totals = within(screen.getByRole('region', { name: 'Totaux du jour' }));
    expect(totals.getByText('220')).toBeInTheDocument();
    expect(totals.getByRole('progressbar', { name: 'Protéines' })).toHaveAttribute(
      'aria-valuenow',
      '45',
    );
  });

  it('montre le reste à manger par rapport à l’objectif, et le dépassement', async () => {
    const chicken = await createFood();
    await goalRepo.create({
      type: 'calories',
      targetValue: 2000,
      targetDate: null,
      exerciseId: null,
      measurement: null,
    });
    await logFood(chicken, today(), 'lunch', 200);
    renderNutrition();
    expect(await screen.findByText(/Reste 1\s780 kcal/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Calories' })).toHaveAttribute(
      'aria-valuemax',
      '2000',
    );

    await logFood(chicken, today(), 'dinner', 2000);
    expect(await screen.findByText('Dépassé de 420 kcal')).toBeInTheDocument();
  });

  it('invite à fixer un objectif quand il n’y en a pas', async () => {
    renderNutrition();
    expect(await screen.findByText(/Fixe un objectif de calories/)).toBeInTheDocument();
  });

  it('navigue entre les jours', async () => {
    const chicken = await createFood();
    await logFood(chicken, addDays(today(), -1), 'dinner', 100);
    const user = userEvent.setup();
    renderNutrition();

    expect(await screen.findByText('Aujourd’hui')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Jour précédent' }));
    expect(await screen.findByText('Hier')).toBeInTheDocument();
    expect(await within(section('Dîner')).findByText('Blanc de poulet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Jour suivant' }));
    expect(await screen.findByText('Aujourd’hui')).toBeInTheDocument();
    expect(within(section('Dîner')).queryByText('Blanc de poulet')).not.toBeInTheDocument();
  });

  it('propose de choisir une date', async () => {
    renderNutrition();
    const picker = await screen.findByLabelText('Choisir une date');
    expect(picker).toHaveValue(today());
  });

  it('modifie les grammes d’une ligne', async () => {
    const chicken = await createFood();
    await logFood(chicken, today(), 'lunch', 200);
    const user = userEvent.setup();
    renderNutrition();

    await user.click(await screen.findByRole('button', { name: 'Modifier Blanc de poulet' }));
    const field = screen.getByLabelText('Quantité (g)');
    await user.clear(field);
    await user.type(field, '300');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await within(section('Déjeuner')).findByText(/300 g · 330 kcal/)).toBeInTheDocument();
  });

  it('supprime une ligne', async () => {
    const chicken = await createFood();
    await logFood(chicken, today(), 'lunch', 200);
    const user = userEvent.setup();
    renderNutrition();

    await user.click(await screen.findByRole('button', { name: 'Supprimer Blanc de poulet' }));
    await waitFor(() =>
      expect(within(section('Déjeuner')).queryByText('Blanc de poulet')).not.toBeInTheDocument(),
    );
    expect(await foodLogEntryRepo.list()).toHaveLength(0);
  });

  it('reconnaît un aliment « moyenne » : badge et fourchette', async () => {
    const average = await createFood({
      name: 'Blanc de poulet cru',
      source: 'average',
      average: {
        sourceCount: 7,
        rejectedCount: 2,
        confidence: 'high',
        state: 'raw',
        ranges: { kcal: { min: 105, max: 118 } },
        computedAt: '2026-10-12T08:00:00.000Z',
      },
    });
    await logFood(average, today(), 'lunch', 150);
    renderNutrition();
    const lunch = within(await screen.findByRole('region', { name: 'Déjeuner' }));
    expect(await lunch.findByText('Moyenne')).toBeInTheDocument();
    expect(lunch.getByText('7 produits')).toBeInTheDocument();
    expect(lunch.getByText('entre 158 et 177 kcal')).toBeInTheDocument();
  });

  it('crée puis modifie l’objectif de calories et garde les repères de macros', async () => {
    const user = userEvent.setup();
    renderNutrition();
    await user.click(await screen.findByRole('button', { name: 'Mes objectifs' }));
    await user.type(screen.getByLabelText('Objectif de calories (kcal par jour)'), '2200');
    await user.type(screen.getByLabelText('Protéines (g)'), '160');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('/ 2 200 kcal')).toBeInTheDocument();
    const goals = await goalRepo.findBy('type', 'calories');
    expect(goals).toHaveLength(1);
    expect(goals[0]?.targetValue).toBe(2200);
    expect(screen.getByText(/0 \/ 160 g/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mes objectifs' }));
    const kcal = screen.getByLabelText('Objectif de calories (kcal par jour)');
    await user.clear(kcal);
    await user.type(kcal, '1900');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(async () =>
      expect((await goalRepo.findBy('type', 'calories'))[0]?.targetValue).toBe(1900),
    );
    expect(await goalRepo.findBy('type', 'calories')).toHaveLength(1);
  });
});

describe('Repas enregistrés et copie de la veille', () => {
  it('copie la veille', async () => {
    const chicken = await createFood();
    await logFood(chicken, addDays(today(), -1), 'lunch', 120);
    const user = userEvent.setup();
    renderNutrition();

    await user.click(await screen.findByRole('button', { name: 'Copier la veille' }));
    expect(await within(section('Déjeuner')).findByText(/120 g/)).toBeInTheDocument();
    expect(await foodLogEntryRepo.findBy('date', today())).toHaveLength(1);
  });

  it('n’affiche pas « Copier la veille » quand la veille est vide', async () => {
    renderNutrition();
    await screen.findByRole('region', { name: 'Déjeuner' });
    expect(screen.queryByRole('button', { name: 'Copier la veille' })).not.toBeInTheDocument();
  });

  it('enregistre un repas du journal puis le rajoute en un geste', async () => {
    const chicken = await createFood();
    const rice = await createFood({
      name: 'Riz cuit',
      kcal: 130,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
    });
    await logFood(chicken, today(), 'lunch', 150);
    await logFood(rice, today(), 'lunch', 200);
    const user = userEvent.setup();
    renderNutrition();

    await user.click(await screen.findByRole('button', { name: /Enregistrer ce repas/ }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer le repas' }));
    await waitFor(async () => expect(await mealRepo.list()).toHaveLength(1));
    const [meal] = await mealRepo.list();
    expect(meal?.name).toBe('Déjeuner');
    // l'ordre n'est pas garanti quand deux lignes sont créées dans la même milliseconde
    expect(meal?.items).toHaveLength(2);
    expect(meal?.items).toContainEqual({ foodId: chicken.id, grams: 150 });
    expect(meal?.items).toContainEqual({ foodId: rice.id, grams: 200 });

    await user.click(screen.getByRole('button', { name: /Repas enregistré.*Dîner/ }));
    await user.click(await screen.findByRole('button', { name: 'Ajouter le repas Déjeuner' }));
    const dinner = within(section('Dîner'));
    expect(await dinner.findByText('Riz cuit')).toBeInTheDocument();
    expect(await dinner.findByText('Blanc de poulet')).toBeInTheDocument();
  });

  it('explique comment créer un repas quand il n’y en a pas', async () => {
    const user = userEvent.setup();
    renderNutrition();
    await user.click(await screen.findByRole('button', { name: /Repas enregistré.*Collation/ }));
    expect(await screen.findByText('Aucun repas enregistré')).toBeInTheDocument();
  });
});
