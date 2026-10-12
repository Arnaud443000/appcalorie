import { describe, expect, it } from 'vitest';
import {
  addToPlan,
  buildBlocks,
  defaultTarget,
  newPlanItem,
  planFromRoutine,
  planFromSets,
  replaceInPlan,
  setSkipped,
} from './plan';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('plan de séance', () => {
  it('copie les exercices du programme sans les marquer comme sautés', () => {
    const plan = planFromRoutine([
      { exerciseId: A, targetSets: 4, targetReps: '8-12', restSeconds: 90, note: '' },
    ]);
    expect(plan).toEqual([
      {
        exerciseId: A,
        targetSets: 4,
        targetReps: '8-12',
        restSeconds: 90,
        note: '',
        skipped: false,
      },
    ]);
    expect(planFromRoutine([])).toEqual([]);
  });

  it('ajoute, sans doublon', () => {
    const plan = addToPlan([], A);
    expect(plan).toEqual([newPlanItem(A)]);
    expect(addToPlan(plan, A)).toBe(plan);
    expect(addToPlan(plan, B).map((i) => i.exerciseId)).toEqual([A, B]);
  });

  it('remplace en gardant la place et les objectifs', () => {
    const plan = [{ ...newPlanItem(A), targetReps: '8-12', targetSets: 4 }, newPlanItem(B)];
    const next = replaceInPlan(plan, A, C);
    expect(next[0]).toMatchObject({ exerciseId: C, targetReps: '8-12', targetSets: 4 });
    expect(next[1]?.exerciseId).toBe(B);
    // remplacer par un exercice déjà présent, ou par lui-même : rien ne change
    expect(replaceInPlan(plan, A, B)).toBe(plan);
    expect(replaceInPlan(plan, A, A)).toBe(plan);
  });

  it('saute et rétablit', () => {
    const plan = [newPlanItem(A), newPlanItem(B)];
    const skipped = setSkipped(plan, A, true);
    expect(skipped.map((i) => i.skipped)).toEqual([true, false]);
    expect(setSkipped(skipped, A, false).map((i) => i.skipped)).toEqual([false, false]);
  });
});

describe('buildBlocks', () => {
  const set = (exerciseId: string, order: number) => ({ exerciseId, order });

  it('suit le plan, avec les séries triées', () => {
    const blocks = buildBlocks([newPlanItem(A), newPlanItem(B)], [set(B, 3), set(A, 2), set(A, 0)]);
    expect(blocks.map((b) => b.exerciseId)).toEqual([A, B]);
    expect(blocks[0]?.sets.map((s) => s.order)).toEqual([0, 2]);
  });

  it('ajoute à la fin les exercices faits mais hors plan', () => {
    const blocks = buildBlocks([newPlanItem(A)], [set(C, 1), set(B, 0)]);
    expect(blocks.map((b) => b.exerciseId)).toEqual([A, B, C]);
    expect(blocks[1]?.item).toBeNull();
  });

  it('une séance libre (plan vide) se construit série après série', () => {
    expect(buildBlocks([], [])).toEqual([]);
    expect(buildBlocks([], [set(A, 0)])).toHaveLength(1);
  });

  it("un exercice sauté qui a déjà des séries n'est plus considéré comme sauté", () => {
    const plan = setSkipped([newPlanItem(A)], A, true);
    expect(buildBlocks(plan, [])[0]?.skipped).toBe(true);
    expect(buildBlocks(plan, [set(A, 0)])[0]?.skipped).toBe(false);
  });
});

describe('planFromSets (copie de séance)', () => {
  it('garde l’ordre, compte les séries de travail et reprend les objectifs du programme', () => {
    const sets = [
      { exerciseId: B, order: 3, isWarmup: false },
      { exerciseId: A, order: 0, isWarmup: true },
      { exerciseId: A, order: 1, isWarmup: false },
      { exerciseId: A, order: 2, isWarmup: false },
    ];
    const plan = planFromSets(sets, [
      { exerciseId: A, targetSets: 3, targetReps: '8-12', restSeconds: 120, note: 'lent' },
    ]);
    expect(plan.map((i) => i.exerciseId)).toEqual([A, B]);
    expect(plan[0]).toMatchObject({
      targetSets: 2,
      targetReps: '8-12',
      restSeconds: 120,
      note: 'lent',
    });
    expect(plan[1]).toMatchObject({ targetSets: 1, targetReps: '', restSeconds: null });
  });

  it('prévoit au moins 1 série même si tout était de l’échauffement', () => {
    const plan = planFromSets([{ exerciseId: A, order: 0, isWarmup: true }]);
    expect(plan[0]?.targetSets).toBe(1);
  });

  it('accepte une séance vide', () => {
    expect(planFromSets([])).toEqual([]);
  });
});

describe('defaultTarget', () => {
  it('propose un objectif selon le type de saisie', () => {
    expect(defaultTarget('weight_reps')).toBe('8-12');
    expect(defaultTarget('bodyweight_load')).toBe('8-12');
    expect(defaultTarget('reps')).toBe('10-15');
    expect(defaultTarget('duration')).toBe('45 s');
    expect(defaultTarget('distance')).toBe('');
  });
});
