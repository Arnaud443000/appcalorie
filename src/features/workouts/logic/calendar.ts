import { dayFromDate, localDay } from '@/data';

export interface CalendarDay {
  /** Jour calendaire `AAAA-MM-JJ`. */
  day: string;
  /** Numéro du jour dans le mois (1-31). */
  dayOfMonth: number;
  /** Faux pour les jours du mois précédent/suivant qui complètent la grille. */
  inMonth: boolean;
}

/**
 * Grille d'un mois, semaines du lundi au dimanche (6 lignes max, jamais de ligne vide en trop).
 * `monthIndex` : 0 = janvier.
 */
export function buildMonthGrid(year: number, monthIndex: number): CalendarDay[][] {
  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells; i += 1) {
    const date = new Date(year, monthIndex, 1 - offset + i);
    const cell: CalendarDay = {
      day: dayFromDate(date),
      dayOfMonth: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
    };
    if (i % 7 === 0) weeks.push([cell]);
    else weeks[weeks.length - 1]?.push(cell);
  }
  return weeks;
}

/** Regroupe des séances par jour calendaire local, du plus récent au plus ancien dans chaque jour. */
export function groupSessionsByDay<T extends { startedAt: string }>(
  sessions: readonly T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const session of sessions) {
    const day = localDay(session.startedAt);
    const list = map.get(day);
    if (list) list.push(session);
    else map.set(day, [session]);
  }
  for (const list of map.values()) list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return map;
}
