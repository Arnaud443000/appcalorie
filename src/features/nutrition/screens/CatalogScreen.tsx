import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ciqualFoodRepo, formatNumber } from '@/data';
import { Button, Card, Screen } from '@/ui';
import { NutritionTabs } from '../components/NutritionTabs';
import { parseCiqualCsv, saveCiqualCatalog } from '../foods';
import { decodeCsv } from '../logic';
import styles from './CatalogScreen.module.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; fileName: string }
  | { kind: 'done'; count: number; skipped: number }
  | { kind: 'error'; message: string };

/** Catalogue CIQUAL : importer la table depuis un fichier CSV choisi sur l'appareil (#/nutrition/catalogue). */
export function CatalogScreen() {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const count = useLiveQuery(() => ciqualFoodRepo.count(), []);

  async function onFile(file: File) {
    setStatus({ kind: 'working', fileName: file.name });
    try {
      const parsed = parseCiqualCsv(decodeCsv(await file.arrayBuffer()));
      if (parsed.foods.length === 0) {
        throw new Error(
          'Aucun aliment exploitable dans ce fichier : il est vide ou n’a pas le format attendu.',
        );
      }
      await saveCiqualCatalog(parsed.foods);
      setStatus({ kind: 'done', count: parsed.foods.length, skipped: parsed.skipped });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Impossible de lire ce fichier.',
      });
    }
  }

  return (
    <Screen title="Nutrition">
      <div className={styles.page}>
        <NutritionTabs current="catalogue" />

        <Card aria-label="Catalogue chargé">
          <p className={styles.count}>
            {count === undefined
              ? '…'
              : count === 0
                ? 'Aucun catalogue chargé'
                : `${formatNumber(count)} aliments CIQUAL chargés`}
          </p>
          <p className={styles.note}>
            {count === 0
              ? 'Sans le catalogue CIQUAL, la recherche utilise seulement tes aliments et Open Food Facts (en ligne).'
              : 'Ils restent sur ton appareil et se retrouvent dans la recherche, même hors ligne.'}
          </p>
          <input
            ref={input}
            type="file"
            className={styles.file}
            accept=".csv,.txt,text/csv,text/plain"
            aria-label="Fichier CSV CIQUAL"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void onFile(file);
            }}
          />
          <Button block disabled={status.kind === 'working'} onClick={() => input.current?.click()}>
            {count ? 'Remplacer par un autre fichier' : 'Choisir le fichier CSV'}
          </Button>

          {status.kind === 'working' && (
            <p role="status" className={styles.note}>
              Lecture de « {status.fileName} »…
            </p>
          )}
          {status.kind === 'done' && (
            <p role="status" className={styles.success}>
              {formatNumber(status.count)} aliments chargés
              {status.skipped > 0 &&
                ` (${formatNumber(status.skipped)} ligne${status.skipped > 1 ? 's' : ''} ignorée${status.skipped > 1 ? 's' : ''} : valeurs manquantes)`}
              .
            </p>
          )}
          {status.kind === 'error' && (
            <p role="alert" className={styles.error}>
              {status.message}
            </p>
          )}
        </Card>

        <Card aria-label="Où trouver le fichier">
          <h2 className={styles.title}>Où trouver le fichier ?</h2>
          <ol className={styles.steps}>
            <li>
              Ouvre le site de l’Anses, table Ciqual :{' '}
              <a href="https://ciqual.anses.fr" target="_blank" rel="noreferrer">
                ciqual.anses.fr
              </a>
              , rubrique « Télécharger la table ».
            </li>
            <li>
              Récupère la table complète. Si elle est au format Excel, ouvre-la puis enregistre-la
              en « CSV UTF-8 ».
            </li>
            <li>Reviens ici, touche « Choisir le fichier CSV » et sélectionne-le.</li>
          </ol>
          <p className={styles.note}>
            Le fichier doit avoir une ligne d’en-têtes avec les colonnes d’aliment, de calories, de
            protéines, de glucides, de lipides et de fibres. S’il manque une colonne indispensable,
            l’import te le dit et ne change rien.
          </p>
          <p className={styles.note}>
            Source : Anses — Table de composition nutritionnelle des aliments Ciqual.
          </p>
        </Card>
      </div>
    </Screen>
  );
}
