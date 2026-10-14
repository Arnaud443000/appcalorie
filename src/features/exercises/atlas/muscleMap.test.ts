import { describe, expect, it } from 'vitest';
import type { Exercise, MuscleGroupId } from '@/data';
import {
  exerciseHighlight,
  exercisesForGroup,
  groupHighlight,
  groupsWith,
  preferredView,
  synergistsOf,
} from './muscleMap';

function exercise(
  name: string,
  primaryMuscles: MuscleGroupId[],
  secondaryMuscles: MuscleGroupId[] = [],
): Exercise {
  return { id: name, name, primaryMuscles, secondaryMuscles } as Exercise;
}

const LIST = [
  exercise('Pompes', ['chest'], ['triceps', 'shoulders']),
  exercise('Développé couché', ['chest'], ['triceps', 'shoulders']),
  exercise('Écarté poulie', ['chest'], ['shoulders']),
  exercise('Dips', ['triceps', 'chest'], ['shoulders']),
  exercise('Barre au front', ['triceps']),
  exercise('Élévations latérales', ['shoulders'], ['traps']),
];

describe('Exercices d’un groupe', () => {
  it('liste d’abord les exercices où le groupe est principal, puis secondaire, triés par nom', () => {
    const { primary, secondary } = exercisesForGroup(LIST, 'chest');
    expect(primary.map((e) => e.name)).toEqual([
      'Développé couché',
      'Dips',
      'Écarté poulie',
      'Pompes',
    ]);
    expect(secondary).toEqual([]);
    const triceps = exercisesForGroup(LIST, 'triceps');
    expect(triceps.primary.map((e) => e.name)).toEqual(['Barre au front', 'Dips']);
    expect(triceps.secondary.map((e) => e.name)).toEqual(['Développé couché', 'Pompes']);
  });

  it('ne met pas en secondaire un exercice où le groupe est déjà principal', () => {
    const odd = [exercise('Bizarre', ['chest'], ['chest'])];
    expect(exercisesForGroup(odd, 'chest').secondary).toEqual([]);
  });

  it('renvoie des listes vides pour un groupe sans exercice', () => {
    expect(exercisesForGroup(LIST, 'neck')).toEqual({ primary: [], secondary: [] });
  });
});

describe('Muscles sollicités aussi', () => {
  it('garde les groupes présents dans au moins 40 % des exercices, les plus fréquents d’abord', () => {
    // Pectoraux : épaules 4/4, triceps 3/4 (Dips compte le triceps principal).
    expect(synergistsOf(LIST, 'chest')).toEqual(['shoulders', 'triceps']);
    expect(synergistsOf(LIST, 'chest', { max: 1 })).toEqual(['shoulders']);
    expect(synergistsOf(LIST, 'chest', { minShare: 0.9 })).toEqual(['shoulders']);
    expect(synergistsOf(LIST, 'neck')).toEqual([]);
  });
});

describe('Mise en avant sur le corps', () => {
  it('groupe en rouge, accompagnateurs en rose', () => {
    expect(groupHighlight('chest', ['triceps', 'chest'])).toEqual({
      chest: 'primary',
      triceps: 'secondary',
    });
  });

  it('exercice : principaux en rouge, secondaires en rose (le principal l’emporte)', () => {
    const highlight = exerciseHighlight(
      exercise('Dips', ['triceps', 'chest'], ['shoulders', 'chest']),
    );
    expect(highlight).toEqual({ triceps: 'primary', chest: 'primary', shoulders: 'secondary' });
    expect(groupsWith(highlight, 'primary')).toEqual(['chest', 'triceps']);
    expect(groupsWith(highlight, 'secondary')).toEqual(['shoulders']);
  });

  it('tourne le corps de dos pour les muscles du dos', () => {
    expect(preferredView('lats')).toBe('back');
    expect(preferredView('hamstrings')).toBe('back');
    expect(preferredView('chest')).toBe('front');
    expect(preferredView('abs')).toBe('front');
  });
});
