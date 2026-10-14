import { useMemo, useState } from 'react';
import { formatNumber } from '@/data';
import { Card, EmptyState, ListRow, Stat } from '@/ui';
import { CompareTool } from '../components/CompareTool';
import { LineChart } from '../components/LineChart';
import { PeriodChips } from '../components/PeriodChips';
import { QuickEntry } from '../components/QuickEntry';
import { ValueEditSheet, type ValueEntry } from '../components/ValueEditSheet';
import { removeBodyValue, saveBodyValues, updateBodyValue } from '../data/bodyService';
import type { TrackingData } from '../data/useTrackingData';
import { formatDelta, formatStored, toChartPoints, weightQuantity } from '../format';
import {
  bodySeries,
  filterPeriod,
  formatLongDay,
  formatSigned,
  patchFor,
  periodStart,
  relativeDayLabel,
  rollingAverage,
  trend,
  variation,
  type PeriodId,
} from '../logic';
import styles from './panels.module.css';

const WEIGHT_RANGE = [20, 500] as const;
const HISTORY_PREVIEW = 6;

const PERIOD_PHRASE: Record<PeriodId, string> = {
  '7d': 'sur 7 jours',
  '30d': 'sur 30 jours',
  '3m': 'sur 3 mois',
  '6m': 'sur 6 mois',
  '1y': 'sur 1 an',
  all: 'depuis le début',
};

export function WeightPanel({ data }: { data: TrackingData }) {
  const { today, weightUnit } = data;
  const quantity = useMemo(() => weightQuantity(weightUnit), [weightUnit]);
  const [period, setPeriod] = useState<PeriodId>('3m');
  const [editing, setEditing] = useState<ValueEntry | null>(null);
  const [showAll, setShowAll] = useState(false);

  const weights = useMemo(() => bodySeries(data.metrics, 'weight'), [data.metrics]);
  const average = useMemo(() => rollingAverage(weights), [weights]);
  const windowed = useMemo(() => filterPeriod(weights, period, today), [weights, period, today]);
  const windowedAverage = useMemo(
    () => filterPeriod(average, period, today),
    [average, period, today],
  );

  const goal = useMemo(() => {
    const goals = data.goals
      .filter((g) => g.type === 'weight')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return goals[0] ?? null;
  }, [data.goals]);

  const last = weights[weights.length - 1] ?? null;
  const change = variation(windowed);
  // En dessous de 100 g par semaine, le poids est considéré comme stable.
  const slope = trend(windowed, 0.1);
  const recentAverage = windowedAverage[windowedAverage.length - 1];
  const start = periodStart(period, today) ?? weights[0]?.date ?? today;

  const history = useMemo(() => [...weights].reverse(), [weights]);
  const shownHistory = showAll ? history : history.slice(0, HISTORY_PREVIEW);

  const chartSeries = [
    {
      id: 'weight',
      name: 'Poids',
      points: toChartPoints(windowed, quantity),
      variant: 'main' as const,
    },
    ...(windowed.length >= 3
      ? [
          {
            id: 'average',
            name: 'Moyenne 7 jours',
            points: toChartPoints(windowedAverage, quantity),
            variant: 'average' as const,
          },
        ]
      : []),
  ];

  return (
    <div className={styles.panel}>
      <Card>
        <h2 className={styles.cardTitle}>Ajouter une pesée</h2>
        <QuickEntry
          label="Poids"
          quantity={quantity}
          lastValue={last?.value ?? null}
          today={today}
          range={WEIGHT_RANGE}
          savedMessage="Pesée enregistrée"
          onSave={(date, kg) => saveBodyValues(date, patchFor('weight', kg))}
        />
      </Card>

      {weights.length === 0 ? (
        <Card>
          <EmptyState
            icon="tracking"
            title="Ta première pesée"
            message="Enregistre ton poids ci-dessus : ta courbe, ta moyenne sur 7 jours et ta tendance apparaîtront ici."
          />
        </Card>
      ) : (
        <>
          <Card>
            <div className={styles.stack}>
              <PeriodChips value={period} onChange={setPeriod} />
              <div className={styles.stats}>
                <Stat
                  label="Actuel"
                  value={last ? formatNumber(quantity.toDisplay(last.value)) : '—'}
                  unit={quantity.unit}
                />
                <Stat
                  label="Variation"
                  value={
                    change ? formatSigned(quantity.toDisplay(change.delta), formatNumber) : '—'
                  }
                  unit={change ? quantity.unit : undefined}
                />
                <Stat
                  label="Moyenne 7 j"
                  value={
                    recentAverage ? formatNumber(quantity.toDisplay(recentAverage.value)) : '—'
                  }
                  unit={recentAverage ? quantity.unit : undefined}
                />
              </div>
              <p className={styles.trend}>
                {last && `Dernière pesée ${relativeDayLabel(last.date, today)}`}
                {change
                  ? ` · variation ${PERIOD_PHRASE[period]}`
                  : ' · pas assez de pesées sur cette période pour une variation'}
                .
              </p>
              <p className={styles.trend}>
                {slope
                  ? `Tendance : ${
                      slope.direction === 'stable'
                        ? 'stable'
                        : slope.direction === 'down'
                          ? 'en baisse'
                          : 'en hausse'
                    } (${formatDelta(quantity, slope.perWeek)} par semaine).`
                  : 'Tendance : il faut au moins deux pesées espacées de quelques jours.'}
              </p>
              <LineChart
                title="Courbe de poids"
                series={chartSeries}
                goal={
                  goal
                    ? {
                        value: quantity.toDisplay(goal.targetValue),
                        label: `Objectif ${formatStored(quantity, goal.targetValue)}`,
                      }
                    : null
                }
                formatValue={quantity.formatDisplay}
                formatAxis={quantity.formatAxis}
                domain={[start, today]}
                emptyMessage="Aucune pesée sur cette période. Choisis « Tout » pour voir l’ensemble."
              />
            </div>
          </Card>

          <Card>
            <CompareTool points={weights} quantity={quantity} today={today} subject="ton poids" />
          </Card>

          <Card flush>
            <div className={styles.sectionHead}>
              <h2>Historique</h2>
              <span className={styles.muted}>{weights.length} pesées</span>
            </div>
            <ul className={styles.list}>
              {shownHistory.map((point, index) => {
                const before = history[index + 1];
                return (
                  <li key={point.date}>
                    <ListRow
                      title={formatStored(quantity, point.value)}
                      subtitle={formatLongDay(point.date)}
                      trailing={
                        before ? (
                          <span className={styles.delta}>
                            {formatDelta(quantity, point.value - before.value)}
                          </span>
                        ) : undefined
                      }
                      onClick={() => setEditing({ date: point.date, value: point.value })}
                    />
                  </li>
                );
              })}
            </ul>
            {history.length > HISTORY_PREVIEW && (
              <button type="button" className={styles.more} onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Voir moins' : `Voir tout l’historique (${history.length})`}
              </button>
            )}
          </Card>
        </>
      )}

      <ValueEditSheet
        entry={editing}
        title="Modifier la pesée"
        label="Poids"
        quantity={quantity}
        today={today}
        range={WEIGHT_RANGE}
        onClose={() => setEditing(null)}
        onSave={(entry, previousDate) =>
          updateBodyValue('weight', previousDate, entry.date, entry.value)
        }
        onDelete={(date) => removeBodyValue(date, 'weight')}
      />
    </div>
  );
}
