import { formatNumber } from '@/data';

/** Portions rapides proposées pour tout aliment. */
export const QUICK_GRAMS = [50, 100, 150, 200] as const;

/** Portions rapides d'un aliment : sa portion habituelle d'abord (si connue), puis les grammes usuels. */
export function quickPortions(servingG: number | null): { grams: number; label: string }[] {
  const list: { grams: number; label: string }[] = [];
  if (servingG !== null && servingG > 0) {
    list.push({ grams: servingG, label: `1 portion · ${formatNumber(servingG)} g` });
  }
  for (const g of QUICK_GRAMS) {
    if (g !== servingG) list.push({ grams: g, label: `${g} g` });
  }
  return list;
}

/** Texte saisi → grammes valides (> 0, au plus 5 000 g), sinon `null`. */
export function validGrams(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0 || value > 5000) return null;
  return Math.round(value * 10) / 10;
}
