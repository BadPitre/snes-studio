; vramfast.asm — draining the VRAM transfer queue, and building it.
;
; WHY ASSEMBLY FOR A HANDFUL OF REGISTER WRITES
; PVSnesLib's dmaCopyVram7 is about thirty instructions. It is not the
; routine that costs, it is the CALL: tcc-816 pushes its five arguments
; one at a time from its software stack, and the whole thing comes to
; ~1.5 SCREEN LINES per transfer. A map column needs eight of them —
; 22 lines out of the 30 the window lasts, for 512 bytes worth 3.
;
; Here the batch-invariant registers (DMA mode, the $2118 gate, the
; $2115 increment) are written ONCE, leaving four writes per transfer:
; source, size, VRAM address, go.
;
; Measured, same profiler, a 48x40 map streaming on both axes, 497
; frames after warm-up: the VBlank block peak falls from 32 lines to 22,
; and the 8 frames in 497 that overran no longer exist. Full figures in
; docs/PERF_MEASUREMENTS.md.
;
; CONTRACT
;   in:  vj_first, vj_n, vj_vmain, vj_ctrl and the four arrays
;        vj_src / vj_bank / vj_dst / vj_len, all defined in C.
;   out: nothing. No C register is modified.
;
; The 65816 conventions this file obeys are in docs/ENGINE_CONSTRAINTS.md
; §2. The three that shape the code below: `long,Y` does not exist, so
; every array is indexed by X (which is why vj_bank is an array of WORDS
; and not bytes); CPX has no long mode, so the loop counter lives in Y
; and exits on `dey / bne`; and sep #$20 only touches the M bit, so the
; index stays 16-bit throughout and phx/plx stay consistent.

.include "hdr.asm"
.accu 16
.index 16
.16bit

.SECTION "vramfast" SUPERFREE

; void vj_set(u16 i, const u8 *src, u16 dst, u16 len)
;
; This one is in assembly for a different reason: a DMA needs its
; source BANK, and C cannot give it. tcc-816 does pass a FOUR-byte
; pointer — bank included — when you hand one to a function, but
; `(u32)p` keeps only the low 16 bits AND SIGN EXTENDS. See
; docs/ENGINE_CONSTRAINTS.md §1.3. Here we read the four bytes where
; the caller left them, exactly as PVSnesLib's dmaCopyVram does.
;
; Stack after php + phx (the index is already 16-bit):
;   1-2  saved X      3  saved P      4-6  return address
;   7-8  i            9-12 src (low word, then high word = bank)
;   13-14 dst         15-16 len

vj_set:
    php
    rep #$30
.accu 16
.index 16
    phx
    lda 7,s
    asl a               ; BYTE index into arrays of words
    tax
    lda 9,s             ; source, low 16 bits
    sta.l vj_src,x
    lda 11,s            ; high word of the pointer: the bank is its low byte
    sta.l vj_bank,x
    lda 13,s            ; VRAM address, in words
    sta.l vj_dst,x
    lda 15,s            ; size in bytes
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
    and #$00FF          ; never more than VJ_MAX transfers
    beq _vb_end
    tay                 ; Y = loop counter
    lda.l vj_first
    asl a               ; BYTE index into arrays of words
    tax

    sep #$20
.accu 8
    lda.l vj_vmain
    sta.l $002115       ; VRAM address increment
    lda.l vj_ctrl
    sta.l $004300       ; transfer mode
    lda.l vj_ctrl + 1
    sta.l $004301       ; B-bus gate ($2118)

_vb_loop:
    rep #$20
.accu 16
    lda.l vj_dst,x
    sta.l $002116       ; VRAM address (in words)
    lda.l vj_src,x
    sta.l $004302       ; source, low 16 bits
    lda.l vj_len,x
    sta.l $004305       ; size in bytes
    sep #$20
.accu 8
    lda.l vj_bank,x     ; low byte of the word = bank
    sta.l $004304
    lda #$01
    sta.l $00420B       ; go (channel 0)
    rep #$20
.accu 16
    inx
    inx
    dey
    bne _vb_loop

_vb_end:
    rep #$30
.accu 16
.index 16
    ply
    plx
    plp
    rtl


; ---------------------------------------------------------------------
; void m7_arm(u16 chan, u16 dmap_bbad, const u8 *tab)
;
; Arms ONE HDMA channel from a far pointer. Here for the same reason as
; vj_set above: the source BANK is needed and C cannot give it — tcc-816
; passes a four-byte pointer, but `(u32)p` keeps the low 16 bits and sign
; extends (docs/ENGINE_CONSTRAINTS.md §1.3).
;
; Which is what lets the Mode 7 ROTATION tables stay in ROM and be read
; there by the HDMA: 14 KB per map that never touch WRAM and are never
; copied. dmap_bbad packs both bytes ($4300 and $4301 are adjacent), so
; one 16-bit store sets the mode and the destination register.
;
; Stack after php + phx:
;   1-2 saved X   3 saved P   4-6 return address
;   7-8 chan      9-10 dmap_bbad    11-14 tab (low word, then bank word)

m7_arm:
    php
    phx
    rep #$30
.accu 16
.index 16
    lda 7,s
    asl a
    asl a
    asl a
    asl a               ; chan * 16 = offset of its $43xx block
    tax
    lda 9,s
    sta.l $004300,x     ; DMAP (low byte) + BBAD (high byte)
    lda 11,s
    sta.l $004302,x     ; A1T, low 16 bits
    lda 13,s            ; high word of the pointer: bank in its low byte
    sep #$20
.accu 8
    sta.l $004304,x     ; A1B
    rep #$30
.accu 16
    plx
    plp
    rtl

.ENDS
