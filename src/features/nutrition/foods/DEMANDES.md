# Demandes au lot 0 — lot 4 (aliments)

Ce que ce lot ne peut pas faire seul (règle d'or : on ne touche qu'à `src/features/nutrition/foods/`).

## 1. Étendre `Food` : fourchette et nombre de sources (utile pour les moyennes)

Un aliment calculé par `aggregateFoods` est enregistré comme un `Food` normal, mais on perd
ce qui fait sa valeur : « 21 g de protéines, entre 20 et 22, sur 7 produits, confiance moyenne ».
Champ à ajouter (facultatif, `null` pour tous les aliments existants) :

```ts
// dans foodSchema (src/data/schemas.ts)
source: z.enum(['manual', 'ciqual', 'openfoodfacts', 'average']).nullable(), // d'où vient l'aliment
average: z
  .object({
    sourceCount: z.number().int().positive(),   // produits retenus
    rejectedCount: z.number().int().nonnegative(),
    confidence: z.enum(['low', 'medium', 'high']),
    state: z.enum(['raw', 'cooked', 'unknown']),
    ranges: z.record(z.string(), z.object({ min: z.number(), max: z.number() })), // par nutriment
    computedAt: z.iso.datetime(),
  })
  .nullable(),
```

Cela demande une nouvelle version de la base (`migrations.ts`) : les anciens aliments auraient
`source: null` et `average: null`. La forme exacte de `average` est celle de `AggregatedFoodInfo`
(`src/features/nutrition/foods/toFood.ts`) : la reprise est directe.

En attendant, ces informations sont renvoyées à côté du `Food` par `saveAggregatedFood`
mais **ne sont pas conservées** : l'écran doit les afficher tout de suite.

## 2. Conserver le catalogue CIQUAL entre deux lancements

`searchFoods` lit CIQUAL dans une liste en mémoire (`setCiqualCatalog`). Sans stockage, il faudrait
relire le fichier à chaque ouverture de l'application (environ 3 000 aliments).
Demande : une table Dexie `ciqualFoods` (index `id, name`), avec les champs de `CatalogProduct`
(`code`, `name`, `category`, `kcal`, `proteinG`, `carbsG`, `fatG`, `fiberG`), **exclue de
l'export/import de sauvegarde** (c'est une donnée de référence, re-téléchargeable).
Alternative sans migration : l'écran garde le texte du fichier dans le cache du navigateur
(Cache Storage) et appelle `parseCiqualCsv` au démarrage.

## 3. Origine d'un aliment enregistré (facultatif)

Si le champ `source` du point 1 est accepté, il permet aussi au journal de distinguer « mes aliments »
des aliments venus de CIQUAL ou d'Open Food Facts, et d'afficher la mention « Source : Open Food Facts »
exigée par leur licence (voir README).

## 4. Rien d'autre

Aucune dépendance npm, aucun index et aucun changement de `package.json`, `routes.tsx`, `src/ui`
ou `src/data` n'est nécessaire pour le reste du lot.
