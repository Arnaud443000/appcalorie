import { afterEach, describe, expect, it, vi } from 'vitest';
import { localDay } from '@/data';
import {
  addDays,
  addMonths,
  dayNumber,
  diffDays,
  durationLabel,
  endOfMonth,
  formatLongDay,
  formatMonthShort,
  formatShortDay,
  isDay,
  relativeDayLabel,
  startOfMonth,
  startOfWeek,
} from './dates';

describe('isDay', () => {
  it('accepte les vrais jours et refuse le reste', () => {
    expect(isDay('2026-10-12')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true);
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2026-13-01')).toBe(false);
    expect(isDay('12/10/2026')).toBe(false);
    expect(isDay('')).toBe(false);
  });
});

describe('addDays / diffDays', () => {
  it('change de mois et d’année', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
  it('traverse un changement d’heure sans décalage', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('compte les jours entre deux dates, dans les deux sens', () => {
    expect(diffDays('2026-10-12', '2026-10-12')).toBe(0);
    expect(diffDays('2026-10-01', '2026-10-12')).toBe(11);
    expect(diffDays('2026-10-12', '2026-10-01')).toBe(-11);
    expect(diffDays('2025-12-31', '2026-01-01')).toBe(1);
  });
  it('dayNumber est NaN pour un texte invalide', () => {
    expect(dayNumber('nimporte quoi')).toBeNaN();
  });
});

describe('addMonths', () => {
  it('garde le jour du mois', () => {
    expect(addMonths('2026-10-12', -3)).toBe('2026-07-12');
    expect(addMonths('2026-10-12', 1)).toBe('2026-11-12');
  });
  it('ramène à la fin du mois quand le jour n’existe pas', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2028-03-31', -1)).toBe('2028-02-29');
    expect(addMonths('2026-08-31', -6)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
  it('passe d’une année à l’autre', () => {
    expect(addMonths('2026-01-15', -2)).toBe('2025-11-15');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-10-12', -12)).toBe('2025-10-12');
    expect(addMonths('2026-10-12', 0)).toBe('2026-10-12');
  });
});

describe('semaines et mois', () => {
  it('la semaine commence le lundi', () => {
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12'); // lundi
    expect(startOfWeek('2026-10-14')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12'); // dimanche
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
  });
  it('la semaine peut commencer dans le mois ou l’année précédents', () => {
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26'); // dimanche
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28'); // vendredi
  });
  it('début et fin de mois', () => {
    expect(startOfMonth('2026-10-12')).toBe('2026-10-01');
    expect(endOfMonth('2026-10-12')).toBe('2026-10-31');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonth('2026-12-05')).toBe('2026-12-31');
  });
});

describe('formats', () => {
  it('formate sans décalage de fuseau', () => {
    expect(formatShortDay('2026-10-12')).toBe('12 oct.');
    expect(formatLongDay('2026-10-12')).toBe('lundi 12 octobre 2026');
    expect(formatMonthShort('2026-01-01', true)).toMatch(/janv\.? 26/);
  });
  it('renvoie le texte tel quel s’il n’est pas une date', () => {
    expect(formatShortDay('abc')).toBe('abc');
  });
  it('dit « il y a … » en français', () => {
    const today = '2026-10-12';
    expect(relativeDayLabel('2026-10-12', today)).toBe("aujourd'hui");
    expect(relativeDayLabel('2026-10-11', today)).toBe('hier');
    expect(relativeDayLabel('2026-10-13', today)).toBe('demain');
    expect(relativeDayLabel('2026-10-02', today)).toBe('il y a 10 jours');
    expect(relativeDayLabel('2026-09-21', today)).toBe('il y a 3 semaines');
    expect(relativeDayLabel('2026-06-12', today)).toBe('il y a 4 mois');
    expect(relativeDayLabel('2025-10-12', today)).toBe('il y a 1 an');
    expect(relativeDayLabel('2024-10-12', today)).toBe('il y a 2 ans');
    expect(relativeDayLabel('2027-01-12', today)).toBe('dans 3 mois');
  });
  it('durationLabel gère le singulier et les bornes', () => {
    expect(durationLabel(0)).toBe('0 jour');
    expect(durationLabel(1)).toBe('1 jour');
    expect(durationLabel(13)).toBe('13 jours');
    expect(durationLabel(14)).toBe('2 semaines');
    expect(durationLabel(59)).toBe('8 semaines');
    expect(durationLabel(60)).toBe('2 mois');
    expect(durationLabel(-5)).toBe('0 jour');
  });
});

describe('jour local', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('une séance tardive reste au jour où elle a eu lieu (fuseau d’Auckland, de Los Angeles, de Paris)', () => {
    const iso = '2026-10-12T23:30:00.000Z';
    vi.stubEnv('TZ', 'Europe/Paris');
    expect(localDay(iso)).toBe('2026-10-13'); // 01 h 30 le 13
    vi.stubEnv('TZ', 'America/Los_Angeles');
    expect(localDay(iso)).toBe('2026-10-12'); // 16 h 30 le 12
    vi.stubEnv('TZ', 'Pacific/Auckland');
    expect(localDay(iso)).toBe('2026-10-13'); // 12 h 30 le 13
  });

  it('les calculs de jours ne dépendent pas du fuseau', () => {
    for (const tz of ['Europe/Paris', 'America/Los_Angeles', 'Pacific/Auckland', 'UTC']) {
      vi.stubEnv('TZ', tz);
      expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
      expect(startOfWeek('2026-10-14')).toBe('2026-10-12');
      expect(formatShortDay('2026-10-12')).toBe('12 oct.');
    }
  });
});
