.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __stage_active_locals 0
.define __stage_busy_locals 0
.define __stage_request_open_locals 0
.define __stage_request_close_locals 0
.define __stage_close_trans_locals 0
.define __stage_take_close_locals 1
.define __stage_reset_locals 0
.define __tccs_{WLA_FILENAME}_sg_trans_regs_locals 0
.define __tccs_{WLA_FILENAME}_sg_fade_out_locals 6
.define __tccs_{WLA_FILENAME}_sg_fade_in_locals 6
.define __tccs_{WLA_FILENAME}_sg_open_locals 3
.define __stage_apply_locals 1
.define __stage_pose_locals 9
.define __stage_slotfx_locals 16
.define __tccs_{WLA_FILENAME}_sg_fx_step_locals 2
.define __stage_clear_locals 0
.define __stage_update_locals 14
.define __stage_vblank_locals 5
.SECTION ".stage_activetext_0x0" SUPERFREE
stage_active:
.ifgr __stage_active_locals 0
tsa
sec
sbc #__stage_active_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_on + 0
rep #$20
sta.b tcc__r0
__local_0:
.ifgr __stage_active_locals 0
tsa
clc
adc #__stage_active_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_busytext_0x1" SUPERFREE
stage_busy:
.ifgr __stage_busy_locals 0
tsa
sec
sbc #__stage_busy_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #0
tay
bne +
dex
+
txa
and.w #255
sta.b tcc__r5
sta.b tcc__r0
lda.b tcc__r5h
sta.b tcc__r0h
__local_1:
.ifgr __stage_busy_locals 0
tsa
clc
adc #__stage_busy_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_request_opentext_0x2" SUPERFREE
stage_request_open:
.ifgr __stage_request_open_locals 0
tsa
sec
sbc #__stage_request_open_locals
tas
.endif
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_sg_req + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_request_open_locals + 1,s
sta.l tccs_{WLA_FILENAME}_sg_req_pic + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __stage_request_open_locals + 1,s
sta.l tccs_{WLA_FILENAME}_sg_req_dur + 0
rep #$20
lda.w #0
sep #$20
lda 5 + __stage_request_open_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_sg_req_trans + 0
rep #$20
.ifgr __stage_request_open_locals 0
tsa
clc
adc #__stage_request_open_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_request_closetext_0x3" SUPERFREE
stage_request_close:
.ifgr __stage_request_close_locals 0
tsa
sec
sbc #__stage_request_close_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_2
+
bra __local_3
__local_2:
bra __local_4
__local_3:
lda.w #2
sep #$20
sta.l tccs_{WLA_FILENAME}_sg_req + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_request_close_locals + 1,s
sta.l tccs_{WLA_FILENAME}_sg_req_dur + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __stage_request_close_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_sg_req_trans + 0
rep #$20
__local_4:
.ifgr __stage_request_close_locals 0
tsa
clc
adc #__stage_request_close_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_close_transtext_0x4" SUPERFREE
stage_close_trans:
.ifgr __stage_close_trans_locals 0
tsa
sec
sbc #__stage_close_trans_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_close_tr + 0
rep #$20
sta.b tcc__r0
__local_5:
.ifgr __stage_close_trans_locals 0
tsa
clc
adc #__stage_close_trans_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_take_closetext_0x5" SUPERFREE
stage_take_close:
.ifgr __stage_take_close_locals 0
tsa
sec
sbc #__stage_take_close_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_close + 0
sta -1 + __stage_take_close_locals + 1,s
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_sg_close + 0
rep #$20
lda.w #0
sep #$20
lda -1 + __stage_take_close_locals + 1,s
rep #$20
sta.b tcc__r0
__local_6:
.ifgr __stage_take_close_locals 0
tsa
clc
adc #__stage_take_close_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_resettext_0x6" SUPERFREE
stage_reset:
.ifgr __stage_reset_locals 0
tsa
sec
sbc #__stage_reset_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_7
+
bra __local_8
__local_7:
jmp.w __local_9
__local_8:
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
sta.l tccs_{WLA_FILENAME}_sg_on + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_sg_req + 0
lda #0
pha
rep #$20
jsr.l vig_hide
tsa
clc
adc #1
tas
sep #$20
lda #1
pha
rep #$20
jsr.l vig_hide
tsa
clc
adc #1
tas
__local_9:
.ifgr __stage_reset_locals 0
tsa
clc
adc #__stage_reset_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_sg_trans_regstext_0x7" SUPERFREE
tccs_{WLA_FILENAME}_sg_trans_regs:
.ifgr __tccs_{WLA_FILENAME}_sg_trans_regs_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_sg_trans_regs_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_sg_trans_regs_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_10
+
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_sg_trans_regs_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #15
sec
sbc.b tcc__r0
asl a
asl a
asl a
asl a
ora.w #7
and.w #255
sta.b tcc__r1
sep #$20
sta.l 8454
rep #$20
__local_10:
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_sg_trans_regs_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l 8448
rep #$20
.ifgr __tccs_{WLA_FILENAME}_sg_trans_regs_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_sg_trans_regs_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_sg_fade_outtext_0x8" SUPERFREE
tccs_{WLA_FILENAME}_sg_fade_out:
.ifgr __tccs_{WLA_FILENAME}_sg_fade_out_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_sg_fade_out_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_11
+
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #1
tay
beq +
dex
+
stx.b tcc__r5
txa
beq +
__local_11:
brl __local_12
+
bra __local_13
__local_12:
jmp.w __local_14
__local_13:
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #3
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
brl __local_15
+
lda.w #1
sta.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
__local_18:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
rep #$20
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
beq ++
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_16
+
bra __local_17
__local_19:
lda -6 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
bra __local_18
__local_17:
jsr.l WaitForVBlank
lda -6 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
sta.b tcc__r0
lda.w #224
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
pha
lda.w #0
sep #$20
lda 6 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
pha
rep #$20
jsr.l screenfx_wipe_step
tsa
clc
adc #3
tas
jmp.w __local_19
__local_16:
jsr.l WaitForVBlank
jsr.l screenfx_wipe_off
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8448
rep #$20
jmp.w __local_20
__local_15:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #3840
sta.b tcc__r1
tax
lda.b tcc__r0
jsr.l tcc__div
lda.b tcc__r9
sta.b tcc__r1
sta -2 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
lda.w #3840
sta -4 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
__local_23:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
rep #$20
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_21
+
bra __local_22
__local_27:
lda -6 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
bra __local_23
__local_22:
lda -4 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_24
++
lda -4 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_25
__local_24:
lda.w #0
sta.b tcc__r0
__local_25:
__local_26:
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
jsr.l WaitForVBlank
lda -4 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
pha
rep #$20
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_sg_fade_out_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_sg_trans_regs
pla
jmp.w __local_27
__local_21:
__local_14:
__local_20:
.ifgr __tccs_{WLA_FILENAME}_sg_fade_out_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_sg_fade_out_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_sg_fade_intext_0x9" SUPERFREE
tccs_{WLA_FILENAME}_sg_fade_in:
.ifgr __tccs_{WLA_FILENAME}_sg_fade_in_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_sg_fade_in_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_28
+
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #1
tay
beq +
dex
+
stx.b tcc__r5
txa
beq +
__local_28:
brl __local_29
+
bra __local_30
__local_29:
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_31
+
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8454
rep #$20
__local_31:
jmp.w __local_32
__local_30:
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #3
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
brl __local_33
+
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8448
rep #$20
pea.w 224
lda.w #0
sep #$20
lda 6 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
pha
rep #$20
jsr.l screenfx_wipe_step
tsa
clc
adc #3
tas
lda.w #1
sta.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
__local_36:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
beq ++
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_34
+
bra __local_35
__local_37:
lda -6 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
bra __local_36
__local_35:
jsr.l WaitForVBlank
lda -6 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
sta.b tcc__r0
lda.w #224
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
sta.b tcc__r0
lda.w #224
sec
sbc.b tcc__r0
pha
lda.w #0
sep #$20
lda 6 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
pha
rep #$20
jsr.l screenfx_wipe_step
tsa
clc
adc #3
tas
jmp.w __local_37
__local_34:
jsr.l WaitForVBlank
jsr.l screenfx_wipe_off
lda.w #15
sta.b tcc__r0
sep #$20
sta.l 8448
rep #$20
jmp.w __local_38
__local_33:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #3840
sta.b tcc__r1
tax
lda.b tcc__r0
jsr.l tcc__div
lda.b tcc__r9
sta.b tcc__r1
sta -2 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8448
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
__local_41:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_39
+
bra __local_40
__local_43:
lda -6 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
bra __local_41
__local_40:
lda -4 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
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
brl __local_42
+
lda.w #3840
sta.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
__local_42:
jsr.l WaitForVBlank
lda -4 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
pha
rep #$20
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_sg_trans_regs
pla
jmp.w __local_43
__local_39:
lda.w #15
sep #$20
sta.l 8448
rep #$20
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_sg_fade_in_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_44
+
jsr.l WaitForVBlank
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8454
rep #$20
__local_44:
__local_32:
__local_38:
.ifgr __tccs_{WLA_FILENAME}_sg_fade_in_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_sg_fade_in_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_sg_opentext_0xa" SUPERFREE
tccs_{WLA_FILENAME}_sg_open:
.ifgr __tccs_{WLA_FILENAME}_sg_open_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_sg_open_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_req_pic + 0
sta -3 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_req_trans + 0
pha
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_req_dur + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_sg_fade_out
pla
jsr.l setScreenOff
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_req_trans + 0
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_45
+
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8454
rep #$20
__local_45:
jsr.l picture_reset
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_sg_on + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
lda.w #1
sta.l tccs_{WLA_FILENAME}_sg_next_char + 0
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
__local_48:
lda -2 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #5
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_46
+
bra __local_47
__local_49:
lda -2 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
bra __local_48
__local_47:
lda.w #:tccs_{WLA_FILENAME}_sl_pic
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_sl_pic + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #:tccs_{WLA_FILENAME}_fx_mode
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_fx_mode + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
jmp.w __local_49
__local_46:
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
__local_52:
lda -2 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #128
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_50
+
bra __local_51
__local_53:
lda -2 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
bra __local_52
__local_51:
lda -2 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
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
bra __local_53
__local_50:
lda.w #23
sep #$20
sta.l videoMode + 0
rep #$20
lda.w #23
sep #$20
sta.l 8492
rep #$20
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
lda #0
pha
rep #$20
pea.w 30720
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
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_sg_zero + 0
pea.w 16
pea.w 8192
pea.w :tccs_{WLA_FILENAME}_sg_zero
pea.w tccs_{WLA_FILENAME}_sg_zero + 0
jsr.l dmaFillVram16
tsa
clc
adc #8
tas
pea.w 1024
pea.w 30720
pea.w :tccs_{WLA_FILENAME}_sg_zero
pea.w tccs_{WLA_FILENAME}_sg_zero + 0
jsr.l dmaFillVram16
tsa
clc
adc #8
tas
pea.w 16384
sep #$20
lda #1
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
lda #1
pha
rep #$20
jsr.l bgSetMapPtr
tsa
clc
adc #4
tas
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l pic_count + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_54
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
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
lda -3 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
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
lda -3 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
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
lda -3 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
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
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_sg_open_locals + 1,s
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
bra __local_55
__local_54:
pea.w 16
pea.w 16384
pea.w :tccs_{WLA_FILENAME}_sg_zero
pea.w tccs_{WLA_FILENAME}_sg_zero + 0
jsr.l dmaFillVram16
tsa
clc
adc #8
tas
pea.w 1024
pea.w 28672
pea.w :tccs_{WLA_FILENAME}_sg_zero
pea.w tccs_{WLA_FILENAME}_sg_zero + 0
jsr.l dmaFillVram16
tsa
clc
adc #8
tas
pea.w 2
pea.w 0
pea.w :tccs_{WLA_FILENAME}_sg_zero
pea.w tccs_{WLA_FILENAME}_sg_zero + 0
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
__local_55:
pea.w 0
pea.w 0
sep #$20
lda #0
pha
rep #$20
jsr.l bgSetScroll
tsa
clc
adc #5
tas
pea.w 0
pea.w 0
sep #$20
lda #1
pha
rep #$20
jsr.l bgSetScroll
tsa
clc
adc #5
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
jsr.l screenfx_warp_reset
jsr.l vig_reload
jsr.l setScreenOn
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_req_trans + 0
pha
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_req_dur + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_sg_fade_in
pla
.ifgr __tccs_{WLA_FILENAME}_sg_open_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_sg_open_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_applytext_0xb" SUPERFREE
stage_apply:
.ifgr __stage_apply_locals 0
tsa
sec
sbc #__stage_apply_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_req + 0
sta -1 + __stage_apply_locals + 1,s
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_sg_req + 0
rep #$20
lda.w #0
sep #$20
lda -1 + __stage_apply_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_56
+
jsr.l tccs_{WLA_FILENAME}_sg_open
jmp.w __local_57
__local_56:
lda.w #0
sep #$20
lda -1 + __stage_apply_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_58
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_58:
brl __local_59
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_req_trans + 0
pha
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_req_dur + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_sg_fade_out
pla
jsr.l setScreenOff
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_req_trans + 0
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_60
+
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8454
rep #$20
__local_60:
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_sg_close + 0
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_req_trans + 0
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_sg_close_tr + 0
rep #$20
__local_59:
__local_57:
.ifgr __stage_apply_locals 0
tsa
clc
adc #__stage_apply_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_posetext_0xc" SUPERFREE
stage_pose:
.ifgr __stage_pose_locals 0
tsa
sec
sbc #__stage_pose_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_61
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
__local_61:
brl __local_62
+
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #5
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
__local_62:
brl __local_63
+
lda.w #0
sep #$20
lda 4 + __stage_pose_locals + 1,s
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
beq +
__local_63:
brl __local_64
+
bra __local_65
__local_64:
jmp.w __local_66
__local_65:
lda.w #0
sep #$20
lda 4 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:pic_wt
sta.b tcc__r1h
lda.w #pic_wt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -3 + __stage_pose_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 4 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:pic_ht
sta.b tcc__r1h
lda.w #pic_ht + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -4 + __stage_pose_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __stage_pose_locals + 1,s
rep #$20
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
brl __local_67
+
lda.w #0
sep #$20
lda -4 + __stage_pose_locals + 1,s
rep #$20
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
__local_67:
brl __local_68
+
bra __local_69
__local_68:
jmp.w __local_70
__local_69:
lda.w #0
sep #$20
lda -3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #32
sec
sbc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 5 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
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
brl __local_71
+
lda.w #0
sep #$20
lda -3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #32
sec
sbc.b tcc__r0
sta.b tcc__r1
sep #$20
sta 5 + __stage_pose_locals + 1,s
rep #$20
__local_71:
lda.w #0
sep #$20
lda -4 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #28
sec
sbc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 6 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
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
brl __local_72
+
lda.w #0
sep #$20
lda -4 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #28
sec
sbc.b tcc__r0
sta.b tcc__r1
sep #$20
sta 6 + __stage_pose_locals + 1,s
rep #$20
__local_72:
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_pic
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_pic + 0
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
lda 4 + __stage_pose_locals + 1,s
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
brl __local_73
+
lda.w #0
sep #$20
lda 4 + __stage_pose_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:pic_chars_sizes
sta.b tcc__r1h
lda.w #pic_chars_sizes + 0
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
lda.b [tcc__r0]
sta.b tcc__r1
ldy.w #5
-
lsr a
dey
bne -
+
sta -2 + __stage_pose_locals + 1,s
lda.l tccs_{WLA_FILENAME}_sg_next_char + 0
sta.b tcc__r0
lda -2 + __stage_pose_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
ldx #1
sec
sbc.w #512
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_74
+
jmp.w __local_75
__local_74:
stz.b tcc__r0
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_up_sent + 0
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_base
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_base + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.l tccs_{WLA_FILENAME}_sg_next_char + 0
sta.b [tcc__r1]
lda.l tccs_{WLA_FILENAME}_sg_next_char + 0
sta.b tcc__r0
lda -2 + __stage_pose_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
sta.l tccs_{WLA_FILENAME}_sg_next_char + 0
bra __local_76
__local_73:
lda.w #3
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
__local_76:
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_x
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_x + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_up_cx + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_y
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_y + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_up_cy + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_pic
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_pic + 0
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
brl __local_77
+
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_pic
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_pic + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #:pic_wt
sta.b tcc__r1h
lda.w #pic_wt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_up_cw + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_pic
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_pic + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #:pic_ht
sta.b tcc__r1h
lda.w #pic_ht + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_ch + 0
rep #$20
bra __local_78
__local_77:
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_ch + 0
rep #$20
__local_78:
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
sta.l tccs_{WLA_FILENAME}_up_slot + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __stage_pose_locals + 1,s
sta.l tccs_{WLA_FILENAME}_up_pic + 0
rep #$20
lda.w #0
sep #$20
lda 5 + __stage_pose_locals + 1,s
sta.l tccs_{WLA_FILENAME}_up_tx + 0
rep #$20
lda.w #0
sep #$20
lda 6 + __stage_pose_locals + 1,s
sta.l tccs_{WLA_FILENAME}_up_ty + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_rows + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_pic
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_pic + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __stage_pose_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_x
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_x + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 5 + __stage_pose_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_y
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_y + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 6 + __stage_pose_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 4 + __stage_pose_locals + 1,s
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
lda.b tcc__r0
sta -8 + __stage_pose_locals + 1,s
lda.b tcc__r0h
sta -6 + __stage_pose_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -9 + __stage_pose_locals + 1,s
rep #$20
__local_81:
lda.w #0
sep #$20
lda -9 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #15
bvc +
eor #$8000
+
bmi +
brl __local_79
+
bra __local_80
__local_82:
lda.w #0
sep #$20
lda -9 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -9 + __stage_pose_locals + 1,s
rep #$20
bra __local_81
__local_80:
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #30
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_sh
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_sh + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -9 + __stage_pose_locals + 1,s
rep #$20
asl a
clc
adc.b tcc__r1
sta.b tcc__r1
lda.w #0
sep #$20
lda -9 + __stage_pose_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda -8 + __stage_pose_locals + 1,s
sta.b tcc__r2
lda -6 + __stage_pose_locals + 1,s
sta.b tcc__r2h
clc
lda.b tcc__r2
adc.b tcc__r0
sta.b tcc__r2
lda.b [tcc__r2]
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_82
__local_79:
lda.w #0
sep #$20
lda 3 + __stage_pose_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_66:
__local_70:
__local_75:
.ifgr __stage_pose_locals 0
tsa
clc
adc #__stage_pose_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_slotfxtext_0xd" SUPERFREE
stage_slotfx:
.ifgr __stage_slotfx_locals 0
tsa
sec
sbc #__stage_slotfx_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_83
+
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #5
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
__local_83:
brl __local_84
+
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_pic
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_pic + 0
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
beq +
dex
+
stx.b tcc__r5
txa
beq +
__local_84:
brl __local_85
+
bra __local_86
__local_85:
jmp.w __local_87
__local_86:
lda.w #0
sep #$20
lda 4 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_88
bra __local_89
__local_88:
lda.b tcc__r0
cmp #1
beq +
brl __local_90
+
__local_89:
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #1
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_t
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_t + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 5 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r1
sta -12 + __stage_slotfx_locals + 1,s
lda.b tcc__r1h
sta -10 + __stage_slotfx_locals + 1,s
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_91
+
bra __local_92
__local_91:
lda.w #6
sta.b tcc__r0
bra __local_93
__local_92:
lda.w #0
sep #$20
lda 5 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
__local_93:
lda -12 + __stage_slotfx_locals + 1,s
sta.b tcc__r1
lda -10 + __stage_slotfx_locals + 1,s
sta.b tcc__r1h
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #1
sta.b tcc__r1
ldy.b tcc__r0
beq +
-
asl a
dey
bne -
+
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
ora.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
jmp.w __local_94
bra __local_95
__local_90:
lda.b tcc__r0
cmp #2
beq +
brl __local_96
+
__local_95:
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #2
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_t
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_t + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 5 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r1
sta -16 + __stage_slotfx_locals + 1,s
lda.b tcc__r1h
sta -14 + __stage_slotfx_locals + 1,s
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_97
+
bra __local_98
__local_97:
lda.w #30
sta.b tcc__r0
bra __local_99
__local_98:
lda.w #0
sep #$20
lda 5 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
__local_99:
lda -16 + __stage_slotfx_locals + 1,s
sta.b tcc__r1
lda -14 + __stage_slotfx_locals + 1,s
sta.b tcc__r1h
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 5 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #5
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
brl __local_100
+
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_per
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_per + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 5 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
tax
lda.w #5
jsr.l tcc__div
lda.b tcc__r9
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
bra __local_101
__local_100:
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_per
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_per + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #1
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_101:
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_cnt
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_cnt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_per
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_fx_per + 0
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
jmp.w __local_102
bra __local_103
__local_96:
lda.b tcc__r0
cmp #3
beq +
brl __local_104
+
__local_103:
lda.w #0
sta.b tcc__r0
sep #$20
sta -5 + __stage_slotfx_locals + 1,s
rep #$20
__local_107:
lda.w #0
sep #$20
lda -5 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #15
bvc +
eor #$8000
+
bmi +
brl __local_105
+
bra __local_106
__local_108:
lda.w #0
sep #$20
lda -5 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -5 + __stage_slotfx_locals + 1,s
rep #$20
bra __local_107
__local_106:
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #30
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_sh
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_sh + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -5 + __stage_slotfx_locals + 1,s
rep #$20
asl a
clc
adc.b tcc__r1
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #30
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_sh
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_sl_sh + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda -5 + __stage_slotfx_locals + 1,s
rep #$20
asl a
clc
adc.b tcc__r2
sta.b tcc__r2
lda.b [tcc__r2]
sta.b tcc__r0
lsr.b tcc__r0
lda.b tcc__r0
and.w #15855
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_108
__local_105:
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #1
sta.b tcc__r1
ldy.b tcc__r0
beq +
-
asl a
dey
bne -
+
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
ora.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
jmp.w __local_109
__local_104:
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_pic
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_pic + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
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
lda.b tcc__r0
sta -4 + __stage_slotfx_locals + 1,s
lda.b tcc__r0h
sta -2 + __stage_slotfx_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -5 + __stage_slotfx_locals + 1,s
rep #$20
__local_112:
lda.w #0
sep #$20
lda -5 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #15
bvc +
eor #$8000
+
bmi +
brl __local_110
+
bra __local_111
__local_113:
lda.w #0
sep #$20
lda -5 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -5 + __stage_slotfx_locals + 1,s
rep #$20
bra __local_112
__local_111:
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #30
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_sh
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_sh + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -5 + __stage_slotfx_locals + 1,s
rep #$20
asl a
clc
adc.b tcc__r1
sta.b tcc__r1
lda.w #0
sep #$20
lda -5 + __stage_slotfx_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda -4 + __stage_slotfx_locals + 1,s
sta.b tcc__r2
lda -2 + __stage_slotfx_locals + 1,s
sta.b tcc__r2h
clc
lda.b tcc__r2
adc.b tcc__r0
sta.b tcc__r2
lda.b [tcc__r2]
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_113
__local_110:
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_slotfx_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #1
sta.b tcc__r1
ldy.b tcc__r0
beq +
-
asl a
dey
bne -
+
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
ora.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
__local_94:
__local_102:
__local_109:
__local_114:
__local_87:
.ifgr __stage_slotfx_locals 0
tsa
clc
adc #__stage_slotfx_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_sg_fx_steptext_0xe" SUPERFREE
tccs_{WLA_FILENAME}_sg_fx_step:
.ifgr __tccs_{WLA_FILENAME}_sg_fx_step_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_sg_fx_step_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
__local_117:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #5
bvc +
eor #$8000
+
bmi +
brl __local_115
+
bra __local_116
__local_120:
__local_137:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
bra __local_117
__local_116:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_mode + 0
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
brl __local_118
+
bra __local_119
__local_118:
jmp.w __local_120
__local_119:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_t
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_t + 0
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
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_121
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_t
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_t + 0
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
brl __local_122
+
jmp.w __local_123
__local_122:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #1
sta.b tcc__r1
ldy.b tcc__r0
beq +
-
asl a
dey
bne -
+
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
ora.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
__local_123:
jmp.w __local_124
__local_121:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_t
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_t + 0
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
brl __local_125
+
jmp.w __local_126
__local_125:
lda.w #0
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
__local_129:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #15
bvc +
eor #$8000
+
bmi +
brl __local_127
+
bra __local_128
__local_130:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
bra __local_129
__local_128:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #30
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_sh
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_sh + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
asl a
clc
adc.b tcc__r1
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_130
__local_127:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #1
sta.b tcc__r1
ldy.b tcc__r0
beq +
-
asl a
dey
bne -
+
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
ora.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
jmp.w __local_131
__local_126:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_cnt
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_cnt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
lda.b tcc__r0
and.w #255
sta.b tcc__r0
cmp #0
beq +
brl __local_132
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_cnt
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_cnt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_per
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_fx_per + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
sta.b [tcc__r1]
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
__local_135:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #15
bvc +
eor #$8000
+
bmi +
brl __local_133
+
bra __local_134
__local_136:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
bra __local_135
__local_134:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #30
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_sh
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_sh + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
asl a
clc
adc.b tcc__r1
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #30
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_sh
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_sl_sh + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
asl a
clc
adc.b tcc__r2
sta.b tcc__r2
lda.b [tcc__r2]
sta.b tcc__r0
lsr.b tcc__r0
lda.b tcc__r0
and.w #15855
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_136
__local_133:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sg_fx_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #1
sta.b tcc__r1
ldy.b tcc__r0
beq +
-
asl a
dey
bne -
+
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
ora.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
__local_132:
__local_131:
__local_124:
jmp.w __local_137
__local_115:
.ifgr __tccs_{WLA_FILENAME}_sg_fx_step_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_sg_fx_step_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_cleartext_0xf" SUPERFREE
stage_clear:
.ifgr __stage_clear_locals 0
tsa
sec
sbc #__stage_clear_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_138
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
__local_138:
brl __local_139
+
lda.w #0
sep #$20
lda 3 + __stage_clear_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #5
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
__local_139:
brl __local_140
+
lda.w #0
sep #$20
lda 3 + __stage_clear_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_pic
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_pic + 0
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
beq +
dex
+
stx.b tcc__r5
txa
beq +
__local_140:
brl __local_141
+
bra __local_142
__local_141:
jmp.w __local_143
__local_142:
lda.w #0
sep #$20
lda 3 + __stage_clear_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_x
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_x + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_up_cx + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_clear_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_y
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_y + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_up_cy + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_clear_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_pic
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_pic + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #:pic_wt
sta.b tcc__r1h
lda.w #pic_wt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_up_cw + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_clear_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_pic
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_pic + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #:pic_ht
sta.b tcc__r1h
lda.w #pic_ht + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_up_ch + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __stage_clear_locals + 1,s
sta.l tccs_{WLA_FILENAME}_up_slot + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
lda.w #5
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
__local_143:
.ifgr __stage_clear_locals 0
tsa
clc
adc #__stage_clear_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_updatetext_0x10" SUPERFREE
stage_update:
.ifgr __stage_update_locals 0
tsa
sec
sbc #__stage_update_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_144
+
jsr.l tccs_{WLA_FILENAME}_sg_fx_step
__local_144:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #4
tay
bne +
dex
+
stx.b tcc__r5
txa
beq +
brl __local_145
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_rows + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
__local_145:
brl __local_146
+
bra __local_147
__local_146:
jmp.w __local_148
__local_147:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_pic + 0
rep #$20
sta.b tcc__r0
lda.w #:pic_wt
sta.b tcc__r1h
lda.w #pic_wt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -11 + __stage_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_slot + 0
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_base
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_base + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -10 + __stage_update_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_slot + 0
rep #$20
inc a
inc a
and.w #255
sep #$20
sta -14 + __stage_update_locals + 1,s
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -12 + __stage_update_locals + 1,s
rep #$20
__local_152:
lda.w #0
sep #$20
lda -12 + __stage_update_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #2
bvc +
eor #$8000
+
bmi +
brl __local_149
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -12 + __stage_update_locals + 1,s
rep #$20
clc
adc.b tcc__r0
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_pic + 0
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
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
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
__local_149:
brl __local_150
+
bra __local_151
__local_157:
lda.w #0
sep #$20
lda -12 + __stage_update_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -12 + __stage_update_locals + 1,s
rep #$20
jmp.w __local_152
__local_151:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_pic + 0
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
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -12 + __stage_update_locals + 1,s
rep #$20
sta.b tcc__r2
clc
adc.b tcc__r0
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
asl a
sta.b tcc__r0
ldy #0
lda.b [tcc__r1],y
sta.b tcc__r2
iny
iny
lda.b [tcc__r1],y
sta.b tcc__r2h
clc
lda.b tcc__r2
adc.b tcc__r0
sta.b tcc__r2
sta -4 + __stage_update_locals + 1,s
lda.b tcc__r2h
sta -2 + __stage_update_locals + 1,s
lda.w #0
sep #$20
lda -12 + __stage_update_locals + 1,s
rep #$20
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_up_buf
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_up_buf + 0
clc
adc.b tcc__r0
sta.b tcc__r1
sta -8 + __stage_update_locals + 1,s
lda.b tcc__r1h
sta -6 + __stage_update_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -13 + __stage_update_locals + 1,s
rep #$20
__local_155:
lda.w #0
sep #$20
lda -13 + __stage_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -11 + __stage_update_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_153
+
bra __local_154
__local_156:
lda.w #0
sep #$20
lda -13 + __stage_update_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -13 + __stage_update_locals + 1,s
rep #$20
jmp.w __local_155
__local_154:
lda -6 + __stage_update_locals + 1,s
sta.b tcc__r0h
lda -8 + __stage_update_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
inc.b tcc__r0
lda.b tcc__r0
sta -8 + __stage_update_locals + 1,s
lda.b tcc__r0h
sta -6 + __stage_update_locals + 1,s
lda -2 + __stage_update_locals + 1,s
sta.b tcc__r0h
lda -4 + __stage_update_locals + 1,s
sta.b tcc__r0
sta.b tcc__r2
lda.b tcc__r0h
sta.b tcc__r2h
inc.b tcc__r0
inc.b tcc__r0
lda.b tcc__r0
sta -4 + __stage_update_locals + 1,s
lda.b tcc__r0h
sta -2 + __stage_update_locals + 1,s
lda.b [tcc__r2]
and.w #1023
sta.b tcc__r0
lda -10 + __stage_update_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda -14 + __stage_update_locals + 1,s
rep #$20
sta.b tcc__r2
ldy.w #10
-
asl a
dey
bne -
+
sta.b tcc__r2
ora.b tcc__r0
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_156
__local_153:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_rows + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_up_rows + 0
rep #$20
jmp.w __local_157
__local_150:
__local_148:
.ifgr __stage_update_locals 0
tsa
clc
adc #__stage_update_locals
tas
.endif
rtl
.ENDS
.SECTION ".stage_vblanktext_0x11" SUPERFREE
stage_vblank:
.ifgr __stage_vblank_locals 0
tsa
sec
sbc #__stage_vblank_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sg_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_158
+
jsr.l screenfx_shake_x
pea.w 0
pei (tcc__r0)
sep #$20
lda #0
pha
rep #$20
jsr.l bgSetScroll
tsa
clc
adc #5
tas
jsr.l screenfx_shake_x
pea.w 0
pei (tcc__r0)
sep #$20
lda #1
pha
rep #$20
jsr.l bgSetScroll
tsa
clc
adc #5
tas
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_159
+
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __stage_vblank_locals + 1,s
__local_162:
lda -2 + __stage_vblank_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #5
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_160
+
bra __local_161
__local_168:
lda -2 + __stage_vblank_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __stage_vblank_locals + 1,s
bra __local_162
__local_161:
lda.w #1
sta.b tcc__r0
lda -2 + __stage_vblank_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
ldy.b tcc__r1
beq +
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
and.b tcc__r0
sta.b tcc__r1
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_163
+
lda -2 + __stage_vblank_locals + 1,s
and.w #255
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_fx_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_fx_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_164
+
bra __local_165
__local_164:
lda -2 + __stage_vblank_locals + 1,s
and.w #255
sta.b tcc__r0
lda.w #30
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sl_sh
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sl_sh + 0
clc
adc.b tcc__r0
sta.b tcc__r1
bra __local_166
__local_165:
lda.w #:tccs_{WLA_FILENAME}_sg_white
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_sg_white + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
__local_166:
lda -2 + __stage_vblank_locals + 1,s
inc a
inc a
asl a
asl a
asl a
asl a
sta.b tcc__r0
inc.b tcc__r0
pea.w 30
pei (tcc__r0)
pei (tcc__r1h)
pei (tcc__r1)
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
lda.w #1
sta.b tcc__r0
lda -2 + __stage_vblank_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
ldy.b tcc__r1
beq +
-
asl a
dey
bne -
+
eor.w #65535
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
and.b tcc__r0
sta.b tcc__r1
sep #$20
sta.l tccs_{WLA_FILENAME}_fx_dirty + 0
rep #$20
bra __local_167
__local_163:
jmp.w __local_168
__local_160:
__local_167:
__local_159:
__local_158:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
sta.b tcc__r0
bra __local_169
bra __local_170
__local_169:
lda.b tcc__r0
cmp #1
beq +
brl __local_171
+
__local_170:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_pic + 0
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:pic_chars_sizes
sta.b tcc__r1h
lda.w #pic_chars_sizes + 0
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
lda.b [tcc__r0]
sta.b tcc__r1
lda.l tccs_{WLA_FILENAME}_up_sent + 0
sta.b tcc__r0
sec
lda.b tcc__r1
sbc.b tcc__r0
sta.b tcc__r1
sta -2 + __stage_vblank_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #1024
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_172
+
lda.w #1024
sta.b tcc__r0
sta -2 + __stage_vblank_locals + 1,s
__local_172:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_pic + 0
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
ldy #0
lda.b [tcc__r1],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r1],y
sta.b tcc__r0h
lda.l tccs_{WLA_FILENAME}_up_sent + 0
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_slot + 0
rep #$20
asl a
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_sl_base
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_sl_base + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.b [tcc__r2]
asl a
asl a
asl a
asl a
clc
adc.w #8192
sta.b tcc__r1
lda.l tccs_{WLA_FILENAME}_up_sent + 0
sta.b tcc__r2
lsr.b tcc__r2
clc
lda.b tcc__r1
adc.b tcc__r2
sta.b tcc__r1
lda -2 + __stage_vblank_locals + 1,s
pha
pei (tcc__r1)
pei (tcc__r0h)
pei (tcc__r0)
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
lda.l tccs_{WLA_FILENAME}_up_sent + 0
sta.b tcc__r0
lda -2 + __stage_vblank_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.l tccs_{WLA_FILENAME}_up_sent + 0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_pic + 0
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:pic_chars_sizes
sta.b tcc__r1h
lda.w #pic_chars_sizes + 0
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
lda.l tccs_{WLA_FILENAME}_up_sent + 0
sta.b tcc__r1
lda.b [tcc__r0]
sta.b tcc__r2
ldx #1
lda.b tcc__r1
sec
sbc.b tcc__r2
tay
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_173
+
lda.w #2
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
__local_173:
jmp.w __local_174
bra __local_175
__local_171:
lda.b tcc__r0
cmp #2
beq +
brl __local_176
+
__local_175:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_pic + 0
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
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_slot + 0
rep #$20
inc a
inc a
asl a
asl a
asl a
asl a
inc a
and.w #255
sta.b tcc__r1
pea.w 30
pei (tcc__r1)
pei (tcc__r0h)
pei (tcc__r0)
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
lda.w #3
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
jmp.w __local_177
bra __local_178
__local_176:
lda.b tcc__r0
cmp #3
beq +
brl __local_179
+
__local_178:
bra __local_180
__local_179:
lda.b tcc__r0
cmp #5
beq +
brl __local_181
+
__local_180:
lda.w #0
sta.b tcc__r0
sep #$20
sta -5 + __stage_vblank_locals + 1,s
rep #$20
__local_185:
lda.w #0
sep #$20
lda -5 + __stage_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #2
bvc +
eor #$8000
+
bmi +
brl __local_182
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_ch + 0
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
bmi +++
++
dex
+++
stx.b tcc__r5
txa
bne +
__local_182:
brl __local_183
+
bra __local_184
__local_186:
lda.w #0
sep #$20
lda -5 + __stage_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -5 + __stage_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
jmp.w __local_185
__local_184:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_cy + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_row + 0
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
clc
adc.w #30720
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_cx + 0
rep #$20
clc
adc.b tcc__r0
sta -4 + __stage_vblank_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_cw + 0
rep #$20
pha
lda -2 + __stage_vblank_locals + 1,s
pha
pea.w :tccs_{WLA_FILENAME}_sg_zero
pea.w tccs_{WLA_FILENAME}_sg_zero + 0
jsr.l dmaFillVram16
tsa
clc
adc #8
tas
jmp.w __local_186
__local_183:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_ch + 0
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
brl __local_187
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
sta.b tcc__r0
cmp #5
beq +
brl __local_188
+
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
bra __local_189
__local_188:
lda.w #4
sep #$20
sta.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_rows + 0
rep #$20
__local_189:
__local_187:
jmp.w __local_190
bra __local_191
__local_181:
lda.b tcc__r0
cmp #4
beq +
brl __local_192
+
__local_191:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_rows + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_193
+
bra __local_194
__local_193:
jmp.w __local_195
__local_194:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_ty + 0
rep #$20
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
clc
adc.w #30720
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_tx + 0
rep #$20
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
sta.b tcc__r1
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r1
clc
adc.b tcc__r0
sta -4 + __stage_vblank_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_pic + 0
rep #$20
sta.b tcc__r0
lda.w #:pic_wt
sta.b tcc__r1h
lda.w #pic_wt + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
asl a
pha
lda -2 + __stage_vblank_locals + 1,s
pha
pea.w :tccs_{WLA_FILENAME}_up_buf
pea.w tccs_{WLA_FILENAME}_up_buf + 0
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_rows + 0
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #1
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
brl __local_196
+
lda -4 + __stage_vblank_locals + 1,s
clc
adc.w #32
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_pic + 0
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
pha
pei (tcc__r0)
pea.w :tccs_{WLA_FILENAME}_up_buf
pea.w tccs_{WLA_FILENAME}_up_buf + 64
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
__local_196:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_rows + 0
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_rows + 0
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_pic + 0
rep #$20
sta.b tcc__r0
lda.w #:pic_ht
sta.b tcc__r1h
lda.w #pic_ht + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_up_row + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r2
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r2
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
brl __local_197
+
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_up_act + 0
rep #$20
__local_197:
__local_192:
__local_174:
__local_177:
__local_190:
__local_195:
__local_198:
.ifgr __stage_vblank_locals 0
tsa
clc
adc #__stage_vblank_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_sg_on dsb 1
tccs_{WLA_FILENAME}_sg_req dsb 1
tccs_{WLA_FILENAME}_sg_req_pic dsb 1
tccs_{WLA_FILENAME}_sg_req_dur dsb 1
tccs_{WLA_FILENAME}_sg_req_trans dsb 1
tccs_{WLA_FILENAME}_sg_close dsb 1
tccs_{WLA_FILENAME}_sg_close_tr dsb 2
tccs_{WLA_FILENAME}_sg_next_char dsb 2
tccs_{WLA_FILENAME}_up_act dsb 1
tccs_{WLA_FILENAME}_up_slot dsb 1
tccs_{WLA_FILENAME}_up_pic dsb 1
tccs_{WLA_FILENAME}_up_tx dsb 1
tccs_{WLA_FILENAME}_up_ty dsb 2
tccs_{WLA_FILENAME}_up_sent dsb 2
tccs_{WLA_FILENAME}_up_row dsb 1
tccs_{WLA_FILENAME}_up_rows dsb 1
tccs_{WLA_FILENAME}_up_cx dsb 1
tccs_{WLA_FILENAME}_up_cy dsb 1
tccs_{WLA_FILENAME}_up_cw dsb 1
tccs_{WLA_FILENAME}_up_ch dsb 1
tccs_{WLA_FILENAME}_sg_zero dsb 2
tccs_{WLA_FILENAME}_fx_dirty dsb 1
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0,$0
.db $1,$0
.db $0
.db $0
.db $0
.db $0
.db $0,$0
.db $0,$0
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0,$0
.db $0
.ENDS
.SECTION ".rodata" SUPERFREE
tccs_{WLA_FILENAME}_sg_white: .db $ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f,$ff,$7f
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
tccs_{WLA_FILENAME}_sl_pic dsb 5
tccs_{WLA_FILENAME}_sl_base dsb 10
tccs_{WLA_FILENAME}_sl_x dsb 5
tccs_{WLA_FILENAME}_sl_y dsb 5
tccs_{WLA_FILENAME}_up_buf dsb 128
tccs_{WLA_FILENAME}_sl_sh dsb 150
tccs_{WLA_FILENAME}_fx_mode dsb 5
tccs_{WLA_FILENAME}_fx_t dsb 5
tccs_{WLA_FILENAME}_fx_per dsb 5
tccs_{WLA_FILENAME}_fx_cnt dsb 5
.ENDS
