import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const SELF = join(SRC, 'test', 'no-hardcoded-colors.test.ts');
const TOKENS = join(SRC, 'ui', 'tokens.css');
// #abc, #aabbcc, rgb(…), hsl(…), etc.
const COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe('Couleurs', () => {
  it("aucune couleur n'est écrite en dur hors de src/ui/tokens.css", () => {
    const offenders = files(SRC)
      .filter((path) => /\.(css|tsx?)$/.test(path) && path !== TOKENS && path !== SELF)
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split('\n')
          .map((line, i) => [line, i] as const)
          .filter(([line]) => COLOR.test(line))
          .map(([line, i]) => `${relative(SRC, path)}:${i + 1}  ${line.trim()}`),
      );
    expect(offenders).toEqual([]);
  });
});
