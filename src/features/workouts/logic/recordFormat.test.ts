import { describe, expect, it } from 'vitest';
import { formatRecordValue } from './recordFormat';

describe('formatRecordValue', () => {
  it('formate chaque sorte de record', () => {
    expect(formatRecordValue('maxWeight', 65)).toBe('65 kg');
    expect(formatRecordValue('oneRepMax', 81.667)).toBe('81,7 kg');
    expect(formatRecordValue('maxVolume', 2400, 'kg')).toBe('2\u202f400 kg');
    expect(formatRecordValue('maxReps', 12)).toBe('12 reps');
    expect(formatRecordValue('maxDuration', 90)).toBe('1 min 30');
    expect(formatRecordValue('maxDistance', 5200)).toBe('5,2 km');
    expect(formatRecordValue('maxWeight', 60, 'lb')).toBe('132,3 lb');
  });
});
