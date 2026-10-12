import { formatNumber } from '@/data';
import { weekdayShort, type Bar } from '../logic';
import styles from './BarChart.module.css';

export interface BarChartProps {
  bars: Bar[];
  /** Position (0 à 1) de la ligne d'objectif, ou `null`. */
  goalRatio: number | null;
  unit: string;
  /** Description lue par les lecteurs d'écran. */
  label: string;
}

const WIDTH = 320;
const HEIGHT = 180;
const TOP = 12;
const BOTTOM = 28;
const PLOT = HEIGHT - TOP - BOTTOM;

/** Petit graphique en barres en SVG (une barre par jour ; jour sans saisie = repère vide). */
export function BarChart({ bars, goalRatio, unit, label }: BarChartProps) {
  const slot = WIDTH / Math.max(1, bars.length);
  const barWidth = slot * 0.6;
  const y = (ratio: number) => TOP + PLOT * (1 - ratio);
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      <line className={styles.axis} x1={0} x2={WIDTH} y1={y(0)} y2={y(0)} />
      {goalRatio !== null && (
        <line className={styles.goal} x1={0} x2={WIDTH} y1={y(goalRatio)} y2={y(goalRatio)} />
      )}
      {bars.map((bar, index) => {
        const x = index * slot + (slot - barWidth) / 2;
        const height = Math.max(bar.value > 0 ? 2 : 0, PLOT * bar.ratio);
        return (
          <g key={bar.day}>
            {bar.missing ? (
              <rect
                className={styles.missing}
                x={x}
                y={y(0) - 6}
                width={barWidth}
                height={6}
                rx={2}
              />
            ) : (
              <>
                <rect
                  className={styles.bar}
                  x={x}
                  y={y(0) - height}
                  width={barWidth}
                  height={height}
                  rx={3}
                />
                <text className={styles.value} x={x + barWidth / 2} y={y(0) - height - 4}>
                  {formatNumber(Math.round(bar.value))}
                </text>
              </>
            )}
            <text className={styles.day} x={x + barWidth / 2} y={HEIGHT - 8}>
              {weekdayShort(bar.day)}
            </text>
          </g>
        );
      })}
      <text className={styles.unit} x={WIDTH - 2} y={10}>
        {unit}
      </text>
    </svg>
  );
}
