/**
 * Gestes sur la vue 3D (événements « pointer », souris et doigts confondus) :
 * - un doigt / clic gauche : tourner ; Maj + glisser ou clic droit : déplacer ;
 * - deux doigts : pincer pour zoomer, glisser pour déplacer ;
 * - molette : zoom vers le pointeur ;
 * - toucher bref : choisir ; double toucher : recentrer.
 */
export interface ControlHandlers {
  rotate(dx: number, dy: number): void;
  pan(dx: number, dy: number): void;
  zoomAt(factor: number, clientX: number, clientY: number): void;
  tap(clientX: number, clientY: number): void;
  doubleTap(clientX: number, clientY: number): void;
}

/** Au-delà de ce déplacement (px), ce n'est plus un toucher. */
export const TAP_SLOP = 8;
const TAP_MAX_MS = 400;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DISTANCE = 32;

interface Point {
  x: number;
  y: number;
}

interface Gesture {
  start: Point;
  startTime: number;
  moved: number;
  multi: boolean;
  pan: boolean;
}

export function attachControls(element: HTMLElement, handlers: ControlHandlers): () => void {
  const pointers = new Map<number, Point>();
  let gesture: Gesture | null = null;
  let pinch: { distance: number; middle: Point } | null = null;
  let lastTap: (Point & { time: number }) | null = null;

  function measurePinch() {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return null;
    return {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
    element.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      gesture = {
        start: { x: event.clientX, y: event.clientY },
        startTime: event.timeStamp,
        moved: 0,
        multi: false,
        pan: event.pointerType === 'mouse' && (event.button === 2 || event.shiftKey),
      };
    } else {
      if (gesture) gesture.multi = true;
      pinch = measurePinch();
    }
  }

  function onPointerMove(event: PointerEvent) {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, current);
    if (gesture) {
      gesture.moved = Math.max(
        gesture.moved,
        Math.hypot(current.x - gesture.start.x, current.y - gesture.start.y),
      );
    }
    if (pointers.size >= 2) {
      const next = measurePinch();
      if (pinch && next) {
        handlers.zoomAt(next.distance / pinch.distance, next.middle.x, next.middle.y);
        handlers.pan(next.middle.x - pinch.middle.x, next.middle.y - pinch.middle.y);
      }
      pinch = next;
      return;
    }
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    if (gesture?.pan) handlers.pan(dx, dy);
    else handlers.rotate(dx, dy);
  }

  function onPointerEnd(event: PointerEvent) {
    if (!pointers.delete(event.pointerId)) return;
    pinch = pointers.size >= 2 ? measurePinch() : null;
    if (pointers.size > 0 || !gesture) return;
    const isTap =
      event.type === 'pointerup' &&
      !gesture.multi &&
      gesture.moved < TAP_SLOP &&
      event.timeStamp - gesture.startTime < TAP_MAX_MS;
    gesture = null;
    if (!isTap) return;
    const point = { x: event.clientX, y: event.clientY };
    if (
      lastTap &&
      event.timeStamp - lastTap.time < DOUBLE_TAP_MS &&
      Math.hypot(point.x - lastTap.x, point.y - lastTap.y) < DOUBLE_TAP_DISTANCE
    ) {
      lastTap = null;
      handlers.doubleTap(point.x, point.y);
    } else {
      lastTap = { ...point, time: event.timeStamp };
      handlers.tap(point.x, point.y);
    }
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    // Pincement sur pavé tactile : ctrlKey et petits deltas, d'où un gain plus fort.
    const gain = event.ctrlKey ? 0.01 : 0.0015;
    handlers.zoomAt(Math.exp(-event.deltaY * gain), event.clientX, event.clientY);
  }

  const prevent = (event: Event) => event.preventDefault();

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerEnd);
  element.addEventListener('pointercancel', onPointerEnd);
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('contextmenu', prevent);
  // Safari iOS : empêche le zoom de la page pendant un pincement sur la vue.
  element.addEventListener('gesturestart', prevent);

  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerEnd);
    element.removeEventListener('pointercancel', onPointerEnd);
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('contextmenu', prevent);
    element.removeEventListener('gesturestart', prevent);
  };
}
