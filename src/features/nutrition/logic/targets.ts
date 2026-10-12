import type { Nutrition } from './totals';

/** Repères de macros en grammes par jour (kcal vient de l'objectif calories). */
export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

/** Répartition proposée tant que rien n'est réglé : 25 % protéines, 50 % glucides, 25 % lipides. */
export const DEFAULT_SPLIT = { protein: 0.25, carbs: 0.5, fat: 0.25 } as const;
export const DEFAULT_FIBER_G = 25;

/** Repères proposés à partir de l'objectif calories (4 / 4 / 9 kcal par gramme). `null` sans objectif. */
export function defaultMacroTargets(goalKcal: number | null): MacroTargets | null {
  if (goalKcal === null) return null;
  return {
    proteinG: Math.round((goalKcal * DEFAULT_SPLIT.protein) / 4),
    carbsG: Math.round((goalKcal * DEFAULT_SPLIT.carbs) / 4),
    fatG: Math.round((goalKcal * DEFAULT_SPLIT.fat) / 9),
    fiberG: DEFAULT_FIBER_G,
  };
}

/** Repères réglés par l'utilisateur, complétés par les repères proposés pour les champs absents. */
export function effectiveMacroTargets(
  saved: Partial<MacroTargets> | null,
  goalKcal: number | null,
): MacroTargets | null {
  const base = defaultMacroTargets(goalKcal);
  if (!base && !saved) return null;
  return {
    proteinG: saved?.proteinG ?? base?.proteinG ?? 0,
    carbsG: saved?.carbsG ?? base?.carbsG ?? 0,
    fatG: saved?.fatG ?? base?.fatG ?? 0,
    fiberG: saved?.fiberG ?? base?.fiberG ?? DEFAULT_FIBER_G,
  };
}

export const MACRO_ROWS = [
  { key: 'proteinG', label: 'Protéines' },
  { key: 'carbsG', label: 'Glucides' },
  { key: 'fatG', label: 'Lipides' },
  { key: 'fiberG', label: 'Fibres' },
] as const satisfies readonly { key: keyof MacroTargets & keyof Nutrition; label: string }[];

const STORAGE_KEY = 'atlas.nutrition.macroTargets';

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Lit les repères enregistrés (localStorage). Valeurs invalides ignorées. */
export function loadMacroTargets(
  storage: Pick<Storage, 'getItem'> = localStorage,
): Partial<MacroTargets> {
  try {
    const raw: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null) return {};
    const record = raw as Record<string, unknown>;
    const result: Partial<MacroTargets> = {};
    for (const { key } of MACRO_ROWS) {
      const value = record[key];
      if (isPositive(value)) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveMacroTargets(
  targets: Partial<MacroTargets>,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(targets));
  } catch {
    // stockage indisponible (navigation privée…) : les repères proposés restent utilisés
  }
}
