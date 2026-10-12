# Atlas Muscu — Contrats entre les lots

**À lire en premier par chaque session qui travaille sur un lot.**
Le lot 0 (« Fondations ») fournit la coque, le design, les données et les règles.
Les lots suivants (fiches, corps 3D, séances, nutrition, courbes, MCP) travaillent en parallèle
en s'appuyant sur ce socle.

**État actuel : vague B intégrée** (branche `integration-vague-b`, lot « L0-bis ») —
fondations + lot 1 (120 fiches d'exercices) + lot 3 (séances et programmes) + lot 4 (logique des
aliments), avec les demandes de ces lots traitées (base en version 2, logique d'entraînement
partagée dans `@/data`, `NumberStepper` et icônes dans `@/ui`…). La vague suivante part de
cette branche.

## 1. Règle d'or

> **Un lot ne modifie que son dossier `src/features/<lot>/`.**

- `src/app`, `src/ui`, `src/data`, `docs/`, la config (`vite.config.ts`, `package.json`, etc.)
  appartiennent au lot 0. Un autre lot **ne les modifie pas**.
- Besoin d'un changement hors de son dossier (nouveau champ en base, nouveau composant partagé,
  nouvelle dépendance npm, nouvelle icône) ? Le noter dans `src/features/<lot>/DEMANDES.md`
  et le signaler dans le rapport de fin de lot. Le changement sera fait de façon coordonnée.
