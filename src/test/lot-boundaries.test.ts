import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Règle « un lot = son dossier » (docs/CONTRACTS.md §1) : un lot n'importe jamais un autre lot,
// ni la coque (src/app). Ce qui se partage passe par @/data ou @/ui.
const SRC = join(process.cwd(), 'src');
const FEATURES = join(SRC, 'features');
const IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/** Dossier de premier niveau sous src/features (le lot), ou null hors des lots. */
function lotOf(path: string): string | null {
  const rel = relative(FEATURES, path);
  return rel.startsWith('..') ? null : (rel.split(sep)[0] ?? null);
}

describe('Frontières entre les lots', () => {
  it('aucun lot n’importe un autre lot ni la coque', () => {
    const offenders: string[] = [];
    for (const path of files(FEATURES).filter((p) => /\.tsx?$/.test(p))) {
      const lot = lotOf(path);
      for (const [, spec = ''] of readFileSync(path, 'utf8').matchAll(IMPORT)) {
        let target: string | null = null;
        if (spec.startsWith('@/')) target = join(SRC, spec.slice(2));
        else if (spec.startsWith('.')) target = resolve(dirname(path), spec);
        if (target === null) continue; // paquet npm
        const otherLot = lotOf(target);
        const inApp = relative(join(SRC, 'app'), target).startsWith('..') === false;
        if ((otherLot !== null && otherLot !== lot) || inApp) {
          offenders.push(`${relative(SRC, path)} → ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
