import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { goalRepo } from '@/data';
import { resetDb } from '@/test/fixtures';
import { addDays, todayDay } from '../logic';
import { createFood, logFood, renderNutrition } from '../testHelpers';

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

describe('Résumé hebdomadaire', () => {
  it('affiche les moyennes des jours saisis, le graphique et les jours sans saisie', async () => {
    const food = await createFood({ kcal: 100, proteinG: 10 });
    const today = todayDay();
    await logFood(food, today, 'lunch', 1000); // 1000 kcal, 100 g
    await logFood(food, addDays(today, -2), 'lunch', 2000); // 2000 kcal, 200 g
    renderNutrition('/nutrition/semaine');

    const averages = within(await screen.findByLabelText('Moyennes'));
    expect(averages.getByText('1 500')).toBeInTheDocument();
    expect(averages.getByText('150')).toBeInTheDocument();
    expect(averages.getByText(/Moyenne sur les 2 jours saisis/)).toBeInTheDocument();

    expect(screen.getByRole('img', { name: 'Calories par jour sur 7 jours' })).toBeInTheDocument();
    const missing = within(screen.getByLabelText('Jours sans saisie'));
    expect(missing.getAllByRole('listitem')).toHaveLength(5);
  });

  it('bascule le graphique sur les protéines et montre l’objectif', async () => {
    const food = await createFood();
    await logFood(food, todayDay(), 'lunch', 100);
    await goalRepo.create({
      type: 'calories',
      targetValue: 2000,
      targetDate: null,
      exerciseId: null,
      measurement: null,
    });
    const user = userEvent.setup();
    renderNutrition('/nutrition/semaine');

    expect(await screen.findByText(/objectif de 2\s000 kcal/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Protéines' }));
    expect(screen.getByRole('img', { name: 'Protéines par jour sur 7 jours' })).toBeInTheDocument();
    expect(screen.getByText(/repère de 125 g/)).toBeInTheDocument();
  });

  it('semaine vide : rien d’inventé, tous les jours signalés', async () => {
    renderNutrition('/nutrition/semaine');
    expect(await screen.findByText('Rien de saisi sur cette période')).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Jours sans saisie')).getAllByRole('listitem'),
    ).toHaveLength(7);
  });

  it('navigue vers la semaine précédente', async () => {
    const food = await createFood();
    await logFood(food, addDays(todayDay(), -9), 'lunch', 100);
    const user = userEvent.setup();
    renderNutrition('/nutrition/semaine');
    await screen.findByText('Rien de saisi sur cette période');
    expect(screen.getByRole('button', { name: 'Semaine suivante' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    expect(await screen.findByLabelText('Moyennes')).toBeInTheDocument();
  });

  it('passe d’un écran à l’autre avec les onglets', async () => {
    const user = userEvent.setup();
    renderNutrition('/nutrition/semaine');
    await user.click(await screen.findByRole('tab', { name: 'Journal' }));
    expect(await screen.findByRole('region', { name: 'Totaux du jour' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'CIQUAL' }));
    expect(await screen.findByText('Où trouver le fichier ?')).toBeInTheDocument();
  });
});
