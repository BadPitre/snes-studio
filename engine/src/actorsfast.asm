; actorsfast.asm — the actor drawing loop, in 65816 (P4).
;
; WHY ASSEMBLY HERE, AND NOWHERE ELSE
; Measured with the scanline counter, on a populated plain:
;   0 NPCs -> 6.9 lines    8 -> 85    16 -> 165    24 -> 244
;
; that is 9.88 SCREEN lines per visible actor, perfectly linear, and
; 244 lines out of 262 at 24 NPCs — the whole frame goes there.
; Brought back to CPU cycles: ~2,250 per actor, for fifteen-odd array
; reads and four OAM writes. It is not the algorithm that costs (P3
; had already trimmed it: invariant OAM words cached, the write
; inlined, early exit for off-screen actors), it is tcc-816's CODEGEN
; — a sep/rep around every u8 operation, a long address recomputed on
; every array access. No C rewrite catches up with that; this is the
; only place in the engine where the profile justifies the maintenance
; cost of assembly.
;
; CONTRACT
;   in:  actors_hot_n (u8), camera.x / camera.y, the actor_* arrays
;   out: the OAM shadow written for VISIBLE actors; actor_shown,
;        actor_x9, actor_lastf, actor_w1, actor_w3 up to date; the
;        actors to HIDE listed in actors_hide_list/_n.
;
; Hiding stays in C: it only happens on the TRANSITION off screen
; (never in steady state — that is the P3 gain) and it goes through
; PVSnesLib's oamSetVisible, which we do not want to duplicate here.
;
; The 65816 conventions this file obeys, each learned the hard way:
;  - A stays 16-bit; BYTE arrays are READ in 16 bits with an
;    and #$00FF (the next byte is ignored), but they MUST be WRITTEN
;    under sep #$20 — a 16-bit store would clobber the neighbour.
;  - "long,Y" does not exist on the 65816: only "long,X" is encoded.
;    Y-indexed accesses therefore go through ABSOLUTE addressing, with
;    the bank register set to $7E (everything is in low WRAM).
;  - X carries i (byte index), Y carries 2*i or the OAM offset
;    depending on the phase; af_i2 keeps 2*i when both are needed.
;
; WHAT IT BUYS, MEASURED (same profiler, mean over 128 frames after
; warm-up, the cost of actors_draw() alone):
;      visible NPCs      8      16      24
;   C (tcc-816)         86     166     245  screen lines
;   asm, long address   28      51      95
;   asm, direct page    26      47      90
; that is 2.7x faster than the C. Moving the temporaries to the direct
; page only accounts for 5 to 7 % of it: I had announced it as THE
; missing factor, which is wrong — most of the gain comes from
; removing the sep/rep pairs and the long-address recomputation on
; every array access. It is kept because it is acquired and risk-free,
; not because it changes anything.
;
; Worth knowing for whoever redoes the measurement: at 16 and 24 NPCs
; the C version only loops 370 times over 900 frames — it runs at
; 30 Hz. The two versions are then NOT simulating the same thing; only
; the cost of actors_draw() compares, not the rendering.

.include "hdr.asm"
.accu 16
.index 16
.16bit

; Offsets of the temporaries in the DIRECT PAGE (see the note about the
; RAMSECTION at the bottom of this file: it MUST stay in bank $00)
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
    rep #$30                    ; A and X/Y 16-bit, once and for all
    sep #$20
    lda #$7E
    pha
    plb                         ; DB = $7E: oamMemory and the .bss are
    rep #$20                    ; absolute-addressable, hence Y-indexable
    lda.w #af_n                 ; D on the temporaries block: each access
    tcd                         ; goes from 5-6 down to 3-4 cycles

    lda.l actors_hot_n
    and.w #$00FF
    bne +
    brl _af_end
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
    lda #0                      ; STZ has no long mode on the 65816
    sta.l actors_hide_n
    rep #$20
    ldx.w #0

