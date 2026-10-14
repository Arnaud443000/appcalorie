import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { formatNumber } from '@/data';
import {
  describeSeries,
  formatShortDay,
  formatShortDayYear,
  nearestIndex,
  niceScale,
  timeTicks,
  xPosition,
  type Day,
} from '../logic';
import styles from './LineChart.module.css';

export interface ChartPoint {
  date: Day;
  value: number;
  /** Texte de date à la place du jour (ex. « Semaine du 6 oct. »). */
  label?: string;
}

export interface ChartSeries {
  id: string;
  /** Nom affiché dans la légende et le tableau. */
  name: string;
  points: readonly ChartPoint[];
  /** `main` : la courbe principale (points, survol) ; `average` : courbe de lissage en second plan. */
  variant?: 'main' | 'average';
}

export interface ChartGoal {
  value: number;
  label: string;
}

export interface LineChartProps {
  /** Nom de la courbe, lu par les lecteurs d'écran et affiché au-dessus. */
  title: string;
  series: readonly ChartSeries[];
  goal?: ChartGoal | null;
  /** Valeur avec son unité : « 80,2 kg ». */
  formatValue: (value: number) => string;
  /** Valeur sur l'axe (sans unité) ; `formatNumber` par défaut. */
  formatAxis?: (value: number) => string;
  /** « mesure », « séance »… pour la description. */
  noun?: string;
  /** Jours affichés sur l'axe horizontal (par défaut : de la première à la dernière valeur). */
  domain?: readonly [Day, Day];
  /** Message quand il n'y a aucune valeur. */
  emptyMessage: string;
  height?: number;
}

const DEFAULT_WIDTH = 340;
const MARGIN = { top: 14, right: 16, bottom: 26 };
const MAX_DOTS = 45;
const MAX_TABLE_ROWS = 120;

/** Largeur du conteneur, suivie quand l'écran tourne ou se redimensionne. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const next = Math.round(element.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/**
 * Courbe en SVG, sans dépendance : axes lisibles, courbe, points, ligne d'objectif, survol ou
 * toucher (la valeur et la date s'affichent au-dessus de la courbe, hors de portée du doigt),
 * flèches du clavier, et un tableau de repli pour les lecteurs d'écran.
 */
