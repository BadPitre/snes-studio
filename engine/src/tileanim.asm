.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tileanim_init_locals 1
.define __tileanim_update_locals 5
.define __tileanim_vblank_locals 9
.SECTION ".tileanim_inittext_0x0" SUPERFREE
tileanim_init:
.ifgr __tileanim_init_locals 0
tsa
sec
sbc #__tileanim_init_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tileanim_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ta_first
sta.b tcc__r1h
lda.w #ta_first + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_ta_base + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __tileanim_init_locals + 1,s
rep #$20
inc a
sta.b tcc__r0
lda.w #:ta_first
sta.b tcc__r1h
lda.w #ta_first + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ta_base + 0
rep #$20
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sep #$20
sta.l tccs_{WLA_FILENAME}_ta_n + 0
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ta_n + 0
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #8
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
brl __local_0
+
lda.w #8
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_ta_n + 0
rep #$20
__local_0:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tileanim_init_locals + 1,s
rep #$20
__local_3:
lda.w #0
sep #$20
lda -1 + __tileanim_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ta_n + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_1
+
bra __local_2
__local_4:
lda.w #0
sep #$20
lda -1 + __tileanim_init_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tileanim_init_locals + 1,s
rep #$20
jmp.w __local_3
__local_2:
lda.w #0
sep #$20
lda -1 + __tileanim_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ta_cnt
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ta_cnt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ta_base + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __tileanim_init_locals + 1,s
rep #$20
sta.b tcc__r2
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #:ta_speed
sta.b tcc__r2h
lda.w #ta_speed + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tileanim_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ta_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ta_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_4
__local_1:
lda.w #255
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_ta_pend + 0
rep #$20
.ifgr __tileanim_init_locals 0
tsa
clc
adc #__tileanim_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".tileanim_updatetext_0x1" SUPERFREE
tileanim_update:
.ifgr __tileanim_update_locals 0
tsa
sec
sbc #__tileanim_update_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tileanim_update_locals + 1,s
rep #$20
__local_7:
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ta_n + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_5
+
bra __local_6
__local_9:
__local_11:
__local_21:
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tileanim_update_locals + 1,s
rep #$20
jmp.w __local_7
__local_6:
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ta_cnt
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ta_cnt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_8
+
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ta_cnt
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ta_cnt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sta.b tcc__r2
lda.b tcc__r0h
sta.b tcc__r2h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
jmp.w __local_9
__local_8:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ta_pend + 0
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #255
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_10
+
jmp.w __local_11
__local_10:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ta_base + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
and.w #255
sep #$20
sta -2 + __tileanim_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -2 + __tileanim_update_locals + 1,s
rep #$20
inc a
sta.b tcc__r0
lda.w #:ta_ffirst
sta.b tcc__r1h
lda.w #ta_ffirst + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ta_ffirst
sta.b tcc__r2h
lda.w #ta_ffirst + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sep #$20
sta -3 + __tileanim_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -2 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ta_mode
sta.b tcc__r1h
lda.w #ta_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_12
+
lda.w #0
sep #$20
lda -3 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #2
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
__local_12:
brl __local_13
+
lda #1
bra +
__local_13:
lda #0
+
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_14
+
lda.w #0
sep #$20
lda -3 + __tileanim_update_locals + 1,s
rep #$20
asl a
dec a
dec a
and.w #255
sta.b tcc__r0
bra __local_15
__local_14:
lda.w #0
sep #$20
lda -3 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
__local_15:
__local_16:
sep #$20
lda.b tcc__r0
sta -4 + __tileanim_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ta_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ta_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sta.b tcc__r2
lda.b tcc__r0h
sta.b tcc__r2h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ta_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ta_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
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
brl __local_17
+
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ta_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ta_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_17:
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ta_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ta_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_18
+
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ta_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ta_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r1
jmp.w __local_19
__local_18:
lda.w #0
sep #$20
lda -3 + __tileanim_update_locals + 1,s
rep #$20
asl a
dec a
dec a
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_ta_pos
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_ta_pos + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sta.b tcc__r0
bra __local_20
__local_19:
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
__local_20:
sep #$20
lda.b tcc__r0
sta -5 + __tileanim_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
sta.l tccs_{WLA_FILENAME}_ta_pend + 0
rep #$20
lda.w #0
sep #$20
lda -2 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ta_ffirst
sta.b tcc__r1h
lda.w #ta_ffirst + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -5 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
and.w #255
sep #$20
sta.l tccs_{WLA_FILENAME}_ta_pfrm + 0
rep #$20
lda.w #0
sep #$20
lda -1 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ta_cnt
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ta_cnt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tileanim_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ta_speed
sta.b tcc__r2h
lda.w #ta_speed + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_21
__local_5:
.ifgr __tileanim_update_locals 0
tsa
clc
adc #__tileanim_update_locals
tas
.endif
rtl
.ENDS
.SECTION ".tileanim_vblanktext_0x2" SUPERFREE
tileanim_vblank:
.ifgr __tileanim_vblank_locals 0
tsa
sec
sbc #__tileanim_vblank_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ta_pend + 0
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_22
+
jmp.w __local_23
__local_22:
lda.w #0
sep #$20
lda.l scene_ctx + 30
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:gfx_chars
sta.b tcc__r1h
lda.w #gfx_chars + 0
clc
adc.b tcc__r0
sta.b tcc__r1
ldy #0
lda.b [tcc__r1],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r1],y
sta.b tcc__r0h
lda.b tcc__r0
sta -4 + __tileanim_vblank_locals + 1,s
lda.b tcc__r0h
sta -2 + __tileanim_vblank_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ta_base + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ta_pend + 0
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
asl a
asl a
sta -6 + __tileanim_vblank_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ta_pfrm + 0
rep #$20
asl a
asl a
sta -8 + __tileanim_vblank_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -9 + __tileanim_vblank_locals + 1,s
rep #$20
__local_26:
lda.w #0
sep #$20
lda -9 + __tileanim_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #4
bvc +
eor #$8000
+
bmi +
brl __local_24
+
bra __local_25
__local_27:
lda.w #0
sep #$20
lda -9 + __tileanim_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -9 + __tileanim_vblank_locals + 1,s
rep #$20
bra __local_26
__local_25:
lda.w #0
sep #$20
lda -9 + __tileanim_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
lda -8 + __tileanim_vblank_locals + 1,s
clc
adc.b tcc__r0
asl a
sta.b tcc__r1
lda.w #:ta_src
sta.b tcc__r0h
lda.w #ta_src + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r1h
sta.b tcc__r2h
lda.b tcc__r1
sta.b tcc__r2
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r2
lda.b tcc__r1
ldy.w #11
-
lsr a
dey
bne -
+
sta.b tcc__r1
lda.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
ora.b tcc__r1
sta.b tcc__r1
lda -4 + __tileanim_vblank_locals + 1,s
sta.b tcc__r0
lda -2 + __tileanim_vblank_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r2
sta.b tcc__r0
lda.w #65532
adc.b tcc__r1
lda.w #0
sep #$20
lda -9 + __tileanim_vblank_locals + 1,s
rep #$20
sta.b tcc__r1
lda -6 + __tileanim_vblank_locals + 1,s
clc
adc.b tcc__r1
asl a
sta.b tcc__r3
lda.w #:ta_dest
sta.b tcc__r1h
lda.w #ta_dest + 0
clc
adc.b tcc__r3
sta.b tcc__r1
lda.b [tcc__r1]
asl a
asl a
asl a
asl a
clc
adc.w #8192
sta.b tcc__r3
pea.w 32
pei (tcc__r3)
pei (tcc__r0h)
pei (tcc__r0)
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
jmp.w __local_27
__local_24:
lda.w #255
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_ta_pend + 0
rep #$20
__local_23:
.ifgr __tileanim_vblank_locals 0
tsa
clc
adc #__tileanim_vblank_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_ta_n dsb 1
tccs_{WLA_FILENAME}_ta_base dsb 1
tccs_{WLA_FILENAME}_ta_pend dsb 1
tccs_{WLA_FILENAME}_ta_pfrm dsb 1
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $0
.db $0
.db $ff
.db $0
.ENDS
.SECTION ".rodata" SUPERFREE
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
tccs_{WLA_FILENAME}_ta_cnt dsb 8
tccs_{WLA_FILENAME}_ta_pos dsb 8
.ENDS
