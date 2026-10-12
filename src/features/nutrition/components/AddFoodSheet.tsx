import { useState } from 'react';
import type { Food, MealTypeId } from '@/data';
import { Sheet } from '@/ui';
import { foodToHit } from '../format';
import type { FoodHit } from '../foods';
import { AverageView } from './AverageView';
import { CreateFoodForm } from './CreateFoodForm';
import { FoodBrowser } from './FoodBrowser';
import { FoodDetail } from './FoodDetail';
import { useFoodSearch } from './useFoodSearch';

export interface AddFoodSheetProps {
  open: boolean;
  onClose: () => void;
  day: string;
  mealType: MealTypeId;
  mealLabel: string;
}

type View =
  | { kind: 'browse' }
  | { kind: 'detail'; hit: FoodHit }
  | { kind: 'average'; hit: FoodHit }
  | { kind: 'create' };

/** Feuille « Ajouter un aliment » : recherche → détail et quantité → (moyenne) → journal. */
export function AddFoodSheet({ open, onClose, day, mealType, mealLabel }: AddFoodSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={`Ajouter à ${mealLabel}`}>
      {/* Le contenu n'existe que feuille ouverte : sa recherche repart de zéro à chaque ouverture. */}
      <AddFoodFlow day={day} mealType={mealType} mealLabel={mealLabel} onClose={onClose} />
    </Sheet>
  );
}

function AddFoodFlow({ day, mealType, mealLabel, onClose }: Omit<AddFoodSheetProps, 'open'>) {
  const [view, setView] = useState<View>({ kind: 'browse' });
  const search = useFoodSearch();
  const browse = () => setView({ kind: 'browse' });
  const openSaved = (food: Food) => setView({ kind: 'detail', hit: foodToHit(food) });

  if (view.kind === 'detail') {
    return (
      <FoodDetail
        key={view.hit.foodId ?? `${view.hit.source}:${view.hit.name}:${view.hit.brand}`}
        hit={view.hit}
        day={day}
        mealType={mealType}
        mealLabel={mealLabel}
        onBack={browse}
        onAdded={onClose}
        onAverage={() => setView({ kind: 'average', hit: view.hit })}
      />
    );
  }
  if (view.kind === 'average') {
    // Un résultat CIQUAL proche (même recherche) sert de référence pour comparer.
    const reference = search.outcome?.hits.find((hit) => hit.source === 'ciqual') ?? null;
    return (
      <AverageView
        query={search.query}
        reference={reference}
        onBack={() => setView({ kind: 'detail', hit: view.hit })}
        onSaved={openSaved}
      />
    );
  }
  if (view.kind === 'create') {
    return (
      <CreateFoodForm initialName={search.query.trim()} onBack={browse} onCreated={openSaved} />
    );
  }
  return (
    <FoodBrowser
      search={search}
      onPick={(hit) => setView({ kind: 'detail', hit })}
      onCreate={() => setView({ kind: 'create' })}
    />
  );
}
