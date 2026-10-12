/**
 * Chrono de repos calculé sur une HEURE DE FIN, jamais sur un compteur :
 * si l'écran se verrouille ou que l'app est suspendue, le temps restant reste juste
 * au réveil, puisqu'il est recalculé à partir de l'heure courante.
 */
export interface RestTimerState {
  /** Heure de fin, en millisecondes (Date.now()). */
  endsAt: number;
  /** Durée initiale choisie, en secondes (pour la barre de progression). */
  totalSeconds: number;
  /** Vrai une fois l'alerte de fin déclenchée (pour ne la faire qu'une fois). */
  alerted: boolean;
}

/** Repos par défaut tant que les Réglages ne sont pas lus (voir `Settings.defaultRestSeconds`). */
export const DEFAULT_REST_SECONDS = 90;
export const MAX_REST_SECONDS = 20 * 60;

export function startRest(now: number, seconds: number): RestTimerState {
  const total = Math.min(MAX_REST_SECONDS, Math.max(1, Math.round(seconds)));
  return { endsAt: now + total * 1000, totalSeconds: total, alerted: false };
}

/** Secondes restantes, arrondies au-dessus (0:01 s'affiche jusqu'à la fin), jamais négatives. */
export function remainingSeconds(state: Pick<RestTimerState, 'endsAt'>, now: number): number {
  return Math.max(0, Math.ceil((state.endsAt - now) / 1000));
}

export function isFinished(state: Pick<RestTimerState, 'endsAt'>, now: number): boolean {
  return now >= state.endsAt;
}

/** Retard en secondes depuis la fin du repos (0 si pas fini). */
export function secondsLate(state: Pick<RestTimerState, 'endsAt'>, now: number): number {
  return Math.max(0, Math.floor((now - state.endsAt) / 1000));
}

/** Ajoute ou retire du temps (+15 s / −15 s). Retirer ne descend jamais sous 1 s à partir de maintenant. */
export function adjustRest(
  state: RestTimerState,
  deltaSeconds: number,
  now: number,
): RestTimerState {
  // Si le repos est déjà terminé, on repart de maintenant.
  const endsAt = Math.max(now + 1000, Math.max(state.endsAt, now) + deltaSeconds * 1000);
  const remaining = Math.ceil((endsAt - now) / 1000);
  return {
    endsAt,
    totalSeconds: Math.min(MAX_REST_SECONDS, Math.max(state.totalSeconds, remaining)),
    alerted: false,
  };
}

/** Part du repos déjà écoulée, entre 0 et 1. */
export function restProgress(state: RestTimerState, now: number): number {
  if (state.totalSeconds <= 0) return 1;
  const left = remainingSeconds(state, now);
  return Math.min(1, Math.max(0, 1 - left / state.totalSeconds));
}
