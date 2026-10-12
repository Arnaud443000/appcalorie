import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { setEntryRepo, workoutSessionRepo, routineRepo } from '@/data';
import { resetDb } from '../../../test/fixtures';
import { BENCH, CURL, renderWorkouts, seedExercises } from '../testHelpers';

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  await seedExercises();
});

async function pastSession(
  startedAt: string,
  sets: [string, number, number, boolean?][],
  routineId: string | null = null,
) {
  const session = await workoutSessionRepo.create({
    routineId,
    name: 'Haut du corps',
    startedAt,
    endedAt: new Date(new Date(startedAt).getTime() + 3600_000).toISOString(),
    note: '',
  });
  let order = 0;
  for (const [exerciseId, weight, reps, isWarmup = false] of sets) {
    await setEntryRepo.create({
      sessionId: session.id,
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
  return session;
}

describe('Historique', () => {
  it('liste les séances, de la plus récente à la plus ancienne, avec série et volume', async () => {
    await pastSession('2026-10-01T08:00:00.000Z', [[BENCH, 60, 10]]);
    await pastSession('2026-10-08T08:00:00.000Z', [
      [BENCH, 60, 8],
      [BENCH, 40, 10, true],
    ]);
    renderWorkouts('/entrainement/historique');
    const links = await screen.findAllByRole('link', { name: /Haut du corps/ });
    expect(links).toHaveLength(2);
    // la plus récente d'abord ; l'échauffement n'est pas compté (1 série, 480 kg)
    expect(links[0]).toHaveTextContent('1 série');
    expect(links[0]).toHaveTextContent('480 kg');
    expect(links[0]?.textContent).toContain('8 octobre');
  });

  it('affiche un état vide', async () => {
    renderWorkouts('/entrainement/historique');
    expect(await screen.findByText('Aucune séance')).toBeInTheDocument();
  });

  it('le calendrier marque les jours de séance et affiche la séance du jour choisi', async () => {
    const user = userEvent.setup();
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    await pastSession(today.toISOString(), [[BENCH, 60, 8]]);
    renderWorkouts('/entrainement/historique');
    await user.click(await screen.findByRole('tab', { name: 'Calendrier' }));
    const grid = await screen.findByRole('grid', { name: 'Calendrier des séances' });
    const marked = await within(grid).findByRole('gridcell', {
      name: `${today.getDate()}, 1 séance`,
    });
    expect(marked).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('link', { name: /Haut du corps/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mois précédent' }));
    await user.click(within(grid).getByRole('gridcell', { name: '15' }));
    expect(screen.getByText('Pas de séance ce jour-là.')).toBeInTheDocument();
  });
});

describe('Détail d’une séance', () => {
  it('montre les séries de chaque exercice et les records battus', async () => {
    await pastSession('2026-10-01T08:00:00.000Z', [[BENCH, 60, 8]]);
    const session = await pastSession('2026-10-08T08:00:00.000Z', [
      [BENCH, 62.5, 8],
      [CURL, 14, 10],
    ]);
    renderWorkouts(`/entrainement/historique/${session.id}`);
    expect(await screen.findByText('62,5 kg × 8')).toBeInTheDocument();
    expect(screen.getByText('14 kg × 10')).toBeInTheDocument();
    // Le curl est fait pour la première fois : pas de record annoncé. Le développé couché bat sa charge max.
    const records = await screen.findByLabelText('Records battus');
    expect(records).toHaveTextContent('Charge max : 62,5 kg');
  });

  it('copie la séance vers une nouvelle séance (mêmes exercices, aucune série)', async () => {
    const user = userEvent.setup();
    const routine = await routineRepo.create({
      name: 'Haut du corps',
      note: '',
      items: [{ exerciseId: BENCH, targetSets: 3, targetReps: '6-8', restSeconds: 120, note: '' }],
    });
    const past = await pastSession(
      '2026-10-08T08:00:00.000Z',
      [
        [BENCH, 40, 10, true],
        [BENCH, 60, 8],
        [BENCH, 60, 8],
        [CURL, 14, 10],
      ],
      routine.id,
    );
    const router = renderWorkouts(`/entrainement/historique/${past.id}`);
    await user.click(
      await screen.findByRole('button', { name: 'Copier vers une nouvelle séance' }),
    );

    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/entrainement\/seance\//));
    const sessions = await workoutSessionRepo.list();
    const created = sessions.find((s) => s.id !== past.id);
    expect(created).toMatchObject({ endedAt: null, routineId: routine.id, name: 'Haut du corps' });
    expect(await setEntryRepo.findBy('sessionId', created?.id ?? '')).toHaveLength(0);

    const plan = (await workoutSessionRepo.get(created?.id ?? ''))?.plan;
    expect(plan?.map((p) => [p.exerciseId, p.targetSets, p.targetReps])).toEqual([
      [BENCH, 2, '6-8'],
      [CURL, 1, ''],
    ]);
    // La nouvelle séance reprend les valeurs de la séance copiée
    expect(await screen.findByText('Dernière fois : 60 kg × 8')).toBeInTheDocument();
  });

  it('supprime la séance après confirmation', async () => {
    const user = userEvent.setup();
    const session = await pastSession('2026-10-08T08:00:00.000Z', [[BENCH, 60, 8]]);
    renderWorkouts(`/entrainement/historique/${session.id}`);
    await user.click(await screen.findByRole('button', { name: 'Supprimer cette séance' }));
    await user.click(await screen.findByRole('button', { name: 'Oui, supprimer' }));
    await waitFor(async () => expect(await workoutSessionRepo.get(session.id)).toBeUndefined());
    expect(await screen.findByText('Aucune séance')).toBeInTheDocument();
  });
});

describe('Records', () => {
  it('affiche charge max, répétitions max, volume et 1RM par exercice, sans l’échauffement', async () => {
    await pastSession('2026-10-01T08:00:00.000Z', [
      [BENCH, 100, 3, true],
      [BENCH, 60, 10],
      [BENCH, 70, 5],
    ]);
    renderWorkouts('/entrainement/records');
    const card = (await screen.findByRole('heading', { name: 'Développé couché' })).closest(
      'section',
    );
    if (!card) throw new Error('carte introuvable');
    const text = card.textContent ?? '';
    expect(text).toContain('70 kgCharge max');
    expect(text).toContain('10 repsRépétitions max');
    expect(text).toContain('950 kgVolume max');
    expect(text).toContain('81,7 kg1RM estimé');
  });

  it('affiche un état vide', async () => {
    renderWorkouts('/entrainement/records');
    expect(await screen.findByText('Pas encore de record')).toBeInTheDocument();
  });
});
