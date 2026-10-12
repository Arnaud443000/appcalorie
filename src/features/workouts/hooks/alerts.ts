import { readJson, writeJson } from '../data/storage';

/**
 * Alerte de fin de repos : son, vibration, notification.
 * Tout est facultatif et protégé : si le navigateur ne sait pas faire (la vibration n'existe pas
 * sur iPhone, par exemple), on ignore sans erreur.
 */
export interface AlertPrefs {
  sound: boolean;
  vibrate: boolean;
  notify: boolean;
  /** Garde l'écran allumé pendant la séance (pour que le chrono ne soit pas interrompu). */
  keepAwake: boolean;
}

const PREFS_KEY = 'atlas.workouts.alerts';
export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  sound: true,
  vibrate: true,
  notify: true,
  keepAwake: true,
};

export function readAlertPrefs(): AlertPrefs {
  const raw = readJson(PREFS_KEY);
  if (typeof raw !== 'object' || raw === null) return DEFAULT_ALERT_PREFS;
  const record = raw as Record<string, unknown>;
  const pick = (name: keyof AlertPrefs) =>
    typeof record[name] === 'boolean' ? record[name] : DEFAULT_ALERT_PREFS[name];
  return {
    sound: pick('sound'),
    vibrate: pick('vibrate'),
    notify: pick('notify'),
    keepAwake: pick('keepAwake'),
  };
}

export function saveAlertPrefs(prefs: AlertPrefs): void {
  writeJson(PREFS_KEY, prefs);
}

type AudioContextCtor = typeof AudioContext;
let audio: AudioContext | null = null;

/**
 * À appeler dans un geste de l'utilisateur (le tap sur ✓) : iOS ne laisse jouer un son
 * que si le contexte audio a été démarré par un tap.
 */
export function primeAlerts(): void {
  try {
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    // pas de son possible
  }
}

/** Trois bips courts. */
export function playBeep(): void {
  try {
    if (!audio) return;
    const ctx = audio;
    const start = ctx.currentTime;
    for (let i = 0; i < 3; i += 1) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = i === 2 ? 1175 : 880;
      const at = start + i * 0.3;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.25);
    }
  } catch {
    // ignoré
  }
}

export function vibrateDevice(): void {
  try {
    navigator.vibrate?.([250, 120, 250, 120, 500]);
  } catch {
    // ignoré
  }
}

export type NotificationSupport = 'unsupported' | 'default' | 'granted' | 'denied';

export function notificationSupport(): NotificationSupport {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/** À appeler depuis un tap (obligatoire sur iOS, et seulement dans une app installée). */
export async function requestNotifications(): Promise<NotificationSupport> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationSupport();
  }
}

async function showNotification(): Promise<void> {
  if (notificationSupport() !== 'granted') return;
  const title = 'Repos terminé';
  const options = { body: 'C’est reparti : prochaine série !', tag: 'atlas-rest-timer' };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch {
    // ignoré
  }
}

/** Déclenche l'alerte de fin de repos selon les préférences. */
export function alertRestOver(prefs: AlertPrefs): void {
  if (prefs.sound) playBeep();
  if (prefs.vibrate) vibrateDevice();
  if (prefs.notify) void showNotification();
}
