import { useRef, useState, type ChangeEvent } from 'react';
import { exportToJson, importFromJson } from '@/data';
import { Button, Card, Screen, Sheet, useToast } from '@/ui';
import styles from './SettingsScreen.module.css';

async function shareOrDownload(json: string) {
  const fileName = `atlas-muscu-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], fileName, { type: 'application/json' });
  // Sur iPhone, le partage permet d'enregistrer le fichier dans « Fichiers ».
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Sauvegarde Atlas Muscu' });
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function SettingsScreen() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingJson, setPendingJson] = useState<string | null>(null);

  async function onExport() {
    try {
      await shareOrDownload(await exportToJson());
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.show('Export impossible.');
    }
  }

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setPendingJson(await file.text());
  }

  async function onConfirmImport() {
    if (pendingJson === null) return;
    setPendingJson(null);
    try {
      await importFromJson(pendingJson);
      toast.show('Sauvegarde importée.');
    } catch {
      toast.show('Fichier invalide : aucune donnée modifiée.');
    }
  }

  return (
    <Screen title="Réglages" backTo="/">
      <Card>
        <h2 className={styles.cardTitle}>Sauvegarde</h2>
        <p className={styles.text}>
          Tes données restent sur ce téléphone. Exporte-les régulièrement dans un fichier.
        </p>
        <div className={styles.actions}>
          <Button block onClick={onExport}>
            Exporter mes données
          </Button>
          <Button block variant="secondary" onClick={() => fileInput.current?.click()}>
            Importer une sauvegarde
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onFileChosen}
          />
        </div>
      </Card>

      <Sheet
        open={pendingJson !== null}
        onClose={() => setPendingJson(null)}
        title="Remplacer les données ?"
      >
        <div className={styles.actions}>
          <p className={styles.text}>
            Toutes les données actuelles seront remplacées par celles de la sauvegarde.
          </p>
          <Button block onClick={onConfirmImport}>
            Remplacer
          </Button>
          <Button block variant="secondary" onClick={() => setPendingJson(null)}>
            Annuler
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
