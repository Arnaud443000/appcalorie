import { useNavigate } from 'react-router';
import { Screen, Tabs } from '@/ui';
import { ExerciseLibrary } from './ExerciseLibrary';

type ExercisesTab = 'library' | 'atlas';

const TABS = [
  { id: 'library', label: 'Bibliothèque' },
  { id: 'atlas', label: 'Atlas 3D' },
] as const;

/** Onglet Exercices : la bibliothèque, et l'Atlas 3D (écran à part, `/exercices/atlas`). */
export function ExercisesScreen() {
  const navigate = useNavigate();
  const onChange = (tab: ExercisesTab) => {
    if (tab === 'atlas') void navigate('/exercices/atlas');
  };
  return (
    <Screen title="Exercices">
      <Tabs items={TABS} value="library" onChange={onChange} label="Vue des exercices" />
      <div style={{ height: 'var(--space-3)' }} />
      <ExerciseLibrary />
    </Screen>
  );
}
