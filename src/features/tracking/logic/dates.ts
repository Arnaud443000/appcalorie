/**
 * Calcul sur des jours calendaires `AAAA-MM-JJ` (type `Day`).
 * Tout passe par des numéros de jour en UTC : aucun décalage dû au fuseau horaire ni à
 * l'heure d'été (un jour = toujours 1 de plus), quelle que soit la machine.
 */
export type Day = string;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** `true` pour un vrai jour du calendrier (le 30 février est refusé). */
export function isDay(text: string): text is Day {
  const match = DAY_PATTERN.exec(text);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Numéro de jour depuis le 1er janvier 1970 (entier). */
export function dayNumber(day: Day): number {
  const match = DAY_PATTERN.exec(day);
  if (!match) return Number.NaN;
  return Math.round(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY,
  );
}

export function dayFromNumber(n: number): Day {
  const d = new Date(n * MS_PER_DAY);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(day: Day, n: number): Day {
  return dayFromNumber(dayNumber(day) + n);
}

/** Nombre de jours de `a` à `b` (négatif si `b` est avant `a`). */
export function diffDays(a: Day, b: Day): number {
  return dayNumber(b) - dayNumber(a);
}

/**
 * Ajoute des mois en gardant le jour du mois, ramené à la fin du mois si besoin :
 * 31 mars − 1 mois = 28 février (29 en année bissextile).
 */
export function addMonths(day: Day, n: number): Day {
  const match = DAY_PATTERN.exec(day);
  if (!match) return day;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const total = y * 12 + m + n;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const out = new Date(Date.UTC(year, month, Math.min(d, lastDay)));
  return dayFromNumber(Math.round(out.getTime() / MS_PER_DAY));
}

/** Lundi de la semaine du jour donné (semaine française : du lundi au dimanche). */
export function startOfWeek(day: Day): Day {
  const n = dayNumber(day);
  // Le 1er janvier 1970 était un jeudi : (n + 3) % 7 vaut 0 pour un lundi.
  const sinceMonday = (((n + 3) % 7) + 7) % 7;
  return dayFromNumber(n - sinceMonday);
}

/** Premier jour du mois du jour donné. */
export function startOfMonth(day: Day): Day {
  return `${day.slice(0, 7)}-01`;
}

/** Dernier jour du mois du jour donné. */
export function endOfMonth(day: Day): Day {
  return addDays(addMonths(startOfMonth(day), 1), -1);
}

const shortFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const shortYearFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const longFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthShortFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const monthShortYearFormat = new Intl.DateTimeFormat('fr-FR', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});
const monthLongFormat = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function toDate(day: Day): Date {
  return new Date(dayNumber(day) * MS_PER_DAY);
}

/** « 12 oct. » */
export function formatShortDay(day: Day): string {
  return Number.isNaN(dayNumber(day)) ? day : shortFormat.format(toDate(day));
}

/** « 12 oct. 2026 » */
export function formatShortDayYear(day: Day): string {
  return Number.isNaN(dayNumber(day)) ? day : shortYearFormat.format(toDate(day));
}

/** « lundi 12 octobre 2026 » */
export function formatLongDay(day: Day): string {
  return Number.isNaN(dayNumber(day)) ? day : longFormat.format(toDate(day));
}

/** « oct. » ou, avec l'année, « oct. 26 ». */
export function formatMonthShort(day: Day, withYear = false): string {
  if (Number.isNaN(dayNumber(day))) return day;
  return (withYear ? monthShortYearFormat : monthShortFormat).format(toDate(day));
}

/** « octobre 2026 » */
export function formatMonthLong(day: Day): string {
  return Number.isNaN(dayNumber(day)) ? day : monthLongFormat.format(toDate(day));
}

/**
 * Place d'un jour par rapport à aujourd'hui, en français :
 * « aujourd'hui », « hier », « il y a 12 jours », « il y a 3 semaines », « il y a 4 mois »,
 * « il y a 1 an », « demain », « dans 3 mois »…
 */
export function relativeDayLabel(day: Day, today: Day): string {
  const diff = diffDays(day, today);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return 'hier';
  if (diff === -1) return 'demain';
  const past = diff > 0;
  const span = durationLabel(Math.abs(diff));
  return past ? `il y a ${span}` : `dans ${span}`;
}

/** 5 → « 5 jours » ; 21 → « 3 semaines » ; 120 → « 4 mois » ; 400 → « 1 an ». */
export function durationLabel(days: number): string {
  const n = Math.max(0, Math.round(days));
  if (n < 14) return `${n} jour${n > 1 ? 's' : ''}`;
  if (n < 60) return `${Math.floor(n / 7)} semaines`;
  const months = Math.round(n / 30.4375);
  if (months < 24) {
    if (months === 12) return '1 an';
    return `${months} mois`;
  }
  return `${Math.round(n / 365.25)} ans`;
}
