import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  foodLogEntryRepo,
  foodRepo,
  goalRepo,
  mealRepo,
  MEAL_TYPES,
  type FoodLogEntry,
  type MealTypeId,
} from '@/data';
import { Button, Screen, useToast } from '@/ui';
import { AddFoodSheet } from './components/AddFoodSheet';
import { DayNav } from './components/DayNav';
import { EditEntrySheet } from './components/EditEntrySheet';
import { GoalsSheet } from './components/GoalsSheet';
import { MealSection } from './components/MealSection';
import { NutritionTabs } from './components/NutritionTabs';
import { SaveMealSheet } from './components/SaveMealSheet';
import { SavedMealsSheet } from './components/SavedMealsSheet';
import { TotalsCard } from './components/TotalsCard';
import {
  addDays,
  effectiveMacroTargets,
  entriesCopiedTo,
  entriesOfMeal,
  loadMacroTargets,
  roundNutrition,
  todayDay,
  totalsOf,
  type MacroTargets,
} from './logic';
import styles from './NutritionScreen.module.css';

/** Journal alimentaire du jour (#/nutrition). */
export function NutritionScreen() {
  const toast = useToast();
  const [day, setDay] = useState(todayDay);
  const [adding, setAdding] = useState<MealTypeId | null>(null);
  const [savedMealsFor, setSavedMealsFor] = useState<MealTypeId | null>(null);
  const [savingMeal, setSavingMeal] = useState<MealTypeId | null>(null);
  const [editing, setEditing] = useState<FoodLogEntry | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [savedTargets, setSavedTargets] = useState<Partial<MacroTargets>>(loadMacroTargets);

  const entries = useLiveQuery(() => foodLogEntryRepo.findBy('date', day), [day]);
  const previousEntries = useLiveQuery(
    () => foodLogEntryRepo.findBy('date', addDays(day, -1)),
    [day],
  );
  const foodList = useLiveQuery(() => foodRepo.list(), []);
  const meals = useLiveQuery(() => mealRepo.list(), []);
  const calorieGoals = useLiveQuery(() => goalRepo.findBy('type', 'calories'), []);

  if (!entries || !foodList || !meals || !calorieGoals) {
    return (
      <Screen title="Nutrition">
        <div className={styles.page}>
          <NutritionTabs current="journal" />
        </div>
      </Screen>
    );
  }

  const foods = new Map(foodList.map((food) => [food.id, food]));
  // Les lignes dont l'aliment a disparu ne sont pas affichées, ni comptées.
  const shown = entries.filter((entry) => foods.has(entry.foodId));
  const goal = [...calorieGoals].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  const goalKcal = goal?.targetValue ?? null;
  const totals = roundNutrition(totalsOf(shown, foods));
  const macroTargets = effectiveMacroTargets(savedTargets, goalKcal);
  const yesterday = (previousEntries ?? []).filter((entry) => foods.has(entry.foodId));
  const mealLabel = (id: MealTypeId) => MEAL_TYPES.find((m) => m.id === id)?.label ?? '';

  async function copyYesterday() {
    for (const entry of entriesCopiedTo(yesterday, day)) await foodLogEntryRepo.create(entry);
    toast.show(
      `${yesterday.length} aliment${yesterday.length > 1 ? 's' : ''} copié${yesterday.length > 1 ? 's' : ''} depuis la veille`,
    );
  }

  async function remove(entry: FoodLogEntry) {
    await foodLogEntryRepo.remove(entry.id);
    toast.show('Aliment retiré du journal');
  }

  return (
    <Screen title="Nutrition">
      <div className={styles.page}>
        <NutritionTabs current="journal" />
        <DayNav day={day} onChange={setDay} />

        <TotalsCard
          totals={totals}
          goalKcal={goalKcal}
          macroTargets={macroTargets}
          onEditGoals={() => setGoalsOpen(true)}
        />

        {MEAL_TYPES.map(({ id, label }) => (
          <MealSection
            key={id}
            label={label}
            entries={entriesOfMeal(shown, id)}
            foods={foods}
            onAdd={() => setAdding(id)}
            onAddSavedMeal={() => setSavedMealsFor(id)}
            onSaveAsMeal={() => setSavingMeal(id)}
            onEdit={setEditing}
            onRemove={(entry) => void remove(entry)}
          />
        ))}

        {yesterday.length > 0 && (
          <Button variant="secondary" block onClick={() => void copyYesterday()}>
            Copier la veille
          </Button>
        )}
      </div>

      <AddFoodSheet
        open={adding !== null}
        onClose={() => setAdding(null)}
        day={day}
        mealType={adding ?? 'breakfast'}
        mealLabel={mealLabel(adding ?? 'breakfast')}
      />
      <SavedMealsSheet
        open={savedMealsFor !== null}
        onClose={() => setSavedMealsFor(null)}
        day={day}
        mealType={savedMealsFor ?? 'breakfast'}
        mealLabel={mealLabel(savedMealsFor ?? 'breakfast')}
        meals={meals}
        foods={foods}
      />
      <SaveMealSheet
        open={savingMeal !== null}
        onClose={() => setSavingMeal(null)}
        entries={savingMeal ? entriesOfMeal(shown, savingMeal) : []}
        defaultName={savingMeal ? mealLabel(savingMeal) : ''}
      />
      <EditEntrySheet
        entry={editing}
        food={editing ? (foods.get(editing.foodId) ?? null) : null}
        onClose={() => setEditing(null)}
      />
      <GoalsSheet
        open={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        goal={goal}
        savedTargets={savedTargets}
        onTargetsSaved={setSavedTargets}
      />
    </Screen>
  );
}
