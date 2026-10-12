import { describe, expect, it } from 'vitest';
import { compareRoutineNames } from './routineOrder';

describe('compareRoutineNames', () => {
  it('range les jours dans l’ordre de la semaine, puis le reste par ordre alphabétique', () => {
    const names = [
      'Haut du corps',
      'Jeudi Haut',
      'Vendredi Bas',
      'Lundi Push',
      'Abdos',
      'mardi pull',
    ];
    expect([...names].sort(compareRoutineNames)).toEqual([
      'Lundi Push',
      'mardi pull',
      'Jeudi Haut',
      'Vendredi Bas',
      'Abdos',
      'Haut du corps',
    ]);
  });
});
