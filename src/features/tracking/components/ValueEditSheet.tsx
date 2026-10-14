import { useState } from 'react';
import { parseDecimal } from '@/data';
import { Button, Input, NumberStepper, Sheet, useToast } from '@/ui';
import type { Day } from '../logic';
import { toFieldText, type Quantity } from '../format';
import styles from './ValueEditSheet.module.css';

export interface ValueEntry {
  date: Day;
  /** Valeur stockée. */
  value: number;
}

export interface ValueEditSheetProps {
  /** La mesure à modifier, ou `null` pour fermer la feuille. */
  entry: ValueEntry | null;
  title: string;
  label: string;
  quantity: Quantity;
  today: Day;
  range: readonly [number, number];
  onClose: () => void;
  onSave: (entry: ValueEntry, previousDate: Day) => Promise<void>;
  onDelete: (date: Day) => Promise<void>;
}

/** Corps de la feuille : remonté à neuf à chaque mesure ouverte (état initial = la mesure). */
function EditBody({
  entry,
  label,
  quantity,
  today,
  range,
  onClose,
  onSave,
  onDelete,
}: Omit<ValueEditSheetProps, 'entry' | 'title'> & { entry: ValueEntry }) {
  const toast = useToast();
  const [date, setDate] = useState<Day>(entry.date);
  const [text, setText] = useState(toFieldText(quantity, entry.value));
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.show(message);
      onClose();
    } catch {
      setError('Impossible de terminer pour le moment. Réessaie.');
      setBusy(false);
    }
  }

  function save() {
    const shown = parseDecimal(text);
    if (shown === null || shown <= 0) {
      setError(`Entre une valeur en ${quantity.unit}.`);
      return;
    }
    const stored = quantity.fromDisplay(shown);
    if (stored < range[0] || stored > range[1]) {
      setError('Cette valeur semble incorrecte. Vérifie-la et l’unité.');
      return;
    }
    if (!date) {
      setError('Choisis une date.');
      return;
    }
    void run(() => onSave({ date, value: stored }, entry.date), 'Modification enregistrée');
  }

  return (
    <div className={styles.body}>
      <Input
        label="Date"
        type="date"
        value={date}
        max={today}
        onChange={(event) => setDate(event.target.value)}
      />
      <NumberStepper
        label={`${label} (${quantity.unit})`}
        value={text}
        step={quantity.step}
        min={0}
        onChange={(value) => {
          setText(value);
          setError(null);
        }}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button block disabled={busy} onClick={save}>
        Enregistrer
      </Button>
      {confirming ? (
        <div className={styles.confirm} role="group" aria-label="Confirmer la suppression">
          <p className={styles.confirmText}>Supprimer cette mesure ?</p>
          <div className={styles.confirmButtons}>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Annuler
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void run(() => onDelete(entry.date), 'Mesure supprimée')}
            >
              Oui, supprimer
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" block onClick={() => setConfirming(true)}>
          Supprimer
        </Button>
      )}
    </div>
  );
}

/** Feuille pour modifier ou supprimer une mesure (poids, mensuration). */
export function ValueEditSheet({ entry, title, onClose, ...rest }: ValueEditSheetProps) {
  return (
    <Sheet open={entry !== null} onClose={onClose} title={title}>
      {entry && <EditBody key={`${entry.date}`} entry={entry} onClose={onClose} {...rest} />}
    </Sheet>
  );
}
