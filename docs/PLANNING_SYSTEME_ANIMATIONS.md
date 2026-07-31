# Système d'animations (A1) — conception

Éditeur d'animations image par image, façon « Battle Animation » de
RPG Maker 2003 : l'auteur compose une suite de frames en choisissant à
chaque frame l'image affichée et sa position, et pose des sons à des
moments précis. Puis il la déclenche depuis un event.

Ce document fixe le format, le lecteur runtime et le découpage du
travail AVANT d'écrire une ligne de code — la leçon des chantiers
précédents (database, UI) : un format décidé en cours d'implémentation
se paie en migrations.

## 1. Ce qui existe déjà et qu'on réutilise

Le moteur sait DÉJÀ tout faire, mais seulement à la main dans un script
d'event (afficher, attendre, déplacer, jouer un son) — insupportable à
écrire, et chaque opcode coûte ~3 000 cycles dans la VM (mesuré au
compteur de scanline, cf. P1/P2/P3). Ce qui manque, c'est un FORMAT
compact, un lecteur dédié, et l'éditeur.

Briques réemployées telles quelles :

- **Vignettes (B5)** — blocs de 32×32 en 4bpp (16 couleurs), chars OBJ
  384 + slot×4, entrées OAM 96-97, frames transférées au VBlank. C'est
  déjà un lecteur d'animation à vitesse constante : le nouveau système
  en est la généralisation (position et son par frame).
