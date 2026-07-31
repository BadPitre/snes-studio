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

`<projet>/animations/<nom>.json` — ou une entrée du registre projet,
au choix de l'implémentation (aligner sur les vignettes) :

```json
{
  "name": "coup_epee",
  "cells": "assets/anim_epee.png",
  "loop": false,
  "frames": [
    { "cell": 0, "x": 0,  "y": 0,  "dur": 4 },
    { "cell": 1, "x": 4,  "y": -2, "dur": 4, "sfx": "epee" },
    { "cell": 2, "x": 8,  "y": -4, "dur": 6 }
  ]
}
```

- `cells` : une bande horizontale de cellules 32×32, exactement comme
  une vignette (≤ 15 couleurs + index 0 transparent). Une animation =
  UNE planche, donc UNE palette OBJ.
- `x` / `y` : décalage SIGNÉ en pixels par rapport au point d'ancrage
  (voir §3.2). C'est ça qui donne le déplacement image par image.
- `dur` : durée de la frame en frames écran (1-255).
- `sfx` : son joué À L'ENTRÉE de cette frame (facultatif).

### 3.2 Ancrage

Comme RM2003 : `écran` (position absolue), `héros`, ou `event n`. Le
lecteur ajoute le décalage de la frame à la position de la cible,
recalculée à chaque frame — une animation ancrée sur un PNJ le suit
s'il bouge.

### 3.3 Binaire (bank data)

Table d'animations : `[n]` puis par animation `[cells_id][flags]
[frame_count][offset frames]`. Chaque frame fait **4 octets** :
`[cell][dx signé][dy signé][dur | bit7 = son présent]`, le son suivant
sur un octet quand le bit est levé. Compact : une animation de 12
frames tient en ~50 octets.

## 4. Lecteur runtime (`anim.c`)

Modèle du module de vignettes, un slot = une cellule à l'écran.

```
anim_play(id, ancre, cible)   anim_stop(slot)   anim_busy()
anim_update()   (une fois par frame, dans la boucle principale)
anim_vblank()   (transfert des chars de la cellule courante)
```

Par frame et par animation active : décrémenter le compteur de durée,
et au changement de frame seulement — programmer le transfert VRAM de
la nouvelle cellule, jouer le son s'il y en a un. Le reste du temps,
c'est un test et une écriture OAM. Coût visé : **moins d'une ligne
d'écran par animation active**, contre ~13 pour un acteur avant P3.

Budget VBlank : un changement de cellule = 4 DMA de 128 octets. Le
lecteur n'en autorise **qu'un par frame** (file d'attente si deux
animations changent en même temps), règle déjà appliquée aux vignettes.

## 5. Commande d'event

« Jouer une animation » : animation, cible (écran / héros / cet event /
event n), et une case **attendre la fin**. Sans l'attente, le script
continue et l'animation vit sa vie — indispensable pour animer pendant
un dialogue.

Opcode `ANIMPLAY` : `[anim][ancre][cible][flags]`. L'attente réutilise
le mécanisme des attentes non-UI de la VM (`VM_WAIT_*`), comme
l'attente de route ou de caméra.

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

1. **A1-a** — format + datagen (planche → chars OBJ, table binaire) +
   lecteur runtime + opcode `ANIMPLAY`. Testable par un script écrit à
   la main, sans éditeur.
2. **A1-b** — commande d'event et son formulaire.
3. **A1-c** — fenêtre Animations : timeline, canevas, inspecteur,
   lecture.
4. **A1-d** — passage à 4 emplacements simultanés (petit, séparé : il
   touche aux vignettes existantes).

Chaque cran est livrable et vérifiable seul ; la régression pixel
couvre le moteur à chaque étape.
