# Atlas 3D (lot 2)

Corps anatomique en 3D (muscles, sans peau) : on le fait tourner, on touche un muscle, on voit
les exercices qui le travaillent.

## Brancher l'écran (lot Fiches)

```tsx
// src/features/exercises/routes.tsx — à ajouter par le lot Fiches
import { AtlasScreen } from './atlas';
{ path: 'atlas', element: <AtlasScreen /> }, // #/exercices/atlas
```

- `#/exercices/atlas?muscle=<groupe>` : groupe déjà choisi (ex. `?muscle=lats`).
- `#/exercices/atlas?exercice=<id>` : mode exercice (principaux en rouge, secondaires en rose).
- `atlasPath('/exercices/atlas', { exerciseId })` fabrique le lien depuis une fiche.
- `AtlasScreen` est léger : Three.js et le modèle ne sont chargés qu'à l'ouverture de l'écran
  (`import()` de `viewer/AtlasViewer`). Inutile de le charger paresseusement soi-même.
- En-tête : titre « Atlas 3D », retour vers `/exercices`.

## Organisation

| Fichier                  | Rôle                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| `AtlasScreen.tsx`        | Écran : puces, feuille du bas, lecture de l'adresse, détection WebGL   |
| `AtlasResults.tsx`       | Contenu de la feuille (exercices d'un groupe, muscles d'un exercice)   |
| `BottomSheet.tsx`        | Feuille du bas non modale (repliée : titre + résumé ; dépliée : liste) |
| `model.ts`               | Lecture du `.bin` quantifié, fusion par groupe (pur, sans Three.js)    |
| `loadModel.ts`           | Téléchargement avec progression (`?v=MODEL_VERSION` pour le cache)     |
| `muscleMap.ts`           | Groupes ↔ exercices, « sollicités aussi », vue préférée (pur)          |
| `params.ts`              | `?muscle=` / `?exercice=` (pur)                                        |
| `palette.ts`             | Couleurs lues dans les variables CSS à l'exécution                     |
| `viewer/AtlasViewer.tsx` | Vue 3D (chargée paresseusement) : canvas, boutons de vue, chargement   |
| `viewer/engine.ts`       | Scène Three.js, rendu à la demande, libération                         |
| `viewer/picking.ts`      | Choix du muscle touché (rayons sur la surface du doigt), pur et testé  |
| `viewer/head.ts`         | Tête et cou stylisés, d'un seul tenant                                 |
| `viewer/camera.ts`       | Cadrage, zoom ancré, vues (pur)                                        |
| `viewer/controls.ts`     | Gestes : tourner, pincer, molette, toucher, double toucher             |

## Choix

- **Format réel du `.bin`** : positions Int16 (`min + (valeur + 32768) × scale`), indices Uint16
  par muscle (le README des assets annonce Uint16 / Uint32 : c'est le script `pack.py` qui fait foi).
- **Un maillage par groupe** (15 appels de dessin + 1 pour la tête), trois matériaux partagés
  (repos, principal, secondaire). Chaque groupe garde la plage de triangles de chacun de ses
  muscles : le nom exact du muscle touché s'affiche (« Grand pectoral (faisceau sternocostal) »).
- **Choix du muscle touché** (`viewer/picking.ts`) : on choisit le muscle **visible**, la face
  tournée vers la caméra la plus proche sous le doigt (faces de dos ignorées explicitement,
  impacts triés par distance). Un rayon n'étant pas un doigt, 13 rayons sont lancés sur la
  surface du doigt (rayon 12 px) : le central l'emporte, sauf s'il est passé « à travers »
  (la majorité des autres trouvent une surface plus proche de plus de 1,5 cm : sillon du droit
  de l'abdomen absent, trou au creux des lombaires, bord de membre effleuré) ; on prend alors
  le groupe majoritaire devant. La tête fait écran (la toucher ne choisit rien).
- **Lancer de rayon rapide** : chaque muscle est rangé en tranches d'environ 1 000 triangles le
  long de son axe le plus long (`sliceTriangles`, tri par comptage, +20 à 40 ms au chargement) ;
  une cible invisible par tranche, avec sa boîte englobante, partage les tampons du groupe.
  Un toucher (13 rayons) coûte 12 à 15 ms au lieu de 150 à 200 ms.
- **Le corps tourne, la caméra et les lumières restent fixes** : l'éclairage est le même sous
  tous les angles. Muscles gris-blanc mats, lumière de contour (effet de Fresnel ajouté au
  matériau standard), fond en dégradé des tokens de surface.
- **Tête et cou** (`viewer/head.ts`) : le modèle s'arrête au cou. Une seule forme de mannequin
  (profil tourné, aplati, incliné vers l'avant), plus sombre que les muscles : le cou plonge
  entre trapèzes et sterno-cléido-mastoïdiens, qui montent jusqu'à l'angle de la mâchoire.
- **Rendu à la demande** : une image seulement quand quelque chose bouge (geste, transition) ;
  aucune boucle permanente. `pixelRatio` plafonné à 2.
- **Libération** : au départ de l'écran, géométries, matériaux, rendu et contexte WebGL sont
  libérés (`forceContextLoss`). Chaque montage crée son propre canvas.
- **« Sollicités aussi » (rose) en mode groupe** : groupes présents (principal ou secondaire)
  dans au moins 40 % des exercices où le groupe choisi est principal, 3 au plus.
- **Gauche / Droite** = côté gauche / droit du corps tourné vers toi.
- Un muscle touché sur le corps ne fait pas tourner la vue ; une puce (ou l'adresse) tourne le
  corps vers la face où le groupe se voit le mieux (dos pour dorsaux, trapèzes, lombaires,
  fessiers, ischios, mollets, triceps).
- Hors ligne : règle « premier servi » du service worker sur `atlas3d/` (cache `atlas3d`), donc
  rien à l'installation, puis disponible hors ligne après la première ouverture. Le code de la vue
  (Three.js compris) est précaché par le service worker comme les autres morceaux de l'app, en
  arrière-plan, mais n'est **jamais exécuté** avant l'ouverture de l'écran.

## Mesures (Chromium sans écran, WebGL logiciel SwiftShader, build de production)

| Quoi                                                      | Valeur                                          |
| --------------------------------------------------------- | ----------------------------------------------- |
| Modèle : `muscles_q.bin` + `muscles_q.json`               | 8,13 Mo + 37 Ko (gzip : 6,1 Mo + 9 Ko)          |
| Code de la vue (Three.js r186 + Atlas)                    | 548 Ko (139 Ko gzip)                            |
| Géométrie                                                 | 542 019 sommets, 813 396 triangles              |
| Requêtes Atlas au démarrage de l'app                      | 0                                               |
| 1re ouverture, 4G 20 Mb/s, processeur ralenti ×4          | 5,9 s jusqu'au corps affiché                    |
| 1re ouverture, 4G lente 9 Mb/s, processeur ralenti ×4     | 10,2 s                                          |
| Réouverture (cache), processeur normal / ralenti ×4       | 1,2 s / 2,3 s (préparation : 0,2–0,3 s / 0,9 s) |
| Hors ligne (réseau coupé), après une première visite      | 1,4 s                                           |
| Toucher un muscle → nom affiché (lancer de rayon + React) | 100–150 ms (WebGL logiciel)                     |
| Choix du muscle seul (13 rayons, Node)                    | 12–15 ms                                        |

La mesure interne `atlas3d:chargement` (`performance.measure`) couvre téléchargement + préparation
du modèle ; elle est lisible dans l'inspecteur de Safari sur iPhone.
