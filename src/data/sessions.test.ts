import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, samples } from '../test/fixtures';
import { workoutSessionRepo } from './repositories';
import { findUnfinishedSession } from './sessions';

beforeEach(resetDb);

const session = (startedAt: string, endedAt: string | null = null) =>
  workoutSessionRepo.create({ ...samples.workoutSession, startedAt, endedAt });

describe('findUnfinishedSession', () => {
  it('ne trouve rien sans séance en cours', async () => {
    expect(await findUnfinishedSession()).toBeUndefined();
    await session('2026-10-10T08:00:00.000Z', '2026-10-10T09:00:00.000Z');
    expect(await findUnfinishedSession()).toBeUndefined();
  });

  it('renvoie la séance en cours la plus récente, en ignorant les séances supprimées', async () => {
    await session('2026-10-10T08:00:00.000Z', '2026-10-10T09:00:00.000Z');
    const older = await session('2026-10-11T08:00:00.000Z');
    const newest = await session('2026-10-12T08:00:00.000Z');
    expect((await findUnfinishedSession())?.id).toBe(newest.id);

    await workoutSessionRepo.remove(newest.id);
    expect((await findUnfinishedSession())?.id).toBe(older.id);
  });
});
