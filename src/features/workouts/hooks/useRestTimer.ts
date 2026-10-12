import { useCallback, useEffect, useRef, useState } from 'react';
import { readJson, removeStored, writeJson } from '../data/storage';
import {
  adjustRest,
  isFinished,
  remainingSeconds,
  secondsLate,
  startRest,
  type RestTimerState,
} from '../logic';
import { alertRestOver, readAlertPrefs } from './alerts';

const KEY = 'atlas.workouts.rest';

interface Stored extends RestTimerState {
  sessionId: string;
}

function read(sessionId: string): RestTimerState | null {
  const raw = readJson(KEY) as Partial<Stored> | null;
  if (
    !raw ||
    raw.sessionId !== sessionId ||
    typeof raw.endsAt !== 'number' ||
    typeof raw.totalSeconds !== 'number'
  ) {
    return null;
  }
  return { endsAt: raw.endsAt, totalSeconds: raw.totalSeconds, alerted: raw.alerted === true };
}

function write(sessionId: string, state: RestTimerState | null) {
  if (state) writeJson(KEY, { sessionId, ...state });
  else removeStored(KEY);
}

/** Au-delà de ce retard, on est revenu dans l'app après coup : inutile de faire sonner. */
const LATE_SECONDS = 10;

export interface RestTimer {
  /** Repos en cours ou terminé et pas encore fermé ; `null` sinon. */
  state: RestTimerState | null;
  remaining: number;
  finished: boolean;
  /** Secondes écoulées depuis la fin du repos. */
  late: number;
  start: (seconds: number) => void;
  adjust: (deltaSeconds: number) => void;
  stop: () => void;
}

/**
 * Chrono de repos. Le temps restant est toujours recalculé depuis l'heure de fin
 * (conservée aussi sur l'appareil) : un écran verrouillé ou une app suspendue ne le fausse pas.
 * L'alerte ne peut en revanche sonner que si l'app tourne (voir le rapport).
 */
export function useRestTimer(sessionId: string): RestTimer {
  const [state, setState] = useState<RestTimerState | null>(() => read(sessionId));
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);

  const commit = useCallback(
    (next: RestTimerState | null) => {
      stateRef.current = next;
      write(sessionId, next);
      setState(next);
    },
    [sessionId],
  );

  const tick = useCallback(() => {
    const current = Date.now();
    setNow(current);
    const timer = stateRef.current;
    if (timer && !timer.alerted && isFinished(timer, current)) {
      commit({ ...timer, alerted: true });
      if (secondsLate(timer, current) <= LATE_SECONDS) alertRestOver(readAlertPrefs());
    }
  }, [commit]);

  const running = state !== null && !state.alerted;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(tick, 250);
    const onWake = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('pageshow', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('pageshow', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [running, tick]);

  const start = useCallback(
    (seconds: number) => {
      const current = Date.now();
      setNow(current);
      commit(startRest(current, seconds));
    },
    [commit],
  );

  const adjust = useCallback(
    (deltaSeconds: number) => {
      const timer = stateRef.current;
      if (!timer) return;
      const current = Date.now();
      setNow(current);
      commit(adjustRest(timer, deltaSeconds, current));
    },
    [commit],
  );

  const stop = useCallback(() => commit(null), [commit]);

  return {
    state,
    remaining: state ? remainingSeconds(state, now) : 0,
    finished: state ? isFinished(state, now) : false,
    late: state ? secondsLate(state, now) : 0,
    start,
    adjust,
    stop,
  };
}
