import { memo, useDeferredValue, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  EQUIPMENT,
  EXERCISE_LEVELS,
  exerciseRepo,
  labelOf,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  type Exercise,
} from '@/data';
import { Card, Chip, EmptyState, Input, ListRow } from '@/ui';
import { ExerciseThumb } from './ExerciseThumb';
import {
  filterExercises,
  hasActiveFilters,
  NO_FILTERS,
  type ExerciseFilters,
} from './filterExercises';
import styles from './ExerciseLibrary.module.css';

const ExerciseLine = memo(function ExerciseLine({ exercise }: { exercise: Exercise }) {
  return (
    <div className={styles.row}>
      <ListRow
        to={`/exercices/${exercise.id}`}
        leading={<ExerciseThumb exercise={exercise} />}
        title={exercise.name}
        subtitle={exercise.primaryMuscles.map((id) => labelOf(MUSCLE_GROUPS, id)).join(', ')}
      />
    </div>
  );
});

interface FilterGroupProps {
  label: string;
  options: readonly { id: string; label: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}

function FilterGroup({ label, options, value, onChange }: FilterGroupProps) {
  return (
    <div className={styles.filterGroup} role="group" aria-label={label}>
      <span className={styles.filterLabel}>{label}</span>
      <div className={styles.chips}>
        {options.map((option) => (
          <Chip
            key={option.id}
            selected={value === option.id}
            onClick={() => onChange(value === option.id ? null : option.id)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** Onglet « Bibliothèque » : recherche, filtres et liste des fiches. */
export function ExerciseLibrary() {
  const exercises = useLiveQuery(() => exerciseRepo.list(), []);
  const [filters, setFilters] = useState<ExerciseFilters>(NO_FILTERS);
  const deferredQuery = useDeferredValue(filters.query);

  const results = useMemo(
    () => (exercises ? filterExercises(exercises, { ...filters, query: deferredQuery }) : []),
    [exercises, filters, deferredQuery],
  );

  const set = (patch: Partial<ExerciseFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  return (
    <div className={styles.library}>
      <Input
        label="Rechercher un exercice"
        type="search"
        value={filters.query}
        placeholder="Nom ou autre nom (ex. pompes)"
        onChange={(event) => set({ query: event.target.value })}
      />
      <div className={styles.filters}>
        <FilterGroup
          label="Muscle"
          options={MUSCLE_GROUPS}
          value={filters.muscle}
          onChange={(muscle) => set({ muscle })}
        />
        <FilterGroup
          label="Matériel"
          options={EQUIPMENT}
          value={filters.equipment}
          onChange={(equipment) => set({ equipment })}
        />
        <FilterGroup
          label="Niveau"
          options={EXERCISE_LEVELS}
          value={filters.level}
          onChange={(level) => set({ level })}
        />
        <FilterGroup
          label="Mouvement"
          options={MOVEMENT_PATTERNS}
          value={filters.pattern}
          onChange={(pattern) => set({ pattern })}
        />
      </div>

      {exercises && (
        <div className={styles.bar}>
          <span role="status">
            {results.length} exercice{results.length > 1 ? 's' : ''}
          </span>
          {hasActiveFilters(filters) && (
            <button type="button" className={styles.reset} onClick={() => setFilters(NO_FILTERS)}>
              Tout effacer
            </button>
          )}
        </div>
      )}

      {exercises && results.length === 0 && (
        <EmptyState
          icon="exercises"
          title="Aucun exercice trouvé"
          message="Essaie un autre mot, ou retire un filtre."
        />
      )}
      {results.length > 0 && (
        <Card flush>
          {results.map((exercise) => (
            <ExerciseLine key={exercise.id} exercise={exercise} />
          ))}
        </Card>
      )}
    </div>
  );
}
