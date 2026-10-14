import { useState } from 'react';
import { mealRepo } from '@/data';
import type { FoodLogEntry } from '@/data';
import { Button, Input, Sheet, useToast } from '@/ui';
import { mealItemsFrom } from '../logic';
import styles from './SaveMealSheet.module.css';

export interface SaveMealSheetProps {
  open: boolean;
  onClose: () => void;
  entries: FoodLogEntry[];
  defaultName: string;
}

/** Transformer les aliments d'un repas du journal en repas réutilisable. */
export function SaveMealSheet({ open, onClose, entries, defaultName }: SaveMealSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Enregistrer ce repas">
      <SaveMealForm entries={entries} defaultName={defaultName} onClose={onClose} />
    </Sheet>
  );
}

function SaveMealForm({ entries, defaultName, onClose }: Omit<SaveMealSheetProps, 'open'>) {
  const toast = useToast();
  const [name, setName] = useState(defaultName);
  const valid = name.trim() !== '' && entries.length > 0;

  async function save() {
    await mealRepo.create({ name: name.trim(), items: mealItemsFrom(entries) });
    toast.show(`Repas « ${name.trim()} » enregistré`);
    onClose();
  }

  return (
    <div className={styles.form}>
      <Input
        label="Nom du repas"
        value={name}
        onChange={(event) => setName(event.target.value)}
        hint={`${entries.length} aliment${entries.length > 1 ? 's' : ''}, avec leurs quantités.`}
      />
      <Button block disabled={!valid} onClick={() => void save()}>
        Enregistrer le repas
      </Button>
    </div>
  );
}
