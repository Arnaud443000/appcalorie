import { useState } from 'react';
import { Button, Sheet } from '@/ui';
import {
  notificationSupport,
  requestNotifications,
  type AlertPrefs,
  type NotificationSupport,
} from '../hooks/alerts';
import styles from './AlertSettingsSheet.module.css';

export interface AlertSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  prefs: AlertPrefs;
  onChange: (prefs: AlertPrefs) => void;
}

const NOTIFICATION_TEXT: Record<NotificationSupport, string> = {
  unsupported: 'Les notifications ne sont pas disponibles ici.',
  default: 'Pas encore autorisées.',
  granted: 'Autorisées.',
  denied: 'Refusées : à réactiver dans les réglages du téléphone.',
};

/** Réglage de l'alerte de fin de repos. */
export function AlertSettingsSheet({ open, onClose, prefs, onChange }: AlertSettingsSheetProps) {
  const [permission, setPermission] = useState<NotificationSupport>(notificationSupport);

  async function askPermission() {
    setPermission(await requestNotifications());
  }

  const toggle = (name: keyof AlertPrefs) => (
    <input
      type="checkbox"
      checked={prefs[name]}
      onChange={(event) => onChange({ ...prefs, [name]: event.target.checked })}
    />
  );

  return (
    <Sheet open={open} onClose={onClose} title="Alerte de repos">
      <div className={styles.body}>
        <label className={styles.option}>
          {toggle('sound')}
          <span>Son à la fin du repos</span>
        </label>
        <label className={styles.option}>
          {toggle('vibrate')}
          <span>Vibration (pas disponible sur iPhone)</span>
        </label>
        <label className={styles.option}>
          {toggle('notify')}
          <span>Notification</span>
        </label>
        <div className={styles.permission}>
          <p className={styles.muted}>{NOTIFICATION_TEXT[permission]}</p>
          {permission === 'default' && (
            <Button variant="secondary" onClick={askPermission}>
              Autoriser les notifications
            </Button>
          )}
        </div>
        <label className={styles.option}>
          {toggle('keepAwake')}
          <span>Garder l’écran allumé pendant la séance</span>
        </label>
        <p className={styles.muted}>
          Le temps de repos reste toujours juste, même si l’écran se verrouille : il est calculé
          d’après l’heure de fin. En revanche, l’alerte ne peut sonner que si l’appli est encore
          active. Sur iPhone, garde l’écran allumé pour être prévenu à temps.
        </p>
      </div>
    </Sheet>
  );
}
