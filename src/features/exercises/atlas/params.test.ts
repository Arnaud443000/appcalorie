import { describe, expect, it } from 'vitest';
import { atlasPath, atlasSearch, exercisePath, plural, readAtlasParams } from './params';

const read = (search: string) => readAtlasParams(new URLSearchParams(search));

describe('Paramètres de l’adresse', () => {
  it('lit ?muscle=<groupe> (insensible à la casse et aux espaces)', () => {
    expect(read('muscle=chest')).toEqual({ kind: 'muscle', group: 'chest' });
    expect(read('muscle=%20Lower_Back%20')).toEqual({ kind: 'muscle', group: 'lower_back' });
  });

  it('ignore un groupe inconnu ou vide', () => {
    expect(read('muscle=ailes')).toEqual({ kind: 'none' });
    expect(read('muscle=')).toEqual({ kind: 'none' });
    expect(read('')).toEqual({ kind: 'none' });
  });

  it('lit ?exercice=<id>, prioritaire sur ?muscle', () => {
    expect(read('exercice=abc')).toEqual({ kind: 'exercise', exerciseId: 'abc' });
    expect(read('muscle=chest&exercice=abc')).toEqual({ kind: 'exercise', exerciseId: 'abc' });
    expect(read('exercice=%20%20&muscle=lats')).toEqual({ kind: 'muscle', group: 'lats' });
  });

  it('fabrique les adresses', () => {
    expect(atlasSearch('lats').toString()).toBe('muscle=lats');
    expect(atlasSearch(null).toString()).toBe('');
    expect(atlasPath('/exercices/atlas', { group: 'calves' })).toBe(
      '/exercices/atlas?muscle=calves',
    );
    expect(atlasPath('/exercices/atlas', { exerciseId: 'x-1' })).toBe(
      '/exercices/atlas?exercice=x-1',
    );
    expect(exercisePath('x-1')).toBe('/exercices/x-1');
  });

  it('accorde le pluriel', () => {
    expect(plural(0, 'exercice')).toBe('0 exercice');
    expect(plural(1, 'exercice')).toBe('1 exercice');
    expect(plural(3, 'exercice')).toBe('3 exercices');
  });
});
