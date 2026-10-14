# Demandes du lot Suivi au lot 0

Ce fichier liste ce dont le lot « Suivi » a besoin **en dehors de son dossier**
(`src/features/tracking/`). Rien n'a été modifié ailleurs ; chaque point a une solution de repli
déjà en place dans le lot, qui pourra être retirée une fois la demande traitée.

## 1. Conversion cm ↔ pouces dans `@/data` (utile)

`kgToUnit` / `unitToKg` existent dans `src/data/training/format.ts`, mais rien pour les longueurs
(`Settings.lengthUnit` : `cm` | `in`). Le lot a écrit `cmToUnit` / `unitToCm`
(`src/features/tracking/logic/body.ts`, testées) pour afficher et saisir les mensurations.
Proposition : les déplacer dans `src/data/training/format.ts` à côté de leurs jumelles (et les
exporter depuis `@/data`), pour que les autres lots affichent les longueurs de la même façon.

## 2. Valeur de départ d'un objectif (facultatif)

`Goal` n'a pas de champ « valeur de départ ». Le lot la déduit : dernière mesure au plus tard le
jour de création de l'objectif (ou la première mesure après). Conséquence : un objectif créé
alors que la cible est déjà dépassée est vu comme un objectif « dans l'autre sens » ; et on ne peut
pas choisir un autre point de départ (ex. « je suis parti de 90 kg l'an dernier »).
Proposition : ajouter `startValue: number | null` (facultatif, défaut `null`, migration version 3)
au schéma `Goal`. Le lot l'utiliserait en priorité quand il est renseigné.

## 3. Sélecteur d'exercice partagé dans `@/ui` (confort)

Le lot Entraînement (`ExercisePicker`) et le lot Suivi (`ExerciseList` / `ExerciseSearchSheet`)
ont chacun leur sélecteur d'exercice avec recherche par nom ou alias (la règle « un lot = son
dossier » interdit de se les partager). Si un composant commun voit le jour dans `@/ui`, les deux
lots pourront retirer le leur. Ce composant devrait accepter : une liste d'exercices, un filtre,
un libellé secondaire par exercice (ici : nombre de séances).

## 4. Onglets plus longs dans `Tabs` (confort)

`Tabs` répartit ses éléments à largeur égale et tronque le texte (« MENSURA… » à 390 px avec
4 éléments). Le lot a donc nommé le sous-onglet « Mesures » au lieu de « Mensurations ». Un mode
défilant (ou la réduction de la police) permettrait d'écrire le nom complet.

## 5. Rien à faire (information)

- Aucune nouvelle dépendance npm : les courbes sont dessinées en SVG par le lot.
- Aucune migration de base : le lot lit `bodyMetrics`, `goals`, `workoutSessions`, `setEntries`,
  `exercises`, `foods`, `foodLogEntries` et `settings`, et écrit seulement `bodyMetrics` et `goals`.
- Le lot garde un réglage en localStorage : `atlas.tracking.exercise` (dernier exercice regardé dans
  l'onglet Charges). Simple confort : l'onglet fonctionne sans.
