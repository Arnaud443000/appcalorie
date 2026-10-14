import { formatShortDayYear, type Day } from './dates';
import type { SeriesPoint } from './series';

/**
 * Phrase qui résume une courbe pour les lecteurs d'écran :
 * « 12 mesures du 3 juin 2026 au 12 oct. 2026. Dernière valeur : 80 kg. Minimum 78 kg, maximum 83 kg. »
 */
export function describeSeries(
  points: readonly SeriesPoint[],
  format: (value: number) => string,
  noun = 'mesure',
): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return 'Aucune donnée pour le moment.';
  const count = points.length;
  const plural = count > 1 ? `${noun}s` : noun;
  if (count === 1)
    return `1 ${noun} : ${format(first.value)} le ${formatShortDayYear(first.date)}.`;
  let min = first.value;
  let max = first.value;
  for (const p of points) {
    min = Math.min(min, p.value);
    max = Math.max(max, p.value);
  }
  return (
    `${count} ${plural} du ${formatShortDayYear(first.date)} au ${formatShortDayYear(last.date)}. ` +
    `Dernière valeur : ${format(last.value)}. Minimum ${format(min)}, maximum ${format(max)}.`
  );
}

/** Intervalle de jours couvert par une ou plusieurs courbes, ou `null` s'il n'y a aucun point. */
export function seriesSpan(...series: readonly (readonly SeriesPoint[])[]): [Day, Day] | null {
  let start: Day | null = null;
  let end: Day | null = null;
  for (const points of series) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first && (start === null || first.date < start)) start = first.date;
    if (last && (end === null || last.date > end)) end = last.date;
  }
  return start !== null && end !== null ? [start, end] : null;
}
