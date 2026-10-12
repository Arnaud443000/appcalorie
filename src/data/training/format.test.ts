import { describe, expect, it } from 'vitest';
import {
  stepText,
  dayFromDate,
  formatClock,
  formatDistance,
  formatDuration,
  formatNumber,
  formatSetSummary,
  formatWeight,
  kgToUnit,
  localDay,
  parseDecimal,
  parseWholeNumber,
  unitToKg,
} from './format';

describe('parseDecimal', () => {
  it('accepte la virgule et le point', () => {
    expect(parseDecimal('62,5')).toBe(62.5);
    expect(parseDecimal('62.5')).toBe(62.5);
    expect(parseDecimal(' 1 200 ')).toBe(1200);
    expect(parseDecimal('0')).toBe(0);
    expect(parseDecimal('.5')).toBe(0.5);
  });
  it('renvoie null si vide ou invalide', () => {
    for (const text of ['', '  ', 'abc', '1,2,3', '-5', '.', '5kg']) {
      expect(parseDecimal(text)).toBeNull();
    }
  });
  it('arrondit les entiers', () => {
    expect(parseWholeNumber('8,4')).toBe(8);
    expect(parseWholeNumber('')).toBeNull();
  });
});

describe('unités', () => {
  it('convertit kg ↔ lb', () => {
    expect(kgToUnit(60, 'kg')).toBe(60);
    expect(kgToUnit(60, 'lb')).toBe(132.3);
    expect(unitToKg(135, 'lb')).toBeCloseTo(61.235, 3);
    expect(kgToUnit(unitToKg(135, 'lb'), 'lb')).toBe(135);
    expect(unitToKg(62.5, 'kg')).toBe(62.5);
  });
  it('formate le poids avec une virgule', () => {
    expect(formatWeight(62.5)).toBe('62,5 kg');
    expect(formatWeight(60)).toBe('60 kg');
    expect(formatWeight(60, 'lb')).toBe('132,3 lb');
    expect(formatNumber(8)).toBe('8');
  });
});

describe('durées', () => {
  it('formate le chrono', () => {
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(-3)).toBe('0:00');
  });
  it('formate une durée', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(90)).toBe('1 min 30');
    expect(formatDuration(120)).toBe('2 min');
    expect(formatDuration(3900)).toBe('1 h 05');
  });
  it('formate une distance', () => {
    expect(formatDistance(800)).toBe('800 m');
    expect(formatDistance(5200)).toBe('5,2 km');
  });
});

describe('formatSetSummary', () => {
  const base = { weight: null, reps: null, durationSeconds: null, distanceMeters: null };
  it('charge et répétitions', () => {
    expect(formatSetSummary({ ...base, weight: 60, reps: 8 }, 'weight_reps')).toBe('60 kg × 8');
    expect(formatSetSummary({ ...base, weight: 0, reps: 8 }, 'weight_reps')).toBe('8 reps');
    expect(formatSetSummary(base, 'weight_reps')).toBe('—');
  });
  it('poids du corps avec lest', () => {
    expect(formatSetSummary({ ...base, weight: 10, reps: 6 }, 'bodyweight_load')).toBe(
      '6 reps (+ 10 kg)',
    );
    expect(formatSetSummary({ ...base, reps: 6 }, 'bodyweight_load')).toBe('6 reps');
  });
  it('répétitions, durée, distance', () => {
    expect(formatSetSummary({ ...base, reps: 15 }, 'reps')).toBe('15 reps');
    expect(formatSetSummary({ ...base, durationSeconds: 60 }, 'duration')).toBe('1 min');
    expect(
      formatSetSummary({ ...base, distanceMeters: 5000, durationSeconds: 1500 }, 'distance'),
    ).toBe('5 km en 25 min');
  });
});

describe('jours', () => {
  it('lit le jour local', () => {
    expect(dayFromDate(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
    expect(localDay(new Date(2026, 0, 2, 0, 5).toISOString())).toBe('2026-01-02');
  });
});

describe('formatSetSummary — portage', () => {
  it('affiche la charge et la distance', () => {
    const base = { reps: null, durationSeconds: null };
    expect(formatSetSummary({ ...base, weight: 32, distanceMeters: 40 }, 'weight_distance')).toBe(
      '32 kg sur 40 m',
    );
    expect(formatSetSummary({ ...base, weight: null, distanceMeters: 40 }, 'weight_distance')).toBe(
      '40 m',
    );
    expect(
      formatSetSummary({ ...base, weight: null, distanceMeters: null }, 'weight_distance'),
    ).toBe('—');
  });
});

describe('stepText', () => {
  it('ajoute et retire', () => {
    expect(stepText('60', 2.5)).toBe('62,5');
    expect(stepText('62,5', -2.5)).toBe('60');
    expect(stepText('', 1)).toBe('1');
  });
  it('ne descend pas sous le minimum ni ne dépasse le maximum', () => {
    expect(stepText('1', -2.5)).toBe('0');
    expect(stepText('1', -1, 1)).toBe('1');
    expect(stepText('10', 0.5, 1, 10)).toBe('10');
  });
  it('évite les erreurs de virgule flottante', () => {
    expect(stepText('0,2', 0.1)).toBe('0,3');
  });
  it('ne met pas de séparateur de milliers', () => {
    expect(stepText('1199', 1)).toBe('1200');
  });
});
