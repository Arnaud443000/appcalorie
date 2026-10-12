import { useRef, useState } from 'react';
import { Button, Icon, Input, NumberStepper } from '@/ui';
import type { InputType, WeightUnit } from '@/data';
import {
  distanceInputUnit,
  FIELDS_BY_INPUT,
  toSetValues,
  weightStep,
  type SetForm,
  type SetValues,
} from '../logic';
import styles from './SetRow.module.css';

export interface SetRowProps {
  /** `draft` : prochaine série à valider. `saved` : série déjà enregistrée, modifiable. */
  mode: 'draft' | 'saved';
  label: string;
  inputType: InputType;
  unit: WeightUnit;
  dumbbell: boolean;
  initial: SetForm;
  /** Dernière performance, ex. « Dernière fois : 60 kg × 8 ». */
  hint?: string;
  /** Mode `draft` : enregistre la série. */
  onSubmit?: (values: SetValues) => Promise<void>;
  /** Mode `saved` : enregistre la modification. */
  onSave?: (values: SetValues) => void;
  onDelete?: () => void;
}

export function SetRow({
  mode,
  label,
  inputType,
  unit,
  dumbbell,
  initial,
  hint,
  onSubmit,
  onSave,
  onDelete,
}: SetRowProps) {
  const [form, setForm] = useState<SetForm>(initial);
  const [detailsOpen, setDetailsOpen] = useState(() => initial.rpe !== '' || initial.note !== '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fields = FIELDS_BY_INPUT[inputType];
  // Dernière saisie enregistrée : évite d'écrire en base quand rien n'a changé (simple passage de focus).
  const savedKey = useRef(JSON.stringify(initial));

  function patch(change: Partial<SetForm>, save = false) {
    const next = { ...form, ...change };
    setForm(next);
    if (save && mode === 'saved') commitSaved(next);
  }

  function commitSaved(next: SetForm) {
    const key = JSON.stringify(next);
    if (key === savedKey.current) return;
    const result = toSetValues(next, inputType, unit);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    savedKey.current = key;
    onSave?.(result.values);
  }

  async function submit() {
    const result = toSetValues(form, inputType, unit);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit?.(result.values);
    } catch {
      setError('Impossible d’enregistrer la série. Réessaie.');
      setBusy(false);
    }
  }

  // En mode « saved », une valeur finie est enregistrée tout de suite (valeur passée explicitement,
  // car l'état React n'est pas encore à jour).
  const commit = (change: Partial<SetForm>) => patch(change, true);

  return (
    <div className={[styles.row, mode === 'saved' && styles.saved].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <span className={styles.label}>
          {mode === 'saved' && (
            <>
              <Icon name="check" size={18} className={styles.check} />
              <span className="visually-hidden">Enregistrée : </span>
            </>
          )}
          {label}
        </span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>

      <div className={styles.fields}>
        {fields.weight && (
          <NumberStepper
            label={inputType === 'bodyweight_load' ? `Lest (${unit})` : `Charge (${unit})`}
            value={form.weight}
            step={weightStep(unit, dumbbell)}
            onChange={(weight) => setForm((f) => ({ ...f, weight }))}
            onCommit={(weight) => commit({ weight })}
            placeholder={inputType === 'bodyweight_load' ? '0' : undefined}
          />
        )}
        {fields.reps && (
          <NumberStepper
            label="Répétitions"
            value={form.reps}
            step={1}
            inputMode="numeric"
            onChange={(reps) => setForm((f) => ({ ...f, reps }))}
            onCommit={(reps) => commit({ reps })}
          />
        )}
        {fields.distance && (
          <NumberStepper
            label={`Distance (${distanceInputUnit(inputType)})`}
            value={form.distance}
            step={distanceInputUnit(inputType) === 'km' ? 0.1 : 5}
            onChange={(distance) => setForm((f) => ({ ...f, distance }))}
            onCommit={(distance) => commit({ distance })}
          />
        )}
        {fields.duration && (
          <NumberStepper
            label="Durée (s)"
            value={form.duration}
            step={inputType === 'distance' ? 30 : 5}
            inputMode="numeric"
            onChange={(duration) => setForm((f) => ({ ...f, duration }))}
            onCommit={(duration) => commit({ duration })}
          />
        )}
      </div>

      {detailsOpen && (
        <div className={styles.details}>
          <NumberStepper
            label="Effort (RPE)"
            value={form.rpe}
            step={0.5}
            min={1}
            max={10}
            onChange={(rpe) => setForm((f) => ({ ...f, rpe }))}
            onCommit={(rpe) => commit({ rpe })}
            placeholder="1 à 10"
          />
          <Input
            label="Note"
            value={form.note}
            maxLength={200}
            onChange={(event) => patch({ note: event.target.value })}
            onBlur={(event) => commit({ note: event.target.value })}
          />
        </div>
      )}

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <label className={styles.warmup}>
          <input
            type="checkbox"
            checked={form.isWarmup}
            onChange={(event) => patch({ isWarmup: event.target.checked }, true)}
          />
          <span>Échauffement</span>
        </label>
        <Button
          variant="ghost"
          className={styles.small}
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {detailsOpen ? 'Moins' : 'Effort, note'}
        </Button>
        {mode === 'draft' ? (
          <Button className={styles.submit} onClick={submit} disabled={busy}>
            Valider
          </Button>
        ) : (
          <Button
            variant="ghost"
            className={styles.small}
            aria-label={`Supprimer : ${label}`}
            onClick={onDelete}
          >
            <Icon name="trash" size={18} />
            Supprimer
          </Button>
        )}
      </div>
    </div>
  );
}
