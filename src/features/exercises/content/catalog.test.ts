import { describe, expect, it } from 'vitest';
import {
  DEMO_EXERCISES,
  EQUIPMENT,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  exerciseSchema,
  type Exercise,
} from '@/data';
import { EXERCISE_CATALOG } from './catalog';
import { PLANNED_EXERCISES } from './planned';
import { exerciseId } from './types';

/** Nombre de fiches attendu à ce stade de la livraison (120 à la fin des 6 lots). */
const EXPECTED_COUNT = 20;

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);
const asRecord = (sheet: (typeof EXERCISE_CATALOG)[number]): Exercise =>
  exerciseSchema.parse({
    ...sheet,
    createdAt: '2026-10-12T08:00:00.000Z',
    updatedAt: '2026-10-12T08:00:00.000Z',
    deletedAt: null,
  });

describe('catalogue des exercices', () => {
  it(`contient ${EXPECTED_COUNT} fiches`, () => {
    expect(EXERCISE_CATALOG).toHaveLength(EXPECTED_COUNT);
  });

  it('a des identifiants et des noms uniques', () => {
    const ids = EXERCISE_CATALOG.map((e) => e.id);
    const names = EXERCISE_CATALOG.map((e) => e.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('utilise des identifiants fixes de la forme attendue, numérotés de 1 à 120', () => {
    const allowed = new Set(Array.from({ length: 120 }, (_, i) => exerciseId(i + 1)));
    for (const e of EXERCISE_CATALOG) expect(allowed.has(e.id), e.name).toBe(true);
  });

  it('réutilise exactement les identifiants des 5 exercices de démonstration', () => {
    const expected: Record<string, string> = {
      '0d1e1a00-0000-4000-8000-000000000001': 'Développé couché barre',
      '0d1e1a00-0000-4000-8000-000000000002': 'Tractions pronation',
      '0d1e1a00-0000-4000-8000-000000000003': 'Squat barre',
      '0d1e1a00-0000-4000-8000-000000000004': 'Curl haltères alternés',
      '0d1e1a00-0000-4000-8000-000000000005': 'Gainage planche',
    };
    expect(DEMO_EXERCISES.map((d) => d.id).sort()).toEqual(Object.keys(expected).sort());
    for (const e of EXERCISE_CATALOG) {
      if (e.id in expected) expect(e.name).toBe(expected[e.id]);
      else expect(Object.values(expected)).not.toContain(e.name);
    }
  });

  it('ne contient que des exercices de la liste officielle', () => {
    const planned = new Set(PLANNED_EXERCISES.map((p) => p.name));
    for (const e of EXERCISE_CATALOG) expect(planned.has(e.name), e.name).toBe(true);
  });

  it('contient toute la liste officielle quand le catalogue est complet', () => {
    if (EXERCISE_CATALOG.length < 120) return;
    expect(PLANNED_EXERCISES).toHaveLength(120);
    const names = new Set(EXERCISE_CATALOG.map((e) => e.name));
    for (const p of PLANNED_EXERCISES) expect(names.has(p.name), p.name).toBe(true);
  });

  describe.each(EXERCISE_CATALOG.map((e) => [e.name, e] as const))('%s', (_name, e) => {
    it('est valide pour le schéma Zod', () => {
      expect(() => asRecord(e)).not.toThrow();
    });

    it('utilise des identifiants de muscles, matériel et mouvement valides', () => {
      const muscles = MUSCLE_GROUPS.map((m) => m.id) as string[];
      const equipment = EQUIPMENT.map((m) => m.id) as string[];
      const patterns = MOVEMENT_PATTERNS.map((m) => m.id) as string[];
      expect(e.equipment.length).toBeGreaterThan(0);
      for (const id of e.equipment) expect(equipment).toContain(id);
      expect(e.primaryMuscles.length).toBeGreaterThan(0);
      for (const id of [...e.primaryMuscles, ...e.secondaryMuscles]) expect(muscles).toContain(id);
      expect(patterns).toContain(e.movementPattern);
      for (const id of e.primaryMuscles) expect(e.secondaryMuscles).not.toContain(id);
    });

    it('a 4 à 6 étapes de 18 mots maximum', () => {
      expect(e.steps.length).toBeGreaterThanOrEqual(4);
      expect(e.steps.length).toBeLessThanOrEqual(6);
      for (const step of e.steps) {
        expect(words(step).length, step).toBeLessThanOrEqual(18);
        expect(step.length).toBeGreaterThan(0);
      }
    });

    it('a exactement 3 erreurs au format « Erreur → correction »', () => {
      expect(e.mistakes).toHaveLength(3);
      for (const m of e.mistakes) {
        const [error, fix, ...rest] = m.split(' → ');
        expect(rest, m).toHaveLength(0);
        expect(error?.trim().length, m).toBeGreaterThan(0);
        expect(fix?.trim().length, m).toBeGreaterThan(0);
      }
    });

    it('a 2 ou 3 variations annoncées (plus facile, plus difficile, autre matériel)', () => {
      expect(e.variations.length).toBeGreaterThanOrEqual(2);
      expect(e.variations.length).toBeLessThanOrEqual(3);
      for (const v of e.variations) {
        expect(v, v).toMatch(/^(Plus facile|Plus difficile|Autre matériel) : \S/);
      }
      expect(e.variations.some((v) => v.startsWith('Plus facile'))).toBe(true);
      expect(e.variations.some((v) => v.startsWith('Plus difficile'))).toBe(true);
    });

    it('a un conseil de charge et une consigne de sécurité d’une phrase', () => {
      expect(e.loadAdvice.length).toBeGreaterThan(0);
      if (!e.equipment.includes('cardio') && e.inputType !== 'duration') {
        expect(e.loadAdvice).toMatch(/séries/);
        expect(e.loadAdvice).toMatch(/repos/);
      }
      expect(e.safety.length).toBeGreaterThan(0);
      expect(e.safety, 'une seule phrase').not.toMatch(/[.!?]\s+\S/);
    });

    it('tutoie (jamais de « vous »)', () => {
      const text = [...e.steps, ...e.mistakes, ...e.variations, e.loadAdvice, e.safety].join(' ');
      expect(text).not.toMatch(/\b(vous|votre|vos|vôtres?)\b/i);
      expect(e.steps.join(' ')).toMatch(/\b(tu|ton|ta|tes|toi|te|t’)/i);
    });
  });
});
