import { describe, expect, it } from 'vitest';
import {
  defaultMacroTargets,
  effectiveMacroTargets,
  loadMacroTargets,
  saveMacroTargets,
} from './targets';

function fakeStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe('repères de macros', () => {
  it('propose une répartition 25/50/25 depuis l’objectif calories', () => {
    expect(defaultMacroTargets(2000)).toEqual({ proteinG: 125, carbsG: 250, fatG: 56, fiberG: 25 });
    expect(defaultMacroTargets(null)).toBeNull();
  });
  it('les repères réglés remplacent les proposés, champ par champ', () => {
    expect(effectiveMacroTargets({ proteinG: 160 }, 2000)).toEqual({
      proteinG: 160,
      carbsG: 250,
      fatG: 56,
      fiberG: 25,
    });
    expect(effectiveMacroTargets(null, null)).toEqual({
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: 25,
    });
  });
  it('enregistre et relit, en ignorant les valeurs invalides', () => {
    const storage = fakeStorage();
    saveMacroTargets({ proteinG: 150, fatG: 70 }, storage);
    expect(loadMacroTargets(storage)).toEqual({ proteinG: 150, fatG: 70 });
    expect(loadMacroTargets(fakeStorage('{"proteinG":-3,"carbsG":"x"}'))).toEqual({});
    expect(loadMacroTargets(fakeStorage('pas du json'))).toEqual({});
  });
});
