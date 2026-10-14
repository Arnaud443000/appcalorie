import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bodyMetricRepo,
  db,
  foodLogEntryRepo,
  foodRepo,
  goalRepo,
  saveSettings,
  setEntryRepo,
  workoutSessionRepo,
} from '@/data';
import { resetDb } from '../../test/fixtures';
import { BENCH, daysAgo, renderTracking, seedExercises, SQUAT, todayDay } from './testHelpers';

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  await seedExercises();
});

async function weigh(day: string, weightKg: number) {
  return bodyMetricRepo.create({ date: day, weightKg, waistCm: null, measurements: {} });
}

async function session(
  day: string,
  sets: [string, number, number, boolean?][],
  startedAt = `${day}T09:00:00`,
) {
  const iso = new Date(startedAt).toISOString();
  const created = await workoutSessionRepo.create({
    routineId: null,
    name: 'Haut du corps',
    startedAt: iso,
    endedAt: iso,
    note: '',
  });
  let order = 0;
  for (const [exerciseId, weight, reps, isWarmup = false] of sets) {
    await setEntryRepo.create({
      sessionId: created.id,
      exerciseId,
      order: order++,
      weight,
      reps,
      durationSeconds: null,
      distanceMeters: null,
      rpe: null,
      isWarmup,
      note: '',
    });
  }
  return created;
}

/** Objectif créé il y a `days` jours (la date de création sert de point de départ). */
async function oldGoal(days: number, input: Parameters<typeof goalRepo.create>[0]) {
  const goal = await goalRepo.create(input);
  const createdAt = new Date(Date.now() - days * 86_400_000).toISOString();
  await db.goals.update(goal.id, { createdAt });
  return goal;
}

const goTo = async (user: ReturnType<typeof userEvent.setup>, tab: string) =>
  user.click(await screen.findByRole('tab', { name: tab }));

