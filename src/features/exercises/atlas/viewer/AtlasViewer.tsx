import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { MuscleGroupId } from '@/data';
import { Button } from '@/ui';
import { loadModel } from '../loadModel';
import type { Highlight, ViewName } from '../muscleMap';
import { readAtlasPalette } from '../palette';
import { attachControls } from './controls';
import { AtlasEngine, type EngineStatus, type PickResult } from './engine';
import styles from './AtlasViewer.module.css';

/**
 * Demande de rotation venue de l'écran (choix d'un groupe dans la rangée de puces…).
 * Chaque nouvel objet est une nouvelle demande.
 */
export interface ViewRequest {
  view: ViewName;
  group: MuscleGroupId | null;
}

export interface AtlasViewerProps {
  highlight: Highlight;
  viewRequest: ViewRequest | null;
  onPick: (pick: PickResult) => void;
  /** Description du corps pour les lecteurs d'écran. */
  description: string;
}

type Status =
  | { kind: 'loading'; progress: number }
  | { kind: 'ready' }
  | { kind: 'error'; reason: 'webgl' | 'network' | 'lost' };

const VIEWS: { id: ViewName; label: string; aria: string }[] = [
  { id: 'front', label: 'Face', aria: 'Vue de face' },
  { id: 'back', label: 'Dos', aria: 'Vue de dos' },
  { id: 'left', label: 'Gauche', aria: 'Profil gauche du corps' },
  { id: 'right', label: 'Droite', aria: 'Profil droit du corps' },
];

const ERRORS: Record<'webgl' | 'network' | 'lost', { title: string; message: string }> = {
  webgl: {
    title: '3D indisponible',
    message:
      "Ton navigateur n'arrive pas à afficher la 3D (WebGL). Choisis un groupe dans la liste ci-dessous pour voir ses exercices.",
  },
  network: {
    title: 'Modèle non chargé',
    message:
      'Impossible de télécharger le corps 3D. Vérifie ta connexion : une fois chargé, il reste disponible hors ligne.',
  },
  lost: {
    title: 'Affichage 3D interrompu',
    message: "Ton appareil a libéré la mémoire graphique. Relance l'affichage.",
  },
};

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Vue 3D de l'Atlas. Ce module (et Three.js) n'est chargé qu'à l'ouverture de l'écran
 * (import dynamique depuis AtlasScreen).
 */
