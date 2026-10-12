import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveSettings } from '@/data';
import { resetDb } from '@/test/fixtures';
import { seedSquatHistory, seedTestExercises } from './testData';
import { renderExercises, stubImageLoading, stubManifest, stubReducedMotion } from './testHelpers';

describe('Fiche détail', () => {
  beforeEach(async () => {
    await resetDb();
    stubManifest({ 'pompes-test': ['depart', 'fin'], 'gainage-test': ['unique'] });
    stubImageLoading();
    stubReducedMotion(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fiche avec paire d’images : contenu complet et lecteur', async () => {
    const { pair, none } = await seedTestExercises();
    renderExercises(`/exercices/${pair.id}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pompes test' }),
    ).toBeInTheDocument();
    expect(await screen.findByAltText('Pompes test : position de départ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByText('Position de départ')).toBeInTheDocument();
    expect(screen.getByText('Débutant')).toBeInTheDocument();
    expect(screen.getByText('Poids du corps')).toBeInTheDocument();
    // Muscles principaux / secondaires
    expect(screen.getByText('Pectoraux').closest('[data-muscle]')).toHaveAttribute(
      'data-muscle',
      'primary',
    );
    expect(screen.getByText('Triceps').closest('[data-muscle]')).toHaveAttribute(
      'data-muscle',
      'secondary',
    );
    // Étapes numérotées, erreurs
    const steps = screen.getAllByRole('list')[0];
    expect(steps?.tagName).toBe('OL');
    expect(screen.getByText('Descendre')).toBeInTheDocument();
    expect(screen.getByText('Bassin bas')).toBeInTheDocument();
    // Variantes : lien si retrouvée, texte sinon
    expect(screen.getByRole('link', { name: 'Squat test' })).toHaveAttribute(
      'href',
      `/exercices/${none.id}`,
    );
    expect(screen.getByText('Pompes lestées inconnues')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Pompes lestées inconnues' }),
    ).not.toBeInTheDocument();
  });

  it('fiche sans image : encart sobre, sans erreur', async () => {
    const { none } = await seedTestExercises();
    renderExercises(`/exercices/${none.id}`);
    expect(await screen.findByText(/Pas d’illustration/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('fiche à image unique : « Position tenue »', async () => {
    const { single } = await seedTestExercises();
    renderExercises(`/exercices/${single.id}`);
    expect(await screen.findByText('Position tenue')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('fiche introuvable : message et retour', async () => {
    renderExercises('/exercices/inconnu');
    expect(await screen.findByText('Exercice introuvable')).toBeInTheDocument();
  });

  it('Mes performances : message tant qu’il n’y a pas de séance', async () => {
    const { none } = await seedTestExercises();
    renderExercises(`/exercices/${none.id}`);
    expect(await screen.findByText(/pas encore fait cet exercice/)).toBeInTheDocument();
  });

  it('Mes performances : dernière fois, records et historique', async () => {
    const { none } = await seedTestExercises();
    await seedSquatHistory(none.id);
    renderExercises(`/exercices/${none.id}`);
    const last = await screen.findByRole('list', { name: 'Séries de la dernière séance' });
    expect(within(last).getByText('80 kg × 5')).toBeInTheDocument();
    expect(within(last).getByText('85 kg × 3')).toBeInTheDocument();
    expect(screen.getByText('Charge max')).toBeInTheDocument();
    expect(screen.getAllByText('85 kg').length).toBeGreaterThan(0);
    expect(screen.getByText('1RM estimé')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Historique des séances' })).toBeInTheDocument();
  });

  it('Mes performances : respecte l’unité lb des réglages', async () => {
    const { none } = await seedTestExercises();
    await seedSquatHistory(none.id);
    await saveSettings({ weightUnit: 'lb' });
    renderExercises(`/exercices/${none.id}`);
    const last = await screen.findByRole('list', { name: 'Séries de la dernière séance' });
    await vi.waitFor(() => expect(within(last).getByText(/lb × 5/)).toBeInTheDocument());
  });

  it('le bouton Retour est présent', async () => {
    const { none } = await seedTestExercises();
    renderExercises(`/exercices/${none.id}`);
    fireEvent.focus(await screen.findByRole('link', { name: 'Retour' }));
    expect(screen.getByRole('link', { name: 'Retour' })).toHaveAttribute('href', '/exercices');
  });
});
