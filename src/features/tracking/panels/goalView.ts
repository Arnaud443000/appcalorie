import { labelOf, localDay, MEASUREMENTS, type Goal } from '@/data';
import {
  calorieQuantity,
  formatStored,
  lengthQuantity,
  weightQuantity,
  type Quantity,
} from '../format';
import type { TrackingData } from '../data/useTrackingData';
import {
  assessGoal,
  bodySeries,
  exerciseSessionStats,
  metricSeries,
  runningMax,
  type GoalAssessment,
  type SeriesPoint,
} from '../logic';

export interface GoalView {
  goal: Goal;
  /** « Poids », « Développé couché », « Tour de taille »… */
  title: string;
  quantity: Quantity;
  /** Texte de la cible : « 75 kg ». */
  targetText: string;
  assessment: GoalAssessment | null;
  /** Mesures utilisées pour juger l'objectif. */
  series: SeriesPoint[];
  /** Que faire quand il n'y a pas encore de mesure. */
  missingHint: string;
}

export function measurementLabel(measurement: Goal['measurement']): string {
  if (measurement === 'waist') return 'Tour de taille';
  return measurement ? labelOf(MEASUREMENTS, measurement) : 'Mensuration';
}

/**
 * Prépare l'affichage d'un objectif : nom, unité, mesures suivies et évaluation.
 * Les objectifs de calories n'ont pas d'évaluation ici (voir `assessCalorieGoal`).
 */
export function buildGoalView(goal: Goal, data: TrackingData): GoalView {
  const { today } = data;
  const createdDay = localDay(goal.createdAt);

  let title: string;
  let quantity: Quantity;
  let series: SeriesPoint[] = [];
  let missingHint: string;

  switch (goal.type) {
    case 'weight':
      title = 'Poids';
      quantity = weightQuantity(data.weightUnit);
      series = bodySeries(data.metrics, 'weight');
      missingHint = 'Ajoute une pesée dans l’onglet Poids pour suivre cet objectif.';
      break;
    case 'measurement':
      title = measurementLabel(goal.measurement);
      quantity = lengthQuantity(data.lengthUnit);
      series = goal.measurement ? bodySeries(data.metrics, goal.measurement) : [];
      missingHint = 'Ajoute une mesure dans l’onglet Mensurations pour suivre cet objectif.';
      break;
    case 'load': {
      const exercise = goal.exerciseId ? data.exerciseById.get(goal.exerciseId) : undefined;
      title = exercise?.name ?? 'Exercice supprimé';
      quantity = weightQuantity(data.weightUnit);
      if (goal.exerciseId) {
        const sets = data.sets.filter((s) => s.exerciseId === goal.exerciseId);
        // La charge la plus lourde atteinte jusque-là : ne redescend jamais.
        series = runningMax(
          metricSeries(exerciseSessionStats(sets, data.sessionDays), 'maxWeight'),
        );
      }
      missingHint = 'Fais une séance avec cet exercice pour suivre cet objectif.';
      break;
    }
    case 'calories':
      title = 'Calories par jour';
      quantity = calorieQuantity;
      missingHint = 'Note tes repas dans l’onglet Nutrition pour suivre cet objectif.';
      break;
  }

  const assessment =
    goal.type === 'calories'
      ? null
      : assessGoal({
          series,
          target: goal.targetValue,
          targetDate: goal.targetDate,
          createdDay,
          today,
        });

  return {
    goal,
    title,
    quantity,
    targetText: formatStored(quantity, goal.targetValue),
    assessment,
    series,
    missingHint,
  };
}
