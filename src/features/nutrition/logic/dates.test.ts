import { describe, expect, it } from 'vitest';
import { addDays, dayTitle, isValidDay, lastDays, todayDay } from './dates';

describe('dates', () => {
  it('donne le jour local', () => {
    expect(todayDay(new Date(2026, 9, 12, 23, 30))).toBe('2026-10-12');
  });
  it('décale d’un jour, y compris sur un changement de mois, d’année et d’heure', () => {
    expect(addDays('2026-10-12', -1)).toBe('2026-10-11');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });
  it('liste les 7 derniers jours, du plus ancien au plus récent', () => {
    expect(lastDays('2026-10-12', 7)).toEqual([
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]);
  });
  it('reconnaît un jour valide', () => {
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('')).toBe(false);
    expect(isValidDay('2026-02-28')).toBe(true);
  });
  it('titre le jour', () => {
    expect(dayTitle('2026-10-12', '2026-10-12')).toBe('Aujourd’hui');
    expect(dayTitle('2026-10-11', '2026-10-12')).toBe('Hier');
    expect(dayTitle('2026-10-13', '2026-10-12')).toBe('Demain');
    expect(dayTitle('2026-10-08', '2026-10-12')).toBe('jeudi 8 octobre');
  });
});
