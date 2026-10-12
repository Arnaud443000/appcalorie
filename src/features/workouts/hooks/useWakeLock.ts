import { useEffect } from 'react';

/**
 * Garde l'écran allumé tant que `enabled` est vrai (API Wake Lock, si le navigateur la connaît).
 * Le verrou saute quand l'app passe en arrière-plan : on le reprend au retour.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        // refusé (économie d'énergie, onglet masqué…) : on réessaiera au retour
      }
    }
    function onVisible() {
      if (document.visibilityState === 'visible') void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
