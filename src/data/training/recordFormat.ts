import {
  formatDistance,
  formatDuration,
  formatNumber,
  formatWeight,
  type WeightUnit,
} from './format';
import type { RecordKind } from './records';

/** Valeur d'un record, prête à afficher : « 65 kg », « 12 reps », « 5,2 km »… */
export function formatRecordValue(
  kind: RecordKind,
  value: number,
  unit: WeightUnit = 'kg',
): string {
  switch (kind) {
    case 'maxWeight':
    case 'maxVolume':
    case 'oneRepMax':
      return formatWeight(value, unit);
    case 'maxReps':
      return `${formatNumber(value)} reps`;
    case 'maxDuration':
      return formatDuration(value);
    case 'maxDistance':
      return formatDistance(value);
  }
}
