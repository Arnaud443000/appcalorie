import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { foodLogEntryRepo, foodRepo, formatNumber, goalRepo } from '@/data';
import { Button, Card, EmptyState, Screen, Stat, Tabs } from '@/ui';
import { BarChart } from '../components/BarChart';
import { NutritionTabs } from '../components/NutritionTabs';
import {
  addDays,
  barsOf,
  dayTitle,
  effectiveMacroTargets,
  goalRatio,
  lastDays,
  loadMacroTargets,
  summarizeWeek,
  todayDay,
  totalsOf,
  type DayTotals,
  type Nutrition,
} from '../logic';
import styles from './WeekScreen.module.css';

const METRICS = [
  { id: 'kcal', label: 'Calories' },
  { id: 'proteinG', label: 'Protéines' },
] as const;

type Metric = (typeof METRICS)[number]['id'];

/** Résumé hebdomadaire : moyennes sur 7 jours, graphique en barres, jours sans saisie (#/nutrition/semaine). */
export function WeekScreen() {
  const [endDay, setEndDay] = useState(todayDay);
  const [metric, setMetric] = useState<Metric>('kcal');
  const days = lastDays(endDay, 7);
  const first = days[0] ?? endDay;

  const entries = useLiveQuery(() => foodLogEntryRepo.list(), []);
  const foodList = useLiveQuery(() => foodRepo.list(), []);
  const goals = useLiveQuery(() => goalRepo.findBy('type', 'calories'), []);

  const header = (
    <Screen title="Nutrition">
      <div className={styles.page}>
        <NutritionTabs current="semaine" />
      </div>
    </Screen>
  );
  if (!entries || !foodList || !goals) return header;

  const foods = new Map(foodList.map((food) => [food.id, food]));
  const perDay: DayTotals[] = days.map((day) => {
    const ofDay = entries.filter((e) => e.date === day && foods.has(e.foodId));
    return { day, entryCount: ofDay.length, totals: totalsOf(ofDay, foods) };
  });
  const summary = summarizeWeek(perDay);
  const goalKcal =
    [...goals].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.targetValue ?? null;
  const targets = effectiveMacroTargets(loadMacroTargets(), goalKcal);
  const goal = metric === 'kcal' ? goalKcal : (targets?.proteinG ?? null);
  const pick = (n: Nutrition) => n[metric];
  const unit = metric === 'kcal' ? 'kcal' : 'g';
  const isCurrent = endDay >= todayDay();
  const range = `${dayTitle(first, '')} au ${dayTitle(endDay, '')}`;

  return (
    <Screen title="Nutrition">
      <div className={styles.page}>
        <NutritionTabs current="semaine" />

        <div className={styles.nav}>
          <Button
            variant="secondary"
            aria-label="Semaine précédente"
            onClick={() => setEndDay(addDays(endDay, -7))}
          >
            ←
          </Button>
          <p className={styles.range}>{isCurrent ? '7 derniers jours' : range}</p>
          <Button
            variant="secondary"
            aria-label="Semaine suivante"
            disabled={isCurrent}
            onClick={() => setEndDay(addDays(endDay, 7))}
          >
            →
          </Button>
        </div>

        {summary.loggedDays === 0 ? (
          <EmptyState
            icon="nutrition"
            title="Rien de saisi sur cette période"
            message="Ajoute des aliments dans ton journal : la moyenne et le graphique apparaîtront ici."
          />
        ) : (
          <>
            <Card className={styles.stats} aria-label="Moyennes">
              <Stat
                label="Calories par jour"
                value={formatNumber(summary.averageKcal ?? 0)}
                unit="kcal"
              />
              <Stat
                label="Protéines par jour"
                value={formatNumber(summary.averageProteinG ?? 0)}
                unit="g"
              />
              <p className={styles.note}>
                Moyenne sur les {summary.loggedDays} jour{summary.loggedDays > 1 ? 's' : ''} saisi
                {summary.loggedDays > 1 ? 's' : ''} (les jours sans saisie ne comptent pas).
              </p>
            </Card>

            <Tabs
              label="Nutriment du graphique"
              items={METRICS}
              value={metric}
              onChange={setMetric}
            />
            <Card>
              <BarChart
                bars={barsOf(perDay, pick, goal)}
                goalRatio={goalRatio(perDay, pick, goal)}
                unit={unit}
                label={`${metric === 'kcal' ? 'Calories' : 'Protéines'} par jour sur 7 jours`}
              />
              {goal !== null && (
                <p className={styles.note}>
                  Ligne pointillée : {metric === 'kcal' ? 'objectif' : 'repère'} de{' '}
                  {formatNumber(goal)} {unit}.
                </p>
              )}
            </Card>
          </>
        )}

        {summary.missingDays.length > 0 && (
          <Card aria-label="Jours sans saisie">
            <h2 className={styles.title}>Jours sans saisie</h2>
            <ul className={styles.missing}>
              {summary.missingDays.map((day) => (
                <li key={day}>{dayTitle(day)}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Screen>
  );
}
