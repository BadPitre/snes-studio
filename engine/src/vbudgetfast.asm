; vbudgetfast.asm — reading the vertical scan counter.
;
; WHY ASSEMBLY FOR FOUR REGISTER ACCESSES
; The C version of this read — four 8-bit reads, a shift and an or —
; costs ~2 SCREEN LINES, measured with the counter itself. On a 30-line
; VBlank window that is 7 % spent finding out where we are. The first
; version of the arbiter placed two of them per frame and came out WORSE
; than no arbiter at all: 34 lines of peak against 29, and five frames
; in 128 overrunning where there had been none. The culprit is tcc-816's
; codegen — a sep/rep around every 8-bit operation, and a full function
; call for this.
;
; Without a counter read the arbiter can only work from a CONSTANT
; window and declared costs, which makes it blind to anything
; undeclared. Measured: against six unaccounted transfers injected into
; the block, the constant-budget version overran exactly as often as no
; arbiter (11 frames in 128). A counter read is the only real guard
; rail; it had to be made free, not removed.
;
; The result lands in vbl_v (defined on the C side) rather than being
; returned in A: that avoids depending on tcc-816's return convention,
; and it is the same contract as actorsfast.asm.

.include "hdr.asm"
.accu 16
.index 16
.16bit

.SECTION "vbudgetfast" SUPERFREE

vbl_probe:
    php
    sep #$20
.accu 8
    lda.l $002137 ; latch H and V
    lda.l $00213F ; reset the high/low toggle
    lda.l $00213D ; OPVCT low byte
    sta.l vbl_v
    lda.l $00213D ; OPVCT high byte — only bit 0 matters (261 max)
    and #$01
    sta.l vbl_v + 1
    plp
.accu 16
    rtl

.ENDS
