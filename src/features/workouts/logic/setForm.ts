import {
  formatNumber,
  type InputType,
  kgToUnit,
  parseDecimal,
  parseWholeNumber,
  type SetLike,
  unitToKg,
  type WeightUnit,
} from '@/data';

/** Valeurs d'une série prêtes à être enregistrées (unités de stockage : kg, secondes, mètres). */
export interface SetValues {
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  rpe: number | null;
  isWarmup: boolean;
  note: string;
}

/** Contenu des champs de saisie d'une ligne de série (texte, dans l'unité affichée). */
export interface SetForm {
  weight: string;
  reps: string;
  duration: string;
  /** Distance dans l'unité de saisie de l'exercice (voir `distanceInputUnit`). */
  distance: string;
  rpe: string;
  note: string;
  isWarmup: boolean;
}

/** Quels champs montrer pour chaque type de saisie. */
export const FIELDS_BY_INPUT: Record<
  InputType,
  { weight: boolean; reps: boolean; duration: boolean; distance: boolean }
> = {
  weight_reps: { weight: true, reps: true, duration: false, distance: false },
  bodyweight_load: { weight: true, reps: true, duration: false, distance: false },
  reps: { weight: false, reps: true, duration: false, distance: false },
  duration: { weight: false, reps: false, duration: true, distance: false },
  distance: { weight: false, reps: false, duration: true, distance: true },
  weight_distance: { weight: true, reps: false, duration: false, distance: true },
};

/** Unité de saisie de la distance : km pour le cardio, m pour un portage (charge + distance). */
export function distanceInputUnit(inputType: InputType): 'km' | 'm' {
  return inputType === 'weight_distance' ? 'm' : 'km';
}

const metersPer = (inputType: InputType) => (distanceInputUnit(inputType) === 'km' ? 1000 : 1);

export function emptyForm(isWarmup = false): SetForm {
  return { weight: '', reps: '', duration: '', distance: '', rpe: '', note: '', isWarmup };
}

/** Texte d'un champ numérique : « 62,5 », sans séparateur de milliers. */
export function formatField(value: number): string {
  return formatNumber(value).replace(/\s/g, '');
}

export function formFromSet(
  set: Partial<
    Pick<
      SetLike,
      'weight' | 'reps' | 'durationSeconds' | 'distanceMeters' | 'rpe' | 'note' | 'isWarmup'
    >
  >,
  unit: WeightUnit,
  inputType: InputType = 'weight_reps',
): SetForm {
  return {
    weight: set.weight != null ? formatField(kgToUnit(set.weight, unit)) : '',
    reps: set.reps != null ? String(set.reps) : '',
    duration: set.durationSeconds != null ? String(Math.round(set.durationSeconds)) : '',
    distance:
      set.distanceMeters != null ? formatField(set.distanceMeters / metersPer(inputType)) : '',
    rpe: set.rpe != null ? formatField(set.rpe) : '',
    note: set.note ?? '',
    isWarmup: set.isWarmup ?? false,
  };
}

export type FormResult = { ok: true; values: SetValues } | { ok: false; error: string };

/**
 * Transforme la saisie en valeurs à enregistrer, ou explique ce qui manque.
 * Les champs qui ne concernent pas le type d'exercice sont ignorés (null).
 */
export function toSetValues(form: SetForm, inputType: InputType, unit: WeightUnit): FormResult {
  const fields = FIELDS_BY_INPUT[inputType];

  const reps = fields.reps ? parseWholeNumber(form.reps) : null;
  if (fields.reps && (reps === null || reps <= 0)) {
    return { ok: false, error: 'Indique le nombre de répétitions.' };
  }

  const weightValue = fields.weight ? parseDecimal(form.weight) : null;
  if (
    (inputType === 'weight_reps' || inputType === 'weight_distance') &&
    form.weight.trim() !== '' &&
    weightValue === null
  ) {
    return { ok: false, error: 'La charge doit être un nombre.' };
  }

  const duration = fields.duration ? parseWholeNumber(form.duration) : null;
  if (inputType === 'duration' && (duration === null || duration <= 0)) {
    return { ok: false, error: 'Indique la durée en secondes.' };
  }

  const distance = fields.distance ? parseDecimal(form.distance) : null;
  if (fields.distance && (distance === null || distance <= 0)) {
    return {
      ok: false,
      error:
        distanceInputUnit(inputType) === 'km'
          ? 'Indique la distance en kilomètres.'
          : 'Indique la distance en mètres.',
    };
  }

  const rpe = parseDecimal(form.rpe);
  if (form.rpe.trim() !== '' && (rpe === null || rpe < 1 || rpe > 10)) {
    return { ok: false, error: 'L’effort ressenti va de 1 à 10.' };
  }

  return {
    ok: true,
    values: {
      weight: weightValue === null ? null : unitToKg(weightValue, unit),
      reps,
      durationSeconds: duration,
      distanceMeters: distance === null ? null : Math.round(distance * metersPer(inputType)),
      rpe,
      isWarmup: form.isWarmup,
      note: form.note.trim(),
    },
  };
}

/** Réglage de + et − pour chaque champ. */
export function weightStep(unit: WeightUnit, dumbbell: boolean): number {
  if (unit === 'lb') return dumbbell ? 2 : 5;
  return dumbbell ? 1 : 2.5;
}

/** Ajoute `delta` au texte d'un champ (vide = 0), sans passer sous `min`. */
export function stepText(
  text: string,
  delta: number,
  min = 0,
  max = Number.POSITIVE_INFINITY,
): string {
  const current = parseDecimal(text) ?? 0;
  const next = Math.min(max, Math.max(min, Math.round((current + delta) * 100) / 100));
  return formatField(next);
}
