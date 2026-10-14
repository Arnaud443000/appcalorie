import { useState } from 'react';
import { parseDecimal } from '@/data';
import { Button, Input, NumberStepper, useToast } from '@/ui';
import type { Day } from '../logic';
import { toFieldText, type Quantity } from '../format';
import styles from './QuickEntry.module.css';

export interface QuickEntryProps {
  /** « Poids », « Tour de taille »… */
  label: string;
  quantity: Quantity;
  /** Dernière valeur connue (stockée) : le champ en part, pour n'ajuster que de quelques crans. */
  lastValue: number | null;
  today: Day;
  /** Bornes plausibles, en valeur stockée. */
  range: readonly [number, number];
  onSave: (date: Day, stored: number) => Promise<void>;
  /** Message de confirmation. */
  savedMessage: string;
}

/** Saisie rapide : une date (aujourd'hui par défaut) et une valeur. */
export function QuickEntry({
  label,
  quantity,
  lastValue,
  today,
  range,
  onSave,
  savedMessage,
}: QuickEntryProps) {
  const toast = useToast();
  const [date, setDate] = useState<Day>(today);
  // `null` : l'utilisateur n'a rien tapé, le champ montre la dernière valeur.
  const [typed, setTyped] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const text = typed ?? toFieldText(quantity, lastValue);

  async function save() {
    const shown = parseDecimal(text);
    if (shown === null || shown <= 0) {
      setError(
        `Entre ${label.toLowerCase().startsWith('tour') ? 'une mesure' : 'une valeur'} en ${quantity.unit}.`,
      );
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
    setError(null);
    setSaving(true);
    try {
      await onSave(date, stored);
      toast.show(savedMessage);
      setTyped(null);
    } catch {
      setError('Impossible d’enregistrer pour le moment. Réessaie.');
    } finally {
      setSaving(false);
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
      <NumberStepper
        label={`${label} (${quantity.unit})`}
        value={text}
        step={quantity.step}
        min={0}
        onChange={(value) => {
          setTyped(value);
          setError(null);
        }}
        placeholder="0"
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button type="submit" block disabled={saving}>
        Enregistrer
      </Button>
    </form>
  );
}
