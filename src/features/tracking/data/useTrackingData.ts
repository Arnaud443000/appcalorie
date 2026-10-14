import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  bodyMetricRepo,
  dayFromDate,
  exerciseRepo,
  getSettings,
  goalRepo,
  localDay,
  setEntryRepo,
  workoutSessionRepo,
  type BodyMetric,
  type Exercise,
  type Goal,
  type SetEntry,
  type WeightUnit,
  type WorkoutSession,
} from '@/data';
import type { Day, LengthUnit } from '../logic';

export interface TrackingData {
  metrics: BodyMetric[];
  goals: Goal[];
  sessions: WorkoutSession[];
  sets: SetEntry[];
  exercises: Exercise[];
  exerciseById: Map<string, Exercise>;
  /** Jour (local) de chaque séance, par identifiant. */
  sessionDays: Map<string, Day>;
  weightUnit: WeightUnit;
  lengthUnit: LengthUnit;
  today: Day;
}

/** Aujourd'hui (jour local), remis à jour quand l'app revient au premier plan. */
export function useToday(): Day {
  const [today, setToday] = useState(() => dayFromDate(new Date()));
  useEffect(() => {
    function refresh() {
      setToday(dayFromDate(new Date()));
    }
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);
  return today;
}

/** Unités d'affichage d'après les Réglages (kg et cm tant qu'ils ne sont pas lus). */
function useUnits(): { weightUnit: WeightUnit; lengthUnit: LengthUnit } {
  const [units, setUnits] = useState<{ weightUnit: WeightUnit; lengthUnit: LengthUnit }>({
    weightUnit: 'kg',
    lengthUnit: 'cm',
  });
  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (active) {
          setUnits({ weightUnit: settings.weightUnit, lengthUnit: settings.lengthUnit });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return units;
}

/**
 * Toutes les données de l'onglet Suivi, mises à jour toutes seules quand la base change.
 * `undefined` pendant le premier chargement.
 */
export function useTrackingData(): TrackingData | undefined {
  const metrics = useLiveQuery(() => bodyMetricRepo.list(), []);
  const goals = useLiveQuery(() => goalRepo.list(), []);
  const sessions = useLiveQuery(() => workoutSessionRepo.list(), []);
  const sets = useLiveQuery(() => setEntryRepo.list(), []);
  const exercises = useLiveQuery(() => exerciseRepo.list(), []);
  const { weightUnit, lengthUnit } = useUnits();
  const today = useToday();

  return useMemo(() => {
    if (!metrics || !goals || !sessions || !sets || !exercises) return undefined;
    const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return {
      metrics,
      goals,
      sessions,
      sets,
      exercises: sorted,
      exerciseById: new Map(sorted.map((e) => [e.id, e])),
      sessionDays: new Map(sessions.map((s) => [s.id, localDay(s.startedAt)])),
      weightUnit,
      lengthUnit,
      today,
    };
  }, [metrics, goals, sessions, sets, exercises, weightUnit, lengthUnit, today]);
}
