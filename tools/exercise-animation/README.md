# Animation des exercices (prototype)

Ce dossier transforme **deux images fixes** d'un exercice (A = position de départ,
B = position d'arrivée) en **une animation en boucle**, fluide et légère, pour l'app.

Premier exercice traité : le **développé couché à la barre**.

- La démo : [`demo/index.html`](demo/index.html) (vidéo, lecteur WebGL, comparaison).
- La vidéo finale : `demo/bench_press.mp4` (pour iPhone) et `demo/bench_press.webm`.

---

## En bref

| | |
|---|---|
| **Méthode retenue** | « Marionnette 2D » : le fond, le banc et le corps restent une image fixe, seuls les bras, la barre et les disques bougent, en déplaçant les vrais pixels des images d'origine. |
| **Fantômes / images doubles** | Aucun (rien n'est mélangé en transparence). |
| **Scintillement des zones fixes** | Zéro avant compression ; après compression vidéo, 0,002 % des pixels fixes bougent d'un niveau visible (invisible à l'œil). |
| **Raccord de boucle** | Invisible : la boucle redémarre au milieu de la pause en bas, quand rien ne bouge. |
| **Rythme** | 1,0 s de montée, 1,3 s de descente, 0,12 s de pause en haut et en bas, ralenti aux changements de sens. 60 images/s. |
| **Poids** | MP4 : 259 Ko, WebM : 247 Ko (1152 × 768). Version WebGL : 117 Ko. |

**Verdict : les critères sont atteints** pour le développé couché. Les petites limites
restantes sont listées plus bas (section « Limites »).

---

## 1. Pourquoi ton essai avec RIFE n'était pas fluide (diagnostic)

J'ai refait ton essai (RIFE v4.26 heavy via `ccvfi`, 1024 px, échelle de flux 0,5,
smoothstep, 30 i/s) et je l'ai mesuré. Les causes, par ordre d'importance :

1. **Le mouvement de la barre n'est pas régulier.** RIFE ne sait pas faire « 30 % du
   trajet » quand le déplacement est grand (≈ 250 px) : la barre avance par à-coups,
   reste presque immobile puis saute. Sur la courbe de hauteur du disque
   (`demo/comparison/metrics.png`, en haut à gauche), on voit des paliers. Mesure :
   l'accélération du disque varie 19 fois plus que dans la version retenue,
   et la vitesse change de sens 4 fois pendant une répétition (0 attendu).
   C'est la cause principale de la sensation de saccade.
2. **Images fantômes.** Au milieu du mouvement, les disques deviennent en partie
   transparents (jusqu'à 12 % de leur noirceur perdue) et les avant-bras se
   dédoublent ou deviennent flous (netteté jusqu'à 53 % plus basse).
3. **Scintillement des zones fixes.** Les deux images d'origine ne sont pas identiques
   au pixel près dans les zones fixes (jambes, banc) : les fibres musculaires sont
   redessinées légèrement différemment. RIFE fait la transition entre les deux, donc
   ces zones « grouillent » : 2,2 % des pixels fixes changent à chaque image.
4. **Mouvement inventé.** L'épaule, le pec et la tête changent de forme entre A et B
   (la tête est tournée dans A, de face dans B). RIFE les déforme aussi.
5. **30 i/s** est un peu juste pour un geste aussi ample, mais c'est secondaire :
   à 60 i/s RIFE garde les défauts 1 à 4 (ligne « RIFE seul, nouveau rythme »).

La boucle elle-même n'était pas le problème (aller-retour smoothstep = vitesse nulle
aux deux bouts).

**Le défaut de l'image A** (barre au-dessus de la gorge au lieu du milieu de la
poitrine) ne crée aucun défaut visuel dans l'animation. Par contre, un œil de coach le
verra : la barre descend trop haut, vers le cou. C'est un problème de justesse
technique de l'image, pas de fluidité. Pour corriger, il faudrait régénérer l'image A
avec la barre au-dessus des mamelons (bas des pectoraux), avant-bras verticaux.

---

## 2. Les méthodes comparées

Toutes ont été rendues au même rythme et mesurées de la même façon
(`compare.py`). Planche : `demo/comparison/comparison_sheet.jpg`
(une ligne par méthode, cinq moments de la montée). Vidéo côte à côte :
`demo/comparison/side_by_side.mp4`.

