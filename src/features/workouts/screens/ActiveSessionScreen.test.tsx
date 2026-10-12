import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { routineRepo, saveSettings, setEntryRepo, workoutSessionRepo } from '@/data';
import { resetDb } from '../../../test/fixtures';
import { BENCH, CURL, PLANK, renderWorkouts, seedExercises, SQUAT } from '../testHelpers';

const plan = (exerciseId: string, extra = {}) => [
  {
    exerciseId,
    targetSets: 3,
    targetReps: '8-12',
    restSeconds: 90,
    note: '',
    skipped: false,
    ...extra,
  },
];

async function createSession(overrides = {}) {
  return workoutSessionRepo.create({
    routineId: null,
    name: 'Haut du corps',
    startedAt: new Date().toISOString(),
    endedAt: null,
    note: '',
    ...overrides,
  });
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  await seedExercises();
});

describe('Séance en cours : saisie d’une série', () => {
  it('enregistre la série tout de suite en base et lance le chrono de repos', async () => {
    const user = userEvent.setup();
    const session = await createSession();
    await workoutSessionRepo.update(session.id, { plan: plan(BENCH) });
    renderWorkouts(`/entrainement/seance/${session.id}`);

    expect(await screen.findByRole('heading', { name: 'Développé couché' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Charge (kg)'), '60');
    await user.type(screen.getByLabelText('Répétitions'), '8');
    await user.click(screen.getByRole('button', { name: 'Valider' }));

    // 1. La série est dans la base, tout de suite
    await waitFor(async () => {
      const saved = await setEntryRepo.findBy('sessionId', session.id);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ exerciseId: BENCH, weight: 60, reps: 8, isWarmup: false });
    });

    // 2. La série apparaît enregistrée, une nouvelle ligne est prête
    expect(await screen.findByText(/Enregistrée/)).toBeInTheDocument();
    expect(screen.getByText('Série 2 / 3')).toBeInTheDocument();

    // 3. Le chrono de repos a démarré sur 1:30
    const group = screen.getByRole('group', { name: 'Chrono de repos' });
    expect(within(group).getByRole('timer')).toHaveTextContent(/1:(30|29)/);
  });

  it('utilise le repos par défaut des Réglages quand le programme n’en précise pas', async () => {
    const user = userEvent.setup();
    await saveSettings({ defaultRestSeconds: 45 });
    const session = await createSession();
    await workoutSessionRepo.update(session.id, { plan: plan(BENCH, { restSeconds: null }) });
    renderWorkouts(`/entrainement/seance/${session.id}`);
    await screen.findByRole('heading', { name: 'Développé couché' });
    await user.type(screen.getByLabelText('Charge (kg)'), '60');
    await user.type(screen.getByLabelText('Répétitions'), '8');
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    const group = await screen.findByRole('group', { name: 'Chrono de repos' });
    expect(within(group).getByRole('timer')).toHaveTextContent(/0:(45|44)/);
  });

  it('les boutons + et − modifient la valeur d’un geste', async () => {
    const user = userEvent.setup();
    const session = await createSession();
    await workoutSessionRepo.update(session.id, { plan: plan(BENCH) });
    renderWorkouts(`/entrainement/seance/${session.id}`);
    await screen.findByRole('heading', { name: 'Développé couché' });

    const weight = screen.getByLabelText('Charge (kg)');
    await user.click(screen.getByRole('button', { name: 'Plus : Charge (kg)' }));
    await user.click(screen.getByRole('button', { name: 'Plus : Charge (kg)' }));
    expect(weight).toHaveValue('5');
    await user.click(screen.getByRole('button', { name: 'Moins : Charge (kg)' }));
    expect(weight).toHaveValue('2,5');
  });

  it('refuse une série sans répétitions et l’explique', async () => {
    const user = userEvent.setup();
    const session = await createSession();
    await workoutSessionRepo.update(session.id, { plan: plan(BENCH) });
    renderWorkouts(`/entrainement/seance/${session.id}`);
    await screen.findByRole('heading', { name: 'Développé couché' });

    await user.click(screen.getByRole('button', { name: 'Valider' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Indique le nombre de répétitions.');
    expect(await setEntryRepo.findBy('sessionId', session.id)).toHaveLength(0);
  });

  it('pré-remplit avec la dernière performance et l’affiche à côté de la série', async () => {
    const user = userEvent.setup();
    const old = await createSession({
      name: 'Haut du corps',
      startedAt: '2026-10-01T08:00:00.000Z',
      endedAt: '2026-10-01T09:00:00.000Z',
    });
    for (const [order, reps] of [
      [0, 8],
      [1, 7],
    ] as const) {
      await setEntryRepo.create({
        sessionId: old.id,
        exerciseId: BENCH,
        order,
        weight: 60,
        reps,
        durationSeconds: null,
        distanceMeters: null,
        rpe: null,
        isWarmup: false,
        note: '',
      });
    }
    const session = await createSession();
    await workoutSessionRepo.update(session.id, { plan: plan(BENCH) });
    renderWorkouts(`/entrainement/seance/${session.id}`);
    await screen.findByRole('heading', { name: 'Développé couché' });

    expect(await screen.findByText('Dernière fois : 60 kg × 8')).toBeInTheDocument();
    expect(screen.getByLabelText('Charge (kg)')).toHaveValue('60');
    expect(screen.getByLabelText('Répétitions')).toHaveValue('8');

    // Valider tel quel : un seul geste
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    await waitFor(async () => {
      expect(await setEntryRepo.findBy('sessionId', session.id)).toHaveLength(1);
    });
    // La série suivante reprend la 2e série de la dernière fois
    expect(await screen.findByText('Dernière fois : 60 kg × 7')).toBeInTheDocument();
    // le dernier champ « Répétitions » est celui de la nouvelle ligne (les précédents sont déjà enregistrés)
    expect(screen.getAllByLabelText('Répétitions').at(-1)).toHaveValue('7');
  });

  it('adapte les champs au type de saisie (durée)', async () => {
    const session = await createSession();
    await workoutSessionRepo.update(session.id, { plan: plan(PLANK, { targetReps: '45 s' }) });
    renderWorkouts(`/entrainement/seance/${session.id}`);
    await screen.findByRole('heading', { name: 'Gainage' });
    expect(screen.getByLabelText('Durée (s)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Charge (kg)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Répétitions')).not.toBeInTheDocument();
  });

  it('propose +2,5 kg quand toutes les séries ont atteint le haut de la fourchette', async () => {
    const user = userEvent.setup();
    const old = await createSession({
      startedAt: '2026-10-01T08:00:00.000Z',
      endedAt: '2026-10-01T09:00:00.000Z',
    });
    for (let order = 0; order < 3; order += 1) {
      await setEntryRepo.create({
        sessionId: old.id,
        exerciseId: BENCH,
        order,
        weight: 60,
        reps: 12,
        durationSeconds: null,
        distanceMeters: null,
        rpe: null,
        isWarmup: false,
        note: '',
      });
    }
    const session = await createSession();
    await workoutSessionRepo.update(session.id, { plan: plan(BENCH) });
    renderWorkouts(`/entrainement/seance/${session.id}`);
    expect(await screen.findByText(/Suggestion : 62,5 kg/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Utiliser 62,5 kg' }));
    expect(screen.getByLabelText('Charge (kg)')).toHaveValue('62,5');
  });

  it('une série d’échauffement n’est pas comptée dans le volume', async () => {
    const user = userEvent.setup();
    const session = await createSession();
    await workoutSessionRepo.update(session.id, { plan: plan(BENCH) });
    renderWorkouts(`/entrainement/seance/${session.id}`);
    await screen.findByRole('heading', { name: 'Développé couché' });

    await user.type(screen.getByLabelText('Charge (kg)'), '40');
    await user.type(screen.getByLabelText('Répétitions'), '10');
    await user.click(screen.getByLabelText('Échauffement'));
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    await waitFor(async () => {
      const saved = await setEntryRepo.findBy('sessionId', session.id);
      expect(saved[0]).toMatchObject({ isWarmup: true });
    });
    expect(await screen.findByText('Échauffement 1')).toBeInTheDocument();
    const stats = screen.getByText('Volume').parentElement;
    expect(stats).toHaveTextContent('0');
  });

  it('permet d’ajouter, de remplacer et de passer un exercice', async () => {
    const user = userEvent.setup();
    const session = await createSession();
    await workoutSessionRepo.update(session.id, { plan: plan(BENCH) });
    renderWorkouts(`/entrainement/seance/${session.id}`);
    await screen.findByRole('heading', { name: 'Développé couché' });

    // Ajouter
    await user.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    await user.click(await screen.findByRole('button', { name: /Squat/ }));
    expect(await screen.findByRole('heading', { name: 'Squat' })).toBeInTheDocument();

    // Remplacer le développé couché
    const benchCard = screen.getByRole('heading', { name: 'Développé couché' }).closest('section');
    if (!benchCard) throw new Error('bloc introuvable');
    await user.click(within(benchCard).getByRole('button', { name: 'Remplacer' }));
    await user.click(await screen.findByRole('button', { name: /Curl haltères/ }));
    expect(await screen.findByRole('heading', { name: 'Curl haltères' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Développé couché' })).not.toBeInTheDocument();

    // Passer le squat, puis le rétablir
    const squatCard = screen.getByRole('heading', { name: 'Squat' }).closest('section');
    if (!squatCard) throw new Error('bloc introuvable');
    await user.click(within(squatCard).getByRole('button', { name: 'Passer' }));
    expect(await screen.findByText('Passé pour aujourd’hui')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rétablir' }));
    expect(screen.queryByText('Passé pour aujourd’hui')).not.toBeInTheDocument();

    // Le plan modifié est enregistré dans la séance (donc dans la sauvegarde)
    await waitFor(async () => {
      const saved = await workoutSessionRepo.get(session.id);
      expect(saved?.plan.map((item) => [item.exerciseId, item.skipped])).toEqual([
        [CURL, false],
        [SQUAT, false],
      ]);
    });
  });

  it('reconstruit le plan depuis le programme s’il est vide (séance d’avant la version 2)', async () => {
    const routine = await routineRepo.create({
      name: 'Jambes',
      note: '',
      items: [{ exerciseId: SQUAT, targetSets: 4, targetReps: '6-8', restSeconds: 180, note: '' }],
    });
    const session = await createSession({ routineId: routine.id, name: 'Jambes' });
    renderWorkouts(`/entrainement/seance/${session.id}`);
    expect(await screen.findByRole('heading', { name: 'Squat' })).toBeInTheDocument();
    await waitFor(async () =>
      expect((await workoutSessionRepo.get(session.id))?.plan).toHaveLength(1),
    );
  });

  it('termine la séance : elle apparaît dans l’historique avec ses séries', async () => {
    const user = userEvent.setup();
    const session = await createSession();
    await workoutSessionRepo.update(session.id, { plan: plan(BENCH) });
    renderWorkouts(`/entrainement/seance/${session.id}`);
    await screen.findByRole('heading', { name: 'Développé couché' });
    await user.type(screen.getByLabelText('Charge (kg)'), '60');
    await user.type(screen.getByLabelText('Répétitions'), '8');
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    await screen.findByText(/Enregistrée/);

    await user.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    await user.click(await screen.findByRole('button', { name: 'Terminer' }));

    await waitFor(async () => {
      expect((await workoutSessionRepo.get(session.id))?.endedAt).not.toBeNull();
    });
    // On arrive sur le détail de la séance
    expect(await screen.findByText('60 kg × 8')).toBeInTheDocument();
  });
});
