import { describe, expect, it } from 'vitest';
import { detectFoodState } from './foodState';

describe('detectFoodState', () => {
  it.each([
    ['Filet de poulet cru', 'raw'],
    ['Filets de poulet crus', 'raw'],
    ['Saumon CRU', 'raw'],
    ['Poulet, blanc, sans peau, cuit', 'cooked'],
    ['Pâtes cuites', 'cooked'],
    ['Escalope de dinde rôtie', 'cooked'],
    ['Riz cuit à la vapeur', 'cooked'],
    ['Lentilles précuites', 'cooked'],
    ['Pomme de terre non cuite', 'raw'],
    ['Steak pas cuit', 'raw'],
    ['Saucisse à cuire', 'raw'],
  ])('« %s » → %s', (name, expected) => {
    expect(detectFoodState(name)).toBe(expected);
  });

  it('renvoie « inconnu » quand rien n’est indiqué', () => {
    expect(detectFoodState('Filet de poulet')).toBe('unknown');
    expect(detectFoodState('')).toBe('unknown');
  });

  it('ne se laisse pas piéger par un mot qui contient « cuit » ou « cru »', () => {
    expect(detectFoodState('Biscuit au beurre')).toBe('unknown');
    expect(detectFoodState('Crudités variées')).toBe('unknown');
    expect(detectFoodState('Frites surgelées')).toBe('unknown');
  });

  it('utilise la catégorie quand le nom ne dit rien', () => {
    expect(detectFoodState('Filet de poulet', 'Viandes crues')).toBe('raw');
    expect(detectFoodState('Blanc de dinde', 'en:cooked-meats')).toBe('cooked');
  });

  it('renvoie « inconnu » quand le nom et la catégorie se contredisent', () => {
    expect(detectFoodState('Poulet cuit', 'Viandes crues')).toBe('unknown');
    expect(detectFoodState('Poulet cru ou cuit')).toBe('unknown');
  });
});
