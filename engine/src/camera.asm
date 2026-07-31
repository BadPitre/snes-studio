.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_cam_follow_target_locals 8
.define __tccs_{WLA_FILENAME}_cam_step_locals 0
.define __camera_init_locals 0
.define __camera_pan_to_locals 12
.define __camera_return_locals 0
.define __camera_busy_locals 0
.define __camera_update_locals 4
.SECTION ".tccs_{WLA_FILENAME}_cam_follow_targettext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_cam_follow_target:
.ifgr __tccs_{WLA_FILENAME}_cam_follow_target_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_cam_follow_target_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
lda.l player + 0
sta.b tcc__r0
ldx #1
sec
sbc.w #120
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_0
+
lda.l player + 0
sec
sbc.w #120
sta.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
__local_0:
lda.l player + 2
sta.b tcc__r0
ldx #1
sec
sbc.w #104
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_1
+
lda.l player + 2
sec
sbc.w #104
sta.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
__local_1:
lda.w #0
sep #$20
lda.l scene_ctx + 1
rep #$20
asl a
asl a
asl a
asl a
sec
sbc.w #256
sta -2 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
lda.w #0
sep #$20
lda.l scene_ctx + 2
rep #$20
asl a
asl a
asl a
asl a
sec
sbc.w #224
sta -4 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
lda -6 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_2
++
lda -2 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
sta.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
__local_2:
lda -8 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_3
++
lda -4 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
sta.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
__local_3:
lda -6 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
sta.w tccs_{WLA_FILENAME}_cam_fx + 0
lda -8 + __tccs_{WLA_FILENAME}_cam_follow_target_locals + 1,s
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_cam_fy + 0
.ifgr __tccs_{WLA_FILENAME}_cam_follow_target_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_cam_follow_target_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_cam_steptext_0x1" SUPERFREE
tccs_{WLA_FILENAME}_cam_step:
.ifgr __tccs_{WLA_FILENAME}_cam_step_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_cam_step_locals
tas
.endif
lda 3 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_4
+
lda 5 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda 7 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_5
++
lda.w #0
sep #$20
lda 7 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
bra __local_6
__local_5:
lda 5 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sta.b tcc__r0
bra __local_7
__local_6:
lda.b tcc__r1
sta.b tcc__r0
lda.b tcc__r1h
sta.b tcc__r0h
__local_7:
jmp.w __local_8
__local_4:
lda 3 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_9
++
lda 3 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda 7 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_10
++
lda.w #0
sep #$20
lda 7 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sec
sbc.b tcc__r0
sta.b tcc__r1
bra __local_11
__local_10:
lda 5 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sta.b tcc__r0
bra __local_12
__local_11:
lda.b tcc__r1
sta.b tcc__r0
lda.b tcc__r1h
sta.b tcc__r0h
__local_12:
bra __local_13
__local_9:
lda 3 + __tccs_{WLA_FILENAME}_cam_step_locals + 1,s
sta.b tcc__r0
__local_8:
__local_13:
__local_14:
.ifgr __tccs_{WLA_FILENAME}_cam_step_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_cam_step_locals
tas
.endif
rtl
.ENDS
.SECTION ".camera_inittext_0x2" SUPERFREE
camera_init:
.ifgr __camera_init_locals 0
tsa
sec
sbc #__camera_init_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_cam_fx + 0
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_cam_fy + 0
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_cam_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_cam_returning + 0
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_cam_tx + 0
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_cam_ty + 0
lda.w #2
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_cam_speed + 0
rep #$20
.ifgr __camera_init_locals 0
tsa
clc
adc #__camera_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".camera_pan_totext_0x3" SUPERFREE
camera_pan_to:
.ifgr __camera_pan_to_locals 0
tsa
sec
sbc #__camera_pan_to_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta -6 + __camera_pan_to_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -8 + __camera_pan_to_locals + 1,s
lda.w #0
sep #$20
lda 3 + __camera_pan_to_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta -10 + __camera_pan_to_locals + 1,s
lda.w #0
sep #$20
lda 4 + __camera_pan_to_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta -12 + __camera_pan_to_locals + 1,s
lda -10 + __camera_pan_to_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #120
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_15
+
lda -10 + __camera_pan_to_locals + 1,s
sec
sbc.w #120
sta.b tcc__r0
sta -6 + __camera_pan_to_locals + 1,s
__local_15:
lda -12 + __camera_pan_to_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #104
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_16
+
lda -12 + __camera_pan_to_locals + 1,s
sec
sbc.w #104
sta.b tcc__r0
sta -8 + __camera_pan_to_locals + 1,s
__local_16:
lda.w #0
sep #$20
lda.l scene_ctx + 1
rep #$20
asl a
asl a
asl a
asl a
sec
sbc.w #256
sta -2 + __camera_pan_to_locals + 1,s
lda.w #0
sep #$20
lda.l scene_ctx + 2
rep #$20
asl a
asl a
asl a
asl a
sec
sbc.w #224
sta -4 + __camera_pan_to_locals + 1,s
lda -6 + __camera_pan_to_locals + 1,s
sta.b tcc__r0
lda -2 + __camera_pan_to_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_17
++
lda -2 + __camera_pan_to_locals + 1,s
sta.b tcc__r0
sta -6 + __camera_pan_to_locals + 1,s
__local_17:
lda -8 + __camera_pan_to_locals + 1,s
sta.b tcc__r0
lda -4 + __camera_pan_to_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_18
++
lda -4 + __camera_pan_to_locals + 1,s
sta.b tcc__r0
sta -8 + __camera_pan_to_locals + 1,s
__local_18:
lda -6 + __camera_pan_to_locals + 1,s
sta.w tccs_{WLA_FILENAME}_cam_tx + 0
lda -8 + __camera_pan_to_locals + 1,s
sta.w tccs_{WLA_FILENAME}_cam_ty + 0
lda.w #0
sep #$20
lda 5 + __camera_pan_to_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_19
+
bra __local_20
__local_19:
lda.w #1
sta.b tcc__r0
bra __local_21
__local_20:
lda.w #0
sep #$20
lda 5 + __camera_pan_to_locals + 1,s
rep #$20
sta.b tcc__r0
__local_21:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_cam_speed + 0
rep #$20
lda.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_cam_mode + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_cam_returning + 0
rep #$20
.ifgr __camera_pan_to_locals 0
tsa
clc
adc #__camera_pan_to_locals
tas
.endif
rtl
.ENDS
.SECTION ".camera_returntext_0x4" SUPERFREE
camera_return:
.ifgr __camera_return_locals 0
tsa
sec
sbc #__camera_return_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __camera_return_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_22
+
bra __local_23
__local_22:
lda.w #1
sta.b tcc__r0
bra __local_24
__local_23:
lda.w #0
sep #$20
lda 3 + __camera_return_locals + 1,s
rep #$20
sta.b tcc__r0
__local_24:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_cam_speed + 0
rep #$20
lda.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_cam_mode + 0
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_cam_returning + 0
rep #$20
.ifgr __camera_return_locals 0
tsa
clc
adc #__camera_return_locals
tas
.endif
rtl
.ENDS
.SECTION ".camera_busytext_0x5" SUPERFREE
camera_busy:
.ifgr __camera_busy_locals 0
tsa
sec
sbc #__camera_busy_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_cam_mode + 0
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #1
tay
beq +
dex
+
txa
and.w #255
sta.b tcc__r5
sta.b tcc__r0
lda.b tcc__r5h
sta.b tcc__r0h
__local_25:
.ifgr __camera_busy_locals 0
tsa
clc
adc #__camera_busy_locals
tas
.endif
rtl
.ENDS
.SECTION ".camera_updatetext_0x6" SUPERFREE
camera_update:
.ifgr __camera_update_locals 0
tsa
sec
sbc #__camera_update_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_cam_mode + 0
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_26
+
jsr.l tccs_{WLA_FILENAME}_cam_follow_target
lda.w tccs_{WLA_FILENAME}_cam_fx + 0
sta.w camera + 0
lda.w tccs_{WLA_FILENAME}_cam_fy + 0
sta.b tcc__r0
sta.w camera + 2
jmp.w __local_27
__local_26:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_cam_mode + 0
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_28
+
jmp.w __local_29
__local_28:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_cam_returning + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_30
+
jsr.l tccs_{WLA_FILENAME}_cam_follow_target
lda.w tccs_{WLA_FILENAME}_cam_fx + 0
sta.w tccs_{WLA_FILENAME}_cam_tx + 0
lda.w tccs_{WLA_FILENAME}_cam_fy + 0
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_cam_ty + 0
__local_30:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_cam_speed + 0
pha
rep #$20
lda.w tccs_{WLA_FILENAME}_cam_tx + 0
pha
lda.w camera + 0
pha
jsr.l tccs_{WLA_FILENAME}_cam_step
tsa
clc
adc #5
tas
lda.b tcc__r0
sta.w camera + 0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_cam_speed + 0
pha
rep #$20
lda.w tccs_{WLA_FILENAME}_cam_ty + 0
pha
lda.w camera + 2
pha
jsr.l tccs_{WLA_FILENAME}_cam_step
tsa
clc
adc #5
tas
lda.b tcc__r0
sta.w camera + 2
lda.w camera + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_cam_tx + 0
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
brl __local_31
+
lda.w camera + 2
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_cam_ty + 0
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
__local_31:
brl __local_32
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_cam_returning + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_33
+
bra __local_34
__local_33:
lda.w #2
sta.b tcc__r0
bra __local_35
__local_34:
lda.w #0
sta.b tcc__r0
__local_35:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_cam_mode + 0
rep #$20
__local_32:
__local_27:
__local_29:
.ifgr __camera_update_locals 0
tsa
clc
adc #__camera_update_locals
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
camera dsb 4
tccs_{WLA_FILENAME}_cam_mode dsb 1
tccs_{WLA_FILENAME}_cam_returning dsb 1
tccs_{WLA_FILENAME}_cam_tx dsb 2
tccs_{WLA_FILENAME}_cam_ty dsb 2
tccs_{WLA_FILENAME}_cam_speed dsb 1
tccs_{WLA_FILENAME}_cam_fx dsb 2
tccs_{WLA_FILENAME}_cam_fy dsb 2
.ENDS
