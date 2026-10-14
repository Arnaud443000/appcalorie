import { describe, expect, it } from 'vitest';
import type { SetLike } from '@/data';
import {
  exerciseSessionStats,
  isSummedMetric,
  metricSeries,
  recentRecordEvents,
  recordRows,
  runningMax,
} from './loads';

const EX = 'e1';
const set = (
  sessionId: string,
  weight: number | null,
  reps: number | null,
  extra: Partial<SetLike> = {},
): SetLike => ({
  exerciseId: EX,
  sessionId,
  weight,
  reps,
  durationSeconds: null,
  distanceMeters: null,
  isWarmup: false,
  ...extra,
});
const days = new Map([
  ['s1', '2026-09-01'],
  ['s2', '2026-09-08'],
  ['s3', '2026-09-15'],
]);

describe('exerciseSessionStats', () => {
  it('1RM (Epley), charge max et volume par séance, échauffements exclus', () => {
    const stats = exerciseSessionStats(
      [set('s1', 60, 10), set('s1', 70, 5), set('s1', 20, 12, { isWarmup: true })],
      days,
    );
    expect(stats).toHaveLength(1);
    const s = stats[0];
    expect(s?.date).toBe('2026-09-01');
    expect(s?.maxWeight).toBe(70);
    expect(s?.oneRepMax).toBeCloseTo(70 * (1 + 5 / 30)); // 81,67 > 60 × (1 + 10/30) = 80
    expect(s?.volume).toBe(60 * 10 + 70 * 5);
    expect(s?.setCount).toBe(2);
  });
  it('le meilleur 1RM n’est pas forcément sur la plus lourde série', () => {
    const s = exerciseSessionStats([set('s1', 100, 1), set('s1', 80, 10)], days)[0];
    expect(s?.maxWeight).toBe(100);
    expect(s?.oneRepMax).toBeCloseTo(80 * (1 + 10 / 30)); // 106,67 > 103,33
  });
  it('trie par date et ignore les séances inconnues (supprimées)', () => {
    const stats = exerciseSessionStats(
      [set('s2', 50, 5), set('s1', 40, 5), set('zzz', 99, 9)],
      days,
    );
    expect(stats.map((s) => s.sessionId)).toEqual(['s1', 's2']);
  });
  it('sans série de travail : aucune ligne', () => {
    expect(exerciseSessionStats([], days)).toEqual([]);
    expect(exerciseSessionStats([set('s1', 20, 10, { isWarmup: true })], days)).toEqual([]);
  });
  it('séries sans charge ni répétitions : valeurs nulles, pas d’erreur', () => {
    const s = exerciseSessionStats([set('s1', null, 12), set('s1', null, null)], days)[0];
    expect(s?.maxWeight).toBeNull();
    expect(s?.oneRepMax).toBeNull();
    expect(s?.volume).toBe(0);
    expect(s?.maxReps).toBe(12);
  });
  it('durée et distance', () => {
    const s = exerciseSessionStats(
      [
        set('s1', null, null, { durationSeconds: 45 }),
        set('s1', null, null, { durationSeconds: 60, distanceMeters: 500 }),
      ],
      days,
    )[0];
    expect(s?.maxDuration).toBe(60);
    expect(s?.maxDistance).toBe(500);
  });
});

