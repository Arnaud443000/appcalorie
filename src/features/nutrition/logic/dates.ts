import { dayFromDate } from '@/data';

/** Jour calendaire local `AAAA-MM-JJ` d'une date (maintenant par défaut). */
export function todayDay(now: Date = new Date()): string {
  return dayFromDate(now);
}

/** `AAAA-MM-JJ` → date locale à midi (évite les décalages d'heure d'été). */
function parseDay(day: string): Date {
  const [y = 1970, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Décale un jour calendaire de `delta` jours (négatif = avant). */
export function addDays(day: string, delta: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + delta);
  return dayFromDate(date);
}

/** Les `count` jours qui finissent à `endDay` (compris), du plus ancien au plus récent. */
export function lastDays(endDay: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(endDay, i - (count - 1)));
}

export function isValidDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dayFromDate(parseDay(value)) === value;
}

const longFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const shortFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

/** « Aujourd'hui », « Hier », « Demain », sinon « mardi 6 octobre ». */
export function dayTitle(day: string, today: string = todayDay()): string {
  if (day === today) return 'Aujourd’hui';
  if (day === addDays(today, -1)) return 'Hier';
  if (day === addDays(today, 1)) return 'Demain';
  return longFormat.format(parseDay(day));
}

/** Jour de la semaine abrégé (« lun. »), pour l'axe d'un graphique. */
export function weekdayShort(day: string): string {
  return shortFormat.format(parseDay(day));
}
