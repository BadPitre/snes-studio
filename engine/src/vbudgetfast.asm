; vbudgetfast.asm — lecture du compteur de balayage vertical (P5).
;
; POURQUOI DE L'ASSEMBLEUR POUR QUATRE ACCÈS REGISTRE
; La version C de cette lecture — quatre lectures 8 bits, un décalage,
; un OU — coûte ~2 LIGNES ÉCRAN, mesurées au compteur lui-même. Sur une
; fenêtre VBlank de 30 lignes, c'est 7 % dépensés à savoir où l'on en
; est. La première mouture de l'arbitrage en posait deux par frame et
; sortait PIRE que le moteur sans arbitre : 34 lignes de pic contre 29,
; et cinq frames sur 128 qui débordaient là où il n'y en avait aucune.
; Le coupable est le codegen de tcc-816, un sep/rep autour de chaque
; opération 8 bits et un appel de fonction complet pour ça.
;
; Sans lecture du compteur, l'arbitrage ne peut travailler que sur une
; fenêtre CONSTANTE et des coûts annoncés — et il devient aveugle à tout
; ce qui n'est pas déclaré. Mesuré : face à six transferts non comptés
; injectés dans le bloc, la version à budget constant déborde exactement
; autant que le moteur sans arbitre (11 frames sur 128). Une lecture du
; compteur est donc le seul garde-fou réel ; il fallait la rendre
; gratuite, pas la supprimer.
;
; Résultat déposé dans vbl_v (défini côté C) plutôt que rendu en A : ça
; évite de dépendre de la convention de retour de tcc-816, et c'est le
; même contrat que actorsfast.asm.

.include "hdr.asm"
.accu 16
.index 16
.16bit

.SECTION "vbudgetfast" SUPERFREE

vbl_probe:
    php
    sep #$20
.accu 8
    lda.l $002137 ; latche H et V
    lda.l $00213F ; remet le basculeur haut/bas à zéro
    lda.l $00213D ; OPVCT poids faible
    sta.l vbl_v
    lda.l $00213D ; OPVCT poids fort — seul le bit 0 sert (261 max)
    and #$01
    sta.l vbl_v + 1
    plp
.accu 16
    rtl

.ENDS
