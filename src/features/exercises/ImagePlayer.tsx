import { useEffect, useState } from 'react';
import type { ExerciseImages } from '@/data';
import { Button, Icon } from '@/ui';
import { useReducedMotion } from './useReducedMotion';
import styles from './ImagePlayer.module.css';

export const START_MS = 1100;
export const END_MS = 900;
export const SLOW_FACTOR = 2;

interface Size {
  width: number;
  height: number;
}

/** Charge une image et donne ses dimensions réelles (null en cas d'échec). */
function preload(src: string): Promise<Size | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth || 3, height: image.naturalHeight || 2 });
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** Charge toutes les images avant de les afficher ; `failed` si l'une manque. */
function usePreload(sources: readonly string[]): { size: Size | null; failed: boolean } {
  const key = sources.join('|');
  const [state, setState] = useState<{ key: string; size: Size | null; failed: boolean }>({
    key: '',
    size: null,
    failed: false,
  });
  useEffect(() => {
    let cancelled = false;
    void Promise.all(sources.map(preload)).then((sizes) => {
      if (cancelled) return;
      const first = sizes[0] ?? null;
      setState({ key, size: first, failed: sizes.some((s) => s === null) });
    });
    return () => {
      cancelled = true;
    };
    // `key` résume `sources`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key
    ? { size: state.size, failed: state.failed }
    : { size: null, failed: false };
}

function NoImage() {
  return (
    <div className={styles.none}>
      <Icon name="exercises" size={32} />
      <p>Pas d’illustration pour cet exercice.</p>
    </div>
  );
}

export interface ImagePlayerProps {
  images: ExerciseImages;
  /** Nom de l'exercice, pour les descriptions des images. */
  name: string;
}

/** Lecteur d'images : alternance départ / fin, image unique, ou encart sans image. */
export function ImagePlayer({ images, name }: ImagePlayerProps) {
  if (images.kind === 'none') return <NoImage />;
  if (images.kind === 'single') return <SingleImage src={images.src} name={name} />;
  return <PairPlayer start={images.start} end={images.end} name={name} />;
}

function frameStyle(size: Size | null) {
  return { aspectRatio: size ? `${size.width} / ${size.height}` : '3 / 2' };
}

function SingleImage({ src, name }: { src: string; name: string }) {
  const { size, failed } = usePreload([src]);
  if (failed) return <NoImage />;
  return (
    <figure className={styles.player} style={{ margin: 0 }}>
      <div className={styles.frame} style={frameStyle(size)}>
        {size ? (
          <img src={src} alt={`${name} : position tenue`} />
        ) : (
          <span className={styles.loading}>Chargement…</span>
        )}
      </div>
      <figcaption className={styles.caption}>Position tenue</figcaption>
    </figure>
  );
}

function PairPlayer({ start, end, name }: { start: string; end: string; name: string }) {
  const reduced = useReducedMotion();
  const { size, failed } = usePreload([start, end]);
  const [atEnd, setAtEnd] = useState(false);
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);

  const ready = size !== null && !failed;
  const playing = ready && !reduced && !paused;

  useEffect(() => {
    if (!playing) return;
    const base = atEnd ? END_MS : START_MS;
    const timer = setTimeout(() => setAtEnd((value) => !value), base * (slow ? SLOW_FACTOR : 1));
    return () => clearTimeout(timer);
  }, [playing, atEnd, slow]);

  if (failed) return <NoImage />;

  const label = atEnd ? 'Position de fin' : 'Position de départ';
  return (
    <figure className={styles.player} style={{ margin: 0 }}>
      <button
        type="button"
        className={styles.frame}
        style={frameStyle(size)}
        onClick={() => setAtEnd((value) => !value)}
        aria-label={`${name} : ${label.toLowerCase()}. Touche pour changer de position.`}
        disabled={!ready}
      >
        {ready ? (
          <>
            <img src={start} alt={`${name} : position de départ`} />
            <img
              src={end}
              alt={`${name} : position de fin`}
              className={[styles.end, atEnd && styles.endVisible].filter(Boolean).join(' ')}
            />
          </>
        ) : (
          <span className={styles.loading}>Chargement…</span>
        )}
      </button>
      <figcaption className={styles.caption} aria-live="polite">
        {label}
      </figcaption>
      {reduced && (
        <p className={styles.caption}>
          Animation désactivée : touche l’image pour changer de position.
        </p>
      )}
      {!reduced && (
        <div className={styles.controls}>
          <Button
            variant="secondary"
            onClick={() => setPaused((value) => !value)}
            disabled={!ready}
          >
            {paused ? 'Lecture' : 'Pause'}
          </Button>
          <Button
            variant={slow ? 'primary' : 'secondary'}
            onClick={() => setSlow((value) => !value)}
            aria-pressed={slow}
            disabled={!ready}
          >
            Lent
          </Button>
        </div>
      )}
    </figure>
  );
}
