import type { BodyMetric, MeasurementId } from '@/data';
import { MEASUREMENTS } from '@/data';
import { prepareSeries, type SeriesPoint } from './series';

/** Ce que l'on mesure sur le corps : le poids, le tour de taille, ou une mensuration. */
export type BodyKey = 'weight' | 'waist' | MeasurementId;

/** Les mensurations en centimètres, dans l'ordre d'affichage : tour de taille puis les autres. */
export const MEASURE_KEYS: readonly { id: Exclude<BodyKey, 'weight'>; label: string }[] = [
  { id: 'waist', label: 'Tour de taille' },
  ...MEASUREMENTS.map((m) => ({ id: m.id, label: m.label })),
];

export function bodyValue(metric: BodyMetric, key: BodyKey): number | null {
  const value =
    key === 'weight'
      ? metric.weightKg
      : key === 'waist'
        ? metric.waistCm
        : (metric.measurements[key] ?? null);
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

/** Courbe d'une mesure du corps : un point par jour (la dernière saisie du jour gagne). */
export function bodySeries(metrics: readonly BodyMetric[], key: BodyKey): SeriesPoint[] {
  const ordered = [...metrics].sort(
    (a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt),
  );
  const points: SeriesPoint[] = [];
  for (const metric of ordered) {
    const value = bodyValue(metric, key);
    if (value !== null) points.push({ date: metric.date, value });
  }
  return prepareSeries(points, 'last');
}

/** `true` si l'enregistrement ne contient plus aucune mesure (il peut alors être supprimé). */
export function isEmptyMetric(metric: Pick<BodyMetric, 'weightKg' | 'waistCm' | 'measurements'>) {
  return (
    !metric.weightKg &&
    !metric.waistCm &&
    Object.values(metric.measurements).every((value) => !value)
  );
}

const CM_PER_INCH = 2.54;

export type LengthUnit = 'cm' | 'in';

/** Centimètres stockés → unité d'affichage, arrondi à 0,1. */
export function cmToUnit(cm: number, unit: LengthUnit): number {
  const value = unit === 'in' ? cm / CM_PER_INCH : cm;
  return Math.round(value * 10) / 10;
}

/** Valeur saisie dans l'unité choisie → cm à stocker (arrondi à 0,01). */
export function unitToCm(value: number, unit: LengthUnit): number {
  const cm = unit === 'in' ? value * CM_PER_INCH : value;
  return Math.round(cm * 100) / 100;
}
