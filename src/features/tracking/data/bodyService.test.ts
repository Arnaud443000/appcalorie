import { beforeEach, describe, expect, it } from 'vitest';
import { bodyMetricRepo } from '@/data';
import { resetDb } from '../../../test/fixtures';
import { removeBodyValue, saveBodyValues, updateBodyValue } from './bodyService';

beforeEach(resetDb);

const all = async () => (await bodyMetricRepo.list()).sort((a, b) => a.date.localeCompare(b.date));

describe('saveBodyValues', () => {
  it('crée l’enregistrement du jour', async () => {
    await saveBodyValues('2026-10-12', { weightKg: 80 });
    const [metric] = await all();
    expect(metric).toMatchObject({
      date: '2026-10-12',
      weightKg: 80,
      waistCm: null,
      measurements: {},
    });
  });

  it('complète le même jour sans effacer le reste', async () => {
    await saveBodyValues('2026-10-12', { weightKg: 80, measurements: { arm: 36 } });
    await saveBodyValues('2026-10-12', { waistCm: 84 });
    await saveBodyValues('2026-10-12', { weightKg: 79.5 });
    const list = await all();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ weightKg: 79.5, waistCm: 84, measurements: { arm: 36 } });
  });

  it('ne crée rien pour un changement vide', async () => {
    await saveBodyValues('2026-10-12', {});
    await saveBodyValues('2026-10-12', { weightKg: null });
    expect(await all()).toHaveLength(0);
  });

  it('supprime l’enregistrement quand il ne reste plus aucune mesure', async () => {
    await saveBodyValues('2026-10-12', { weightKg: 80 });
    await removeBodyValue('2026-10-12', 'weight');
    expect(await all()).toHaveLength(0);
  });

  it('garde l’enregistrement quand il reste d’autres mesures', async () => {
    await saveBodyValues('2026-10-12', { weightKg: 80, waistCm: 84 });
    await removeBodyValue('2026-10-12', 'weight');
    const [metric] = await all();
    expect(metric).toMatchObject({ weightKg: null, waistCm: 84 });
  });

  it('effacer une mesure d’un jour sans enregistrement ne fait rien', async () => {
    await removeBodyValue('2026-10-12', 'weight');
    expect(await all()).toHaveLength(0);
  });

  it('doublons du même jour : le plus récent reçoit la valeur, les autres la perdent', async () => {
    await bodyMetricRepo.create({
      date: '2026-10-12',
      weightKg: 80,
      waistCm: 90,
      measurements: {},
    });
    await new Promise((r) => setTimeout(r, 5));
    await bodyMetricRepo.create({
      date: '2026-10-12',
      weightKg: 81,
      waistCm: null,
      measurements: {},
    });
    await saveBodyValues('2026-10-12', { weightKg: 79 });
    const list = await all();
    expect(list).toHaveLength(2);
    expect(list.map((m) => [m.weightKg, m.waistCm])).toEqual(
      expect.arrayContaining([
        [null, 90],
        [79, null],
      ]),
    );
  });
});

describe('updateBodyValue', () => {
  it('change la valeur', async () => {
    await saveBodyValues('2026-10-12', { weightKg: 80 });
    await updateBodyValue('weight', '2026-10-12', '2026-10-12', 79);
    expect((await all()).map((m) => m.weightKg)).toEqual([79]);
  });
  it('change le jour : l’ancien jour est vidé, le reste de la journée est conservé', async () => {
    await saveBodyValues('2026-10-12', { weightKg: 80, waistCm: 84 });
    await updateBodyValue('weight', '2026-10-12', '2026-10-10', 80.5);
    const list = await all();
    expect(list.map((m) => [m.date, m.weightKg, m.waistCm])).toEqual([
      ['2026-10-10', 80.5, null],
      ['2026-10-12', null, 84],
    ]);
  });
  it('déplacer vers un jour qui a déjà une pesée la remplace', async () => {
    await saveBodyValues('2026-10-10', { weightKg: 82 });
    await saveBodyValues('2026-10-12', { weightKg: 80 });
    await updateBodyValue('weight', '2026-10-12', '2026-10-10', 79);
    expect((await all()).map((m) => [m.date, m.weightKg])).toEqual([['2026-10-10', 79]]);
  });
});