| Méthode | Scintillement fond | Pixels fixes qui bougent | Disques (min.) | Netteté (min.) | Raccord boucle | À-coups (inversions de vitesse) |
|---|---:|---:|---:|---:|---:|---:|
| RIFE seul (essai d'origine, 30 i/s) | 0.28 | 2.16 % | 0.88 | 0.47 | 0.23 | 4 |
| RIFE seul, nouveau rythme | 0.19 | 1.43 % | 0.85 | 0.46 | 0.00 | 2 |
| A · Calques + RIFE | 0.00 | 0.00 % | 0.85 | 0.46 | 0.00 | 2 |
| **B · Marionnette (1 source)** (retenue) | 0.00 | 0.00 % | 1.00 | 0.81 | 0.00 | 0 |
| B' · Marionnette + fondu A/B | 0.00 | 0.00 % | 1.00 | 0.81 | 0.00 | 0 |
| C · Hybride marionnette + RIFE | 0.00 | 0.00 % | 1.00 | 0.81 | 0.00 | 0 |

Comment lire le tableau :
- **Scintillement fond** : différence moyenne d'une image à l'autre dans les zones
  qui ne doivent pas bouger (0 = parfait).
- **Pixels fixes qui bougent** : part des pixels fixes qui changent à chaque image.
- **Disques (min.)** : noirceur des disques au pire moment, comparée à ce qui est
  attendu. En dessous de 1, les disques deviennent transparents = image fantôme.
- **Netteté (min.)** : netteté de la zone en mouvement au pire moment (1 = normal).
- **Raccord boucle** : saut entre la dernière et la première image, comparé à un saut
  normal (0 = la boucle redémarre dans une pause).

Attention : les chiffres ne voient pas tout. B, B' et C ont les mêmes mesures, mais
le zoom `demo/comparison/crossfade_zoom.jpg` (bras proche à mi-hauteur) montre la
différence : B est net, B' montre une double image du bras, C un bras flou.
La netteté de B (0,81) baisse un peu parce que le bras est étiré ou raccourci, pas
à cause d'un flou de mélange.

Ce que j'en retiens :

- **RIFE seul** (ton essai, et le même au nouveau rythme) : fantômes, disques
  transparents, fond qui grouille, mouvement par à-coups.
- **A · Calques + RIFE** : on garde un fond fixe parfait (le scintillement disparaît),
  mais les bras et la barre restent fantomatiques. Ça prouve que le fond n'était
  qu'une partie du problème.
- **B · Marionnette, 1 source** (retenue) : chaque partie (bras, disques) vient d'une
  seule image et est déplacée/déformée, jamais mélangée en transparence. Aucun
  fantôme, mouvement parfaitement régulier.
- **B' · Marionnette + fondu A/B** : même géométrie, mais le bras passe en fondu de
  l'image A à l'image B au milieu du geste. Les chiffres sont bons, mais à l'œil la
  texture du bras se dédouble pendant le fondu (stries musculaires en double). Rejetée.
- **C · Hybride (marionnette + RIFE pour ce fondu)** : RIFE remplace le fondu sur
  des images déjà alignées. C'est mieux que le fondu simple, mais la texture du bras
  devient floue pendant la transition, et c'est beaucoup plus lent à calculer (RIFE à chaque image).
  Ça n'apporte rien de visible par rapport à B. Rejetée.

---

## 3. Comment ça marche (méthode retenue)

1. **Plaque fixe** : on part de l'image B. Là où il y avait les bras et la barre de B,
   on reprend le fond blanc de A quand il est propre, sinon on reconstruit la zone
   avec LaMa (un modèle d'« inpainting » qui tourne sur processeur). Cette plaque est
   la même pour toutes les images : zéro scintillement.
2. **Objets rigides** : les disques sont découpés (disque de B côté loin, disque de A
   côté proche, car celui de B sort du cadre) et déplacés avec une transformation
   calculée automatiquement entre A et B (ajustée au pixel par la méthode ECC). Les
   parties cachées par une main sont complétées par LaMa.
3. **Barre** : redessinée à partir d'une vraie coupe de la barre de l'image A, entre
   les deux disques (évite les trous laissés par les mains).
4. **Bras** : chaîne à 2 os (main/avant-bras, bras) pilotée par cinématique inverse :
   la main suit la barre, l'épaule reste sur le corps, le coude se place tout seul,
   ce qui donne un arc naturel. Les pixels du bras de l'image B sont déformés avec un
   « skinning » (chaque os déplace sa zone, mélange doux au coude). En bas, le bras
   de B est raccourci (effet de perspective) au lieu d'être remplacé par celui de A.
   Le bras loin passe derrière le torse, comme dans la réalité.
5. **Rythme** : courbe « smootherstep » (départ et arrivée en douceur, vitesse nulle
   aux changements de sens), 1,0 s de montée, 1,3 s de descente, petites pauses.
6. **Encodage** : H.264 (profil High, compatible iPhone), sans son, une seule image
   clé par boucle, + WebM VP9.

### La version WebGL (proposition)

Au lieu d'une vidéo, le téléphone reçoit l'image fixe du corps, 4 petites découpes
(2 bras, 2 disques) et les paramètres du mouvement (`demo/web/`). Le script
`web/player.js` recalcule la pose à chaque rafraîchissement de l'écran.

- **Plus léger** : 117 Ko au total (contre 259 Ko pour la vidéo MP4).
- **Plus fluide** : il suit la fréquence de l'écran (120 Hz sur les iPhone Pro), le
  ralenti est parfait (pas d'images répétées), aucune compression vidéo.
- **Preuve** : rendu dans Chromium, il donne la même image que le pipeline Python à
  39 dB près (différence invisible, seulement sur les bords). Même en
  émulation logicielle sans carte graphique, une image se calcule en 19 ms ; un
  téléphone le fait en moins d'1 ms.
- **Limite** : je n'ai pas pu le tester sur un vrai iPhone ici. La vidéo MP4 reste la
  solution « sûre à 100 % » ; le WebGL est une option à valider sur ton téléphone avec
  la page de démo.

---

## 4. Utilisation

### Installation (une seule fois)

```bash
cd tools/exercise-animation
python3 -m venv .venv            # dossier séparé, rien n'est installé dans le système
.venv/bin/pip install numpy opencv-python-headless torch
# poids LaMa (≈ 200 Mo), hors du dépôt :
curl -L -o big-lama.pt https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt
```

Sans `torch` / LaMa, le script marche quand même (retouche OpenCV, moins jolie).
Pour refaire la comparaison : `.venv/bin/pip install ccvfi matplotlib`.

### Fabriquer l'animation

```bash
# vidéo MP4 + WebM + planche contact
.venv/bin/python animate.py exercises/bench_press/rig.json --out demo/bench_press --lama big-lama.pt

# vérifier le rig (dessins du squelette et des découpes sur A et B, plaque fixe)
.venv/bin/python animate.py exercises/bench_press/rig.json --out /tmp/check/bench --debug --no-video --lama big-lama.pt

# version WebGL
.venv/bin/python export_web.py exercises/bench_press/rig.json --out demo/web/bench_press --lama big-lama.pt

# comparaison des méthodes (long : RIFE sur processeur, ≈ 30 min)
.venv/bin/python compare.py exercises/bench_press/rig.json --out demo/comparison --cache /tmp/cmp --lama big-lama.pt
```

### Voir la démo

La vidéo s'ouvre directement. Pour le lecteur WebGL, le navigateur exige un petit
serveur web : `npx serve tools/exercise-animation/demo` puis ouvre l'adresse affichée.

### Intégrer la vidéo dans l'app

```html
<video autoplay muted loop playsinline preload="auto" disablepictureinpicture>
  <source src="bench_press.mp4" type="video/mp4">
  <source src="bench_press.webm" type="video/webm">
</video>
```

`muted` + `playsinline` sont obligatoires pour la lecture automatique sur iPhone.
Ralenti : `video.playbackRate = 0.5`.

---

## 5. Ajouter un nouvel exercice

1. Crée `exercises/<nom>/` avec `A.webp` (départ) et `B.webp` (arrivée).
2. Copie `exercises/bench_press/rig.json` et adapte-le. Pour lire les coordonnées :
   `rig_helper.py diff A.webp B.webp diff.png` (ce qui bouge) et
   `rig_helper.py grid A.webp x0 y0 x1 y1 zoom.png` (zoom avec quadrillage).
   Le plus simple : demande à Claude de le faire en lui donnant les deux images.
3. Lance `animate.py ... --debug --no-video` et regarde `rig_overlay_A.png`,
   `rig_overlay_B.png` et `static_plate.png`. Corrige, relance, puis fais la vidéo.

### Le fichier rig.json

Toutes les coordonnées sont en pixels dans les images d'origine.

| Clé | Rôle |
|---|---|
| `images` | les deux images (A = départ, B = arrivée). |
| `timing` | `A_to_B` et `B_to_A` (secondes), `hold_A` / `hold_B` (pauses), `ease` (`smootherstep`, `sine`, `smoothstep`, `linear`), `fps`. La boucle démarre au milieu de `hold_A`. |
| `path.arc` | léger décalage (px) du trajet au milieu du mouvement, pour une trajectoire en courbe. `[0, 0]` = ligne droite. |
| `static` | `base` : image qui sert de fond fixe ; `fill_from` : l'autre image ; `fill_regions` : zones où l'autre image peut prêter des pixels du corps. |
| `output` | largeur de la vidéo et qualité (`crf` : plus petit = plus beau et plus lourd). |
| `layers` | les calques, **du plus loin au plus proche**. `body` marque la place du corps fixe. |

Types de calques :

- `rigid` (objet indéformable : disque, haltère…) : `source` (image d'où on découpe),
  `mask` (contour dans A et/ou B), `points` (mêmes repères dans A et B, au moins 2),
  `complete` (contour complet si une partie est cachée), `hull_dark` (garde seulement
  la forme sombre, utile pour un disque noir), `refine: "ecc"` (ajustement automatique).
- `shaft` (barre) : `ends` (deux extrémités dans A et B), `thickness`, `profile`
  (segment propre de la barre où prendre la coupe).
- `limb` (membre à 2 os) : `joints` = `[main sur la barre, coude, épaule]` dans A et B
  (`null` si le coude est caché), `widths` (largeur du membre aux 3 points),
  `mask` (contour du membre dans l'image `source`), `feather_end` (fondu à l'épaule).

---

## 6. Limites

- **Le bras proche en position basse** vient de l'image B, raccourci. Il ressemble
  beaucoup à l'image A, mais pas exactement (dans A, le triceps forme une boule plus
  large). Les couleurs (rose triceps / deltoïde, rouge pectoral) restent justes.
- **La tête et le pectoral** sont ceux de B pendant toute l'animation (dans A la tête
  est tournée). C'est voulu : ça évite qu'ils se déforment.
- **Petite zone reconstruite** à la base du cou, sous le bras : elle n'est visible
  qu'une fraction de seconde en début de montée, et reste discrète.
- **Ce qui marche bien avec cette méthode** : les exercices où le corps reste
  immobile et où seuls les bras ou les jambes bougent (développé, curl, extension,
  écarté, leg extension, élévations…).
- **Ce qui marchera mal** : les exercices où tout le corps bouge (squat, soulevé de
  terre, fentes, tractions). Pour ceux-là, il faudra soit une image du milieu du
  mouvement (voir ci-dessous), soit un outil vidéo externe.

### Si un exercice ne passe pas : quoi générer

1. **Une 3ᵉ image au milieu du mouvement** (même caméra, même banc, même éclairage,
   mêmes couleurs de muscles), avec les articulations bien visibles. Avec elle, la
   marionnette a un repère au milieu et les bras n'ont plus besoin d'être « devinés ».
2. Des images où **le corps ne change pas du tout** entre A et B (même tête, même
   torse) : c'est ce qui rend le fond parfaitement stable.
3. Si possible, **un fond blanc pur** et des membres qui ne se croisent pas.

### Prompt pour un outil image → vidéo (mode première / dernière image)

À coller tel quel (en anglais) dans un outil qui accepte une image de début et une
image de fin (Kling, Runway, Luma, Veo…). Mets A en première image, B en dernière, puis
fais une deuxième vidéo B → A, ou utilise l'option « boucle » si elle existe.

```text
Anatomical écorché illustration of a man performing a barbell bench press, studio render on a pure white background, static locked-off camera, no camera movement, no zoom, no cut. The bench, the legs, the feet, the torso and the head stay perfectly still and identical to the first frame. Only the arms and the barbell move: the lifter presses the bar smoothly upward from the bottom position to full elbow extension in one continuous, controlled repetition, forearms staying vertical, the bar travelling slightly back toward the shoulders. The barbell and its black plates stay rigid and perfectly round, no warping, no duplicated objects. The pectoralis major stays highlighted in red and the triceps and front deltoid stay highlighted in light pink during the whole movement, with the same colours, shapes and fibre texture as in the first frame. Constant even lighting, same soft contact shadow, no text, no extra people, no motion blur artifacts, realistic biomechanics, slow tempo of about one second for the lift, ending exactly on the last frame.
```

Conseils : durée 2 à 3 s, « motion strength » / intensité de mouvement faible à
moyenne, pas de « camera motion ». Garde le même prompt pour tous les exercices en
changeant seulement la phrase du mouvement.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `animate.py` | le pipeline (plaque fixe, calques, squelette, rendu, encodage). |
| `export_web.py` | export de la version WebGL (images découpées + `anim.json`). |
| `web/player.js` | lecteur WebGL autonome, sans dépendance. |
| `compare.py` | rendu et mesure des 6 méthodes, planches, vidéo côte à côte. |
| `rife_blend.py` | RIFE (référence et variante hybride). |
| `rig_helper.py` | aides pour écrire un rig (différences A/B, zoom quadrillé). |
| `exercises/bench_press/` | images A/B et rig du développé couché. |
| `demo/` | page de démo, vidéos finales, version WebGL, comparaison. |