describe('Suivi — sans aucune donnée', () => {
  it('chaque onglet propose un état vide engageant, sans erreur', async () => {
    const user = userEvent.setup();
    renderTracking();
    expect(await screen.findByText('Ta première pesée')).toBeInTheDocument();
    expect(screen.getByLabelText('Résumé')).toHaveTextContent('Ton suivi se remplit tout seul');

    await goTo(user, 'Charges');
    expect(await screen.findByText('Pas encore de séance')).toBeInTheDocument();

    await goTo(user, 'Mesures');
    expect(await screen.findByText('Tes premières mensurations')).toBeInTheDocument();

    await goTo(user, 'Objectifs');
    expect(await screen.findByText('Fixe-toi un cap')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer un objectif' })).toBeInTheDocument();
  });

  it('l’onglet se choisit aussi par l’adresse (#/suivi?onglet=objectifs)', async () => {
    renderTracking('/suivi?onglet=objectifs');
    expect(await screen.findByText('Fixe-toi un cap')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Objectifs' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Suivi — poids', () => {
  it('enregistre une pesée, la montre dans l’historique et le résumé', async () => {
    const user = userEvent.setup();
    renderTracking();
    const field = await screen.findByLabelText('Poids (kg)');
    await user.type(field, '80,5');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Pesée enregistrée')).toBeInTheDocument();
    const [metric] = await bodyMetricRepo.list();
    expect(metric).toMatchObject({ date: todayDay(), weightKg: 80.5 });
    expect(await screen.findByRole('button', { name: /80,5 kg/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Résumé')).toHaveTextContent('80,5');
    // Une seule pesée : message plutôt qu'une courbe
    expect(screen.getByText(/Une seule valeur pour l’instant/)).toBeInTheDocument();
  });

  it('une deuxième pesée le même jour remplace la première', async () => {
    const user = userEvent.setup();
    renderTracking();
    const field = await screen.findByLabelText('Poids (kg)');
    await user.type(field, '80');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(async () => expect(await bodyMetricRepo.list()).toHaveLength(1));
    // Le bouton reste grisé pendant l'enregistrement : on attend qu'il soit de nouveau actif.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled());
    await user.clear(screen.getByLabelText('Poids (kg)'));
    await user.type(screen.getByLabelText('Poids (kg)'), '79,2');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(async () => expect((await bodyMetricRepo.list())[0]?.weightKg).toBe(79.2));
    expect(await bodyMetricRepo.list()).toHaveLength(1);
  });

  it('refuse une valeur vide ou absurde, sans rien enregistrer', async () => {
    const user = userEvent.setup();
    renderTracking();
    await screen.findByLabelText('Poids (kg)');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Entre une valeur en kg/);
    await user.type(screen.getByLabelText('Poids (kg)'), '8000');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/semble incorrecte/);
    expect(await bodyMetricRepo.list()).toHaveLength(0);
  });

  it('le champ part de la dernière pesée', async () => {
    await weigh(daysAgo(3), 81.2);
    renderTracking();
    expect(await screen.findByLabelText('Poids (kg)')).toHaveValue('81,2');
  });

  it('affiche variation, moyenne, tendance et comparaison avec des données', async () => {
    for (let i = 40; i >= 0; i -= 4) await weigh(daysAgo(i), 80 + i * 0.05);
    renderTracking();
    expect(await screen.findByText(/Tendance : en baisse/)).toBeInTheDocument();
    expect(screen.getByText('Variation')).toBeInTheDocument();
    expect(screen.getByText('Moyenne 7 j')).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Courbe de poids' })).toBeInTheDocument();
    // Comparer : phrase « Il y a … : … → aujourd'hui : … »
    expect(await screen.findByText(/→ aujourd’hui : 80 kg/)).toBeInTheDocument();
  });

  it('change de période', async () => {
    await weigh(daysAgo(200), 90);
    await weigh(daysAgo(2), 80);
    const user = userEvent.setup();
    renderTracking();
    await screen.findByText('Courbe de poids');
    // 3 mois par défaut : seule la pesée récente
    expect(screen.getByText(/Une seule valeur pour l’instant/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tout' }));
    expect(screen.queryByText(/Une seule valeur pour l’instant/)).toBeNull();
    await user.click(screen.getByRole('button', { name: '7 jours' }));
    expect(screen.getByText(/Une seule valeur pour l’instant/)).toBeInTheDocument();
  });

  it('période sans pesée : propose de choisir « Tout »', async () => {
    await weigh(daysAgo(200), 90);
    const user = userEvent.setup();
    renderTracking();
    await screen.findByText('Courbe de poids');
    await user.click(screen.getByRole('button', { name: '7 jours' }));
    expect(screen.getByText(/Aucune pesée sur cette période/)).toBeInTheDocument();
  });

  it('modifie puis supprime une pesée', async () => {
    await weigh(daysAgo(5), 82);
    await weigh(daysAgo(1), 81);
    const user = userEvent.setup();
    renderTracking();
    await user.click(await screen.findByRole('button', { name: /^82 kg/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Modifier la pesée' });
    const field = within(dialog).getByLabelText('Poids (kg)');
    expect(field).toHaveValue('82');
    await user.clear(field);
    await user.type(field, '82,6');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(async () => {
      const weights = (await bodyMetricRepo.list()).map((m) => m.weightKg).sort();
      expect(weights).toEqual([81, 82.6]);
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(await screen.findByRole('button', { name: /^81 kg/ }));
    const second = await screen.findByRole('dialog');
    await user.click(within(second).getByRole('button', { name: 'Supprimer' }));
    // Demande de confirmation avant de supprimer
    expect(await bodyMetricRepo.list()).toHaveLength(2);
    await user.click(within(second).getByRole('button', { name: 'Oui, supprimer' }));
    await waitFor(async () => expect(await bodyMetricRepo.list()).toHaveLength(1));
  });

  it('respecte l’unité des Réglages (livres)', async () => {
    await saveSettings({ weightUnit: 'lb' });
    await weigh(daysAgo(2), 80);
    renderTracking();
    expect(await screen.findByLabelText('Poids (lb)')).toBeInTheDocument();
    // 80 kg = 176,4 lb
    expect(await screen.findByRole('button', { name: /176,4 lb/ })).toBeInTheDocument();
  });

  it('la ligne d’objectif de poids figure dans la légende de la courbe', async () => {
    await weigh(daysAgo(8), 82);
    await weigh(daysAgo(1), 81);
    await goalRepo.create({
      type: 'weight',
      targetValue: 78,
      targetDate: null,
      exerciseId: null,
      measurement: null,
    });
    renderTracking();
    const figure = await screen.findByRole('figure', { name: 'Courbe de poids' });
    expect(within(figure).getAllByText('Objectif 78 kg').length).toBeGreaterThan(0);
  });
});

describe('Suivi — charges', () => {
  it('courbes, records et comparaison d’un exercice', async () => {
    await session(daysAgo(30), [
      [BENCH, 60, 8],
      [BENCH, 20, 12, true],
    ]);
    await session(daysAgo(14), [[BENCH, 65, 8]]);
    await session(daysAgo(2), [[BENCH, 70, 6]]);
    const user = userEvent.setup();
    renderTracking('/suivi?onglet=charges');

    expect(
      await screen.findByRole('button', { name: /Exercice : Développé couché/ }),
    ).toBeInTheDocument();
    const figure = screen.getByRole('figure', { name: /1RM estimé · Développé couché/ });
    expect(figure).toBeInTheDocument();
    // Records
    const records = screen
      .getByRole('heading', { name: 'Records' })
      .closest('section') as HTMLElement;
    expect(within(records).getByText('Charge max')).toBeInTheDocument();
    expect(within(records).getByText('70 kg')).toBeInTheDocument();
    expect(within(records).getByText('1RM estimé')).toBeInTheDocument();
    // Autre indicateur et regroupement
    await user.click(screen.getByRole('button', { name: 'Charge max' }));
    expect(
      screen.getByRole('figure', { name: /Charge max · Développé couché/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volume' }));
    await user.click(screen.getByRole('tab', { name: 'Semaine' }));
    expect(screen.getByText(/Le volume est additionné par semaine/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Mois' }));
    expect(screen.getByText(/additionné par mois/)).toBeInTheDocument();
    // Comparer
    await user.click(screen.getByRole('button', { name: 'Charge max' }));
    await user.click(screen.getByRole('tab', { name: 'Séance' }));
    expect(await screen.findByText(/→ aujourd’hui : 70 kg/)).toBeInTheDocument();
  });

  it('choisit un autre exercice par la recherche ; un exercice sans historique reste calme', async () => {
    await session(daysAgo(3), [[BENCH, 60, 8]]);
    await session(daysAgo(5), [[SQUAT, 100, 5]]);
    const user = userEvent.setup();
    renderTracking('/suivi?onglet=charges');
    await user.click(await screen.findByRole('button', { name: /Changer d’exercice/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Choisir un exercice' });
    await user.type(within(dialog).getByLabelText('Rechercher'), 'curl');
    await user.click(within(dialog).getByRole('button', { name: /Curl haltères/ }));
    expect(await screen.findByText('Pas encore d’historique')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Changer d’exercice/ }));
    const again = await screen.findByRole('dialog');
    await user.type(within(again).getByLabelText('Rechercher'), 'squat');
    await user.click(within(again).getByRole('button', { name: /Squat/ }));
    expect(await screen.findByRole('figure', { name: /Squat/ })).toBeInTheDocument();
  });

  it('retient l’exercice choisi', async () => {
    await session(daysAgo(3), [[BENCH, 60, 8]]);
    await session(daysAgo(5), [[SQUAT, 100, 5]]);
    const user = userEvent.setup();
    renderTracking('/suivi?onglet=charges');
    await user.click(await screen.findByRole('button', { name: /Changer d’exercice/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^Squat/ }));
    expect(localStorage.getItem('atlas.tracking.exercise')).toBe(SQUAT);
  });

  it('un objectif de charge trace sa ligne sur la courbe de charge max', async () => {
    await session(daysAgo(10), [[BENCH, 60, 8]]);
    await session(daysAgo(2), [[BENCH, 65, 8]]);
    await goalRepo.create({
      type: 'load',
      targetValue: 100,
      targetDate: null,
      exerciseId: BENCH,
      measurement: null,
    });
    const user = userEvent.setup();
    renderTracking('/suivi?onglet=charges');
    await user.click(await screen.findByRole('button', { name: 'Charge max' }));
    const figure = screen.getByRole('figure', { name: /Charge max/ });
    expect(within(figure).getAllByText('Objectif 100 kg').length).toBeGreaterThan(0);
  });
});

describe('Suivi — mensurations', () => {
  it('saisit le tour de taille puis plusieurs mensurations d’un coup', async () => {
    const user = userEvent.setup();
    renderTracking('/suivi?onglet=mensurations');
    await user.type(await screen.findByLabelText('Tour de taille (cm)'), '84,5');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(async () => expect((await bodyMetricRepo.list())[0]?.waistCm).toBe(84.5));

    await user.click(screen.getByRole('button', { name: 'Saisir plusieurs mensurations' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Bras'), '37');
    await user.type(within(dialog).getByLabelText('Poitrine'), '103,5');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(async () => {
      const list = await bodyMetricRepo.list();
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ waistCm: 84.5, measurements: { arm: 37, chest: 103.5 } });
    });
  });

  it('refuse un formulaire vide ou une valeur absurde', async () => {
    const user = userEvent.setup();
    renderTracking('/suivi?onglet=mensurations');
    await user.click(await screen.findByRole('button', { name: 'Saisir plusieurs mensurations' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Remplis au moins une mesure',
    );
    await user.type(within(dialog).getByLabelText('Cou'), '9999');
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/« Cou »/);
    expect(await bodyMetricRepo.list()).toHaveLength(0);
  });

  it('une courbe par mesure, avec son historique et sa comparaison', async () => {
    await bodyMetricRepo.create({
      date: daysAgo(60),
      weightKg: null,
      waistCm: 90,
      measurements: { arm: 35 },
    });
    await bodyMetricRepo.create({
      date: daysAgo(1),
      weightKg: null,
      waistCm: 87,
      measurements: { arm: 36.5 },
    });
    const user = userEvent.setup();
    renderTracking('/suivi?onglet=mensurations');
    expect(await screen.findByRole('figure', { name: 'Tour de taille' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bras' }));
    expect(screen.getByRole('figure', { name: 'Bras' })).toBeInTheDocument();
    expect(await screen.findByText(/→ aujourd’hui : 36,5 cm/)).toBeInTheDocument();
  });
});

describe('Suivi — objectifs', () => {
  it('crée un objectif de poids avec date, puis le supprime', async () => {
    await weigh(daysAgo(7), 82);
    await weigh(daysAgo(0), 81);
    const user = userEvent.setup();
    renderTracking('/suivi?onglet=objectifs');
    await user.click(await screen.findByRole('button', { name: 'Créer un objectif' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nouvel objectif' });
    const value = within(dialog).getByLabelText('Valeur cible (kg)');
    expect(value).toHaveValue('81'); // proposé : le poids actuel
    await user.clear(value);
    await user.type(value, '75');
    await user.click(within(dialog).getByRole('button', { name: 'Créer l’objectif' }));

    const card = await screen.findByLabelText('Poids : 75 kg');
    expect(await goalRepo.list()).toHaveLength(1);
    expect(within(card).getByRole('progressbar', { name: /Progression/ })).toBeInTheDocument();
    expect(within(card).getByText('Sans date cible')).toBeInTheDocument();
    expect(within(card).getByText('Départ')).toBeInTheDocument();
    expect(within(card).getByText(/Il te reste 6 kg/)).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Modifier' }));
    const edit = await screen.findByRole('dialog', { name: 'Modifier l’objectif' });
    await user.click(within(edit).getByRole('button', { name: 'Supprimer l’objectif' }));
    await user.click(within(edit).getByRole('button', { name: 'Oui, supprimer' }));
    await waitFor(async () => expect(await goalRepo.list()).toHaveLength(0));
    expect(await screen.findByText('Fixe-toi un cap')).toBeInTheDocument();
  });

  it('un objectif sans mesure explique quoi faire (pas d’erreur)', async () => {
    await goalRepo.create({
      type: 'weight',
      targetValue: 75,
      targetDate: null,
      exerciseId: null,
      measurement: null,
    });
    renderTracking('/suivi?onglet=objectifs');
    const card = await screen.findByLabelText('Poids : 75 kg');
    expect(within(card).getByText('Pas encore de mesure')).toBeInTheDocument();
    expect(within(card).getByText(/Ajoute une pesée/)).toBeInTheDocument();
  });

  it('un objectif atteint est signalé', async () => {
    await weigh(daysAgo(30), 82);
    await weigh(daysAgo(0), 74.5);
    await oldGoal(30, {
      type: 'weight',
      targetValue: 75,
      targetDate: null,
      exerciseId: null,
      measurement: null,
    });
    renderTracking('/suivi?onglet=objectifs');
    const card = await screen.findByLabelText('Poids : 75 kg');
    expect(within(card).getByText('Atteint')).toBeInTheDocument();
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('statut « en retard » quand la date cible est dépassée', async () => {
    await weigh(daysAgo(30), 82);
    await weigh(daysAgo(0), 81);
    await oldGoal(30, {
      type: 'weight',
      targetValue: 75,
      targetDate: daysAgo(1),
      exerciseId: null,
      measurement: null,
    });
    renderTracking('/suivi?onglet=objectifs');
    const card = await screen.findByLabelText('Poids : 75 kg');
    expect(within(card).getByText('En retard')).toBeInTheDocument();
    expect(within(card).getByText(/Date cible dépassée/)).toBeInTheDocument();
  });

  it('crée un objectif de charge sur un exercice', async () => {
    await session(daysAgo(3), [[BENCH, 60, 8]]);
    const user = userEvent.setup();
    renderTracking('/suivi?onglet=objectifs');
    await user.click(await screen.findByRole('button', { name: 'Créer un objectif' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Charge' }));
    // Sans exercice choisi : refus
    await user.click(within(dialog).getByRole('button', { name: 'Créer l’objectif' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Choisis l’exercice');
    await user.click(within(dialog).getByRole('button', { name: 'Choisir un exercice' }));
    await user.click(await within(dialog).findByRole('button', { name: /Développé couché/ }));
    const value = within(dialog).getByLabelText('Valeur cible (kg)');
    expect(value).toHaveValue('60');
    await user.clear(value);
    await user.type(value, '100');
    await user.click(within(dialog).getByRole('button', { name: 'Créer l’objectif' }));
    const card = await screen.findByLabelText(/Développé couché.* : 100 kg/);
    expect(card).toHaveTextContent(/60\s*kg/);
    expect((await goalRepo.list())[0]).toMatchObject({ type: 'load', exerciseId: BENCH });
  });

  it('refuse une valeur cible vide', async () => {
    const user = userEvent.setup();
    renderTracking('/suivi?onglet=objectifs');
    await user.click(await screen.findByRole('button', { name: 'Créer un objectif' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Créer l’objectif' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/valeur cible/);
    expect(await goalRepo.list()).toHaveLength(0);
  });

  it('objectif de calories : moyenne du journal des jours récents', async () => {
    const food = await foodRepo.create({
      name: 'Riz',
      brand: '',
      barcode: null,
      kcal: 100,
      proteinG: 2,
      carbsG: 20,
      fatG: 0,
      fiberG: null,
      servingG: null,
    });
    for (const n of [1, 2]) {
      await foodLogEntryRepo.create({
        date: daysAgo(n),
        mealType: 'lunch',
        foodId: food.id,
        grams: 2000,
      });
    }
    await goalRepo.create({
      type: 'calories',
      targetValue: 2000,
      targetDate: null,
      exerciseId: null,
      measurement: null,
    });
    renderTracking('/suivi?onglet=objectifs');
    const card = await screen.findByLabelText(/Calories par jour : 2 000 kcal/);
    await waitFor(() => expect(within(card).getByText('Dans la cible')).toBeInTheDocument());
    expect(within(card).getByText('Moyenne récente')).toBeInTheDocument();
  });

  it('objectif de calories sans journal : message clair', async () => {
    await goalRepo.create({
      type: 'calories',
      targetValue: 2000,
      targetDate: null,
      exerciseId: null,
      measurement: null,
    });
    renderTracking('/suivi?onglet=objectifs');
    const card = await screen.findByLabelText(/Calories par jour/);
    await waitFor(() =>
      expect(within(card).getByText('Pas encore de journal')).toBeInTheDocument(),
    );
    expect(within(card).getByText(/Note tes repas/)).toBeInTheDocument();
  });
});

describe('Suivi — résumé', () => {
  it('poids actuel, variation sur 30 jours, séances sur 7 jours et record récent', async () => {
    await weigh(daysAgo(25), 83);
    await weigh(daysAgo(0), 81);
    await session(daysAgo(12), [[BENCH, 60, 8]]);
    await session(daysAgo(3), [[BENCH, 65, 8]]);
    await session(daysAgo(1), [[SQUAT, 100, 5]]);
    renderTracking();
    const summary = await screen.findByLabelText('Résumé');
    await waitFor(() => expect(summary).toHaveTextContent('81'));
    expect(summary).toHaveTextContent('−2');
    expect(summary).toHaveTextContent('Séances 7 j');
    expect(within(summary).getByText('2')).toBeInTheDocument(); // 2 séances sur 7 jours
    expect(summary).toHaveTextContent('Développé couché');
    expect(summary).toHaveTextContent('65 kg');
  });

  it('les échauffements seuls ne comptent pas comme une séance', async () => {
    await session(daysAgo(1), [[BENCH, 20, 10, true]]);
    renderTracking();
    const summary = await screen.findByLabelText('Résumé');
    expect(within(summary).getByText('0')).toBeInTheDocument();
  });
});
