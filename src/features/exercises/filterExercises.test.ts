import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/data';
import { samples } from '@/test/fixtures';
import { filterExercises, hasActiveFilters, NO_FILTERS } from './filterExercises';

const make = (name: string, patch: Partial<Exercise> = {}): Exercise => ({
  ...samples.exercise,
  id: name,
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  name,
  ...patch,
});

const LIST = [
  make('Pompes', { aliases: ['Push-up'] }),
  make('Écarté poulie', {
    aliases: [],
    primaryMuscles: ['chest'],
    equipment: ['cable'],
    level: 'intermediate',
    movementPattern: 'horizontal_push',
  }),
  make('Squat', {
    aliases: ['Back squat'],
    primaryMuscles: ['quads'],
    equipment: ['barbell'],
    level: 'advanced',
    movementPattern: 'squat',
  }),
];

const names = (filters: Partial<typeof NO_FILTERS>) =>
  filterExercises(LIST, { ...NO_FILTERS, ...filters }).map((e) => e.name);

describe('filterExercises', () => {
  it('sans filtre, tout est gardé et trié par nom', () => {
    expect(names({})).toEqual(['Écarté poulie', 'Pompes', 'Squat']);
  });

  it('cherche sans accents ni majuscules, dans le nom et les alias', () => {
    expect(names({ query: 'ECARTE' })).toEqual(['Écarté poulie']);
    expect(names({ query: 'push up' })).toEqual(['Pompes']);
    expect(names({ query: 'BACK' })).toEqual(['Squat']);
    expect(names({ query: 'zzz' })).toEqual([]);
  });

  it('combine les filtres', () => {
    expect(names({ muscle: 'chest' })).toEqual(['Écarté poulie', 'Pompes']);
    expect(names({ muscle: 'chest', equipment: 'cable' })).toEqual(['Écarté poulie']);
    expect(names({ level: 'advanced' })).toEqual(['Squat']);
    expect(names({ pattern: 'squat', muscle: 'chest' })).toEqual([]);
  });

  it('détecte les filtres actifs', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, level: 'beginner' })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, query: ' a' })).toBe(true);
  });
});
