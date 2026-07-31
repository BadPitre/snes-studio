.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __picture_active_locals 0
.define __picture_request_locals 0
.define __tccs_{WLA_FILENAME}_pic_fit_locals 2
.define __tccs_{WLA_FILENAME}_pic_place_locals 0
.define __tccs_{WLA_FILENAME}_pic_fade_out_locals 5
.define __tccs_{WLA_FILENAME}_pic_fade_in_locals 5
.define __picture_apply_locals 1
.define __picture_move_locals 2
.define __picture_show_locals 2
.define __picture_hide_locals 2
.define __picture_vblank_locals 0
.define __picture_reset_locals 0
.SECTION ".picture_activetext_0x0" SUPERFREE
picture_active:
.ifgr __picture_active_locals 0
tsa
sec
sbc #__picture_active_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_on + 0
rep #$20
sta.b tcc__r0
__local_0:
.ifgr __picture_active_locals 0
tsa
clc
adc #__picture_active_locals
tas
.endif
rtl
.ENDS
.SECTION ".picture_requesttext_0x1" SUPERFREE
picture_request:
.ifgr __picture_request_locals 0
tsa
sec
sbc #__picture_request_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __picture_request_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_1
+
bra __local_2
__local_1:
lda.w #2
sta.b tcc__r0
bra __local_3
__local_2:
lda.w #1
sta.b tcc__r0
__local_3:
sep #$20
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_pic_req + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __picture_request_locals + 1,s
sta.l tccs_{WLA_FILENAME}_pic_req_id + 0
rep #$20
lda.w #0
sep #$20
lda 5 + __picture_request_locals + 1,s
sta.l tccs_{WLA_FILENAME}_pic_req_x + 0
rep #$20
lda.w #0
sep #$20
lda 6 + __picture_request_locals + 1,s
sta.l tccs_{WLA_FILENAME}_pic_req_y + 0
rep #$20
lda.w #0
sep #$20
lda 7 + __picture_request_locals + 1,s
sta.l tccs_{WLA_FILENAME}_pic_req_fl + 0
rep #$20
lda.w #0
sep #$20
lda 8 + __picture_request_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_pic_req_dur + 0
rep #$20
.ifgr __picture_request_locals 0
tsa
clc
adc #__picture_request_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_pic_fittext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_pic_fit:
.ifgr __tccs_{WLA_FILENAME}_pic_fit_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_pic_fit_locals
tas
.endif
lda 7 + __tccs_{WLA_FILENAME}_pic_fit_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_pic_fit_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta -2 + __tccs_{WLA_FILENAME}_pic_fit_locals + 1,s
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_pic_fit_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_4
+
lda -2 + __tccs_{WLA_FILENAME}_pic_fit_locals + 1,s
sta.b tcc__r0
lsr.b tcc__r0
lda.b tcc__r0
and.w #255
sta.b tcc__r0
bra __local_5
__local_4:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pic_fit_locals + 1,s
rep #$20
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_pic_fit_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_6
++
lda -2 + __tccs_{WLA_FILENAME}_pic_fit_locals + 1,s
and.w #255
sta.b tcc__r0
bra __local_7
__local_6:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pic_fit_locals + 1,s
rep #$20
sta.b tcc__r0
__local_5:
__local_7:
__local_8:
.ifgr __tccs_{WLA_FILENAME}_pic_fit_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_pic_fit_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_pic_placetext_0x3" SUPERFREE
tccs_{WLA_FILENAME}_pic_place:
.ifgr __tccs_{WLA_FILENAME}_pic_place_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_pic_place_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pic_place_locals + 1,s
rep #$20
xba
and #$ff00
sta.l tccs_{WLA_FILENAME}_pic_px8 + 0
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_pic_place_locals + 1,s
rep #$20
xba
and #$ff00
sta.l tccs_{WLA_FILENAME}_pic_py8 + 0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pic_place_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #256
sec
sbc.b tcc__r0
and.w #255
sta.l tccs_{WLA_FILENAME}_pic_hx + 0
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_pic_place_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #256
sec
sbc.b tcc__r0
and.w #255
sta.b tcc__r1
sta.l tccs_{WLA_FILENAME}_pic_vy + 0
.ifgr __tccs_{WLA_FILENAME}_pic_place_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_pic_place_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_pic_fade_outtext_0x4" SUPERFREE
tccs_{WLA_FILENAME}_pic_fade_out:
.ifgr __tccs_{WLA_FILENAME}_pic_fade_out_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_pic_fade_out_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_9
+
bra __local_10
__local_9:
jmp.w __local_11
__local_10:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #3840
sta.b tcc__r1
tax
lda.b tcc__r0
jsr.l tcc__div
lda.b tcc__r9
sta.b tcc__r1
sta -2 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
lda.w #3840
sta -4 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -5 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
rep #$20
__local_14:
lda.w #0
sep #$20
lda -5 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
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
__local_18:
lda.w #0
sep #$20
lda -5 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -5 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
rep #$20
jmp.w __local_14
__local_13:
lda -4 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_15
++
lda -4 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_16
__local_15:
lda.w #0
sta.b tcc__r0
__local_16:
__local_17:
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
jsr.l WaitForVBlank
lda -4 + __tccs_{WLA_FILENAME}_pic_fade_out_locals + 1,s
xba
and #$00ff
and.w #255
sta.b tcc__r0
sep #$20
sta.l 8448
rep #$20
jmp.w __local_18
__local_12:
__local_11:
.ifgr __tccs_{WLA_FILENAME}_pic_fade_out_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_pic_fade_out_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_pic_fade_intext_0x5" SUPERFREE
tccs_{WLA_FILENAME}_pic_fade_in:
.ifgr __tccs_{WLA_FILENAME}_pic_fade_in_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_pic_fade_in_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_19
+
bra __local_20
__local_19:
jmp.w __local_21
__local_20:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #3840
sta.b tcc__r1
tax
lda.b tcc__r0
jsr.l tcc__div
lda.b tcc__r9
sta.b tcc__r1
sta -2 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8448
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -5 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
rep #$20
__local_24:
lda.w #0
sep #$20
lda -5 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_22
+
bra __local_23
__local_26:
lda.w #0
sep #$20
lda -5 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -5 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
rep #$20
jmp.w __local_24
__local_23:
lda -4 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #3840
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_25
+
lda.w #3840
sta.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
__local_25:
jsr.l WaitForVBlank
lda -4 + __tccs_{WLA_FILENAME}_pic_fade_in_locals + 1,s
xba
and #$00ff
and.w #255
sta.b tcc__r0
sep #$20
sta.l 8448
rep #$20
jmp.w __local_26
__local_22:
lda.w #15
sta.b tcc__r0
sep #$20
sta.l 8448
rep #$20
__local_21:
.ifgr __tccs_{WLA_FILENAME}_pic_fade_in_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_pic_fade_in_locals
tas
.endif
rtl
.ENDS
.SECTION ".picture_applytext_0x6" SUPERFREE
picture_apply:
.ifgr __picture_apply_locals 0
tsa
sec
sbc #__picture_apply_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_req + 0
sta -1 + __picture_apply_locals + 1,s
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_pic_req + 0
rep #$20
lda.w #0
sep #$20
lda -1 + __picture_apply_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_27
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_req_id + 0
pha
rep #$20
jsr.l picture_show
tsa
clc
adc #1
tas
bra __local_28
__local_27:
lda.w #0
sep #$20
lda -1 + __picture_apply_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_29
+
jsr.l picture_hide
__local_29:
__local_28:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_30
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_mv_frames + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_30:
brl __local_31
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_mv_frames + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_mv_frames + 0
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_mv_frames + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_32
+
bra __local_33
__local_32:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_mv_tx + 0
rep #$20
xba
and #$ff00
sta.l tccs_{WLA_FILENAME}_pic_px8 + 0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_mv_ty + 0
rep #$20
xba
and #$ff00
sta.b tcc__r0
sta.l tccs_{WLA_FILENAME}_pic_py8 + 0
jmp.w __local_34
__local_33:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_mv_xneg + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_35
+
lda.l tccs_{WLA_FILENAME}_pic_px8 + 0
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_mv_sx + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_36
__local_35:
lda.l tccs_{WLA_FILENAME}_pic_px8 + 0
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_mv_sx + 0
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
__local_36:
__local_37:
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_pic_px8 + 0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_mv_yneg + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_38
+
lda.l tccs_{WLA_FILENAME}_pic_py8 + 0
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_mv_sy + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_39
__local_38:
lda.l tccs_{WLA_FILENAME}_pic_py8 + 0
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_mv_sy + 0
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
__local_39:
__local_40:
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_pic_py8 + 0
__local_34:
lda.l tccs_{WLA_FILENAME}_pic_px8 + 0
xba
and #$00ff
sta.b tcc__r0
lda.w #256
sec
sbc.b tcc__r0
and.w #255
sta.l tccs_{WLA_FILENAME}_pic_hx + 0
lda.l tccs_{WLA_FILENAME}_pic_py8 + 0
xba
and #$00ff
sta.b tcc__r0
lda.w #256
sec
sbc.b tcc__r0
and.w #255
sta.b tcc__r1
sta.l tccs_{WLA_FILENAME}_pic_vy + 0
__local_31:
.ifgr __picture_apply_locals 0
tsa
clc
adc #__picture_apply_locals
tas
.endif
rtl
.ENDS
.SECTION ".picture_movetext_0x7" SUPERFREE
picture_move:
.ifgr __picture_move_locals 0
tsa
sec
sbc #__picture_move_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_41
+
bra __local_42
__local_41:
jmp.w __local_43
__local_42:
lda.w #0
sep #$20
lda 5 + __picture_move_locals + 1,s
rep #$20
and.w #4
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_cur + 0
rep #$20
sta.b tcc__r1
lda.w #:pic_wt
sta.b tcc__r2h
lda.w #pic_wt + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
asl a
asl a
asl a
sta.b tcc__r1
pea.w 256
pei (tcc__r1)
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda 8 + __picture_move_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pic_fit
tsa
clc
adc #6
tas
sep #$20
lda.b tcc__r0
sta 3 + __picture_move_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 5 + __picture_move_locals + 1,s
rep #$20
and.w #4
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_cur + 0
rep #$20
sta.b tcc__r1
lda.w #:pic_ht
sta.b tcc__r2h
lda.w #pic_ht + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
asl a
asl a
asl a
sta.b tcc__r1
pea.w 224
pei (tcc__r1)
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda 9 + __picture_move_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pic_fit
tsa
clc
adc #6
tas
sep #$20
lda.b tcc__r0
sta 4 + __picture_move_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 6 + __picture_move_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_44
+
bra __local_45
__local_44:
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_mv_frames + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __picture_move_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 4 + __picture_move_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pic_place
pla
jmp.w __local_46
__local_45:
lda.w #0
sep #$20
lda 3 + __picture_move_locals + 1,s
sta.l tccs_{WLA_FILENAME}_mv_tx + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __picture_move_locals + 1,s
sta.l tccs_{WLA_FILENAME}_mv_ty + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __picture_move_locals + 1,s
rep #$20
xba
and #$ff00
sta -2 + __picture_move_locals + 1,s
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_pic_px8 + 0
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
brl __local_47
+
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_mv_xneg + 0
rep #$20
lda -2 + __picture_move_locals + 1,s
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_pic_px8 + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda 6 + __picture_move_locals + 1,s
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
sta.b tcc__r0
sta.l tccs_{WLA_FILENAME}_mv_sx + 0
bra __local_48
__local_47:
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_mv_xneg + 0
rep #$20
lda.l tccs_{WLA_FILENAME}_pic_px8 + 0
sta.b tcc__r0
lda -2 + __picture_move_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda 6 + __picture_move_locals + 1,s
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
sta.b tcc__r0
sta.l tccs_{WLA_FILENAME}_mv_sx + 0
__local_48:
lda.w #0
sep #$20
lda 4 + __picture_move_locals + 1,s
rep #$20
xba
and #$ff00
sta -2 + __picture_move_locals + 1,s
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_pic_py8 + 0
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
brl __local_49
+
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_mv_yneg + 0
rep #$20
lda -2 + __picture_move_locals + 1,s
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_pic_py8 + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda 6 + __picture_move_locals + 1,s
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
sta.b tcc__r0
sta.l tccs_{WLA_FILENAME}_mv_sy + 0
bra __local_50
__local_49:
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_mv_yneg + 0
rep #$20
lda.l tccs_{WLA_FILENAME}_pic_py8 + 0
sta.b tcc__r0
lda -2 + __picture_move_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda 6 + __picture_move_locals + 1,s
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
sta.b tcc__r0
sta.l tccs_{WLA_FILENAME}_mv_sy + 0
__local_50:
lda.w #0
sep #$20
lda 6 + __picture_move_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_mv_frames + 0
rep #$20
__local_43:
__local_46:
.ifgr __picture_move_locals 0
tsa
clc
adc #__picture_move_locals
tas
.endif
rtl
.ENDS
.SECTION ".picture_showtext_0x8" SUPERFREE
picture_show:
.ifgr __picture_show_locals 0
tsa
sec
sbc #__picture_show_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __picture_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l pic_count + 0
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
brl __local_51
+
jmp.w __local_52
__local_51:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_req_dur + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pic_fade_out
tsa
clc
adc #1
tas
jsr.l setScreenOff
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_pic_on + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __picture_show_locals + 1,s
sta.l tccs_{WLA_FILENAME}_pic_cur + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_mv_frames + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __picture_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:pic_flags
sta.b tcc__r1h
lda.w #pic_flags + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
and.w #1
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_53
+
bra __local_54
__local_53:
lda.w #5
sta.b tcc__r0
bra __local_55
__local_54:
lda.w #7
sta.b tcc__r0
__local_55:
sep #$20
lda.b tcc__r0
sta.l videoMode + 0
rep #$20
lda.w #0
sep #$20
lda.l videoMode + 0
sta.l 8492
rep #$20
pea.w 16384
sep #$20
lda #0
pha
rep #$20
jsr.l bgSetGfxPtr
tsa
clc
adc #3
tas
sep #$20
lda #0
pha
rep #$20
pea.w 28672
sep #$20
lda #0
pha
rep #$20
jsr.l bgSetMapPtr
tsa
clc
adc #4
tas
lda.w #0
sep #$20
lda 3 + __picture_show_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:pic_chars
sta.b tcc__r1h
lda.w #pic_chars + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __picture_show_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:pic_chars_sizes
sta.b tcc__r2h
lda.w #pic_chars_sizes + 0
clc
adc.b tcc__r0
sta.b tcc__r2
ldy #0
lda.b [tcc__r2],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r2],y
sta.b tcc__r0h
lda.b [tcc__r0]
pha
pea.w 16384
ldy #0
lda.b [tcc__r1],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r1],y
pha
pei (tcc__r0)
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
lda.w #0
sep #$20
lda 3 + __picture_show_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:pic_maps
sta.b tcc__r1h
lda.w #pic_maps + 0
clc
adc.b tcc__r0
sta.b tcc__r1
pea.w 2048
pea.w 28672
ldy #0
lda.b [tcc__r1],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r1],y
pha
pei (tcc__r0)
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
lda.w #0
sep #$20
lda 3 + __picture_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:pic_flags
sta.b tcc__r1h
lda.w #pic_flags + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
and.w #1
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_56
+
lda.w #0
sep #$20
lda 3 + __picture_show_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:pic_pals
sta.b tcc__r1h
lda.w #pic_pals + 0
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
inc.b tcc__r0
inc.b tcc__r0
pea.w 30
pea.w 113
pei (tcc__r0h)
pei (tcc__r0)
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
bra __local_57
__local_56:
lda.w #0
sep #$20
lda 3 + __picture_show_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:pic_pals
sta.b tcc__r1h
lda.w #pic_pals + 0
clc
adc.b tcc__r0
sta.b tcc__r1
pea.w 32
pea.w 0
ldy #0
lda.b [tcc__r1],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r1],y
pha
pei (tcc__r0)
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
__local_57:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_req_fl + 0
rep #$20
and.w #4
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __picture_show_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:pic_wt
sta.b tcc__r2h
lda.w #pic_wt + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
asl a
asl a
asl a
sta.b tcc__r1
pea.w 256
pei (tcc__r1)
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_req_x + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pic_fit
tsa
clc
adc #6
tas
sep #$20
lda.b tcc__r0
sta -1 + __picture_show_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_req_fl + 0
rep #$20
and.w #4
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __picture_show_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:pic_ht
sta.b tcc__r2h
lda.w #pic_ht + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
asl a
asl a
asl a
sta.b tcc__r1
pea.w 224
pei (tcc__r1)
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_req_y + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pic_fit
tsa
clc
adc #6
tas
sep #$20
lda.b tcc__r0
sta -2 + __picture_show_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -2 + __picture_show_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __picture_show_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pic_place
pla
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_req_fl + 0
rep #$20
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
and.w #3
sep #$20
sta -1 + __picture_show_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __picture_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_58
+
lda.w #0
sep #$20
lda -1 + __picture_show_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_59
+
bra __local_60
__local_59:
lda.w #0
sep #$20
lda -1 + __picture_show_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_61
+
bra __local_62
__local_61:
lda.w #129
sta.b tcc__r0
bra __local_63
__local_62:
lda.w #1
sta.b tcc__r0
__local_63:
bra __local_64
__local_60:
lda.w #65
sta.b tcc__r0
__local_64:
sep #$20
lda.b tcc__r0
sta -2 + __picture_show_locals + 1,s
rep #$20
lda.w #2
sep #$20
sta.l 8493
rep #$20
lda.w #2
sep #$20
sta.l 8496
rep #$20
lda.w #0
sep #$20
lda -2 + __picture_show_locals + 1,s
sta.l 8497
rep #$20
lda.w #0
sep #$20
lda -2 + __picture_show_locals + 1,s
pha
lda #2
pha
lda #2
pha
rep #$20
jsr.l screenfx_cm_hold_regs
tsa
clc
adc #3
tas
sep #$20
lda #1
pha
rep #$20
jsr.l screenfx_cm_hold
tsa
clc
adc #1
tas
bra __local_65
__local_58:
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8493
lda #0
pha
rep #$20
jsr.l screenfx_cm_hold
tsa
clc
adc #1
tas
__local_65:
lda.l tccs_{WLA_FILENAME}_pic_vy + 0
pha
lda.l tccs_{WLA_FILENAME}_pic_hx + 0
pha
sep #$20
lda #0
pha
rep #$20
jsr.l bgSetScroll
tsa
clc
adc #5
tas
jsr.l screenfx_warp_reset
jsr.l setScreenOn
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_req_dur + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pic_fade_in
tsa
clc
adc #1
tas
__local_52:
.ifgr __picture_show_locals 0
tsa
clc
adc #__picture_show_locals
tas
.endif
rtl
.ENDS
.SECTION ".picture_hidetext_0x9" SUPERFREE
picture_hide:
.ifgr __picture_hide_locals 0
tsa
sec
sbc #__picture_hide_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_66
+
bra __local_67
__local_66:
jmp.w __local_68
__local_67:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_req_dur + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pic_fade_out
tsa
clc
adc #1
tas
jsr.l setScreenOff
lda.w #0
sep #$20
lda.l scene_ctx + 31
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:sprite_chars
sta.b tcc__r1h
lda.w #sprite_chars + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.l scene_ctx + 31
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:sprite_chars_sizes
sta.b tcc__r2h
lda.w #sprite_chars_sizes + 0
clc
adc.b tcc__r0
sta.b tcc__r2
ldy #0
lda.b [tcc__r2],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r2],y
sta.b tcc__r0h
lda.b [tcc__r0]
pha
pea.w 16384
ldy #0
lda.b [tcc__r1],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r1],y
pha
pei (tcc__r0)
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
jsr.l weather_load
jsr.l vig_reload
lda.w #0
sep #$20
lda.l scene_ctx + 30
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:gfx_pals
sta.b tcc__r1h
lda.w #gfx_pals + 0
clc
adc.b tcc__r0
sta.b tcc__r1
pea.w 256
pea.w 0
ldy #0
lda.b [tcc__r1],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r1],y
pha
pei (tcc__r0)
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __picture_hide_locals + 1,s
pea.w 2
pea.w 0
stz.b tcc__r0h
tsa
clc
adc #(2 + __picture_hide_locals + 1)
pei (tcc__r0h)
pha
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
jsr.l textbox_load_pal
jsr.l effect_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_69
+
jsr.l effect_restore
jmp.w __local_70
__local_69:
pea.w 8192
sep #$20
lda #0
pha
rep #$20
jsr.l bgSetGfxPtr
tsa
clc
adc #3
tas
sep #$20
lda #3
pha
rep #$20
pea.w 0
sep #$20
lda #0
pha
rep #$20
jsr.l bgSetMapPtr
tsa
clc
adc #4
tas
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8493
lda #0
pha
rep #$20
jsr.l screenfx_cm_hold
tsa
clc
adc #1
tas
lda.l camera + 2
pha
lda.l camera + 0
pha
sep #$20
lda #0
pha
rep #$20
jsr.l bgSetScroll
tsa
clc
adc #5
tas
__local_70:
lda.l camera + 2
pha
lda.l camera + 0
pha
sep #$20
lda #1
pha
rep #$20
jsr.l bgSetScroll
tsa
clc
adc #5
tas
lda.w #23
sep #$20
sta.l videoMode + 0
rep #$20
lda.w #23
sep #$20
sta.l 8492
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_pic_on + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_mv_frames + 0
rep #$20
jsr.l screenfx_warp_reset
jsr.l setScreenOn
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_req_dur + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pic_fade_in
tsa
clc
adc #1
tas
__local_68:
.ifgr __picture_hide_locals 0
tsa
clc
adc #__picture_hide_locals
tas
.endif
rtl
.ENDS
.SECTION ".picture_vblanktext_0xa" SUPERFREE
picture_vblank:
.ifgr __picture_vblank_locals 0
tsa
sec
sbc #__picture_vblank_locals
tas
.endif
lda.l tccs_{WLA_FILENAME}_pic_vy + 0
pha
lda.l tccs_{WLA_FILENAME}_pic_hx + 0
pha
sep #$20
lda #0
pha
rep #$20
jsr.l bgSetScroll
tsa
clc
adc #5
tas
.ifgr __picture_vblank_locals 0
tsa
clc
adc #__picture_vblank_locals
tas
.endif
rtl
.ENDS
.SECTION ".picture_resettext_0xb" SUPERFREE
picture_reset:
.ifgr __picture_reset_locals 0
tsa
sec
sbc #__picture_reset_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pic_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_71
+
bra __local_72
__local_71:
bra __local_73
__local_72:
lda.w #23
sep #$20
sta.l videoMode + 0
rep #$20
lda.w #23
sep #$20
sta.l 8492
rep #$20
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8493
lda #0
pha
rep #$20
jsr.l screenfx_cm_hold
tsa
clc
adc #1
tas
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_pic_on + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_mv_frames + 0
rep #$20
__local_73:
.ifgr __picture_reset_locals 0
tsa
clc
adc #__picture_reset_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_pic_on dsb 1
tccs_{WLA_FILENAME}_pic_cur dsb 1
tccs_{WLA_FILENAME}_pic_req dsb 1
tccs_{WLA_FILENAME}_pic_req_id dsb 1
tccs_{WLA_FILENAME}_pic_req_x dsb 1
tccs_{WLA_FILENAME}_pic_req_y dsb 1
tccs_{WLA_FILENAME}_pic_req_fl dsb 1
tccs_{WLA_FILENAME}_pic_req_dur dsb 1
tccs_{WLA_FILENAME}_pic_px8 dsb 2
tccs_{WLA_FILENAME}_pic_py8 dsb 2
tccs_{WLA_FILENAME}_pic_hx dsb 2
tccs_{WLA_FILENAME}_pic_vy dsb 2
tccs_{WLA_FILENAME}_mv_frames dsb 2
tccs_{WLA_FILENAME}_mv_sx dsb 2
tccs_{WLA_FILENAME}_mv_sy dsb 2
tccs_{WLA_FILENAME}_mv_xneg dsb 1
tccs_{WLA_FILENAME}_mv_yneg dsb 1
tccs_{WLA_FILENAME}_mv_tx dsb 1
tccs_{WLA_FILENAME}_mv_ty dsb 1
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0,$0
.db $0,$0
.db $0,$0
.db $0,$0
.db $0,$0
.db $0,$0
.db $0,$0
.db $0
.db $0
.db $0
.db $0
.ENDS
.SECTION ".rodata" SUPERFREE
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
.ENDS
