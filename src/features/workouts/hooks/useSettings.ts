import { useEffect, useState } from 'react';
import { getSettings, type Settings, type WeightUnit } from '@/data';
import { DEFAULT_REST_SECONDS } from '../logic';

/** Un réglage lu une fois à l'ouverture de l'écran (`fallback` en attendant). */
function useSetting<K extends keyof Settings>(key: K, fallback: Settings[K]): Settings[K] {
  const [value, setValue] = useState<Settings[K]>(fallback);
  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (active) setValue(settings[key]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [key]);
  return value;
}

/** Unité d'affichage des charges, d'après les Réglages (kg par défaut). Le stockage reste en kg. */
export function useWeightUnit(): WeightUnit {
  return useSetting('weightUnit', 'kg');
}

/** Repos entre deux séries quand le programme n'en précise pas (Réglages, 90 s par défaut). */
export function useDefaultRest(): number {
  return useSetting('defaultRestSeconds', DEFAULT_REST_SECONDS);
}
