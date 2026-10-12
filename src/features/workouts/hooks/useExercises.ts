import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { exerciseRepo, type Exercise } from '@/data';

/** Tous les exercices, triés par nom, et un accès par identifiant. `undefined` pendant le chargement. */
export function useExercises(): { list: Exercise[]; byId: Map<string, Exercise> } | undefined {
  const exercises = useLiveQuery(() => exerciseRepo.list(), []);
  return useMemo(() => {
    if (!exercises) return undefined;
    const list = [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return { list, byId: new Map(list.map((exercise) => [exercise.id, exercise])) };
  }, [exercises]);
}
