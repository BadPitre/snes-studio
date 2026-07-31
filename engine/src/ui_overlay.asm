.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_ov_max_locals 0
.define __tccs_{WLA_FILENAME}_ov_erase_locals 4
.define __tccs_{WLA_FILENAME}_ov_draw_locals 52
.define __overlay_init_locals 12
.define __overlay_update_locals 6
.define __overlay_refresh_locals 1
.define __overlay_show_locals 1
.define __tccs_{WLA_FILENAME}_ov_list_count_locals 6
.define __overlay_list_open_locals 1
.define __overlay_list_cursor_locals 0
.define __overlay_list_close_locals 2
.SECTION ".tccs_{WLA_FILENAME}_ov_maxtext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_ov_max:
.ifgr __tccs_{WLA_FILENAME}_ov_max_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_ov_max_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_max_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_maxvar
sta.b tcc__r1h
lda.w #ui_ov_maxvar + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
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
brl __local_0
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_max_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_maxvar
sta.b tcc__r1h
lda.w #ui_ov_maxvar + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
jmp.w __local_1
__local_0:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_max_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_maxlo
sta.b tcc__r1h
lda.w #ui_ov_maxlo + 0
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
lda 3 + __tccs_{WLA_FILENAME}_ov_max_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:ui_ov_maxhi
sta.b tcc__r2h
lda.w #ui_ov_maxhi + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
xba
and #$ff00
sta.b tcc__r1
ora.b tcc__r0
sta.b tcc__r0
__local_1:
__local_2:
.ifgr __tccs_{WLA_FILENAME}_ov_max_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_ov_max_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_ov_erasetext_0x1" SUPERFREE
tccs_{WLA_FILENAME}_ov_erase:
.ifgr __tccs_{WLA_FILENAME}_ov_erase_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_ov_erase_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
__local_5:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_h
sta.b tcc__r1h
lda.w #ui_ov_h + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r2
lda.b tcc__r0
sec
sbc.b tcc__r2
bvc +
eor #$8000
+
bmi +
brl __local_3
+
bra __local_4
__local_10:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
jmp.w __local_5
__local_4:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_y
sta.b tcc__r1h
lda.w #ui_ov_y + 0
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
lda -2 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
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
lda 3 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:ui_ov_x
sta.b tcc__r2h
lda.w #ui_ov_x + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
__local_8:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_w
sta.b tcc__r1h
lda.w #ui_ov_w + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r2
lda.b tcc__r0
sec
sbc.b tcc__r2
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
lda -1 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
jmp.w __local_8
__local_7:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
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
stz.b tcc__r1
lda.b tcc__r1
sta.b [tcc__r0]
jmp.w __local_9
__local_6:
jmp.w __local_10
__local_3:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_y
sta.b tcc__r1h
lda.w #ui_ov_y + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_erase_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_h
sta.b tcc__r2h
lda.w #ui_ov_h + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
pha
rep #$20
lda.w #0
sep #$20
lda.b [tcc__r1]
pha
rep #$20
jsr.l ui_mark
pla
.ifgr __tccs_{WLA_FILENAME}_ov_erase_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_ov_erase_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_ov_drawtext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_ov_draw:
.ifgr __tccs_{WLA_FILENAME}_ov_draw_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_ov_draw_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_x
sta.b tcc__r1h
lda.w #ui_ov_x + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_w
sta.b tcc__r1h
lda.w #ui_ov_w + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_h
sta.b tcc__r1h
lda.w #ui_ov_h + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_frame
sta.b tcc__r1h
lda.w #ui_ov_frame + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -4 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_font
sta.b tcc__r1h
lda.w #ui_ov_font + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -5 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_11
+
lda.w #0
sta.b tcc__r0
sep #$20
sta -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_14:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
__local_31:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
jmp.w __local_14
__local_13:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_y
sta.b tcc__r1h
lda.w #ui_ov_y + 0
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
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_15
+
jmp.w __local_16
__local_15:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
brl __local_17
+
bra __local_18
__local_17:
lda.w #1
sta.b tcc__r0
bra __local_19
__local_18:
lda.w #2
sta.b tcc__r0
__local_19:
bra __local_20
__local_16:
lda.w #0
sta.b tcc__r0
__local_20:
sep #$20
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_23:
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
__local_30:
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
jmp.w __local_23
__local_22:
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
lda.w #0
sep #$20
lda -8 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
asl a
clc
adc.b tcc__r1
clc
adc.w #97
sta.b tcc__r1
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r2
ldx #1
sec
sbc #0
tay
beq +
dex
+
stx.b tcc__r5
lda.b tcc__r0
sta -28 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r0h
sta -26 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r1
sta -32 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r1h
sta -30 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r5 ; DON'T OPTIMIZE
bne +
brl __local_24
+
jmp.w __local_25
__local_24:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
brl __local_26
+
bra __local_27
__local_26:
lda.w #1
sta.b tcc__r0
bra __local_28
__local_27:
lda.w #2
sta.b tcc__r0
__local_28:
bra __local_29
__local_25:
lda.w #0
sta.b tcc__r0
__local_29:
lda -32 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
adc.b tcc__r0
ora.w #12288
sta.b tcc__r1
lda -28 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda -26 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0h
lda.b tcc__r1
sta.b [tcc__r0]
jmp.w __local_30
__local_21:
jmp.w __local_31
__local_12:
jmp.w __local_32
__local_11:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_bg
sta.b tcc__r1h
lda.w #ui_ov_bg + 0
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
brl __local_33
+
bra __local_34
__local_33:
lda.w #0
sta.b tcc__r0
bra __local_35
__local_34:
lda.w #12389
sta.b tcc__r0
__local_35:
lda.b tcc__r0
sta -34 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_38:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_36
+
bra __local_37
__local_43:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
jmp.w __local_38
__local_37:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_y
sta.b tcc__r1h
lda.w #ui_ov_y + 0
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
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sta -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_41:
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_39
+
bra __local_40
__local_42:
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
jmp.w __local_41
__local_40:
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
lda -34 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r1
sta.b [tcc__r0]
jmp.w __local_42
__local_39:
jmp.w __local_43
__local_36:
__local_32:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
and.w #255
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sec
sbc.b tcc__r0
and.w #255
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sec
sbc.b tcc__r0
and.w #255
sta.b tcc__r1
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_y
sta.b tcc__r1h
lda.w #ui_ov_y + 0
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
lda -4 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
sta -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_last
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_last + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -16 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_type
sta.b tcc__r1h
lda.w #ui_ov_type + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
bra __local_44
bra __local_45
__local_44:
lda.b tcc__r0
cmp #1
beq +
brl __local_46
+
__local_45:
bra __local_47
__local_46:
lda.b tcc__r0
cmp #2
beq +
brl __local_48
+
__local_47:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_dir
sta.b tcc__r1h
lda.w #ui_ov_dir + 0
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
brl __local_49
+
bra __local_50
__local_49:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_51
__local_50:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
__local_51:
sep #$20
lda.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -10 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
asl a
sta -18 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_lastm
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_lastm + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -36 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc #0
tay
beq +
dex
+
stx.b tcc__r5
txa
beq +
brl __local_52
+
lda -16 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc #0
tay
beq +
dex
+
stx.b tcc__r5
txa
beq +
__local_52:
brl __local_53
+
bra __local_54
__local_53:
lda.w #0
sta.b tcc__r0
sep #$20
sta -12 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
jmp.w __local_55
__local_54:
lda -16 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda -36 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
brl __local_56
+
lda -18 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
and.w #255
sta.b tcc__r0
sep #$20
sta -12 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
jmp.w __local_57
__local_56:
lda -16 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
stz.b tcc__r1
lda -18 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r2
stz.b tcc__r3
lda.b tcc__r0
sta.b tcc__r9
stz.b tcc__r9h
lda.b tcc__r2
sta.b tcc__r10
stz.b tcc__r10h
jsr.l tcc__mull
stx.b tcc__r4
sty.b tcc__r5
lda.b tcc__r3
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.b tcc__r2
sta.b tcc__r9
lda.b tcc__r1
sta.b tcc__r10
jsr.l tcc__mul
clc
adc.b tcc__r0
clc
adc.b tcc__r4
sta.b tcc__r4
lda -36 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda.w #0
sta.b tcc__r1
pha
pei (tcc__r0)
pei (tcc__r4)
pei (tcc__r5)
jsr.l tcc__udivdi3
tsa
clc
adc #8
tas
lda.w #255
sta.b tcc__r2
stz.b tcc__r3
lda.b tcc__r0
and.b tcc__r2
sta.b tcc__r0
lda.b tcc__r1
and.b tcc__r3
sta.b tcc__r1
sep #$20
lda.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_57:
__local_55:
lda.w #0
sta.b tcc__r0
sep #$20
sta -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_60:
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -10 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_58
+
bra __local_59
__local_73:
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
jmp.w __local_60
__local_59:
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
asl a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -12 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
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
brl __local_61
+
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #0
sep #$20
lda -12 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sec
sbc.b tcc__r0
and.w #255
sta.b tcc__r1
bra __local_62
__local_61:
lda.w #0
sta.b tcc__r0
bra __local_63
__local_62:
lda.b tcc__r1
sta.b tcc__r0
lda.b tcc__r1h
sta.b tcc__r0h
__local_63:
sep #$20
lda.b tcc__r0
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
brl __local_64
+
lda.w #2
sta.b tcc__r0
sep #$20
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_64:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_dir
sta.b tcc__r1h
lda.w #ui_ov_dir + 0
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
brl __local_65
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
dec a
sta.b tcc__r0
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
clc
adc.b tcc__r1
asl a
sta.b tcc__r1
lda.w #:ui_map
sta.b tcc__r0h
lda.w #ui_map + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:ui_ov_bg
sta.b tcc__r2h
lda.w #ui_ov_bg + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sta -40 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r0h
sta -38 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_66
+
bra __local_67
__local_66:
lda.w #0
sta.b tcc__r0
bra __local_68
__local_67:
lda.w #8
sta.b tcc__r0
__local_68:
clc
lda.b tcc__r0
adc.w #106
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:ui_ov_icon
sta.b tcc__r2h
lda.w #ui_ov_icon + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
clc
adc.b tcc__r0
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
ora.w #12288
sta.b tcc__r0
lda -40 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r1
lda -38 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_69
__local_65:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
clc
adc.b tcc__r1
asl a
sta.b tcc__r1
lda.w #:ui_map
sta.b tcc__r0h
lda.w #ui_map + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:ui_ov_bg
sta.b tcc__r2h
lda.w #ui_ov_bg + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sta -44 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r0h
sta -42 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_70
+
bra __local_71
__local_70:
lda.w #0
sta.b tcc__r0
bra __local_72
__local_71:
lda.w #8
sta.b tcc__r0
__local_72:
clc
lda.b tcc__r0
adc.w #106
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:ui_ov_icon
sta.b tcc__r2h
lda.w #ui_ov_icon + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
clc
adc.b tcc__r0
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
ora.w #12288
sta.b tcc__r0
lda -44 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r1
lda -42 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
__local_69:
jmp.w __local_73
__local_58:
jmp.w __local_74
bra __local_75
__local_48:
lda.b tcc__r0
cmp #4
beq +
brl __local_76
+
__local_75:
jmp.w __local_77
bra __local_78
__local_76:
lda.b tcc__r0
cmp #5
beq +
brl __local_79
+
__local_78:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:ui_ov_label
sta.b tcc__r1h
lda.w #ui_ov_label + 0
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
sta -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r0h
sta -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
__local_82:
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
brl __local_80
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
__local_80:
brl __local_81
+
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
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
lda -5 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r2h
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r2
sta.b tcc__r3
lda.b tcc__r2h
sta.b tcc__r3h
inc.b tcc__r2
lda.b tcc__r2
sta -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r2h
sta -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.w #0
sep #$20
lda.b [tcc__r3]
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
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_82
__local_81:
jmp.w __local_83
bra __local_84
__local_79:
lda.b tcc__r0
cmp #6
beq +
brl __local_85
+
__local_84:
lda.w #0
sta.b tcc__r0
sep #$20
sta -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_88:
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_86
+
bra __local_87
__local_92:
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
jmp.w __local_88
__local_87:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
clc
adc.b tcc__r1
asl a
sta.b tcc__r1
lda.w #:ui_map
sta.b tcc__r0h
lda.w #ui_map + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:ui_ov_bg
sta.b tcc__r2h
lda.w #ui_ov_bg + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sta -48 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r0h
sta -46 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_89
+
bra __local_90
__local_89:
lda.w #0
sta.b tcc__r0
bra __local_91
__local_90:
lda.w #8
sta.b tcc__r0
__local_91:
clc
lda.b tcc__r0
adc.w #106
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:ui_ov_icon
sta.b tcc__r2h
lda.w #ui_ov_icon + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
ora.w #12288
sta.b tcc__r0
lda -48 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r1
lda -46 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_92
__local_86:
jmp.w __local_93
bra __local_94
__local_85:
lda.b tcc__r0
cmp #8
beq +
brl __local_95
+
__local_94:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_icon
sta.b tcc__r1h
lda.w #ui_ov_icon + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta -20 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_98:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_96
+
bra __local_97
__local_103:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
jmp.w __local_98
__local_97:
lda.w #0
sta.b tcc__r0
sep #$20
sta -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_101:
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_99
+
bra __local_100
__local_102:
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
jmp.w __local_101
__local_100:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r1
sta.b tcc__r1
lda.w #0
sep #$20
lda -11 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
clc
adc.b tcc__r1
asl a
sta.b tcc__r1
lda.w #:ui_map
sta.b tcc__r0h
lda.w #ui_map + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda -20 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r1
sta.b tcc__r2
lda.b tcc__r1h
sta.b tcc__r2h
inc.b tcc__r1
lda.b tcc__r1
sta -20 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r2
ora.w #12288
sta.b tcc__r2
sta.b [tcc__r0]
jmp.w __local_102
__local_99:
jmp.w __local_103
__local_96:
jmp.w __local_104
bra __local_105
__local_95:
lda.b tcc__r0
cmp #7
beq +
brl __local_106
+
__local_105:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:ui_ov_label
sta.b tcc__r1h
lda.w #ui_ov_label + 0
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
sta -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r0h
sta -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_109:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_107
+
bra __local_108
__local_122:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
jmp.w __local_109
__local_108:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ls_prim + 0
rep #$20
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_110
+
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ls_sel + 0
rep #$20
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq +
dex
+
stx.b tcc__r5
txa
bne +
__local_110:
brl __local_111
+
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
clc
adc.b tcc__r1
asl a
sta.b tcc__r1
lda.w #:ui_map
sta.b tcc__r0h
lda.w #ui_map + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -5 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
clc
adc.w #62
sec
sbc.w #32
ora.w #12288
sta.b tcc__r1
sta.b [tcc__r0]
__local_111:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
inc a
and.w #255
sta.b tcc__r0
sep #$20
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_115:
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
brl __local_112
+
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
ldx #1
sec
sbc #10
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
__local_112:
brl __local_113
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
__local_113:
brl __local_114
+
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r2
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
clc
lda.b tcc__r1
adc.b tcc__r2
asl a
sta.b tcc__r1
lda.w #:ui_map
sta.b tcc__r0h
lda.w #ui_map + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -5 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r2h
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r2
sta.b tcc__r3
lda.b tcc__r2h
sta.b tcc__r3h
inc.b tcc__r2
lda.b tcc__r2
sta -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r2h
sta -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.w #0
sep #$20
lda.b [tcc__r3]
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r2
clc
adc.b tcc__r1
sec
sbc.w #32
ora.w #12288
sta.b tcc__r1
sta.b [tcc__r0]
jmp.w __local_115
__local_114:
__local_118:
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
brl __local_116
+
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
ldx #1
sec
sbc #10
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
__local_116:
brl __local_117
+
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0h
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r0h
sta -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
jmp.w __local_118
__local_117:
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
cmp #10
beq +
brl __local_119
+
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0h
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r0h
sta -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
bra __local_120
__local_119:
bra __local_121
__local_120:
jmp.w __local_122
__local_107:
__local_121:
jmp.w __local_123
bra __local_124
__local_106:
lda.b tcc__r0
cmp #3
beq +
brl __local_125
+
__local_124:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:ui_ov_bg
sta.b tcc__r2h
lda.w #ui_ov_bg + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sta -52 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r0h
sta -50 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_126
+
bra __local_127
__local_126:
lda.w #0
sta.b tcc__r0
bra __local_128
__local_127:
lda.w #8
sta.b tcc__r0
__local_128:
clc
lda.b tcc__r0
adc.w #106
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:ui_ov_icon
sta.b tcc__r2h
lda.w #ui_ov_icon + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
clc
adc.b tcc__r0
ora.w #12288
sta.b tcc__r0
lda -52 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r1
lda -50 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
lda.w #0
sta.b tcc__r0
sep #$20
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_131:
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #:tccs_{WLA_FILENAME}_ov_num
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_ov_num + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda -16 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
lda -16 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
tax
lda.w #10
jsr.l tcc__udiv
lda.b tcc__r9
sta -16 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_129
+
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
__local_129:
brl __local_130
+
jmp.w __local_131
__local_130:
__local_134:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_pad
sta.b tcc__r1h
lda.w #ui_ov_pad + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r2
lda.b tcc__r0
sec
sbc.b tcc__r2
bvc +
eor #$8000
+
bmi +
brl __local_132
+
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
__local_132:
brl __local_133
+
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #:tccs_{WLA_FILENAME}_ov_num
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_ov_num + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda.w #48
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
jmp.w __local_134
__local_133:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
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
brl __local_135
+
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
dec a
and.w #255
sta.b tcc__r0
sep #$20
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_135:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sta.b tcc__r0
sep #$20
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_137:
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_136
+
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
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
lda -5 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r2
dec.b tcc__r2
sep #$20
lda.b tcc__r2
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.b tcc__r2
and.w #255
sta.b tcc__r2
lda.w #:tccs_{WLA_FILENAME}_ov_num
sta.b tcc__r3h
lda.w #tccs_{WLA_FILENAME}_ov_num + 0
clc
adc.b tcc__r2
sta.b tcc__r3
lda.w #0
sep #$20
lda.b [tcc__r3]
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
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_137
__local_136:
jmp.w __local_138
__local_125:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:ui_ov_label
sta.b tcc__r1h
lda.w #ui_ov_label + 0
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
sta -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r0h
sta -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
__local_141:
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
brl __local_139
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
dec a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
__local_139:
brl __local_140
+
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
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
lda -5 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r2h
lda -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r2
sta.b tcc__r3
lda.b tcc__r2h
sta.b tcc__r3h
inc.b tcc__r2
lda.b tcc__r2
sta -24 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.b tcc__r2h
sta -22 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
lda.w #0
sep #$20
lda.b [tcc__r3]
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
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_141
__local_140:
lda.w #0
sta.b tcc__r0
sep #$20
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_144:
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.w #:tccs_{WLA_FILENAME}_ov_num
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_ov_num + 0
clc
adc.b tcc__r1
sta.b tcc__r0
lda -16 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
lda -16 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
tax
lda.w #10
jsr.l tcc__udiv
lda.b tcc__r9
sta -16 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_142
+
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
__local_142:
brl __local_143
+
jmp.w __local_144
__local_143:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_dir
sta.b tcc__r1h
lda.w #ui_ov_dir + 0
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
brl __local_145
+
__local_148:
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_146
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
__local_146:
brl __local_147
+
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
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
lda -5 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r2
dec.b tcc__r2
sep #$20
lda.b tcc__r2
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.b tcc__r2
and.w #255
sta.b tcc__r2
lda.w #:tccs_{WLA_FILENAME}_ov_num
sta.b tcc__r3h
lda.w #tccs_{WLA_FILENAME}_ov_num + 0
clc
adc.b tcc__r2
sta.b tcc__r3
lda.w #0
sep #$20
lda.b [tcc__r3]
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
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_148
__local_147:
jmp.w __local_149
__local_145:
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
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
brl __local_150
+
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_150:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sta.b tcc__r0
sep #$20
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
__local_152:
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_151
+
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda -14 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
clc
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
lda -5 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r2
dec.b tcc__r2
sep #$20
lda.b tcc__r2
sta -9 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
lda.b tcc__r2
and.w #255
sta.b tcc__r2
lda.w #:tccs_{WLA_FILENAME}_ov_num
sta.b tcc__r3h
lda.w #tccs_{WLA_FILENAME}_ov_num + 0
clc
adc.b tcc__r2
sta.b tcc__r3
lda.w #0
sep #$20
lda.b [tcc__r3]
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
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_152
__local_151:
__local_149:
__local_74:
__local_77:
__local_83:
__local_93:
__local_104:
__local_123:
__local_138:
__local_153:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_y
sta.b tcc__r1h
lda.w #ui_ov_y + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_h
sta.b tcc__r2h
lda.w #ui_ov_h + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
pha
rep #$20
lda.w #0
sep #$20
lda.b [tcc__r1]
pha
rep #$20
jsr.l ui_mark
pla
.ifgr __tccs_{WLA_FILENAME}_ov_draw_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_ov_draw_locals
tas
.endif
rtl
.ENDS
.SECTION ".overlay_inittext_0x3" SUPERFREE
overlay_init:
.ifgr __overlay_init_locals 0
tsa
sec
sbc #__overlay_init_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __overlay_init_locals + 1,s
rep #$20
__local_159:
lda.w #4
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_154
+
bra __local_155
__local_154:
lda.w #1
sta.b tcc__r0
bra __local_156
__local_155:
lda.w #4
sta.b tcc__r0
__local_156:
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
rep #$20
sta.b tcc__r1
sec
sbc.b tcc__r0
bvc +
eor #$8000
+
bmi +
brl __local_157
+
bra __local_158
__local_163:
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __overlay_init_locals + 1,s
rep #$20
jmp.w __local_159
__local_158:
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_vis
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_vis + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #4
sta.b tcc__r0
lda.b tcc__r1
sta -8 + __overlay_init_locals + 1,s
lda.b tcc__r1h
sta -6 + __overlay_init_locals + 1,s
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_160
+
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_widget_vis
sta.b tcc__r1h
lda.w #ui_widget_vis + 0
clc
adc.b tcc__r0
sta.b tcc__r1
bra __local_161
__local_160:
lda.w #0
sta.b tcc__r0
bra __local_162
__local_161:
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
__local_162:
lda -8 + __overlay_init_locals + 1,s
sta.b tcc__r1
lda -6 + __overlay_init_locals + 1,s
sta.b tcc__r1h
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
jmp.w __local_163
__local_157:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __overlay_init_locals + 1,s
rep #$20
__local_166:
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #5
bvc +
eor #$8000
+
bmi +
brl __local_164
+
bra __local_165
__local_168:
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __overlay_init_locals + 1,s
rep #$20
bra __local_166
__local_165:
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_last
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_last + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_var
sta.b tcc__r2h
lda.w #ui_ov_var + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r2h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r2
lda.b [tcc__r2]
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_lastm
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_lastm + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
pha
rep #$20
lda.b tcc__r1
sta -11 + __overlay_init_locals + 1,s
lda.b tcc__r1h
sta -9 + __overlay_init_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_ov_max
tsa
clc
adc #1
tas
lda -12 + __overlay_init_locals + 1,s
sta.b tcc__r1
lda -10 + __overlay_init_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_widget
sta.b tcc__r1h
lda.w #ui_ov_widget + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_vis
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_vis + 0
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
brl __local_167
+
lda.w #0
sep #$20
lda -1 + __overlay_init_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_ov_draw
tsa
clc
adc #1
tas
__local_167:
jmp.w __local_168
__local_164:
.ifgr __overlay_init_locals 0
tsa
clc
adc #__overlay_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".overlay_updatetext_0x4" SUPERFREE
overlay_update:
.ifgr __overlay_update_locals 0
tsa
sec
sbc #__overlay_update_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __overlay_update_locals + 1,s
rep #$20
__local_171:
lda.w #0
sep #$20
lda -1 + __overlay_update_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #5
bvc +
eor #$8000
+
bmi +
brl __local_169
+
bra __local_170
__local_173:
__local_178:
lda.w #0
sep #$20
lda -1 + __overlay_update_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __overlay_update_locals + 1,s
rep #$20
bra __local_171
__local_170:
lda.w #0
sep #$20
lda -1 + __overlay_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_type
sta.b tcc__r1h
lda.w #ui_ov_type + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #4
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
brl __local_172
+
jmp.w __local_173
__local_172:
lda.w #0
sep #$20
lda -1 + __overlay_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_var
sta.b tcc__r1h
lda.w #ui_ov_var + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -4 + __overlay_update_locals + 1,s
lda.w #0
sep #$20
lda -1 + __overlay_update_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_ov_max
tsa
clc
adc #1
tas
lda.b tcc__r0
sta -6 + __overlay_update_locals + 1,s
lda.w #0
sep #$20
lda -1 + __overlay_update_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_last
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_last + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -4 + __overlay_update_locals + 1,s
sta.b tcc__r0
lda.b [tcc__r1]
sta.b tcc__r2
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r2
tay
bne +
dex
+
stx.b tcc__r5
txa
beq +
brl __local_174
+
lda.w #0
sep #$20
lda -1 + __overlay_update_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_lastm
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_lastm + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -6 + __overlay_update_locals + 1,s
sta.b tcc__r0
lda.b [tcc__r1]
sta.b tcc__r2
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r2
tay
bne +
dex
+
stx.b tcc__r5
txa
beq +
__local_174:
brl __local_175
+
jmp.w __local_176
__local_175:
lda.w #0
sep #$20
lda -1 + __overlay_update_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_last
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_last + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -4 + __overlay_update_locals + 1,s
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __overlay_update_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_lastm
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_lastm + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -6 + __overlay_update_locals + 1,s
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __overlay_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_widget
sta.b tcc__r1h
lda.w #ui_ov_widget + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_vis
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_vis + 0
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
brl __local_177
+
lda.w #0
sep #$20
lda -1 + __overlay_update_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_ov_draw
tsa
clc
adc #1
tas
__local_177:
__local_176:
jmp.w __local_178
__local_169:
.ifgr __overlay_update_locals 0
tsa
clc
adc #__overlay_update_locals
tas
.endif
rtl
.ENDS
.SECTION ".overlay_refreshtext_0x5" SUPERFREE
overlay_refresh:
.ifgr __overlay_refresh_locals 0
tsa
sec
sbc #__overlay_refresh_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __overlay_refresh_locals + 1,s
rep #$20
__local_181:
lda.w #0
sep #$20
lda -1 + __overlay_refresh_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #5
bvc +
eor #$8000
+
bmi +
brl __local_179
+
bra __local_180
__local_183:
lda.w #0
sep #$20
lda -1 + __overlay_refresh_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __overlay_refresh_locals + 1,s
rep #$20
bra __local_181
__local_180:
lda.w #0
sep #$20
lda -1 + __overlay_refresh_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_widget
sta.b tcc__r1h
lda.w #ui_ov_widget + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_vis
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_vis + 0
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
brl __local_182
+
lda.w #0
sep #$20
lda -1 + __overlay_refresh_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_ov_draw
tsa
clc
adc #1
tas
__local_182:
jmp.w __local_183
__local_179:
.ifgr __overlay_refresh_locals 0
tsa
clc
adc #__overlay_refresh_locals
tas
.endif
rtl
.ENDS
.SECTION ".overlay_showtext_0x6" SUPERFREE
overlay_show:
.ifgr __overlay_show_locals 0
tsa
sec
sbc #__overlay_show_locals
tas
.endif
lda.w #4
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_184
+
bra __local_185
__local_184:
lda.w #1
sta.b tcc__r0
bra __local_186
__local_185:
lda.w #4
sta.b tcc__r0
__local_186:
lda.w #0
sep #$20
lda 3 + __overlay_show_locals + 1,s
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
brl __local_187
+
jmp.w __local_188
__local_187:
lda.w #0
sep #$20
lda 3 + __overlay_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_ov_vis
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_ov_vis + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __overlay_show_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __overlay_show_locals + 1,s
rep #$20
__local_191:
lda.w #0
sep #$20
lda -1 + __overlay_show_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #5
bvc +
eor #$8000
+
bmi +
brl __local_189
+
bra __local_190
__local_193:
__local_196:
lda.w #0
sep #$20
lda -1 + __overlay_show_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __overlay_show_locals + 1,s
rep #$20
bra __local_191
__local_190:
lda.w #0
sep #$20
lda -1 + __overlay_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_widget
sta.b tcc__r1h
lda.w #ui_ov_widget + 0
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
lda 3 + __overlay_show_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_192
+
jmp.w __local_193
__local_192:
lda.w #0
sep #$20
lda 4 + __overlay_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_194
+
lda.w #0
sep #$20
lda -1 + __overlay_show_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_ov_draw
tsa
clc
adc #1
tas
bra __local_195
__local_194:
lda.w #0
sep #$20
lda -1 + __overlay_show_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_ov_erase
tsa
clc
adc #1
tas
__local_195:
jmp.w __local_196
__local_189:
__local_188:
.ifgr __overlay_show_locals 0
tsa
clc
adc #__overlay_show_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_ov_list_counttext_0x7" SUPERFREE
tccs_{WLA_FILENAME}_ov_list_count:
.ifgr __tccs_{WLA_FILENAME}_ov_list_count_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_ov_list_count_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:ui_ov_label
sta.b tcc__r1h
lda.w #ui_ov_label + 0
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
sta -4 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
lda.b tcc__r0h
sta -2 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_h
sta.b tcc__r1h
lda.w #ui_ov_h + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_frame
sta.b tcc__r2h
lda.w #ui_ov_frame + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
asl a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sec
sbc.b tcc__r0
and.w #255
sta.b tcc__r2
sep #$20
sta -5 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
lda.b #1
sta -6 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
rep #$20
lda -4 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
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
brl __local_197
+
bra __local_198
__local_197:
lda.w #0
sta.b tcc__r0
jmp.w __local_199
__local_198:
__local_202:
lda -4 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
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
brl __local_200
+
lda -2 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
sta.b tcc__r0h
lda -4 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
lda.b tcc__r0h
sta -2 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
cmp #10
beq +
brl __local_201
+
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
rep #$20
__local_201:
jmp.w __local_202
__local_200:
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -5 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_203
+
bra __local_204
__local_203:
lda.w #0
sep #$20
lda -5 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_205
__local_204:
lda.w #0
sep #$20
lda -6 + __tccs_{WLA_FILENAME}_ov_list_count_locals + 1,s
rep #$20
sta.b tcc__r0
__local_205:
lda.b tcc__r0
and.w #255
sta.b tcc__r0
__local_199:
__local_206:
.ifgr __tccs_{WLA_FILENAME}_ov_list_count_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_ov_list_count_locals
tas
.endif
rtl
.ENDS
.SECTION ".overlay_list_opentext_0x8" SUPERFREE
overlay_list_open:
.ifgr __overlay_list_open_locals 0
tsa
sec
sbc #__overlay_list_open_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __overlay_list_open_locals + 1,s
rep #$20
__local_209:
lda.w #0
sep #$20
lda -1 + __overlay_list_open_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #5
bvc +
eor #$8000
+
bmi +
brl __local_207
+
bra __local_208
__local_213:
lda.w #0
sep #$20
lda -1 + __overlay_list_open_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __overlay_list_open_locals + 1,s
rep #$20
bra __local_209
__local_208:
lda.w #0
sep #$20
lda -1 + __overlay_list_open_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_type
sta.b tcc__r1h
lda.w #ui_ov_type + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
cmp #7
beq +
brl __local_210
+
lda.w #0
sep #$20
lda -1 + __overlay_list_open_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_widget
sta.b tcc__r1h
lda.w #ui_ov_widget + 0
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
lda 3 + __overlay_list_open_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq +
dex
+
stx.b tcc__r5
txa
bne +
__local_210:
brl __local_211
+
lda.w #0
sep #$20
lda -1 + __overlay_list_open_locals + 1,s
sta.l tccs_{WLA_FILENAME}_ls_prim + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_ls_sel + 0
lda #1
pha
rep #$20
lda.w #0
sep #$20
lda 4 + __overlay_list_open_locals + 1,s
pha
rep #$20
jsr.l overlay_show
pla
lda.w #0
sep #$20
lda -1 + __overlay_list_open_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_ov_list_count
tsa
clc
adc #1
tas
bra __local_212
__local_211:
jmp.w __local_213
__local_207:
lda.w #0
sta.b tcc__r0
__local_212:
__local_214:
.ifgr __overlay_list_open_locals 0
tsa
clc
adc #__overlay_list_open_locals
tas
.endif
rtl
.ENDS
.SECTION ".overlay_list_cursortext_0x9" SUPERFREE
overlay_list_cursor:
.ifgr __overlay_list_cursor_locals 0
tsa
sec
sbc #__overlay_list_cursor_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ls_prim + 0
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_215
+
bra __local_216
__local_215:
lda.w #0
sep #$20
lda 3 + __overlay_list_cursor_locals + 1,s
sta.l tccs_{WLA_FILENAME}_ls_sel + 0
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ls_prim + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_ov_draw
tsa
clc
adc #1
tas
__local_216:
.ifgr __overlay_list_cursor_locals 0
tsa
clc
adc #__overlay_list_cursor_locals
tas
.endif
rtl
.ENDS
.SECTION ".overlay_list_closetext_0xa" SUPERFREE
overlay_list_close:
.ifgr __overlay_list_close_locals 0
tsa
sec
sbc #__overlay_list_close_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ls_prim + 0
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_217
+
jmp.w __local_218
__local_217:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ls_prim + 0
rep #$20
sta.b tcc__r0
lda.w #:ui_ov_widget
sta.b tcc__r1h
lda.w #ui_ov_widget + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -1 + __overlay_list_close_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_ls_prim + 0
sta -2 + __overlay_list_close_locals + 1,s
rep #$20
lda.w #255
sep #$20
sta.l tccs_{WLA_FILENAME}_ls_prim + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __overlay_list_close_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_219
+
lda.w #0
sep #$20
lda -2 + __overlay_list_close_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_ov_draw
tsa
clc
adc #1
tas
bra __local_220
__local_219:
sep #$20
lda #0
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __overlay_list_close_locals + 1,s
pha
rep #$20
jsr.l overlay_show
pla
__local_220:
__local_218:
.ifgr __overlay_list_close_locals 0
tsa
clc
adc #__overlay_list_close_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_ls_prim dsb 1
tccs_{WLA_FILENAME}_ls_sel dsb 1
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $ff
.db $0
.ENDS
.SECTION ".rodata" SUPERFREE
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
tccs_{WLA_FILENAME}_ov_last dsb 10
tccs_{WLA_FILENAME}_ov_lastm dsb 10
tccs_{WLA_FILENAME}_ov_vis dsb 4
tccs_{WLA_FILENAME}_ov_num dsb 5
.ENDS
