# Demandes du lot Entraînement au lot 0

> **État après l'intégration de la vague B (lot L0-bis)**
>
> 1. Fait : la logique est dans `src/data/training/` (avec `recordFormat`), exportée par `@/data` ;
>    le lot l'importe de là.
> 2. Fait : `WorkoutSession.plan` (base version 2, `planItemSchema` dans `@/data`) ; l'ancien plan
>    du localStorage est repris par la migration ; `planStorage` est supprimé.
> 3. Fait : `findUnfinishedSession()` dans `@/data` (index `endedAt`) et bandeau « Reprendre ta
>    séance » sur Aujourd'hui.
> 4. Fait : index `endedAt`. Pas d'index composé (inutile à cette échelle).
> 5. Fait : icônes `plus` `minus` `check` `trash` `timer` et `NumberStepper` dans `@/ui` ; réglage
>    `Settings.defaultRestSeconds` (90 s) utilisé par le chrono et les programmes. Les préférences
>    d'alerte restent dans le localStorage du lot (non demandé). Distances : km (m pour
>    `weight_distance`), pas de miles.
> 6. Rien à faire (pas de serveur).

Ce fichier liste ce dont le lot « séances » a besoin **en dehors de son dossier**
(`src/features/workouts/`). Rien n'a été modifié ailleurs.

## 1. Déplacer la logique pure vers `src/data` (important)

Les fonctions suivantes sont pures (sans React, sans base de données) et testées. Le lot
« courbes » n'a pas le droit d'importer le dossier `workouts` : **le lot 0 doit les déplacer
vers `src/data`** (et les exporter depuis `@/data`), avec leurs tests.

Dossier source : `src/features/workouts/logic/`

| Fichier              | Fonctions utiles au lot courbes                                                            |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `oneRepMax.ts`       | `estimateOneRepMax` (Epley : charge × (1 + répétitions / 30))                              |
| `volume.ts`          | `sessionVolume`, `setVolume`, `workingSets` (échauffements exclus)                         |
| `records.ts`         | `detectRecords`, `exerciseRecords`, `RECORD_LABELS`, `RECORD_KINDS_BY_INPUT`               |
| `suggestion.ts`      | `suggestNextLoad`, `loadIncrement`                                                         |
| `lastPerformance.ts` | `lastPerformance`, `matchingLastSet`                                                       |
| `repRange.ts`        | `parseRepRange`, `formatRepRange` (nécessaire à `suggestNextLoad`)                         |
| `types.ts`           | `SetLike`, `SessionLike`, `InputType`                                                      |
| `format.ts`          | `formatNumber`, `formatWeight`, `kgToUnit`, `unitToKg`, `formatDuration`, `localDay`, etc. |

Une fois déplacées, le lot Entraînement remplacera ses imports `../logic` par `@/data`
(les autres fichiers de `logic/` — plan, chrono, calendrier, saisie — restent chez nous).

Conventions à connaître avant de réutiliser ces fonctions :

- Le **volume** = Σ charge × répétitions des séries de travail ; une série sans charge (poids du
  corps sans lest) vaut 0.
- Le **volume max** d'un exercice = meilleur volume de cet exercice sur **une séance**.
- Le **1RM** n'est pas calculé pour « poids du corps + lest » (on ne connaît pas le poids du corps).
- Un record n'est annoncé que s'il bat **strictement** un record existant (pas à la 1re fois).
- À 1 répétition, Epley donne charge × 1,033 (formule appliquée telle quelle).

## 2. Champ « plan » sur `WorkoutSession` (important)

La séance ne sait pas quels exercices étaient prévus, ajoutés, remplacés ou sautés tant qu'ils
n'ont pas de série. Aujourd'hui ce **plan est gardé dans le navigateur** (localStorage, clé
`atlas.workouts.plan.<id de séance>`), et reconstruit depuis le programme puis depuis les séries s'il
manque. Conséquences : il n'est pas dans la sauvegarde JSON, ni synchronisé entre appareils.

Demande : ajouter à `workoutSessionSchema` un champ `plan` (liste d'objets
`{ exerciseId, targetSets, targetReps, restSeconds, note, skipped }`, vide par défaut), avec la
migration Dexie correspondante. Le schéma Zod existe déjà côté lot : `planItemSchema` dans
`logic/plan.ts`.

## 3. Proposer la séance non terminée dès l'écran « Aujourd'hui »

La reprise est proposée à l'ouverture de l'onglet Entraînement. À la réouverture de l'app, l'écran
affiché est « Aujourd'hui » (lot 0). Demande : une fonction `findUnfinishedSession()` dans
`src/data` (aujourd'hui dans `src/features/workouts/data/sessionService.ts`) et un bandeau
« Reprendre ta séance » sur l'écran Aujourd'hui qui mène à `/entrainement/seance/<id>`.

## 4. Index de base de données (facultatif, pour plus tard)

- `workoutSessions` : ajouter `endedAt` à l'index pour retrouver les séances non terminées sans
  tout lire (aujourd'hui : filtre en mémoire, sans souci à l'échelle d'un usage personnel).
- `setEntries` : `sessionId` et `exerciseId` existent et suffisent. Un index composé
  `[exerciseId+sessionId]` n'est utile que si l'historique devient très gros.

## 5. Composants et réglages partagés (facultatif)

- **Icônes** dans `@/ui` : plus, moins, coche, corbeille, chrono (aujourd'hui des caractères `+`,
  `−`, `✓` et des mots).
- **Composant `NumberStepper`** (champ numérique avec − et +) : utile à d'autres lots (nutrition,
  mensurations). Version actuelle : `src/features/workouts/components/NumberStepper.tsx`.
- **Réglage « repos par défaut »** dans `Settings` (aujourd'hui 90 s en dur si le programme n'en
  précise pas) et préférences d'alerte (son, vibration, notification, écran allumé), aujourd'hui
  dans localStorage (`atlas.workouts.alerts`).
- **Conversion kg/lb** et formatage des nombres français : `kgToUnit`, `unitToKg`, `formatWeight`
  (dans la logique à déplacer, point 1) pour que tous les lots affichent pareil.
- **Distance** : la saisie se fait en km, le stockage reste en mètres. Si l'unité de longueur
  « pouces » doit s'appliquer aux distances (miles), à décider côté lot 0.

## 6. Notifications et chrono en arrière-plan

Aucune demande de code ici, mais à savoir : un chrono qui sonne écran verrouillé nécessite des
notifications « push » envoyées par un serveur (Web Push). L'app n'a pas de serveur ; ce n'est
donc pas possible aujourd'hui sur iPhone. Voir le rapport.
