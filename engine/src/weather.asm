.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_w_lcg_locals 0
.define __weather_load_locals 0
.define __weather_set_locals 4
.define __weather_draw_locals 28
.SECTION ".tccs_{WLA_FILENAME}_w_lcgtext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_w_lcg:
.ifgr __tccs_{WLA_FILENAME}_w_lcg_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_w_lcg_locals
tas
.endif
lda.l tccs_{WLA_FILENAME}_w_seed + 0
sta.b tcc__r0
lda.w #25173
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
clc
adc.w #13849
sta.l tccs_{WLA_FILENAME}_w_seed + 0
lda.l tccs_{WLA_FILENAME}_w_seed + 0
sta.b tcc__r0
__local_0:
.ifgr __tccs_{WLA_FILENAME}_w_lcg_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_w_lcg_locals
tas
.endif
rtl
.ENDS
.SECTION ".weather_loadtext_0x1" SUPERFREE
weather_load:
.ifgr __weather_load_locals 0
tsa
sec
sbc #__weather_load_locals
tas
.endif
pea.w 64
pea.w 24128
pea.w :wea_rain
pea.w wea_rain + 0
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
pea.w 64
pea.w 24384
pea.w :wea_rain
pea.w wea_rain + 64
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
pea.w 64
pea.w 24160
pea.w :wea_snow
pea.w wea_snow + 0
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
pea.w 64
pea.w 24416
pea.w :wea_snow
pea.w wea_snow + 64
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
pea.w 8
pea.w 240
pea.w :wea_pal
pea.w wea_pal + 0
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
.ifgr __weather_load_locals 0
tsa
clc
adc #__weather_load_locals
tas
.endif
rtl
.ENDS
.SECTION ".weather_settext_0x2" SUPERFREE
weather_set:
.ifgr __weather_set_locals 0
tsa
sec
sbc #__weather_set_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __weather_set_locals + 1,s
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
brl __local_1
+
bra __local_2
__local_1:
lda.w #0
sep #$20
lda 3 + __weather_set_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_3
__local_2:
lda.w #0
sta.b tcc__r0
__local_3:
sep #$20
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_w_type + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __weather_set_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_4
+
lda.w #2
sta.b tcc__r0
sep #$20
sta 4 + __weather_set_locals + 1,s
rep #$20
__local_4:
lda.w #0
sep #$20
lda 4 + __weather_set_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #3
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
brl __local_5
+
lda.w #3
sta.b tcc__r0
sep #$20
sta 4 + __weather_set_locals + 1,s
rep #$20
__local_5:
lda.w #0
sep #$20
lda 4 + __weather_set_locals + 1,s
rep #$20
asl a
asl a
asl a
sep #$20
sta.l tccs_{WLA_FILENAME}_w_count + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __weather_set_locals + 1,s
rep #$20
__local_8:
lda.w #0
sep #$20
lda -1 + __weather_set_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #24
bvc +
eor #$8000
+
bmi +
brl __local_6
+
bra __local_7
__local_9:
lda.w #0
sep #$20
lda -1 + __weather_set_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __weather_set_locals + 1,s
rep #$20
bra __local_8
__local_7:
jsr.l tccs_{WLA_FILENAME}_w_lcg
lda.b tcc__r0
sta -4 + __weather_set_locals + 1,s
lda.w #0
sep #$20
lda -1 + __weather_set_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_wx
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_wx + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -4 + __weather_set_locals + 1,s
and.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __weather_set_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_wy
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_wy + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -4 + __weather_set_locals + 1,s
xba
and #$00ff
sta.b tcc__r0
tax
lda.w #224
jsr.l tcc__udiv
txa
and.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __weather_set_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_wv
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_wv + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -4 + __weather_set_locals + 1,s
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_9
__local_6:
.ifgr __weather_set_locals 0
tsa
clc
adc #__weather_set_locals
tas
.endif
rtl
.ENDS
.SECTION ".weather_drawtext_0x3" SUPERFREE
weather_draw:
.ifgr __weather_draw_locals 0
tsa
sec
sbc #__weather_draw_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_type + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_10
+
jmp.w __local_11
__local_10:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __weather_draw_locals + 1,s
rep #$20
__local_14:
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_shown + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_12
+
bra __local_13
__local_15:
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __weather_draw_locals + 1,s
rep #$20
jmp.w __local_14
__local_13:
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
clc
adc.w #100
asl a
asl a
sta.b tcc__r0
sep #$20
lda #1
pha
rep #$20
pei (tcc__r0)
jsr.l oamSetVisible
tsa
clc
adc #3
tas
jmp.w __local_15
__local_12:
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_w_shown + 0
rep #$20
jmp.w __local_16
__local_11:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_frm + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_w_frm + 0
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_type + 0
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_17
+
bra __local_18
__local_17:
lda.w #230
sta.b tcc__r0
bra __local_19
__local_18:
lda.w #228
sta.b tcc__r0
__local_19:
sep #$20
lda.b tcc__r0
sta -5 + __weather_draw_locals + 1,s
rep #$20
lda.w #63
sta.b tcc__r0
sep #$20
sta -6 + __weather_draw_locals + 1,s
rep #$20
lda.w #:oamMemory
sta.b tcc__r0h
lda.w #oamMemory + 400
sta.b tcc__r0
sta -12 + __weather_draw_locals + 1,s
lda.b tcc__r0h
sta -10 + __weather_draw_locals + 1,s
lda.w #:tccs_{WLA_FILENAME}_wx
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_wx + 0
sta.b tcc__r0
sta -16 + __weather_draw_locals + 1,s
lda.b tcc__r0h
sta -14 + __weather_draw_locals + 1,s
lda.w #:tccs_{WLA_FILENAME}_wy
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_wy + 0
sta.b tcc__r0
sta -20 + __weather_draw_locals + 1,s
lda.b tcc__r0h
sta -18 + __weather_draw_locals + 1,s
lda.w #:tccs_{WLA_FILENAME}_wv
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_wv + 0
sta.b tcc__r0
sta -24 + __weather_draw_locals + 1,s
lda.b tcc__r0h
sta -22 + __weather_draw_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_type + 0
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_20
+
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __weather_draw_locals + 1,s
rep #$20
__local_23:
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_count + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_21
+
bra __local_22
__local_29:
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __weather_draw_locals + 1,s
rep #$20
jmp.w __local_23
__local_22:
lda -22 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda -24 + __weather_draw_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -24 + __weather_draw_locals + 1,s
lda.b tcc__r0h
sta -22 + __weather_draw_locals + 1,s
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -4 + __weather_draw_locals + 1,s
rep #$20
lda -16 + __weather_draw_locals + 1,s
sta.b tcc__r0
lda -14 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
dec.b tcc__r1
dec.b tcc__r1
sep #$20
lda.b tcc__r1
sta -2 + __weather_draw_locals + 1,s
rep #$20
lda -20 + __weather_draw_locals + 1,s
sta.b tcc__r0
lda -18 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda -4 + __weather_draw_locals + 1,s
rep #$20
and.w #1
sta.b tcc__r1
lda.b tcc__r0
sta -28 + __weather_draw_locals + 1,s
lda.b tcc__r0h
sta -26 + __weather_draw_locals + 1,s
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_24
+
bra __local_25
__local_24:
lda.w #4
sta.b tcc__r0
bra __local_26
__local_25:
lda.w #5
sta.b tcc__r0
__local_26:
lda -28 + __weather_draw_locals + 1,s
sta.b tcc__r10
lda -26 + __weather_draw_locals + 1,s
sta.b tcc__r10h
lda.w #0
sep #$20
lda.b [tcc__r10]
rep #$20
clc
adc.b tcc__r0
sta.b tcc__r1
sep #$20
sta -3 + __weather_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #224
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
brl __local_27
+
lda.w #0
sep #$20
sta -3 + __weather_draw_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_w_lcg
lda.b tcc__r0
and.w #255
sta.b tcc__r0
sep #$20
sta -2 + __weather_draw_locals + 1,s
rep #$20
__local_27:
lda -14 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda -16 + __weather_draw_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -16 + __weather_draw_locals + 1,s
lda.b tcc__r0h
sta -14 + __weather_draw_locals + 1,s
lda.w #0
sep #$20
lda -2 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
lda -18 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda -20 + __weather_draw_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -20 + __weather_draw_locals + 1,s
lda.b tcc__r0h
sta -18 + __weather_draw_locals + 1,s
lda.w #0
sep #$20
lda -3 + __weather_draw_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda -12 + __weather_draw_locals + 1,s
sta.b tcc__r0
lda -10 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda -2 + __weather_draw_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -10 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda -12 + __weather_draw_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __weather_draw_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -10 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda -12 + __weather_draw_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -5 + __weather_draw_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -12 + __weather_draw_locals + 1,s
sta.b tcc__r0
lda -10 + __weather_draw_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sep #$20
lda -6 + __weather_draw_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -12 + __weather_draw_locals + 1,s
sta.b tcc__r0
lda -10 + __weather_draw_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta -12 + __weather_draw_locals + 1,s
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_shown + 0
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
brl __local_28
+
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
clc
adc.w #100
asl a
asl a
sta.b tcc__r0
pea.w (0 * 256 + 0)
sep #$20
rep #$20
pei (tcc__r0)
jsr.l oamSetEx
tsa
clc
adc #4
tas
__local_28:
jmp.w __local_29
__local_21:
jmp.w __local_30
__local_20:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __weather_draw_locals + 1,s
rep #$20
__local_33:
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_count + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_31
+
bra __local_32
__local_41:
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __weather_draw_locals + 1,s
rep #$20
jmp.w __local_33
__local_32:
lda -22 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda -24 + __weather_draw_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -24 + __weather_draw_locals + 1,s
lda.b tcc__r0h
sta -22 + __weather_draw_locals + 1,s
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -4 + __weather_draw_locals + 1,s
rep #$20
lda -16 + __weather_draw_locals + 1,s
sta.b tcc__r0
lda -14 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
sta -2 + __weather_draw_locals + 1,s
rep #$20
lda -20 + __weather_draw_locals + 1,s
sta.b tcc__r0
lda -18 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
sta -3 + __weather_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_frm + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
eor.b tcc__r1
and.w #1
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_34
+
lda.w #0
sep #$20
lda -3 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -3 + __weather_draw_locals + 1,s
rep #$20
__local_34:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_frm + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
and.w #255
and.w #15
sta.b tcc__r0
cmp #0
beq +
brl __local_35
+
lda.w #0
sep #$20
lda -4 + __weather_draw_locals + 1,s
rep #$20
and.w #2
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_36
+
bra __local_37
__local_36:
lda.w #255
sta.b tcc__r0
bra __local_38
__local_37:
lda.w #1
sta.b tcc__r0
__local_38:
lda.w #0
sep #$20
lda -2 + __weather_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
sta.b tcc__r1
sep #$20
sta -2 + __weather_draw_locals + 1,s
rep #$20
__local_35:
lda.w #0
sep #$20
lda -3 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #224
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
brl __local_39
+
lda.w #0
sep #$20
sta -3 + __weather_draw_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_w_lcg
lda.b tcc__r0
and.w #255
sta.b tcc__r0
sep #$20
sta -2 + __weather_draw_locals + 1,s
rep #$20
__local_39:
lda -14 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda -16 + __weather_draw_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -16 + __weather_draw_locals + 1,s
lda.b tcc__r0h
sta -14 + __weather_draw_locals + 1,s
lda.w #0
sep #$20
lda -2 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
lda -18 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda -20 + __weather_draw_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -20 + __weather_draw_locals + 1,s
lda.b tcc__r0h
sta -18 + __weather_draw_locals + 1,s
lda.w #0
sep #$20
lda -3 + __weather_draw_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda -12 + __weather_draw_locals + 1,s
sta.b tcc__r0
lda -10 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda -2 + __weather_draw_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -10 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda -12 + __weather_draw_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __weather_draw_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -10 + __weather_draw_locals + 1,s
sta.b tcc__r0h
lda -12 + __weather_draw_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -5 + __weather_draw_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -12 + __weather_draw_locals + 1,s
sta.b tcc__r0
lda -10 + __weather_draw_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sep #$20
lda -6 + __weather_draw_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -12 + __weather_draw_locals + 1,s
sta.b tcc__r0
lda -10 + __weather_draw_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta -12 + __weather_draw_locals + 1,s
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_shown + 0
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
brl __local_40
+
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
clc
adc.w #100
asl a
asl a
sta.b tcc__r0
pea.w (0 * 256 + 0)
sep #$20
rep #$20
pei (tcc__r0)
jsr.l oamSetEx
tsa
clc
adc #4
tas
__local_40:
jmp.w __local_41
__local_31:
__local_30:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_count + 0
rep #$20
sta.b tcc__r0
sep #$20
sta -1 + __weather_draw_locals + 1,s
rep #$20
__local_44:
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_shown + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_42
+
bra __local_43
__local_45:
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __weather_draw_locals + 1,s
rep #$20
jmp.w __local_44
__local_43:
lda.w #0
sep #$20
lda -1 + __weather_draw_locals + 1,s
rep #$20
clc
adc.w #100
asl a
asl a
sta.b tcc__r0
sep #$20
lda #1
pha
rep #$20
pei (tcc__r0)
jsr.l oamSetVisible
tsa
clc
adc #3
tas
jmp.w __local_45
__local_42:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_w_count + 0
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_w_shown + 0
rep #$20
__local_16:
.ifgr __weather_draw_locals 0
tsa
clc
adc #__weather_draw_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_w_type dsb 1
tccs_{WLA_FILENAME}_w_count dsb 1
tccs_{WLA_FILENAME}_w_shown dsb 2
tccs_{WLA_FILENAME}_w_seed dsb 2
tccs_{WLA_FILENAME}_w_frm dsb 1
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $0
.db $0
.db $0,$0
.db $34,$12
.db $0
.ENDS
.SECTION ".rodata" SUPERFREE
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
tccs_{WLA_FILENAME}_wx dsb 24
tccs_{WLA_FILENAME}_wy dsb 24
tccs_{WLA_FILENAME}_wv dsb 24
.ENDS
