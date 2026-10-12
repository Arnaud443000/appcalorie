import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Exercise, type InputType, parseWholeNumber, type Routine, routineRepo } from '@/data';
import { Button, Card, EmptyState, Input, NumberStepper, Screen, Sheet, useToast } from '@/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { TargetEditor } from '../components/TargetEditor';
import { useExercises } from '../hooks/useExercises';
import { useDefaultRest } from '../hooks/useSettings';
import { defaultTarget } from '../logic';
import styles from './RoutineEditScreen.module.css';

interface ItemDraft {
  key: string;
  exerciseId: string;
  sets: string;
  targetReps: string;
  rest: string;
  note: string;
}

let keyCounter = 0;
const nextKey = () => `item-${(keyCounter += 1)}`;

function draftsFrom(routine: Routine | undefined): ItemDraft[] {
  return (routine?.items ?? []).map((item) => ({
    key: nextKey(),
    exerciseId: item.exerciseId,
    sets: String(item.targetSets),
    targetReps: item.targetReps,
    rest: item.restSeconds === null ? '' : String(item.restSeconds),
    note: item.note,
  }));
}

/** Création (`/programmes/nouveau`) ou modification (`/programmes/:routineId`) d'un programme. */
export function RoutineEditScreen() {
  const { routineId } = useParams();
  const routine = useLiveQuery(
    async () => (routineId ? ((await routineRepo.get(routineId)) ?? null) : undefined),
    [routineId],
  );

  if (!routineId) return <RoutineForm routine={undefined} />;
  if (routine === undefined)
    return (
      <Screen title="Programme" backTo="/entrainement">
        {null}
      </Screen>
    );
  if (routine === null) {
    return (
      <Screen title="Programme" backTo="/entrainement">
        <EmptyState
          icon="workout"
          title="Programme introuvable"
          message="Il a peut-être été supprimé."
        />
      </Screen>
    );
  }
  return <RoutineForm key={routine.id} routine={routine} />;
}

function RoutineForm({ routine }: { routine: Routine | undefined }) {
  const navigate = useNavigate();
  const toast = useToast();
  const exercises = useExercises();
  const [name, setName] = useState(routine?.name ?? '');
  const [note, setNote] = useState(routine?.note ?? '');
  const [items, setItems] = useState<ItemDraft[]>(() => draftsFrom(routine));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const defaultRest = useDefaultRest();
  const [saving, setSaving] = useState(false);

  function patchItem(key: string, change: Partial<ItemDraft>) {
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }

  function move(index: number, delta: number) {
    setItems((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      const [moved] = copy.splice(index, 1);
      if (moved) copy.splice(target, 0, moved);
      return copy;
    });
  }

  function addExercise(exercise: Exercise) {
    setItems((list) => [
      ...list,
      {
        key: nextKey(),
        exerciseId: exercise.id,
        sets: '3',
        targetReps: defaultTarget(exercise.inputType),
        rest: String(defaultRest),
        note: '',
      },
    ]);
    setPickerOpen(false);
  }

  async function save() {
    if (name.trim() === '') {
      setNameError('Donne un nom à ton programme.');
      return;
    }
    setNameError(null);
    setSaving(true);
    const data = {
      name: name.trim(),
      note: note.trim(),
      items: items.map((item) => ({
        exerciseId: item.exerciseId,
        targetSets: Math.max(1, parseWholeNumber(item.sets) ?? 3),
        targetReps: item.targetReps.trim(),
        restSeconds: item.rest.trim() === '' ? null : Math.max(0, parseWholeNumber(item.rest) ?? 0),
        note: item.note.trim(),
      })),
    };
    try {
      if (routine) await routineRepo.update(routine.id, data);
      else await routineRepo.create(data);
      toast.show('Programme enregistré.');
      navigate('/entrainement', { replace: true });
    } catch {
      setSaving(false);
      toast.show('Impossible d’enregistrer le programme.');
    }
  }

  async function remove() {
    if (!routine) return;
    try {
      await routineRepo.remove(routine.id);
      toast.show('Programme supprimé.');
      navigate('/entrainement', { replace: true });
    } catch {
      toast.show('Suppression impossible.');
    }
  }

  return (
    <Screen title={routine ? 'Modifier le programme' : 'Nouveau programme'} backTo="/entrainement">
      <Input
        label="Nom du programme"
        value={name}
        maxLength={60}
        error={nameError ?? undefined}
        placeholder="Ex. Haut du corps"
        onChange={(event) => setName(event.target.value)}
      />
      <Input
        label="Note (facultatif)"
        value={note}
        maxLength={200}
        onChange={(event) => setNote(event.target.value)}
      />

      {items.length === 0 && (
        <p className={styles.muted}>
          Un programme sans exercice est une séance libre : tu choisiras les exercices pendant la
          séance.
        </p>
      )}

      {items.map((item, index) => {
        const exercise = exercises?.byId.get(item.exerciseId);
        const inputType: InputType = exercise?.inputType ?? 'weight_reps';
        const exerciseName = exercise?.name ?? 'Exercice supprimé';
        return (
          <Card key={item.key} className={styles.item} aria-label={exerciseName}>
            <div className={styles.itemHead}>
              <h3 className={styles.itemName}>
                {index + 1}. {exerciseName}
              </h3>
              <div className={styles.itemButtons}>
                <Button
                  variant="ghost"
                  className={styles.iconBtn}
                  aria-label={`Monter : ${exerciseName}`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  className={styles.iconBtn}
                  aria-label={`Descendre : ${exerciseName}`}
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  className={styles.remove}
                  aria-label={`Retirer : ${exerciseName}`}
                  onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}
                >
                  Retirer
                </Button>
              </div>
            </div>
            <div className={styles.fields}>
              <NumberStepper
                label="Séries"
                value={item.sets}
                step={1}
                min={1}
                inputMode="numeric"
                onChange={(sets) => patchItem(item.key, { sets })}
              />
              <NumberStepper
                label="Repos (s)"
                value={item.rest}
                step={15}
                min={0}
                max={1200}
                inputMode="numeric"
                onChange={(rest) => patchItem(item.key, { rest })}
              />
            </div>
            <TargetEditor
              inputType={inputType}
              value={item.targetReps}
              onChange={(targetReps) => patchItem(item.key, { targetReps })}
            />
            <Input
              label="Note (facultatif)"
              value={item.note}
              maxLength={120}
              onChange={(event) => patchItem(item.key, { note: event.target.value })}
            />
          </Card>
        );
      })}

      <Button variant="secondary" block onClick={() => setPickerOpen(true)}>
        Ajouter un exercice
      </Button>
      <Button block onClick={save} disabled={saving}>
        Enregistrer
      </Button>
      {routine && (
        <Button variant="ghost" block onClick={() => setConfirmDelete(true)}>
          Supprimer ce programme
        </Button>
      )}

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
        excludeIds={items.map((item) => item.exerciseId)}
      />

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer le programme ?"
      >
        <div className={styles.sheet}>
          <p>Les séances déjà faites avec ce programme restent dans ton historique.</p>
          <Button block onClick={remove}>
            Oui, supprimer
          </Button>
          <Button variant="secondary" block onClick={() => setConfirmDelete(false)}>
            Non, le garder
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
