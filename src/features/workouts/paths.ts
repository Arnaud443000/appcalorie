import type { WorkoutSession } from '@/data';

/** Chemins de l'onglet Entraînement (le routeur du lot 0 les monte sous `#/entrainement`). */
export const PATHS = {
  home: '/entrainement',
  history: '/entrainement/historique',
  records: '/entrainement/records',
  newRoutine: '/entrainement/programmes/nouveau',
  routine: (id: string) => `/entrainement/programmes/${id}`,
  liveSession: (id: string) => `/entrainement/seance/${id}`,
  sessionDetail: (id: string) => `/entrainement/historique/${id}`,
} as const;

/** Une séance non terminée s'ouvre en mode saisie, une séance terminée en mode détail. */
export function sessionPath(session: Pick<WorkoutSession, 'id' | 'endedAt'>): string {
  return session.endedAt === null ? PATHS.liveSession(session.id) : PATHS.sessionDetail(session.id);
}
