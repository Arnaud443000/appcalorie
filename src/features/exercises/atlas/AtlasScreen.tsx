import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router';
import { exerciseRepo, labelOf, MUSCLE_GROUPS, type MuscleGroupId } from '@/data';
import { Button, Chip, Screen } from '@/ui';
import { BottomSheet } from './BottomSheet';
import { Credits, ExerciseResults, GroupResults } from './AtlasResults';
import {
  exerciseHighlight,
  exercisesForGroup,
  groupHighlight,
  groupsWith,
  preferredView,
  synergistsOf,
  type Highlight,
} from './muscleMap';
import { atlasSearch, plural, readAtlasParams } from './params';
import { ViewerBoundary } from './ViewerBoundary';
import type { ViewRequest } from './viewer/AtlasViewer';
import { isWebGLAvailable } from './webgl';
import styles from './AtlasScreen.module.css';

/** La vue 3D et Three.js ne sont téléchargés qu'à l'ouverture de cet écran. */
const importViewer = () => import('./viewer/AtlasViewer');

const groupLabel = (id: MuscleGroupId) => labelOf(MUSCLE_GROUPS, id);

interface Picked {
  group: MuscleGroupId;
  muscle: string;
}

/**
 * Atlas 3D : corps anatomique à faire tourner ; toucher un muscle (ou une puce) montre les
 * exercices qui le travaillent. Adresse : `?muscle=<groupe>` ou `?exercice=<id>`.
 */
