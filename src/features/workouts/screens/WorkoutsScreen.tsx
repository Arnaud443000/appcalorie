import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  findUnfinishedSession,
  formatDay,
  formatTime,
  type Routine,
  routineRepo,
  setEntryRepo,
} from '@/data';
import { Button, Card, EmptyState, ListRow, Screen, Sheet, useToast } from '@/ui';
import { discardSession, finishSession, startFreeSession, startFromRoutine } from '../data';
import styles from './WorkoutsScreen.module.css';

/** Accueil de l'onglet : séance en cours à reprendre, programmes, accès à l'historique et aux records. */
export function WorkoutsScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const unfinished = useLiveQuery(async () => (await findUnfinishedSession()) ?? null, []);
  const setCount = useLiveQuery(
    async () => (unfinished ? (await setEntryRepo.findBy('sessionId', unfinished.id)).length : 0),
    [unfinished?.id],
  );
  const routines = useLiveQuery(async () => {
    const list = await routineRepo.list();
    return list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, []);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  async function begin(start: () => Promise<{ id: string }>) {
    try {
      const session = await start();
      navigate(`/entrainement/seance/${session.id}`);
    } catch {
      toast.show('Impossible de démarrer la séance.');
    }
  }

  async function endUnfinished() {
    if (!unfinished) return;
    try {
      if ((setCount ?? 0) === 0) await discardSession(unfinished.id);
      else await finishSession(unfinished.id);
      toast.show('Séance terminée.');
    } catch {
      toast.show('Impossible de terminer la séance.');
    }
  }

  async function abandon() {
    if (!unfinished) return;
    setConfirmAbandon(false);
    try {
      await discardSession(unfinished.id);
      toast.show('Séance supprimée.');
    } catch {
      toast.show('Suppression impossible.');
    }
  }

  const blocked = Boolean(unfinished);

  return (
    <Screen title="Entraînement">
      {unfinished && (
        <Card raised className={styles.resume} aria-label="Séance en cours">
          <h2>Séance en cours</h2>
          <p>
            <strong>{unfinished.name || 'Séance libre'}</strong>, commencée{' '}
            {formatDay(unfinished.startedAt)} à {formatTime(unfinished.startedAt)} ({setCount ?? 0}{' '}
            série{(setCount ?? 0) > 1 ? 's' : ''} notée{(setCount ?? 0) > 1 ? 's' : ''}).
          </p>
          <Button block onClick={() => navigate(`/entrainement/seance/${unfinished.id}`)}>
            Reprendre la séance
          </Button>
          <div className={styles.row}>
            <Button variant="secondary" onClick={endUnfinished}>
              Terminer
            </Button>
            <Button variant="ghost" onClick={() => setConfirmAbandon(true)}>
              Abandonner
            </Button>
          </div>
        </Card>
      )}

      <Button block disabled={blocked} onClick={() => begin(startFreeSession)}>
        Séance libre
      </Button>
      {blocked && (
        <p className={styles.muted}>
          Termine ou reprends ta séance en cours avant d’en démarrer une autre.
        </p>
      )}

      <section className={styles.section} aria-labelledby="programmes-title">
        <div className={styles.sectionHead}>
          <h2 id="programmes-title">Programmes</h2>
          <Button variant="secondary" onClick={() => navigate('/entrainement/programmes/nouveau')}>
            Nouveau
          </Button>
        </div>
        {routines && routines.length === 0 && (
          <EmptyState
            icon="workout"
            title="Pas encore de programme"
            message="Crée une routine (exercices, séries, répétitions, repos) ou lance une séance libre."
          />
        )}
        {routines?.map((routine) => (
          <RoutineCard
            key={routine.id}
            routine={routine}
            disabled={blocked}
            onStart={() => begin(() => startFromRoutine(routine))}
            onEdit={() => navigate(`/entrainement/programmes/${routine.id}`)}
          />
        ))}
      </section>

      <Card flush>
        <ListRow
          title="Historique"
          subtitle="Liste et calendrier de tes séances"
          to="/entrainement/historique"
        />
        <ListRow
          title="Records"
          subtitle="Charge max, répétitions, volume, 1RM estimé"
          to="/entrainement/records"
        />
      </Card>

      <Sheet
        open={confirmAbandon}
        onClose={() => setConfirmAbandon(false)}
        title="Abandonner la séance ?"
      >
        <div className={styles.sheet}>
          <p>La séance en cours et toutes ses séries seront supprimées.</p>
          <Button block onClick={abandon}>
            Oui, supprimer
          </Button>
          <Button variant="secondary" block onClick={() => setConfirmAbandon(false)}>
            Non, la garder
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}

function RoutineCard({
  routine,
  disabled,
  onStart,
  onEdit,
}: {
  routine: Routine;
  disabled: boolean;
  onStart: () => void;
  onEdit: () => void;
}) {
  const count = routine.items.length;
  return (
    <Card className={styles.routine}>
      <div>
        <h3>{routine.name}</h3>
        <p className={styles.muted}>
          {count === 0
            ? 'Programme vide : séance libre'
            : `${count} exercice${count > 1 ? 's' : ''}`}
        </p>
      </div>
      <div className={styles.row}>
        <Button disabled={disabled} onClick={onStart} aria-label={`Démarrer ${routine.name}`}>
          Démarrer
        </Button>
        <Button variant="secondary" onClick={onEdit} aria-label={`Modifier ${routine.name}`}>
          Modifier
        </Button>
      </div>
    </Card>
  );
}
