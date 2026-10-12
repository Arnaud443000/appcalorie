import { Link } from 'react-router';
import { Card, EmptyState, Icon, Screen, Stat } from '@/ui';
import styles from './TodayScreen.module.css';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function TodayScreen() {
  return (
    <Screen
      title="Aujourd’hui"
      action={
        <Link to="/reglages" className={styles.settings} aria-label="Réglages">
          <Icon name="settings" />
        </Link>
      }
    >
      <p className={styles.date}>{dateFormatter.format(new Date())}</p>
      <Card>
        <div className={styles.stats}>
          <Stat label="Séances" value="—" />
          <Stat label="Calories" value="—" unit="kcal" />
          <Stat label="Poids" value="—" unit="kg" />
        </div>
      </Card>
      <EmptyState
        icon="today"
        title="Rien de prévu"
        message="Ton programme du jour apparaîtra ici (écran provisoire)."
      />
    </Screen>
  );
}
