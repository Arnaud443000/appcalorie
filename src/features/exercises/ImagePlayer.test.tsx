import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { END_MS, ImagePlayer, SLOW_FACTOR, START_MS } from './ImagePlayer';
import { stubImageLoading, stubReducedMotion } from './testHelpers';

const PAIR = { kind: 'pair', start: '/a_depart.webp', end: '/a_fin.webp' } as const;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('ImagePlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubImageLoading();
    stubReducedMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('alterne départ / fin avec les bonnes durées, puis revient au départ', async () => {
    render(<ImagePlayer images={PAIR} name="Pompes" />);
    await flush();
    expect(screen.getByText('Position de départ')).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(START_MS - 1));
    expect(screen.getByText('Position de départ')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByText('Position de fin')).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(END_MS));
    expect(screen.getByText('Position de départ')).toBeInTheDocument();
  });

  it('affiche les deux images superposées avec des alt descriptifs', async () => {
    render(<ImagePlayer images={PAIR} name="Pompes" />);
    await flush();
    expect(screen.getByAltText('Pompes : position de départ')).toBeInTheDocument();
    expect(screen.getByAltText('Pompes : position de fin')).toBeInTheDocument();
  });

  it('met en pause et reprend', async () => {
    render(<ImagePlayer images={PAIR} name="Pompes" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.getByText('Position de départ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lecture' }));
    act(() => void vi.advanceTimersByTime(START_MS));
    expect(screen.getByText('Position de fin')).toBeInTheDocument();
  });

  it('ralentit en mode « Lent »', async () => {
    render(<ImagePlayer images={PAIR} name="Pompes" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Lent' }));
    act(() => void vi.advanceTimersByTime(START_MS));
    expect(screen.getByText('Position de départ')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(START_MS * (SLOW_FACTOR - 1)));
    expect(screen.getByText('Position de fin')).toBeInTheDocument();
  });

  it('un toucher sur l’image change de position', async () => {
    render(<ImagePlayer images={PAIR} name="Pompes" />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: /Pompes : position de départ/ }));
    expect(screen.getByText('Position de fin')).toBeInTheDocument();
  });

  it('mouvement réduit : pas de lecture automatique, bascule à la main', async () => {
    stubReducedMotion(true);
    render(<ImagePlayer images={PAIR} name="Pompes" />);
    await flush();
    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.getByText('Position de départ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pompes/ }));
    expect(screen.getByText('Position de fin')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.getByText('Position de fin')).toBeInTheDocument();
  });

  it('n’alterne pas avant le chargement des deux images', () => {
    render(<ImagePlayer images={PAIR} name="Pompes" />);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.getByText('Position de départ')).toBeInTheDocument();
    expect(screen.queryByAltText('Pompes : position de fin')).not.toBeInTheDocument();
  });

  it('image unique : légende « Position tenue », sans boutons', async () => {
    render(<ImagePlayer images={{ kind: 'single', src: '/p_unique.webp' }} name="Gainage" />);
    await flush();
    expect(screen.getByText('Position tenue')).toBeInTheDocument();
    expect(screen.getByAltText('Gainage : position tenue')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('aucune image : encart sobre', () => {
    render(<ImagePlayer images={{ kind: 'none' }} name="Pompes" />);
    expect(screen.getByText(/Pas d’illustration/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('une image qui ne charge pas retombe sur l’encart', async () => {
    stubImageLoading({ fail: (src) => src.includes('fin') });
    render(<ImagePlayer images={PAIR} name="Pompes" />);
    await flush();
    expect(screen.getByText(/Pas d’illustration/)).toBeInTheDocument();
  });
});
