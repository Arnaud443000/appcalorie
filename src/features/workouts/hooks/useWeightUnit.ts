import { useEffect, useState } from 'react';
import { getSettings, type WeightUnit } from '@/data';

/** Unité d'affichage des charges, d'après les Réglages (kg par défaut). Le stockage reste en kg. */
export function useWeightUnit(): WeightUnit {
  const [unit, setUnit] = useState<WeightUnit>('kg');
  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (active) setUnit(settings.weightUnit);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return unit;
}
