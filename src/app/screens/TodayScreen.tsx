import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { findUnfinishedSession } from '@/data';
import { Card, EmptyState, Icon, ListRow, Screen, Stat } from '@/ui';
import styles from './TodayScreen.module.css';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function TodayScreen() {
  const unfinished = useLiveQuery(async () => (await findUnfinishedSession()) ?? null, []);

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
      {unfinished && (
        <Card flush raised aria-label="Séance en cours">
          <ListRow
            title="Reprendre ta séance"
            subtitle={`${unfinished.name || 'Séance'} · commencée à ${timeFormatter.format(new Date(unfinished.startedAt))}`}
            leading={<Icon name="workout" />}
            to={`/entrainement/seance/${unfinished.id}`}
          />
        </Card>
      )}
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
