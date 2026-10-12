import type { InputType, SetLike } from './types';

export type WeightUnit = 'kg' | 'lb';

const KG_PER_LB = 0.45359237;

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** 62.5 → « 62,5 » ; 60 → « 60 ». */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Lit un nombre saisi au clavier : « 62,5 », « 62.5 », « 1 200 ». `null` si vide ou invalide. */
export function parseDecimal(text: string): number | null {
  const clean = text.replace(/\s/g, '').replace(',', '.');
  if (clean === '') return null;
  if (!/^\d*\.?\d*$/.test(clean) || clean === '.') return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

/** Texte d'un champ numérique : « 62,5 », sans séparateur de milliers. */
export function formatField(value: number): string {
  return formatNumber(value).replace(/\s/g, '');
}

/** Ajoute `delta` au texte d'un champ (vide = 0), sans passer sous `min` ni au-dessus de `max`. */
export function stepText(
  text: string,
  delta: number,
  min = 0,
  max = Number.POSITIVE_INFINITY,
): string {
  const current = parseDecimal(text) ?? 0;
  const next = Math.min(max, Math.max(min, Math.round((current + delta) * 100) / 100));
  return formatField(next);
}

/** Entier positif saisi au clavier (répétitions, secondes). */
export function parseWholeNumber(text: string): number | null {
  const value = parseDecimal(text);
  return value === null ? null : Math.round(value);
}

/** Valeur stockée (kg) → valeur affichée dans l'unité choisie, arrondie à 0,1. */
export function kgToUnit(kg: number, unit: WeightUnit): number {
  const value = unit === 'lb' ? kg / KG_PER_LB : kg;
  return Math.round(value * 10) / 10;
}

/** Valeur saisie dans l'unité choisie → kg à stocker (arrondi à 0,001). */
export function unitToKg(value: number, unit: WeightUnit): number {
  const kg = unit === 'lb' ? value * KG_PER_LB : value;
  return Math.round(kg * 1000) / 1000;
}

export function formatWeight(kg: number, unit: WeightUnit = 'kg'): string {
  return `${formatNumber(kgToUnit(kg, unit))} ${unit}`;
}

/** 90 → « 1:30 » ; 5 → « 0:05 ». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** 45 → « 45 s » ; 90 → « 1 min 30 » ; 3600 → « 1 h 00 ». */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const rest = s % 60;
    return rest === 0 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 60)} min ${rest}`;
  }
  const minutes = Math.floor((s % 3600) / 60);
  return `${Math.floor(s / 3600)} h ${String(minutes).padStart(2, '0')}`;
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${formatNumber(meters / 1000)} km` : `${formatNumber(meters)} m`;
}

/** Résumé court d'une série : « 60 kg × 8 », « 12 reps », « 45 s », « 5 km en 25 min », « 32 kg sur 40 m ». */
export function formatSetSummary(
  set: Pick<SetLike, 'weight' | 'reps' | 'durationSeconds' | 'distanceMeters'>,
  inputType: InputType,
  unit: WeightUnit = 'kg',
): string {
  const reps = set.reps != null ? `${set.reps}` : null;
  switch (inputType) {
    case 'weight_reps':
      if (reps === null) return set.weight != null ? formatWeight(set.weight, unit) : '—';
      return set.weight != null && set.weight > 0
        ? `${formatWeight(set.weight, unit)} × ${reps}`
        : `${reps} reps`;
    case 'bodyweight_load':
      if (reps === null) return '—';
      return set.weight != null && set.weight > 0
        ? `${reps} reps (+ ${formatWeight(set.weight, unit)})`
        : `${reps} reps`;
    case 'reps':
      return reps === null ? '—' : `${reps} reps`;
    case 'duration':
      return set.durationSeconds != null ? formatDuration(set.durationSeconds) : '—';
    case 'distance': {
      const parts: string[] = [];
      if (set.distanceMeters != null) parts.push(formatDistance(set.distanceMeters));
      if (set.durationSeconds != null) parts.push(formatDuration(set.durationSeconds));
      return parts.length === 0 ? '—' : parts.join(' en ');
    }
    case 'weight_distance': {
      if (set.distanceMeters == null)
        return set.weight != null ? formatWeight(set.weight, unit) : '—';
      const distance = formatDistance(set.distanceMeters);
      return set.weight != null && set.weight > 0
        ? `${formatWeight(set.weight, unit)} sur ${distance}`
        : distance;
    }
  }
}

/** Date-heure ISO → jour calendaire local `AAAA-MM-JJ`. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  return dayFromDate(d);
}

export function dayFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}
export function formatMonth(year: number, monthIndex: number): string {
  return monthFormat.format(new Date(year, monthIndex, 1));
}
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}
