import type { ViewName } from '../muscleMap';

/**
 * Calculs de cadrage, sans Three.js. Le corps tourne sur lui-même (lacet) devant une caméra
 * fixe : l'éclairage reste le même quelle que soit la face montrée.
 */
export interface CameraState {
  /** Rotation du corps autour de l'axe vertical (radians). 0 = de face. */
  yaw: number;
  /** Inclinaison de la caméra (radians, > 0 = vue d'en haut). */
  pitch: number;
  /** 1 = corps entier à l'écran. */
  zoom: number;
  /** Décalage du point visé (mètres), nul quand le corps est entier à l'écran. */
  panX: number;
  panY: number;
}

export interface BodyFrame {
  /** Hauteur et largeur maximale (toutes faces confondues) du corps, en mètres. */
  height: number;
  width: number;
}

export const FOV_DEGREES = 30;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;
export const PITCH_LIMIT = 0.6;
export const HOME: CameraState = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };

export const VIEW_YAW: Record<ViewName, number> = {
  front: 0,
  back: Math.PI,
  // Le côté gauche du corps (+X) se tourne vers la caméra (+Z).
  left: -Math.PI / 2,
  right: Math.PI / 2,
};

const TAN_HALF_FOV = Math.tan((FOV_DEGREES * Math.PI) / 360);

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Distance caméra–corps pour que le corps entier tienne dans la vue, avec une marge.
 * `usable` : part de la hauteur de l'image réellement libre (le reste est sous les boutons).
 */
export function homeDistance(frame: BodyFrame, aspect: number, usable = 1): number {
  const vertical = (frame.height * 0.53) / (TAN_HALF_FOV * Math.max(usable, 0.1));
  const horizontal = (frame.width * 0.56) / (TAN_HALF_FOV * Math.max(aspect, 0.1));
  return Math.max(vertical, horizontal);
}

/** Demi-hauteur visible (mètres) dans le plan du corps, à une distance donnée. */
export function halfHeightAt(distance: number): number {
  return distance * TAN_HALF_FOV;
}

/** Garde le corps à l'écran : pas de décalage à zoom 1, décalage limité ensuite. */
export function clampState(state: CameraState, frame: BodyFrame): CameraState {
  const zoom = clamp(state.zoom, MIN_ZOOM, MAX_ZOOM);
  const room = 1 - 1 / zoom;
  const maxX = (room * frame.width) / 2;
  const maxY = (room * frame.height) / 2;
  return {
    yaw: state.yaw,
    pitch: clamp(state.pitch, -PITCH_LIMIT, PITCH_LIMIT),
    zoom,
    panX: clamp(state.panX, -maxX, maxX),
    panY: clamp(state.panY, -maxY, maxY),
  };
}

/**
 * Zoom ancré : le point du corps sous le doigt (coordonnées normalisées -1…1) reste sous
 * le doigt après le zoom.
 */
export function zoomAround(
  state: CameraState,
  factor: number,
  ndcX: number,
  ndcY: number,
  frame: BodyFrame,
  aspect: number,
  usable = 1,
): CameraState {
  const home = homeDistance(frame, aspect, usable);
  const zoom = clamp(state.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const before = halfHeightAt(home / state.zoom);
  const after = halfHeightAt(home / zoom);
  return clampState(
    {
      ...state,
      zoom,
      panX: state.panX + ndcX * aspect * (before - after),
      panY: state.panY + ndcY * (before - after),
    },
    frame,
  );
}

/** Angle équivalent à `target` le plus proche de `current` (on tourne par le plus court). */
export function nearestAngle(current: number, target: number): number {
  const turns = Math.round((current - target) / (2 * Math.PI));
  return target + turns * 2 * Math.PI;
}

/** Vue standard correspondant à l'état, ou null si le corps est entre deux vues. */
export function viewOf(state: CameraState, tolerance = 0.12): ViewName | null {
  if (Math.abs(state.pitch) > tolerance) return null;
  for (const [view, yaw] of Object.entries(VIEW_YAW) as [ViewName, number][]) {
    if (Math.abs(state.yaw - nearestAngle(state.yaw, yaw)) < tolerance) return view;
  }
  return null;
}

export function isCentered(state: CameraState): boolean {
  return (
    Math.abs(state.zoom - 1) < 0.02 && Math.abs(state.panX) < 1e-3 && Math.abs(state.panY) < 1e-3
  );
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function mix(from: CameraState, to: CameraState, t: number): CameraState {
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    yaw: lerp(from.yaw, to.yaw),
    pitch: lerp(from.pitch, to.pitch),
    zoom: lerp(from.zoom, to.zoom),
    panX: lerp(from.panX, to.panX),
    panY: lerp(from.panY, to.panY),
  };
}
