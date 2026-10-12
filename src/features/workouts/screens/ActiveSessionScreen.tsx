import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { setEntryRepo, workoutSessionRepo, type Exercise, type SetEntry } from '@/data';
import { Button, Card, EmptyState, Screen, Sheet, Stat, useToast } from '@/ui';
import { AlertSettingsSheet } from '../components/AlertSettingsSheet';
import { ExerciseBlockView } from '../components/ExerciseBlockView';
import { ExercisePicker } from '../components/ExercisePicker';
import { RestBar } from '../components/RestBar';
import {
  addSet,
  deleteSet,
  discardSession,
  finishSession,
  loadExerciseHistory,
  updateSet,
} from '../data';
import { primeAlerts, readAlertPrefs, saveAlertPrefs, type AlertPrefs } from '../hooks/alerts';
import { useExercises } from '../hooks/useExercises';
import { useNow } from '../hooks/useNow';
import { useRestTimer } from '../hooks/useRestTimer';
import { useSessionPlan } from '../hooks/useSessionPlan';
import { useWakeLock } from '../hooks/useWakeLock';
import { useWeightUnit } from '../hooks/useWeightUnit';
import {
  addToPlan,
  buildBlocks,
  DEFAULT_REST_SECONDS,
  detectRecords,
  formatDuration,
  formatNumber,
  lastPerformance,
  RECORD_LABELS,
  replaceInPlan,
  sessionVolume,
  setSkipped,
  type ExerciseBlock,
  type InputType,
  type SetValues,
} from '../logic';
import styles from './ActiveSessionScreen.module.css';

export function ActiveSessionScreen() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const session = useLiveQuery(
    async () => (await workoutSessionRepo.get(sessionId)) ?? null,
    [sessionId],
  );
  if (session === undefined) return <Screen title="Séance">{null}</Screen>;
  if (session === null) {
    return (
      <Screen title="Séance" backTo="/entrainement">
        <EmptyState
          icon="workout"
          title="Séance introuvable"
          message="Elle a peut-être été supprimée."
          action={<Button onClick={() => navigate('/entrainement')}>Retour</Button>}
        />
      </Screen>
    );
  }
  if (session.endedAt !== null) {
    return <Navigate to={`/entrainement/historique/${session.id}`} replace />;
  }
  return (
    <LiveSession
      sessionId={session.id}
      name={session.name || 'Séance'}
      routineId={session.routineId}
      startedAt={session.startedAt}
    />
  );
}

interface LiveSessionProps {
  sessionId: string;
  name: string;
  routineId: string | null;
  startedAt: string;
}

