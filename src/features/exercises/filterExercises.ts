import { normalizeName, type Exercise } from '@/data';

export interface ExerciseFilters {
  query: string;
  muscle: string | null;
  equipment: string | null;
  level: string | null;
  pattern: string | null;
}

export const NO_FILTERS: ExerciseFilters = {
  query: '',
  muscle: null,
  equipment: null,
  level: null,
  pattern: null,
};

export function hasActiveFilters(filters: ExerciseFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.muscle !== null ||
    filters.equipment !== null ||
    filters.level !== null ||
    filters.pattern !== null
  );
}

/** Texte de recherche d'une fiche (nom + autres noms), sans accents ni majuscules. */
function searchText(exercise: Exercise): string {
  return [exercise.name, ...exercise.aliases].map(normalizeName).join(' | ');
}

/** Garde les exercices qui respectent la recherche et tous les filtres, triés par nom. */
export function filterExercises(
  exercises: readonly Exercise[],
  filters: ExerciseFilters,
): Exercise[] {
  const words = normalizeName(filters.query).split(' ').filter(Boolean);
  return exercises
    .filter((exercise) => {
      if (filters.muscle && !exercise.primaryMuscles.includes(filters.muscle as never)) {
        return false;
      }
      if (filters.equipment && !exercise.equipment.includes(filters.equipment as never)) {
        return false;
      }
      if (filters.level && exercise.level !== filters.level) return false;
      if (filters.pattern && exercise.movementPattern !== filters.pattern) return false;
      if (words.length === 0) return true;
      const text = searchText(exercise);
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
