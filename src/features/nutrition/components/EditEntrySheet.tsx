import { useState } from 'react';
import { foodLogEntryRepo, formatField, parseDecimal } from '@/data';
import type { Food, FoodLogEntry } from '@/data';
import { Button, NumberStepper, Sheet, useToast } from '@/ui';
import { kcalText, macrosText } from '../format';
import { nutritionFor, roundNutrition, validGrams } from '../logic';
import { QuickPortions } from './QuickPortions';
import styles from './EditEntrySheet.module.css';

export interface EditEntrySheetProps {
  entry: FoodLogEntry | null;
  food: Food | null;
  onClose: () => void;
}

/** Modifier la quantité d'une ligne du journal. */
export function EditEntrySheet({ entry, food, onClose }: EditEntrySheetProps) {
  return (
    <Sheet open={entry !== null && food !== null} onClose={onClose} title="Modifier la quantité">
      {entry && food && <EditForm key={entry.id} entry={entry} food={food} onClose={onClose} />}
    </Sheet>
  );
}

function EditForm({
  entry,
  food,
  onClose,
}: {
  entry: FoodLogEntry;
  food: Food;
  onClose: () => void;
}) {
  const toast = useToast();
  const [text, setText] = useState(formatField(entry.grams));
  const grams = validGrams(parseDecimal(text));
  const n = grams === null ? null : roundNutrition(nutritionFor(food, grams));

  async function save() {
    if (grams === null) return;
    await foodLogEntryRepo.update(entry.id, { grams });
    toast.show('Quantité modifiée');
    onClose();
  }

  return (
    <div className={styles.form}>
      <p className={styles.name}>{food.name}</p>
      <NumberStepper
        label="Quantité (g)"
        value={text}
        onChange={setText}
        step={10}
        min={0}
        max={5000}
      />
      <QuickPortions servingG={food.servingG} value={text} onPick={setText} />
      <p className={styles.summary} aria-live="polite">
        {n ? `${kcalText(n.kcal)} · ${macrosText(n)}` : 'Saisis une quantité en grammes.'}
      </p>
      <Button block disabled={grams === null} onClick={() => void save()}>
        Enregistrer
      </Button>
    </div>
  );
}
