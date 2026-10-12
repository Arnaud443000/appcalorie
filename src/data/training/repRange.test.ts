import { describe, expect, it } from 'vitest';
import { formatRepRange, parseRepRange } from './repRange';

describe('parseRepRange', () => {
  it.each([
    ['8-12', { min: 8, max: 12 }],
    [' 8 - 12 ', { min: 8, max: 12 }],
    ['8–12', { min: 8, max: 12 }],
    ['8 à 12', { min: 8, max: 12 }],
    ['8-12 reps', { min: 8, max: 12 }],
    ['12-8', { min: 8, max: 12 }],
    ['10', { min: 10, max: 10 }],
    ['5 reps', { min: 5, max: 5 }],
  ])('lit « %s »', (text, expected) => {
    expect(parseRepRange(text)).toEqual(expected);
  });

  it.each(['', '  ', '45 s', 'max', '1 min', '0', '0-0', 'abc', '8-', '-12'])(
    'renvoie null pour « %s »',
    (text) => {
      expect(parseRepRange(text)).toBeNull();
    },
  );

  it('renvoie null pour null et undefined', () => {
    expect(parseRepRange(null)).toBeNull();
    expect(parseRepRange(undefined)).toBeNull();
  });
});

describe('formatRepRange', () => {
  it('écrit une fourchette ou un nombre seul', () => {
    expect(formatRepRange(8, 12)).toBe('8-12');
    expect(formatRepRange(10, 10)).toBe('10');
    expect(formatRepRange(12, 8)).toBe('8-12');
  });
});
