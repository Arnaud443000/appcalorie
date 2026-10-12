import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedDemoData, workoutSessionRepo } from '@/data';
import { resetDb } from '../test/fixtures';
import { routes } from './router';

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(resetDb);

describe("Coque de l'application", () => {
  it('affiche les 5 onglets', () => {
    renderApp();
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    const labels = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent);
    expect(labels).toEqual(['Aujourd’hui', 'Entraînement', 'Exercices', 'Nutrition', 'Suivi']);
  });

  it('chaque onglet ouvre son écran', async () => {
    const user = userEvent.setup();
    renderApp();
    for (const [tab, title] of [
      ['Entraînement', 'Entraînement'],
      ['Exercices', 'Exercices'],
      ['Nutrition', 'Nutrition'],
      ['Suivi', 'Suivi'],
      ['Aujourd’hui', 'Aujourd’hui'],
    ] as const) {
      await user.click(screen.getByRole('link', { name: tab }));
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
    }
  });

  it('ouvre les Réglages depuis Aujourd’hui et revient', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Réglages' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Réglages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exporter mes données' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Retour' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeInTheDocument();
  });

  it("l'onglet Exercices liste les exercices de démonstration", async () => {
    await seedDemoData();
    renderApp('/exercices');
    expect(await screen.findByText('Développé couché')).toBeInTheDocument();
    expect(screen.getByText('Gainage')).toBeInTheDocument();
  });

  it('propose de reprendre une séance non terminée depuis Aujourd’hui', async () => {
    const user = userEvent.setup();
    const session = await workoutSessionRepo.create({
      routineId: null,
      name: 'Lundi Push',
      startedAt: new Date().toISOString(),
      endedAt: null,
      note: '',
    });
    const router = renderApp();
    await user.click(await screen.findByRole('link', { name: /Reprendre ta séance/ }));
    expect(router.state.location.pathname).toBe(`/entrainement/seance/${session.id}`);
  });

  it('ne montre pas le bandeau quand aucune séance n’est en cours', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1, name: 'Aujourd’hui' });
    expect(screen.queryByText('Reprendre ta séance')).not.toBeInTheDocument();
  });
});
