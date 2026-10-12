# Atlas Muscu

Application personnelle de musculation et de nutrition, en français, pour iPhone.
C'est une web app installable (PWA) : elle s'ajoute à l'écran d'accueil comme une vraie app
et fonctionne sans réseau. Les données restent sur le téléphone (aucun compte, aucun serveur).

> Vague B intégrée (branche `integration-vague-b`) : fondations, 120 fiches d'exercices,
> séances et programmes, logique des aliments. Les développeurs des lots suivants lisent
> d'abord [`docs/CONTRACTS.md`](docs/CONTRACTS.md).

## Prérequis

[Node.js](https://nodejs.org/) version 22 ou plus.

```bash
npm install
```

## Lancer l'app sur l'ordinateur

```bash
npm run dev
```

Puis ouvrir l'adresse affichée (http://localhost:5173).
Pour voir le rendu iPhone dans Chrome : clic droit → Inspecter → icône téléphone, choisir « iPhone 14 ».

## Commandes

| Commande                  | Effet                                                            |
| ------------------------- | ---------------------------------------------------------------- |
| `npm run dev`             | Lance l'app en mode développement                                |
| `npm run build`           | Fabrique la version finale dans `dist/`                          |
| `npm run preview`         | Sert la version finale (pour tester le mode hors ligne)          |
| `npm test`                | Lance les tests automatiques                                     |
| `npm run typecheck`       | Vérifie les types TypeScript                                     |
| `npm run lint`            | Vérifie la qualité et la mise en forme du code                   |
| `npm run format`          | Remet le code en forme automatiquement                           |
| `npm run images:manifest` | Met à jour la liste des images d'exercices (`public/exercises/`) |

## Tester

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Les tests vérifient notamment : les fonctions de lecture/écriture de chaque type de donnée,
l'export puis l'import d'une sauvegarde (données identiques), la navigation entre les 5 onglets,
les composants, et l'absence de couleur écrite en dur hors du fichier de tokens.

## Mise en ligne (GitHub Pages)

Chaque push sur `main`, `lot-0-fondations` ou `integration-vague-b` déclenche le workflow
`.github/workflows/deploy.yml` : il vérifie le code puis publie l'app sur
`https://<compte>.github.io/appcalorie/`.
Réglage à faire une seule fois : dépôt GitHub → **Settings** → **Pages** →
**Build and deployment** → **Source** : choisir **GitHub Actions**.

## Installer sur l'iPhone

1. Sur l'iPhone, ouvrir **Safari** (pas Chrome) à l'adresse GitHub Pages ci-dessus.
2. Toucher le bouton **Partager** (carré avec une flèche vers le haut).
3. Choisir **Sur l'écran d'accueil**, puis **Ajouter**.
4. Ouvrir Atlas Muscu depuis l'icône : l'app s'affiche en plein écran, sans barre Safari.

Après une première ouverture avec réseau, l'app fonctionne en mode avion.
Les mises à jour s'installent toutes seules à l'ouverture suivante, quand le réseau est là.

## Ajouter les images des exercices

Déposer les fichiers WebP dans `public/exercises/` en suivant la convention décrite dans
[`public/exercises/README.md`](public/exercises/README.md) (`<nom>_depart.webp`, `<nom>_fin.webp`,
`<nom>_unique.webp`), puis lancer `npm run images:manifest` (fait aussi à chaque build).

## Sauvegarder ses données

Les données sont stockées dans l'app, sur l'iPhone uniquement. Supprimer l'app de l'écran
d'accueil efface ses données.
Réglages (roue dentée en haut à droite d'« Aujourd'hui ») → **Exporter mes données** :
enregistrer le fichier dans « Fichiers » ou iCloud Drive.
**Importer une sauvegarde** remplace toutes les données par celles du fichier.
