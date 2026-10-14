# Demandes du lot Atlas 3D

Changements hors de `src/features/exercises/atlas/`, déjà faits (exceptions autorisées) ou à faire.

## Faits dans ce lot (exceptions autorisées)

1. **Dépendance `three` 0.186.1** (sortie le 24/09/2026), version exacte, et **`@types/three`
   0.186.0** en dépendance de développement (indispensable au typage).
2. **Copie du modèle** dans `public/atlas3d/` (`muscles_q.bin`, `muscles_q.json`).
3. **`vite.config.ts`** : `atlas3d/**` exclu du précache (8 Mo à l'installation, non) et règle
   « premier servi » (`CacheFirst`, cache `atlas3d`) pour le garder hors ligne dès la première
   ouverture.
4. **Formatage Prettier** de `assets/atlas3d/muscles_q.json` et `viewer-prototype.html` (venus de
   la branche `atlas-3d-assets`, ils faisaient échouer `npm run lint`) : contenu identique.

## À faire par le lot Fiches

- **Brancher l'écran** : dans `src/features/exercises/routes.tsx`,
  `{ path: 'atlas', element: <AtlasScreen /> }` (import depuis `./atlas`). Le code 3D reste
  chargé paresseusement par l'Atlas lui-même.
- **Liens** : depuis la liste des exercices, un accès « Atlas 3D » ; depuis une fiche,
  « Voir les muscles en 3D » vers `atlasPath('/exercices/atlas', { exerciseId })`.

## À faire par le lot 0

- **README des assets** (`assets/atlas3d/README.md`) : corriger le format annoncé. Réel : positions
  **Int16** (`min + (valeur + 32768) × scale`), indices **Uint16** (pas Uint16 / Uint32).
- **Modèle en double** dans le dépôt (`assets/atlas3d/` et `public/atlas3d/`, 2 × 8 Mo) : garder
  les scripts et le README dans `assets/`, mais supprimer le `.bin`/`.json` de `assets/` si
  personne n'en a besoin.
- **Avertissement de build** : le morceau de la vue 3D (Three.js) dépasse 500 Ko (548 Ko,
  139 Ko gzip). Sans conséquence (chargé seulement à l'ouverture de l'Atlas). Si on veut le
  faire taire : `build.chunkSizeWarningLimit: 600` ou un groupe `three` dans `codeSplitting`.
- **`docs/CONTRACTS.md`** : mentionner `public/atlas3d/`, la dépendance `three`, le cache
  `atlas3d` du service worker et l'adresse `#/exercices/atlas?muscle=…|exercice=…`.
- Facultatif : un token `--color-atlas-muscle` (aujourd'hui `--color-text` assombri à 78 %) et
  une icône « recentrer » dans `@/ui`.
- Licence : l'app affiche la mention BodyParts3D (CC BY-SA 2.1 JP) dans la feuille de l'Atlas ;
  à reprendre dans la page « À propos » si elle existe un jour.
