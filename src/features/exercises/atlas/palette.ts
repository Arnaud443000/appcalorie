/**
 * Couleurs de la scène 3D, lues à l'exécution dans les variables CSS de src/ui/tokens.css
 * (aucune couleur écrite en dur ici). Une variable absente donne une chaîne vide :
 * la scène garde alors la couleur par défaut de Three.js.
 */
export interface AtlasPalette {
  /** Muscles au repos (gris-blanc mat, assombri par l'éclairage). */
  muscle: string;
  /** Groupe choisi / muscles principaux. */
  primary: string;
  /** Muscles secondaires. */
  secondary: string;
  /** Lumière de contour. */
  rim: string;
  /** Lumière d'ambiance venant du sol (teinte du fond). */
  ground: string;
}

export const PALETTE_VARIABLES: Record<keyof AtlasPalette, string> = {
  muscle: '--color-text',
  primary: '--color-accent',
  secondary: '--color-accent-2',
  rim: '--color-text',
  ground: '--color-bg',
};

export function readAtlasPalette(element: Element = document.documentElement): AtlasPalette {
  const style = getComputedStyle(element);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    muscle: read(PALETTE_VARIABLES.muscle),
    primary: read(PALETTE_VARIABLES.primary),
    secondary: read(PALETTE_VARIABLES.secondary),
    rim: read(PALETTE_VARIABLES.rim),
    ground: read(PALETTE_VARIABLES.ground),
  };
}
