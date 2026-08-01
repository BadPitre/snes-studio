/*
 * vbudget.h — arbitrage de la fenêtre VBlank (P5).
 *
 * CE QUE LA MESURE A DONNÉ (compteur V latché en entrée et en sortie du
 * bloc VBlank, projet demo, 128 frames après chauffe) :
 *
 *  - on ENTRE dans le bloc à la ligne 230, jamais avant : le VBlank
 *    commence à 225 et le gestionnaire de NMI de PVSnesLib (DMA de
 *    l'OAM, manettes) en mange les cinq premières lignes. La fenêtre
 *    utile fait 30 lignes, pas 38.
 *  - un appel à dmaCopyVram coûte ~1,5 ligne d'apprêts À VIDE, quelle
 *    que soit sa taille ; le transfert lui-même avance à ~171 octets par
 *    ligne. Un transfert de 32 octets paie six fois plus d'apprêts que
 *    de données : c'est le NOMBRE d'appels qui compte, pas le volume.
 *    Un budget en octets mesurerait la mauvaise chose.
 *  - coût par consommateur, pic observé (sonde déduite) :
 *      registres (scroll/teinte/HDMA)   8
 *      map_vblank (colonne + rangée)   22
 *      tileanim_vblank                 20
 *      ui_screen_vblank                 3 … 16 selon les rangées sales
 *      vig_vblank (une cellule)        12 (modélisé)
 *    Le bloc entier culmine à 29 lignes sur 30. Aucun débordement dans
 *    la demo telle qu'elle est — mais zéro marge, et les pics ne se
 *    cumulent pas par chance, pas par construction.
 *
 * D'où B5 : VIG_VB_MAX avait dû être ramené à 1 « parce que les
 * dernières rangées tombaient hors fenêtre ». Une cellule de plus, ce
 * sont 4 appels DMA = 6 lignes, et 29 + 6 dépasse. Le quota privé était
 * juste ; sa raison est maintenant chiffrée.
 *
 * CE QUE FAIT CE MODULE
 * Il tient un reste, en lignes. UNE lecture du compteur V par frame,
 * placée après le travail non compté ; ensuite, de la pure
 * soustraction.
 *
 * Ces deux lectures passent par vbudgetfast.asm, et ce n'est pas de la
 * coquetterie : la même lecture écrite en C coûte ~2 lignes, soit 7 %
 * de la fenêtre, deux fois par frame. La première mouture faisait
 * exactement ça et sortait PIRE que le moteur sans arbitre — 34 lignes
 * de pic contre 29, cinq frames sur 128 qui débordaient là où il n'y en
 * avait aucune. La deuxième supprimait la lecture au profit d'une
 * fenêtre constante : gratuite, mais aveugle à tout ce qui n'est pas
 * déclaré, et face à six transferts non comptés elle débordait autant
 * que le moteur sans arbitre. Il fallait la lecture, et il fallait
 * qu'elle soit gratuite.
 *
 * Les écritures de REGISTRES (scroll, luminosité, teinte, HDMA) ne
 * passent pas par ici et se font EN PREMIER : elles sont obligatoires —
 * un scroll non écrit, c'est l'écran qui saute d'une tuile — et elles
 * ne doivent jamais être la victime d'une fenêtre trop courte.
 */
#ifndef VBUDGET_H
#define VBUDGET_H

#include <snes.h>

/* Dernière ligne où l'on s'autorise à finir un transfert. L'affichage
   reprend à 0 ; la marge couvre l'imprécision des coûts annoncés, qui
   sont des pics arrondis et non des mesures par frame. */
#define VBL_LAST 256

/* Coûts annoncés, en lignes écran : le PIC mesuré, pas la moyenne. Un
   consommateur qui déclare sa moyenne déborde sur ses mauvaises frames.
   Ils incluent le calcul d'adresses en C, qui pèse plus lourd que le
   transfert lui-même — tcc-816 recalcule une adresse longue à chaque
   accès de tableau. À revoir si un consommateur change. */
#define VBL_COST_MAPHALF 10  /* mesuré : colonne OU rangée, 4 appels */
#define VBL_COST_TILEANIM 18 /* mesuré : 4 appels de 32 octets — trois
                                fois le coût de son propre transfert */
#define VBL_COST_VIG 12      /* MODÉLISÉ (4 appels + 512 o), pas mesuré :
                                la demo n'a aucune animation qui tourne */
#define VBL_COST_UI(rows) ((u8)(2 + ((rows) >> 1))) /* 1 appel + rows*64 o */
/* Combien de rangées d'UI tiennent dans `lines` lignes (inverse). */
#define VBL_UI_ROWS(lines) ((u8)((lines) <= 2 ? 0 : ((lines) - 2) << 1))

/* Ouvre le budget : lit le compteur, ancre le reste, fait tourner la
   priorité des facultatifs. À placer APRÈS le travail non compté de la
   branche (écritures de registres, pose de l'écran composé) et AVANT le
   premier transfert négociable — une seule fois par frame, la lecture
   n'étant pas tout à fait gratuite même en assembleur. */
void vbl_open(void);

/* Réserve `lines` lignes. 0 = pas la place : renoncer, laisser la donnée
   sale, elle repassera à la frame suivante. */
u8 vbl_take(u8 lines);

/* Ce qui reste, sans rien réserver — pour un consommateur qui se DÉCOUPE
   au lieu de renoncer (la couche UI). */
u8 vbl_left(void);

/* 0 ou 1 : lequel des deux facultatifs passe en premier cette frame.
   Dans une chaîne figée, le dernier est le sacrifié systématique. */
u8 vbl_turn(void);

#endif /* VBUDGET_H */