export default function AtlasViewer({
  highlight,
  viewRequest,
  onPick,
  description,
}: AtlasViewerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const viewsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<AtlasEngine | null>(null);
  const highlightRef = useRef(highlight);
  const onPickRef = useRef(onPick);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: 'loading', progress: 0 });
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({
    view: 'front',
    centered: true,
  });

  useEffect(() => {
    highlightRef.current = highlight;
    onPickRef.current = onPick;
  });

  // Création de la scène, chargement du modèle, et libération de tout au départ de l'écran.
  useEffect(() => {
    const stage = stageRef.current;
    const surface = surfaceRef.current;
    if (!stage || !surface) return;
    // Un canvas neuf à chaque montage : le contexte WebGL de l'ancien est libéré au démontage.
    const canvas = document.createElement('canvas');
    canvas.className = styles.canvas ?? '';
    canvas.setAttribute('aria-hidden', 'true');
    surface.appendChild(canvas);
    let engine: AtlasEngine;
    try {
      engine = new AtlasEngine(canvas, readAtlasPalette(stage), {
        reducedMotion: prefersReducedMotion(),
        onStatus: setEngineStatus,
      });
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- échec immédiat de WebGL
      setStatus({ kind: 'error', reason: 'webgl' });
      canvas.remove();
      return;
    }
    engineRef.current = engine;
    engine.setHighlight(highlightRef.current);

    const resize = () => {
      const views = viewsRef.current;
      engine.setInsetTop(views ? views.offsetTop + views.offsetHeight : 0);
      engine.resize(stage.clientWidth, stage.clientHeight);
    };
    resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(stage);

    const detach = attachControls(canvas, {
      rotate: (dx, dy) => engine.rotateBy(dx, dy),
      pan: (dx, dy) => engine.panBy(dx, dy),
      zoomAt: (factor, x, y) => engine.zoomAt(factor, x, y),
      tap: (x, y) => {
        const hit = engine.pick(x, y);
        if (hit) onPickRef.current(hit);
      },
      doubleTap: () => engine.recenter(),
    });

    const onContextLost = (event: Event) => {
      event.preventDefault();
      setStatus({ kind: 'error', reason: 'lost' });
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    const abort = new AbortController();
    performance.mark?.('atlas3d:debut');
    loadModel((progress) => setStatus({ kind: 'loading', progress }), abort.signal)
      .then(({ groups }) => {
        if (abort.signal.aborted) return;
        engine.setModel(groups);
        performance.mark?.('atlas3d:fin');
        performance.measure?.('atlas3d:chargement', 'atlas3d:debut', 'atlas3d:fin');
        setStatus({ kind: 'ready' });
      })
      .catch(() => {
        if (!abort.signal.aborted) setStatus({ kind: 'error', reason: 'network' });
      });

    return () => {
      abort.abort();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      detach();
      observer?.disconnect();
      engine.dispose();
      canvas.remove();
      engineRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    engineRef.current?.setHighlight(highlight);
  }, [highlight]);

  useEffect(() => {
    if (viewRequest) engineRef.current?.focusGroup(viewRequest.group, viewRequest.view);
  }, [viewRequest]);

  function onKeyDown(event: KeyboardEvent) {
    const engine = engineRef.current;
    if (!engine) return;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => engine.rotateBy(-40, 0),
      ArrowRight: () => engine.rotateBy(40, 0),
      ArrowUp: () => engine.rotateBy(0, -30),
      ArrowDown: () => engine.rotateBy(0, 30),
      '+': () => engine.zoomBy(1.25),
      '=': () => engine.zoomBy(1.25),
      '-': () => engine.zoomBy(0.8),
      '0': () => engine.recenter(),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  const error = status.kind === 'error' ? ERRORS[status.reason] : null;

  return (
    <div ref={stageRef} className={styles.stage}>
      <div
        ref={surfaceRef}
        className={styles.surface}
        role="img"
        aria-label={description}
        tabIndex={error ? -1 : 0}
        onKeyDown={onKeyDown}
        hidden={error !== null}
      />

      {status.kind !== 'error' && (
        <div ref={viewsRef} className={styles.views} role="group" aria-label="Orientation du corps">
          {VIEWS.map((view) => (
            <button
              key={view.id}
              type="button"
              className={styles.view}
              aria-label={view.aria}
              aria-pressed={engineStatus.view === view.id}
              onClick={() => engineRef.current?.showView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </div>
      )}

      {status.kind === 'ready' && !engineStatus.centered && (
        <button
          type="button"
          className={styles.recenter}
          onClick={() => engineRef.current?.recenter()}
        >
          Recentrer
        </button>
      )}

      {status.kind === 'loading' && (
        <div className={styles.overlay} role="status">
          <p className={styles.overlayTitle}>Chargement du corps 3D…</p>
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Chargement du modèle"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(status.progress * 100)}
          >
            <div
              className={styles.progressBar}
              style={{ transform: `scaleX(${status.progress})` }}
            />
          </div>
          <p className={styles.overlayHint}>
            {Math.round(status.progress * 100)} % · gardé hors ligne ensuite
          </p>
        </div>
      )}

      {error && (
        <div className={styles.overlay} role="alert">
          <p className={styles.overlayTitle}>{error.title}</p>
          <p className={styles.overlayMessage}>{error.message}</p>
          {status.kind === 'error' && status.reason !== 'webgl' && (
            <Button
              variant="secondary"
              onClick={() => {
                setStatus({ kind: 'loading', progress: 0 });
                setAttempt((n) => n + 1);
              }}
            >
              Réessayer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
