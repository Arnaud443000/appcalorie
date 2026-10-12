import { EmptyState, Screen } from '@/ui';

/** Écran provisoire (lot 0). À remplacer par le lot Entraînement. */
export function WorkoutsScreen() {
  return (
    <Screen title="Entraînement">
      <EmptyState
        icon="workout"
        title="Aucune séance pour l’instant"
        message="Tes programmes et tes séances arriveront ici."
      />
    </Screen>
  );
}
