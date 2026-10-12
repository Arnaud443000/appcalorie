import type { CatalogProduct } from './types';

/**
 * Lecture du fichier CIQUAL (table de composition nutritionnelle de l'ANSES).
 * Fonction pure : elle reçoit le TEXTE du fichier CSV déjà décodé et renvoie des aliments.
 * Format attendu et origine du fichier : voir README.md de ce dossier.
 */

/** Marque d'octet que certains logiciels ajoutent en tête d'un fichier UTF-8. */
const BOM = String.fromCharCode(0xfeff);

export interface ParsedCiqual {
  foods: CatalogProduct[];
  /** Lignes ignorées parce qu'il manque calories, protéines, glucides ou lipides. */
  skipped: number;
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/** Sépare la première ligne en repérant le délimiteur le plus fréquent hors guillemets. */
function detectDelimiter(headerLine: string): string {
  const counts: Record<string, number> = { ';': 0, '\t': 0, ',': 0 };
  let quoted = false;
  for (const char of headerLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char in counts) counts[char] = (counts[char] ?? 0) + 1;
  }
  const best = [';', '\t', ','].reduce((a, b) => ((counts[b] ?? 0) > (counts[a] ?? 0) ? b : a));
  return best;
}

/** Lecteur CSV minimal : guillemets, guillemets doublés (""), retours à la ligne dans un champ. */
function parseCsv(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

/* ------------------------------------------------------------------ */
/* Valeurs                                                             */
/* ------------------------------------------------------------------ */

/**
 * Convertit une cellule CIQUAL en nombre.
 * - « 22,5 » ou « 22.5 » → 22.5
 * - « traces » et « < 0,5 » (en dessous du seuil de mesure) → 0 : la quantité est négligeable
 * - « - », vide, texte inconnu → null (valeur inconnue, PAS zéro)
 */
export function parseCiqualNumber(cell: string | undefined): number | null {
  const value = (cell ?? '').trim().toLowerCase();
  if (value === '' || value === '-') return null;
  if (value === 'traces' || value.startsWith('<')) return 0;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const normalizeHeader = (header: string) =>
  header
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Index de toutes les colonnes dont l'en-tête (normalisé) satisfait le critère, dans l'ordre du fichier. */
function findColumns(headers: string[], test: (h: string) => boolean): number[] {
  return headers.flatMap((h, index) => (test(h) ? [index] : []));
}

/* ------------------------------------------------------------------ */
/* Fonction principale                                                 */
/* ------------------------------------------------------------------ */

export function parseCiqualCsv(content: string): ParsedCiqual {
  const text = content.startsWith(BOM) ? content.slice(1) : content; // retire l'éventuel BOM
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const rows = parseCsv(text, detectDelimiter(firstLine));
  const header = rows[0];
  if (!header) throw new Error('Fichier CIQUAL vide.');

  const headers = header.map(normalizeHeader);
  const columns = {
    code: headers.indexOf('alim_code'),
    name: headers.indexOf('alim_nom_fr'),
    group: headers.indexOf('alim_grp_nom_fr'),
    subgroup: headers.indexOf('alim_ssgrp_nom_fr'),
    subsubgroup: headers.indexOf('alim_ssssgrp_nom_fr'),
    // Calories : on lit la valeur officielle UE ; si la case est vide pour cet aliment,
    // on prend la valeur « Jones », puis n'importe quelle autre colonne en kcal.
    kcal: [
      ...findColumns(headers, (h) => h.startsWith('energie, reglement ue') && h.includes('kcal')),
      ...findColumns(
        headers,
        (h) => h.startsWith('energie, n x facteur jones') && h.includes('kcal'),
      ),
      ...findColumns(headers, (h) => h.startsWith('energie') && h.includes('kcal')),
    ],
    // Protéines : la colonne « N x 6.25 » d'abord, puis le facteur de Jones.
    protein: [
      ...findColumns(headers, (h) => h.startsWith('proteines, n x 6.25')),
      ...findColumns(headers, (h) => h.startsWith('proteines')),
    ],
    carbs: findColumns(headers, (h) => h.startsWith('glucides')),
    fat: findColumns(headers, (h) => h.startsWith('lipides')),
    fiber: findColumns(headers, (h) => h.startsWith('fibres alimentaires')),
  };

  const required = ['kcal', 'protein', 'carbs', 'fat'] as const;
  const missing = [
    ...(columns.name === -1 ? ['name'] : []),
    ...required.filter((key) => columns[key].length === 0),
  ];
  if (missing.length > 0) {
    throw new Error(
      `Fichier CIQUAL non reconnu : colonne introuvable (${missing.join(', ')}). ` +
        'Vérifie que c’est bien la table CIQUAL au format CSV.',
    );
  }

  const cell = (row: string[], index: number) => (index === -1 ? undefined : row[index]);
  /** Première valeur lisible parmi plusieurs colonnes candidates. */
  const firstNumber = (row: string[], candidates: number[]) => {
    for (const index of candidates) {
      const n = parseCiqualNumber(cell(row, index));
      if (n !== null) return n;
    }
    return null;
  };
  const foods: CatalogProduct[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const name = (cell(row, columns.name) ?? '').trim();
    const kcal = firstNumber(row, columns.kcal);
    const proteinG = firstNumber(row, columns.protein);
    const carbsG = firstNumber(row, columns.carbs);
    const fatG = firstNumber(row, columns.fat);
    if (!name || kcal === null || proteinG === null || carbsG === null || fatG === null) {
      skipped++;
      continue;
    }
    const category = [columns.group, columns.subgroup, columns.subsubgroup]
      .map((index) => (cell(row, index) ?? '').trim())
      .filter((part) => part !== '' && part !== '-')
      .join(' > ');
    foods.push({
      source: 'ciqual',
      code: (cell(row, columns.code) ?? '').trim(),
      name,
      brand: '',
      category,
      barcode: null,
      kcal,
      proteinG,
      carbsG,
      fatG,
      fiberG: firstNumber(row, columns.fiber),
    });
  }
  return { foods, skipped };
}