export function LineChart({
  title,
  series,
  goal = null,
  formatValue,
  formatAxis = formatNumber,
  noun = 'mesure',
  domain,
  emptyMessage,
  height = 220,
}: LineChartProps) {
  const id = useId();
  const { ref: plotRef, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

  const visible = useMemo(() => series.filter((s) => s.points.length > 0), [series]);
  const main = visible.find((s) => (s.variant ?? 'main') === 'main') ?? visible[0];
  const mainPoints = useMemo(() => main?.points ?? [], [main]);

  const geometry = useMemo(() => {
    if (!main) return null;
    const values = visible.flatMap((s) => s.points.map((p) => p.value));
    if (goal) values.push(goal.value);
    const y = niceScale(Math.min(...values), Math.max(...values));
    const yLabels = y.ticks.map(formatAxis);
    const left = Math.min(72, Math.max(34, Math.max(...yLabels.map((l) => l.length)) * 7 + 12));
    const days = visible.flatMap((s) => [s.points[0]?.date, s.points[s.points.length - 1]?.date]);
    const dates = days.filter((d): d is Day => Boolean(d)).sort();
    const start = domain?.[0] ?? dates[0] ?? '';
    const end = domain?.[1] ?? dates[dates.length - 1] ?? start;
    const plotW = Math.max(40, width - left - MARGIN.right);
    const plotH = height - MARGIN.top - MARGIN.bottom;
    const px = (day: Day) => xPosition(day, start, end, left, left + plotW);
    const py = (value: number) => MARGIN.top + (1 - (value - y.min) / (y.max - y.min || 1)) * plotH;
    const xTicks = timeTicks(start, end, Math.max(2, Math.min(5, Math.floor(plotW / 56))));
    const paths = visible.map((s) => ({
      id: s.id,
      variant: s.variant ?? 'main',
      d: s.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.date).toFixed(1)},${py(p.value).toFixed(1)}`)
        .join(''),
    }));
    return { y, yLabels, left, right: left + plotW, plotH, px, py, xTicks, paths, start, end };
  }, [visible, main, goal, formatAxis, domain, width, height]);

  const mainXs = useMemo(
    () => (geometry ? mainPoints.map((p) => geometry.px(p.date)) : []),
    [geometry, mainPoints],
  );

  const activeIndex = active !== null && active < mainPoints.length ? active : null;
  const shownIndex = activeIndex ?? mainPoints.length - 1;
  const shown = mainPoints[shownIndex];

  const pick = useCallback(
    (event: PointerEvent<SVGRectElement>) => {
      const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
      if (!box) return;
      const index = nearestIndex(mainXs, event.clientX - box.left);
      if (index >= 0) setActive(index);
    },
    [mainXs],
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = mainPoints.length - 1;
    if (last < 0) return;
    const current = activeIndex ?? last;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = Math.max(0, current - 1);
    else if (event.key === 'ArrowRight') next = Math.min(last, current + 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else if (event.key === 'Escape') setActive(null);
    if (next !== null) {
      event.preventDefault();
      setActive(next);
    }
  }

  const description = describeSeries(mainPoints, formatValue, noun);
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const readoutId = `${id}-readout`;
  const tableId = `${id}-table`;

  const secondary = visible.filter((s) => s !== main);
  const secondaryAt = (date: Day) =>
    secondary
      .map((s) => ({ name: s.name, point: s.points.find((p) => p.date === date) }))
      .filter((s): s is { name: string; point: ChartPoint } => Boolean(s.point));

  const tableRows = [...mainPoints].reverse().slice(0, MAX_TABLE_ROWS);

  return (
    <figure className={styles.figure} aria-labelledby={titleId} aria-describedby={descriptionId}>
      <figcaption id={titleId} className={styles.title}>
        {title}
      </figcaption>
      <p id={descriptionId} className={styles.srOnly}>
        {description}
      </p>

      {!main || !geometry ? (
        <p className={styles.empty} style={{ minHeight: height }}>
          {emptyMessage}
        </p>
      ) : (
        <>
          <div id={readoutId} className={styles.readout} aria-live="polite" aria-atomic="true">
            {shown && (
              <>
                <span className={styles.readoutDate}>
                  {activeIndex === null && 'Dernière valeur · '}
                  {shown.label ?? formatShortDayYear(shown.date)}
                </span>
                <span className={styles.readoutValue}>{formatValue(shown.value)}</span>
                {secondaryAt(shown.date).map((s) => (
                  <span key={s.name} className={styles.readoutExtra}>
                    {s.name} : {formatValue(s.point.value)}
                  </span>
                ))}
              </>
            )}
          </div>

          <div
            ref={plotRef}
            className={styles.plot}
            tabIndex={0}
            role="group"
            aria-label={`${title}. Flèches gauche et droite pour parcourir les valeurs.`}
            aria-describedby={`${descriptionId} ${readoutId}`}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
          >
            <svg
              className={styles.svg}
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              aria-hidden="true"
              focusable="false"
            >
              {geometry.y.ticks.map((tick, i) => (
                <g key={tick}>
                  <line
                    className={styles.grid}
                    x1={geometry.left}
                    x2={geometry.right}
                    y1={geometry.py(tick)}
                    y2={geometry.py(tick)}
                  />
                  <text
                    className={styles.axisText}
                    x={geometry.left - 8}
                    y={geometry.py(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                  >
                    {geometry.yLabels[i]}
                  </text>
                </g>
              ))}
              {geometry.xTicks.map((tick, i) => {
                const x = geometry.px(tick.date);
                const anchor =
                  geometry.xTicks.length === 1
                    ? 'middle'
                    : i === 0 && x < geometry.left + 20
                      ? 'start'
                      : 'middle';
                return (
                  <text
                    key={tick.date}
                    className={styles.axisText}
                    x={x}
                    y={height - 6}
                    textAnchor={anchor}
                  >
                    {tick.label}
                  </text>
                );
              })}

              {goal && (
                <g>
                  <line
                    className={styles.goalLine}
                    x1={geometry.left}
                    x2={geometry.right}
                    y1={geometry.py(goal.value)}
                    y2={geometry.py(goal.value)}
                  />
                  <text
                    className={styles.goalText}
                    x={geometry.right}
                    y={geometry.py(goal.value) - 5}
                    textAnchor="end"
                  >
                    {goal.label}
                  </text>
                </g>
              )}

              {geometry.paths
                .filter((p) => p.variant === 'average')
                .map((p) => (
                  <path key={p.id} d={p.d} className={styles.average} />
                ))}
              {geometry.paths
                .filter((p) => p.variant === 'main')
                .map((p) => (
                  <path key={p.id} d={p.d} className={styles.line} />
                ))}

              {main.points.length <= MAX_DOTS &&
                main.points.map((p) => (
                  <circle
                    key={p.date}
                    className={styles.dot}
                    cx={geometry.px(p.date)}
                    cy={geometry.py(p.value)}
                    r={3.5}
                  />
                ))}
              {main.points.length > MAX_DOTS && shown && activeIndex === null && (
                <circle
                  className={styles.dot}
                  cx={geometry.px(shown.date)}
                  cy={geometry.py(shown.value)}
                  r={3.5}
                />
              )}

              {activeIndex !== null && shown && (
                <g>
                  <line
                    className={styles.guide}
                    x1={geometry.px(shown.date)}
                    x2={geometry.px(shown.date)}
                    y1={MARGIN.top}
                    y2={MARGIN.top + geometry.plotH}
                  />
                  <circle
                    className={styles.dotActive}
                    cx={geometry.px(shown.date)}
                    cy={geometry.py(shown.value)}
                    r={6}
                  />
                </g>
              )}

              <rect
                className={styles.hit}
                x={geometry.left}
                y={0}
                width={Math.max(0, geometry.right - geometry.left)}
                height={height - MARGIN.bottom}
                onPointerDown={pick}
                onPointerMove={(event) => {
                  // Souris : suit le survol. Doigt : suit le glissement (le défilement vertical reste libre).
                  if (event.pointerType === 'mouse' || event.buttons > 0) pick(event);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === 'mouse') setActive(null);
                }}
              />
            </svg>
          </div>

          {mainPoints.length === 1 && (
            <p className={styles.note}>
              Une seule valeur pour l’instant : ajoute-en une autre pour voir la courbe.
            </p>
          )}

          {(secondary.length > 0 || goal) && (
            <ul className={styles.legend}>
              <li>
                <span className={`${styles.swatch} ${styles.swatchMain}`} aria-hidden="true" />
                {main.name}
              </li>
              {secondary.map((s) => (
                <li key={s.id}>
                  <span className={`${styles.swatch} ${styles.swatchAverage}`} aria-hidden="true" />
                  {s.name}
                </li>
              ))}
              {goal && (
                <li>
                  <span className={`${styles.swatch} ${styles.swatchGoal}`} aria-hidden="true" />
                  {goal.label}
                </li>
              )}
            </ul>
          )}

          <button
            type="button"
            className={styles.tableToggle}
            aria-expanded={tableOpen}
            aria-controls={tableId}
            onClick={() => setTableOpen((open) => !open)}
          >
            {tableOpen ? 'Masquer le tableau' : 'Afficher le tableau'}
          </button>
          {tableOpen && (
            <div id={tableId} className={styles.tableWrap} tabIndex={0}>
              <table className={styles.table}>
                <caption className={styles.srOnly}>
                  {title}, du plus récent au plus ancien
                  {mainPoints.length > MAX_TABLE_ROWS && ` (${MAX_TABLE_ROWS} dernières valeurs)`}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">{main.name}</th>
                    {secondary.map((s) => (
                      <th key={s.id} scope="col">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((p) => (
                    <tr key={p.date}>
                      <th scope="row">{p.label ?? formatShortDay(p.date)}</th>
                      <td>{formatValue(p.value)}</td>
                      {secondary.map((s) => {
                        const other = s.points.find((q) => q.date === p.date);
                        return <td key={s.id}>{other ? formatValue(other.value) : '—'}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </figure>
  );
}
