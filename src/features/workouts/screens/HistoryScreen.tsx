import { useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  dayFromDate,
  formatDay,
  formatDuration,
  formatMonth,
  formatWeight,
  sessionVolume,
  type SetEntry,
  workingSets,
  type WorkoutSession,
} from '@/data';
import { Button, Card, Chip, EmptyState, ListRow, Screen, Tabs } from '@/ui';
import { loadEverything } from '../data';
import { sessionPath } from '../paths';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { buildMonthGrid, groupSessionsByDay } from '../logic';
import styles from './HistoryScreen.module.css';

type View = 'list' | 'calendar';
const VIEWS = [
  { id: 'list', label: 'Liste' },
  { id: 'calendar', label: 'Calendrier' },
] as const;

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function HistoryScreen() {
  const data = useLiveQuery(loadEverything, []);
  const [view, setView] = useState<View>('list');
  const unit = useWeightUnit();

  const setsBySession = useMemo(() => {
    const map = new Map<string, SetEntry[]>();
    for (const set of data?.sets ?? []) {
      const list = map.get(set.sessionId);
      if (list) list.push(set);
      else map.set(set.sessionId, [set]);
    }
    return map;
  }, [data]);

  const sessions = useMemo(
    () => [...(data?.sessions ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [data],
  );

  function row(session: WorkoutSession) {
    const sets = setsBySession.get(session.id) ?? [];
    const count = workingSets(sets).length;
    const volume = sessionVolume(sets);
    const duration = session.endedAt
      ? formatDuration(
          (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000,
        )
      : null;
    const parts = [
      `${count} série${count > 1 ? 's' : ''}`,
      volume > 0 ? formatWeight(volume, unit) : null,
      duration,
    ].filter(Boolean);
    return (
      <ListRow
        key={session.id}
        to={sessionPath(session)}
        title={session.name || 'Séance libre'}
        subtitle={`${formatDay(session.startedAt)} · ${parts.join(' · ')}`}
        trailing={session.endedAt === null ? <Chip>En cours</Chip> : undefined}
      />
    );
  }

  return (
    <Screen title="Historique" backTo="/entrainement">
      <Tabs items={VIEWS} value={view} onChange={setView} label="Affichage de l’historique" />
      {data && sessions.length === 0 ? (
        <EmptyState
          icon="workout"
          title="Aucune séance"
          message="Tes séances terminées apparaîtront ici."
        />
      ) : view === 'list' ? (
        <Card flush>{sessions.map(row)}</Card>
      ) : (
        <CalendarView sessions={sessions} renderRow={row} />
      )}
    </Screen>
  );
}

function CalendarView({
  sessions,
  renderRow,
}: {
  sessions: WorkoutSession[];
  renderRow: (session: WorkoutSession) => ReactNode;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<string>(dayFromDate(today));
  const byDay = useMemo(() => groupSessionsByDay(sessions), [sessions]);
  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  function shift(delta: number) {
    const date = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  }

  const daySessions = byDay.get(selected) ?? [];
  const todayKey = dayFromDate(today);

  return (
    <>
      <div className={styles.monthBar}>
        <Button variant="secondary" aria-label="Mois précédent" onClick={() => shift(-1)}>
          ‹
        </Button>
        <h2 className={styles.month} aria-live="polite">
          {formatMonth(cursor.year, cursor.month)}
        </h2>
        <Button variant="secondary" aria-label="Mois suivant" onClick={() => shift(1)}>
          ›
        </Button>
      </div>
      <div className={styles.grid} role="grid" aria-label="Calendrier des séances">
        <div className={styles.weekdays} role="row">
          {WEEKDAYS.map((d, i) => (
            <span key={i} role="columnheader" className={styles.weekday}>
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]?.day} className={styles.week} role="row">
            {week.map((cell) => {
              const count = byDay.get(cell.day)?.length ?? 0;
              return (
                <button
                  key={cell.day}
                  type="button"
                  role="gridcell"
                  className={[
                    styles.day,
                    !cell.inMonth && styles.outside,
                    count > 0 && styles.has,
                    cell.day === todayKey && styles.today,
                    cell.day === selected && styles.selected,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-selected={cell.day === selected}
                  aria-label={`${cell.dayOfMonth}${count > 0 ? `, ${count} séance${count > 1 ? 's' : ''}` : ''}`}
                  onClick={() => setSelected(cell.day)}
                >
                  {cell.dayOfMonth}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <section aria-label="Séances du jour sélectionné" className={styles.dayList}>
        {daySessions.length === 0 ? (
          <p className={styles.muted}>Pas de séance ce jour-là.</p>
        ) : (
          <Card flush>{daySessions.map(renderRow)}</Card>
        )}
      </section>
    </>
  );
}