; ---- one pass per slot -----------------------------------------------
_af_loop:
    lda.l actor_active,x
    and.w #$00FF
    bne +                ; inactive page: OBJs already hidden
    brl _af_next
+

    lda.l actor_sprite,x
    and.w #$00FF
    cmp.w #$00FF
    bne +                ; invisible
    brl _af_next
+
    sta.b D_PAL

    txa
    asl a
    sta.b D_I2                 ; 2*i for the 16-bit arrays
    tay

    ; --- visibility: the 16x24 metasprite against the camera window ---
    lda.w actor_px,y
    sta.b D_AX
    clc
    adc.w #16
    cmp.b D_CX
    bne +                   ; ax+16 <= cx
    brl _af_offscreen
+
    bcs +
    brl _af_offscreen
+
    lda.b D_AX
    cmp.b D_CXMAX
    bcc +                   ; ax >= cx+256
    brl _af_offscreen
+

    lda.w actor_py,y
    sta.b D_AY
    clc
    adc.w #16
    cmp.b D_CY
    bne +
    brl _af_offscreen
+
    bcs +
    brl _af_offscreen
+
    lda.b D_AY
    cmp.b D_CYMAX
    bcc +
    brl _af_offscreen
+

    ; --- screen coordinates -------------------------------------------
    lda.b D_AX
    sec
    sbc.l af_cx
    sta.b D_SX                 ; 16-bit: the 9th bit is used below
    and.w #$00FF
    sta.b D_X8

    lda.b D_AY
    sec
    sbc.l af_cy
    sec
    sbc.w #8                    ; SPRITE_Y_OVERLAP
    and.w #$00FF
    sta.b D_SY

    ; --- frame number: base + direction*3 + walk step -----------------
    lda.l actor_gfx,x
    and.w #$00FF
    cmp.w #$00FF
    bne _af_gfx_force
    lda.l actor_fbase,x         ; normal base (sprite_id * 12)
    and.w #$00FF
    bra _af_gfx_ok
_af_gfx_force:                     ; Change Graphic: gfx * 12
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
_af_gfx_ok:
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
    beq _af_frame_ok               ; no step in progress: idle pose
    lda.l actor_anim,x
    and.w #$00FF
    sta.b D_T
    and.w #$0001
    beq _af_frame_ok               ; even phase: idle
    lda.b D_T
    lsr a                       ; anim >> 1
    clc
    adc.w #1
    clc
    adc.b D_F
    and.w #$00FF
    sta.b D_F
_af_frame_ok:

    ; --- invariant OAM words: recomputed ONLY when the frame changes ---
    lda.l actor_lastf,x
    and.w #$00FF
    cmp.b D_F
    beq _af_oam                    ; cache still valid

    sep #$20
    lda.b D_F
    sta.l actor_lastf,x         ; 8-bit store: do not clobber the neighbour
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
    ; attr = (pal << 1) | (prio << 4), prio 3 if ACTOR_PRIO_ABOVE else 2
    lda.l actor_prio,x
    and.w #$00FF
    cmp.w #2                    ; ACTOR_PRIO_ABOVE
    bne _af_prio_normal
    lda.w #(3 << 4)
    bra _af_prio_ok
_af_prio_normal:
    lda.w #(2 << 4)             ; ACTOR_OBJ_PRIO
_af_prio_ok:
    sta.b D_T2
    lda.b D_PAL
    asl a
    ora.b D_T2
    sta.b D_ATTR

    lda.b D_I2                 ; LDY has no long mode: go through A
    tay
    jsr _af_oam_word                ; w1 from af_tile
    sta.w actor_w1,y
    lda.b D_TILE
    clc
    adc.w #32                   ; the row below
    sta.b D_TILE
    lda.b D_I2
    tay
    jsr _af_oam_word
    sta.w actor_w3,y

