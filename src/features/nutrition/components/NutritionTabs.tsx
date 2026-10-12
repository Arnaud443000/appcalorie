import { useNavigate } from 'react-router';
import { Tabs } from '@/ui';

const ITEMS = [
  { id: 'journal', label: 'Journal' },
  { id: 'semaine', label: 'Semaine' },
  { id: 'catalogue', label: 'CIQUAL' },
] as const;

export type NutritionTab = (typeof ITEMS)[number]['id'];

const PATHS: Record<NutritionTab, string> = {
  journal: '/nutrition',
  semaine: '/nutrition/semaine',
  catalogue: '/nutrition/catalogue',
};

/** Navigation entre les trois écrans de l'onglet Nutrition. */
export function NutritionTabs({ current }: { current: NutritionTab }) {
  const navigate = useNavigate();
  return (
    <Tabs
      label="Nutrition"
      items={ITEMS}
      value={current}
      onChange={(id) => {
        if (id !== current) void navigate(PATHS[id]);
      }}
    />
  );
}
