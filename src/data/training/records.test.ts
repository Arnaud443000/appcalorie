import { describe, expect, it } from 'vitest';
import { detectRecords, exerciseRecords } from './records';
import type { SetLike } from './types';

function set(sessionId: string, patch: Partial<SetLike> = {}): SetLike {
  return {
    exerciseId: 'bench',
    sessionId,
    weight: 60,
    reps: 8,
    durationSeconds: null,
    distanceMeters: null,
    isWarmup: false,
    ...patch,
  };
}

describe('exerciseRecords', () => {
  it('renvoie un objet vide sans série', () => {
    expect(exerciseRecords([], 'weight_reps')).toEqual({});
  });

  it('calcule charge max, répétitions max, volume max et 1RM', () => {
    const records = exerciseRecords(
      [
        set('a', { weight: 60, reps: 10 }),
        set('a', { weight: 70, reps: 5 }),
        set('b', { weight: 50, reps: 12 }),
      ],
      'weight_reps',
    );
    expect(records.maxWeight).toEqual({ kind: 'maxWeight', value: 70, sessionId: 'a' });
    expect(records.maxReps).toEqual({ kind: 'maxReps', value: 12, sessionId: 'b' });
    // séance a : 600 + 350 = 950 ; séance b : 600
    expect(records.maxVolume).toEqual({ kind: 'maxVolume', value: 950, sessionId: 'a' });
    // 60 × (1 + 10/30) = 80 ; 70 × (1 + 5/30) = 81,67 ; 50 × 1,4 = 70
    expect(records.oneRepMax?.value).toBeCloseTo(81.667, 2);
    expect(records.oneRepMax?.sessionId).toBe('a');
  });

  it("ignore les séries d'échauffement", () => {
    const records = exerciseRecords(
      [set('a', { isWarmup: true, weight: 200, reps: 20 }), set('a', { weight: 60, reps: 8 })],
      'weight_reps',
    );
    expect(records.maxWeight?.value).toBe(60);
    expect(records.maxReps?.value).toBe(8);
    expect(records.maxVolume?.value).toBe(480);
  });

  it('ignore les séries sans répétitions ou sans charge', () => {
    const records = exerciseRecords(
      [set('a', { reps: null }), set('a', { weight: null, reps: 15 }), set('a', { reps: 0 })],
      'weight_reps',
    );
    expect(records.maxWeight).toBeUndefined();
    expect(records.maxVolume).toBeUndefined();
    expect(records.oneRepMax).toBeUndefined();
    expect(records.maxReps?.value).toBe(15);
  });

  it('au poids du corps avec lest : lest max, répétitions max, pas de 1RM', () => {
    const records = exerciseRecords(
      [set('a', { weight: 10, reps: 6 }), set('a', { weight: null, reps: 12 })],
      'bodyweight_load',
    );
    expect(records.maxWeight?.value).toBe(10);
    expect(records.maxReps?.value).toBe(12);
    expect(records.maxVolume?.value).toBe(60);
    expect(records.oneRepMax).toBeUndefined();
  });

  it('au poids du corps sans lest : seulement des répétitions', () => {
    const records = exerciseRecords([set('a', { weight: 0, reps: 12 })], 'bodyweight_load');
    expect(records.maxWeight).toBeUndefined();
    expect(records.maxVolume).toBeUndefined();
    expect(records.maxReps?.value).toBe(12);
  });

  it('répétitions seules, durée et distance', () => {
    expect(exerciseRecords([set('a', { weight: null, reps: 20 })], 'reps')).toEqual({
      maxReps: { kind: 'maxReps', value: 20, sessionId: 'a' },
    });
    expect(
      exerciseRecords(
        [set('a', { durationSeconds: 45 }), set('b', { durationSeconds: 60 })],
        'duration',
      ).maxDuration,
    ).toEqual({ kind: 'maxDuration', value: 60, sessionId: 'b' });
    expect(
      exerciseRecords([set('a', { distanceMeters: 5000 })], 'distance').maxDistance?.value,
    ).toBe(5000);
  });
});

