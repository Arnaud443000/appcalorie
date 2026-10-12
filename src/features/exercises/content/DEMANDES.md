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
