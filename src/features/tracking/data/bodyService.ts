import { bodyMetricRepo, db } from '@/data';
import { applyBodyPatch, isEmptyMetric, patchFor, type BodyKey, type BodyPatch } from '../logic';

/** Clés du changement (poids, taille, chaque mensuration) : sert à effacer les doublons du jour. */
function clearing(patch: BodyPatch): BodyPatch {
  const measurements: NonNullable<BodyPatch['measurements']> = {};
  for (const key of Object.keys(patch.measurements ?? {})) {
    measurements[key as keyof typeof measurements] = null;
  }
  return {
    ...(patch.weightKg !== undefined && { weightKg: null }),
    ...(patch.waistCm !== undefined && { waistCm: null }),
    measurements,
  };
}

/**
 * Enregistre des mesures pour un jour (`AAAA-MM-JJ`) : complète l'enregistrement du jour s'il
 * existe (les autres mesures sont conservées), sinon en crée un. Un enregistrement qui ne contient
 * plus aucune mesure est supprimé. S'il y a des doublons pour ce jour (ancienne saisie, import),
 * le plus récent reçoit la valeur et les autres sont débarrassés de la même mesure.
 */
export async function saveBodyValues(date: string, patch: BodyPatch): Promise<void> {
  await db.transaction('rw', db.bodyMetrics, async () => {
    const records = (await bodyMetricRepo.findBy('date', date)).sort((a, b) =>
      a.updatedAt.localeCompare(b.updatedAt),
    );
    const target = records.pop();
    for (const other of records) {
      const fields = applyBodyPatch(other, clearing(patch));
      if (isEmptyMetric(fields)) await bodyMetricRepo.remove(other.id);
      else await bodyMetricRepo.update(other.id, fields);
    }
    if (!target) {
      const fields = applyBodyPatch({ weightKg: null, waistCm: null, measurements: {} }, patch);
      if (!isEmptyMetric(fields)) await bodyMetricRepo.create({ date, ...fields });
      return;
    }
    const fields = applyBodyPatch(target, patch);
    if (isEmptyMetric(fields)) await bodyMetricRepo.remove(target.id);
    else await bodyMetricRepo.update(target.id, fields);
  });
}

/** Efface une mesure d'un jour (le reste de la journée est conservé). */
export function removeBodyValue(date: string, key: BodyKey): Promise<void> {
  return saveBodyValues(date, patchFor(key, null));
}

/** Modifie une mesure : nouvelle valeur et, si besoin, nouveau jour. */
export async function updateBodyValue(
  key: BodyKey,
  oldDate: string,
  newDate: string,
  value: number,
): Promise<void> {
  await db.transaction('rw', db.bodyMetrics, async () => {
    if (oldDate !== newDate) await removeBodyValue(oldDate, key);
    await saveBodyValues(newDate, patchFor(key, value));
  });
}
