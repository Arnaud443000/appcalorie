import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test/fixtures';
import { EQUIPMENT, MOVEMENT_PATTERNS, MUSCLE_GROUPS } from './constants';
import { db } from './db';
import { exerciseRepo } from './repositories';
import { exerciseSchema } from './schemas';
import { DEMO_EXERCISES, seedDemoData } from './seed';

const uniqueIds = (list: readonly { id: string }[]) => new Set(list.map((i) => i.id)).size;

describe('Constantes partagées', () => {
  it('contient 15 groupes musculaires, 12 schémas de mouvement, 8 matériels, sans doublon', () => {
    expect(MUSCLE_GROUPS).toHaveLength(15);
    expect(uniqueIds(MUSCLE_GROUPS)).toBe(15);
    expect(MOVEMENT_PATTERNS).toHaveLength(12);
    expect(uniqueIds(MOVEMENT_PATTERNS)).toBe(12);
    expect(EQUIPMENT).toHaveLength(8);
    expect(uniqueIds(EQUIPMENT)).toBe(8);
  });
});

describe('Données de démonstration', () => {
  beforeEach(resetDb);

  it('fournit 5 exercices complets et valides', () => {
    expect(DEMO_EXERCISES.map((e) => e.name)).toEqual([
      'Développé couché',
      'Tractions',
      'Squat',
      'Curl haltères',
      'Gainage',
    ]);
    for (const exercise of DEMO_EXERCISES) {
      const parsed = exerciseSchema.parse({
        ...exercise,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
      });
      expect(parsed.steps.length).toBeGreaterThan(2);
      expect(parsed.mistakes.length).toBeGreaterThan(1);
      expect(parsed.variations.length).toBeGreaterThan(1);
      expect(parsed.loadAdvice).not.toBe('');
      expect(parsed.safety).not.toBe('');
    }
  });

  it("s'installe une seule fois et respecte les suppressions", async () => {
    await seedDemoData();
    await seedDemoData();
    expect(await db.exercises.count()).toBe(5);

    await exerciseRepo.remove(DEMO_EXERCISES[0]?.id ?? '');
    await seedDemoData();
    expect(await exerciseRepo.list()).toHaveLength(4);
  });
});
