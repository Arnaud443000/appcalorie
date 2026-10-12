import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { routineRepo, setEntryRepo, workoutSessionRepo } from '@/data';
import { resetDb } from '../../../test/fixtures';
import { BENCH, renderWorkouts, seedExercises } from '../testHelpers';

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  await seedExercises();
});

async function unfinishedSession() {
  const session = await workoutSessionRepo.create({
    routineId: null,
    name: 'Jambes',
    startedAt: new Date().toISOString(),
    endedAt: null,
    note: '',
  });
  await setEntryRepo.create({
    sessionId: session.id,
    exerciseId: BENCH,
    order: 0,
    weight: 80,
    reps: 5,
    durationSeconds: null,
    distanceMeters: null,
    rpe: null,
    isWarmup: false,
    note: '',
  });
  return session;
}

describe('Reprise d’une séance non terminée', () => {
  it('propose de reprendre la séance quand l’app est rouverte', async () => {
    const user = userEvent.setup();
    const session = await unfinishedSession();
    const router = renderWorkouts('/entrainement');

    expect(await screen.findByRole('heading', { name: 'Séance en cours' })).toBeInTheDocument();
    expect(screen.getByText(/Jambes/)).toBeInTheDocument();
    expect(await screen.findByText(/1 série notée/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reprendre la séance' }));
    expect(router.state.location.pathname).toBe(`/entrainement/seance/${session.id}`);
    // Les séries déjà notées sont là
    expect(await screen.findByText(/Enregistrée/)).toBeInTheDocument();
    // la série déjà notée (80 kg) est relue depuis la base, et une nouvelle ligne est prête
    const weights = screen.getAllByLabelText('Charge (kg)');
    expect(weights).toHaveLength(2);
    expect(weights[0]).toHaveValue('80');
  });

  it('empêche d’en démarrer une autre tant qu’elle n’est pas terminée', async () => {
    await unfinishedSession();
    renderWorkouts('/entrainement');
    await screen.findByRole('heading', { name: 'Séance en cours' });
    expect(screen.getByRole('button', { name: 'Séance libre' })).toBeDisabled();
  });

  it('ne propose rien quand toutes les séances sont terminées', async () => {
    await workoutSessionRepo.create({
      routineId: null,
      name: 'Dos',
      startedAt: '2026-10-01T08:00:00.000Z',
      endedAt: '2026-10-01T09:00:00.000Z',
      note: '',
    });
    renderWorkouts('/entrainement');
    expect(await screen.findByRole('button', { name: 'Séance libre' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'Séance en cours' })).not.toBeInTheDocument();
  });

  it('abandonner demande confirmation puis supprime la séance', async () => {
    const user = userEvent.setup();
    const session = await unfinishedSession();
    renderWorkouts('/entrainement');
    await user.click(await screen.findByRole('button', { name: 'Abandonner' }));
    await user.click(await screen.findByRole('button', { name: 'Oui, supprimer' }));
    await waitFor(async () => expect(await workoutSessionRepo.get(session.id)).toBeUndefined());
    expect(await setEntryRepo.findBy('sessionId', session.id)).toHaveLength(0);
  });
});

describe('Programmes', () => {
  it('démarre une séance libre', async () => {
    const user = userEvent.setup();
    const router = renderWorkouts('/entrainement');
    await user.click(await screen.findByRole('button', { name: 'Séance libre' }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/seance\//));
    expect(await screen.findByText('Séance libre', { selector: 'h2' })).toBeInTheDocument();
  });

  it('un programme vide démarre une séance libre', async () => {
    const user = userEvent.setup();
    await routineRepo.create({ name: 'Vide', note: '', items: [] });
    const router = renderWorkouts('/entrainement');
    expect(await screen.findByText('Programme vide : séance libre')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Démarrer Vide' }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/seance\//));
    const sessions = await workoutSessionRepo.list();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ name: 'Vide', endedAt: null });
  });

  it('crée un programme avec un exercice, puis le modifie et le supprime', async () => {
    const user = userEvent.setup();
    renderWorkouts('/entrainement/programmes/nouveau');

    await user.click(await screen.findByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Donne un nom à ton programme.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nom du programme'), 'Pecs');
    await user.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    await user.click(await screen.findByRole('button', { name: /Développé couché/ }));
    expect(screen.getByLabelText('Répétitions min')).toHaveValue('8');
    expect(screen.getByLabelText('Répétitions max')).toHaveValue('12');

    await user.click(screen.getByRole('button', { name: 'Plus : Séries' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () => expect(await routineRepo.list()).toHaveLength(1));
    const [routine] = await routineRepo.list();
    expect(routine).toMatchObject({ name: 'Pecs' });
    expect(routine?.items[0]).toMatchObject({
      exerciseId: BENCH,
      targetSets: 4,
      targetReps: '8-12',
      restSeconds: 90,
    });

    // Modifier : changer la fourchette de répétitions
    expect(await screen.findByRole('button', { name: 'Démarrer Pecs' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Modifier Pecs' }));
    const max = await screen.findByLabelText('Répétitions max');
    await user.clear(max);
    await user.type(max, '15');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(async () => {
      expect((await routineRepo.list())[0]?.items[0]?.targetReps).toBe('8-15');
    });

    // Supprimer
    await user.click(await screen.findByRole('button', { name: 'Modifier Pecs' }));
    await user.click(await screen.findByRole('button', { name: 'Supprimer ce programme' }));
    await user.click(await screen.findByRole('button', { name: 'Oui, supprimer' }));
    await waitFor(async () => expect(await routineRepo.list()).toHaveLength(0));
  });
});