export function AtlasScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readAtlasParams(searchParams);
  const exercises = useLiveQuery(() => exerciseRepo.list(), []);
  const [webgl] = useState(isWebGLAvailable);
  const [Viewer, setViewer] = useState(() => lazy(importViewer));
  const [picked, setPicked] = useState<Picked | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Dernier choix fait sur cet écran : un muscle touché sur le corps ne fait pas tourner la vue.
  const [lastChoice, setLastChoice] = useState<{ from: 'chip' | 'model'; group: MuscleGroupId }>();
  const rootRef = useRef<HTMLDivElement>(null);

  const group = params.kind === 'muscle' ? params.group : null;
  const exerciseId = params.kind === 'exercise' ? params.exerciseId : null;
  // undefined : liste en cours de chargement ; null : exercice introuvable.
  const exercise =
    exerciseId === null || exercises === undefined
      ? undefined
      : (exercises.find((item) => item.id === exerciseId) ?? null);

  const synergists = useMemo(
    () => (group && exercises ? synergistsOf(exercises, group) : []),
    [group, exercises],
  );
  const results = useMemo(
    () => (group && exercises ? exercisesForGroup(exercises, group) : null),
    [group, exercises],
  );
  const highlight = useMemo<Highlight>(() => {
    if (exercise) return exerciseHighlight(exercise);
    if (group) return groupHighlight(group, synergists);
    return {};
  }, [exercise, group, synergists]);

  // En mode exercice, le corps se tourne vers le premier muscle principal.
  const exerciseFocus = exercise ? exercise.primaryMuscles[0] : undefined;
  const exerciseRequest = useMemo<ViewRequest | null>(
    () => (exerciseFocus ? { view: preferredView(exerciseFocus), group: exerciseFocus } : null),
    [exerciseFocus],
  );
  // Groupe choisi par une puce ou par l'adresse : le corps se tourne vers lui.
  const groupRequest = useMemo<ViewRequest | null>(
    () =>
      group && !(lastChoice?.from === 'model' && lastChoice.group === group)
        ? { view: preferredView(group), group }
        : null,
    [group, lastChoice],
  );
  const viewRequest = params.kind === 'exercise' ? exerciseRequest : groupRequest;

  // Hauteur disponible entre le haut de l'Atlas et la barre d'onglets.
  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const update = () =>
      element.style.setProperty(
        '--atlas-top',
        `${element.getBoundingClientRect().top + window.scrollY}px`,
      );
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  function select(next: MuscleGroupId | null, from: 'chip' | 'model', muscle = '') {
    setSearchParams(atlasSearch(next), { replace: true });
    setPicked(next && muscle ? { group: next, muscle } : null);
    if (next) setLastChoice({ from, group: next });
  }

  // Textes de la légende sur le corps et de la feuille du bas.
  let caption: { title: string; subtitle?: string } | null = null;
  let legend: { primary: string; secondary: string } | null = null;
  let sheetTitle = 'Choisis un muscle';
  let summary = 'Touche le corps ou une puce.';
  let description = 'Corps humain en 3D vu sans la peau. Aucun muscle choisi.';

  if (params.kind === 'exercise') {
    if (exercise === undefined) {
      sheetTitle = 'Chargement…';
      summary = '';
    } else if (exercise === null) {
      sheetTitle = 'Exercice introuvable';
      summary = "Cette fiche n'existe pas ou a été supprimée.";
    } else {
      const primary = groupsWith(highlight, 'primary').map(groupLabel);
      const secondary = groupsWith(highlight, 'secondary').map(groupLabel);
      caption = { title: exercise.name, subtitle: 'Muscles travaillés' };
      legend = secondary.length > 0 ? { primary: 'Principal', secondary: 'Secondaire' } : null;
      sheetTitle = exercise.name;
      summary = [primary.join(', '), secondary.length > 0 && `+ ${secondary.join(', ')}`]
        .filter(Boolean)
        .join(' ');
      description = `Corps humain en 3D pour ${exercise.name} : muscles principaux en rouge (${primary.join(', ')})${
        secondary.length > 0 ? `, secondaires en rose (${secondary.join(', ')})` : ''
      }.`;
    }
  } else if (group) {
    const label = groupLabel(group);
    const muscle = picked?.group === group ? picked.muscle : '';
    caption = muscle ? { title: muscle, subtitle: label } : { title: label };
    legend = synergists.length > 0 ? { primary: 'Ciblé', secondary: 'Sollicité aussi' } : null;
    sheetTitle = label;
    summary = results
      ? results.primary.length + results.secondary.length === 0
        ? 'Aucun exercice pour l’instant'
        : `${plural(results.primary.length, 'exercice')} · ${results.secondary.length} en secondaire`
      : 'Chargement…';
    description = `Corps humain en 3D : ${label} en rouge${
      synergists.length > 0
        ? `, muscles souvent sollicités avec (${synergists.map(groupLabel).join(', ')}) en rose`
        : ''
    }.`;
  }

  const loading = (
    <div className={styles.message} role="status">
      <p className={styles.messageTitle}>Chargement de l’atlas…</p>
    </div>
  );

  return (
    <Screen title="Atlas 3D" backTo="/exercices">
      <div ref={rootRef} className={styles.atlas}>
        <div className={styles.stage}>
          {webgl ? (
            <ViewerBoundary
              onRetry={() => setViewer(() => lazy(importViewer))}
              fallback={(retry) => (
                <div className={styles.message} role="alert">
                  <p className={styles.messageTitle}>Atlas non chargé</p>
                  <p className={styles.messageText}>
                    Impossible de charger la vue 3D. Vérifie ta connexion puis réessaie.
                  </p>
                  <Button variant="secondary" onClick={retry}>
                    Réessayer
                  </Button>
                </div>
              )}
            >
              <Suspense fallback={loading}>
                <Viewer
                  highlight={highlight}
                  viewRequest={viewRequest}
                  onPick={(hit) => select(hit.group, 'model', hit.muscle)}
                  description={description}
                />
              </Suspense>
            </ViewerBoundary>
          ) : (
            <div className={styles.message} role="alert">
              <p className={styles.messageTitle}>3D indisponible</p>
              <p className={styles.messageText}>
                Ton appareil ou ton navigateur n’affiche pas la 3D (WebGL désactivé). Choisis un
                groupe ci-dessous pour voir ses exercices.
              </p>
            </div>
          )}

          {caption && (
            <div className={styles.caption}>
              <p className={styles.captionTitle}>{caption.title}</p>
              {caption.subtitle && <p className={styles.captionSubtitle}>{caption.subtitle}</p>}
              {legend && (
                <p className={styles.legend}>
                  <span className={styles.dotPrimary} aria-hidden="true" />
                  {legend.primary}
                  <span className={styles.dotSecondary} aria-hidden="true" />
                  {legend.secondary}
                </p>
              )}
            </div>
          )}
        </div>

        <div className={styles.chips} role="group" aria-label="Groupes musculaires">
          {MUSCLE_GROUPS.map((item) => (
            <Chip
              key={item.id}
              selected={group === item.id}
              onClick={() => select(group === item.id ? null : item.id, 'chip')}
            >
              {item.label}
            </Chip>
          ))}
        </div>

        <div className={styles.peekSpace} aria-hidden="true" />

        <BottomSheet
          title={sheetTitle}
          summary={summary}
          open={sheetOpen}
          onToggle={() => setSheetOpen((open) => !open)}
        >
          {params.kind === 'exercise' && exercise && <ExerciseResults exercise={exercise} />}
          {params.kind === 'exercise' && exercise === null && (
            <p className={styles.messageText}>Choisis un groupe musculaire dans la liste.</p>
          )}
          {group && results && (
            <GroupResults
              group={group}
              primary={results.primary}
              secondary={results.secondary}
              synergists={synergists}
            />
          )}
          {params.kind === 'none' && (
            <p className={styles.messageText}>
              Glisse pour tourner le corps, pince ou utilise la molette pour zoomer, touche deux
              fois pour recentrer. Touche un muscle pour voir les exercices qui le travaillent.
            </p>
          )}
          <Credits />
        </BottomSheet>
      </div>
    </Screen>
  );
}
