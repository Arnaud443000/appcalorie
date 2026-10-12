const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Rang du jour par lequel commence le nom (« Lundi Push » → 0), ou 7 sans jour. */
function weekdayRank(name: string): number {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const rank = WEEKDAYS.indexOf(first);
  return rank === -1 ? WEEKDAYS.length : rank;
}

/**
 * Ordre d'affichage des programmes : ceux qui commencent par un jour, dans l'ordre de la
 * semaine (Lundi, Mardi…), puis les autres par ordre alphabétique.
 */
export function compareRoutineNames(a: string, b: string): number {
  return weekdayRank(a) - weekdayRank(b) || a.localeCompare(b, 'fr');
}
