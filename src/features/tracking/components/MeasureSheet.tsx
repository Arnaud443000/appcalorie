import { useState } from 'react';
import { parseDecimal } from '@/data';
import { Button, Input, Sheet, useToast } from '@/ui';
import { MEASURE_KEYS, type BodyKey, type BodyPatch, type Day } from '../logic';
import { toFieldText, type Quantity } from '../format';
import styles from './MeasureSheet.module.css';

export interface MeasureSheetProps {
  open: boolean;
  onClose: () => void;
  today: Day;
  quantity: Quantity;
  /** Dernières valeurs connues (stockées) de chaque mesure, affichées en indication. */
  lastValues: Partial<Record<BodyKey, number>>;
  onSave: (date: Day, patch: BodyPatch) => Promise<void>;
}

const RANGE = [5, 300] as const;

function Form({ onClose, today, quantity, lastValues, onSave }: Omit<MeasureSheetProps, 'open'>) {
  const toast = useToast();
  const [date, setDate] = useState<Day>(today);
  const [values, setValues] = useState<Partial<Record<BodyKey, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const patch: BodyPatch = {};
    for (const { id, label } of MEASURE_KEYS) {
      const text = values[id]?.trim();
      if (!text) continue;
      const shown = parseDecimal(text);
      const stored = shown === null ? NaN : quantity.fromDisplay(shown);
      if (!(stored >= RANGE[0] && stored <= RANGE[1])) {
        setError(`« ${label} » : valeur incorrecte. Vérifie-la et l’unité (${quantity.unit}).`);
        return;
      }
      if (id === 'waist') patch.waistCm = stored;
      else patch.measurements = { ...patch.measurements, [id]: stored };
    }
    if (patch.waistCm === undefined && !patch.measurements) {
      setError('Remplis au moins une mesure.');
      return;
    }
    if (!date) {
      setError('Choisis une date.');
      return;
    }
    setBusy(true);
    try {
      await onSave(date, patch);
      toast.show('Mensurations enregistrées');
      onClose();
    } catch {
      setError('Impossible d’enregistrer pour le moment. Réessaie.');
      setBusy(false);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Input
        label="Date"
        type="date"
        value={date}
        max={today}
        onChange={(event) => setDate(event.target.value)}
      />
      <p className={styles.hint}>Remplis seulement ce que tu as mesuré aujourd’hui.</p>
      {MEASURE_KEYS.map(({ id, label }) => (
        <Input
          key={id}
          label={label}
          suffix={quantity.unit}
          inputMode="decimal"
          autoComplete="off"
          value={values[id] ?? ''}
          placeholder={
            lastValues[id] != null ? `Dernière : ${toFieldText(quantity, lastValues[id])}` : ''
          }
          onChange={(event) => {
            setValues((previous) => ({ ...previous, [id]: event.target.value }));
            setError(null);
          }}
        />
      ))}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button type="submit" block disabled={busy}>
        Enregistrer
      </Button>
    </form>
  );
}

/** Saisie de plusieurs mensurations d'un coup (tour de taille, bras, poitrine…). */
export function MeasureSheet({ open, ...rest }: MeasureSheetProps) {
  return (
    <Sheet open={open} onClose={rest.onClose} title="Saisir mes mensurations">
      <Form {...rest} />
    </Sheet>
  );
}