describe('metricSeries', () => {
  const stats = exerciseSessionStats(
    [set('s1', 60, 10), set('s2', 65, 8), set('s3', null, 10)],
    days,
  );
  it('une valeur par séance, séances sans valeur écartées', () => {
    expect(metricSeries(stats, 'maxWeight').map((p) => p.value)).toEqual([60, 65]);
    expect(metricSeries(stats, 'oneRepMax')).toHaveLength(2);
    expect(metricSeries(stats, 'volume').map((p) => p.value)).toEqual([600, 520]);
  });
  it('plusieurs séances le même jour : meilleur, ou somme pour le volume', () => {
    const sameDay = new Map([
      ['a', '2026-09-01'],
      ['b', '2026-09-01'],
    ]);
    const st = exerciseSessionStats([set('a', 60, 5), set('b', 70, 5)], sameDay);
    expect(metricSeries(st, 'maxWeight')).toEqual([{ date: '2026-09-01', value: 70 }]);
    expect(metricSeries(st, 'volume')).toEqual([{ date: '2026-09-01', value: 650 }]);
  });
  it('liste vide', () => {
    expect(metricSeries([], 'maxWeight')).toEqual([]);
  });
  it('seul le volume s’additionne', () => {
    expect(isSummedMetric('volume')).toBe(true);
    expect(isSummedMetric('maxWeight')).toBe(false);
  });
});

describe('runningMax', () => {
  it('ne descend jamais', () => {
    const out = runningMax([
      { date: '2026-09-01', value: 60 },
      { date: '2026-09-08', value: 55 },
      { date: '2026-09-15', value: 70 },
    ]);
    expect(out.map((p) => p.value)).toEqual([60, 60, 70]);
    expect(runningMax([])).toEqual([]);
  });
});

describe('recordRows', () => {
  it('records avec leur date', () => {
    const rows = recordRows([set('s1', 60, 10), set('s2', 70, 5)], 'weight_reps', days);
    const maxWeight = rows.find((r) => r.kind === 'maxWeight');
    expect(maxWeight).toEqual({ kind: 'maxWeight', value: 70, date: '2026-09-08' });
    expect(rows.map((r) => r.kind)).toEqual(['maxWeight', 'maxReps', 'maxVolume', 'oneRepMax']);
  });
  it('aucun historique : liste vide', () => {
    expect(recordRows([], 'weight_reps', days)).toEqual([]);
  });
  it('séries d’une séance supprimée ignorées', () => {
    expect(recordRows([set('zzz', 200, 5)], 'weight_reps', days)).toEqual([]);
  });
});

describe('recentRecordEvents', () => {
  const inputs = new Map([[EX, 'weight_reps' as const]]);
  it('annonce le record battu à la dernière séance, jamais à la première', () => {
    const events = recentRecordEvents(
      [set('s1', 60, 8), set('s2', 60, 8), set('s3', 65, 8)],
      days,
      inputs,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      exerciseId: EX,
      kind: 'maxWeight',
      value: 65,
      previous: 60,
      date: '2026-09-15',
    });
  });
  it('égalité : pas un record', () => {
    expect(recentRecordEvents([set('s1', 60, 8), set('s2', 60, 8)], days, inputs)).toEqual([]);
  });
  it('un seul exercice fait une fois : rien', () => {
    expect(recentRecordEvents([set('s1', 60, 8)], days, inputs)).toEqual([]);
    expect(recentRecordEvents([], days, inputs)).toEqual([]);
  });
  it('exercice inconnu : ignoré', () => {
    expect(recentRecordEvents([set('s1', 60, 8), set('s2', 80, 8)], days, new Map())).toEqual([]);
  });
  it('du plus récent au plus ancien, plusieurs exercices', () => {
    const other = (sessionId: string, weight: number): SetLike => ({
      ...set(sessionId, weight, 8),
      exerciseId: 'e2',
    });
    const events = recentRecordEvents(
      [set('s1', 60, 8), set('s3', 70, 8), other('s1', 30), other('s2', 40)],
      days,
      new Map([
        [EX, 'weight_reps' as const],
        ['e2', 'weight_reps' as const],
      ]),
    );
    expect(events.map((e) => [e.exerciseId, e.date])).toEqual([
      [EX, '2026-09-15'],
      ['e2', '2026-09-08'],
    ]);
  });
  it('les échauffements ne comptent pas', () => {
    expect(
      recentRecordEvents([set('s1', 60, 8), set('s2', 100, 8, { isWarmup: true })], days, inputs),
    ).toEqual([]);
  });
});