- **Sons (B1)** — `audio_play_sfx(id)`, échantillons BRR du projet.
- **Écriture OAM directe** — la recette de P3 (quatre mots de 16 bits,
  pas d'appel à `oamSet`, mots invariants en cache) : le lecteur
  d'animation l'utilise, sinon quatre cellules coûteraient une frame.

## 2. Pourquoi les sprites et pas une image de fond

Une animation doit passer PAR-DESSUS le décor et garder ses couleurs.

- La couche UI est en 2bpp et partage la palette de la fonte : 4
  couleurs, exclu pour une explosion ou un coup d'épée.
- Les couches de décor (BG1/BG2) portent la carte : on ne peut pas y
  poser une cellule sans détruire le rendu de la scène.
- Les **sprites** ont leurs propres palettes, indépendantes du décor :
  16 couleurs par cellule sans rien voler au tileset. C'est ce que fait
  Chrono Trigger pour ses portraits et ses effets.

Contrepartie assumée : les cellules vivent dans la VRAM OBJ (16 Ko),
partagée avec les 5 apparences de personnage par scène.

## 3. Format des données

### 3.1 Ressource « animation » (projet)

Entrée du registre projet, à côté des vignettes — la planche de
cellules EST une vignette du projet (décision d'implémentation : zéro
nouveau chemin graphique, cf. §4) :

```json
{
  "name": "coup_epee",
  "vignette": "coup",
  "loop": false,
  "frames": [
    { "cell": 0, "x": 0,  "y": 0,  "dur": 4 },
    { "cell": 1, "x": 4,  "y": -2, "dur": 4, "sfx": "epee" },
    { "cell": 2, "x": 8,  "y": -4, "dur": 6 }
  ]
}
```

- `vignette` : la planche, une bande horizontale de cellules 32x32
  (≤ 15 couleurs + index 0 transparent). Une animation = UNE planche,
  donc UNE palette OBJ.
- `cell` : index de la cellule dans la planche.
- `x` / `y` : décalage SIGNÉ en pixels par rapport au point d'ancrage
  (voir §3.2). C'est ça qui donne le déplacement image par image.
- `dur` : durée de la frame en frames écran (1-255).
- `sfx` : son joué À L'ENTRÉE de cette frame (facultatif).

datagen valide tout à la génération, jamais au runtime : nom en
double, vignette inconnue (avec la liste des vignettes du projet),
frames absentes ou trop nombreuses, cellule hors planche, durée nulle,
décalage hors de −128..127, son inconnu.

### 3.2 Ancrage

Comme RM2003 : `écran`, `héros`, ou `event n`. Le lecteur ajoute le
décalage de la frame à la position de la cible, recalculée à chaque
frame — une animation ancrée sur un PNJ le suit s'il bouge.

Le point d'ancrage `écran` est le CENTRE de l'écran : un décalage
(0,0) y pose la cellule 32x32 centrée. Pour `héros` et `event`, (0,0)
pose le coin de la cellule sur le coin du metasprite suivi. Même règle
dans l'éditeur et dans le moteur — c'est ce qui garantit que le
canevas de l'éditeur montre ce que le jeu affichera.

### 3.3 Binaire (bank data)

Cinq tables parallèles indexées par animation (`anim_vig`,
`anim_flags`, `anim_nframes`, `anim_ofs`) plus la piste aplatie
`anim_track`. Une frame fait **5 octets de taille FIXE** :

```
[cellule][dx signé][dy signé][durée 1-255][son, 0xFF = aucun]
```

Le pas fixe est un choix de PERFORMANCE, pas de compacité : le lecteur
garde l'offset de la frame courante et lui ajoute 5, sans jamais
multiplier ni décoder une longueur variable. tcc-816 compile chaque
accès indexé en une lecture indirecte longue (~11 instructions, leçon
de P3). Une animation de 12 frames tient en 60 octets.

## 4. Lecteur runtime (`anim.c`)

Une animation image par image, c'est une VIGNETTE dont la cellule, la
position et le son changent à chaque frame. Le lecteur emprunte donc un
slot de vignette et pilote l'état existant :

```
anim_play(id, ancre, cible)   anim_stop()   anim_busy()
anim_update()   (une fois par frame, AVANT vig_update)
```

Tout le chemin graphique reste celui des vignettes : chars OBJ 32x32,
palette OBJ dédiée, transfert de la cellule au VBlank, écriture du
shadow OAM. `vig_vblank()` fait déjà le travail — pas de `anim_vblank`.

Par frame et par animation active : décrémenter le compteur de durée.
Au changement de frame SEULEMENT — lire les 5 octets, marquer la
cellule à transférer, poser la position, jouer le son. Le reste du
temps, c'est un test et une décrémentation.

Propriété du slot : le lecteur pose un drapeau (`vig_own_anim`) qu'un
`vig_show` scripté retire. Une vignette scriptée PRÉEMPTE donc
l'animation, qui le voit à sa frame suivante et lâche le slot sans
rien cacher — le script garde la main sur ce qu'il a affiché.

Budget VBlank : un changement de cellule = 4 DMA de 128 octets. La
règle « un transfert par VBlank » des vignettes s'applique telle
quelle ; si deux animations changent de cellule la même frame, la
seconde passe à la frame suivante.

## 5. Commande d'event

« Jouer une animation » : animation, cible (écran / héros / cet event /
event n), et une case **attendre la fin**. Sans l'attente, le script
continue et l'animation vit sa vie — indispensable pour animer pendant
un dialogue.

Opcode `ANIMPLAY` (0x3B) : `[anim][ancre][cible][flags]`, cible 0xFF =
« cet event » (résolu à l'exécution comme pour les itinéraires).
L'attente réutilise le mécanisme des attentes non-UI de la VM
(`VM_WAIT_ANIM`), comme l'attente de route ou de caméra. Une animation
en BOUCLE ne bloque jamais — sinon l'attente ne se terminerait pas.

`ANIMSTOP` (0x3C) arrête tout et range les sprites : la sortie d'une
boucle lancée sans attente.

## 6. Éditeur

Fenêtre « Animations » (Tools), sur le modèle de l'éditeur d'écrans :

- **Timeline** en bas : une colonne par frame, la durée en largeur, une
  pastille sur les frames qui portent un son. Ajouter / dupliquer /
  supprimer une frame, glisser pour réordonner.
- **Canevas** au centre : la cellule de la frame courante posée sur une
  silhouette de référence (héros ou fond d'écran au choix), déplaçable
  à la souris — c'est ce qui fixe `x`/`y`.
- **Inspecteur** à droite : cellule (grille de la planche), durée, son.
- **Lecture** : bouton play qui joue l'animation dans le canevas à la
  vitesse réelle, sons compris.

## 7. Limites à annoncer dans l'éditeur

- Cellules **32×32**, 16 couleurs, une planche par animation.
- **2 cellules simultanées** aujourd'hui (emplacements de vignettes) ;
  la bande VRAM réservée en accepte **4** — vérifié : chaque bloc 32×32
  occupe un quart des chars 384-447, et les entrées OAM 98-99 sont
  libres jusqu'à la météo (100+).
- Une animation qui change de cellule à chaque frame écran sature le
  VBlank : viser 6 à 10 images par seconde, comme les jeux de l'époque.

## 8. Découpage

1. **A1-a** — ✅ format + datagen (validation, piste binaire) + lecteur
   runtime + opcodes `ANIMPLAY`/`ANIMSTOP`, et la commande d'event
   `anim_play`/`anim_stop` côté datagen. Testable par un projet écrit à
   la main, sans éditeur — c'est ce qui a servi à valider les trois
   ancrages, l'attente, la boucle et l'auto-rangement.
2. **A1-b** — formulaire de la commande dans l'éditeur d'events.
3. **A1-c** — fenêtre Animations : timeline, canevas, inspecteur,
   lecture.
4. **A1-d** — passage à 4 emplacements simultanés (petit, séparé : il
   touche aux vignettes existantes).

Chaque cran est livrable et vérifiable seul ; la régression pixel
couvre le moteur à chaque étape.
