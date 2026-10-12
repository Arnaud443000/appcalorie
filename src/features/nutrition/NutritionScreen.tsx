import { EmptyState, Screen } from '@/ui';

/** Écran provisoire (lot 0). À remplacer par le lot Nutrition. */
export function NutritionScreen() {
  return (
    <Screen title="Nutrition">
      <EmptyState
        icon="nutrition"
        title="Journal vide"
        message="Ton suivi alimentaire arrivera ici."
      />
    </Screen>
  );
}
