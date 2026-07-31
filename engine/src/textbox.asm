.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_make_far_locals 8
.define __tccs_{WLA_FILENAME}_text_decode_locals 29
.define __tccs_{WLA_FILENAME}_tb_clear_band_locals 2
.define __tccs_{WLA_FILENAME}_tb_box_at_locals 10
.define __tccs_{WLA_FILENAME}_tw_word_len_locals 4
.define __tccs_{WLA_FILENAME}_tw_step_locals 5
.define __textbox_tick_locals 0
.define __textbox_busy_locals 0
.define __textbox_finish_locals 0
.define __textbox_waiting_key_locals 0
.define __textbox_resume_locals 0
.define __textbox_autoclose_locals 0
.define __textbox_load_pal_locals 0
.define __textbox_set_style_locals 0
.define __textbox_init_locals 0
.define __textbox_open_locals 0
.define __textbox_open_raw_locals 5
.define __textbox_open_choices_locals 17
.define __textbox_choices_raw_locals 6
.define __textbox_choice_cursor_locals 8
.define __textbox_close_locals 0
.SECTION ".tccs_{WLA_FILENAME}_make_fartext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_make_far:
.ifgr __tccs_{WLA_FILENAME}_make_far_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_make_far_locals
tas
.endif
stz.b tcc__r0h
tsa
clc
adc #(-4 + __tccs_{WLA_FILENAME}_make_far_locals + 1)
sta.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
lda.b tcc__r0h
sta -6 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
lda -8 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0h
lda 4 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -6 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0h
lda -8 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
inc a
sta.b tcc__r0
lda 4 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -6 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0h
lda -8 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -8 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda -4 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0h
__local_0:
.ifgr __tccs_{WLA_FILENAME}_make_far_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_make_far_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_text_decodetext_0x1" SUPERFREE
tccs_{WLA_FILENAME}_text_decode:
.ifgr __tccs_{WLA_FILENAME}_text_decode_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_text_decode_locals
tas
.endif
pea.w 32768
sep #$20
lda #134
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_make_far
tsa
clc
adc #3
tas
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.b tcc__r0h
sta -2 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda -4 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda -2 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
lda -4 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
xba
and #$ff00
sta.b tcc__r2
ora.b tcc__r1
sta -6 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.w #0
sep #$20
sta -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda 7 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
sta.b [tcc__r0]
rep #$20
lda 3 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
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
brl __local_1
+
jmp.w __local_2
__local_1:
lda -2 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
lda -4 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
asl a
clc
adc.b tcc__r0
sta.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.b tcc__r0h
sta -10 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda -2 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
lda -4 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
asl a
clc
adc.b tcc__r0
sta.b tcc__r0
sta -20 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.b tcc__r0h
sta -18 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda -20 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda -18 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
xba
and #$ff00
ora.b tcc__r1
sta -22 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda -18 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
clc
adc.w #32768
pha
lda.w #0
sep #$20
lda.b [tcc__r0]
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_make_far
tsa
clc
adc #3
tas
lda.b tcc__r0
sta -16 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.b tcc__r0h
sta -14 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
__local_19:
lda -16 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_3
+
lda.w #0
sep #$20
lda 9 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
dec a
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
bvc +
eor #$8000
+
bmi +++
++
dex
+++
stx.b tcc__r5
txa
bne +
__local_3:
brl __local_4
+
lda -14 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
lda -16 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -16 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.b tcc__r0h
sta -14 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -28 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -28 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_5
+
lda -14 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
lda -16 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -16 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.b tcc__r0h
sta -14 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
dec a
and.w #255
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -26 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -29 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
__local_8:
lda.w #0
sep #$20
lda -29 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -29 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
lda.w #:tccs_{WLA_FILENAME}_tb_num
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_tb_num + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda -26 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r1
tax
lda.w #10
jsr.l tcc__udiv
stx.b tcc__r1
clc
lda.b tcc__r1
adc.w #48
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda -26 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
tax
lda.w #10
jsr.l tcc__udiv
lda.b tcc__r9
sta -26 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_6
+
lda.w #0
sep #$20
lda -29 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #5
tay
bvc +
eor #$8000
+
bmi +++
++
dex
+++
stx.b tcc__r5
txa
bne +
__local_6:
brl __local_7
+
jmp.w __local_8
__local_7:
__local_11:
lda.w #0
sep #$20
lda -29 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_9
+
lda.w #0
sep #$20
lda 9 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
dec a
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
bvc +
eor #$8000
+
bmi +++
++
dex
+++
stx.b tcc__r5
txa
bne +
__local_9:
brl __local_10
+
lda.w #0
sep #$20
lda -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda 7 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -29 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r1
dec.b tcc__r1
sep #$20
lda.b tcc__r1
sta -29 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
lda.b tcc__r1
and.w #255
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_tb_num
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_tb_num + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
jmp.w __local_11
__local_10:
jmp.w __local_12
__local_5:
lda.w #0
sep #$20
lda -28 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_13
+
lda.w #0
sep #$20
lda -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda 7 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -28 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
xba
and #$ff00
sta.b tcc__r1
ldy.w #8
-
cmp #$8000
ror a
dey
bne -
+
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #0
sep #$20
lda -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda 7 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r1h
lda -16 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r1
sta.b tcc__r2
lda.b tcc__r1h
sta.b tcc__r2h
inc.b tcc__r1
lda.b tcc__r1
sta -16 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.b tcc__r1h
sta -14 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
xba
and #$ff00
sta.b tcc__r1
ldy.w #8
-
cmp #$8000
ror a
dey
bne -
+
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
jmp.w __local_14
__local_13:
lda.w #0
sep #$20
lda -28 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #32
bvc +
eor #$8000
+
bmi +
brl __local_15
+
lda.w #0
sep #$20
lda -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda 7 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -28 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
xba
and #$ff00
sta.b tcc__r1
ldy.w #8
-
cmp #$8000
ror a
dey
bne -
+
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
jmp.w __local_16
__local_15:
lda.w #0
sep #$20
lda -28 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
and.w #128
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_17
+
lda.w #0
sep #$20
lda -28 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
and.w #127
asl a
sta -24 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
lda.w #0
sep #$20
lda -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda 7 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r1
lda -10 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r1h
lda -24 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
clc
adc.b tcc__r1
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
xba
and #$ff00
sta.b tcc__r2
ldy.w #8
-
cmp #$8000
ror a
dey
bne -
+
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #0
sep #$20
lda -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda 7 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda -24 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
inc a
sta.b tcc__r1
lda -12 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r2
lda -10 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r2h
clc
lda.b tcc__r2
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
xba
and #$ff00
sta.b tcc__r1
ldy.w #8
-
cmp #$8000
ror a
dey
bne -
+
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
jmp.w __local_18
__local_17:
lda.w #0
sep #$20
lda -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0
lda 7 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -28 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
xba
and #$ff00
sta.b tcc__r1
ldy.w #8
-
cmp #$8000
ror a
dey
bne -
+
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
__local_18:
__local_16:
__local_14:
__local_12:
jmp.w __local_19
__local_4:
lda.w #0
sep #$20
lda -27 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
rep #$20
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r1
lda 7 + __tccs_{WLA_FILENAME}_text_decode_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_2:
.ifgr __tccs_{WLA_FILENAME}_text_decode_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_text_decode_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_tb_clear_bandtext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_tb_clear_band:
.ifgr __tccs_{WLA_FILENAME}_tb_clear_band_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_tb_clear_band_locals
tas
.endif
lda.w #640
sta.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_tb_clear_band_locals + 1,s
__local_22:
lda -2 + __tccs_{WLA_FILENAME}_tb_clear_band_locals + 1,s
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
brl __local_20
+
bra __local_21
__local_23:
lda -2 + __tccs_{WLA_FILENAME}_tb_clear_band_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_tb_clear_band_locals + 1,s
bra __local_22
__local_21:
lda -2 + __tccs_{WLA_FILENAME}_tb_clear_band_locals + 1,s
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
bra __local_23
__local_20:
pea.w (8 * 256 + 20)
sep #$20
rep #$20
jsr.l ui_mark
pla
jsr.l overlay_refresh
jsr.l timer_refresh
.ifgr __tccs_{WLA_FILENAME}_tb_clear_band_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_tb_clear_band_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_tb_box_attext_0x3" SUPERFREE
tccs_{WLA_FILENAME}_tb_box_at:
.ifgr __tccs_{WLA_FILENAME}_tb_box_at_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_tb_box_at_locals
tas
.endif
jsr.l tccs_{WLA_FILENAME}_tb_clear_band
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_skin + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_24
+
lda.w #0
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
__local_27:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 6 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_25
+
bra __local_26
__local_38:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
jmp.w __local_27
__local_26:
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_28
+
jmp.w __local_29
__local_28:
lda.w #0
sep #$20
lda 6 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
beq +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_30
+
bra __local_31
__local_30:
lda.w #1
sta.b tcc__r0
bra __local_32
__local_31:
lda.w #2
sta.b tcc__r0
__local_32:
bra __local_33
__local_29:
lda.w #0
sta.b tcc__r0
__local_33:
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
asl a
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_skin + 0
rep #$20
clc
adc.b tcc__r0
inc a
ora.w #12288
sta.b tcc__r1
sta -8 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
lda -6 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
asl a
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_skin + 0
rep #$20
clc
adc.b tcc__r0
ora.w #12288
sta.b tcc__r2
sta.b [tcc__r1]
lda.w #1
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
__local_36:
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r1
sec
sbc.b tcc__r0
bvc +
eor #$8000
+
bmi +
brl __local_34
+
bra __local_35
__local_37:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
jmp.w __local_36
__local_35:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
clc
adc.b tcc__r0
asl a
sta.b tcc__r1
lda.w #:ui_map
sta.b tcc__r0h
lda.w #ui_map + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda -8 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
sta.b tcc__r1
sta.b [tcc__r0]
jmp.w __local_37
__local_34:
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
dec.b tcc__r1
asl.b tcc__r1
lda.w #:ui_map
sta.b tcc__r0h
lda.w #ui_map + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r1
asl a
clc
adc.b tcc__r1
sta.b tcc__r1
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_skin + 0
rep #$20
clc
adc.b tcc__r1
inc a
inc a
ora.w #12288
sta.b tcc__r2
sta.b [tcc__r0]
jmp.w __local_38
__local_25:
jmp.w __local_39
__local_24:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_font + 0
rep #$20
clc
adc.w #32
sec
sbc.w #32
ora.w #12288
sta -10 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
__local_42:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 6 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_40
+
bra __local_41
__local_47:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
jmp.w __local_42
__local_41:
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
__local_45:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_43
+
bra __local_44
__local_46:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
jmp.w __local_45
__local_44:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
clc
adc.b tcc__r0
asl a
sta.b tcc__r1
lda.w #:ui_map
sta.b tcc__r0h
lda.w #ui_map + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_tb_box_at_locals + 1,s
sta.b tcc__r1
sta.b [tcc__r0]
jmp.w __local_46
__local_43:
jmp.w __local_47
__local_40:
__local_39:
.ifgr __tccs_{WLA_FILENAME}_tb_box_at_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_tb_box_at_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_tw_word_lentext_0x4" SUPERFREE
tccs_{WLA_FILENAME}_tw_word_len:
.ifgr __tccs_{WLA_FILENAME}_tw_word_len_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_tw_word_len_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
lda.w #1
sta.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
__local_55:
lda 3 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r0h
lda -4 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
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
brl __local_48
+
lda 3 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r0h
lda -4 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
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
ldx #1
sec
sbc #32
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
__local_48:
brl __local_49
+
lda 3 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r0h
lda -4 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
and.w #255
sta.b tcc__r1
ldx #1
sec
sbc.w #32
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
brl __local_50
+
lda -2 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
inc a
sta -2 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
lda -4 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
jmp.w __local_51
__local_50:
lda 3 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r0h
lda -4 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
and.w #255
sta.b tcc__r1
ldx #1
sec
sbc.w #2
tay
beq +++
bvc +
eor #$8000
+
bmi +++
++
dex
+++
stx.b tcc__r5
txa
bne +
brl __local_52
+
bra __local_53
__local_52:
lda.w #1
sta.b tcc__r0
bra __local_54
__local_53:
lda.w #2
sta.b tcc__r0
__local_54:
lda -4 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -4 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
__local_51:
jmp.w __local_55
__local_49:
lda -2 + __tccs_{WLA_FILENAME}_tw_word_len_locals + 1,s
sta.b tcc__r0
__local_56:
.ifgr __tccs_{WLA_FILENAME}_tw_word_len_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_tw_word_len_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_tw_steptext_0x5" SUPERFREE
tccs_{WLA_FILENAME}_tw_step:
.ifgr __tccs_{WLA_FILENAME}_tw_step_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_tw_step_locals
tas
.endif
__local_60:
__local_71:
__local_73:
__local_77:
lda.w tccs_{WLA_FILENAME}_tw_s + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
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
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
cmp #2
beq +
brl __local_57
+
lda.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_tw_s + 0
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
dec a
and.w #255
sta.b tcc__r1
sep #$20
sta -5 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
lda.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_tw_s + 0
inc a
inc a
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_s + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
lda.w #0
sep #$20
lda -5 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_58
+
lda.w #0
sep #$20
lda -5 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
sta.w tccs_{WLA_FILENAME}_tw_speed + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_instant + 0
rep #$20
bra __local_59
__local_58:
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_instant + 0
rep #$20
__local_59:
jmp.w __local_60
__local_57:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
ldx #1
sec
sbc #3
tay
beq +
dex
+
stx.b tcc__r5
txa
beq +
brl __local_61
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
ldx #1
sec
sbc #4
tay
beq +
dex
+
stx.b tcc__r5
txa
beq +
__local_61:
brl __local_62
+
jmp.w __local_63
__local_62:
lda.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_tw_s + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_s + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
cmp #3
beq +
brl __local_64
+
bra __local_65
__local_64:
lda.w #60
sta.b tcc__r0
bra __local_66
__local_65:
lda.w #15
sta.b tcc__r0
__local_66:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_pause + 0
rep #$20
jmp.w __local_67
__local_63:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
cmp #5
beq +
brl __local_68
+
lda.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_tw_s + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_s + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_waitkey + 0
rep #$20
jmp.w __local_69
__local_68:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
cmp #6
beq +
brl __local_70
+
lda.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_tw_s + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_s + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tb_autoclose + 0
rep #$20
jmp.w __local_71
__local_70:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
cmp #7
beq +
brl __local_72
+
lda.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_tw_s + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_s + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_instant + 0
rep #$20
jmp.w __local_73
__local_72:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
cmp #8
beq +
brl __local_74
+
lda.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_tw_s + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_s + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_instant + 0
rep #$20
jmp.w __local_75
__local_74:
bra __local_76
jmp.w __local_77
__local_76:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_78
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mh + 0
rep #$20
dec a
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_row + 0
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
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
beq +
__local_78:
brl __local_79
+
bra __local_80
__local_79:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
jmp.w __local_81
__local_80:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
cmp #32
beq +
brl __local_82
+
lda.w tccs_{WLA_FILENAME}_tw_s + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_tw_word_len
tsa
clc
adc #4
tas
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_col + 0
rep #$20
inc a
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mw + 0
rep #$20
sec
sbc.w #4
and.w #255
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_83
++
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_row + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_row + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_col + 0
rep #$20
lda.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_tw_s + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_s + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
jmp.w __local_84
__local_83:
__local_82:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mw + 0
rep #$20
sec
sbc.w #4
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_col + 0
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
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
brl __local_85
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_row + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_row + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_col + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mh + 0
rep #$20
dec a
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_row + 0
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
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
brl __local_86
+
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
jmp.w __local_87
__local_86:
__local_85:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_my + 0
rep #$20
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_row + 0
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mx + 0
rep #$20
clc
adc.b tcc__r0
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_col + 0
rep #$20
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
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_font + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_tw_step_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
clc
adc.b tcc__r0
sec
sbc.w #32
ora.w #12288
sta.b [tcc__r1]
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_my + 0
rep #$20
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_row + 0
rep #$20
clc
adc.b tcc__r0
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
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_col + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_col + 0
rep #$20
lda.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_tw_s + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_s + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
__local_67:
__local_69:
__local_75:
__local_81:
__local_84:
__local_87:
.ifgr __tccs_{WLA_FILENAME}_tw_step_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_tw_step_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_ticktext_0x6" SUPERFREE
textbox_tick:
.ifgr __textbox_tick_locals 0
tsa
sec
sbc #__textbox_tick_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_88
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_waitkey + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
__local_88:
brl __local_89
+
bra __local_90
__local_89:
jmp.w __local_91
__local_90:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_pause + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_92
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_pause + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_pause + 0
rep #$20
jmp.w __local_93
__local_92:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_instant + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_94
+
__local_101:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_95
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_instant + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_95:
brl __local_96
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_pause + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_97
+
bra __local_98
__local_97:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_waitkey + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_99
+
bra __local_100
__local_99:
jsr.l tccs_{WLA_FILENAME}_tw_step
jmp.w __local_101
__local_96:
__local_98:
__local_100:
jmp.w __local_102
__local_94:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_timer + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_timer + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_timer + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_speed + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_103
+
bra __local_104
__local_103:
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_timer + 0
rep #$20
jsr.l tccs_{WLA_FILENAME}_tw_step
__local_91:
__local_93:
__local_102:
__local_104:
.ifgr __textbox_tick_locals 0
tsa
clc
adc #__textbox_tick_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_busytext_0x7" SUPERFREE
textbox_busy:
.ifgr __textbox_busy_locals 0
tsa
sec
sbc #__textbox_busy_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
sta.b tcc__r0
__local_105:
.ifgr __textbox_busy_locals 0
tsa
clc
adc #__textbox_busy_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_finishtext_0x8" SUPERFREE
textbox_finish:
.ifgr __textbox_finish_locals 0
tsa
sec
sbc #__textbox_finish_locals
tas
.endif
__local_109:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_106
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_waitkey + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_107
+
bra __local_108
__local_107:
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_pause + 0
rep #$20
jsr.l tccs_{WLA_FILENAME}_tw_step
bra __local_109
__local_106:
__local_108:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_pause + 0
rep #$20
.ifgr __textbox_finish_locals 0
tsa
clc
adc #__textbox_finish_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_waiting_keytext_0x9" SUPERFREE
textbox_waiting_key:
.ifgr __textbox_waiting_key_locals 0
tsa
sec
sbc #__textbox_waiting_key_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_110
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tw_waitkey + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_110:
brl __local_111
+
lda #1
bra +
__local_111:
lda #0
+
and.w #255
sta.b tcc__r0
__local_112:
.ifgr __textbox_waiting_key_locals 0
tsa
clc
adc #__textbox_waiting_key_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_resumetext_0xa" SUPERFREE
textbox_resume:
.ifgr __textbox_resume_locals 0
tsa
sec
sbc #__textbox_resume_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_waitkey + 0
rep #$20
.ifgr __textbox_resume_locals 0
tsa
clc
adc #__textbox_resume_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_autoclosetext_0xb" SUPERFREE
textbox_autoclose:
.ifgr __textbox_autoclose_locals 0
tsa
sec
sbc #__textbox_autoclose_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_autoclose + 0
rep #$20
sta.b tcc__r0
__local_113:
.ifgr __textbox_autoclose_locals 0
tsa
clc
adc #__textbox_autoclose_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_load_paltext_0xc" SUPERFREE
textbox_load_pal:
.ifgr __textbox_load_pal_locals 0
tsa
sec
sbc #__textbox_load_pal_locals
tas
.endif
pea.w 8
pea.w 16
pea.w :textbox_pal
pea.w textbox_pal + 0
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
.ifgr __textbox_load_pal_locals 0
tsa
clc
adc #__textbox_load_pal_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_set_styletext_0xd" SUPERFREE
textbox_set_style:
.ifgr __textbox_set_style_locals 0
tsa
sec
sbc #__textbox_set_style_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __textbox_set_style_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #1
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
brl __local_114
+
lda.w #0
sta.b tcc__r0
sep #$20
sta 3 + __textbox_set_style_locals + 1,s
rep #$20
__local_114:
lda.w #0
sep #$20
lda 3 + __textbox_set_style_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_st_mx
sta.b tcc__r1h
lda.w #ui_st_mx + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.w tccs_{WLA_FILENAME}_tb_mx + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __textbox_set_style_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_st_my
sta.b tcc__r1h
lda.w #ui_st_my + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.w tccs_{WLA_FILENAME}_tb_my + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __textbox_set_style_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_st_mw
sta.b tcc__r1h
lda.w #ui_st_mw + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.w tccs_{WLA_FILENAME}_tb_mw + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __textbox_set_style_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_st_mh
sta.b tcc__r1h
lda.w #ui_st_mh + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.w tccs_{WLA_FILENAME}_tb_mh + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __textbox_set_style_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_st_cx
sta.b tcc__r1h
lda.w #ui_st_cx + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.w tccs_{WLA_FILENAME}_tb_cx2 + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __textbox_set_style_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_st_cy
sta.b tcc__r1h
lda.w #ui_st_cy + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.w tccs_{WLA_FILENAME}_tb_cy2 + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __textbox_set_style_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_st_cw
sta.b tcc__r1h
lda.w #ui_st_cw + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.w tccs_{WLA_FILENAME}_tb_cw2 + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __textbox_set_style_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_st_ch
sta.b tcc__r1h
lda.w #ui_st_ch + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.w tccs_{WLA_FILENAME}_tb_ch2 + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __textbox_set_style_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_st_font
sta.b tcc__r1h
lda.w #ui_st_font + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.w tccs_{WLA_FILENAME}_tb_font + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __textbox_set_style_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_st_skin
sta.b tcc__r1h
lda.w #ui_st_skin + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tb_skin + 0
rep #$20
.ifgr __textbox_set_style_locals 0
tsa
clc
adc #__textbox_set_style_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_inittext_0xe" SUPERFREE
textbox_init:
.ifgr __textbox_init_locals 0
tsa
sec
sbc #__textbox_init_locals
tas
.endif
pea.w 4096
lda.l font_gfx_size + 0
pha
pea.w :font_gfx
pea.w font_gfx + 0
sep #$20
lda #2
pha
rep #$20
jsr.l bgInitTileSetData
tsa
clc
adc #9
tas
jsr.l textbox_load_pal
sep #$20
lda #0
pha
rep #$20
pea.w 6144
sep #$20
lda #2
pha
rep #$20
jsr.l bgSetMapPtr
tsa
clc
adc #4
tas
sep #$20
lda #0
pha
rep #$20
jsr.l textbox_set_style
tsa
clc
adc #1
tas
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_timer + 0
rep #$20
stz.b tcc__r0
stz.b tcc__r0h
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_s + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_row + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_col + 0
rep #$20
lda.w #2
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_115
+
bra __local_116
__local_115:
lda.w #1
sta.b tcc__r0
bra __local_117
__local_116:
lda.w #2
sta.b tcc__r0
__local_117:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_speed + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_pause + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_waitkey + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_instant + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tb_autoclose + 0
rep #$20
.ifgr __textbox_init_locals 0
tsa
clc
adc #__textbox_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_opentext_0xf" SUPERFREE
textbox_open:
.ifgr __textbox_open_locals 0
tsa
sec
sbc #__textbox_open_locals
tas
.endif
sep #$20
lda #176
pha
rep #$20
pea.w :tccs_{WLA_FILENAME}_tb_text
pea.w tccs_{WLA_FILENAME}_tb_text + 0
lda 8 + __textbox_open_locals + 1,s
pha
jsr.l tccs_{WLA_FILENAME}_text_decode
tsa
clc
adc #7
tas
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mh + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mw + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_my + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mx + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tb_box_at
tsa
clc
adc #4
tas
lda.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_timer + 0
rep #$20
lda.w #:tccs_{WLA_FILENAME}_tb_text
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_tb_text + 0
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tw_s + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_tw_s + 0 + 2
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_row + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_col + 0
rep #$20
lda.w #2
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_speed + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_pause + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_waitkey + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_instant + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tb_autoclose + 0
rep #$20
.ifgr __textbox_open_locals 0
tsa
clc
adc #__textbox_open_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_open_rawtext_0x10" SUPERFREE
textbox_open_raw:
.ifgr __textbox_open_raw_locals 0
tsa
sec
sbc #__textbox_open_raw_locals
tas
.endif
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tb_autoclose + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mh + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mw + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_my + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mx + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tb_box_at
tsa
clc
adc #4
tas
lda 3 + __textbox_open_raw_locals + 1,s
sta.b tcc__r0
lda 5 + __textbox_open_raw_locals + 1,s
sta.b tcc__r0h
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_118
+
lda.w #0
sep #$20
sta -3 + __textbox_open_raw_locals + 1,s
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -4 + __textbox_open_raw_locals + 1,s
rep #$20
__local_126:
__local_129:
__local_133:
lda 3 + __textbox_open_raw_locals + 1,s
sta.b tcc__r0
lda 5 + __textbox_open_raw_locals + 1,s
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
brl __local_119
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mh + 0
rep #$20
dec a
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __textbox_open_raw_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
bvc +
eor #$8000
+
bmi +++
++
dex
+++
stx.b tcc__r5
txa
bne +
__local_119:
brl __local_120
+
lda 3 + __textbox_open_raw_locals + 1,s
sta.b tcc__r0
lda 5 + __textbox_open_raw_locals + 1,s
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
sep #$20
sta -5 + __textbox_open_raw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -5 + __textbox_open_raw_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
and.w #255
sta.b tcc__r0
sec
sbc.w #32
bvc +
eor #$8000
+
bmi +
brl __local_121
+
lda.w #0
sep #$20
lda -5 + __textbox_open_raw_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
cmp #6
beq +
brl __local_122
+
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tb_autoclose + 0
rep #$20
__local_122:
lda.w #0
sep #$20
lda -5 + __textbox_open_raw_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
and.w #255
sta.b tcc__r0
ldx #1
sec
sbc.w #2
tay
beq +++
bvc +
eor #$8000
+
bmi +++
++
dex
+++
stx.b tcc__r5
txa
bne +
brl __local_123
+
bra __local_124
__local_123:
lda.w #1
sta.b tcc__r0
bra __local_125
__local_124:
lda.w #2
sta.b tcc__r0
__local_125:
lda 3 + __textbox_open_raw_locals + 1,s
sta.b tcc__r1
lda 5 + __textbox_open_raw_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
sta 3 + __textbox_open_raw_locals + 1,s
jmp.w __local_126
__local_121:
lda.w #0
sep #$20
lda -5 + __textbox_open_raw_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
cmp #32
beq +
brl __local_127
+
lda 3 + __textbox_open_raw_locals + 1,s
sta.b tcc__r0
lda 5 + __textbox_open_raw_locals + 1,s
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_tw_word_len
tsa
clc
adc #4
tas
lda.b tcc__r0
sta -2 + __textbox_open_raw_locals + 1,s
lda.w #0
sep #$20
lda -4 + __textbox_open_raw_locals + 1,s
rep #$20
inc a
sta.b tcc__r0
lda -2 + __textbox_open_raw_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mw + 0
rep #$20
sec
sbc.w #4
and.w #255
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_128
++
lda.w #0
sep #$20
lda -3 + __textbox_open_raw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -3 + __textbox_open_raw_locals + 1,s
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -4 + __textbox_open_raw_locals + 1,s
rep #$20
lda 5 + __textbox_open_raw_locals + 1,s
sta.b tcc__r0h
lda 3 + __textbox_open_raw_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta 3 + __textbox_open_raw_locals + 1,s
lda.b tcc__r0h
sta 5 + __textbox_open_raw_locals + 1,s
jmp.w __local_129
__local_128:
__local_127:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mw + 0
rep #$20
sec
sbc.w #4
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __textbox_open_raw_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
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
brl __local_130
+
lda.w #0
sep #$20
lda -3 + __textbox_open_raw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -3 + __textbox_open_raw_locals + 1,s
rep #$20
lda.w #0
sep #$20
sta -4 + __textbox_open_raw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mh + 0
rep #$20
dec a
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __textbox_open_raw_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
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
brl __local_131
+
jmp.w __local_132
__local_131:
__local_130:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_my + 0
rep #$20
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __textbox_open_raw_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_mx + 0
rep #$20
clc
adc.b tcc__r0
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __textbox_open_raw_locals + 1,s
rep #$20
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
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_font + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -5 + __textbox_open_raw_locals + 1,s
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r2
clc
adc.b tcc__r0
sec
sbc.w #32
ora.w #12288
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -4 + __textbox_open_raw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -4 + __textbox_open_raw_locals + 1,s
rep #$20
lda 5 + __textbox_open_raw_locals + 1,s
sta.b tcc__r0h
lda 3 + __textbox_open_raw_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta 3 + __textbox_open_raw_locals + 1,s
lda.b tcc__r0h
sta 5 + __textbox_open_raw_locals + 1,s
jmp.w __local_133
__local_120:
__local_132:
__local_118:
.ifgr __textbox_open_raw_locals 0
tsa
clc
adc #__textbox_open_raw_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_open_choicestext_0x11" SUPERFREE
textbox_open_choices:
.ifgr __textbox_open_choices_locals 0
tsa
sec
sbc #__textbox_open_choices_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -17 + __textbox_open_choices_locals + 1,s
rep #$20
__local_136:
lda.w #0
sep #$20
lda -17 + __textbox_open_choices_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 7 + __textbox_open_choices_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_134
+
bra __local_135
__local_137:
lda.w #0
sep #$20
lda -17 + __textbox_open_choices_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -17 + __textbox_open_choices_locals + 1,s
rep #$20
jmp.w __local_136
__local_135:
lda.w #0
sep #$20
lda -17 + __textbox_open_choices_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda 3 + __textbox_open_choices_locals + 1,s
sta.b tcc__r1
lda 5 + __textbox_open_choices_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -17 + __textbox_open_choices_locals + 1,s
rep #$20
and.w #3
sta.b tcc__r0
lda.w #28
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_tb_opts
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_tb_opts + 0
clc
adc.b tcc__r0
sta.b tcc__r2
sep #$20
lda #28
pha
rep #$20
pei (tcc__r2h)
pei (tcc__r2)
lda.b [tcc__r1]
pha
jsr.l tccs_{WLA_FILENAME}_text_decode
tsa
clc
adc #7
tas
lda.w #0
sep #$20
lda -17 + __textbox_open_choices_locals + 1,s
rep #$20
and.w #3
asl a
asl a
sta.b tcc__r0
stz.b tcc__r1h
tsa
clc
adc #(-16 + __textbox_open_choices_locals + 1)
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -17 + __textbox_open_choices_locals + 1,s
rep #$20
and.w #3
sta.b tcc__r0
lda.w #28
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_tb_opts
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_tb_opts + 0
clc
adc.b tcc__r0
sta.b tcc__r2
ldy #0
sta.b [tcc__r1],y
lda.b tcc__r2h
iny
iny
sta.b [tcc__r1],y
jmp.w __local_137
__local_134:
lda.w #0
sep #$20
lda 8 + __textbox_open_choices_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 8 + __textbox_open_choices_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
pha
rep #$20
stz.b tcc__r0h
tsa
clc
adc #(-14 + __textbox_open_choices_locals + 1)
pei (tcc__r0h)
pha
jsr.l textbox_choices_raw
tsa
clc
adc #6
tas
.ifgr __textbox_open_choices_locals 0
tsa
clc
adc #__textbox_open_choices_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_choices_rawtext_0x12" SUPERFREE
textbox_choices_raw:
.ifgr __textbox_choices_raw_locals 0
tsa
sec
sbc #__textbox_choices_raw_locals
tas
.endif
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_ch2 + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cw2 + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cy2 + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cx2 + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tb_box_at
tsa
clc
adc #4
tas
lda.w #0
sta.b tcc__r0
sep #$20
sta -5 + __textbox_choices_raw_locals + 1,s
rep #$20
__local_141:
lda.w #0
sep #$20
lda -5 + __textbox_choices_raw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 7 + __textbox_choices_raw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_138
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_ch2 + 0
rep #$20
dec a
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -5 + __textbox_choices_raw_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
bvc +
eor #$8000
+
bmi +++
++
dex
+++
stx.b tcc__r5
txa
bne +
__local_138:
brl __local_139
+
bra __local_140
__local_151:
lda.w #0
sep #$20
lda -5 + __textbox_choices_raw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -5 + __textbox_choices_raw_locals + 1,s
rep #$20
jmp.w __local_141
__local_140:
lda.w #0
sep #$20
lda -5 + __textbox_choices_raw_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda 3 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r1
lda 5 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
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
sta -4 + __textbox_choices_raw_locals + 1,s
lda.b tcc__r0h
sta -2 + __textbox_choices_raw_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -6 + __textbox_choices_raw_locals + 1,s
rep #$20
__local_149:
__local_150:
lda -4 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r0
lda -2 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r0h
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_142
+
lda -4 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r0
lda -2 + __textbox_choices_raw_locals + 1,s
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
__local_142:
brl __local_143
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cw2 + 0
rep #$20
sec
sbc.w #4
and.w #255
dec a
dec a
sta.b tcc__r0
lda.w #0
sep #$20
lda -6 + __textbox_choices_raw_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
bvc +
eor #$8000
+
bmi +++
++
dex
+++
stx.b tcc__r5
txa
bne +
__local_143:
brl __local_144
+
lda -4 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r0
lda -2 + __textbox_choices_raw_locals + 1,s
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
and.w #255
sta.b tcc__r1
sec
sbc.w #32
bvc +
eor #$8000
+
bmi +
brl __local_145
+
lda -4 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r0
lda -2 + __textbox_choices_raw_locals + 1,s
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
and.w #255
sta.b tcc__r1
ldx #1
sec
sbc.w #2
tay
beq +++
bvc +
eor #$8000
+
bmi +++
++
dex
+++
stx.b tcc__r5
txa
bne +
brl __local_146
+
bra __local_147
__local_146:
lda.w #1
sta.b tcc__r0
bra __local_148
__local_147:
lda.w #2
sta.b tcc__r0
__local_148:
lda -4 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r1
lda -2 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
sta -4 + __textbox_choices_raw_locals + 1,s
jmp.w __local_149
__local_145:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cy2 + 0
rep #$20
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -5 + __textbox_choices_raw_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cx2 + 0
rep #$20
clc
adc.b tcc__r0
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -6 + __textbox_choices_raw_locals + 1,s
rep #$20
sta.b tcc__r1
inc.b tcc__r1
inc.b tcc__r1
clc
lda.b tcc__r0
adc.b tcc__r1
asl a
sta.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_font + 0
rep #$20
sta.b tcc__r0
lda -4 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r2
lda -2 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r2h
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r3
clc
adc.b tcc__r0
sec
sbc.w #32
ora.w #12288
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -6 + __textbox_choices_raw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -6 + __textbox_choices_raw_locals + 1,s
rep #$20
lda -2 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r0h
lda -4 + __textbox_choices_raw_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -4 + __textbox_choices_raw_locals + 1,s
lda.b tcc__r0h
sta -2 + __textbox_choices_raw_locals + 1,s
jmp.w __local_150
__local_144:
jmp.w __local_151
__local_139:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cy2 + 0
rep #$20
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda 8 + __textbox_choices_raw_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cx2 + 0
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_font + 0
rep #$20
clc
adc.w #62
sec
sbc.w #32
ora.w #12288
sta.b tcc__r0
sta.b [tcc__r1]
.ifgr __textbox_choices_raw_locals 0
tsa
clc
adc #__textbox_choices_raw_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_choice_cursortext_0x13" SUPERFREE
textbox_choice_cursor:
.ifgr __textbox_choice_cursor_locals 0
tsa
sec
sbc #__textbox_choice_cursor_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __textbox_choice_cursor_locals + 1,s
rep #$20
__local_154:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_ch2 + 0
rep #$20
dec a
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __textbox_choice_cursor_locals + 1,s
rep #$20
sta.b tcc__r1
sec
sbc.b tcc__r0
bvc +
eor #$8000
+
bmi +
brl __local_152
+
bra __local_153
__local_158:
lda.w #0
sep #$20
lda -1 + __textbox_choice_cursor_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __textbox_choice_cursor_locals + 1,s
rep #$20
jmp.w __local_154
__local_153:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cy2 + 0
rep #$20
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __textbox_choice_cursor_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cx2 + 0
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_skin + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r1
sta -8 + __textbox_choice_cursor_locals + 1,s
lda.b tcc__r1h
sta -6 + __textbox_choice_cursor_locals + 1,s
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_155
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_skin + 0
rep #$20
clc
adc.w #4
sta.b tcc__r0
bra __local_156
__local_155:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_font + 0
rep #$20
clc
adc.w #32
sec
sbc.w #32
sta.b tcc__r0
__local_156:
__local_157:
lda.b tcc__r0
ora.w #12288
sta.b tcc__r0
lda -8 + __textbox_choice_cursor_locals + 1,s
sta.b tcc__r1
lda -6 + __textbox_choice_cursor_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_158
__local_152:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cy2 + 0
rep #$20
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __textbox_choice_cursor_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cx2 + 0
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_font + 0
rep #$20
clc
adc.w #62
sec
sbc.w #32
ora.w #12288
sta.b [tcc__r1]
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_cy2 + 0
rep #$20
inc a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tb_ch2 + 0
rep #$20
dec a
dec a
and.w #255
sep #$20
pha
lda.b tcc__r0
pha
rep #$20
jsr.l ui_mark
pla
.ifgr __textbox_choice_cursor_locals 0
tsa
clc
adc #__textbox_choice_cursor_locals
tas
.endif
rtl
.ENDS
.SECTION ".textbox_closetext_0x14" SUPERFREE
textbox_close:
.ifgr __textbox_close_locals 0
tsa
sec
sbc #__textbox_close_locals
tas
.endif
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_active + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_waitkey + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tw_pause + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tb_autoclose + 0
rep #$20
jsr.l tccs_{WLA_FILENAME}_tb_clear_band
.ifgr __textbox_close_locals 0
tsa
clc
adc #__textbox_close_locals
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
tccs_{WLA_FILENAME}_tb_mx dsb 1
tccs_{WLA_FILENAME}_tb_my dsb 1
tccs_{WLA_FILENAME}_tb_mw dsb 1
tccs_{WLA_FILENAME}_tb_mh dsb 1
tccs_{WLA_FILENAME}_tb_cx2 dsb 1
tccs_{WLA_FILENAME}_tb_cy2 dsb 1
tccs_{WLA_FILENAME}_tb_cw2 dsb 1
tccs_{WLA_FILENAME}_tb_ch2 dsb 1
tccs_{WLA_FILENAME}_tb_font dsb 1
tccs_{WLA_FILENAME}_tb_skin dsb 1
tccs_{WLA_FILENAME}_tb_num dsb 5
tccs_{WLA_FILENAME}_tb_text dsb 176
tccs_{WLA_FILENAME}_tb_opts dsb 112
tccs_{WLA_FILENAME}_tw_active dsb 1
tccs_{WLA_FILENAME}_tw_timer dsb 1
tccs_{WLA_FILENAME}_tw_s dsb 4
tccs_{WLA_FILENAME}_tw_row dsb 1
tccs_{WLA_FILENAME}_tw_col dsb 1
tccs_{WLA_FILENAME}_tw_speed dsb 1
tccs_{WLA_FILENAME}_tw_pause dsb 1
tccs_{WLA_FILENAME}_tw_waitkey dsb 1
tccs_{WLA_FILENAME}_tw_instant dsb 1
tccs_{WLA_FILENAME}_tb_autoclose dsb 1
.ENDS
