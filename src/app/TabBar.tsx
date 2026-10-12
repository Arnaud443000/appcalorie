import { NavLink, useLocation } from 'react-router';
import { Icon, type IconName } from '@/ui';
import styles from './TabBar.module.css';

interface Tab {
  to: string;
  label: string;
  icon: IconName;
}

const TABS: readonly Tab[] = [
  { to: '/', label: 'Aujourd’hui', icon: 'today' },
  { to: '/entrainement', label: 'Entraînement', icon: 'workout' },
  { to: '/exercices', label: 'Exercices', icon: 'exercises' },
  { to: '/nutrition', label: 'Nutrition', icon: 'nutrition' },
  { to: '/suivi', label: 'Suivi', icon: 'tracking' },
];

export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className={styles.bar} aria-label="Navigation principale">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => {
            // Les Réglages s'ouvrent depuis « Aujourd'hui » : l'onglet reste allumé.
            const active = isActive || (tab.to === '/' && pathname.startsWith('/reglages'));
            return [styles.tab, active && styles.active].filter(Boolean).join(' ');
          }}
        >
          <Icon name={tab.icon} size={24} />
          <span className={styles.label}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
