import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ciqualFoodRepo, foodLogEntryRepo, foodRepo } from '@/data';
import { Button, Card, EmptyState, Input, ListRow, Tabs } from '@/ui';
import { foodToHit, OFF_URL, per100Text, SOURCE_LABELS } from '../format';
import type { FoodHit } from '../foods';
import type { FoodSearch } from './useFoodSearch';
import styles from './FoodBrowser.module.css';

export interface FoodBrowserProps {
  search: FoodSearch;
  onPick: (hit: FoodHit) => void;
  onCreate: () => void;
}

const LISTS = [
  { id: 'recent', label: 'Récents' },
  { id: 'mine', label: 'Mes aliments' },
] as const;

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}
const isOnline = () => navigator.onLine;

function HitRow({ hit, onPick }: { hit: FoodHit; onPick: (hit: FoodHit) => void }) {
  return (
    <ListRow
      title={hit.brand ? `${hit.name} · ${hit.brand}` : hit.name}
      subtitle={per100Text(hit)}
      trailing={<span className={styles.source}>{SOURCE_LABELS[hit.source]}</span>}
      onClick={() => onPick(hit)}
    />
  );
}

/** Recherche d'aliments + listes « Récents » et « Mes aliments ». */
export function FoodBrowser({ search, onPick, onCreate }: FoodBrowserProps) {
  const { query, setQuery, outcome, loading, canSearch, searchOnline } = search;
  const [list, setList] = useState<(typeof LISTS)[number]['id']>('recent');
  const online = useSyncExternalStore(subscribeOnline, isOnline, () => true);
  const ciqualCount = useLiveQuery(() => ciqualFoodRepo.count(), []);
  const myFoods = useLiveQuery(() => foodRepo.list(), []);
  const entries = useLiveQuery(() => foodLogEntryRepo.list(), []);

  const mine = [...(myFoods ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const recentIds: string[] = [];
  for (const entry of [...(entries ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (!recentIds.includes(entry.foodId)) recentIds.push(entry.foodId);
  }
  const byId = new Map(mine.map((food) => [food.id, food]));
  const recent = recentIds.slice(0, 15).flatMap((id) => byId.get(id) ?? []);
  const listed = (list === 'recent' ? recent : mine).map(foodToHit);

  const hits = outcome?.hits ?? [];
  const hasOff = hits.some((hit) => hit.source === 'openfoodfacts');
  const remote = outcome?.remote ?? 'skipped';

  return (
    <div className={styles.browser}>
      <form
        className={styles.search}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void searchOnline();
        }}
      >
        <Input
          label="Rechercher un aliment"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Ex. blanc de poulet, riz, yaourt…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={!canSearch || loading || !online}>
          {loading ? 'Recherche…' : 'Chercher en ligne'}
        </Button>
      </form>

      {!online && (
        <p className={styles.notice} role="status">
          Tu es hors ligne : seuls tes aliments enregistrés et le catalogue CIQUAL sont disponibles.
        </p>
      )}
      {ciqualCount === 0 && (
        <p className={styles.notice}>
          Le catalogue CIQUAL n’est pas chargé. <Link to="/nutrition/catalogue">Le charger</Link>
        </p>
      )}

      {canSearch ? (
        <>
          {loading && (
            <p className={styles.notice} role="status">
              Recherche sur Open Food Facts…
            </p>
          )}
          {!loading && outcome && remote === 'ok' && (
            <p className={styles.notice} role="status">
              Recherche en ligne terminée.
            </p>
          )}
          {!loading &&
            outcome &&
            (remote === 'offline' || remote === 'error' || remote === 'rate_limited') && (
              <p className={styles.warning} role="alert">
                {outcome.message ?? 'Open Food Facts ne répond pas.'} Les résultats ci-dessous
                viennent de ce qui est déjà enregistré.
              </p>
            )}
          {!loading && outcome && remote === 'skipped' && online && (
            <p className={styles.notice}>
              Résultats de tes aliments et de CIQUAL. Touche « Chercher en ligne » pour ajouter ceux
              d’Open Food Facts.
            </p>
          )}
          {outcome && hits.length === 0 && !loading && (
            <EmptyState
              icon="nutrition"
              title="Aucun résultat"
              message="Essaie un autre mot, cherche en ligne, ou crée l’aliment toi-même."
            />
          )}
          {hits.length > 0 && (
            <Card flush aria-label="Résultats">
              {hits.map((hit) => (
                <HitRow
                  key={`${hit.source}:${hit.foodId ?? hit.barcode ?? hit.name}:${hit.brand}`}
                  hit={hit}
                  onPick={onPick}
                />
              ))}
            </Card>
          )}
          {hasOff && (
            <p className={styles.credit}>
              Données :{' '}
              <a href={OFF_URL} target="_blank" rel="noreferrer">
                Open Food Facts
              </a>
            </p>
          )}
        </>
      ) : (
        <>
          <Tabs label="Liste d’aliments" items={LISTS} value={list} onChange={setList} />
          {listed.length === 0 ? (
            <EmptyState
              icon="nutrition"
              title={list === 'recent' ? 'Rien de récent' : 'Aucun aliment enregistré'}
              message="Cherche un aliment ci-dessus ou crée le tien : il apparaîtra ici."
            />
          ) : (
            <Card flush aria-label={list === 'recent' ? 'Aliments récents' : 'Mes aliments'}>
              {listed.map((hit) => (
                <HitRow key={hit.foodId} hit={hit} onPick={onPick} />
              ))}
            </Card>
          )}
        </>
      )}

      <Button variant="ghost" block onClick={onCreate}>
        Créer un aliment à la main
      </Button>
    </div>
  );
}
