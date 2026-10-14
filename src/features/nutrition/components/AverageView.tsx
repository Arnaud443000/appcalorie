import { useEffect, useState } from 'react';
import { formatNumber, type Food } from '@/data';
import { Button, Card, Input } from '@/ui';
import { OFF_URL } from '../format';
import {
  aggregateFoods,
  compareWithReference,
  CONFIDENCE_LABELS,
  detectFoodState,
  openFoodFacts,
  REJECTION_LABELS,
  saveAggregatedFood,
  type AggregateResult,
  type FoodHit,
  type NutrientKey,
} from '../foods';
import { defaultAverageName } from '../logic';
import styles from './AverageView.module.css';

export interface AverageViewProps {
  /** Texte cherché (ex. « blanc de poulet ») : les produits de plusieurs marques en sont tirés. */
  query: string;
  /** Résultat CIQUAL proche, pour comparer (facultatif). */
  reference: FoodHit | null;
  onBack: () => void;
  onSaved: (food: Food) => void;
}

const ROWS: { key: NutrientKey; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'proteinG', label: 'Protéines', unit: 'g' },
  { key: 'carbsG', label: 'Glucides', unit: 'g' },
  { key: 'fatG', label: 'Lipides', unit: 'g' },
  { key: 'fiberG', label: 'Fibres', unit: 'g' },
];

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; result: AggregateResult };

/** Moyenne de plusieurs marques : calcul, détail (fourchette, confiance, produits écartés) puis enregistrement. */
export function AverageView({ query, reference, onBack, onSaved }: AverageViewProps) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [name, setName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Chaque nouvelle tentative (bouton « Réessayer ») relance la recherche.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void openFoodFacts.searchProducts(query, 50).then((response) => {
      if (cancelled) return;
      if (!response.ok) {
        setLoad({ status: 'error', message: response.message });
        return;
      }
      // L'état voulu est celui de la recherche (« poulet cru ») ; sinon le plus fréquent gagne.
      const wanted = detectFoodState(query, '');
      const result = aggregateFoods(response.data, wanted === 'unknown' ? {} : { state: wanted });
      setName(defaultAverageName(query, result.state));
      setLoad({ status: 'done', result });
    });
    return () => {
      cancelled = true;
    };
  }, [query, attempt]);

  function retry() {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }

  if (load.status === 'loading') {
    return (
      <div className={styles.view}>
        <p role="status">Recherche des produits de plusieurs marques…</p>
      </div>
    );
  }

  if (load.status === 'error') {
    return (
      <div className={styles.view}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Retour
        </button>
        <p role="alert" className={styles.error}>
          {load.message}
        </p>
        <Button variant="secondary" block onClick={retry}>
          Réessayer
        </Button>
      </div>
    );
  }

  const { result } = load;
  const comparison = reference
    ? compareWithReference(result.nutrients, {
        kcal: reference.kcal,
        proteinG: reference.proteinG,
        carbsG: reference.carbsG,
        fatG: reference.fatG,
        fiberG: reference.fiberG,
      })
    : null;
  const usable = ROWS.slice(0, 4).every(({ key }) => result.nutrients[key] !== null);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const { food } = await saveAggregatedFood(result, name);
      onSaved(food);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className={styles.view}>
      <button type="button" className={styles.back} onClick={onBack}>
        ← Retour
      </button>
      <h3 className={styles.title}>Moyenne de plusieurs marques</h3>

      <p className={styles.counts} aria-label="Produits">
        <strong>{result.keptCount}</strong> produit{result.keptCount > 1 ? 's' : ''} retenu
        {result.keptCount > 1 ? 's' : ''} · <strong>{result.rejected.length}</strong> écarté
        {result.rejected.length > 1 ? 's' : ''}
      </p>

      {usable ? (
        <>
          <Card className={styles.card} aria-label="Valeurs moyennes pour 100 g">
            <p className={styles.caption}>Valeur moyenne pour 100 g (fourchette min–max)</p>
            <dl className={styles.values}>
              {ROWS.map(({ key, label, unit }) => {
                const stat = result.nutrients[key];
                if (!stat) return null;
                return (
                  <div key={key} className={styles.valueRow}>
                    <dt>{label}</dt>
                    <dd>
                      <strong>
                        {formatNumber(stat.value)} {unit}
                      </strong>
                      <span className={styles.range}>
                        {' '}
                        ({formatNumber(stat.min)}–{formatNumber(stat.max)})
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>

          <Card className={styles.card} aria-label="Confiance">
            <p className={styles.confidence}>
              Niveau de confiance : <strong>{CONFIDENCE_LABELS[result.confidence]}</strong>
            </p>
            <ul className={styles.reasons}>
              {result.confidenceReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {comparison && (
              <p className={styles.caption}>
                {comparison.consistent
                  ? 'Proche de la valeur CIQUAL de référence.'
                  : 'Écart notable avec la valeur CIQUAL de référence : vérifie que c’est bien le même aliment (cru ou cuit).'}
              </p>
            )}
          </Card>
        </>
      ) : (
        <p role="alert" className={styles.error}>
          Aucun produit utilisable n’a été retenu : impossible de calculer une moyenne fiable.
        </p>
      )}

      {result.rejected.length > 0 && (
        <details className={styles.rejected}>
          <summary>Produits écartés ({result.rejected.length})</summary>
          <ul>
            {result.rejected.map(({ product, reason, detail }, index) => (
              <li key={`${product.barcode ?? product.name}-${index}`}>
                <strong>
                  {product.brand ? `${product.name} · ${product.brand}` : product.name}
                </strong>
                <br />
                <span className={styles.range}>
                  {REJECTION_LABELS[reason]} — {detail}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {usable && (
        <>
          <Input label="Nom de l’aliment" value={name} onChange={(e) => setName(e.target.value)} />
          {saveError && (
            <p role="alert" className={styles.error}>
              {saveError}
            </p>
          )}
          <Button block disabled={saving || name.trim() === ''} onClick={() => void save()}>
            Enregistrer cette moyenne
          </Button>
        </>
      )}
      <p className={styles.caption}>
        Données :{' '}
        <a href={OFF_URL} target="_blank" rel="noreferrer">
          Open Food Facts
        </a>
      </p>
    </div>
  );
}
