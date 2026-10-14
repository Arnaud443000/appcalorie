import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { foodLogEntryRepo, foodRepo, type Goal } from '@/data';
import { Button, Card, EmptyState } from '@/ui';
import { GoalCard } from '../components/GoalCard';
import { GoalSheet } from '../components/GoalSheet';
import type { TrackingData } from '../data/useTrackingData';
import {
  assessCalorieGoal,
  dailyCalories,
  recentDailyAverage,
  type CalorieAssessment,
} from '../logic';
import { buildGoalView } from './goalView';
import styles from './panels.module.css';

/** Moyenne de calories des jours récents du journal alimentaire (`undefined` pendant le chargement). */
function useRecentCalories(enabled: boolean, today: string): number | null | undefined {
  const rows = useLiveQuery(
    async () => (enabled ? Promise.all([foodRepo.list(), foodLogEntryRepo.list()]) : null),
    [enabled],
  );
  return useMemo(() => {
    if (!enabled) return null;
    if (!rows) return undefined;
    const [foods, entries] = rows;
    const daily = dailyCalories(entries, new Map(foods.map((f) => [f.id, f])));
    return recentDailyAverage(daily, today);
  }, [enabled, rows, today]);
}

export function GoalsPanel({ data }: { data: TrackingData }) {
  const [sheet, setSheet] = useState<{ goal: Goal | null } | null>(null);

  const hasCalorieGoal = data.goals.some((g) => g.type === 'calories');
  const calorieAverage = useRecentCalories(hasCalorieGoal, data.today);

  const sessionCounts = useMemo(() => {
    const perExercise = new Map<string, Set<string>>();
    for (const set of data.sets) {
      if (set.isWarmup || !data.sessionDays.has(set.sessionId)) continue;
      const list = perExercise.get(set.exerciseId) ?? new Set<string>();
      list.add(set.sessionId);
      perExercise.set(set.exerciseId, list);
    }
    return new Map([...perExercise].map(([id, list]) => [id, list.size]));
  }, [data.sets, data.sessionDays]);

  const views = useMemo(() => {
    const built = data.goals.map((goal) => buildGoalView(goal, data));
    // Les objectifs en cours d'abord (récents en premier), ceux déjà atteints ensuite.
    const done = (v: (typeof built)[number]) => v.assessment?.reached === true;
    return built.sort(
      (a, b) =>
        Number(done(a)) - Number(done(b)) || b.goal.createdAt.localeCompare(a.goal.createdAt),
    );
  }, [data]);

  const open = (goal: Goal | null) => setSheet({ goal });

  return (
    <div className={styles.panel}>
      {views.length === 0 ? (
        <Card>
          <EmptyState
            icon="tracking"
            title="Fixe-toi un cap"
            message="Un poids à atteindre, une charge à soulever, une mensuration à gagner : on suit ta progression et on estime quand tu y arrives."
            action={<Button onClick={() => open(null)}>Créer un objectif</Button>}
          />
        </Card>
      ) : (
        <>
          <Button block onClick={() => open(null)}>
            Nouvel objectif
          </Button>
          {views.map((view) => {
            const calories: CalorieAssessment | undefined =
              view.goal.type === 'calories' && calorieAverage !== undefined
                ? assessCalorieGoal(calorieAverage, view.goal.targetValue)
                : undefined;
            return (
              <GoalCard
                key={view.goal.id}
                view={view}
                today={data.today}
                calories={calories}
                onEdit={() => open(view.goal)}
              />
            );
          })}
        </>
      )}

      <GoalSheet
        key={sheet?.goal?.id ?? 'new'}
        open={sheet !== null}
        onClose={() => setSheet(null)}
        data={data}
        goal={sheet?.goal ?? null}
        sessionCounts={sessionCounts}
      />
    </div>
  );
}
