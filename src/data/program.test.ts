import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, samples } from '../test/fixtures';
import { findExerciseByName, MY_PROGRAM, normalizeName, seedMyProgram } from './program';
import { exerciseRepo, routineRepo } from './repositories';
import type { Exercise } from './schemas';

beforeEach(async () => {
  await resetDb();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const addExercise = (name: string, aliases: string[] = []) =>
  exerciseRepo.create({ ...samples.exercise, name, aliases });

describe('Recherche d’un exercice par son nom', () => {
  it('ignore accents, majuscules et ponctuation', () => {
    expect(normalizeName('  Écarté à la poulie vis-à-vis ')).toBe('ecarte a la poulie vis a vis');
  });

  it('cherche le nom, puis les autres noms', async () => {
    const exercises: Exercise[] = [
      await addExercise('Développé haltères assis', ['Développé militaire haltères assis']),
      await addExercise('Curl marteau'),
    ];
    expect(findExerciseByName(exercises, 'curl MARTEAU')?.name).toBe('Curl marteau');
    expect(findExerciseByName(exercises, 'Développé militaire haltères assis')?.name).toBe(
      'Développé haltères assis',
    );
    expect(findExerciseByName(exercises, 'Inconnu')).toBeUndefined();
  });
});

describe('seedMyProgram', () => {
  it('contient 5 séances avec le bon nombre d’exercices', () => {
    expect(MY_PROGRAM.map((d) => [d.name, d.lines.length])).toEqual([
      ['Lundi Push', 7],
      ['Mardi Pull', 7],
      ['Mercredi Jambes', 7],
      ['Jeudi Haut du corps', 8],
      ['Vendredi Bas du corps', 8],
    ]);
  });

  it('crée les programmes avec les exercices trouvés et signale les autres', async () => {
    const squat = await addExercise('Squat barre');
    await addExercise('Fente bulgare');

    const result = await seedMyProgram();
    // Seuls Mercredi et Vendredi ont au moins un exercice trouvé.
    expect(result.created).toEqual(['Mercredi Jambes', 'Vendredi Bas du corps']);
    expect(result.missing).toContainEqual({
      routine: 'Mercredi Jambes',
      exercise: 'Leg extension',
    });

    const legs = (await routineRepo.list()).find((r) => r.name === 'Mercredi Jambes');
    expect(legs?.items[0]).toEqual({
      exerciseId: squat.id,
      targetSets: 4,
      targetReps: '6-8',
      restSeconds: 180,
      note: '',
    });
  });

  it('ne crée qu’une fois, ne modifie pas et ne recrée pas un programme supprimé', async () => {
    await addExercise('Squat barre');
    await addExercise('Développé couché barre');
    await seedMyProgram();
    const [push, legs] = ['Lundi Push', 'Mercredi Jambes'].map((name) =>
      MY_PROGRAM.find((d) => d.name === name),
    );
    await routineRepo.update(push?.id ?? '', { name: 'Mon push à moi' });
    await routineRepo.remove(legs?.id ?? '');

    expect((await seedMyProgram()).created).toEqual([]);
    const names = (await routineRepo.list()).map((r) => r.name);
    expect(names).toEqual(['Mon push à moi']);
  });
});
