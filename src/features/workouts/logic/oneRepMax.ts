/**
 * 1RM estimé par la formule d'Epley : charge × (1 + répétitions / 30).
 * Renvoie `null` si la charge ou les répétitions sont absentes, nulles ou négatives
 * (impossible d'estimer). À 1 répétition, la formule donne un peu plus que la charge
 * (× 1,033) : on applique la formule telle quelle, partout, pour rester cohérent.
 */
export function estimateOneRepMax(
  weight: number | null | undefined,
  reps: number | null | undefined,
): number | null {
  if (weight == null || reps == null) return null;
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  if (weight <= 0 || reps <= 0) return null;
  return weight * (1 + reps / 30);
}
