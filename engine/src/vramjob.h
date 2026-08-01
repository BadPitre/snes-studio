/*
 * vramjob.h — transferts VRAM par LOTS (P6).
 *
 * LE CHIFFRE QUI JUSTIFIE CE MODULE
 * P5 avait mesure qu'un appel a dmaCopyVram coute ~1,5 LIGNE ECRAN a
 * vide, quelle que soit sa taille, alors que le transfert lui-meme
 * avance a ~171 octets par ligne. P6 a mesure ce que ca donne bout a
 * bout, sur une carte 48x40 qui streame vraiment :
 *
 *   une colonne de carte = 8 appels de 64 octets = 512 octets
 *     -> 22 lignes mesurees, dont 3 de transfert reel.
 *   un pas de tile animee = 4 appels de 32 octets = 128 octets
 *     -> 18 lignes mesurees, dont 0,75 de transfert reel.
 *
 * Autrement dit : 95 % de la fenetre VBlank part en APPRETS. Et
 * l'apparence de dmaCopyVram trompe — le gros du cout n'est pas dans
 * la routine PVSnesLib (une trentaine d'instructions) mais du cote
 * APPELANT, ou tcc-816 empile cinq arguments un par un depuis sa pile
 * logicielle. C'est le meme diagnostic que P4 sur les acteurs : le
 * codegen, pas l'algorithme.
 *
 * CE QUE FAIT CE MODULE
 * Une file de transferts preparee HORS de la fenetre VBlank, videe par
 * UN SEUL appel (vram_burst, en assembleur). Les registres invariants
 * du lot — mode DMA, porte $2118, increment $2115 — sont ecrits une
 * fois ; par transfert il ne reste que source, taille, adresse VRAM et
 * le coup d'envoi. Quatre transferts groupes coutent donc a peu pres
 * ce qu'UN seul coutait.
 *
 * Chaque consommateur possede une TRANCHE fixe de la file : il la
 * remplit quand il veut (dans son *_update, hors VBlank) et le bloc
 * VBlank ne fait plus que declencher. Pas de file partagee a se
 * disputer, pas de recopie au moment ou l'on n'a pas le temps.
 *
 * CE QUE CA DONNE, MESURE
 * Meme profileur, meme carte 48x40, meme parcours, 497 frames retenues
 * apres chauffe. Les sondes sont identiques des deux cotes ; ce sont
 * les ECARTS qui comptent, pas les valeurs absolues.
 *
 *                        avant   apres
 *   colonne de carte       22      12   lignes ecran
 *   pas de tile animee     18       5
 *   pic du bloc VBlank     32      22   (sur 30 de fenetre utile)
 *   moyenne du bloc      13,1    12,3
 *   fin la plus tardive   259     252   sur 262
 *   frames en debordement   8       0   sur 497
 *
 * Le meme travail passe donc, mais il tient dans la fenetre. Le pic du
 * bloc perd dix lignes : c'est la marge que B5 avait du s'inventer en
 * ramenant VIG_VB_MAX a 1, rendue pour de bon.
 *
 * AU PASSAGE, une correction : P5 declarait VBL_COST_MAPHALF a 10
 * lignes. La mesure en donne 22 — le double. L'arbitre croyait donc
 * avoir de la place la ou il n'en avait plus, et c'est ce qui explique
 * les 8 debordements de la colonne « avant ». Les couts annonces
 * viennent maintenant d'une formule sur le nombre de transferts et le
 * volume (VBL_COST_BURST), pas d'un chiffre pose a la main.
 *
 * CE QUI N'Y EST PAS PASSE
 * Les vignettes (B5) gardent dmaCopyVram : leurs quatre transferts
 * dependent du slot choisi AU MOMENT du VBlank (l'arbitre decide qui
 * passe), donc preparer la file couterait ici ce qu'elle fait
 * economiser la. La couche UI n'a qu'un seul appel : rien a grouper.
 */
#ifndef VRAMJOB_H
#define VRAMJOB_H

#include <snes.h>

/* $2115 : increment de l'adresse VRAM apres l'octet haut.
   +1 mot pour une suite de mots, +32 mots pour une colonne de tilemap. */
#define VJ_INC1 0x80
#define VJ_INC32 0x81

/* $4300/$4301 : mode 1 (deux registres) vers la porte $2118. */
#define VJ_CTRL_VRAM 0x1801

/* Tranches de la file. Colonne et rangee de carte peuvent tomber sur la
   MEME frame (deplacement en diagonale, pan de camera) : elles ont donc
   chacune la leur. */
#define VJ_MAP_COL 0   /* 8 : 2 couches x 2 colonnes de chars x 2 segments */
#define VJ_MAP_ROW 8   /* 8 : idem en rangees */
#define VJ_TILEANIM 16 /* 4 chars, fusionnes en 1 a 4 transferts */
#define VJ_MAX 20

/* La file. u16 partout, y compris pour la banque : tcc-816 entoure
   chaque operation 8 bits d'un sep/rep, et l'assembleur lit de toute
   facon l'octet bas. Un octet perdu par transfert, aucun sep/rep. */
extern u16 vj_src[VJ_MAX];  /* adresse basse de la source */
extern u16 vj_bank[VJ_MAX]; /* banque de la source (octet bas) */
extern u16 vj_dst[VJ_MAX];  /* adresse VRAM, en MOTS */
extern u16 vj_len[VJ_MAX];  /* octets */

/* Parametres du lot a declencher — poses juste avant vram_burst(). */
extern u16 vj_first; /* premier transfert de la tranche */
extern u16 vj_n;     /* combien en enchainer (0 = ne rien faire) */
extern u16 vj_vmain; /* VJ_INC1 ou VJ_INC32, commun au lot */
extern u16 vj_ctrl;  /* VJ_CTRL_VRAM, commun au lot */

/* Range un transfert dans la file. A appeler HORS fenetre VBlank : c'est
   tout l'interet du module. `dst` est une adresse VRAM en MOTS. */
void vj_set(u16 i, const u8 *src, u16 dst, u16 len);

/* Enchaine vj_n transferts a partir de vj_first (vramfast.asm). */
void vram_burst(void);

#endif /* VRAMJOB_H */
