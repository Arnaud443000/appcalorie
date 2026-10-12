import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  detectRecords,
  findUnfinishedSession,
  formatDay,
  formatDuration,
  formatNumber,
  formatRecordValue,
  formatSetSummary,
  formatTime,
  RECORD_LABELS,
  sessionVolume,
  setEntryRepo,
  workingSets,
  workoutSessionRepo,
} from '@/data';
import { Button, Card, Chip, EmptyState, Screen, Sheet, Stat, useToast } from '@/ui';
import { copySession, discardSession, loadExerciseHistory } from '../data';
import { useExercises } from '../hooks/useExercises';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { PATHS } from '../paths';
import { buildBlocks } from '../logic';
import styles from './SessionDetailScreen.module.css';

/** Détail d'une séance terminée, avec copie vers une nouvelle séance. */
export function SessionDetailScreen() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const unit = useWeightUnit();
  const exercises = useExercises();
  const session = useLiveQuery(
    async () => (await workoutSessionRepo.get(sessionId)) ?? null,
    [sessionId],
  );
  const sets = useLiveQuery(() => setEntryRepo.findBy('sessionId', sessionId), [sessionId]);
  const blocks = useMemo(() => (sets ? buildBlocks([], sets) : []), [sets]);
  const exerciseKey = blocks.map((block) => block.exerciseId).join(',');
  const history = useLiveQuery(
    () => loadExerciseHistory(exerciseKey ? exerciseKey.split(',') : []),
    [exerciseKey],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (session === undefined || sets === undefined) {
    return (
      <Screen title="Séance" backTo={PATHS.history}>
        {null}
      </Screen>
    );
  }
  if (session === null) {
    return (
      <Screen title="Séance" backTo={PATHS.history}>
        <EmptyState
          icon="workout"
          title="Séance introuvable"
          message="Elle a peut-être été supprimée."
        />
      </Screen>
    );
  }
  if (session.endedAt === null) return <Navigate to={PATHS.liveSession(session.id)} replace />;

  const startedMs = new Date(session.startedAt).getTime();
  const duration = (new Date(session.endedAt).getTime() - startedMs) / 1000;
  const volume = sessionVolume(sets);
  const workingCount = workingSets(sets).length;

  // Records de cette séance : à comparer seulement avec les séances qui la précèdent.
  const earlier = new Set(
    (history?.sessions ?? []).filter((s) => s.startedAt < session.startedAt).map((s) => s.id),
  );

  async function copy() {
    try {
      if (await findUnfinishedSession()) {
        toast.show('Termine d’abord ta séance en cours.');
        navigate(PATHS.home);
        return;
      }
      const created = await copySession(sessionId);
      toast.show('Nouvelle séance prête.');
      navigate(PATHS.liveSession(created.id));
    } catch {
      toast.show('Impossible de copier la séance.');
    }
  }

  async function remove() {
    try {
      await discardSession(sessionId);
      toast.show('Séance supprimée.');
      navigate(PATHS.history, { replace: true });
    } catch {
      toast.show('Suppression impossible.');
    }
  }

  return (
    <Screen title={session.name || 'Séance libre'} backTo={PATHS.history}>
      <p className={styles.muted}>
        {formatDay(session.startedAt)} à {formatTime(session.startedAt)}
      </p>
      <Card className={styles.stats}>
        <Stat label="Durée" value={formatDuration(duration)} />
        <Stat label="Séries" value={workingCount} />
        <Stat label="Volume" value={formatNumber(Math.round(volume))} unit="kg" />
      </Card>

      {blocks.length === 0 && (
        <EmptyState icon="workout" title="Aucune série" message="Cette séance est vide." />
      )}

      {blocks.map((block) => {
        const exercise = exercises?.byId.get(block.exerciseId);
        const inputType = exercise?.inputType ?? 'weight_reps';
        const before = (history?.sets ?? []).filter(
          (set) => set.exerciseId === block.exerciseId && earlier.has(set.sessionId),
        );
        const breaks = detectRecords(before, block.sets, inputType);
        let work = 0;
        let warm = 0;
        return (
          <Card key={block.exerciseId} className={styles.block}>
            <h3>{exercise?.name ?? 'Exercice supprimé'}</h3>
            {breaks.length > 0 && (
              <ul className={styles.records} aria-label="Records battus">
                {breaks.map((record) => (
                  <li key={record.kind}>
                    <Chip>
                      Record · {RECORD_LABELS[record.kind]} :{' '}
                      {formatRecordValue(record.kind, record.value, unit)}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
            <ol className={styles.sets}>
              {block.sets.map((set) => {
                const label = set.isWarmup ? `Échauffement ${(warm += 1)}` : `Série ${(work += 1)}`;
                const extras = [
                  set.rpe != null ? `RPE ${formatNumber(set.rpe)}` : null,
                  set.note || null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={set.id} className={styles.set}>
                    <span className={styles.setLabel}>{label}</span>
                    <span>{formatSetSummary(set, inputType, unit)}</span>
                    {extras && <span className={styles.muted}>{extras}</span>}
                  </li>
                );
              })}
            </ol>
          </Card>
        );
      })}

      <Button block onClick={copy}>
        Copier vers une nouvelle séance
      </Button>
      <Button variant="ghost" block onClick={() => setConfirmDelete(true)}>
        Supprimer cette séance
      </Button>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer la séance ?"
      >
        <div className={styles.sheet}>
          <p>La séance et ses séries disparaîtront de ton historique et de tes records.</p>
          <Button block onClick={remove}>
            Oui, supprimer
          </Button>
          <Button variant="secondary" block onClick={() => setConfirmDelete(false)}>
            Non, la garder
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
