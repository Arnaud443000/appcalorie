import { useState } from 'react';
import { Chip, Input } from '@/ui';
import { formatShortDayYear } from '../logic';
import { addMonths, compareDays, comparisonLabel, type Day, type SeriesPoint } from '../logic';
import { formatDelta, formatStored, type Quantity } from '../format';
import styles from './CompareTool.module.css';

export interface CompareToolProps {
  /** Mesures triées (valeurs stockées). */
  points: readonly SeriesPoint[];
  quantity: Quantity;
  today: Day;
  /** « Compare ton poids », utilisé dans l’aide. */
  subject?: string;
}

const SHORTCUTS = [
  { id: '1m', label: 'Il y a 1 mois', months: 1 },
  { id: '3m', label: 'Il y a 3 mois', months: 3 },
  { id: '6m', label: 'Il y a 6 mois', months: 6 },
  { id: '1y', label: 'Il y a 1 an', months: 12 },
] as const;

/** Compare deux dates : « Il y a 4 mois : 60 kg → aujourd’hui : 80 kg (+20 kg) ». */
export function CompareTool({
  points,
  quantity,
  today,
  subject = 'cette mesure',
}: CompareToolProps) {
  const first = points[0]?.date ?? today;
  // Par défaut : la plus ancienne mesure, ou il y a 3 mois si l'historique est plus long.
  const defaultFrom = first > addMonths(today, -3) ? first : addMonths(today, -3);
  const [fromInput, setFromInput] = useState<Day | null>(null);
  const [toInput, setToInput] = useState<Day | null>(null);

  const a = fromInput ?? defaultFrom;
  const b = toInput ?? today;
  const [from, to] = a <= b ? [a, b] : [b, a];
  const result = compareDays(points, from, to);

  const sentence =
    result &&
    `${comparisonLabel(from, today)} : ${formatStored(quantity, result.from.point.value)} → ${comparisonLabel(to, today, false)} : ${formatStored(quantity, result.to.point.value)} (${formatDelta(quantity, result.delta)})`;

  return (
    <div className={styles.tool}>
      <h3 className={styles.heading}>Comparer</h3>
      {points.length < 2 ? (
        <p className={styles.hint}>
          Il faut au moins deux mesures pour comparer {subject}. Ajoute-en une autre, puis reviens
          ici.
        </p>
      ) : (
        <>
          <div className={styles.shortcuts} role="group" aria-label="Raccourcis">
            {SHORTCUTS.map((shortcut) => {
              const day = addMonths(today, -shortcut.months);
              return (
                <Chip
                  key={shortcut.id}
                  selected={from === day && to === today}
                  onClick={() => {
                    setFromInput(day);
                    setToInput(today);
                  }}
                >
                  {shortcut.label}
                </Chip>
              );
            })}
          </div>
          <div className={styles.dates}>
            <Input
              label="De"
              type="date"
              value={a}
              max={today}
              onChange={(event) => setFromInput(event.target.value || null)}
            />
            <Input
              label="À"
              type="date"
              value={b}
              max={today}
              onChange={(event) => setToInput(event.target.value || null)}
            />
          </div>
          {result ? (
            <div className={styles.result} aria-live="polite">
              <p className={styles.sentence}>{sentence}</p>
              {result.percent !== null && (
                <p className={styles.sub}>
                  {result.percent > 0 ? '+' : result.percent < 0 ? '−' : ''}
                  {Math.abs(result.percent).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
                  sur la période
                </p>
              )}
              {[result.from, result.to]
                .filter((end) => end.gapDays > 0)
                .map((end) => (
                  <p key={end.requested} className={styles.sub}>
                    Pas de mesure le {formatShortDayYear(end.requested)} : la plus proche date du{' '}
                    {formatShortDayYear(end.point.date)}.
                  </p>
                ))}
            </div>
          ) : (
            <p className={styles.hint} aria-live="polite">
              Ces deux dates tombent sur la même mesure. Choisis des dates plus éloignées.
            </p>
          )}
        </>
      )}
    </div>
  );
}
