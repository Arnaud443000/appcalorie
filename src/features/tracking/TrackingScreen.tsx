import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { formatNumber, formatRecordValue, RECORD_LABELS, type InputType } from '@/data';
import { Card, Screen, Stat, Tabs, type TabItem } from '@/ui';
import { useTrackingData, type TrackingData } from './data/useTrackingData';
import {
  bodySeries,
  formatSigned,
  recentRecordEvents,
  relativeDayLabel,
  sessionsInLastDays,
  weightSummary,
} from './logic';
import { weightQuantity } from './format';
import { GoalsPanel } from './panels/GoalsPanel';
import { LoadsPanel } from './panels/LoadsPanel';
import { MeasurementsPanel } from './panels/MeasurementsPanel';
import { WeightPanel } from './panels/WeightPanel';
import styles from './TrackingScreen.module.css';

const SECTIONS = [
  { id: 'poids', label: 'Poids' },
  { id: 'charges', label: 'Charges' },
  { id: 'mensurations', label: 'Mesures' },
  { id: 'objectifs', label: 'Objectifs' },
] as const satisfies readonly TabItem<string>[];

type SectionId = (typeof SECTIONS)[number]['id'];

const isSection = (value: string | null): value is SectionId =>
  SECTIONS.some((section) => section.id === value);

/** Chiffres clés en haut de l'onglet : poids, variation sur 30 jours, séances, dernier record. */
function Summary({ data }: { data: TrackingData }) {
  const { today, weightUnit, sets, sessionDays, exerciseById } = data;
  const quantity = weightQuantity(weightUnit);

  const summary = useMemo(
    () => weightSummary(bodySeries(data.metrics, 'weight'), today),
    [data.metrics, today],
  );

  const sessionCount = useMemo(() => {
    // Une séance compte si elle contient au moins une série de travail.
    const withSets = new Set(sets.filter((s) => !s.isWarmup).map((s) => s.sessionId));
    const days = [...withSets].map((id) => sessionDays.get(id)).filter((d): d is string => !!d);
    return sessionsInLastDays(days, today);
  }, [sets, sessionDays, today]);

  const record = useMemo(() => {
    const inputTypes = new Map<string, InputType>(
      [...exerciseById].map(([id, exercise]) => [id, exercise.inputType]),
    );
    return recentRecordEvents(sets, sessionDays, inputTypes)[0] ?? null;
  }, [sets, sessionDays, exerciseById]);
  const recordExercise = record ? exerciseById.get(record.exerciseId) : undefined;

  const isEmpty = summary.current === null && sets.length === 0;

  return (
    <Card aria-label="Résumé">
      <div className={styles.stats}>
        <Stat
          label="Poids"
          value={summary.current ? formatNumber(quantity.toDisplay(summary.current.value)) : '—'}
          unit={summary.current ? quantity.unit : undefined}
        />
        <Stat
          label="30 jours"
          value={
            summary.variation30
              ? formatSigned(quantity.toDisplay(summary.variation30.delta), formatNumber)
              : '—'
          }
          unit={summary.variation30 ? quantity.unit : undefined}
        />
        <Stat label="Séances 7 j" value={sessionCount} />
      </div>
      {record && recordExercise ? (
        <p className={styles.record}>
          <span className={styles.recordLabel}>Record récent</span>
          <span>
            {recordExercise.name} · {RECORD_LABELS[record.kind].toLowerCase()}{' '}
            <strong>{formatRecordValue(record.kind, record.value, weightUnit)}</strong>{' '}
            <span className={styles.when}>({relativeDayLabel(record.date, today)})</span>
          </span>
        </p>
      ) : (
        <p className={styles.record}>
          <span className={styles.recordLabel}>Record récent</span>
          <span className={styles.when}>
            {isEmpty
              ? 'Ton suivi se remplit tout seul : pèse-toi ou fais ta première séance.'
              : 'Pas encore de record battu : ils apparaissent dès que tu dépasses une de tes marques.'}
          </span>
        </p>
      )}
    </Card>
  );
}

export function TrackingScreen() {
  const data = useTrackingData();
  const [params, setParams] = useSearchParams();
  const requested = params.get('onglet');
  const section: SectionId = isSection(requested) ? requested : 'poids';

  return (
    <Screen title="Suivi">
      {!data ? (
        <p className={styles.loading} role="status">
          Chargement de ton suivi…
        </p>
      ) : (
        <>
          <Summary data={data} />
          <Tabs
            label="Sections du suivi"
            items={SECTIONS}
            value={section}
            onChange={(id) => setParams({ onglet: id }, { replace: true })}
          />
          {section === 'poids' && <WeightPanel data={data} />}
          {section === 'charges' && <LoadsPanel data={data} />}
          {section === 'mensurations' && <MeasurementsPanel data={data} />}
          {section === 'objectifs' && <GoalsPanel data={data} />}
        </>
      )}
    </Screen>
  );
}
