import { useState } from 'react';
import { goalRepo, formatField, parseDecimal } from '@/data';
import type { Goal } from '@/data';
import { Button, NumberStepper, Sheet, useToast } from '@/ui';
import { defaultMacroTargets, MACRO_ROWS, saveMacroTargets, type MacroTargets } from '../logic';
import styles from './GoalsSheet.module.css';

export interface GoalsSheetProps {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
  /** Repères de macros réglés (sans les valeurs proposées). */
  savedTargets: Partial<MacroTargets>;
  onTargetsSaved: (targets: Partial<MacroTargets>) => void;
}

/** Objectif de calories (Goal « calories ») et repères de macros modifiables. */
export function GoalsSheet({ open, onClose, goal, savedTargets, onTargetsSaved }: GoalsSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Mes objectifs">
      <GoalsForm
        goal={goal}
        savedTargets={savedTargets}
        onTargetsSaved={onTargetsSaved}
        onClose={onClose}
      />
    </Sheet>
  );
}

const text = (value: number | undefined) => (value === undefined ? '' : formatField(value));

function GoalsForm({ goal, savedTargets, onTargetsSaved, onClose }: Omit<GoalsSheetProps, 'open'>) {
  const toast = useToast();
  const [kcal, setKcal] = useState(text(goal?.targetValue));
  const [macros, setMacros] = useState<Record<keyof MacroTargets, string>>({
    proteinG: text(savedTargets.proteinG),
    carbsG: text(savedTargets.carbsG),
    fatG: text(savedTargets.fatG),
    fiberG: text(savedTargets.fiberG),
  });
  const kcalValue = parseDecimal(kcal);
  const goalKcal = kcalValue !== null && kcalValue > 0 ? Math.round(kcalValue) : null;
  const proposed = defaultMacroTargets(goalKcal);

  async function save() {
    if (goalKcal !== null) {
      if (goal) await goalRepo.update(goal.id, { targetValue: goalKcal });
      else
        await goalRepo.create({
          type: 'calories',
          targetValue: goalKcal,
          targetDate: null,
          exerciseId: null,
          measurement: null,
        });
    } else if (goal) {
      await goalRepo.remove(goal.id);
    }
    const targets: Partial<MacroTargets> = {};
    for (const { key } of MACRO_ROWS) {
      const value = parseDecimal(macros[key]);
      if (value !== null && value > 0) targets[key] = value;
    }
    saveMacroTargets(targets);
    onTargetsSaved(targets);
    toast.show('Objectifs enregistrés');
    onClose();
  }

  return (
    <div className={styles.form}>
      <NumberStepper
        label="Objectif de calories (kcal par jour)"
        value={kcal}
        onChange={setKcal}
        step={50}
        min={0}
        max={10000}
        inputMode="numeric"
        placeholder="2 000"
      />
      <p className={styles.hint}>Laisse vide pour ne pas avoir d’objectif de calories.</p>

      <h3 className={styles.sub}>Repères de macros (g par jour)</h3>
      <p className={styles.hint}>
        Laisse un champ vide pour garder le repère proposé (25 % protéines, 50 % glucides, 25 %
        lipides de ton objectif).
      </p>
      {MACRO_ROWS.map(({ key, label }) => (
        <NumberStepper
          key={key}
          label={`${label} (g)`}
          value={macros[key]}
          onChange={(value) => setMacros((current) => ({ ...current, [key]: value }))}
          step={5}
          min={0}
          max={1000}
          placeholder={proposed ? formatField(proposed[key]) : undefined}
        />
      ))}
      <Button block onClick={() => void save()}>
        Enregistrer
      </Button>
    </div>
  );
}
