# Atlas Muscu — Contrats entre les lots

**À lire en premier par chaque session qui travaille sur un lot.**
Le lot 0 (« Fondations ») fournit la coque, le design, les données et les règles.
Les lots suivants (fiches, corps 3D, séances, nutrition, courbes, MCP) travaillent en parallèle
en s'appuyant sur ce socle.

## 1. Règle d'or

> **Un lot ne modifie que son dossier `src/features/<lot>/`.**

- `src/app`, `src/ui`, `src/data`, `docs/`, la config (`vite.config.ts`, `package.json`, etc.)
  appartiennent au lot 0. Un autre lot **ne les modifie pas**.
- Besoin d'un changement hors de son dossier (nouveau champ en base, nouveau composant partagé,
  nouvelle dépendance npm, nouvelle icône) ? Le noter dans `src/features/<lot>/DEMANDES.md`
  et le signaler dans le rapport de fin de lot. Le changement sera fait de façon coordonnée.
- Un lot n'importe **jamais** les fichiers d'un autre lot. Ce qui doit être partagé passe par
  `src/data` (les données) ou `src/ui` (l'affichage).

## 2. Structure des dossiers

```
src/
  main.tsx                 Démarrage : styles, données de démo, routeur
  app/                     Coque (lot 0)
    router.tsx             Monte les routes de chaque lot sous son onglet
    AppLayout.tsx          Page + barre d'onglets + Toasts
    TabBar.tsx             Les 5 onglets du bas
    screens/               Aujourd'hui et Réglages
  ui/                      Système de design (lot 0)
    tokens.css             TOUS les tokens (couleurs, tailles, rayons…) — seul fichier avec des couleurs
    global.css             Polices, remise à zéro, focus, mouvement réduit
    components/            Composants partagés
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
    index.ts               Point d'entrée : import { exerciseRepo } from '@/data'
  features/
    exercises/             Onglet Exercices (lot fiches)        → #/exercices
    workouts/              Onglet Entraînement (lot séances)    → #/entrainement
    nutrition/             Onglet Nutrition (lot nutrition)     → #/nutrition
    tracking/              Onglet Suivi (lot courbes)           → #/suivi
    ai/                    IA / serveur MCP (lot MCP)
  test/                    Configuration et outils de test
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

| Composant    | Rôle                                        | Props principales                                                                                  |
| ------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Screen`     | Mise en page d'un écran (en-tête + contenu) | `title`, `backTo?`, `action?`, `children`                                                          |
| `Button`     | Bouton                                      | `variant` (`primary` · `secondary` · `ghost`), `block?`, + attributs `<button>`                    |
| `Card`       | Bloc de contenu                             | `raised?`, `flush?` (sans marge, pour une liste)                                                   |
| `Chip`       | Étiquette, ou filtre à bascule si `onClick` | `selected?`, `onClick?`                                                                            |
| `Tabs`       | Sélecteur segmenté dans une page            | `items`, `value`, `onChange`, `label`                                                              |
| `Input`      | Champ avec libellé, aide, erreur, unité     | `label`, `hint?`, `error?`, `suffix?`, + attributs `<input>`                                       |
| `Sheet`      | Feuille modale qui monte du bas             | `open`, `onClose`, `title`, `children`                                                             |
| `ListRow`    | Ligne de liste (lien, bouton ou statique)   | `title`, `subtitle?`, `leading?`, `trailing?`, `to?`, `onClick?`                                   |
| `Stat`       | Chiffre clé                                 | `label`, `value`, `unit?`                                                                          |
| `EmptyState` | État vide                                   | `title`, `message?`, `icon?`, `action?`                                                            |
| `Icon`       | Icône au trait (couleur du texte)           | `name` (`today` `workout` `exercises` `nutrition` `tracking` `settings` `back` `chevron`), `size?` |
| `useToast()` | Message court en bas d'écran                | `useToast().show('Séance enregistrée')`                                                            |

## 7. Couche de données (`@/data`)

Stockage local IndexedDB via Dexie. Pas de serveur. Tout est validé par Zod à l'écriture.

### Entités

Chaque enregistrement a : `id` (UUID), `createdAt`, `updatedAt`, `deletedAt` (null si actif —
suppression douce, pour une future synchronisation cloud).

| Entité           | Table             | Dépôt                          | Champs propres                                                                                                                                                                         |
| ---------------- | ----------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Muscle`         | `muscles`         | `muscleRepo`                   | `name`, `group` (muscle fin rattaché à un groupe ; vide pour l'instant)                                                                                                                |
| `Exercise`       | `exercises`       | `exerciseRepo`                 | `name`, `aliases[]`, `equipment[]`, `primaryMuscles[]`, `secondaryMuscles[]`, `movementPattern`, `level`, `steps[]`, `mistakes[]`, `variations[]`, `loadAdvice`, `safety`, `inputType` |
| `Routine`        | `routines`        | `routineRepo`                  | `name`, `note`, `items[]` (`exerciseId`, `targetSets`, `targetReps`, `restSeconds`, `note`)                                                                                            |
| `WorkoutSession` | `workoutSessions` | `workoutSessionRepo`           | `routineId`, `name`, `startedAt`, `endedAt`, `note`                                                                                                                                    |
| `SetEntry`       | `setEntries`      | `setEntryRepo`                 | `sessionId`, `exerciseId`, `order`, `weight`, `reps`, `durationSeconds`, `distanceMeters`, `rpe`, `isWarmup`, `note`                                                                   |
| `BodyMetric`     | `bodyMetrics`     | `bodyMetricRepo`               | `date`, `weightKg`, `waistCm`, `measurements` (cou, épaules, poitrine, bras…)                                                                                                          |
| `Food`           | `foods`           | `foodRepo`                     | `name`, `brand`, `barcode`, pour 100 g : `kcal`, `proteinG`, `carbsG`, `fatG`, `fiberG` ; `servingG`                                                                                   |
| `Meal`           | `meals`           | `mealRepo`                     | repas enregistré réutilisable : `name`, `items[]` (`foodId`, `grams`)                                                                                                                  |
| `FoodLogEntry`   | `foodLogEntries`  | `foodLogEntryRepo`             | `date`, `mealType`, `foodId`, `grams`                                                                                                                                                  |
| `Goal`           | `goals`           | `goalRepo`                     | `type` (`weight` · `load` · `measurement` · `calories`), `targetValue`, `targetDate`, `exerciseId`, `measurement`                                                                      |
| `Profile`        | `profiles`        | `getProfile` / `saveProfile`   | `sex`, `age`, `heightCm`, `generalGoal` (un seul profil)                                                                                                                               |
| `Settings`       | `settings`        | `getSettings` / `saveSettings` | `weightUnit` (`kg`/`lb`), `lengthUnit` (`cm`/`in`) (un seul jeu)                                                                                                                       |

Les types TypeScript portent le même nom (`import type { Exercise } from '@/data'`),
les schémas Zod sont `exerciseSchema`, `setEntrySchema`, etc.

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
await setEntryRepo.update(id, { reps: 10 });
await setEntryRepo.remove(id); // suppression douce
```

Les listes ne sont pas triées : trier côté écran. Pour un affichage qui se met à jour tout seul :

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
const exercises = useLiveQuery(() => exerciseRepo.list(), []);
```

### Constantes partagées (`constants.ts`)

`MUSCLE_GROUPS` (15), `MOVEMENT_PATTERNS` (12), `EQUIPMENT` (8), `EXERCISE_LEVELS`, `INPUT_TYPES`,
`MEASUREMENTS`, `MEAL_TYPES`, `GOAL_TYPES`, `SEXES`, `GENERAL_GOALS`.
Chaque élément = `{ id, label }`. `labelOf(MUSCLE_GROUPS, 'lats')` → « Dorsaux ».
Les `id` sont enregistrés en base : **ne jamais les renommer ni les supprimer**.

Groupes musculaires : `chest` Pectoraux · `shoulders` Épaules · `biceps` · `triceps` ·
`forearms` Avant-bras · `abs` Abdos · `traps` Trapèzes · `lats` Dorsaux · `lower_back` Lombaires ·
`glutes` Fessiers · `quads` Quadriceps · `hamstrings` Ischio-jambiers · `adductors` Adducteurs ·
`calves` Mollets · `neck` Cou.

Schémas de mouvement : `horizontal_push` · `vertical_push` · `vertical_pull` · `horizontal_pull` ·
`elbow_flexion` · `elbow_extension` · `squat` (squat/presse) · `hip_hinge` · `lunge` · `arm_raise` ·
`core` (gainage/abdos) · `calves`.

Matériel : `bodyweight` · `dumbbell` · `barbell` · `machine` · `cable` · `kettlebell` · `band` · `cardio`.

Types de saisie : `weight_reps` · `reps` · `duration` · `distance` · `bodyweight_load`.

### Données de démonstration

`DEMO_EXERCISES` : 5 exercices aux id fixes, ajoutés au démarrage s'ils manquent
(un exercice supprimé n'est pas recréé).

| Exercice         | id                                     |
| ---------------- | -------------------------------------- |
| Développé couché | `0d1e1a00-0000-4000-8000-000000000001` |
| Tractions        | `0d1e1a00-0000-4000-8000-000000000002` |
| Squat            | `0d1e1a00-0000-4000-8000-000000000003` |
| Curl haltères    | `0d1e1a00-0000-4000-8000-000000000004` |
| Gainage          | `0d1e1a00-0000-4000-8000-000000000005` |

### Sauvegarde

`exportToJson()` / `importFromJson(json)` : tout le contenu de la base, y compris les
enregistrements supprimés en douceur. L'import remplace tout, et ne modifie rien si un seul
enregistrement est invalide. Format : `{ format: 'atlas-muscu-backup', schemaVersion, exportedAt, tables }`.

### Faire évoluer la base

Voir l'en-tête de `src/data/migrations.ts` : on ajoute une nouvelle version, on ne modifie
jamais une version publiée. Réservé au lot 0 (§1) pour éviter que deux lots créent chacun
une « version 2 ».

## 8. Avant chaque commit

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Tests : Vitest + Testing Library ; IndexedDB est simulée (`fake-indexeddb`).
`src/test/fixtures.ts` fournit `resetDb()` et un exemple valide par entité.
