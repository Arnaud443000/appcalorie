# Atlas 3D : modèle de muscles prêt à l'emploi

Modèle anatomique 3D utilisé pour l'onglet « Atlas 3D » (rotation libre, toucher un muscle pour voir ses exercices).

## Fichiers

- `muscles_q.bin` (8 Mo) : géométrie de tous les muscles, quantifiée (positions en Uint16, indices en Uint32).
- `muscles_q.json` : un objet par muscle (130 au total) : `group` (id de groupe musculaire de l'app), `name` (français), `side` (`left` / `right`), et les offsets `pOff`, `pLen`, `iOff`, `iLen` dans le `.bin`, plus `min` et `scale` pour dé-quantifier : `position = min + valeur * scale`.
- `viewer-prototype.html` : visionneuse de démonstration (Three.js r128), qui montre comment lire le `.bin`. Elle charge un `three.min.js` voisin et le modèle en base64 ; à remplacer par un chargement `fetch` du `.bin` dans l'app.
- `scripts/` : scripts qui ont produit le modèle (conversion BodyParts3D, groupes, reconstruction du grand dorsal). Chemins en dur vers `/tmp/bp3d_work/` ; ils servent de documentation, pas d'outil à relancer tel quel.

## Conventions

- Unités : mètres, axe Y vers le haut, la face avant du corps est vers +Z, le côté droit du corps est vers -X (repère Three.js).
- Les `group` sont exactement les identifiants de l'app : chest, shoulders, biceps, triceps, forearms, abs, traps, lats, lower_back, glutes, quads, hamstrings, adductors, calves, neck.
- Le grand dorsal (`lats`) est reconstruit à la main : il n'existe pas dans BodyParts3D. Le grand droit de l'abdomen est également absent de la source ; le groupe `abs` est formé des obliques externes et des dentelés.

## Origine et licence

Source : BodyParts3D, The Database Center for Life Science (DBCLS), licence CC BY-SA 2.1 JP. Il faut citer la source si l'app est partagée publiquement : « BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP ».
