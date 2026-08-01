; actorsfast.asm — boucle d'affichage des acteurs en 65816 (P4).
;
; POURQUOI DE L'ASSEMBLEUR ICI, ET NULLE PART AILLEURS
; Mesure au compteur de scanline, plaine peuplee :
;   0 PNJ -> 6,9 lignes    8 -> 85    16 -> 165    24 -> 244
; soit 9,88 lignes ECRAN par acteur visible, parfaitement lineaire, et
; 244 lignes sur 262 a 24 PNJ — la frame entiere passe la. Ramene en
; cycles CPU : ~2 250 par acteur, pour une quinzaine de lectures de
; tableau et quatre ecritures OAM. Ce n'est pas l'algorithme qui coute
; (P3 l'avait deja degraisse : mots OAM invariants en cache, ecriture
; inlinee, sortie anticipee des hors-champ), c'est le CODEGEN de
; tcc-816 — un sep/rep autour de chaque operation sur u8, une adresse
; longue recalculee a chaque acces de tableau. Aucune reecriture en C
; ne rattrape ca ; c'est le seul endroit du moteur ou le profil
; justifie le cout de maintenance de l'assembleur.
;
; CONTRAT
;   entree : actors_hot_n (u8), camera.x / camera.y, tableaux actor_*
;   sortie : shadow OAM ecrit pour les acteurs VISIBLES ; actor_shown,
;            actor_x9, actor_lastf, actor_w1, actor_w3 a jour ; les
;            acteurs a CACHER listes dans actors_hide_list/_n.
;
; Le masquage reste en C : il n'arrive qu'a la TRANSITION hors champ
; (jamais en regime etabli, c'est le gain de P3) et il passe par
; oamSetVisible de PVSnesLib, qu'on ne veut pas dupliquer ici.
;
; CONVENTIONS 65816 respectees ici, chacune apprise a ses depens :
;  - A reste en 16 bits ; les tableaux d'OCTETS se LISENT en 16 bits
;    avec un and #$00FF (l'octet suivant est ignore), mais s'ECRIVENT
;    obligatoirement sous sep #$20 — un store 16 bits ecraserait
;    l'element voisin.
;  - `long,Y` n'existe pas sur 65816 : seul `long,X` est encode. Les
;    acces indexes par Y passent donc par l'adressage ABSOLU, avec le
;    registre de bank pose a $7E (tout est en WRAM basse).
;  - X porte i (index d'octet), Y porte 2*i ou l'offset OAM selon la
;    phase ; af_i2 garde 2*i quand les deux sont necessaires.
;
; CE QUE CA DONNE, MESURE (meme profileur, moyenne sur 128 frames apres
; chauffe, cout de actors_draw() seul) :
;      PNJ visibles      8      16      24
;   C (tcc-816)         86     166     245  lignes ecran
;   asm, adr. longue    28      51      95
;   asm, page directe   26      47      90
; soit 2,7x plus rapide que le C. Le passage des temporaires en page
; directe n'apporte que 5 a 7 % la-dedans : je l'avais annonce comme LE
; facteur manquant, c'est faux — l'essentiel du gain vient de la
; suppression des sep/rep et du recalcul d'adresse longue par acces de
; tableau. Il est garde parce qu'il est acquis et sans risque, pas parce
; qu'il change la donne.
;
; A noter pour qui reprendra la mesure : a 16 et 24 PNJ, la version C ne
; boucle que 370 fois sur 900 frames — elle tourne a 30 Hz. Les deux
; versions ne simulent alors PAS la meme chose ; seul le cout de
; actors_draw() se compare, pas le rendu.

.include "hdr.asm"
.accu 16
.index 16
.16bit

; Offsets des temporaires dans la PAGE DIRECTE (voir la note sur la
; RAMSECTION, en bas de ce fichier : elle DOIT rester en bank $00)
.define D_N 0
.define D_CX 2
.define D_CY 4
.define D_CXMAX 6
.define D_CYMAX 8
.define D_AX 10
.define D_AY 12
.define D_SX 14
.define D_SY 16
.define D_X8 18
.define D_F 20
.define D_PAL 22
.define D_ATTR 24
.define D_TILE 26
.define D_T 28
.define D_T2 30
.define D_I2 32
.define D_MASK 34
.define D_MASKN 36

.SECTION "actorsfasttext" SUPERFREE

actors_draw_hot:
    phb
    phd
    php
    rep #$30                    ; A et X/Y en 16 bits, une fois pour toutes
    sep #$20
    lda #$7E
    pha
    plb                         ; DB = $7E : oamMemory et le .bss adressables
    rep #$20                    ; en absolu, donc indexables par Y
    lda.w #af_n                 ; D sur le bloc de temporaires : chaque
    tcd                         ; acces passe de 5-6 a 3-4 cycles

    lda.l actors_hot_n
    and.w #$00FF
    bne +
    brl _fin
+
    sta.b D_N

    lda.l camera                ; camera.x
    sta.b D_CX
    clc
    adc.w #256
    sta.b D_CXMAX
    lda.l camera + 2            ; camera.y
    sta.b D_CY
    clc
    adc.w #232                  ; 224 + SPRITE_Y_OVERLAP
    sta.b D_CYMAX

    sep #$20
    lda #0                      ; STZ n'a pas de mode long sur 65816
    sta.l actors_hide_n
    rep #$20
    ldx.w #0

; ---- un tour par slot ------------------------------------------------
_boucle:
    lda.l actor_active,x
    and.w #$00FF
    bne +                ; page inactive : OBJ deja caches
    brl _suivant
+

    lda.l actor_sprite,x
    and.w #$00FF
    cmp.w #$00FF
    bne +                ; invisible
    brl _suivant
+
    sta.b D_PAL

    txa
    asl a
    sta.b D_I2                 ; 2*i pour les tableaux 16 bits
    tay

    ; --- visibilite : metasprite 16x24 contre la fenetre camera -------
    lda.w actor_px,y
    sta.b D_AX
    clc
    adc.w #16
    cmp.b D_CX
    bne +                   ; ax+16 <= cx
    brl _hors
+
    bcs +
    brl _hors
+
    lda.b D_AX
    cmp.b D_CXMAX
    bcc +                   ; ax >= cx+256
    brl _hors
+

    lda.w actor_py,y
    sta.b D_AY
    clc
    adc.w #16
    cmp.b D_CY
    bne +
    brl _hors
+
    bcs +
    brl _hors
+
    lda.b D_AY
    cmp.b D_CYMAX
    bcc +
    brl _hors
+

    ; --- coordonnees ecran --------------------------------------------
    lda.b D_AX
    sec
    sbc.l af_cx
    sta.b D_SX                 ; 16 bits : le 9e bit sert plus bas
    and.w #$00FF
    sta.b D_X8

    lda.b D_AY
    sec
    sbc.l af_cy
    sec
    sbc.w #8                    ; SPRITE_Y_OVERLAP
    and.w #$00FF
    sta.b D_SY

    ; --- numero de frame : base + direction*3 + pas de marche ---------
    lda.l actor_gfx,x
    and.w #$00FF
    cmp.w #$00FF
    bne _gfx_force
    lda.l actor_fbase,x         ; base normale (sprite_id * 12)
    and.w #$00FF
    bra _gfx_ok
_gfx_force:                     ; Change Graphic : gfx * 12
    sta.b D_T
    asl a
    asl a                       ; g*4
    sta.b D_T2
    lda.b D_T
    asl a
    asl a
    asl a                       ; g*8
    clc
    adc.b D_T2                 ; g*12
    and.w #$00FF
_gfx_ok:
    sta.b D_F

    lda.l actor_dirs,x
    and.w #$00FF
    sta.b D_T
    asl a
    clc
    adc.b D_T                  ; d*3
    clc
    adc.b D_F
    and.w #$00FF
    sta.b D_F

    lda.l actor_step,x
    and.w #$00FF
    beq _frame_ok               ; aucun pas en cours : pose de repos
    lda.l actor_anim,x
    and.w #$00FF
    sta.b D_T
    and.w #$0001
    beq _frame_ok               ; phase paire : repos
    lda.b D_T
    lsr a                       ; anim >> 1
    clc
    adc.w #1
    clc
    adc.b D_F
    and.w #$00FF
    sta.b D_F
_frame_ok:

    ; --- mots OAM invariants : recalcules SEULEMENT si la frame change -
    lda.l actor_lastf,x
    and.w #$00FF
    cmp.b D_F
    beq _oam                    ; cache encore valide

    sep #$20
    lda.b D_F
    sta.l actor_lastf,x         ; store 8 bits : ne pas ecraser le voisin
    rep #$20

    ; tile = ((f & 0xF8) << 3) | ((f & 7) << 1)
    lda.b D_F
    and.w #$00F8
    asl a
    asl a
    asl a
    sta.b D_T2
    lda.b D_F
    and.w #$0007
    asl a
    ora.b D_T2
    sta.b D_TILE
    ; attr = (pal << 1) | (prio << 4), prio 3 si ACTOR_PRIO_ABOVE sinon 2
    lda.l actor_prio,x
    and.w #$00FF
    cmp.w #2                    ; ACTOR_PRIO_ABOVE
    bne _prio_normale
    lda.w #(3 << 4)
    bra _prio_ok
_prio_normale:
    lda.w #(2 << 4)             ; ACTOR_OBJ_PRIO
_prio_ok:
    sta.b D_T2
    lda.b D_PAL
    asl a
    ora.b D_T2
    sta.b D_ATTR

    lda.b D_I2                 ; LDY n'a pas de mode long : passer par A
    tay
    jsr _mot_oam                ; w1 depuis af_tile
    sta.w actor_w1,y
    lda.b D_TILE
    clc
    adc.w #32                   ; rangee du dessous
    sta.b D_TILE
    lda.b D_I2
    tay
    jsr _mot_oam
    sta.w actor_w3,y

; ---- ecriture des deux entrees OAM -----------------------------------
_oam:
    txa                         ; ACTOR_OAM_TOP(i) = ((i<<1)+2)<<2 = 8i + 8
    asl a
    asl a
    asl a
    clc
    adc.w #8
    tay                         ; Y = offset d'octet dans oamMemory

    lda.b D_SY
    xba                         ; sy en octet haut
    ora.b D_X8
    sta.w oamMemory,y           ; mot 0 : X | Y<<8

    phy
    lda.b D_I2
    tay
    lda.w actor_w1,y
    ply
    sta.w oamMemory + 2,y       ; mot 1

    lda.b D_SY
    clc
    adc.w #16
    and.w #$00FF
    xba
    ora.b D_X8
    sta.w oamMemory + 4,y       ; mot 2

    phy
    lda.b D_I2
    tay
    lda.w actor_w3,y
    ply
    sta.w oamMemory + 6,y       ; mot 3

    ; --- 9e bit de X : la table 2 n'est touchee qu'au CHANGEMENT -------
    lda.b D_SX
    and.w #$0100
    beq _x9_val
    lda.w #1
_x9_val:
    sta.b D_T                  ; nouveau x9 (0 ou 1)
    lda.l actor_x9,x
    and.w #$00FF
    cmp.b D_T
    beq _montre                 ; inchange : on ne touche pas la table 2

    ; masque : (id>>2)&3 == 0 ? 0x05 : 0x50. id = 8i+8, donc
    ; id>>2 = 2i+2, nul modulo 4 quand i est IMPAIR.
    txa
    and.w #$0001
    beq _masque_pair
    lda.w #$0005                ; i impair -> (id>>2)&3 == 0
    bra _masque_ok
_masque_pair:
    lda.w #$0050
_masque_ok:
    sta.b D_MASK

    tya                         ; Y = offset OAM de l'acteur
    lsr a
    lsr a
    lsr a
    lsr a                       ; id >> 4
    clc
    adc.w #512
    tay                         ; octet de la table 2

    sep #$20
    lda.b D_T
    sta.l actor_x9,x            ; store 8 bits
    beq _x9_efface
    lda.w oamMemory,y
    ora.b D_MASK
    bra _x9_ecrit
_x9_efface:
    lda.b D_MASK
    eor #$FF
    sta.b D_MASKN
    lda.w oamMemory,y
    and.b D_MASKN
_x9_ecrit:
    sta.w oamMemory,y
    rep #$20

_montre:
    sep #$20
    lda #1
    sta.l actor_shown,x
    rep #$20
    bra _suivant

; ---- hors champ : le C s'en charge, et seulement a la TRANSITION -----
_hors:
    lda.l actor_shown,x
    and.w #$00FF
    bne +                ; deja cache : rien a faire (le gain P3)
    brl _suivant
+
    lda.l actors_hide_n
    and.w #$00FF
    tay
    sep #$20
    txa
    sta.w actors_hide_list,y
    lda.l actors_hide_n
    inc a
    sta.l actors_hide_n
    rep #$20

_suivant:
    inx
    cpx.b D_N                  ; CPX n'a pas de mode long ; af_n est en
    bcs +                 ; bank $7E, adressable en absolu (DB = $7E)
    brl _boucle
+

_fin:
    plp
    pld
    plb
    rtl

; mot OAM depuis af_tile et af_attr :
;   (tile & 0xFF) | ((attr | (tile >> 8)) << 8)
; Y est preserve par l'appelant autour de l'appel.
_mot_oam:
    lda.b D_TILE
    xba                         ; octet haut de tile en bas
    and.w #$00FF
    ora.b D_ATTR
    xba                         ; remonte en octet haut
    and.w #$FF00
    sta.b D_T2
    lda.b D_TILE
    and.w #$00FF
    ora.b D_T2
    rts

.ENDS

; Variables de travail. En BANK 0 (SLOT 1) et non en $7E : l'adressage en
; PAGE DIRECTE du 65816 vise TOUJOURS la bank $00, quel que soit le
; registre de bank. Un bloc pose en $7E et adresse via D tape dans les
; registres PPU — c'est la regression pixel qui l'a signale, en trois
; images faussees, avant que ca ne devienne un fantome de plus.
.RAMSECTION "actorsfastvars" BANK 0 SLOT 1
af_n      dw
af_cx     dw
af_cy     dw
af_cxmax  dw
af_cymax  dw
af_ax     dw
af_ay     dw
af_sx     dw
af_sy     dw
af_x8     dw
af_f      dw
af_pal    dw
af_attr   dw
af_tile   dw
af_t      dw
af_t2     dw
af_i2     dw
af_mask   dw
af_maskn  dw
.ENDS
