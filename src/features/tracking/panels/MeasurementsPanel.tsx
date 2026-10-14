import { useMemo, useState } from 'react';
import { formatNumber } from '@/data';
import { Button, Card, Chip, EmptyState, ListRow, Stat } from '@/ui';
import { CompareTool } from '../components/CompareTool';
import { LineChart } from '../components/LineChart';
import { MeasureSheet } from '../components/MeasureSheet';
import { PeriodChips } from '../components/PeriodChips';
import { QuickEntry } from '../components/QuickEntry';
import { ValueEditSheet, type ValueEntry } from '../components/ValueEditSheet';
import { removeBodyValue, saveBodyValues, updateBodyValue } from '../data/bodyService';
import type { TrackingData } from '../data/useTrackingData';
import { formatDelta, formatStored, lengthQuantity, toChartPoints } from '../format';
import {
  bodySeries,
  filterPeriod,
  formatLongDay,
  formatSigned,
  MEASURE_KEYS,
  patchFor,
  periodStart,
  relativeDayLabel,
  variation,
  type BodyKey,
  type PeriodId,
} from '../logic';
import styles from './panels.module.css';
import measureStyles from './MeasurementsPanel.module.css';

const RANGE = [5, 300] as const;
const HISTORY_PREVIEW = 5;

export function MeasurementsPanel({ data }: { data: TrackingData }) {
  const { today, lengthUnit, metrics } = data;
  const quantity = useMemo(() => lengthQuantity(lengthUnit), [lengthUnit]);
  const [key, setKey] = useState<Exclude<BodyKey, 'weight'>>('waist');
  const [period, setPeriod] = useState<PeriodId>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ValueEntry | null>(null);
  const [showAll, setShowAll] = useState(false);

  const label = MEASURE_KEYS.find((m) => m.id === key)?.label ?? 'Mesure';
  const seriesByKey = useMemo(
    () => new Map(MEASURE_KEYS.map((m) => [m.id, bodySeries(metrics, m.id)])),
    [metrics],
  );
  const series = useMemo(() => seriesByKey.get(key) ?? [], [seriesByKey, key]);
  const lastValues = useMemo(() => {
    const out: Partial<Record<BodyKey, number>> = {};
    for (const [id, points] of seriesByKey) {
      const last = points.at(-1);
      if (last) out[id] = last.value;
    }
    return out;
  }, [seriesByKey]);
  const hasAny = [...seriesByKey.values()].some((points) => points.length > 0);

  const windowed = useMemo(() => filterPeriod(series, period, today), [series, period, today]);
  const change = variation(windowed);
  const last = series.at(-1) ?? null;
  const start = periodStart(period, today) ?? series[0]?.date ?? today;
  const goal = useMemo(
    () =>
      data.goals
        .filter((g) => g.type === 'measurement' && g.measurement === key)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    [data.goals, key],
  );
  const history = useMemo(() => [...series].reverse(), [series]);
  const shownHistory = showAll ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <div className={styles.panel}>
      <Card>
        <div className={styles.stack}>
          <div role="group" aria-label="Mesure" className={measureStyles.chips}>
            {MEASURE_KEYS.map((m) => (
              <Chip
                key={m.id}
                selected={m.id === key}
                onClick={() => {
                  setKey(m.id);
                  setShowAll(false);
                }}
              >
                {m.label}
              </Chip>
            ))}
          </div>
          <h2 className={styles.cardTitle}>Ajouter : {label.toLowerCase()}</h2>
          <QuickEntry
            key={key}
            label={label}
            quantity={quantity}
            lastValue={last?.value ?? null}
            today={today}
            range={RANGE}
            savedMessage="Mesure enregistrée"
            onSave={(date, cm) => saveBodyValues(date, patchFor(key, cm))}
          />
          <Button variant="secondary" block onClick={() => setSheetOpen(true)}>
            Saisir plusieurs mensurations
          </Button>
        </div>
      </Card>

      {!hasAny ? (
        <Card>
          <EmptyState
            icon="tracking"
            title="Tes premières mensurations"
            message="Mesure ton tour de taille, tes bras ou ta poitrine : tu verras l’évolution de chaque mesure ici."
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
                  unit={last ? quantity.unit : undefined}
                />
                <Stat
                  label="Variation"
                  value={
                    change ? formatSigned(quantity.toDisplay(change.delta), formatNumber) : '—'
                  }
                  unit={change ? quantity.unit : undefined}
                />
                <Stat label="Mesures" value={series.length} />
              </div>
              {last && (
                <p className={styles.trend}>
                  Dernière mesure {relativeDayLabel(last.date, today)}.
                </p>
              )}
              <LineChart
                title={label}
                series={[
                  {
                    id: key,
                    name: label,
                    points: toChartPoints(windowed, quantity),
                    variant: 'main',
                  },
                ]}
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
                emptyMessage={
                  series.length === 0
                    ? `Pas encore de mesure « ${label.toLowerCase()} ». Ajoute-en une ci-dessus.`
                    : 'Aucune mesure sur cette période. Choisis « Tout » pour voir l’ensemble.'
                }
              />
            </div>
          </Card>

          <Card>
            <CompareTool
              key={key}
              points={series}
              quantity={quantity}
              today={today}
              subject={`ta mesure « ${label.toLowerCase()} »`}
            />
          </Card>

          {history.length > 0 && (
            <Card flush>
              <div className={styles.sectionHead}>
                <h2>Historique</h2>
                <span className={styles.muted}>{label}</span>
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
          )}
        </>
      )}

      <MeasureSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        today={today}
        quantity={quantity}
        lastValues={lastValues}
        onSave={(date, patch) => saveBodyValues(date, patch)}
      />
      <ValueEditSheet
        entry={editing}
        title={`Modifier : ${label.toLowerCase()}`}
        label={label}
        quantity={quantity}
        today={today}
        range={RANGE}
        onClose={() => setEditing(null)}
        onSave={(entry, previousDate) =>
          updateBodyValue(key, previousDate, entry.date, entry.value)
        }
        onDelete={(date) => removeBodyValue(date, key)}
      />
    </div>
  );
}
