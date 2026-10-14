import { describe, expect, it } from 'vitest';
import { decodeCsv } from './csv';

describe('décodage du CSV', () => {
  it('lit l’UTF-8', () => {
    const bytes = new TextEncoder().encode('Protéines;Lipides');
    expect(decodeCsv(bytes.buffer)).toBe('Protéines;Lipides');
  });
  it('retombe sur Windows-1252 quand l’UTF-8 est invalide', () => {
    // « é » vaut 0xE9 en Windows-1252 (invalide seul en UTF-8)
    const bytes = new Uint8Array([0x50, 0x72, 0x6f, 0x74, 0xe9, 0x69, 0x6e, 0x65, 0x73]);
    expect(decodeCsv(bytes.buffer)).toBe('Protéines');
  });
});
