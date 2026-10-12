import { EmptyState } from '@/ui';

/** Contenu provisoire de l'onglet « Atlas 3D » : un autre lot le remplacera. */
export function AtlasPlaceholder() {
  return (
    <EmptyState
      icon="exercises"
      title="Atlas 3D"
      message="Bientôt : le corps en 3D, touche un muscle pour voir ses exercices"
    />
  );
}