- Un lot n'importe **jamais** les fichiers d'un autre lot, ni la coque `src/app`. Ce qui doit
  être partagé passe par `src/data` (les données et la logique pure) ou `src/ui` (l'affichage).
  Un test le vérifie (`src/test/lot-boundaries.test.ts`) et échoue sinon.
- Seule la coque (`src/app`, `src/main.tsx`) importe les lots : leurs `routes.tsx`, et au
  démarrage les fonctions de chargement (`src/app/startup.ts`).

> **Rappel pour la vague suivante : un lot = son dossier.** Chaque lot ne touche que
> `src/features/<son lot>/` et écrit ses besoins dans son `DEMANDES.md`. Les demandes de la vague B
> sont traitées (voir l'état « Fait » dans chaque `DEMANDES.md`).

## 2. Structure des dossiers

```
src/
  main.tsx                 Démarrage : styles, préparation des données, routeur
  app/                     Coque (lot 0)
    startup.ts             prepareData() : démo, catalogue, mes programmes, CIQUAL (§9)
    router.tsx             Monte les routes de chaque lot sous son onglet
    AppLayout.tsx          Page + barre d'onglets + Toasts
    TabBar.tsx             Les 5 onglets du bas
    screens/               Aujourd'hui et Réglages
  ui/                      Système de design (lot 0)
    tokens.css             TOUS les tokens (couleurs, tailles, rayons…) — seul fichier avec des couleurs
    global.css             Polices, remise à zéro, focus, mouvement réduit
    components/            Composants partagés (dont NumberStepper)
    index.ts               Point d'entrée : import { Button } from '@/ui'
  data/                    Couche de données (lot 0)
    constants.ts           Muscles, schémas de mouvement, matériel… (identifiants stables)
    schemas.ts             Schémas Zod + types TypeScript
    migrations.ts          Versions de la base IndexedDB
    db.ts                  Base Dexie
    repository.ts          Fabrique de fonctions lecture/écriture
    repositories.ts        Un dépôt par entité, Profil, Réglages
    backup.ts              Export / import JSON
    seed.ts                5 exercices de démonstration
    program.ts             Mes 5 programmes (créés une fois au démarrage)
    sessions.ts            findUnfinishedSession()
    ciqual.ts              Table de référence CIQUAL (hors sauvegarde)
    images.ts              getExerciseImages() (images des exercices)
    training/              Logique pure d'entraînement : 1RM, volume, records, suggestion,
                           dernière performance, fourchettes, formatage (kg/lb, durées…)
    index.ts               Point d'entrée : import { exerciseRepo } from '@/data'
  features/
    exercises/             Onglet Exercices (lot fiches)        → #/exercices
      content/             Les 120 fiches (EXERCISE_CATALOG, loadExerciseCatalog)
    workouts/              Onglet Entraînement (lot séances)    → #/entrainement
    nutrition/             Onglet Nutrition (lot nutrition)     → #/nutrition
      foods/               Recherche d'aliments, CIQUAL, Open Food Facts, moyennes
    tracking/              Onglet Suivi (lot courbes)           → #/suivi
    ai/                    IA / serveur MCP (lot MCP)
  test/                    Configuration et outils de test
public/exercises/          Images des exercices + manifest.json (§10)
scripts/images-manifest.mjs  Génère public/exercises/manifest.json
docs/CONTRACTS.md          Ce document
```

## 3. Brancher ses écrans : `routes.tsx`

Chaque dossier d'onglet exporte un tableau de routes depuis `routes.tsx`.
`src/app/router.tsx` le monte déjà sous le chemin de l'onglet : **rien à modifier hors de son dossier**.

```tsx
// src/features/exercises/routes.tsx
export const exercisesRoutes: RouteObject[] = [
  { index: true, element: <ExercisesScreen /> }, //  #/exercices
  { path: ':exerciseId', element: <ExerciseDetailScreen /> }, //  #/exercices/<id>
];
```

- Routeur « hash » (`#/exercices/…`) : fonctionne sur GitHub Pages et hors ligne.
- Liens : chemins absolus, `<Link to="/exercices/123">`, ou `ListRow to="…"`.
- Noms des chemins en français sans accent (`/entrainement`, `/suivi`, `/reglages`).
- Le lot IA (`features/ai`) n'a pas d'onglet ; s'il lui faut un écran, il le demande (§1).

## 4. Conventions de nommage

| Quoi                       | Convention                                    | Exemple                        |
| -------------------------- | --------------------------------------------- | ------------------------------ |
| Composant React            | `PascalCase.tsx`, export nommé                | `ExerciseCard.tsx`             |
| Styles d'un composant      | module CSS du même nom                        | `ExerciseCard.module.css`      |
| Écran                      | suffixe `Screen`                              | `ExerciseDetailScreen.tsx`     |
| Hook                       | `useXxx.ts`                                   | `useRestTimer.ts`              |
| Test                       | à côté du fichier, `.test.ts(x)`              | `ExerciseCard.test.tsx`        |
| Variables, champs          | `camelCase`, en anglais                       | `primaryMuscles`               |
| Identifiants de constantes | `snake_case`, en anglais, **jamais renommés** | `lower_back`, `hip_hinge`      |
| Textes affichés            | en français, tutoiement                       | « Ajoute ta première série »   |
| Imports partagés           | via l'alias `@/` et les points d'entrée       | `from '@/ui'`, `from '@/data'` |

Unités **stockées** : kg, cm, secondes, mètres. La conversion (lb, pouces) se fait seulement à
l'affichage, d'après `getSettings()`.
Dates : date-heure ISO (`2026-10-12T08:30:00.000Z`) ; jour calendaire `AAAA-MM-JJ`.

## 5. Design

- **Aucune couleur écrite en dur** hors de `src/ui/tokens.css` (un test le vérifie et échoue sinon).
  Toujours `var(--color-…)`. Idem pour espacements (`--space-1` à `--space-6`), rayons
  (`--radius-sm` 12 px, `--radius-md` 14 px), polices, durées.
- Couleurs : `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-line`, `--color-text`,
  `--color-text-muted`, `--color-accent` (rouge), `--color-accent-2` (rose), `--color-on-accent`
  (texte posé sur du rouge), `--color-focus`, `--color-backdrop`.
- Titres : Barlow Condensed en majuscules (automatique sur `h1`, `h2`, `h3`). Texte : Barlow.
- Cibles tactiles ≥ 44 px (`--tap-min`). Focus visible conservé (ne jamais mettre `outline: none`
  sans remplacement). Animations via `--duration-*` (mises à 0 si l'utilisateur réduit les animations).
- Zones sûres iPhone : `--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right`.
  Le composant `Screen` les gère déjà, ainsi que la place de la barre d'onglets.
- Styles en modules CSS (`*.module.css`), pas de CSS global dans les lots.

## 6. Composants disponibles (`@/ui`)

| Composant       | Rôle                                        | Props principales                                                                                                 |
| --------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Screen`        | Mise en page d'un écran (en-tête + contenu) | `title`, `backTo?`, `action?`, `children`                                                                         |
| `Button`        | Bouton                                      | `variant` (`primary` · `secondary` · `ghost`), `block?`, + attributs `<button>`                                   |
| `Card`          | Bloc de contenu                             | `raised?`, `flush?` (sans marge, pour une liste)                                                                  |
| `Chip`          | Étiquette, ou filtre à bascule si `onClick` | `selected?`, `onClick?`                                                                                           |
| `Tabs`          | Sélecteur segmenté dans une page            | `items`, `value`, `onChange`, `label`                                                                             |
| `Input`         | Champ avec libellé, aide, erreur, unité     | `label`, `hint?`, `error?`, `suffix?`, + attributs `<input>`                                                      |
| `Sheet`         | Feuille modale qui monte du bas             | `open`, `onClose`, `title`, `children`                                                                            |
| `ListRow`       | Ligne de liste (lien, bouton ou statique)   | `title`, `subtitle?`, `leading?`, `trailing?`, `to?`, `onClick?`                                                  |
| `Stat`          | Chiffre clé                                 | `label`, `value`, `unit?`                                                                                         |
| `EmptyState`    | État vide                                   | `title`, `message?`, `icon?`, `action?`                                                                           |
| `Icon`          | Icône au trait (couleur du texte)           | `name` (voir ci-dessous), `size?`                                                                                 |
| `NumberStepper` | Champ numérique avec boutons − et + (44 px) | `label`, `value` (texte, « 62,5 »), `onChange`, `onCommit?`, `step`, `min?`, `max?`, `inputMode?`, `placeholder?` |
| `useToast()`    | Message court en bas d'écran                | `useToast().show('Séance enregistrée')`                                                                           |

Icônes : `today` `workout` `exercises` `nutrition` `tracking` `settings` `back` `chevron`
`plus` `minus` `check` `trash` `timer` (chrono).
`NumberStepper` accepte la virgule ou le point ; `onCommit` est appelé à la sortie du champ, sur
Entrée et à chaque − / + (la conversion du texte en nombre reste à l'appelant : `parseDecimal`).

## 7. Couche de données (`@/data`)

Stockage local IndexedDB via Dexie. Pas de serveur. Tout est validé par Zod à l'écriture.

### Entités

Chaque enregistrement a : `id` (UUID), `createdAt`, `updatedAt`, `deletedAt` (null si actif —
suppression douce, pour une future synchronisation cloud).

| Entité           | Table             | Dépôt                          | Champs propres                                                                                                                                                                                                      |
| ---------------- | ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Muscle`         | `muscles`         | `muscleRepo`                   | `name`, `group` (muscle fin rattaché à un groupe ; vide pour l'instant)                                                                                                                                             |
| `Exercise`       | `exercises`       | `exerciseRepo`                 | `name`, `aliases[]`, `equipment[]`, `primaryMuscles[]`, `secondaryMuscles[]`, `movementPattern`, `level`, `steps[]`, `mistakes[]`, `variations[]`, `loadAdvice`, `safety`, `inputType`, `imageSlug?` (§10)          |
| `Routine`        | `routines`        | `routineRepo`                  | `name`, `note`, `items[]` (`exerciseId`, `targetSets`, `targetReps`, `restSeconds`, `note`)                                                                                                                         |
| `WorkoutSession` | `workoutSessions` | `workoutSessionRepo`           | `routineId`, `name`, `startedAt`, `endedAt`, `note`, `plan[]` (`exerciseId`, `targetSets`, `targetReps`, `restSeconds`, `note`, `skipped`) — exercices prévus, `[]` par défaut                                      |
| `SetEntry`       | `setEntries`      | `setEntryRepo`                 | `sessionId`, `exerciseId`, `order`, `weight`, `reps`, `durationSeconds`, `distanceMeters`, `rpe`, `isWarmup`, `note`                                                                                                |
| `BodyMetric`     | `bodyMetrics`     | `bodyMetricRepo`               | `date`, `weightKg`, `waistCm`, `measurements` (cou, épaules, poitrine, bras…)                                                                                                                                       |
| `Food`           | `foods`           | `foodRepo`                     | `name`, `brand`, `barcode`, pour 100 g : `kcal`, `proteinG`, `carbsG`, `fatG`, `fiberG` ; `servingG` ; `source` (`manual` · `ciqual` · `openfoodfacts` · `average`, ou null) ; `average` (voir ci-dessous, ou null) |
| `Meal`           | `meals`           | `mealRepo`                     | repas enregistré réutilisable : `name`, `items[]` (`foodId`, `grams`)                                                                                                                                               |
| `FoodLogEntry`   | `foodLogEntries`  | `foodLogEntryRepo`             | `date`, `mealType`, `foodId`, `grams`                                                                                                                                                                               |
| `Goal`           | `goals`           | `goalRepo`                     | `type` (`weight` · `load` · `measurement` · `calories`), `targetValue`, `targetDate`, `exerciseId`, `measurement`                                                                                                   |
| `Profile`        | `profiles`        | `getProfile` / `saveProfile`   | `sex`, `age`, `heightCm`, `generalGoal` (un seul profil)                                                                                                                                                            |
| `Settings`       | `settings`        | `getSettings` / `saveSettings` | `weightUnit` (`kg`/`lb`), `lengthUnit` (`cm`/`in`), `defaultRestSeconds` (90) (un seul jeu)                                                                                                                         |
| `CiqualFood`     | `ciqualFoods`     | `ciqualFoodRepo`               | `id` (code CIQUAL), `name`, `category`, `kcal`, `proteinG`, `carbsG`, `fatG`, `fiberG` (null = inconnu). Donnée de référence : pas de champs communs, **hors sauvegarde**                                           |

Les types TypeScript portent le même nom (`import type { Exercise } from '@/data'`),
les schémas Zod sont `exerciseSchema`, `setEntrySchema`, etc. (`planItemSchema` / `PlanItem` pour
une ligne de plan, `foodAverageSchema` / `FoodAverage`, `ciqualFoodSchema` / `CiqualFood`).

`Food.average` (aliment calculé comme moyenne de plusieurs produits, lot aliments) :
`{ sourceCount, rejectedCount, confidence: 'low'|'medium'|'high', state: 'raw'|'cooked'|'unknown',
ranges: { kcal: { min, max }, proteinG: {…}, … }, computedAt }`.

Champs ajoutés en version 2 **facultatifs à la création** (`NewRecord`) : `plan` (→ `[]`),
`source` et `average` (→ `null`), `defaultRestSeconds` (→ 90). Les anciens enregistrements et les
anciennes sauvegardes reçoivent ces valeurs par défaut.

### Fonctions de chaque dépôt

```ts
const s = await setEntryRepo.create({
  sessionId,
  exerciseId,
  order: 0,
  weight: 60,
  reps: 8,
  durationSeconds: null,
  distanceMeters: null,
  rpe: null,
  isWarmup: false,
  note: '',
});
await setEntryRepo.get(id); // undefined si absent ou supprimé
await setEntryRepo.list(); // tous les actifs
await setEntryRepo.findBy('sessionId', sessionId); // via un index (voir migrations.ts)
await setEntryRepo.update(id, { reps: 10 }); // lecture + écriture dans une même transaction
await setEntryRepo.remove(id); // suppression douce
```

`ciqualFoodRepo` est à part : `replaceAll(foods)` (remplace toute la table, tout est validé
avant d'écrire), `list()`, `count()`.

Les listes ne sont pas triées : trier côté écran. Pour un affichage qui se met à jour tout seul :

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
const exercises = useLiveQuery(() => exerciseRepo.list(), []);
```

### Constantes partagées (`constants.ts`)

`MUSCLE_GROUPS` (15), `MOVEMENT_PATTERNS` (15), `EQUIPMENT` (8), `EXERCISE_LEVELS`, `INPUT_TYPES` (6),
`MEASUREMENTS`, `MEAL_TYPES`, `GOAL_TYPES`, `SEXES`, `GENERAL_GOALS`.
Chaque élément = `{ id, label }`. `labelOf(MUSCLE_GROUPS, 'lats')` → « Dorsaux ».
Les `id` sont enregistrés en base : **ne jamais les renommer ni les supprimer**.

Groupes musculaires : `chest` Pectoraux · `shoulders` Épaules · `biceps` · `triceps` ·
`forearms` Avant-bras · `abs` Abdos · `traps` Trapèzes · `lats` Dorsaux · `lower_back` Lombaires ·
`glutes` Fessiers · `quads` Quadriceps · `hamstrings` Ischio-jambiers · `adductors` Adducteurs ·
`calves` Mollets · `neck` Cou.

Schémas de mouvement : `horizontal_push` · `vertical_push` · `vertical_pull` · `horizontal_pull` ·
`elbow_flexion` · `elbow_extension` · `squat` (squat/presse) · `hip_hinge` · `lunge` · `arm_raise` ·
`core` (gainage/abdos) · `calves` · `cardio` · `leg_flexion` (leg curl) · `leg_extension`.

Matériel : `bodyweight` · `dumbbell` · `barbell` · `machine` · `cable` · `kettlebell` · `band` · `cardio`.

Types de saisie : `weight_reps` · `reps` · `duration` · `distance` · `bodyweight_load` ·
`weight_distance` (charge + distance : Farmer carry, Marche du fermier, Sled push ; distance
saisie en mètres, en km pour `distance`).

### Données de démonstration, catalogue et programmes

`DEMO_EXERCISES` : 5 exercices aux id fixes, ajoutés au démarrage s'ils manquent
(un exercice supprimé n'est pas recréé). Les 120 fiches du catalogue
(`src/features/exercises/content`, id `0d1e1a00-0000-4000-8000-<numéro sur 12 chiffres>`, 1 à 120)
reprennent ces 5 id avec un contenu complet et les remplacent au démarrage.

| Exercice         | id                                     |
| ---------------- | -------------------------------------- |
| Développé couché | `0d1e1a00-0000-4000-8000-000000000001` |
| Tractions        | `0d1e1a00-0000-4000-8000-000000000002` |
| Squat            | `0d1e1a00-0000-4000-8000-000000000003` |
| Curl haltères    | `0d1e1a00-0000-4000-8000-000000000004` |
| Gainage          | `0d1e1a00-0000-4000-8000-000000000005` |

`MY_PROGRAM` / `seedMyProgram()` : mes 5 programmes, créés **une seule fois** au démarrage
(id fixes `0d1e1a00-0000-4000-9000-00000000000<1 à 5>` : Lundi Push, Mardi Pull, Mercredi Jambes,
Jeudi Haut du corps, Vendredi Bas du corps). Un programme modifié n'est jamais réécrit, un
programme supprimé n'est pas recréé. Les exercices sont retrouvés par nom puis par alias
(`findExerciseByName`, `normalizeName` : sans accents ni majuscules) ; un nom introuvable est
signalé (`console.warn`) sans bloquer.

### Sauvegarde

`exportToJson()` / `importFromJson(json)` : tout le contenu de la base, y compris les
enregistrements supprimés en douceur. L'import remplace tout, et ne modifie rien si un seul
enregistrement est invalide. Format : `{ format: 'atlas-muscu-backup', schemaVersion, exportedAt, tables }`.
Les tables sauvegardées sont celles de `TABLE_SCHEMAS` : **`ciqualFoods` n'en fait pas partie**
(ni exportée, ni effacée par un import). Une sauvegarde de version 1 s'importe (nouveaux champs
complétés par leur valeur par défaut).

### Faire évoluer la base

Voir l'en-tête de `src/data/migrations.ts` : on ajoute une nouvelle version, on ne modifie
jamais une version publiée. Réservé au lot 0 (§1) pour éviter que deux lots créent chacun
une « version 3 ». Tester la migration depuis la version précédente (`migrations.test.ts`).

| Version | Contenu                                                                                                                                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Tables de départ                                                                                                                                                                                                        |
| 2       | `WorkoutSession.plan` (repris du localStorage `atlas.workouts.plan.<id>` s'il existe) et index `endedAt` ; `Food.source`, `Food.average` (null) ; `Settings.defaultRestSeconds` (90) ; table `ciqualFoods` (`id, name`) |

### Fonctions de `@/data` (en plus des dépôts)

| Fonction                                                | Rôle                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `findUnfinishedSession()`                               | Séance non terminée la plus récente (index `endedAt`), ou `undefined`                                        |
| `getExerciseImages(exercise)`                           | Images d'un exercice : `{ kind: 'pair', start, end }`, `{ kind: 'single', src }` ou `{ kind: 'none' }` (§10) |
| `seedDemoData()`, `seedMyProgram()`                     | Données créées au démarrage (voir ci-dessus)                                                                 |
| `findExerciseByName(list, nom)`, `normalizeName(texte)` | Recherche d'une fiche par nom ou alias, sans accents                                                         |

**Logique d'entraînement partagée** (`src/data/training/`, pure, testée — venue du lot séances) :

| Fichier              | Fonctions                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `oneRepMax.ts`       | `estimateOneRepMax(charge, reps)` (Epley : charge × (1 + reps / 30), null si incalculable)                                                                                                                                                                                           |
| `volume.ts`          | `setVolume`, `sessionVolume`, `workingSets` (échauffements exclus ; série sans charge = 0)                                                                                                                                                                                           |
| `records.ts`         | `exerciseRecords`, `detectRecords`, `RECORD_LABELS`, `RECORD_KINDS_BY_INPUT`                                                                                                                                                                                                         |
| `recordFormat.ts`    | `formatRecordValue(kind, valeur, unité)`                                                                                                                                                                                                                                             |
| `suggestion.ts`      | `suggestNextLoad`, `loadIncrement` (+2,5 kg, +1 kg aux haltères, si tout le haut de fourchette est atteint)                                                                                                                                                                          |
| `lastPerformance.ts` | `lastPerformance`, `matchingLastSet`                                                                                                                                                                                                                                                 |
| `repRange.ts`        | `parseRepRange` (« 8-12 » → { min, max }), `formatRepRange`                                                                                                                                                                                                                          |
| `types.ts`           | `SetLike`, `SessionLike`, `InputType` (= `InputTypeId`)                                                                                                                                                                                                                              |
| `format.ts`          | `formatNumber`, `parseDecimal`, `parseWholeNumber`, `formatField`, `stepText`, `kgToUnit`, `unitToKg`, `formatWeight`, `formatClock`, `formatDuration`, `formatDistance`, `formatSetSummary`, `localDay`, `dayFromDate`, `formatDay`, `formatMonth`, `formatTime`, type `WeightUnit` |

Conventions : le volume max d'un exercice est le meilleur volume sur **une** séance ; pas de 1RM
pour « poids du corps + lest » ; un record n'est annoncé que s'il bat **strictement** un record
existant. Tous les lots affichent les poids avec `formatWeight` / `kgToUnit` d'après
`getSettings().weightUnit`.

## 8. Avant chaque commit

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Tests : Vitest + Testing Library ; IndexedDB est simulée (`fake-indexeddb`).
`src/test/fixtures.ts` fournit `resetDb()` et un exemple valide par entité.
Deux tests de règles : aucune couleur en dur (`no-hardcoded-colors.test.ts`), aucun import
d'un lot vers un autre (`lot-boundaries.test.ts`).

## 9. Démarrage (`src/app/startup.ts`)

`prepareData()` est lancé par `main.tsx` sans bloquer l'affichage (les écrans se mettent à jour
seuls avec `useLiveQuery`), dans cet ordre :

1. `seedDemoData()` ;
2. `loadExerciseCatalog()` (lot fiches) : ajoute / met à jour les 120 fiches, ne recrée pas
   une fiche supprimée ;
3. `seedMyProgram()`, seulement si l'étape 2 a réussi ;
4. `restoreCiqualCatalog()` (lot aliments) : remet en mémoire le catalogue CIQUAL enregistré
   (`saveCiqualCatalog(parseCiqualCsv(texte).foods)` l'enregistre).

## 10. Images des exercices

- Fichiers dans `public/exercises/` : `<imageSlug>_depart.webp` et `<imageSlug>_fin.webp`, ou
  `<imageSlug>_unique.webp` pour un exercice statique (gainage). Voir `public/exercises/README.md`.
- `imageSlug` : champ facultatif de `Exercise` (minuscules, chiffres, tirets). Rempli pour les
  120 fiches : nom de la fiche sans accents, en minuscules, avec des tirets, sauf noms imposés
  pour les exercices du programme (`ecarte-poulie-vis-a-vis`, `crunch-poulie`,
  `developpe-militaire-halteres-assis` pour « Développé haltères assis »…).
- Un site statique ne pouvant pas lister un dossier, `npm run images:manifest` (lancé aussi par
  `npm run build`) écrit `public/exercises/manifest.json` :
  `{ "version": 1, "images": { "<slug>": ["depart", "fin"] } }`.
- Les écrans appellent `getExerciseImages(exercise)` (asynchrone, manifeste lu une fois) ;
  sans manifeste ou sans image : `{ kind: 'none' }`. Images et manifeste sont gardés hors ligne.

## 11. Ce qui reste hors du socle

Pas de notifications push (impossible sans serveur : le chrono ne sonne pas écran verrouillé),
pas de cloud. Préférences d'alerte du chrono et chrono en cours : localStorage du lot séances.
