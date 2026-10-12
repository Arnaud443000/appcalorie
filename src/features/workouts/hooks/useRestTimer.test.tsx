import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRestTimer } from './useRestTimer';

const SESSION = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-12T10:00:00.000Z'));
  // aucune alerte réelle en test
  Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRestTimer', () => {
  it('compte à rebours depuis l’heure de fin', () => {
    const { result } = renderHook(() => useRestTimer(SESSION));
    expect(result.current.state).toBeNull();
    act(() => result.current.start(90));
    expect(result.current.remaining).toBe(90);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.remaining).toBe(60);
  });

  it('reste juste après un écran verrouillé (aucun tick pendant ce temps)', () => {
    const { result } = renderHook(() => useRestTimer(SESSION));
    act(() => result.current.start(90));
    // L'horloge saute de 60 s sans que les « ticks » aient tourné : app suspendue.
    vi.setSystemTime(new Date('2026-10-12T10:01:00.000Z'));
    // Au retour dans l'app, le navigateur envoie « visibilitychange ».
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.remaining).toBe(30);
    expect(result.current.finished).toBe(false);
  });

  it('signale la fin une seule fois et vibre', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const { result } = renderHook(() => useRestTimer(SESSION));
    act(() => result.current.start(5));
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(result.current.finished).toBe(true);
    expect(result.current.remaining).toBe(0);
    expect(vibrate).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('ne fait pas sonner une alerte périmée au retour dans l’app', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const { result } = renderHook(() => useRestTimer(SESSION));
    act(() => result.current.start(30));
    vi.setSystemTime(new Date('2026-10-12T10:10:00.000Z'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.finished).toBe(true);
    expect(result.current.late).toBeGreaterThan(500);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('retrouve le chrono en cours après fermeture de l’app', () => {
    const first = renderHook(() => useRestTimer(SESSION));
    act(() => first.result.current.start(120));
    first.unmount();
    vi.setSystemTime(new Date('2026-10-12T10:00:50.000Z'));
    const second = renderHook(() => useRestTimer(SESSION));
    expect(second.result.current.state).not.toBeNull();
    expect(second.result.current.remaining).toBe(70);
  });

  it('un chrono d’une autre séance n’est pas repris', () => {
    const first = renderHook(() => useRestTimer(SESSION));
    act(() => first.result.current.start(120));
    first.unmount();
    const other = renderHook(() => useRestTimer('22222222-2222-4222-8222-222222222222'));
    expect(other.result.current.state).toBeNull();
  });

  it('+15 s, −15 s et « Passer »', () => {
    const { result } = renderHook(() => useRestTimer(SESSION));
    act(() => result.current.start(60));
    act(() => result.current.adjust(15));
    expect(result.current.remaining).toBe(75);
    act(() => result.current.adjust(-30));
    expect(result.current.remaining).toBe(45);
    act(() => result.current.stop());
    expect(result.current.state).toBeNull();
    expect(localStorage.getItem('atlas.workouts.rest')).toBeNull();
  });
});
