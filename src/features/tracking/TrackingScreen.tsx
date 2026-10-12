import { EmptyState, Screen } from '@/ui';

/** Écran provisoire (lot 0). À remplacer par le lot Suivi. */
export function TrackingScreen() {
  return (
    <Screen title="Suivi">
      <EmptyState
        icon="tracking"
        title="Pas encore de mesures"
        message="Tes courbes de poids, de charges et de mensurations arriveront ici."
      />
    </Screen>
  );
}
