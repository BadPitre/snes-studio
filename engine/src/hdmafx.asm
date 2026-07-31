.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __hdmafx_wave_locals 2
.define __hdmafx_update_locals 24
.define __tccs_{WLA_FILENAME}_gr_close_locals 1
.define __tccs_{WLA_FILENAME}_gr_emit_locals 0
.define __tccs_{WLA_FILENAME}_gr_step_locals 0
.define __hdmafx_grad_top_locals 0
.define __hdmafx_grad_bottom_locals 0
.define __hdmafx_grad_locals 22
.define __hdmafx_spot_locals 6
.define __tccs_{WLA_FILENAME}_sp_build_high_locals 24
.define __tccs_{WLA_FILENAME}_sp_build_low_locals 24
.define __hdmafx_vblank_locals 3
.define __hdmafx_suspend_locals 0
.SECTION ".hdmafx_wavetext_0x0" SUPERFREE
hdmafx_wave:
.ifgr __hdmafx_wave_locals 0
tsa
sec
sbc #__hdmafx_wave_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __hdmafx_wave_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #7
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
bra __local_1
__local_0:
lda.w #0
sep #$20
lda 3 + __hdmafx_wave_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_2
__local_1:
lda.w #7
sta.b tcc__r0
__local_2:
sep #$20
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_wv_pow + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __hdmafx_wave_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_3
+
jmp.w __local_4
__local_3:
lda.w #0
sep #$20
lda 4 + __hdmafx_wave_locals + 1,s
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
brl __local_5
+
bra __local_6
__local_5:
lda.w #0
sep #$20
lda 4 + __hdmafx_wave_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_7
__local_6:
lda.w #8
sta.b tcc__r0
__local_7:
bra __local_8
__local_4:
lda.w #1
sta.b tcc__r0
__local_8:
sep #$20
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_wv_spd + 0
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __hdmafx_wave_locals + 1,s
__local_11:
lda -2 + __hdmafx_wave_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #256
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_9
+
bra __local_10
__local_12:
lda -2 + __hdmafx_wave_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __hdmafx_wave_locals + 1,s
bra __local_11
__local_10:
lda.w #:tccs_{WLA_FILENAME}_wv_off
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_wv_off + 0
sta.b tcc__r0
lda -2 + __hdmafx_wave_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda -2 + __hdmafx_wave_locals + 1,s
and.w #63
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_wv_sin
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_wv_sin + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_wv_pow + 0
rep #$20
sta.b tcc__r2
sta.b tcc__r9
lda.b tcc__r1
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r1
ldy.w #5
-
lsr a
dey
bne -
+
and.w #255
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
jmp.w __local_12
__local_9:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_wv_hdr + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_13
+
jmp.w __local_14
__local_13:
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_wv_hdr + 0
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __hdmafx_wave_locals + 1,s
__local_17:
lda -2 + __hdmafx_wave_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #14
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_15
+
bra __local_16
__local_18:
lda -2 + __hdmafx_wave_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __hdmafx_wave_locals + 1,s
bra __local_17
__local_16:
lda -2 + __hdmafx_wave_locals + 1,s
sta.b tcc__r0
asl a
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_wv_t1
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_wv_t1 + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #16
sep #$20
sta.b [tcc__r1]
rep #$20
lda -2 + __hdmafx_wave_locals + 1,s
sta.b tcc__r0
asl a
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_wv_t2
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_wv_t2 + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #16
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_18
__local_15:
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_wv_t1 + 42
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_wv_t2 + 42
rep #$20
__local_14:
.ifgr __hdmafx_wave_locals 0
tsa
clc
adc #__hdmafx_wave_locals
tas
.endif
rtl
.ENDS
.SECTION ".hdmafx_updatetext_0x1" SUPERFREE
hdmafx_update:
.ifgr __hdmafx_update_locals 0
tsa
sec
sbc #__hdmafx_update_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_wv_pow + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_19
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_wv_phase + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_wv_spd + 0
rep #$20
clc
adc.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_wv_phase + 0
rep #$20
jsr.l screenfx_shake_x
lda.l camera + 0
clc
adc.b tcc__r0
sta -12 + __hdmafx_update_locals + 1,s
jsr.l effect_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_20
+
jsr.l effect_hofs
bra __local_21
__local_20:
lda -12 + __hdmafx_update_locals + 1,s
sta.b tcc__r0
__local_21:
__local_22:
lda.b tcc__r0
sta -10 + __hdmafx_update_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_wv_pow + 0
rep #$20
sta.b tcc__r0
lda -10 + __hdmafx_update_locals + 1,s
sec
sbc.b tcc__r0
sta -10 + __hdmafx_update_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_wv_pow + 0
rep #$20
sta.b tcc__r0
lda -12 + __hdmafx_update_locals + 1,s
sec
sbc.b tcc__r0
sta.b tcc__r1
sta -12 + __hdmafx_update_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_wv_phase + 0
rep #$20
sta.b tcc__r0
sep #$20
sta -13 + __hdmafx_update_locals + 1,s
rep #$20
lda.w #:tccs_{WLA_FILENAME}_wv_t1
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_wv_t1 + 1
sta.b tcc__r0
sta -20 + __hdmafx_update_locals + 1,s
lda.b tcc__r0h
sta -18 + __hdmafx_update_locals + 1,s
lda.w #:tccs_{WLA_FILENAME}_wv_t2
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_wv_t2 + 1
sta.b tcc__r0
sta -24 + __hdmafx_update_locals + 1,s
lda.b tcc__r0h
sta -22 + __hdmafx_update_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __hdmafx_update_locals + 1,s
__local_25:
lda -2 + __hdmafx_update_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #14
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_23
+
bra __local_24
__local_26:
lda -2 + __hdmafx_update_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __hdmafx_update_locals + 1,s
bra __local_25
__local_24:
lda.w #0
sep #$20
lda -13 + __hdmafx_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_wv_off
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_wv_off + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta -4 + __hdmafx_update_locals + 1,s
lda -10 + __hdmafx_update_locals + 1,s
sta.b tcc__r0
lda -4 + __hdmafx_update_locals + 1,s
clc
adc.b tcc__r0
sta -6 + __hdmafx_update_locals + 1,s
lda -12 + __hdmafx_update_locals + 1,s
sta.b tcc__r0
lda -4 + __hdmafx_update_locals + 1,s
clc
adc.b tcc__r0
sta -8 + __hdmafx_update_locals + 1,s
lda -20 + __hdmafx_update_locals + 1,s
sta.b tcc__r0
lda -18 + __hdmafx_update_locals + 1,s
sta.b tcc__r0h
lda -6 + __hdmafx_update_locals + 1,s
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -18 + __hdmafx_update_locals + 1,s
sta.b tcc__r0h
lda -20 + __hdmafx_update_locals + 1,s
inc a
sta.b tcc__r0
lda -6 + __hdmafx_update_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -24 + __hdmafx_update_locals + 1,s
sta.b tcc__r0
lda -22 + __hdmafx_update_locals + 1,s
sta.b tcc__r0h
lda -8 + __hdmafx_update_locals + 1,s
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -22 + __hdmafx_update_locals + 1,s
sta.b tcc__r0h
lda -24 + __hdmafx_update_locals + 1,s
inc a
sta.b tcc__r0
lda -8 + __hdmafx_update_locals + 1,s
xba
and #$00ff
and.w #255
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda -20 + __hdmafx_update_locals + 1,s
sta.b tcc__r0
lda -18 + __hdmafx_update_locals + 1,s
clc
lda.b tcc__r0
adc.w #3
sta -20 + __hdmafx_update_locals + 1,s
lda -24 + __hdmafx_update_locals + 1,s
sta.b tcc__r0
lda -22 + __hdmafx_update_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta -24 + __hdmafx_update_locals + 1,s
lda.w #0
sep #$20
lda -13 + __hdmafx_update_locals + 1,s
rep #$20
clc
adc.w #6
sta.b tcc__r0
sep #$20
sta -13 + __hdmafx_update_locals + 1,s
rep #$20
jmp.w __local_26
__local_23:
__local_19:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sp_rad + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_27
+
jsr.l screenfx_spot_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_27:
brl __local_28
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_sp_phase + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_29
+
jsr.l tccs_{WLA_FILENAME}_sp_build_low
bra __local_30
__local_29:
jsr.l tccs_{WLA_FILENAME}_sp_build_high
__local_30:
__local_28:
.ifgr __hdmafx_update_locals 0
tsa
clc
adc #__hdmafx_update_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_gr_closetext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_gr_close:
.ifgr __tccs_{WLA_FILENAME}_gr_close_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_gr_close_locals
tas
.endif
__local_32:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_gr_run + 0
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #127
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
brl __local_31
+
lda.w tccs_{WLA_FILENAME}_gr_cnt + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_gr_cnt + 0
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta -1 + __tccs_{WLA_FILENAME}_gr_close_locals + 1,s
rep #$20
lda.w tccs_{WLA_FILENAME}_gr_cnt + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_gr_cnt + 0 + 2
sta.b tcc__r0h
lda.w #127
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_gr_run + 0
rep #$20
sec
sbc.w #127
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_gr_run + 0
rep #$20
lda.w tccs_{WLA_FILENAME}_gr_q + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_gr_q + 0
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_gr_cnt + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_gr_cnt + 0 + 2
lda.w tccs_{WLA_FILENAME}_gr_q + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_gr_q + 0
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_gr_close_locals + 1,s
rep #$20
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w tccs_{WLA_FILENAME}_gr_q + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_gr_q + 0
inc a
inc a
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_gr_q + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_gr_q + 0 + 2
jmp.w __local_32
__local_31:
lda.w tccs_{WLA_FILENAME}_gr_cnt + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_gr_cnt + 0 + 2
sta.b tcc__r0h
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_gr_run + 0
rep #$20
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_gr_run + 0
rep #$20
.ifgr __tccs_{WLA_FILENAME}_gr_close_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_gr_close_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_gr_emittext_0x3" SUPERFREE
tccs_{WLA_FILENAME}_gr_emit:
.ifgr __tccs_{WLA_FILENAME}_gr_emit_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_gr_emit_locals
tas
.endif
lda.w tccs_{WLA_FILENAME}_gr_cnt + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_gr_cnt + 0 + 2
sta.b tcc__r0h
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_33
+
jsr.l tccs_{WLA_FILENAME}_gr_close
__local_33:
lda.w tccs_{WLA_FILENAME}_gr_q + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_gr_q + 0
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_gr_cnt + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_gr_cnt + 0 + 2
lda.w tccs_{WLA_FILENAME}_gr_q + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_gr_q + 0
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_gr_emit_locals + 1,s
rep #$20
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w tccs_{WLA_FILENAME}_gr_q + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_gr_q + 0
inc a
inc a
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_gr_q + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_gr_q + 0 + 2
.ifgr __tccs_{WLA_FILENAME}_gr_emit_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_gr_emit_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_gr_steptext_0x4" SUPERFREE
tccs_{WLA_FILENAME}_gr_step:
.ifgr __tccs_{WLA_FILENAME}_gr_step_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_gr_step_locals
tas
.endif
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_gr_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_gr_step_locals + 1,s
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
brl __local_34
+
lda 5 + __tccs_{WLA_FILENAME}_gr_step_locals + 1,s
sta.b tcc__r0
lda 7 + __tccs_{WLA_FILENAME}_gr_step_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_gr_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_gr_step_locals + 1,s
rep #$20
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
xba
and #$ff00
sta.b tcc__r0
tax
lda.w #224
jsr.l tcc__udiv
lda.b tcc__r9
sta.b tcc__r0
bra __local_35
__local_34:
lda 5 + __tccs_{WLA_FILENAME}_gr_step_locals + 1,s
sta.b tcc__r0
lda 7 + __tccs_{WLA_FILENAME}_gr_step_locals + 1,s
sta.b tcc__r0h
lda.w #1
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_gr_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_gr_step_locals + 1,s
rep #$20
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
xba
and #$ff00
sta.b tcc__r0
tax
lda.w #224
jsr.l tcc__udiv
lda.b tcc__r9
sta.b tcc__r0
__local_35:
__local_36:
.ifgr __tccs_{WLA_FILENAME}_gr_step_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_gr_step_locals
tas
.endif
rtl
.ENDS
.SECTION ".hdmafx_grad_toptext_0x5" SUPERFREE
hdmafx_grad_top:
.ifgr __hdmafx_grad_top_locals 0
tsa
sec
sbc #__hdmafx_grad_top_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __hdmafx_grad_top_locals + 1,s
rep #$20
and.w #31
sep #$20
sta.l tccs_{WLA_FILENAME}_gr_tr + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __hdmafx_grad_top_locals + 1,s
rep #$20
and.w #31
sep #$20
sta.l tccs_{WLA_FILENAME}_gr_tg + 0
rep #$20
lda.w #0
sep #$20
lda 5 + __hdmafx_grad_top_locals + 1,s
rep #$20
and.w #31
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_gr_tb + 0
rep #$20
.ifgr __hdmafx_grad_top_locals 0
tsa
clc
adc #__hdmafx_grad_top_locals
tas
.endif
rtl
.ENDS
.SECTION ".hdmafx_grad_bottomtext_0x6" SUPERFREE
hdmafx_grad_bottom:
.ifgr __hdmafx_grad_bottom_locals 0
tsa
sec
sbc #__hdmafx_grad_bottom_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __hdmafx_grad_bottom_locals + 1,s
rep #$20
and.w #31
sep #$20
sta.l tccs_{WLA_FILENAME}_gr_br + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __hdmafx_grad_bottom_locals + 1,s
rep #$20
and.w #31
sep #$20
sta.l tccs_{WLA_FILENAME}_gr_bg + 0
rep #$20
lda.w #0
sep #$20
lda 5 + __hdmafx_grad_bottom_locals + 1,s
rep #$20
and.w #31
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_gr_bb + 0
rep #$20
.ifgr __hdmafx_grad_bottom_locals 0
tsa
clc
adc #__hdmafx_grad_bottom_locals
tas
.endif
rtl
.ENDS
.SECTION ".hdmafx_gradtext_0x7" SUPERFREE
hdmafx_grad:
.ifgr __hdmafx_grad_locals 0
tsa
sec
sbc #__hdmafx_grad_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __hdmafx_grad_locals + 1,s
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
brl __local_37
+
lda.w #0
sep #$20
lda 3 + __hdmafx_grad_locals + 1,s
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
beq +
__local_37:
brl __local_38
+
bra __local_39
__local_38:
sep #$20
lda #0
pha
rep #$20
jsr.l screenfx_skygrad
tsa
clc
adc #1
tas
jmp.w __local_40
__local_39:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_gr_tr + 0
rep #$20
xba
and #$ff00
sta -2 + __hdmafx_grad_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_gr_tg + 0
rep #$20
xba
and #$ff00
sta -4 + __hdmafx_grad_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_gr_tb + 0
rep #$20
xba
and #$ff00
sta.b tcc__r0
sta -6 + __hdmafx_grad_locals + 1,s
stz.b tcc__r0h
tsa
clc
adc #(-13 + __hdmafx_grad_locals + 1)
pei (tcc__r0h)
pha
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_gr_br + 0
pha
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_gr_tr + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_gr_step
tsa
clc
adc #6
tas
lda.b tcc__r0
sta -8 + __hdmafx_grad_locals + 1,s
stz.b tcc__r0h
tsa
clc
adc #(-14 + __hdmafx_grad_locals + 1)
pei (tcc__r0h)
pha
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_gr_bg + 0
pha
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_gr_tg + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_gr_step
tsa
clc
adc #6
tas
lda.b tcc__r0
sta -10 + __hdmafx_grad_locals + 1,s
stz.b tcc__r0h
tsa
clc
adc #(-15 + __hdmafx_grad_locals + 1)
pei (tcc__r0h)
pha
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_gr_bb + 0
pha
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_gr_tb + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_gr_step
tsa
clc
adc #6
tas
lda.b tcc__r0
sta -12 + __hdmafx_grad_locals + 1,s
lda.w #:tccs_{WLA_FILENAME}_gr_tab
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_gr_tab + 0
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_gr_q + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_gr_q + 0 + 2
stz.b tcc__r0
stz.b tcc__r0h
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_gr_cnt + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_gr_cnt + 0 + 2
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_gr_run + 0
lda.b #255
sta -16 + __hdmafx_grad_locals + 1,s
lda.b #255
sta -17 + __hdmafx_grad_locals + 1,s
rep #$20
lda.w #255
sep #$20
sta -18 + __hdmafx_grad_locals + 1,s
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta -22 + __hdmafx_grad_locals + 1,s
__local_43:
lda -22 + __hdmafx_grad_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #224
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_41
+
bra __local_42
__local_58:
lda -22 + __hdmafx_grad_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -22 + __hdmafx_grad_locals + 1,s
bra __local_43
__local_42:
lda -2 + __hdmafx_grad_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
sta -19 + __hdmafx_grad_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -19 + __hdmafx_grad_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -16 + __hdmafx_grad_locals + 1,s
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
brl __local_44
+
lda.w #0
sep #$20
lda -19 + __hdmafx_grad_locals + 1,s
rep #$20
ora.w #32
and.w #255
sep #$20
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_gr_emit
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda -19 + __hdmafx_grad_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta -16 + __hdmafx_grad_locals + 1,s
rep #$20
jmp.w __local_45
__local_44:
lda -4 + __hdmafx_grad_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
sta -19 + __hdmafx_grad_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -19 + __hdmafx_grad_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -17 + __hdmafx_grad_locals + 1,s
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
brl __local_46
+
lda.w #0
sep #$20
lda -19 + __hdmafx_grad_locals + 1,s
rep #$20
ora.w #64
and.w #255
sep #$20
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_gr_emit
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda -19 + __hdmafx_grad_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta -17 + __hdmafx_grad_locals + 1,s
rep #$20
jmp.w __local_47
__local_46:
lda -6 + __hdmafx_grad_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
sta -19 + __hdmafx_grad_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -19 + __hdmafx_grad_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -18 + __hdmafx_grad_locals + 1,s
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
brl __local_48
+
lda.w #0
sep #$20
lda -19 + __hdmafx_grad_locals + 1,s
rep #$20
ora.w #128
and.w #255
sep #$20
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_gr_emit
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda -19 + __hdmafx_grad_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta -18 + __hdmafx_grad_locals + 1,s
rep #$20
__local_48:
__local_47:
__local_45:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_gr_run + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_gr_run + 0
rep #$20
lda.w #0
sep #$20
lda -13 + __hdmafx_grad_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_49
+
lda -2 + __hdmafx_grad_locals + 1,s
sta.b tcc__r0
lda -8 + __hdmafx_grad_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_50
__local_49:
lda -2 + __hdmafx_grad_locals + 1,s
sta.b tcc__r0
lda -8 + __hdmafx_grad_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
__local_50:
__local_51:
lda.b tcc__r0
sta -2 + __hdmafx_grad_locals + 1,s
lda.w #0
sep #$20
lda -14 + __hdmafx_grad_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_52
+
lda -4 + __hdmafx_grad_locals + 1,s
sta.b tcc__r0
lda -10 + __hdmafx_grad_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_53
__local_52:
lda -4 + __hdmafx_grad_locals + 1,s
sta.b tcc__r0
lda -10 + __hdmafx_grad_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
__local_53:
__local_54:
lda.b tcc__r0
sta -4 + __hdmafx_grad_locals + 1,s
lda.w #0
sep #$20
lda -15 + __hdmafx_grad_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_55
+
lda -6 + __hdmafx_grad_locals + 1,s
sta.b tcc__r0
lda -12 + __hdmafx_grad_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_56
__local_55:
lda -6 + __hdmafx_grad_locals + 1,s
sta.b tcc__r0
lda -12 + __hdmafx_grad_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
__local_56:
__local_57:
lda.b tcc__r0
sta -6 + __hdmafx_grad_locals + 1,s
jmp.w __local_58
__local_41:
jsr.l tccs_{WLA_FILENAME}_gr_close
lda.w tccs_{WLA_FILENAME}_gr_q + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_gr_q + 0 + 2
sta.b tcc__r0h
lda.w #0
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #0
sep #$20
lda 3 + __hdmafx_grad_locals + 1,s
pha
rep #$20
jsr.l screenfx_skygrad
tsa
clc
adc #1
tas
__local_40:
.ifgr __hdmafx_grad_locals 0
tsa
clc
adc #__hdmafx_grad_locals
tas
.endif
rtl
.ENDS
.SECTION ".hdmafx_spottext_0x8" SUPERFREE
hdmafx_spot:
.ifgr __hdmafx_spot_locals 0
tsa
sec
sbc #__hdmafx_spot_locals
tas
.endif
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_sp_phase + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_59
+
sep #$20
lda #0
pha
rep #$20
jsr.l screenfx_spot
tsa
clc
adc #1
tas
jmp.w __local_60
__local_59:
lda.w #0
sep #$20
lda 3 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #16
bvc +
eor #$8000
+
bmi +
brl __local_61
+
lda.w #16
sta.b tcc__r0
sep #$20
sta 3 + __hdmafx_spot_locals + 1,s
rep #$20
__local_61:
lda.w #0
sep #$20
lda 3 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #96
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
brl __local_62
+
lda.w #96
sta.b tcc__r0
sep #$20
sta 3 + __hdmafx_spot_locals + 1,s
rep #$20
__local_62:
lda.w #0
sep #$20
lda 3 + __hdmafx_spot_locals + 1,s
sta.w tccs_{WLA_FILENAME}_sp_rad + 0
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __hdmafx_spot_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -5 + __hdmafx_spot_locals + 1,s
rep #$20
__local_65:
lda.w #0
sep #$20
lda -5 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_63
+
bra __local_64
__local_66:
lda.w #0
sep #$20
lda -5 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -5 + __hdmafx_spot_locals + 1,s
rep #$20
jmp.w __local_65
__local_64:
lda.w #0
sep #$20
lda 3 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
lda -2 + __hdmafx_spot_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -2 + __hdmafx_spot_locals + 1,s
bra __local_66
__local_63:
lda -2 + __hdmafx_spot_locals + 1,s
sta -4 + __hdmafx_spot_locals + 1,s
lda.w #0
sep #$20
lda 3 + __hdmafx_spot_locals + 1,s
sta -6 + __hdmafx_spot_locals + 1,s
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -5 + __hdmafx_spot_locals + 1,s
rep #$20
__local_69:
lda.w #0
sep #$20
lda -5 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
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
brl __local_67
+
bra __local_68
__local_73:
lda.w #0
sep #$20
lda -5 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -5 + __hdmafx_spot_locals + 1,s
rep #$20
jmp.w __local_69
__local_68:
__local_72:
lda -4 + __hdmafx_spot_locals + 1,s
sta.b tcc__r0
lda -2 + __hdmafx_spot_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_70
++
lda.w #0
sep #$20
lda -6 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_70:
brl __local_71
+
lda.w #0
sep #$20
lda -6 + __hdmafx_spot_locals + 1,s
rep #$20
asl a
dec a
sta.b tcc__r0
lda -4 + __hdmafx_spot_locals + 1,s
sec
sbc.b tcc__r0
sta -4 + __hdmafx_spot_locals + 1,s
lda.w #0
sep #$20
lda -6 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta -6 + __hdmafx_spot_locals + 1,s
rep #$20
jmp.w __local_72
__local_71:
lda.w #0
sep #$20
lda -5 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sp_hw
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sp_hw + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -6 + __hdmafx_spot_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -5 + __hdmafx_spot_locals + 1,s
rep #$20
asl a
inc a
sta.b tcc__r0
lda -2 + __hdmafx_spot_locals + 1,s
sec
sbc.b tcc__r0
sta.b tcc__r1
sta -2 + __hdmafx_spot_locals + 1,s
jmp.w __local_73
__local_67:
lda.w #65535
sta.l tccs_{WLA_FILENAME}_sp_cx + 0
lda.w #65535
sta.l tccs_{WLA_FILENAME}_sp_cy + 0
lda.w #0
sep #$20
lda 4 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_74
+
bra __local_75
__local_74:
lda.w #31
sta.b tcc__r0
bra __local_76
__local_75:
lda.w #0
sep #$20
lda 4 + __hdmafx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
__local_76:
lda.b tcc__r0
and.w #255
sep #$20
pha
rep #$20
jsr.l screenfx_spot
tsa
clc
adc #1
tas
__local_60:
.ifgr __hdmafx_spot_locals 0
tsa
clc
adc #__hdmafx_spot_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_sp_build_hightext_0x9" SUPERFREE
tccs_{WLA_FILENAME}_sp_build_high:
.ifgr __tccs_{WLA_FILENAME}_sp_build_high_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_sp_build_high_locals
tas
.endif
lda.l player + 0
sta.b tcc__r0
lda.l camera + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
clc
adc.w #8
sta -2 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
lda.l player + 2
sta.b tcc__r0
lda.l camera + 2
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
clc
adc.w #12
sta -4 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
lda -2 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_sp_cx + 0
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
brl __local_77
+
lda -4 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_sp_cy + 0
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
__local_77:
brl __local_78
+
jmp.w __local_79
__local_78:
lda -2 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.l tccs_{WLA_FILENAME}_sp_cx + 0
lda -4 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
sta.l tccs_{WLA_FILENAME}_sp_cy + 0
lda.w #:tccs_{WLA_FILENAME}_sp_tab
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_sp_tab + 0
sta.b tcc__r0
sta -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
lda.b tcc__r0h
sta -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sp_rad + 0
rep #$20
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sec
sbc.b tcc__r0
sta.b tcc__r1
sta -6 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
lda -6 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #224
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_80
+
__local_85:
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
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
brl __local_81
+
lda -6 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sta.b tcc__r0
ldx #1
sec
sbc.w #127
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
brl __local_82
+
bra __local_83
__local_82:
lda -6 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sta.b tcc__r0
bra __local_84
__local_83:
lda.w #127
sta.b tcc__r0
__local_84:
sep #$20
lda.b tcc__r0
sta -13 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
inc a
sta.b tcc__r0
lda.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
sta.b [tcc__r0]
rep #$20
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
jmp.w __local_85
__local_81:
__local_80:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sp_rad + 0
rep #$20
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_86
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sp_rad + 0
rep #$20
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
ldx #1
sec
sbc.w #255
tay
beq ++
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
__local_86:
brl __local_87
+
lda -2 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
and.w #255
sep #$20
sta -15 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
lda -4 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sp_hw
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sp_hw + 0
clc
adc.b tcc__r0
sta.b tcc__r1
sta -24 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
lda.b tcc__r1h
sta -22 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
__local_92:
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
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
brl __local_88
+
lda -24 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
sta -14 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
lda -4 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sta.b tcc__r0
ldx #1
sec
sbc.w #2
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
brl __local_89
+
bra __local_90
__local_89:
lda.w #1
sta.b tcc__r0
bra __local_91
__local_90:
lda.w #2
sta.b tcc__r0
__local_91:
sep #$20
lda.b tcc__r0
sta -13 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
sta.b tcc__r0
lda -24 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r1
lda -22 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r1h
sec
lda.b tcc__r1
sbc.b tcc__r0
sta -24 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -15 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda -14 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
sta.b tcc__r2
sec
lda.b tcc__r1
sbc.b tcc__r2
sep #$20
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -15 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda -14 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
sta.b tcc__r2
clc
adc.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
jmp.w __local_92
__local_88:
jmp.w __local_93
__local_87:
__local_100:
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
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
brl __local_94
+
lda -4 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sp_hw
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sp_hw + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -14 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -14 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sec
sbc.b tcc__r0
sta.b tcc__r1
sta -8 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #255
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_95
+
stz.b tcc__r0
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
__local_95:
lda.w #0
sep #$20
lda -14 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -10 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #255
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_96
+
lda.w #255
sta.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
__local_96:
lda -4 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sta.b tcc__r0
ldx #1
sec
sbc.w #2
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
brl __local_97
+
bra __local_98
__local_97:
lda.w #1
sta.b tcc__r0
bra __local_99
__local_98:
lda.w #2
sta.b tcc__r0
__local_99:
sep #$20
lda.b tcc__r0
sta -13 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
inc a
sta.b tcc__r0
lda -8 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
rep #$20
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
jmp.w __local_100
__local_94:
__local_93:
lda -18 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_sp_q + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_sp_q + 0 + 2
lda -12 + __tccs_{WLA_FILENAME}_sp_build_high_locals + 1,s
sta.w tccs_{WLA_FILENAME}_sp_line + 0
lda.w #1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_sp_phase + 0
rep #$20
__local_79:
.ifgr __tccs_{WLA_FILENAME}_sp_build_high_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_sp_build_high_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_sp_build_lowtext_0xa" SUPERFREE
tccs_{WLA_FILENAME}_sp_build_low:
.ifgr __tccs_{WLA_FILENAME}_sp_build_low_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_sp_build_low_locals
tas
.endif
lda.l tccs_{WLA_FILENAME}_sp_cx + 0
sta -2 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
lda.l tccs_{WLA_FILENAME}_sp_cy + 0
sta.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
lda.w tccs_{WLA_FILENAME}_sp_q + 0 + 2
sta.b tcc__r0h
lda.w tccs_{WLA_FILENAME}_sp_q + 0
sta.b tcc__r0
sta -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
lda.b tcc__r0h
sta -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
lda.w tccs_{WLA_FILENAME}_sp_line + 0
sta -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sp_rad + 0
rep #$20
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -6 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #223
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_101
+
lda.w #223
sta.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
__local_101:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sp_rad + 0
rep #$20
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_102
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sp_rad + 0
rep #$20
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
ldx #1
sec
sbc.w #255
tay
beq ++
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
__local_102:
brl __local_103
+
lda -2 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
and.w #255
sta.b tcc__r0
sep #$20
sta -15 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
lda.w #:tccs_{WLA_FILENAME}_sp_hw
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_sp_hw + 0
sta.b tcc__r0
sta -24 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
lda.b tcc__r0h
sta -22 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
__local_108:
lda -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq ++
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_104
+
lda -24 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
sta -14 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
lda -6 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
ldx #1
sec
sbc.w #1
tay
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_105
+
bra __local_106
__local_105:
lda.w #1
sta.b tcc__r0
bra __local_107
__local_106:
lda.w #2
sta.b tcc__r0
__local_107:
sep #$20
lda.b tcc__r0
sta -13 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
sta.b tcc__r0
lda -24 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r1
lda -22 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta -24 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -15 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda -14 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
sta.b tcc__r2
sec
lda.b tcc__r1
sbc.b tcc__r2
sep #$20
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -15 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda -14 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
sta.b tcc__r2
clc
adc.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
jmp.w __local_108
__local_104:
jmp.w __local_109
__local_103:
__local_116:
lda -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq ++
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_110
+
lda -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sp_hw
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sp_hw + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -14 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -14 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sec
sbc.b tcc__r0
sta.b tcc__r1
sta -8 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #255
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_111
+
stz.b tcc__r0
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
__local_111:
lda.w #0
sep #$20
lda -14 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -10 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #255
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_112
+
lda.w #255
sta.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
__local_112:
lda -6 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
ldx #1
sec
sbc.w #1
tay
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_113
+
bra __local_114
__local_113:
lda.w #1
sta.b tcc__r0
bra __local_115
__local_114:
lda.w #2
sta.b tcc__r0
__local_115:
sep #$20
lda.b tcc__r0
sta -13 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
inc a
sta.b tcc__r0
lda -8 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
jmp.w __local_116
__local_110:
__local_109:
__local_121:
lda -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #224
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_117
+
lda.w #224
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sta.b tcc__r0
ldx #1
sec
sbc.w #127
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
brl __local_118
+
bra __local_119
__local_118:
lda.w #224
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
and.w #255
sta.b tcc__r0
bra __local_120
__local_119:
lda.w #127
sta.b tcc__r0
__local_120:
sep #$20
lda.b tcc__r0
sta -13 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
inc a
sta.b tcc__r0
lda.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
sta.b [tcc__r0]
rep #$20
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
lda.w #0
sep #$20
lda -13 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
rep #$20
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -12 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
jmp.w __local_121
__local_117:
lda -20 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_sp_build_low_locals + 1,s
sta.b tcc__r0h
lda.w #0
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_sp_phase + 0
rep #$20
.ifgr __tccs_{WLA_FILENAME}_sp_build_low_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_sp_build_low_locals
tas
.endif
rtl
.ENDS
.SECTION ".hdmafx_vblanktext_0xb" SUPERFREE
hdmafx_vblank:
.ifgr __hdmafx_vblank_locals 0
tsa
sec
sbc #__hdmafx_vblank_locals
tas
.endif
lda.w #0
sep #$20
sta -3 + __hdmafx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_wv_pow + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_122
+
lda.w #2
sep #$20
sta.l 17248
rep #$20
lda.w #13
sep #$20
sta.l 17249
rep #$20
lda.w #:tccs_{WLA_FILENAME}_wv_t1
lda.w #tccs_{WLA_FILENAME}_wv_t1 + 0
sta -2 + __hdmafx_vblank_locals + 1,s
and.w #255
sep #$20
sta.l 17250
rep #$20
lda -2 + __hdmafx_vblank_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
sta.l 17251
rep #$20
lda.w #126
sep #$20
sta.l 17252
rep #$20
lda.w #2
sep #$20
sta.l 17232
rep #$20
lda.w #15
sta.b tcc__r0
sep #$20
sta.l 17233
rep #$20
lda.w #:tccs_{WLA_FILENAME}_wv_t2
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_wv_t2 + 0
sta -2 + __hdmafx_vblank_locals + 1,s
and.w #255
sep #$20
sta.l 17234
rep #$20
lda -2 + __hdmafx_vblank_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
sta.l 17235
rep #$20
lda.w #126
sep #$20
sta.l 17236
rep #$20
lda.w #96
sta.b tcc__r0
sep #$20
sta -3 + __hdmafx_vblank_locals + 1,s
rep #$20
__local_122:
jsr.l screenfx_skygrad_mode
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_123
+
jsr.l screenfx_cm_held
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_124
+
jmp.w __local_125
__local_124:
jsr.l screenfx_flash_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_126
+
jmp.w __local_127
__local_126:
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 17216
rep #$20
lda.w #50
sta.b tcc__r0
sep #$20
sta.l 17217
rep #$20
lda.w #:tccs_{WLA_FILENAME}_gr_tab
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_gr_tab + 0
sta -2 + __hdmafx_vblank_locals + 1,s
and.w #255
sep #$20
sta.l 17218
rep #$20
lda -2 + __hdmafx_vblank_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
sta.l 17219
rep #$20
lda.w #126
sep #$20
sta.l 17220
rep #$20
lda.w #0
sep #$20
lda -3 + __hdmafx_vblank_locals + 1,s
rep #$20
ora.w #16
sta.b tcc__r0
sep #$20
sta -3 + __hdmafx_vblank_locals + 1,s
rep #$20
__local_123:
__local_125:
__local_127:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sp_rad + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_128
+
jsr.l screenfx_spot_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_128:
brl __local_129
+
jsr.l screenfx_cm_held
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_130
+
jmp.w __local_131
__local_130:
lda.w #1
sep #$20
sta.l 17200
rep #$20
lda.w #38
sta.b tcc__r0
sep #$20
sta.l 17201
rep #$20
lda.w #:tccs_{WLA_FILENAME}_sp_tab
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_sp_tab + 0
sta -2 + __hdmafx_vblank_locals + 1,s
and.w #255
sep #$20
sta.l 17202
rep #$20
lda -2 + __hdmafx_vblank_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
sta.l 17203
rep #$20
lda.w #126
sep #$20
sta.l 17204
rep #$20
lda.w #0
sep #$20
lda -3 + __hdmafx_vblank_locals + 1,s
rep #$20
ora.w #8
sta.b tcc__r0
sep #$20
sta -3 + __hdmafx_vblank_locals + 1,s
rep #$20
__local_129:
__local_131:
jsr.l screenfx_wipe_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_132
+
lda.w #0
sep #$20
lda -3 + __hdmafx_vblank_locals + 1,s
rep #$20
ora.w #4
sta.b tcc__r0
sep #$20
sta -3 + __hdmafx_vblank_locals + 1,s
rep #$20
__local_132:
lda.w #0
sep #$20
lda -3 + __hdmafx_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
brl __local_133
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_hx_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
__local_133:
brl __local_134
+
bra __local_135
__local_134:
lda.w #0
sep #$20
lda -3 + __hdmafx_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l 16908
rep #$20
__local_135:
lda.w #0
sep #$20
lda -3 + __hdmafx_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_hx_on + 0
rep #$20
.ifgr __hdmafx_vblank_locals 0
tsa
clc
adc #__hdmafx_vblank_locals
tas
.endif
rtl
.ENDS
.SECTION ".hdmafx_suspendtext_0xc" SUPERFREE
hdmafx_suspend:
.ifgr __hdmafx_suspend_locals 0
tsa
sec
sbc #__hdmafx_suspend_locals
tas
.endif
jsr.l screenfx_wipe_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_136
+
lda.w #4
sep #$20
sta.l 16908
rep #$20
lda.w #4
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_hx_on + 0
rep #$20
bra __local_137
__local_136:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_hx_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_138
+
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 16908
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_hx_on + 0
rep #$20
__local_138:
__local_137:
.ifgr __hdmafx_suspend_locals 0
tsa
clc
adc #__hdmafx_suspend_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_wv_pow dsb 1
tccs_{WLA_FILENAME}_wv_spd dsb 1
tccs_{WLA_FILENAME}_wv_phase dsb 1
tccs_{WLA_FILENAME}_wv_hdr dsb 1
tccs_{WLA_FILENAME}_hx_on dsb 1
tccs_{WLA_FILENAME}_sp_phase dsb 1
tccs_{WLA_FILENAME}_gr_tr dsb 1
tccs_{WLA_FILENAME}_gr_tg dsb 1
tccs_{WLA_FILENAME}_gr_tb dsb 1
tccs_{WLA_FILENAME}_gr_br dsb 1
tccs_{WLA_FILENAME}_gr_bg dsb 1
tccs_{WLA_FILENAME}_gr_bb dsb 1
tccs_{WLA_FILENAME}_sp_cx dsb 2
tccs_{WLA_FILENAME}_sp_cy dsb 2
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $0
.db $1
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0
.db $ff,$ff
.db $ff,$ff
.ENDS
.SECTION ".rodata" SUPERFREE
tccs_{WLA_FILENAME}_wv_sin: .db $20,$23,$26,$29,$2c,$2f,$31,$34,$36,$38,$3a,$3c,$3d,$3e,$3f,$3f,$40,$3f,$3f,$3e,$3d,$3c,$3a,$38,$36,$34,$31,$2f,$2c,$29,$26,$23,$20,$1c,$19,$16,$13,$10,$e,$b,$9,$7,$5,$3,$2,$1,$0,$0,$0,$0,$0,$1,$2,$3,$5,$7,$9,$b,$e,$10,$13,$16,$19,$1c
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
tccs_{WLA_FILENAME}_wv_t1 dsb 43
tccs_{WLA_FILENAME}_wv_t2 dsb 43
tccs_{WLA_FILENAME}_wv_off dsb 256
tccs_{WLA_FILENAME}_sp_rad dsb 1
tccs_{WLA_FILENAME}_gr_tab dsb 256
tccs_{WLA_FILENAME}_gr_q dsb 4
tccs_{WLA_FILENAME}_gr_cnt dsb 4
tccs_{WLA_FILENAME}_gr_run dsb 1
tccs_{WLA_FILENAME}_sp_hw dsb 97
tccs_{WLA_FILENAME}_sp_tab dsb 600
tccs_{WLA_FILENAME}_sp_q dsb 4
tccs_{WLA_FILENAME}_sp_line dsb 2
.ENDS
