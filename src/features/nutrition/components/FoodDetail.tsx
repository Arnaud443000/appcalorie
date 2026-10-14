import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  foodLogEntryRepo,
  foodRepo,
  formatField,
  formatNumber,
  parseDecimal,
  type MealTypeId,
} from '@/data';
import { Button, Card, NumberStepper, Stat, useToast } from '@/ui';
import { gramsText, kcalText, macrosText, OFF_URL, SOURCE_LABELS } from '../format';
import { hitToNewFood, type FoodHit } from '../foods';
import { nutritionFor, roundNutrition, validGrams } from '../logic';
import { AverageBadge } from './FoodTag';
import { QuickPortions } from './QuickPortions';
import styles from './FoodDetail.module.css';

export interface FoodDetailProps {
  hit: FoodHit;
  day: string;
  mealType: MealTypeId;
  mealLabel: string;
  onBack: () => void;
  /** Appelé une fois l'aliment ajouté au journal. */
  onAdded: () => void;
  /** Lance le calcul de la moyenne de plusieurs marques (résultats Open Food Facts seulement). */
  onAverage: () => void;
}

/** Résultat détaillé + saisie de la quantité en grammes. */
export function FoodDetail({
  hit,
  day,
  mealType,
  mealLabel,
  onBack,
  onAdded,
  onAverage,
}: FoodDetailProps) {
  const toast = useToast();
  const [text, setText] = useState(formatField(hit.servingG ?? 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = useLiveQuery(
    () => (hit.foodId ? foodRepo.get(hit.foodId) : Promise.resolve(undefined)),
    [hit.foodId],
  );

  const grams = validGrams(parseDecimal(text));
  const n = grams === null ? null : roundNutrition(nutritionFor(hit, grams));
  const range = saved?.average?.ranges['kcal'];

  async function add() {
    if (grams === null) return;
    setBusy(true);
    setError(null);
    try {
      // Un résultat externe (CIQUAL, Open Food Facts) est enregistré dans « Mes aliments » à ce moment-là.
      const foodId = hit.foodId ?? (await foodRepo.create(hitToNewFood(hit))).id;
      await foodLogEntryRepo.create({ date: day, mealType, foodId, grams });
      toast.show(`Ajouté à ${mealLabel} : ${hit.name}`);
      onAdded();
    } catch {
      setError('Impossible d’ajouter cet aliment. Réessaie.');
      setBusy(false);
    }
  }

  return (
    <div className={styles.detail}>
      <button type="button" className={styles.back} onClick={onBack}>
        ← Retour aux résultats
      </button>

      <div>
        <h3 className={styles.name}>{hit.name}</h3>
        <p className={styles.meta}>
          {hit.brand && `${hit.brand} · `}
          {SOURCE_LABELS[hit.source]}
        </p>
        {saved && <AverageBadge food={saved} />}
      </div>

      <Card className={styles.values} aria-label="Valeurs pour 100 g">
        <p className={styles.caption}>Pour 100 g</p>
        <div className={styles.stats}>
          <Stat label="Calories" value={formatNumber(hit.kcal)} unit="kcal" />
          <Stat label="Protéines" value={formatNumber(hit.proteinG)} unit="g" />
          <Stat label="Glucides" value={formatNumber(hit.carbsG)} unit="g" />
          <Stat label="Lipides" value={formatNumber(hit.fatG)} unit="g" />
          <Stat
            label="Fibres"
            value={hit.fiberG === null ? '—' : formatNumber(hit.fiberG)}
            unit={hit.fiberG === null ? undefined : 'g'}
          />
        </div>
        {range && saved?.average && (
          <p className={styles.range}>
            Fourchette : {formatNumber(range.min)} à {formatNumber(range.max)} kcal pour 100 g, sur{' '}
            {saved.average.sourceCount} produit{saved.average.sourceCount > 1 ? 's' : ''}.
          </p>
        )}
        {hit.source === 'openfoodfacts' && (
          <p className={styles.range}>
            Données :{' '}
            <a href={OFF_URL} target="_blank" rel="noreferrer">
              Open Food Facts
            </a>
          </p>
        )}
      </Card>

      <NumberStepper
        label="Quantité (g)"
        value={text}
        onChange={setText}
        step={10}
        min={0}
        max={5000}
      />
      <QuickPortions servingG={hit.servingG} value={text} onPick={setText} />
      <p className={styles.summary} aria-live="polite">
        {n
          ? `${gramsText(grams ?? 0)} : ${kcalText(n.kcal)} · ${macrosText(n)}`
          : 'Saisis une quantité en grammes (entre 1 et 5 000).'}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button block disabled={grams === null || busy} onClick={() => void add()}>
        Ajouter à {mealLabel}
      </Button>
      {hit.source === 'openfoodfacts' && (
        <Button variant="secondary" block onClick={onAverage}>
          Moyenne de plusieurs marques
        </Button>
      )}
    </div>
  );
}
