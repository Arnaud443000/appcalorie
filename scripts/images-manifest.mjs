// Génère public/exercises/manifest.json : pour chaque exercice (imageSlug), les images présentes.
// Un site statique ne peut pas lister un dossier : l'app lit ce fichier pour savoir quoi afficher.
// Lancer après avoir ajouté ou retiré des images : npm run images:manifest
// (fait aussi automatiquement avant chaque build).
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../public/exercises/', import.meta.url));
const KINDS = ['depart', 'fin', 'unique'];
const PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)_(depart|fin|unique)\.webp$/;
const IGNORED = new Set(['manifest.json', 'README.md', '.gitkeep']);

const images = {};
const unknown = [];
for (const file of readdirSync(dir).sort()) {
  if (IGNORED.has(file)) continue;
  const match = PATTERN.exec(file);
  if (!match) {
    unknown.push(file);
    continue;
  }
  const [, slug, kind] = match;
  (images[slug] ??= []).push(kind);
}
for (const kinds of Object.values(images))
  kinds.sort((a, b) => KINDS.indexOf(a) - KINDS.indexOf(b));

writeFileSync(
  new URL('manifest.json', `file://${dir}`),
  `${JSON.stringify({ version: 1, images }, null, 2)}\n`,
);
console.log(`Manifeste des images : ${Object.keys(images).length} exercice(s).`);
if (unknown.length > 0) {
  console.warn(`Fichiers ignorés (nom hors convention <slug>_depart|fin|unique.webp) :`);
  for (const file of unknown) console.warn(`  - ${file}`);
}
