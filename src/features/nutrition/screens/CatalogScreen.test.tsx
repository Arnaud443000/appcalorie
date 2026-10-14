import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ciqualFoodRepo } from '@/data';
import { resetDb } from '@/test/fixtures';
import sample from '../foods/fixtures/ciqual-exemple.csv?raw';
import { renderNutrition } from '../testHelpers';

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

function csvFile(content: string, name = 'ciqual.csv') {
  const file = new File([content], name, { type: 'text/csv' });
  // jsdom n'implémente pas toujours Blob.arrayBuffer
  if (!file.arrayBuffer) {
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new TextEncoder().encode(content).buffer,
    });
  }
  return file;
}

describe('Catalogue CIQUAL', () => {
  it('sans catalogue : rien d’inventé, explications pour récupérer le fichier', async () => {
    renderNutrition('/nutrition/catalogue');
    expect(await screen.findByText('Aucun catalogue chargé')).toBeInTheDocument();
    expect(screen.getByText('Où trouver le fichier ?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ciqual.anses.fr' })).toHaveAttribute(
      'href',
      'https://ciqual.anses.fr',
    );
    expect(await ciqualFoodRepo.count()).toBe(0);
  });

  it('importe un fichier CSV et affiche le nombre d’aliments chargés', async () => {
    const user = userEvent.setup();
    renderNutrition('/nutrition/catalogue');
    const input = await screen.findByLabelText('Fichier CSV CIQUAL');
    await user.upload(input, csvFile(sample));

    expect(
      await screen.findByText(/aliments chargés/, { selector: 'p[role="status"]' }),
    ).toBeInTheDocument();
    const stored = await ciqualFoodRepo.count();
    expect(stored).toBeGreaterThan(5);
    await waitFor(() =>
      expect(screen.getByText(`${stored} aliments CIQUAL chargés`)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: 'Remplacer par un autre fichier' }),
    ).toBeInTheDocument();
  });

  it('fichier invalide : message en français, catalogue inchangé', async () => {
    const user = userEvent.setup();
    renderNutrition('/nutrition/catalogue');
    await user.upload(await screen.findByLabelText('Fichier CSV CIQUAL'), csvFile('a;b\n1;2\n'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toBe('');
    expect(await ciqualFoodRepo.count()).toBe(0);
  });
});
