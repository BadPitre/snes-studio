; vramfast.asm — vidage de la file de transferts VRAM (P6).
;
; POURQUOI DE L'ASSEMBLEUR POUR HUIT ECRITURES DE REGISTRES
; La routine dmaCopyVram7 de PVSnesLib fait une trentaine
; d'instructions. Ce n'est pas elle qui coute : c'est l'APPEL. tcc-816
; empile ses cinq arguments un par un depuis sa pile logicielle, et le
; tout revient a ~1,5 LIGNE ECRAN par transfert, mesuree au compteur de
; balayage. Une colonne de carte en demande huit : 22 lignes sur les 30
; que dure la fenetre, pour 512 octets qui n'en valent que 3.
;
; Ici, les registres invariants du lot (mode DMA, porte $2118,
; increment $2115) sont ecrits UNE FOIS, et par transfert il ne reste
; que quatre ecritures : source, taille, adresse VRAM, coup d'envoi.
;
; MESURE, meme profileur, carte 48x40 qui streame sur les deux axes,
; 497 frames retenues apres chauffe (les chiffres detailles sont dans
; vramjob.h) : le pic du bloc VBlank tombe de 32 lignes a 22, et les
; 8 frames sur 497 qui debordaient n'existent plus.
;
; CONTRAT
;   entree : vj_first, vj_n, vj_vmain, vj_ctrl et les quatre tableaux
;            vj_src / vj_bank / vj_dst / vj_len (definis en C).
;   sortie : rien. Aucun registre C n'est modifie.
;
; CONVENTIONS 65816, les memes qu'actorsfast.asm :
;  - `long,Y` n'existe pas : tous les tableaux sont indexes par X. C'est
;    pour ca que vj_bank est un tableau de MOTS et pas d'octets — un
;    tableau d'octets aurait demande un second index.
;  - CPX n'a pas de mode long : le compteur de boucle vit dans Y, qui
;    n'indexe rien ici, et la sortie se fait sur `dey / bne`.
;  - sep #$20 ne touche que le bit M : l'index reste 16 bits d'un bout
;    a l'autre, donc phx/plx et phy/ply sont coherents.

.include "hdr.asm"
.accu 16
.index 16
.16bit

.SECTION "vramfast" SUPERFREE

; void vj_set(u16 i, const u8 *src, u16 dst, u16 len)
;
; POURQUOI CELLE-CI AUSSI EST EN ASSEMBLEUR
; Un DMA a besoin de la BANQUE de sa source, et le C ne peut pas la
; donner : tcc-816 passe bien un pointeur sur QUATRE octets — banque
; comprise — quand on le confie a une fonction, mais `(u32)p` ne garde
; que les 16 bits bas ET ETEND LE SIGNE. Mesure a l'appui : la table
; sortait banque $00 pour un tampon WRAM en $7E:400E et banque $FF pour
; un charset ROM en $8x:AF7B — adresses respectivement positive et
; negative en 16 bits signes. Les tiles animees s'affichaient en noir.
; Ici on lit les quatre octets la ou l'appelant les a poses, exactement
; comme dmaCopyVram de PVSnesLib.
;
; Pile apres php + phx (index deja force a 16 bits) :
;   1-2  X sauve      3  P sauve      4-6  adresse de retour
;   7-8  i            9-12 src (mot bas, puis mot haut = banque)
;   13-14 dst         15-16 len

vj_set:
    php
    rep #$30
.accu 16
.index 16
    phx
    lda 7,s
    asl a               ; index d'OCTET dans des tableaux de mots
    tax
    lda 9,s             ; source, 16 bits bas
    sta.l vj_src,x
    lda 11,s            ; mot haut du pointeur : la banque est en bas
    sta.l vj_bank,x
    lda 13,s            ; adresse VRAM, en mots
    sta.l vj_dst,x
    lda 15,s            ; taille en octets
    sta.l vj_len,x
    plx
    plp
    rtl

vram_burst:
    php
    phx
    phy
    rep #$30
.accu 16
.index 16
    lda.l vj_n
    and #$00FF          ; jamais plus de VJ_MAX transferts
    beq _vb_fin
    tay                 ; Y = compteur de boucle
    lda.l vj_first
    asl a               ; index d'OCTET dans des tableaux de mots
    tax

    sep #$20
.accu 8
    lda.l vj_vmain
    sta.l $002115       ; increment de l'adresse VRAM
    lda.l vj_ctrl
    sta.l $004300       ; mode de transfert
    lda.l vj_ctrl + 1
    sta.l $004301       ; porte du bus B ($2118)

_vb_boucle:
    rep #$20
.accu 16
    lda.l vj_dst,x
    sta.l $002116       ; adresse VRAM (en mots)
    lda.l vj_src,x
    sta.l $004302       ; source, 16 bits bas
    lda.l vj_len,x
    sta.l $004305       ; taille en octets
    sep #$20
.accu 8
    lda.l vj_bank,x     ; octet bas du mot = banque
    sta.l $004304
    lda #$01
    sta.l $00420B       ; coup d'envoi (canal 0)
    rep #$20
.accu 16
    inx
    inx
    dey
    bne _vb_boucle

_vb_fin:
    rep #$30
.accu 16
.index 16
    ply
    plx
    plp
    rtl

.ENDS
