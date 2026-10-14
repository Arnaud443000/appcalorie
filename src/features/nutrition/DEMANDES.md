# Demandes au lot 0 — lot 7 (journal alimentaire)

Rien de bloquant : le lot fonctionne avec le socle actuel. Souhaits, par ordre d'utilité :

1. **Message court (`Toast`) au-dessus d'une feuille (`Sheet`).** Le message s'affiche au bas de
   l'écran, par-dessus les boutons du bas d'une feuille ouverte (ex. « Objectifs enregistrés » masque
   « Créer un aliment à la main » quelques secondes). Idée : le placer plus haut quand une feuille est
   ouverte, ou lui laisser `pointer-events: none`.
2. **Format du fichier CIQUAL à vérifier avec le vrai fichier** (déjà noté par le lot 4,
   `foods/README.md`) : l'import est branché sur `parseCiqualCsv`, mais jamais essayé avec le
   fichier officiel de l'Anses (réseau refusé en développement).
3. **Date « aujourd'hui » et fuseau** : le journal utilise le jour local de l'appareil
   (`dayFromDate`). Rien à changer, à garder en tête pour une future synchronisation.

Repères de macros (g par jour) : gardés dans le `localStorage` du lot (`atlas.nutrition.macroTargets`),
car `Goal` ne porte que l'objectif de calories. Si on veut qu'ils soient sauvegardés avec le reste
(export/import), il faudrait un champ ou une entité dédiée en base (version 3, lot 0).
