export interface RepRange {
  min: number;
  max: number;
}

/**
 * Lit la fourchette de répétitions d'un programme (texte libre) :
 * « 8-12 », « 8 – 12 », « 8 à 12 » → { min: 8, max: 12 } ; « 10 » → { min: 10, max: 10 }.
 * Renvoie `null` pour tout ce qui n'est pas un nombre de répétitions (« 45 s », « max », vide).
 */
export function parseRepRange(text: string | null | undefined): RepRange | null {
  if (!text) return null;
  const clean = text.trim().toLowerCase();
  const span =
    /^(\d{1,3})\s*(?:-|–|—|à|a|to)\s*(\d{1,3})\s*(?:reps?|répétitions?|repetitions?)?$/.exec(clean);
  if (span) {
    const a = Number(span[1]);
    const b = Number(span[2]);
    if (a <= 0 || b <= 0) return null;
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const single = /^(\d{1,3})\s*(?:reps?|répétitions?|repetitions?)?$/.exec(clean);
  if (single) {
    const n = Number(single[1]);
    return n > 0 ? { min: n, max: n } : null;
  }
  return null;
}

/** Écrit une fourchette : (8, 12) → « 8-12 », (10, 10) → « 10 ». */
export function formatRepRange(min: number, max: number): string {
  return min === max ? String(min) : `${Math.min(min, max)}-${Math.max(min, max)}`;
}