function LiveSession({ sessionId, name, routineId, startedAt }: LiveSessionProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const unit = useWeightUnit();
  const exercises = useExercises();
  const { plan, update: updatePlan } = useSessionPlan(sessionId, routineId);
  const rest = useRestTimer(sessionId);
  const now = useNow();

  const sets = useLiveQuery(() => setEntryRepo.findBy('sessionId', sessionId), [sessionId]);
  const blocks = useMemo(() => (plan && sets ? buildBlocks(plan, sets) : null), [plan, sets]);
  const exerciseKey = (blocks ?? []).map((block) => block.exerciseId).join(',');
  const history = useLiveQuery(
    () => loadExerciseHistory(exerciseKey ? exerciseKey.split(',') : []),
    [exerciseKey],
  );

  const [prefs, setPrefs] = useState<AlertPrefs>(readAlertPrefs);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useWakeLock(prefs.keepAwake);

  function changePrefs(next: AlertPrefs) {
    setPrefs(next);
    saveAlertPrefs(next);
  }

  if (!blocks || !history)
    return (
      <Screen title={name} backTo="/entrainement">
        {null}
      </Screen>
    );

  const previousSets = history.sets.filter((set) => set.sessionId !== sessionId);
  const inputTypeOf = (exercise: Exercise | undefined): InputType =>
    exercise?.inputType ?? 'weight_reps';
  const allSets = sets ?? [];
  const workingCount = allSets.filter((set) => !set.isWarmup).length;
  const volume = sessionVolume(allSets);
  const elapsed = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));

  function breaksFor(block: ExerciseBlock<SetEntry>) {
    const exercise = exercises?.byId.get(block.exerciseId);
    return detectRecords(
      previousSets.filter((set) => set.exerciseId === block.exerciseId),
      block.sets,
      inputTypeOf(exercise),
    );
  }

  async function handleAddSet(block: ExerciseBlock<SetEntry>, values: SetValues) {
    primeAlerts(); // doit se faire pendant le tap (règle d'iOS pour le son)
    const exercise = exercises?.byId.get(block.exerciseId);
    const created = await addSet(sessionId, block.exerciseId, values);

    const before = breaksFor(block);
    const after = detectRecords(
      previousSets.filter((set) => set.exerciseId === block.exerciseId),
      [...block.sets, created],
      inputTypeOf(exercise),
    );
    const fresh = after.filter((record) => {
      const old = before.find((b) => b.kind === record.kind);
      return !old || record.value > old.value;
    });
    if (fresh.length > 0) {
      toast.show(`Nouveau record : ${fresh.map((r) => RECORD_LABELS[r.kind]).join(', ')} !`);
    }

    const seconds = block.item?.restSeconds ?? DEFAULT_REST_SECONDS;
    if (seconds > 0) rest.start(seconds);
  }

  function handleSaveSet(setId: string, values: SetValues) {
    updateSet(setId, values).catch(() => toast.show('Modification non enregistrée.'));
  }

  function handleDeleteSet(setId: string) {
    deleteSet(setId).catch(() => toast.show('Suppression impossible.'));
  }

  function pickExercise(exercise: Exercise) {
    if (replacing) {
      updatePlan((current) => replaceInPlan(current, replacing, exercise.id));
    } else {
      updatePlan((current) => addToPlan(current, exercise.id));
    }
    setReplacing(null);
    setPickerOpen(false);
  }

  async function finish() {
    try {
      if (workingCount === 0 && allSets.length === 0) {
        await discardSession(sessionId);
        rest.stop();
        toast.show('Séance vide supprimée.');
        navigate('/entrainement', { replace: true });
        return;
      }
      await finishSession(sessionId);
      rest.stop();
      toast.show('Séance enregistrée.');
      navigate(`/entrainement/historique/${sessionId}`, { replace: true });
    } catch {
      toast.show('Impossible de terminer la séance.');
    }
  }

  async function discard() {
    try {
      await discardSession(sessionId);
      rest.stop();
      navigate('/entrainement', { replace: true });
    } catch {
      toast.show('Suppression impossible.');
    }
  }

  const allRecords = blocks.flatMap((block) => breaksFor(block).map((r) => ({ block, record: r })));

  return (
    <Screen
      title={name}
      backTo="/entrainement"
      action={
        <Button variant="ghost" onClick={() => setAlertsOpen(true)}>
          Alerte
        </Button>
      }
    >
      <Card className={styles.stats}>
        <Stat label="Durée" value={Math.floor(elapsed / 60)} unit="min" />
        <Stat label="Séries" value={workingCount} />
        <Stat label="Volume" value={formatNumber(Math.round(volume))} unit="kg" />
      </Card>

      {blocks.length === 0 && (
        <EmptyState
          icon="workout"
          title="Séance libre"
          message="Ajoute ton premier exercice pour commencer à noter tes séries."
        />
      )}

      {blocks.map((block) => (
        <ExerciseBlockView
          key={block.exerciseId}
          block={block}
          exercise={exercises?.byId.get(block.exerciseId)}
          last={lastPerformance(block.exerciseId, previousSets, history.sessions, {
            excludeSessionId: sessionId,
          })}
          breaks={breaksFor(block)}
          unit={unit}
          onAddSet={(values) => handleAddSet(block, values)}
          onSaveSet={handleSaveSet}
          onDeleteSet={handleDeleteSet}
          onSkip={() => updatePlan((current) => setSkipped(current, block.exerciseId, true))}
          onRestore={() => updatePlan((current) => setSkipped(current, block.exerciseId, false))}
          onReplace={() => {
            setReplacing(block.exerciseId);
            setPickerOpen(true);
          }}
        />
      ))}

      <Button
        variant="secondary"
        block
        onClick={() => {
          setReplacing(null);
          setPickerOpen(true);
        }}
      >
        Ajouter un exercice
      </Button>
      <Button block onClick={() => setFinishOpen(true)}>
        Terminer la séance
      </Button>
      {/* Réserve la place de la barre de repos fixe. */}
      {rest.state && <div className={styles.restSpacer} aria-hidden="true" />}

      <RestBar timer={rest} />

      <ExercisePicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setReplacing(null);
        }}
        onPick={pickExercise}
        title={replacing ? 'Remplacer par…' : 'Ajouter un exercice'}
        excludeIds={blocks.map((block) => block.exerciseId)}
      />

      <AlertSettingsSheet
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        prefs={prefs}
        onChange={changePrefs}
      />

      <Sheet
        open={finishOpen}
        onClose={() => {
          setFinishOpen(false);
          setConfirmDiscard(false);
        }}
        title="Terminer la séance"
      >
        <div className={styles.finish}>
          {allSets.length === 0 ? (
            <p>Tu n’as noté aucune série : la séance sera supprimée.</p>
          ) : (
            <>
              <p>
                {workingCount} série{workingCount > 1 ? 's' : ''} ·{' '}
                {formatNumber(Math.round(volume))} kg de volume · {formatDuration(elapsed)}
              </p>
              {allRecords.length > 0 && (
                <ul className={styles.recordList}>
                  {allRecords.map(({ block, record }) => (
                    <li key={`${block.exerciseId}-${record.kind}`}>
                      Record · {exercises?.byId.get(block.exerciseId)?.name ?? 'Exercice'} :{' '}
                      {RECORD_LABELS[record.kind]}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <Button block onClick={finish}>
            {allSets.length === 0 ? 'Supprimer la séance vide' : 'Terminer'}
          </Button>
          <Button variant="secondary" block onClick={() => setFinishOpen(false)}>
            Continuer la séance
          </Button>
          {allSets.length > 0 &&
            (confirmDiscard ? (
              <Button variant="secondary" block onClick={discard}>
                Oui, supprimer toute la séance
              </Button>
            ) : (
              <Button variant="ghost" block onClick={() => setConfirmDiscard(true)}>
                Abandonner la séance
              </Button>
            ))}
        </div>
      </Sheet>
    </Screen>
  );
}
