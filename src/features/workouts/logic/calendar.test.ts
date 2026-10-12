import { describe, expect, it } from 'vitest';
import { buildMonthGrid, groupSessionsByDay } from './calendar';

describe('buildMonthGrid', () => {
  it('commence le lundi et complète avec les jours voisins (octobre 2026)', () => {
    const weeks = buildMonthGrid(2026, 9); // 1er octobre 2026 = jeudi
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]?.[0]).toEqual({ day: '2026-09-28', dayOfMonth: 28, inMonth: false });
    expect(weeks[0]?.[3]).toEqual({ day: '2026-10-01', dayOfMonth: 1, inMonth: true });
    expect(weeks[4]?.[6]).toEqual({ day: '2026-11-01', dayOfMonth: 1, inMonth: false });
  });

  it('février 2027 (28 jours, commence un lundi) tient sur 4 semaines', () => {
    const weeks = buildMonthGrid(2027, 1);
    expect(weeks).toHaveLength(4);
    expect(weeks[0]?.[0]?.day).toBe('2027-02-01');
    expect(weeks[3]?.[6]?.day).toBe('2027-02-28');
  });

  it('un mois à cheval peut avoir 6 semaines (août 2026)', () => {
    expect(buildMonthGrid(2026, 7)).toHaveLength(6);
  });

  it("passe d'une année à l'autre", () => {
    const weeks = buildMonthGrid(2026, 11);
    expect(weeks.flat().some((d) => d.day === '2027-01-01' && !d.inMonth)).toBe(true);
  });
});

describe('groupSessionsByDay', () => {
  it('regroupe par jour local, plus récent en premier', () => {
    const a = { id: 'a', startedAt: new Date(2026, 9, 5, 8, 0).toISOString() };
    const b = { id: 'b', startedAt: new Date(2026, 9, 5, 18, 0).toISOString() };
    const c = { id: 'c', startedAt: new Date(2026, 9, 6, 8, 0).toISOString() };
    const map = groupSessionsByDay([a, b, c]);
    expect(map.get('2026-10-05')?.map((s) => s.id)).toEqual(['b', 'a']);
    expect(map.get('2026-10-06')?.map((s) => s.id)).toEqual(['c']);
    expect(map.size).toBe(2);
  });
  it('accepte une liste vide', () => {
    expect(groupSessionsByDay([]).size).toBe(0);
  });
});
