# Demandes au lot 0 (fondations)

Changements nécessaires hors de `src/features/exercises/content/` (voir `docs/CONTRACTS.md` §1).

## 1. Brancher le chargement du catalogue au démarrage (à faire)

Le catalogue des 120 fiches est prêt : `EXERCISE_CATALOG` et la fonction `loadExerciseCatalog()`
(fichier `src/features/exercises/content/index.ts`).

Il faut appeler `loadExerciseCatalog()` une fois au démarrage de l'app, **après**
`seedDemoData()` (dans `src/main.tsx`) :

```ts
import { loadExerciseCatalog } from '@/features/exercises/content';
await seedDemoData();
await loadExerciseCatalog();
```

Comportement : ajoute les fiches absentes, met à jour les autres (par identifiant), garde la date de
création, et **ne recrée pas** une fiche que l'utilisateur a supprimée. Relançable sans risque.
Attention : une mise à jour remplace le contenu de la fiche (nom, étapes…), donc une modification
faite à la main sur une fiche du catalogue serait écrasée au prochain démarrage.

Les 5 exercices de démonstration de `src/data/seed.ts` portent les mêmes identifiants que cinq fiches
du catalogue (noms plus précis : « Développé couché barre », « Tractions pronation », « Squat barre »,
« Curl haltères alternés », « Gainage planche »). Le catalogue prend donc le dessus sur la démo.
Une fois le chargement branché, `DEMO_EXERCISES` peut être conservé tel quel (sans effet).

## 2. Nouveau type de saisie « charge + distance » (suggestion)

Pour **Farmer carry**, **Marche du fermier** et **Sled push**, la charge compte autant que la
distance. Il n'existe que `distance` (sans charge). Ces fiches sont donc en `distance` pour l'instant.
Un type `weight_distance` dans `INPUT_TYPES` permettrait de saisir les deux.
(Même remarque, en moins important, pour un gainage lesté : `duration` seulement.)

## 3. Format des variations (information)

Chaque variation commence par « Plus facile : », « Plus difficile : » ou « Autre matériel : ».
Si l'écran des fiches veut faire des liens vers d'autres fiches, il faudra retirer ce préfixe à l'affichage.

## 4. Schéma de mouvement « cardio » et matériel « traîneau / cordes » (suggestion)

Les 12 schémas de mouvement ne couvrent pas le cardio ni quelques exercices (haussements d'épaules,
flexion de jambes aux machines). Choix actuels, à titre d'approximation :
course, marche inclinée, elliptique → `lunge` ; vélo → `squat` ; rameur → `horizontal_pull` ;
corde à sauter → `calves` ; battle ropes → `arm_raise` ; leg curl → `elbow_flexion` ;
leg extension → `squat` ; shrugs → `arm_raise`.
Ajouter par exemple `cardio` (et éventuellement `leg_flexion`, `leg_extension`) à `MOVEMENT_PATTERNS`
rendrait les filtres plus justes. De même, le traîneau (Sled push) est classé `machine` et les Battle
ropes `cardio`, faute de matériel dédié dans `EQUIPMENT`.
Si ces ajouts sont faits, il suffira de changer les valeurs dans les fiches concernées (identifiants inchangés).

## 5. Résistance des élastiques (information)

Les 5 fiches d'élastiques sont en saisie `reps` : la « charge » est la couleur/dureté de l'élastique.
Un champ libre « note » existe déjà sur `SetEntry` pour la préciser.
