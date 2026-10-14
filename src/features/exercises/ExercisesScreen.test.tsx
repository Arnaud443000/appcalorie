import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedTestExercises } from './testData';
import { renderExercises, stubImageLoading, stubManifest, stubReducedMotion } from './testHelpers';
import { resetDb } from '@/test/fixtures';

describe('Écran Exercices', () => {
  beforeEach(async () => {
    await resetDb();
    stubManifest({ 'pompes-test': ['depart', 'fin'] });
    stubImageLoading();
    stubReducedMotion(true);
    await seedTestExercises();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('liste les exercices avec leurs muscles et le compteur', async () => {
    renderExercises();
    expect(await screen.findByText('Pompes test')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('3 exercices');
    expect(screen.getAllByText('Pectoraux').length).toBeGreaterThan(1);
  });

  it('recherche sans accents ni majuscules, par nom ou alias', async () => {
    renderExercises();
    await screen.findByText('Pompes test');
    const search = screen.getByLabelText('Rechercher un exercice');
    fireEvent.change(search, { target: { value: 'GAINAGE' } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 exercice'));
    expect(screen.getByText('Gainage test')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'push-up' } });
    await waitFor(() => expect(screen.getByText('Pompes test')).toBeInTheDocument());
    expect(screen.queryByText('Gainage test')).not.toBeInTheDocument();
  });

  it('filtre avec les puces et permet de tout effacer', async () => {
    renderExercises();
    await screen.findByText('Pompes test');
    const muscles = within(screen.getByRole('group', { name: 'Muscle' }));
    fireEvent.click(muscles.getByRole('button', { name: 'Quadriceps' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 exercice'));
    expect(screen.getByText('Squat test')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3 exercices'));
  });

  it('affiche un état vide clair', async () => {
    renderExercises();
    await screen.findByText('Pompes test');
    fireEvent.change(screen.getByLabelText('Rechercher un exercice'), {
      target: { value: 'zzzz' },
    });
    expect(await screen.findByText('Aucun exercice trouvé')).toBeInTheDocument();
  });

  it('l’onglet Atlas 3D ouvre l’écran de l’Atlas', async () => {
    const router = renderExercises();
    fireEvent.click(await screen.findByRole('tab', { name: 'Atlas 3D' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/exercices/atlas'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Atlas 3D' })).toBeInTheDocument();
  });

  it('la fiche s’ouvre depuis la liste', async () => {
    renderExercises();
    fireEvent.click(await screen.findByText('Squat test'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Squat test' }),
    ).toBeInTheDocument();
  });
});
