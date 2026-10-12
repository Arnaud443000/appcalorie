import { describe, expect, it } from 'vitest';
import { emptyForm, formFromSet, toSetValues, weightStep, type SetForm } from './setForm';

const form = (patch: Partial<SetForm>): SetForm => ({ ...emptyForm(), ...patch });

describe('toSetValues', () => {
  it('charge et répétitions', () => {
    expect(toSetValues(form({ weight: '62,5', reps: '8' }), 'weight_reps', 'kg')).toEqual({
      ok: true,
      values: {
        weight: 62.5,
        reps: 8,
        durationSeconds: null,
        distanceMeters: null,
        rpe: null,
        isWarmup: false,
        note: '',
      },
    });
  });

  it('exige les répétitions', () => {
    for (const reps of ['', '0', 'x']) {
      const result = toSetValues(form({ weight: '60', reps }), 'weight_reps', 'kg');
      expect(result.ok).toBe(false);
    }
  });

  it('accepte une charge vide (exercice sans charge ce jour-là)', () => {
    const result = toSetValues(form({ reps: '10' }), 'weight_reps', 'kg');
    expect(result).toMatchObject({ ok: true, values: { weight: null, reps: 10 } });
  });

  it('refuse une charge illisible', () => {
    expect(toSetValues(form({ weight: '6x', reps: '10' }), 'weight_reps', 'kg').ok).toBe(false);
  });

  it('convertit les livres en kg', () => {
    const result = toSetValues(form({ weight: '135', reps: '5' }), 'weight_reps', 'lb');
    expect(result.ok && result.values.weight).toBeCloseTo(61.235, 3);
  });

  it('poids du corps : lest facultatif', () => {
    expect(toSetValues(form({ reps: '12' }), 'bodyweight_load', 'kg')).toMatchObject({
      ok: true,
      values: { weight: null, reps: 12 },
    });
    expect(toSetValues(form({ weight: '10', reps: '6' }), 'bodyweight_load', 'kg')).toMatchObject({
      ok: true,
      values: { weight: 10, reps: 6 },
    });
  });

  it('répétitions seules : ignore la charge saisie', () => {
    expect(toSetValues(form({ weight: '50', reps: '15' }), 'reps', 'kg')).toMatchObject({
      ok: true,
      values: { weight: null, reps: 15 },
    });
  });

  it('durée', () => {
    expect(toSetValues(form({ duration: '45' }), 'duration', 'kg')).toMatchObject({
      ok: true,
      values: { durationSeconds: 45, reps: null, weight: null },
    });
    expect(toSetValues(form({}), 'duration', 'kg').ok).toBe(false);
  });

  it('distance en km → mètres, durée facultative', () => {
    expect(
      toSetValues(form({ distance: '5,2', duration: '1500' }), 'distance', 'kg'),
    ).toMatchObject({
      ok: true,
      values: { distanceMeters: 5200, durationSeconds: 1500 },
    });
    expect(toSetValues(form({ distance: '1' }), 'distance', 'kg')).toMatchObject({
      ok: true,
      values: { distanceMeters: 1000, durationSeconds: null },
    });
    expect(toSetValues(form({ duration: '60' }), 'distance', 'kg').ok).toBe(false);
  });

  it('effort ressenti facultatif, entre 1 et 10', () => {
    expect(toSetValues(form({ reps: '8', rpe: '8,5' }), 'reps', 'kg')).toMatchObject({
      values: { rpe: 8.5 },
    });
    expect(toSetValues(form({ reps: '8', rpe: '11' }), 'reps', 'kg').ok).toBe(false);
    expect(toSetValues(form({ reps: '8', rpe: '0' }), 'reps', 'kg').ok).toBe(false);
  });

  it('garde l’échauffement et la note', () => {
    expect(
      toSetValues(form({ reps: '8', isWarmup: true, note: '  lent  ' }), 'reps', 'kg'),
    ).toMatchObject({ values: { isWarmup: true, note: 'lent' } });
  });
});

describe('formFromSet', () => {
  it('remplit les champs, avec des virgules', () => {
    expect(
      formFromSet(
        {
          weight: 62.5,
          reps: 8,
          durationSeconds: null,
          distanceMeters: 5200,
          rpe: 7.5,
          note: 'ok',
          isWarmup: true,
        },
        'kg',
      ),
    ).toEqual({
      weight: '62,5',
      reps: '8',
      duration: '',
      distance: '5,2',
      rpe: '7,5',
      note: 'ok',
      isWarmup: true,
    });
  });
  it('affiche les lb', () => {
    expect(formFromSet({ weight: 60 }, 'lb').weight).toBe('132,3');
  });
  it('accepte des valeurs vides', () => {
    expect(formFromSet({}, 'kg')).toEqual(emptyForm());
  });
});

describe('weightStep', () => {
  it('dépend du matériel et de l’unité', () => {
    expect(weightStep('kg', false)).toBe(2.5);
    expect(weightStep('kg', true)).toBe(1);
    expect(weightStep('lb', false)).toBe(5);
    expect(weightStep('lb', true)).toBe(2);
  });
});

describe('portage (charge + distance)', () => {
  it('saisit la charge et la distance en mètres', () => {
    expect(
      toSetValues(form({ weight: '32', distance: '40' }), 'weight_distance', 'kg'),
    ).toMatchObject({ ok: true, values: { weight: 32, distanceMeters: 40, reps: null } });
  });

  it('exige une distance', () => {
    expect(toSetValues(form({ weight: '32' }), 'weight_distance', 'kg')).toEqual({
      ok: false,
      error: 'Indique la distance en mètres.',
    });
  });

  it('relit une série en mètres pour un portage, en km pour le cardio', () => {
    expect(formFromSet({ distanceMeters: 40 }, 'kg', 'weight_distance').distance).toBe('40');
    expect(formFromSet({ distanceMeters: 5200 }, 'kg', 'distance').distance).toBe('5,2');
  });
});
