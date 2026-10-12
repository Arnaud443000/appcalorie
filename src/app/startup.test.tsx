import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exerciseRepo, routineRepo, seedMyProgram } from '@/data';
import { EXERCISE_CATALOG } from '@/features/exercises/content';
import { resetDb } from '@/test/fixtures';
import { routes } from './router';
import { prepareData } from './startup';

beforeEach(resetDb);

describe('prepareData', () => {
  it('charge les 120 fiches au démarrage, sans doublon si on relance', async () => {
    await prepareData();
    await prepareData();
    const exercises = await exerciseRepo.list();
    expect(EXERCISE_CATALOG).toHaveLength(120);
    expect(exercises).toHaveLength(120);
    // Le catalogue remplace la démo (mêmes identifiants, noms plus précis).
    expect(exercises.map((e) => e.name)).toContain('Développé couché barre');
  });

  it('crée mes 5 programmes avec tous leurs exercices retrouvés dans les fiches', async () => {
    const warn = vi.spyOn(console, 'warn');
    await prepareData();
    expect(warn).not.toHaveBeenCalled();
    expect((await seedMyProgram()).created).toEqual([]); // déjà fait

    const routines = await routineRepo.list();
    const exercises = await exerciseRepo.list();
    const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name;
    const byName = Object.fromEntries(routines.map((r) => [r.name, r]));
    expect(Object.keys(byName).sort()).toEqual([
      'Jeudi Haut du corps',
      'Lundi Push',
      'Mardi Pull',
      'Mercredi Jambes',
      'Vendredi Bas du corps',
    ]);
    expect(byName['Lundi Push']?.items.map((i) => nameOf(i.exerciseId))).toEqual([
      'Développé couché barre',
      'Développé incliné haltères',
      'Développé haltères assis', // « Développé militaire haltères assis »
      'Écarté à la poulie vis-à-vis',
      'Élévations latérales haltères',
      'Extension poulie haute corde',
      'Barre au front',
    ]);
    const plank = byName['Vendredi Bas du corps']?.items.at(-1);
    expect(plank && nameOf(plank.exerciseId)).toBe('Gainage planche');
    expect(plank).toMatchObject({ targetSets: 3, targetReps: '45-60 s', restSeconds: 60 });
  });

  it('les 5 programmes apparaissent dans l’onglet Entraînement, dans l’ordre de la semaine', async () => {
    await prepareData();
    render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/entrainement'] })} />,
    );
    await screen.findByText('Lundi Push');
    const names = [
      'Lundi Push',
      'Mardi Pull',
      'Mercredi Jambes',
      'Jeudi Haut du corps',
      'Vendredi Bas du corps',
    ];
    const shown = names.map((name) => screen.getByText(name));
    for (let i = 1; i < shown.length; i += 1) {
      const previous = shown[i - 1];
      const current = shown[i];
      if (!previous || !current) throw new Error('programme manquant');
      expect(previous.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });
});