; ---- writing the two OAM entries -------------------------------------
_af_oam:
    txa                         ; ACTOR_OAM_TOP(i) = ((i<<1)+2)<<2 = 8i + 8
    asl a
    asl a
    asl a
    clc
    adc.w #8
    tay                         ; Y = byte offset into oamMemory

    lda.b D_SY
    xba                         ; sy in the high byte
    ora.b D_X8
    sta.w oamMemory,y           ; word 0: X | Y<<8

    phy
    lda.b D_I2
    tay
    lda.w actor_w1,y
    ply
    sta.w oamMemory + 2,y       ; word 1

    lda.b D_SY
    clc
    adc.w #16
    and.w #$00FF
    xba
    ora.b D_X8
    sta.w oamMemory + 4,y       ; word 2

    phy
    lda.b D_I2
    tay
    lda.w actor_w3,y
    ply
    sta.w oamMemory + 6,y       ; word 3

    ; --- 9th bit of X: table 2 is only touched on a CHANGE -------------
    lda.b D_SX
    and.w #$0100
    beq _af_x9_val
    lda.w #1
_af_x9_val:
    sta.b D_T                  ; new x9 (0 or 1)
    lda.l actor_x9,x
    and.w #$00FF
    cmp.b D_T
    beq _af_shown                 ; unchanged: leave table 2 alone

    ; mask: (id>>2)&3 == 0 ? 0x05 : 0x50. id = 8i+8, so id>>2 = 2i+2,
    ; which is zero modulo 4 when i is ODD.
    txa
    and.w #$0001
    beq _af_mask_even
    lda.w #$0005                ; i odd -> (id>>2)&3 == 0
    bra _af_mask_ok
_af_mask_even:
    lda.w #$0050
_af_mask_ok:
    sta.b D_MASK

    tya                         ; Y = OAM offset of the actor
    lsr a
    lsr a
    lsr a
    lsr a                       ; id >> 4
    clc
    adc.w #512
    tay                         ; byte of table 2

    sep #$20
    lda.b D_T
    sta.l actor_x9,x            ; 8-bit store
    beq _af_x9_clear
    lda.w oamMemory,y
    ora.b D_MASK
    bra _af_x9_write
_af_x9_clear:
    lda.b D_MASK
    eor #$FF
    sta.b D_MASKN
    lda.w oamMemory,y
    and.b D_MASKN
_af_x9_write:
    sta.w oamMemory,y
    rep #$20

_af_shown:
    sep #$20
    lda #1
    sta.l actor_shown,x
    rep #$20
    bra _af_next

; ---- off screen: the C side handles it, and only on the TRANSITION ---
_af_offscreen:
    lda.l actor_shown,x
    and.w #$00FF
    bne +                ; already hidden: nothing to do (the P3 gain)
    brl _af_next
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

_af_next:
    inx
    cpx.b D_N                  ; CPX has no long mode; af_n is in bank
    bcs +                 ; $7E, absolute-addressable (DB = $7E)
    brl _af_loop
+

_af_end:
    plp
    pld
    plb
    rtl

; OAM word from af_tile and af_attr:
;   (tile & 0xFF) | ((attr | (tile >> 8)) << 8)
; Y is preserved by the caller around the call.
_af_oam_word:
    lda.b D_TILE
    xba                         ; high byte of tile down low
    and.w #$00FF
    ora.b D_ATTR
    xba                         ; back up into the high byte
    and.w #$FF00
    sta.b D_T2
    lda.b D_TILE
    and.w #$00FF
    ora.b D_T2
    rts

.ENDS

; Work variables. In BANK 0 (SLOT 1) and not in $7E: the 65816's DIRECT
; PAGE addressing ALWAYS targets bank $00, whatever the bank register
; holds. A block placed in $7E and addressed through D lands in the PPU
; registers — the pixel regression is what caught it, in three wrong
; frames, before it could become one more ghost.
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
