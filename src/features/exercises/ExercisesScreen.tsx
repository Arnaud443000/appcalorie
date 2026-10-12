import { useState } from 'react';
import { Screen, Tabs } from '@/ui';
import { AtlasPlaceholder } from './AtlasPlaceholder';
import { ExerciseLibrary } from './ExerciseLibrary';

type ExercisesTab = 'library' | 'atlas';

const TABS = [
  { id: 'library', label: 'Bibliothèque' },
  { id: 'atlas', label: 'Atlas 3D' },
] as const;

/** Onglet Exercices : la bibliothèque et (bientôt) l'atlas 3D. */
export function ExercisesScreen() {
  const [tab, setTab] = useState<ExercisesTab>('library');
  return (
    <Screen title="Exercices">
      <Tabs items={TABS} value={tab} onChange={setTab} label="Vue des exercices" />
      <div style={{ height: 'var(--space-3)' }} />
      {tab === 'library' ? <ExerciseLibrary /> : <AtlasPlaceholder />}
    </Screen>
  );
}
