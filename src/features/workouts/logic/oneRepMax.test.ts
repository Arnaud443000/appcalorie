import { describe, expect, it } from 'vitest';
import { estimateOneRepMax } from './oneRepMax';

describe('estimateOneRepMax (Epley)', () => {
  it('applique charge × (1 + répétitions / 30)', () => {
    expect(estimateOneRepMax(60, 10)).toBeCloseTo(80);
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.667, 2);
    expect(estimateOneRepMax(80, 30)).toBeCloseTo(160);
  });

  it('accepte les charges décimales', () => {
    expect(estimateOneRepMax(62.5, 6)).toBeCloseTo(75);
  });

  it('à 1 répétition, applique la formule telle quelle (× 1,033)', () => {
    expect(estimateOneRepMax(100, 1)).toBeCloseTo(103.333, 2);
  });

  it('renvoie null quand une valeur manque', () => {
    expect(estimateOneRepMax(null, 8)).toBeNull();
    expect(estimateOneRepMax(60, null)).toBeNull();
    expect(estimateOneRepMax(undefined, undefined)).toBeNull();
  });

  it('renvoie null pour une charge ou des répétitions nulles, négatives ou invalides', () => {
    expect(estimateOneRepMax(0, 8)).toBeNull();
    expect(estimateOneRepMax(60, 0)).toBeNull();
    expect(estimateOneRepMax(-20, 8)).toBeNull();
    expect(estimateOneRepMax(60, -3)).toBeNull();
    expect(estimateOneRepMax(Number.NaN, 8)).toBeNull();
    expect(estimateOneRepMax(60, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