describe('detectRecords', () => {
  const history = [set('old', { weight: 60, reps: 8 }), set('old', { weight: 60, reps: 8 })];

  it("n'annonce rien la toute première fois (aucun record à battre)", () => {
    expect(detectRecords([], [set('today', { weight: 100, reps: 10 })], 'weight_reps')).toEqual([]);
  });

  it('annonce les records battus avec la valeur précédente', () => {
    const breaks = detectRecords(history, [set('today', { weight: 65, reps: 8 })], 'weight_reps');
    const byKind = Object.fromEntries(breaks.map((b) => [b.kind, b]));
    expect(byKind.maxWeight).toEqual({ kind: 'maxWeight', value: 65, previous: 60 });
    expect(byKind.oneRepMax?.previous).toBeCloseTo(76);
    expect(byKind.maxReps).toBeUndefined();
    // volume : 520 aujourd'hui contre 960 la dernière fois
    expect(byKind.maxVolume).toBeUndefined();
  });

  it('le volume max se bat sur la séance entière', () => {
    const today = [set('today'), set('today'), set('today')]; // 3 × 480 = 1440 > 960
    const breaks = detectRecords(history, today, 'weight_reps');
    expect(breaks.map((b) => b.kind)).toEqual(['maxVolume']);
    expect(breaks[0]).toMatchObject({ value: 1440, previous: 960 });
  });

  it("une égalité n'est pas un record", () => {
    expect(detectRecords(history, [set('today', { weight: 60, reps: 8 })], 'weight_reps')).toEqual(
      [],
    );
  });

  it("un échauffement lourd n'est pas un record", () => {
    expect(
      detectRecords(
        history,
        [set('today', { weight: 100, reps: 10, isWarmup: true })],
        'weight_reps',
      ),
    ).toEqual([]);
  });

  it("l'historique d'échauffement ne fausse pas le record précédent", () => {
    const prev = [
      set('old', { weight: 200, reps: 3, isWarmup: true }),
      set('old', { weight: 60, reps: 8 }),
    ];
    const breaks = detectRecords(prev, [set('today', { weight: 62.5, reps: 8 })], 'weight_reps');
    expect(breaks.find((b) => b.kind === 'maxWeight')).toMatchObject({ previous: 60, value: 62.5 });
  });

  it('gère les séries vides', () => {
    expect(detectRecords([], [], 'weight_reps')).toEqual([]);
    expect(detectRecords(history, [], 'weight_reps')).toEqual([]);
  });

  it('fonctionne pour la durée', () => {
    const breaks = detectRecords(
      [set('old', { durationSeconds: 45, weight: null, reps: null })],
      [set('today', { durationSeconds: 60, weight: null, reps: null })],
      'duration',
    );
    expect(breaks).toEqual([{ kind: 'maxDuration', value: 60, previous: 45 }]);
  });

  it('au poids du corps avec lest : un premier lest bat « sans lest » seulement avec un record existant', () => {
    const prev = [set('old', { weight: 5, reps: 8 })];
    const breaks = detectRecords(prev, [set('today', { weight: 7.5, reps: 8 })], 'bodyweight_load');
    expect(breaks.map((b) => b.kind)).toEqual(['maxWeight', 'maxVolume']);
    const noLestBefore = [set('old', { weight: 0, reps: 8 })];
    expect(
      detectRecords(noLestBefore, [set('today', { weight: 5, reps: 8 })], 'bodyweight_load'),
    ).toEqual([]);
  });
});

describe('portage (charge + distance)', () => {
  it('retient la charge portée et la distance parcourue, sans volume ni 1RM', () => {
    const records = exerciseRecords(
      [
        set('a', { weight: 24, reps: null, distanceMeters: 40 }),
        set('b', { weight: 32, reps: null, distanceMeters: 30 }),
        set('b', { weight: 40, reps: null, distanceMeters: null }),
      ],
      'weight_distance',
    );
    expect(records.maxWeight?.value).toBe(32);
    expect(records.maxDistance?.value).toBe(40);
    expect(records.maxVolume).toBeUndefined();
    expect(records.oneRepMax).toBeUndefined();
  });
});
