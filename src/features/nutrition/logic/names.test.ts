import { describe, expect, it } from 'vitest';
import { defaultAverageName } from './names';

describe('nom d’une moyenne', () => {
  it('met une majuscule et ajoute cru / cuit si absent', () => {
    expect(defaultAverageName('blanc de poulet', 'raw')).toBe('Blanc de poulet cru');
    expect(defaultAverageName('  riz   basmati ', 'cooked')).toBe('Riz basmati cuit');
  });
  it('n’ajoute rien si l’état est déjà dans la recherche ou inconnu', () => {
    expect(defaultAverageName('poulet cuit', 'cooked')).toBe('Poulet cuit');
    expect(defaultAverageName('pommes cuites', 'cooked')).toBe('Pommes cuites');
    expect(defaultAverageName('yaourt nature', 'unknown')).toBe('Yaourt nature');
  });
});
