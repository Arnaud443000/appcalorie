/**
 * Petit stockage local (localStorage) protégé : si le navigateur le refuse (navigation privée,
 * stockage plein…), on garde les valeurs en mémoire pour que l'écran continue de marcher.
 */
const memory = new Map<string, string>();

export function readStored(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) return value;
  } catch {
    // stockage indisponible : on se rabat sur la mémoire
  }
  return memory.get(key) ?? null;
}

export function writeStored(key: string, value: string): void {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignoré : la copie en mémoire suffit pour cette visite
  }
}

export function removeStored(key: string): void {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignoré
  }
}

export function readJson(key: string): unknown {
  const raw = readStored(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  writeStored(key, JSON.stringify(value));
}
