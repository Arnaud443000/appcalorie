import {
  formatDistance,
  formatDuration,
  formatNumber,
  kgToUnit,
  unitToKg,
  type WeightUnit,
} from '@/data';
import {
  cmToUnit,
  formatSigned,
  unitToCm,
  type LengthUnit,
  type LoadMetric,
  type SeriesPoint,
} from './logic';
import type { ChartPoint } from './components/LineChart';

/**
 * Une grandeur suivie (poids, longueur, répétitions…) : comment passer de la valeur stockée
 * (kg, cm, secondes, mètres) à celle qu'on affiche et qu'on saisit, et comment l'écrire.
 */
export interface Quantity {
  unit: string;
  toDisplay: (stored: number) => number;
  fromDisplay: (shown: number) => number;
  /** Valeur affichée avec son unité : « 80,2 kg ». */
  formatDisplay: (shown: number) => string;
  /** Valeur affichée sur un axe, sans unité si possible. */
  formatAxis: (shown: number) => string;
  /** Pas des boutons − et + de la saisie. */
  step: number;
}

export function weightQuantity(unit: WeightUnit): Quantity {
  return {
    unit,
    toDisplay: (kg) => kgToUnit(kg, unit),
    fromDisplay: (shown) => unitToKg(shown, unit),
    formatDisplay: (shown) => `${formatNumber(shown)} ${unit}`,
    formatAxis: formatNumber,
    step: unit === 'lb' ? 0.5 : 0.1,
  };
}

export function lengthQuantity(unit: LengthUnit): Quantity {
  return {
    unit,
    toDisplay: (cm) => cmToUnit(cm, unit),
    fromDisplay: (shown) => unitToCm(shown, unit),
    formatDisplay: (shown) => `${formatNumber(shown)} ${unit}`,
    formatAxis: formatNumber,
    step: unit === 'in' ? 0.25 : 0.5,
  };
}

const identity = (value: number) => value;

/** Grandeur d'un indicateur d'exercice (1RM, charge, volume, répétitions, durée, distance). */
export function loadQuantity(metric: LoadMetric, weightUnit: WeightUnit): Quantity {
  switch (metric) {
    case 'oneRepMax':
    case 'maxWeight':
    case 'volume':
      return weightQuantity(weightUnit);
    case 'maxReps':
      return {
        unit: 'reps',
        toDisplay: identity,
        fromDisplay: identity,
        formatDisplay: (shown) => `${formatNumber(shown)} reps`,
        formatAxis: formatNumber,
        step: 1,
      };
    case 'maxDuration':
      return {
        unit: 's',
        toDisplay: identity,
        fromDisplay: identity,
        formatDisplay: formatDuration,
        formatAxis: formatDuration,
        step: 5,
      };
    case 'maxDistance':
      return {
        unit: 'm',
        toDisplay: identity,
        fromDisplay: identity,
        formatDisplay: formatDistance,
        formatAxis: formatDistance,
        step: 50,
      };
  }
}

export const calorieQuantity: Quantity = {
  unit: 'kcal',
  toDisplay: identity,
  fromDisplay: identity,
  formatDisplay: (shown) => `${formatNumber(Math.round(shown))} kcal`,
  formatAxis: (shown) => formatNumber(Math.round(shown)),
  step: 50,
};

/** Valeur stockée → texte avec unité. */
export function formatStored(quantity: Quantity, stored: number): string {
  return quantity.formatDisplay(quantity.toDisplay(stored));
}

/** Écart entre deux valeurs stockées, avec son signe : « +2,5 kg ». */
export function formatDelta(quantity: Quantity, delta: number): string {
  return formatSigned(quantity.toDisplay(delta), quantity.formatDisplay);
}

/** Points stockés → points à tracer, dans l'unité d'affichage. */
export function toChartPoints(
  points: readonly (SeriesPoint & { label?: string })[],
  quantity: Quantity,
): ChartPoint[] {
  return points.map((p) => ({ date: p.date, value: quantity.toDisplay(p.value), label: p.label }));
}

/** Texte d'un champ de saisie (« 62,5 ») à partir d'une valeur stockée. */
export function toFieldText(quantity: Quantity, stored: number | null | undefined): string {
  if (stored == null) return '';
  return formatNumber(quantity.toDisplay(stored)).replace(/\s/g, '');
}
