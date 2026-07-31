.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_dbg_pow10_locals 0
.define __tccs_{WLA_FILENAME}_dbg_setnum_locals 6
.define __tccs_{WLA_FILENAME}_dbg_set_locals 0
.define __tccs_{WLA_FILENAME}_dbg_cells_locals 8
.define __tccs_{WLA_FILENAME}_dbg_lag_add_locals 2
.define __tccs_{WLA_FILENAME}_dbg_blit_locals 0
.define __tccs_{WLA_FILENAME}_dbg_blit_chunk_locals 2
.define __tccs_{WLA_FILENAME}_dbg_build_locals 2
.define __tccs_{WLA_FILENAME}_dbg_clear_locals 2
.define __debug_update_locals 8
.SECTION ".tccs_{WLA_FILENAME}_dbg_pow10text_0x0" SUPERFREE
tccs_{WLA_FILENAME}_dbg_pow10:
.ifgr __tccs_{WLA_FILENAME}_dbg_pow10_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_dbg_pow10_locals
tas
.endif
lda 3 + __tccs_{WLA_FILENAME}_dbg_pow10_locals + 1,s
sta.b tcc__r0
cmp #4
beq +
brl __local_0
+
lda.w #10000
sta.b tcc__r0
jmp.w __local_1
__local_0:
lda 3 + __tccs_{WLA_FILENAME}_dbg_pow10_locals + 1,s
sta.b tcc__r0
cmp #3
beq +
brl __local_2
+
lda.w #1000
sta.b tcc__r0
bra __local_3
__local_2:
lda 3 + __tccs_{WLA_FILENAME}_dbg_pow10_locals + 1,s
sta.b tcc__r0
cmp #2
beq +
brl __local_4
+
lda.w #100
sta.b tcc__r0
bra __local_5
__local_4:
lda 3 + __tccs_{WLA_FILENAME}_dbg_pow10_locals + 1,s
sta.b tcc__r0
cmp #1
beq +
brl __local_6
+
lda.w #10
sta.b tcc__r0
bra __local_7
__local_6:
lda.w #1
sta.b tcc__r0
__local_1:
__local_3:
__local_5:
__local_7:
__local_8:
.ifgr __tccs_{WLA_FILENAME}_dbg_pow10_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_dbg_pow10_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_dbg_setnumtext_0x1" SUPERFREE
tccs_{WLA_FILENAME}_dbg_setnum:
.ifgr __tccs_{WLA_FILENAME}_dbg_setnum_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_dbg_setnum_locals
tas
.endif
lda 11 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
sta.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
__local_12:
lda -2 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_9
+
lda -2 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
clc
adc.w #65535
sta -2 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
pha
jsr.l tccs_{WLA_FILENAME}_dbg_pow10
pla
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
__local_11:
lda 9 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_10
+
lda 9 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta 9 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
lda -6 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
jmp.w __local_11
__local_10:
lda 3 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
sta.b tcc__r0h
lda 7 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
clc
adc.w #48
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda 7 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta 7 + __tccs_{WLA_FILENAME}_dbg_setnum_locals + 1,s
jmp.w __local_12
__local_9:
.ifgr __tccs_{WLA_FILENAME}_dbg_setnum_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_dbg_setnum_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_dbg_settext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_dbg_set:
.ifgr __tccs_{WLA_FILENAME}_dbg_set_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_dbg_set_locals
tas
.endif
__local_14:
lda 9 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
sta.b tcc__r0
lda 11 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r1
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_13
+
lda 3 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
sta.b tcc__r0h
lda 7 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda 9 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
sta.b tcc__r1
lda 11 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
sta.b tcc__r1h
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
and.w #255
sta.b tcc__r2
sep #$20
sta.b [tcc__r0]
rep #$20
lda 7 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
inc a
sta.b tcc__r0
sta 7 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
lda 11 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
sta.b tcc__r0h
lda 9 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta 9 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
lda.b tcc__r0h
sta 11 + __tccs_{WLA_FILENAME}_dbg_set_locals + 1,s
jmp.w __local_14
__local_13:
.ifgr __tccs_{WLA_FILENAME}_dbg_set_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_dbg_set_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_dbg_cellstext_0x3" SUPERFREE
tccs_{WLA_FILENAME}_dbg_cells:
.ifgr __tccs_{WLA_FILENAME}_dbg_cells_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_dbg_cells_locals
tas
.endif
lda 7 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
__local_19:
lda 11 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_15
+
lda 3 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
sta.b tcc__r0h
lda 9 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta -4 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
lda -2 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
sta.b tcc__r0
lda 9 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
asl a
sta.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -4 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
sta.b tcc__r0
lda.b tcc__r1
sta -8 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
lda.b tcc__r1h
sta -6 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_16
+
lda -4 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
sec
sbc.w #31
ora.w #12288
sta.b tcc__r0
bra __local_17
__local_16:
lda.w #0
sta.b tcc__r0
__local_17:
__local_18:
lda -8 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
sta.b tcc__r1
lda -6 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
lda 9 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
inc a
sta 9 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
lda 11 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #65535
sta.b tcc__r0
sta 11 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
jmp.w __local_19
__local_15:
lda 7 + __tccs_{WLA_FILENAME}_dbg_cells_locals + 1,s
and.w #255
sta.b tcc__r0
sep #$20
lda #1
pha
lda.b tcc__r0
pha
rep #$20
jsr.l ui_mark
pla
.ifgr __tccs_{WLA_FILENAME}_dbg_cells_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_dbg_cells_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_dbg_lag_addtext_0x4" SUPERFREE
tccs_{WLA_FILENAME}_dbg_lag_add:
.ifgr __tccs_{WLA_FILENAME}_dbg_lag_add_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_dbg_lag_add_locals
tas
.endif
__local_25:
lda 3 + __tccs_{WLA_FILENAME}_dbg_lag_add_locals + 1,s
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_20
+
lda.w #16
sta -2 + __tccs_{WLA_FILENAME}_dbg_lag_add_locals + 1,s
lda 3 + __tccs_{WLA_FILENAME}_dbg_lag_add_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #65535
sta.b tcc__r0
sta 3 + __tccs_{WLA_FILENAME}_dbg_lag_add_locals + 1,s
__local_24:
lda -2 + __tccs_{WLA_FILENAME}_dbg_lag_add_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #12
tay
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_21
+
lda.w #:tccs_{WLA_FILENAME}_dbg_l0
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_dbg_l0 + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_dbg_lag_add_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
sec
sbc.w #57
bvc +
eor #$8000
+
bmi +
brl __local_22
+
lda.w #:tccs_{WLA_FILENAME}_dbg_l0
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_dbg_l0 + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_dbg_lag_add_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
sta.b tcc__r2
lda.b tcc__r1h
sta.b tcc__r2h
inc.b tcc__r1
sep #$20
lda.b tcc__r1
sta.b [tcc__r0]
rep #$20
bra __local_23
__local_22:
lda.w #:tccs_{WLA_FILENAME}_dbg_l0
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_dbg_l0 + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_dbg_lag_add_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #48
sep #$20
sta.b [tcc__r0]
rep #$20
lda -2 + __tccs_{WLA_FILENAME}_dbg_lag_add_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #65535
sta.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_dbg_lag_add_locals + 1,s
jmp.w __local_24
__local_21:
__local_23:
jmp.w __local_25
__local_20:
.ifgr __tccs_{WLA_FILENAME}_dbg_lag_add_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_dbg_lag_add_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_dbg_blittext_0x5" SUPERFREE
tccs_{WLA_FILENAME}_dbg_blit:
.ifgr __tccs_{WLA_FILENAME}_dbg_blit_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_dbg_blit_locals
tas
.endif
pea.w 32
pea.w 0
pea.w 0
pea.w :tccs_{WLA_FILENAME}_dbg_l0
pea.w tccs_{WLA_FILENAME}_dbg_l0 + 0
jsr.l tccs_{WLA_FILENAME}_dbg_cells
tsa
clc
adc #10
tas
pea.w 32
pea.w 0
pea.w 1
pea.w :tccs_{WLA_FILENAME}_dbg_l1
pea.w tccs_{WLA_FILENAME}_dbg_l1 + 0
jsr.l tccs_{WLA_FILENAME}_dbg_cells
tsa
clc
adc #10
tas
.ifgr __tccs_{WLA_FILENAME}_dbg_blit_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_dbg_blit_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_dbg_blit_chunktext_0x6" SUPERFREE
tccs_{WLA_FILENAME}_dbg_blit_chunk:
.ifgr __tccs_{WLA_FILENAME}_dbg_blit_chunk_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_dbg_blit_chunk_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_dbg_stage + 0
rep #$20
sta.b tcc__r0
lda.w #4
sec
sbc.b tcc__r0
sta.b tcc__r1
sta -2 + __tccs_{WLA_FILENAME}_dbg_blit_chunk_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #2
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_26
+
lda -2 + __tccs_{WLA_FILENAME}_dbg_blit_chunk_locals + 1,s
asl a
asl a
asl a
asl a
sta.b tcc__r0
pea.w 16
pei (tcc__r0)
pea.w 0
pea.w :tccs_{WLA_FILENAME}_dbg_l0
pea.w tccs_{WLA_FILENAME}_dbg_l0 + 0
jsr.l tccs_{WLA_FILENAME}_dbg_cells
tsa
clc
adc #10
tas
bra __local_27
__local_26:
lda -2 + __tccs_{WLA_FILENAME}_dbg_blit_chunk_locals + 1,s
dec a
dec a
asl a
asl a
asl a
asl a
sta.b tcc__r0
pea.w 16
pei (tcc__r0)
pea.w 1
pea.w :tccs_{WLA_FILENAME}_dbg_l1
pea.w tccs_{WLA_FILENAME}_dbg_l1 + 0
jsr.l tccs_{WLA_FILENAME}_dbg_cells
tsa
clc
adc #10
tas
__local_27:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_dbg_stage + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_dbg_stage + 0
rep #$20
.ifgr __tccs_{WLA_FILENAME}_dbg_blit_chunk_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_dbg_blit_chunk_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_dbg_buildtext_0x7" SUPERFREE
tccs_{WLA_FILENAME}_dbg_build:
.ifgr __tccs_{WLA_FILENAME}_dbg_build_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_dbg_build_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_dbg_build_locals + 1,s
__local_30:
lda -2 + __tccs_{WLA_FILENAME}_dbg_build_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #32
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_28
+
bra __local_29
__local_31:
lda -2 + __tccs_{WLA_FILENAME}_dbg_build_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_dbg_build_locals + 1,s
bra __local_30
__local_29:
lda.w #:tccs_{WLA_FILENAME}_dbg_l0
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_dbg_l0 + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_dbg_build_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #:tccs_{WLA_FILENAME}_dbg_l1
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_dbg_l1 + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_dbg_build_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
jmp.w __local_31
__local_28:
pea.w :tccs_{WLA_FILENAME}_L.{WLA_FILENAME}9
pea.w tccs_{WLA_FILENAME}_L.{WLA_FILENAME}9 + 0
pea.w 0
pea.w :tccs_{WLA_FILENAME}_dbg_l0
pea.w tccs_{WLA_FILENAME}_dbg_l0 + 0
jsr.l tccs_{WLA_FILENAME}_dbg_set
tsa
clc
adc #10
tas
pea.w 2
pea.w 60
pea.w 4
pea.w :tccs_{WLA_FILENAME}_dbg_l0
pea.w tccs_{WLA_FILENAME}_dbg_l0 + 0
jsr.l tccs_{WLA_FILENAME}_dbg_setnum
tsa
clc
adc #10
tas
pea.w :tccs_{WLA_FILENAME}_L.{WLA_FILENAME}10
pea.w tccs_{WLA_FILENAME}_L.{WLA_FILENAME}10 + 0
pea.w 8
pea.w :tccs_{WLA_FILENAME}_dbg_l0
pea.w tccs_{WLA_FILENAME}_dbg_l0 + 0
jsr.l tccs_{WLA_FILENAME}_dbg_set
tsa
clc
adc #10
tas
pea.w :dbg_banks_txt
pea.w dbg_banks_txt + 0
pea.w 0
pea.w :tccs_{WLA_FILENAME}_dbg_l1
pea.w tccs_{WLA_FILENAME}_dbg_l1 + 0
jsr.l tccs_{WLA_FILENAME}_dbg_set
tsa
clc
adc #10
tas
.ifgr __tccs_{WLA_FILENAME}_dbg_build_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_dbg_build_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_dbg_cleartext_0x8" SUPERFREE
tccs_{WLA_FILENAME}_dbg_clear:
.ifgr __tccs_{WLA_FILENAME}_dbg_clear_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_dbg_clear_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_dbg_clear_locals + 1,s
__local_34:
lda -2 + __tccs_{WLA_FILENAME}_dbg_clear_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #64
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_32
+
bra __local_33
__local_35:
lda -2 + __tccs_{WLA_FILENAME}_dbg_clear_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_dbg_clear_locals + 1,s
bra __local_34
__local_33:
lda -2 + __tccs_{WLA_FILENAME}_dbg_clear_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
bra __local_35
__local_32:
pea.w (2 * 256 + 0)
sep #$20
rep #$20
jsr.l ui_mark
pla
jsr.l overlay_refresh
.ifgr __tccs_{WLA_FILENAME}_dbg_clear_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_dbg_clear_locals
tas
.endif
rtl
.ENDS
.SECTION ".debug_updatetext_0x9" SUPERFREE
debug_update:
.ifgr __debug_update_locals 0
tsa
sec
sbc #__debug_update_locals
tas
.endif
lda.w #0
sep #$20
lda.l dbg_enabled + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_36
+
bra __local_37
__local_36:
jmp.w __local_38
__local_37:
lda.l pad_keys + 0
sta -2 + __debug_update_locals + 1,s
and.w #12304
sta.b tcc__r0
cmp #12304
beq +
brl __local_39
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_dbg_held + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_40
+
jmp.w __local_41
__local_40:
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_held + 0
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_dbg_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_42
+
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_on + 0
rep #$20
jsr.l tccs_{WLA_FILENAME}_dbg_clear
bra __local_43
__local_42:
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_on + 0
rep #$20
jsr.l tccs_{WLA_FILENAME}_dbg_build
jsr.l tccs_{WLA_FILENAME}_dbg_blit
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_lag_dirty + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_fps_dirty + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_started + 0
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_dbg_iters + 0
stz.b tcc__r0
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_dbg_win + 0
__local_43:
__local_41:
bra __local_44
__local_39:
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_held + 0
rep #$20
__local_44:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_dbg_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_45
+
bra __local_46
__local_45:
jmp.w __local_47
__local_46:
lda.l snes_vblank_count + 0
sta -4 + __debug_update_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_dbg_started + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_48
+
bra __local_49
__local_48:
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_started + 0
rep #$20
lda -4 + __debug_update_locals + 1,s
sta.l tccs_{WLA_FILENAME}_dbg_last_vbl + 0
lda -4 + __debug_update_locals + 1,s
sta.b tcc__r0
sta.l tccs_{WLA_FILENAME}_dbg_last_push + 0
__local_49:
lda -4 + __debug_update_locals + 1,s
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_dbg_last_vbl + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta -6 + __debug_update_locals + 1,s
lda -4 + __debug_update_locals + 1,s
sta.l tccs_{WLA_FILENAME}_dbg_last_vbl + 0
lda.l tccs_{WLA_FILENAME}_dbg_iters + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_dbg_iters + 0
lda.l tccs_{WLA_FILENAME}_dbg_win + 0
sta.b tcc__r0
lda -6 + __debug_update_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.l tccs_{WLA_FILENAME}_dbg_win + 0
lda -6 + __debug_update_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #1
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_50
+
lda -6 + __debug_update_locals + 1,s
sta.b tcc__r0
dec.b tcc__r0
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_dbg_lag_add
pla
lda.w #1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_lag_dirty + 0
rep #$20
__local_50:
lda.l tccs_{WLA_FILENAME}_dbg_win + 0
sta.b tcc__r0
ldx #1
sec
sbc.w #60
tay
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_51
+
lda.l tccs_{WLA_FILENAME}_dbg_iters + 0
sta -8 + __debug_update_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #60
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_52
+
lda.w #60
sta.b tcc__r0
sta -8 + __debug_update_locals + 1,s
__local_52:
pea.w 2
lda -6 + __debug_update_locals + 1,s
pha
pea.w 4
pea.w :tccs_{WLA_FILENAME}_dbg_l0
pea.w tccs_{WLA_FILENAME}_dbg_l0 + 0
jsr.l tccs_{WLA_FILENAME}_dbg_setnum
tsa
clc
adc #10
tas
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_fps_dirty + 0
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_dbg_iters + 0
stz.b tcc__r0
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_dbg_win + 0
__local_51:
pea.w (2 * 256 + 0)
sep #$20
rep #$20
jsr.l ui_dirty_overlap
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_53
+
lda.w #4
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_stage + 0
rep #$20
__local_53:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_dbg_stage + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_54
+
jsr.l tccs_{WLA_FILENAME}_dbg_blit_chunk
jmp.w __local_55
__local_54:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_dbg_lag_dirty + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
brl __local_56
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_dbg_fps_dirty + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
__local_56:
brl __local_57
+
bra __local_58
__local_57:
lda -6 + __debug_update_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #1
tay
beq ++
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
__local_58:
brl __local_59
+
lda -4 + __debug_update_locals + 1,s
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_dbg_last_push + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
ldx #1
sec
sbc.w #16
tay
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
__local_59:
brl __local_60
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_dbg_fps_dirty + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_61
+
pea.w 2
pea.w 4
pea.w 0
pea.w :tccs_{WLA_FILENAME}_dbg_l0
pea.w tccs_{WLA_FILENAME}_dbg_l0 + 0
jsr.l tccs_{WLA_FILENAME}_dbg_cells
tsa
clc
adc #10
tas
__local_61:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_dbg_lag_dirty + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_62
+
pea.w 5
pea.w 12
pea.w 0
pea.w :tccs_{WLA_FILENAME}_dbg_l0
pea.w tccs_{WLA_FILENAME}_dbg_l0 + 0
jsr.l tccs_{WLA_FILENAME}_dbg_cells
tsa
clc
adc #10
tas
__local_62:
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_fps_dirty + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_dbg_lag_dirty + 0
rep #$20
lda -4 + __debug_update_locals + 1,s
sta.b tcc__r0
sta.l tccs_{WLA_FILENAME}_dbg_last_push + 0
__local_60:
__local_55:
__local_38:
__local_47:
.ifgr __debug_update_locals 0
tsa
clc
adc #__debug_update_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_dbg_on dsb 1
tccs_{WLA_FILENAME}_dbg_held dsb 1
tccs_{WLA_FILENAME}_dbg_started dsb 2
tccs_{WLA_FILENAME}_dbg_last_vbl dsb 2
tccs_{WLA_FILENAME}_dbg_iters dsb 2
tccs_{WLA_FILENAME}_dbg_win dsb 2
tccs_{WLA_FILENAME}_dbg_lag_dirty dsb 1
tccs_{WLA_FILENAME}_dbg_fps_dirty dsb 1
tccs_{WLA_FILENAME}_dbg_last_push dsb 2
tccs_{WLA_FILENAME}_dbg_stage dsb 1
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $0
.db $0
.db $0,$0
.db $0,$0
.db $0,$0
.db $0,$0
.db $0
.db $0
.db $0,$0
.db $0
.ENDS
.SECTION ".rodata" SUPERFREE
tccs_{WLA_FILENAME}_L.{WLA_FILENAME}9: .db $46,$50,$53,$20,$0
tccs_{WLA_FILENAME}_L.{WLA_FILENAME}10: .db $4c,$41,$47,$20,$30,$30,$30,$30,$30,$0
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
tccs_{WLA_FILENAME}_dbg_l0 dsb 32
tccs_{WLA_FILENAME}_dbg_l1 dsb 32
.ENDS
