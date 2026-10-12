# Aliments — logique (lot 4)

Pas d'écran ici : ce dossier fournit la logique que le journal alimentaire (autre lot) utilisera.
Tout passe par `index.ts`.

```ts
import { searchFoods, aggregateFoods, saveAggregatedFood } from '@/features/nutrition/foods';
```

## Contenu

| Fichier            | Rôle                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------- |
| `foodState.ts`     | `detectFoodState(nom, catégorie)` → `raw` / `cooked` / `unknown`                      |
| `aggregate.ts`     | `aggregateFoods(produits, options)` : nettoyage + moyenne + confiance + comparaison   |
| `openFoodFacts.ts` | Client Open Food Facts (recherche, code-barres)                                       |
| `ciqual.ts`        | `parseCiqualCsv(texte)`                                                               |
| `toFood.ts`        | Moyenne → `Food` enregistrable (`saveAggregatedFood`), résultat de recherche → `Food` |
| `searchFoods.ts`   | `searchFoods(texte)` : mes aliments + CIQUAL + Open Food Facts, sans doublons         |
| `fixtures/`        | Petit fichier CIQUAL d'exemple (faux chiffres approximatifs, pour les tests)          |

## Règles de nettoyage de la moyenne

1. **Même état seulement.** Chaque produit est classé cru / cuit / inconnu d'après son nom et sa
   catégorie (« cru », « cuite », « rôti », « à cuire », « non cuit »…). Si les indices se contredisent
   ou s'il n'y en a pas : inconnu. Un groupe ne contient que des produits du même état. Sans état imposé,
   c'est l'état le plus fréquent qui gagne ; à égalité exacte cru/cuit, rien n'est retenu (l'appelant doit
   préciser `state`, par exemple déduit de la recherche).
2. **Produits écartés** (avec la raison) : valeur manquante (calories, protéines, glucides ou lipides ;
   les fibres sont facultatives), valeur négative, plus de 100 g d'un nutriment pour 100 g, protéines +
   glucides + lipides au-delà de 101 g (1 g de marge pour les arrondis), calories incohérentes.
3. **Calories incohérentes** : on recalcule 4 × protéines + 4 × glucides + 9 × lipides. L'écart toléré est
   de 20 % du calcul, au minimum 20 kcal. Les deux ne collent jamais pile (arrondis, fibres, alcool) mais
   au-delà de cet écart c'est presque toujours une erreur (kJ pris pour des kcal, valeur à la portion…).
4. **Valeur retenue** (nutriment par nutriment) : 1 produit → sa valeur ; 2 → la moyenne ; 3 ou 4 → la
   médiane (valeur du milieu) ; 5 et plus → moyenne après retrait des plus basses et plus hautes
   (1 de chaque côté, puis 10 % de chaque côté à partir de 20 produits).
5. **Confiance** : faible si moins de 3 produits ou grand écart (plus de 30 % de la valeur) ; moyenne
   si 3 ou 4 produits, écart moyen (plus de 15 %) ou état inconnu ; bonne sinon. Les écarts sont jugés sur
   les valeurs utilisées (extrêmes écartées exclues) et rapportés à au moins 10 g (50 kcal).
6. **Comparaison CIQUAL** : avec `options.reference`, chaque nutriment est « proche » s'il est à moins
   de 15 % de la référence (au minimum 15 kcal ou 2 g).

Tous les seuils sont des constantes en haut de `aggregate.ts`.

## Fichier CIQUAL

**Le téléchargement n'a pas pu être testé** depuis l'environnement de développement (accès réseau refusé).
Le format ci-dessous vient donc de la documentation connue de la table 2020 et **doit être vérifié
avec le vrai fichier** avant de brancher l'import. Le fichier d'exemple `fixtures/ciqual-exemple.csv` a
cette forme, mais ses chiffres sont approximatifs et ne sont pas ceux de l'ANSES.

- **Où le récupérer** : site CIQUAL de l'ANSES (`https://ciqual.anses.fr`, rubrique « Télécharger la
  table »), publiée en Excel/XML ; une version CSV existe aussi sur `data.gouv.fr` (à confirmer). Si
  seul Excel est disponible, l'enregistrer en « CSV UTF-8 ». Licence ouverte : citer « Anses — Table de
  composition nutritionnelle des aliments Ciqual ».
- **Format lu** : CSV avec une ligne d'en-têtes ; séparateur `;`, tabulation ou `,` (détecté) ; guillemets
  autorisés ; virgule ou point décimal. Le texte doit être décodé en UTF-8 par l'écran
  (`new TextDecoder('utf-8').decode(octets)`, ou `'windows-1252'` si les accents sont cassés).
- **Colonnes utilisées** (repérées par leur nom, l'ordre est libre) : `alim_code`, `alim_nom_fr`,
  `alim_grp_nom_fr` / `alim_ssgrp_nom_fr` / `alim_ssssgrp_nom_fr` (catégorie), « Energie, Règlement UE
  N° 1169/2011 (kcal/100 g) » (sinon la colonne « Jones » en kcal), « Protéines, N x 6.25 (g/100 g) »,
  « Glucides (g/100 g) », « Lipides (g/100 g) », « Fibres alimentaires (g/100 g) ». Si une colonne
  obligatoire manque, la fonction lève une erreur en français.
- **Valeurs** : `traces` et `< x` (sous le seuil) valent 0 ; `-` ou vide = inconnu. Une ligne sans
  calories, protéines, glucides ou lipides est ignorée (comptée dans `skipped`).
- **Branchement** : l'écran télécharge le fichier, appelle `setCiqualCatalog(parseCiqualCsv(texte).foods)`.
  Conserver le catalogue entre deux lancements : voir `DEMANDES.md`.

## Open Food Facts — utilisation et limites

- **Conditions respectées** : maximum 8 recherches et 80 lectures de produit par minute (d'après leur documentation, OFF
  autorise 10 et 100 : à revérifier de temps en temps) ; au-delà, le client renvoie `rate_limited` sans appeler. Délai maximum 10 s. Seuls les champs utiles
  sont demandés. **À l'écran** : ne lancer la recherche Open Food Facts qu'à la validation (touche
  Entrée / bouton), pas à chaque lettre — utiliser `searchFoods(texte, { remote: false })` pendant la frappe.
- **Mention obligatoire** : les données sont sous licence ODbL, l'écran doit afficher « Données :
  Open Food Facts » (avec lien vers `https://world.openfoodfacts.org`) près des résultats venant d'OFF.
- **En-tête `User-Agent`** : OFF demande aux applications de s'identifier, mais un navigateur ne
  permet pas de le fixer ; on n'envoie aucun en-tête personnalisé (sinon pré-requête CORS inutile).
  À revoir si l'app passe un jour par un serveur.
- **Qualité des données** : base collaborative, donc : valeurs absentes (jamais traitées comme 0),
  valeurs fausses (kJ saisis en kcal, valeurs à la portion, virgule déplacée), doublons, noms
  incomplets, états cru/cuit rarement indiqués, produits d'autres pays. Les calories manquantes sont
  reconstituées depuis les kJ quand ils existent. C'est la raison d'être du nettoyage ci-dessus.
- **Recherche texte** : l'ancienne API de recherche est lente et peut se tromper de langue ; pas de
  filtre « cru / cuit » possible côté OFF.
