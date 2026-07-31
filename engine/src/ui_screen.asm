.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __ui_screen_init_locals 2
.define __ui_mark_locals 1
.define __ui_dirty_overlap_locals 0
.define __ui_screen_vblank_locals 2
.SECTION ".ui_screen_inittext_0x0" SUPERFREE
ui_screen_init:
.ifgr __ui_screen_init_locals 0
tsa
sec
sbc #__ui_screen_init_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __ui_screen_init_locals + 1,s
__local_2:
lda -2 + __ui_screen_init_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #896
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_0
+
bra __local_1
__local_3:
lda -2 + __ui_screen_init_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __ui_screen_init_locals + 1,s
bra __local_2
__local_1:
lda -2 + __ui_screen_init_locals + 1,s
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
bra __local_3
__local_0:
lda.w #255
sep #$20
sta.w tccs_{WLA_FILENAME}_ui_lo + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_ui_hi + 0
rep #$20
pea.w 1792
pea.w 6144
pea.w :ui_map
pea.w ui_map + 0
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
pea.w 256
pea.w 7040
pea.w :ui_map
pea.w ui_map + 0
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
.ifgr __ui_screen_init_locals 0
tsa
clc
adc #__ui_screen_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".ui_marktext_0x1" SUPERFREE
ui_mark:
.ifgr __ui_mark_locals 0
tsa
sec
sbc #__ui_mark_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __ui_mark_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 4 + __ui_mark_locals + 1,s
rep #$20
clc
adc.b tcc__r0
dec a
and.w #255
sep #$20
sta -1 + __ui_mark_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_lo + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_hi + 0
rep #$20
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq ++
bvc +
eor #$8000
+
bpl +++
++
dex
+++
stx.b tcc__r5
txa
bne +
brl __local_4
+
lda.w #0
sep #$20
lda 3 + __ui_mark_locals + 1,s
sta.w tccs_{WLA_FILENAME}_ui_lo + 0
rep #$20
lda.w #0
sep #$20
lda -1 + __ui_mark_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_ui_hi + 0
rep #$20
jmp.w __local_5
__local_4:
lda.w #0
sep #$20
lda 3 + __ui_mark_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_lo + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_6
+
lda.w #0
sep #$20
lda 3 + __ui_mark_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_ui_lo + 0
rep #$20
__local_6:
lda.w #0
sep #$20
lda -1 + __ui_mark_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_hi + 0
rep #$20
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq ++
bvc +
eor #$8000
+
bpl +++
++
dex
+++
stx.b tcc__r5
txa
bne +
brl __local_7
+
lda.w #0
sep #$20
lda -1 + __ui_mark_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_ui_hi + 0
rep #$20
__local_7:
__local_5:
.ifgr __ui_mark_locals 0
tsa
clc
adc #__ui_mark_locals
tas
.endif
rtl
.ENDS
.SECTION ".ui_dirty_overlaptext_0x2" SUPERFREE
ui_dirty_overlap:
.ifgr __ui_dirty_overlap_locals 0
tsa
sec
sbc #__ui_dirty_overlap_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_lo + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_hi + 0
rep #$20
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq ++
bvc +
eor #$8000
+
bpl +++
++
dex
+++
stx.b tcc__r5
txa
bne +
brl __local_8
+
lda.w #0
sta.b tcc__r0
jmp.w __local_9
__local_8:
lda.w #0
sep #$20
lda 3 + __ui_dirty_overlap_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 4 + __ui_dirty_overlap_locals + 1,s
rep #$20
clc
adc.b tcc__r0
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_lo + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_10
+
lda.w #0
sta.b tcc__r0
jmp.w __local_11
__local_10:
lda.w #0
sep #$20
lda 3 + __ui_dirty_overlap_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_hi + 0
rep #$20
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq ++
bvc +
eor #$8000
+
bpl +++
++
dex
+++
stx.b tcc__r5
txa
bne +
brl __local_12
+
lda.w #0
sta.b tcc__r0
bra __local_13
__local_12:
lda.w #1
sta.b tcc__r0
__local_9:
__local_11:
__local_13:
__local_14:
.ifgr __ui_dirty_overlap_locals 0
tsa
clc
adc #__ui_dirty_overlap_locals
tas
.endif
rtl
.ENDS
.SECTION ".ui_screen_vblanktext_0x3" SUPERFREE
ui_screen_vblank:
.ifgr __ui_screen_vblank_locals 0
tsa
sec
sbc #__ui_screen_vblank_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_lo + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_hi + 0
rep #$20
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq ++
bvc +
eor #$8000
+
bpl +++
++
dex
+++
stx.b tcc__r5
txa
bne +
brl __local_15
+
jmp.w __local_16
__local_15:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_lo + 0
rep #$20
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta -2 + __ui_screen_vblank_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -2 + __ui_screen_vblank_locals + 1,s
clc
adc.w #6144
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_hi + 0
rep #$20
sta.b tcc__r2
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_ui_lo + 0
rep #$20
sta.b tcc__r3
sec
lda.b tcc__r2
sbc.b tcc__r3
inc a
sta.b tcc__r2
ldy.w #6
-
asl a
dey
bne -
+
pha
pei (tcc__r0)
pei (tcc__r1h)
pei (tcc__r1)
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
lda.w #255
sep #$20
sta.w tccs_{WLA_FILENAME}_ui_lo + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_ui_hi + 0
rep #$20
__local_16:
.ifgr __ui_screen_vblank_locals 0
tsa
clc
adc #__ui_screen_vblank_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.ENDS
.SECTION ".rodata" SUPERFREE
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
ui_map dsb 1792
tccs_{WLA_FILENAME}_ui_lo dsb 1
tccs_{WLA_FILENAME}_ui_hi dsb 1
.ENDS
