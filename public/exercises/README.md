# Images des exercices

Ce dossier contient les illustrations des exercices, servies telles quelles par l'app.

## Nommage

Chaque fiche d'exercice a un champ `imageSlug` (voir `src/features/exercises/content/`).
Pour la plupart des fiches, c'est le nom de la fiche sans accents, en minuscules, avec des tirets
(« Soulevé de terre roumain » → `souleve-de-terre-roumain`).

| Fichier                     | Rôle                                                  |
| --------------------------- | ----------------------------------------------------- |
| `<imageSlug>_depart.webp`   | position de départ                                    |
| `<imageSlug>_fin.webp`      | position de fin                                       |
| `<imageSlug>_unique.webp`   | image unique, pour un exercice statique (gainage)     |

Exemples : `developpe-couche-barre_depart.webp`, `developpe-couche-barre_fin.webp`,
`gainage-planche_unique.webp`.

Format : WebP, de préférence carré et léger (moins de 200 Ko).

## Après avoir ajouté ou retiré des images

Un site statique ne peut pas lister un dossier : l'app lit `manifest.json` pour savoir quelles
images existent. Il est régénéré automatiquement à chaque `npm run build`, et à la main avec :

```bash
npm run images:manifest
```

Dans le code, `getExerciseImages(exercise)` (depuis `@/data`) renvoie les adresses des images
d'un exercice, ou « aucune » si l'exercice n'en a pas (ou si le manifeste manque).
