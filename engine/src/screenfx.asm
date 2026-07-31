.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __screenfx_init_locals 0
.define __screenfx_cm_hold_regs_locals 0
.define __screenfx_cm_hold_locals 0
.define __screenfx_cm_held_locals 0
.define __screenfx_warp_reset_locals 0
.define __screenfx_hide_locals 0
.define __screenfx_show_locals 0
.define __screenfx_busy_locals 0
.define __screenfx_tint_rgb_locals 0
.define __screenfx_tint_locals 0
.define __screenfx_skygrad_locals 0
.define __screenfx_spot_locals 0
.define __screenfx_spot_active_locals 0
.define __screenfx_skygrad_mode_locals 0
.define __screenfx_flash_active_locals 0
.define __tccs_{WLA_FILENAME}_tg_step_locals 4
.define __tccs_{WLA_FILENAME}_tg_launch_locals 0
.define __screenfx_tintg_rgb_locals 0
.define __screenfx_tintg_locals 1
.define __screenfx_flash_locals 0
.define __screenfx_flash_start_locals 0
.define __screenfx_shake_locals 0
.define __screenfx_shake_x_locals 2
.define __screenfx_wipe_active_locals 0
.define __tccs_{WLA_FILENAME}_wp_band_locals 1
.define __screenfx_wipe_step_locals 8
.define __screenfx_wipe_off_locals 0
.define __screenfx_update_locals 0
.define __screenfx_vblank_locals 6
.SECTION ".screenfx_inittext_0x0" SUPERFREE
screenfx_init:
.ifgr __screenfx_init_locals 0
tsa
sec
sbc #__screenfx_init_locals
tas
.endif
lda.w #3840
sta.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
lda.w #3840
sta.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
lda.w #3840
sta.w tccs_{WLA_FILENAME}_fade_step + 0
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_fade_dirty + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_fade_fx + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_mos_fix + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_r + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_g + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_b + 0
rep #$20
lda.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_cm_dirty + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_flash_r + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_flash_g + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_flash_b + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
lda.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_flash_dur + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_power + 0
rep #$20
lda.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_speed + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_frames + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_phase + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_tick + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_grad_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_spot_dark + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_left + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_phase2 + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_tr + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_tg + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_tb + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_fr + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_fg + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_fb + 0
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_r8 + 0
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_g8 + 0
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_b8 + 0
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_sr + 0
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_sg + 0
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_sb + 0
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_rn + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_gn + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_bn + 0
rep #$20
.ifgr __screenfx_init_locals 0
tsa
clc
adc #__screenfx_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_cm_hold_regstext_0x1" SUPERFREE
screenfx_cm_hold_regs:
.ifgr __screenfx_cm_hold_regs_locals 0
tsa
sec
sbc #__screenfx_cm_hold_regs_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __screenfx_cm_hold_regs_locals + 1,s
sta.l tccs_{WLA_FILENAME}_hold_ts + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __screenfx_cm_hold_regs_locals + 1,s
sta.l tccs_{WLA_FILENAME}_hold_wsel + 0
rep #$20
lda.w #0
sep #$20
lda 5 + __screenfx_cm_hold_regs_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_hold_adsub + 0
rep #$20
.ifgr __screenfx_cm_hold_regs_locals 0
tsa
clc
adc #__screenfx_cm_hold_regs_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_cm_holdtext_0x2" SUPERFREE
screenfx_cm_hold:
.ifgr __screenfx_cm_hold_locals 0
tsa
sec
sbc #__screenfx_cm_hold_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __screenfx_cm_hold_locals + 1,s
sta.l tccs_{WLA_FILENAME}_cm_hold + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __screenfx_cm_hold_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_0
+
bra __local_1
__local_0:
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_cm_dirty + 0
rep #$20
__local_1:
.ifgr __screenfx_cm_hold_locals 0
tsa
clc
adc #__screenfx_cm_hold_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_cm_heldtext_0x3" SUPERFREE
screenfx_cm_held:
.ifgr __screenfx_cm_held_locals 0
tsa
sec
sbc #__screenfx_cm_held_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_cm_hold + 0
rep #$20
sta.b tcc__r0
__local_2:
.ifgr __screenfx_cm_held_locals 0
tsa
clc
adc #__screenfx_cm_held_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_warp_resettext_0x4" SUPERFREE
screenfx_warp_reset:
.ifgr __screenfx_warp_reset_locals 0
tsa
sec
sbc #__screenfx_warp_reset_locals
tas
.endif
lda.w #3840
sta.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
lda.w #3840
sta.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_fade_dirty + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_fade_fx + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_mos_fix + 0
rep #$20
jsr.l screenfx_wipe_off
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_power + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_frames + 0
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_cm_dirty + 0
rep #$20
.ifgr __screenfx_warp_reset_locals 0
tsa
clc
adc #__screenfx_warp_reset_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_hidetext_0x5" SUPERFREE
screenfx_hide:
.ifgr __screenfx_hide_locals 0
tsa
sec
sbc #__screenfx_hide_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
lda.w #0
sep #$20
lda 4 + __screenfx_hide_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_3
+
bra __local_4
__local_3:
lda.w #0
sep #$20
lda 3 + __screenfx_hide_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_5
+
bra __local_6
__local_5:
lda.w #1
sta.b tcc__r0
bra __local_7
__local_6:
lda.w #0
sep #$20
lda 3 + __screenfx_hide_locals + 1,s
rep #$20
sta.b tcc__r0
__local_7:
lda.w #3840
sta.b tcc__r1
tax
lda.b tcc__r0
jsr.l tcc__div
lda.b tcc__r9
sta.b tcc__r1
bra __local_8
__local_4:
lda.w #3840
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
__local_8:
lda.b tcc__r1
sta.w tccs_{WLA_FILENAME}_fade_step + 0
lda.w #0
sep #$20
lda 4 + __screenfx_hide_locals + 1,s
sta.w tccs_{WLA_FILENAME}_fade_fx + 0
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_mos_fix + 0
rep #$20
.ifgr __screenfx_hide_locals 0
tsa
clc
adc #__screenfx_hide_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_showtext_0x6" SUPERFREE
screenfx_show:
.ifgr __screenfx_show_locals 0
tsa
sec
sbc #__screenfx_show_locals
tas
.endif
lda.w #3840
sta.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
lda.w #0
sep #$20
lda 4 + __screenfx_show_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_9
+
bra __local_10
__local_9:
lda.w #0
sep #$20
lda 3 + __screenfx_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_11
+
bra __local_12
__local_11:
lda.w #1
sta.b tcc__r0
bra __local_13
__local_12:
lda.w #0
sep #$20
lda 3 + __screenfx_show_locals + 1,s
rep #$20
sta.b tcc__r0
__local_13:
lda.w #3840
sta.b tcc__r1
tax
lda.b tcc__r0
jsr.l tcc__div
lda.b tcc__r9
sta.b tcc__r1
bra __local_14
__local_10:
lda.w #3840
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
__local_14:
lda.b tcc__r1
sta.w tccs_{WLA_FILENAME}_fade_step + 0
lda.w #0
sep #$20
lda 4 + __screenfx_show_locals + 1,s
sta.w tccs_{WLA_FILENAME}_fade_fx + 0
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_mos_fix + 0
rep #$20
.ifgr __screenfx_show_locals 0
tsa
clc
adc #__screenfx_show_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_busytext_0x7" SUPERFREE
screenfx_busy:
.ifgr __screenfx_busy_locals 0
tsa
sec
sbc #__screenfx_busy_locals
tas
.endif
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
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
__local_15:
.ifgr __screenfx_busy_locals 0
tsa
clc
adc #__screenfx_busy_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_tint_rgbtext_0x8" SUPERFREE
screenfx_tint_rgb:
.ifgr __screenfx_tint_rgb_locals 0
tsa
sec
sbc #__screenfx_tint_rgb_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __screenfx_tint_rgb_locals + 1,s
rep #$20
and.w #31
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_r + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __screenfx_tint_rgb_locals + 1,s
rep #$20
and.w #31
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_g + 0
rep #$20
lda.w #0
sep #$20
lda 5 + __screenfx_tint_rgb_locals + 1,s
rep #$20
and.w #31
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_b + 0
rep #$20
.ifgr __screenfx_tint_rgb_locals 0
tsa
clc
adc #__screenfx_tint_rgb_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_tinttext_0x9" SUPERFREE
screenfx_tint:
.ifgr __screenfx_tint_locals 0
tsa
sec
sbc #__screenfx_tint_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __screenfx_tint_locals + 1,s
rep #$20
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
brl __local_16
+
bra __local_17
__local_16:
lda.w #0
sta.b tcc__r0
bra __local_18
__local_17:
lda.w #0
sep #$20
lda 3 + __screenfx_tint_locals + 1,s
rep #$20
sta.b tcc__r0
__local_18:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_left + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_phase2 + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_grad_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_spot_dark + 0
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_cm_dirty + 0
rep #$20
.ifgr __screenfx_tint_locals 0
tsa
clc
adc #__screenfx_tint_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_skygradtext_0xa" SUPERFREE
screenfx_skygrad:
.ifgr __screenfx_skygrad_locals 0
tsa
sec
sbc #__screenfx_skygrad_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __screenfx_skygrad_locals + 1,s
rep #$20
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
brl __local_19
+
bra __local_20
__local_19:
lda.w #0
sta.b tcc__r0
bra __local_21
__local_20:
lda.w #0
sep #$20
lda 3 + __screenfx_skygrad_locals + 1,s
rep #$20
sta.b tcc__r0
__local_21:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_grad_mode + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_grad_mode + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_22
+
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_left + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_phase2 + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_spot_dark + 0
rep #$20
__local_22:
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_cm_dirty + 0
rep #$20
.ifgr __screenfx_skygrad_locals 0
tsa
clc
adc #__screenfx_skygrad_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_spottext_0xb" SUPERFREE
screenfx_spot:
.ifgr __screenfx_spot_locals 0
tsa
sec
sbc #__screenfx_spot_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __screenfx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #31
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
brl __local_23
+
bra __local_24
__local_23:
lda.w #0
sep #$20
lda 3 + __screenfx_spot_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_25
__local_24:
lda.w #31
sta.b tcc__r0
__local_25:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_spot_dark + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_spot_dark + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_26
+
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_left + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_phase2 + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_grad_mode + 0
rep #$20
__local_26:
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_cm_dirty + 0
rep #$20
.ifgr __screenfx_spot_locals 0
tsa
clc
adc #__screenfx_spot_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_spot_activetext_0xc" SUPERFREE
screenfx_spot_active:
.ifgr __screenfx_spot_active_locals 0
tsa
sec
sbc #__screenfx_spot_active_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_spot_dark + 0
rep #$20
sta.b tcc__r0
__local_27:
.ifgr __screenfx_spot_active_locals 0
tsa
clc
adc #__screenfx_spot_active_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_skygrad_modetext_0xd" SUPERFREE
screenfx_skygrad_mode:
.ifgr __screenfx_skygrad_mode_locals 0
tsa
sec
sbc #__screenfx_skygrad_mode_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_grad_mode + 0
rep #$20
sta.b tcc__r0
__local_28:
.ifgr __screenfx_skygrad_mode_locals 0
tsa
clc
adc #__screenfx_skygrad_mode_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_flash_activetext_0xe" SUPERFREE
screenfx_flash_active:
.ifgr __screenfx_flash_active_locals 0
tsa
sec
sbc #__screenfx_flash_active_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_timer + 0
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
__local_29:
.ifgr __screenfx_flash_active_locals 0
tsa
clc
adc #__screenfx_flash_active_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_tg_steptext_0xf" SUPERFREE
tccs_{WLA_FILENAME}_tg_step:
.ifgr __tccs_{WLA_FILENAME}_tg_step_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_tg_step_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
rep #$20
xba
and #$ff00
sta -2 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
rep #$20
xba
and #$ff00
sta -4 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
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
brl __local_30
+
lda 6 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
sta.b tcc__r0
lda 8 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
sta.b [tcc__r0]
rep #$20
lda -4 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
sta.b tcc__r0
bra __local_31
__local_30:
lda 6 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
sta.b tcc__r0
lda 8 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
sta.b tcc__r0h
lda.w #1
sep #$20
sta.b [tcc__r0]
rep #$20
lda -2 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_tg_step_locals + 1,s
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
sta.b tcc__r0
__local_31:
__local_32:
.ifgr __tccs_{WLA_FILENAME}_tg_step_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_tg_step_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_tg_launchtext_0x10" SUPERFREE
tccs_{WLA_FILENAME}_tg_launch:
.ifgr __tccs_{WLA_FILENAME}_tg_launch_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_tg_launch_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_r + 0
rep #$20
xba
and #$ff00
sta.w tccs_{WLA_FILENAME}_tg_r8 + 0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_g + 0
rep #$20
xba
and #$ff00
sta.w tccs_{WLA_FILENAME}_tg_g8 + 0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_b + 0
rep #$20
xba
and #$ff00
sta.w tccs_{WLA_FILENAME}_tg_b8 + 0
pea.w :tccs_{WLA_FILENAME}_tg_rn
pea.w tccs_{WLA_FILENAME}_tg_rn + 0
lda.w #0
sep #$20
lda 7 + __tccs_{WLA_FILENAME}_tg_launch_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_tr + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_r + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tg_step
tsa
clc
adc #7
tas
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_sr + 0
pea.w :tccs_{WLA_FILENAME}_tg_gn
pea.w tccs_{WLA_FILENAME}_tg_gn + 0
lda.w #0
sep #$20
lda 7 + __tccs_{WLA_FILENAME}_tg_launch_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_tg + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_g + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tg_step
tsa
clc
adc #7
tas
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_sg + 0
pea.w :tccs_{WLA_FILENAME}_tg_bn
pea.w tccs_{WLA_FILENAME}_tg_bn + 0
lda.w #0
sep #$20
lda 7 + __tccs_{WLA_FILENAME}_tg_launch_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_tb + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_b + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tg_step
tsa
clc
adc #7
tas
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_sb + 0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_tg_launch_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_left + 0
rep #$20
.ifgr __tccs_{WLA_FILENAME}_tg_launch_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_tg_launch_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_tintg_rgbtext_0x11" SUPERFREE
screenfx_tintg_rgb:
.ifgr __screenfx_tintg_rgb_locals 0
tsa
sec
sbc #__screenfx_tintg_rgb_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __screenfx_tintg_rgb_locals + 1,s
rep #$20
and.w #31
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_fr + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __screenfx_tintg_rgb_locals + 1,s
rep #$20
and.w #31
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_fg + 0
rep #$20
lda.w #0
sep #$20
lda 5 + __screenfx_tintg_rgb_locals + 1,s
rep #$20
and.w #31
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_fb + 0
rep #$20
.ifgr __screenfx_tintg_rgb_locals 0
tsa
clc
adc #__screenfx_tintg_rgb_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_tintgtext_0x12" SUPERFREE
screenfx_tintg:
.ifgr __screenfx_tintg_locals 0
tsa
sec
sbc #__screenfx_tintg_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __screenfx_tintg_locals + 1,s
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
brl __local_33
+
lda.w #0
sta.b tcc__r0
sep #$20
sta 3 + __screenfx_tintg_locals + 1,s
rep #$20
__local_33:
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_grad_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_spot_dark + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __screenfx_tintg_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_34
+
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_fr + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_fg + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_fb + 0
rep #$20
__local_34:
lda.w #0
sep #$20
lda 4 + __screenfx_tintg_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_35
+
jmp.w __local_36
__local_35:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_fb + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_fg + 0
pha
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_fr + 0
pha
rep #$20
jsr.l screenfx_tint_rgb
tsa
clc
adc #3
tas
lda.w #0
sep #$20
lda 3 + __screenfx_tintg_locals + 1,s
pha
rep #$20
jsr.l screenfx_tint
tsa
clc
adc #1
tas
jmp.w __local_37
__local_36:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_38
+
lda.w #0
sep #$20
lda 3 + __screenfx_tintg_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_39
+
bra __local_40
__local_39:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
sta.b tcc__r0
bra __local_41
__local_40:
lda.w #0
sep #$20
lda 3 + __screenfx_tintg_locals + 1,s
rep #$20
sta.b tcc__r0
__local_41:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_r + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_g + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_b + 0
rep #$20
__local_38:
lda.w #0
sep #$20
lda 3 + __screenfx_tintg_locals + 1,s
sta.w tccs_{WLA_FILENAME}_tg_mode + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __screenfx_tintg_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_42
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_42:
brl __local_43
+
lda.w #0
sep #$20
lda 3 + __screenfx_tintg_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_mode + 0
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
__local_43:
brl __local_44
+
lda.w #0
sep #$20
lda 4 + __screenfx_tintg_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #$8000
ror.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __screenfx_tintg_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __screenfx_tintg_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_45
+
bra __local_46
__local_45:
lda.w #1
sta.b tcc__r0
sep #$20
sta -1 + __screenfx_tintg_locals + 1,s
rep #$20
__local_46:
lda.w #0
sep #$20
lda 4 + __screenfx_tintg_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __screenfx_tintg_locals + 1,s
rep #$20
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_phase2 + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_tr + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_tg + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_tb + 0
rep #$20
lda.w #0
sep #$20
lda -1 + __screenfx_tintg_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tg_launch
tsa
clc
adc #1
tas
jmp.w __local_47
__local_44:
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_phase2 + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_fr + 0
sta.w tccs_{WLA_FILENAME}_tg_tr + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_fg + 0
sta.w tccs_{WLA_FILENAME}_tg_tg + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_fb + 0
sta.w tccs_{WLA_FILENAME}_tg_tb + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __screenfx_tintg_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tg_launch
tsa
clc
adc #1
tas
__local_37:
__local_47:
.ifgr __screenfx_tintg_locals 0
tsa
clc
adc #__screenfx_tintg_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_flashtext_0x13" SUPERFREE
screenfx_flash:
.ifgr __screenfx_flash_locals 0
tsa
sec
sbc #__screenfx_flash_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __screenfx_flash_locals + 1,s
rep #$20
and.w #31
sep #$20
sta.w tccs_{WLA_FILENAME}_flash_r + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __screenfx_flash_locals + 1,s
rep #$20
and.w #31
sep #$20
sta.w tccs_{WLA_FILENAME}_flash_g + 0
rep #$20
lda.w #0
sep #$20
lda 5 + __screenfx_flash_locals + 1,s
rep #$20
and.w #31
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_flash_b + 0
rep #$20
.ifgr __screenfx_flash_locals 0
tsa
clc
adc #__screenfx_flash_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_flash_starttext_0x14" SUPERFREE
screenfx_flash_start:
.ifgr __screenfx_flash_start_locals 0
tsa
sec
sbc #__screenfx_flash_start_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __screenfx_flash_start_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_48
+
bra __local_49
__local_48:
lda.w #1
sta.b tcc__r0
bra __local_50
__local_49:
lda.w #0
sep #$20
lda 3 + __screenfx_flash_start_locals + 1,s
rep #$20
sta.b tcc__r0
__local_50:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_flash_dur + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_dur + 0
sta.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_cm_dirty + 0
rep #$20
.ifgr __screenfx_flash_start_locals 0
tsa
clc
adc #__screenfx_flash_start_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_shaketext_0x15" SUPERFREE
screenfx_shake:
.ifgr __screenfx_shake_locals 0
tsa
sec
sbc #__screenfx_shake_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __screenfx_shake_locals + 1,s
sta.w tccs_{WLA_FILENAME}_shake_power + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __screenfx_shake_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_51
+
bra __local_52
__local_51:
lda.w #1
sta.b tcc__r0
bra __local_53
__local_52:
lda.w #0
sep #$20
lda 4 + __screenfx_shake_locals + 1,s
rep #$20
sta.b tcc__r0
__local_53:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_shake_speed + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __screenfx_shake_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_54
+
bra __local_55
__local_54:
lda.w #0
sta.b tcc__r0
bra __local_56
__local_55:
lda.w #0
sep #$20
lda 5 + __screenfx_shake_locals + 1,s
rep #$20
sta.b tcc__r0
__local_56:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_shake_frames + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_phase + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_tick + 0
rep #$20
.ifgr __screenfx_shake_locals 0
tsa
clc
adc #__screenfx_shake_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_shake_xtext_0x16" SUPERFREE
screenfx_shake_x:
.ifgr __screenfx_shake_x_locals 0
tsa
sec
sbc #__screenfx_shake_x_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_shake_power + 0
rep #$20
sta -2 + __screenfx_shake_x_locals + 1,s
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_shake_frames + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_57
+
bra __local_58
__local_57:
lda.w #0
sta.b tcc__r0
bra __local_59
__local_58:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_shake_phase + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_60
+
bra __local_61
__local_60:
stz.b tcc__r0
lda -2 + __screenfx_shake_x_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_62
__local_61:
lda -2 + __screenfx_shake_x_locals + 1,s
sta.b tcc__r0
__local_62:
__local_59:
__local_63:
.ifgr __screenfx_shake_x_locals 0
tsa
clc
adc #__screenfx_shake_x_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_wipe_activetext_0x17" SUPERFREE
screenfx_wipe_active:
.ifgr __screenfx_wipe_active_locals 0
tsa
sec
sbc #__screenfx_wipe_active_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_wp_on + 0
rep #$20
sta.b tcc__r0
__local_64:
.ifgr __screenfx_wipe_active_locals 0
tsa
clc
adc #__screenfx_wipe_active_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_wp_bandtext_0x18" SUPERFREE
tccs_{WLA_FILENAME}_wp_band:
.ifgr __tccs_{WLA_FILENAME}_wp_band_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_wp_band_locals
tas
.endif
__local_69:
lda 7 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_65
+
lda 7 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #127
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_66
+
bra __local_67
__local_66:
lda 7 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
and.w #255
sta.b tcc__r0
bra __local_68
__local_67:
lda.w #127
sta.b tcc__r0
__local_68:
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
sta.b tcc__r0h
lda 3 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta 3 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
lda.b tcc__r0h
sta 5 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
sta.b tcc__r0h
lda 3 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta 3 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
lda.b tcc__r0h
sta 5 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
lda.w #0
sep #$20
lda 9 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
rep #$20
sta.b tcc__r0
lda 7 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
sec
sbc.b tcc__r0
sta.b tcc__r1
sta 7 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
jmp.w __local_69
__local_65:
lda 3 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_wp_band_locals + 1,s
sta.b tcc__r0h
__local_70:
.ifgr __tccs_{WLA_FILENAME}_wp_band_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_wp_band_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_wipe_steptext_0x19" SUPERFREE
screenfx_wipe_step:
.ifgr __screenfx_wipe_step_locals 0
tsa
sec
sbc #__screenfx_wipe_step_locals
tas
.endif
lda.w #:tccs_{WLA_FILENAME}_wp_tbl
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_wp_tbl + 0
sta.b tcc__r0
sta -4 + __screenfx_wipe_step_locals + 1,s
lda.b tcc__r0h
sta -2 + __screenfx_wipe_step_locals + 1,s
lda 4 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #224
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_71
+
lda.w #224
sta.b tcc__r0
sta 4 + __screenfx_wipe_step_locals + 1,s
__local_71:
lda.w #0
sep #$20
lda 3 + __screenfx_wipe_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #3
beq +
brl __local_72
+
sep #$20
lda #0
pha
rep #$20
lda 5 + __screenfx_wipe_step_locals + 1,s
pha
lda -1 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r0
lda 1 + __screenfx_wipe_step_locals + 1,s
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_wp_band
tsa
clc
adc #7
tas
lda.b tcc__r0
sta -4 + __screenfx_wipe_step_locals + 1,s
lda.b tcc__r0h
sta -2 + __screenfx_wipe_step_locals + 1,s
lda.w #224
sta.b tcc__r0
lda 4 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
sep #$20
lda #15
pha
rep #$20
pei (tcc__r0)
lda -1 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r0
lda 1 + __screenfx_wipe_step_locals + 1,s
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_wp_band
tsa
clc
adc #7
tas
lda.b tcc__r0
sta -4 + __screenfx_wipe_step_locals + 1,s
lda.b tcc__r0h
sta -2 + __screenfx_wipe_step_locals + 1,s
jmp.w __local_73
__local_72:
lda.w #0
sep #$20
lda 3 + __screenfx_wipe_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #4
beq +
brl __local_74
+
lda.w #224
sta.b tcc__r0
lda 4 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
sep #$20
lda #15
pha
rep #$20
pei (tcc__r0)
lda -1 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r0
lda 1 + __screenfx_wipe_step_locals + 1,s
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_wp_band
tsa
clc
adc #7
tas
lda.b tcc__r0
sta -4 + __screenfx_wipe_step_locals + 1,s
lda.b tcc__r0h
sta -2 + __screenfx_wipe_step_locals + 1,s
sep #$20
lda #0
pha
rep #$20
lda 5 + __screenfx_wipe_step_locals + 1,s
pha
lda -1 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r0
lda 1 + __screenfx_wipe_step_locals + 1,s
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_wp_band
tsa
clc
adc #7
tas
lda.b tcc__r0
sta -4 + __screenfx_wipe_step_locals + 1,s
lda.b tcc__r0h
sta -2 + __screenfx_wipe_step_locals + 1,s
jmp.w __local_75
__local_74:
lda 4 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r0
lsr.b tcc__r0
lda.b tcc__r0
sta -8 + __screenfx_wipe_step_locals + 1,s
sep #$20
lda #0
pha
rep #$20
lda -7 + __screenfx_wipe_step_locals + 1,s
pha
lda -1 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r0
lda 1 + __screenfx_wipe_step_locals + 1,s
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_wp_band
tsa
clc
adc #7
tas
lda.b tcc__r0
sta -4 + __screenfx_wipe_step_locals + 1,s
lda.b tcc__r0h
sta -2 + __screenfx_wipe_step_locals + 1,s
lda -8 + __screenfx_wipe_step_locals + 1,s
asl a
sta.b tcc__r0
lda.w #224
sec
sbc.b tcc__r0
sta.b tcc__r1
sep #$20
lda #15
pha
rep #$20
pei (tcc__r1)
lda -1 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r0
lda 1 + __screenfx_wipe_step_locals + 1,s
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_wp_band
tsa
clc
adc #7
tas
lda.b tcc__r0
sta -4 + __screenfx_wipe_step_locals + 1,s
lda.b tcc__r0h
sta -2 + __screenfx_wipe_step_locals + 1,s
sep #$20
lda #0
pha
rep #$20
lda -7 + __screenfx_wipe_step_locals + 1,s
pha
lda -1 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r0
lda 1 + __screenfx_wipe_step_locals + 1,s
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_wp_band
tsa
clc
adc #7
tas
lda.b tcc__r0
sta -4 + __screenfx_wipe_step_locals + 1,s
lda.b tcc__r0h
sta -2 + __screenfx_wipe_step_locals + 1,s
__local_75:
__local_73:
lda -4 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r0
lda -2 + __screenfx_wipe_step_locals + 1,s
sta.b tcc__r0h
lda.w #0
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 17184
rep #$20
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 17185
rep #$20
lda.w #:tccs_{WLA_FILENAME}_wp_tbl
sta.b tcc__r0h
lda.w #tccs_{WLA_FILENAME}_wp_tbl + 0
sta -6 + __screenfx_wipe_step_locals + 1,s
and.w #255
sep #$20
sta.l 17186
rep #$20
lda -6 + __screenfx_wipe_step_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
sta.l 17187
rep #$20
lda.w #126
sep #$20
sta.l 17188
rep #$20
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_wp_on + 0
rep #$20
lda.w #4
sta.b tcc__r0
sep #$20
sta.l 16908
rep #$20
.ifgr __screenfx_wipe_step_locals 0
tsa
clc
adc #__screenfx_wipe_step_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_wipe_offtext_0x1a" SUPERFREE
screenfx_wipe_off:
.ifgr __screenfx_wipe_off_locals 0
tsa
sec
sbc #__screenfx_wipe_off_locals
tas
.endif
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_wp_on + 0
rep #$20
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 16908
rep #$20
.ifgr __screenfx_wipe_off_locals 0
tsa
clc
adc #__screenfx_wipe_off_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_updatetext_0x1b" SUPERFREE
screenfx_update:
.ifgr __screenfx_update_locals 0
tsa
sec
sbc #__screenfx_update_locals
tas
.endif
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
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
brl __local_76
+
lda.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_fade_step + 0
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_77
++
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_fade_step + 0
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
bra __local_78
__local_77:
lda.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
sta.b tcc__r0
__local_78:
__local_79:
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_fade_dirty + 0
rep #$20
jmp.w __local_80
__local_76:
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_81
++
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_fade_step + 0
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_82
++
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_fade_step + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_83
__local_82:
lda.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
sta.b tcc__r0
__local_83:
__local_84:
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_fade_dirty + 0
rep #$20
__local_81:
__local_80:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_left + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_85
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_left + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_left + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_left + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_86
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_rn + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_87
+
lda.w tccs_{WLA_FILENAME}_tg_r8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_tg_sr + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_88
__local_87:
lda.w tccs_{WLA_FILENAME}_tg_r8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_tg_sr + 0
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
__local_88:
__local_89:
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_r8 + 0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_gn + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_90
+
lda.w tccs_{WLA_FILENAME}_tg_g8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_tg_sg + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_91
__local_90:
lda.w tccs_{WLA_FILENAME}_tg_g8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_tg_sg + 0
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
__local_91:
__local_92:
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_g8 + 0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_bn + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_93
+
lda.w tccs_{WLA_FILENAME}_tg_b8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_tg_sb + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
bra __local_94
__local_93:
lda.w tccs_{WLA_FILENAME}_tg_b8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_tg_sb + 0
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
__local_94:
__local_95:
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_tg_b8 + 0
lda.w tccs_{WLA_FILENAME}_tg_r8 + 0
xba
and #$00ff
and.w #255
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_r + 0
rep #$20
lda.w tccs_{WLA_FILENAME}_tg_g8 + 0
xba
and #$00ff
and.w #255
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_g + 0
rep #$20
lda.w tccs_{WLA_FILENAME}_tg_b8 + 0
xba
and #$00ff
and.w #255
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_b + 0
rep #$20
jmp.w __local_96
__local_86:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_tr + 0
sta.w tccs_{WLA_FILENAME}_tint_r + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_tg + 0
sta.w tccs_{WLA_FILENAME}_tint_g + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_tb + 0
sta.w tccs_{WLA_FILENAME}_tint_b + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_phase2 + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_97
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_mode + 0
sta.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_fr + 0
sta.w tccs_{WLA_FILENAME}_tg_tr + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_fg + 0
sta.w tccs_{WLA_FILENAME}_tg_tg + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_fb + 0
sta.w tccs_{WLA_FILENAME}_tg_tb + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_phase2 + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tg_launch
tsa
clc
adc #1
tas
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tg_phase2 + 0
rep #$20
bra __local_98
__local_97:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tg_mode + 0
rep #$20
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
__local_98:
__local_96:
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_cm_dirty + 0
rep #$20
__local_85:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_99
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_cm_dirty + 0
rep #$20
__local_99:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_shake_frames + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_100
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_shake_frames + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_shake_frames + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_shake_tick + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_shake_tick + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_shake_tick + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_shake_speed + 0
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
brl __local_101
+
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_tick + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_shake_phase + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_102
+
lda #0
bra +
__local_102:
lda #1
+
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_phase + 0
rep #$20
__local_101:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_shake_frames + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_103
+
bra __local_104
__local_103:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_shake_power + 0
rep #$20
__local_104:
__local_100:
.ifgr __screenfx_update_locals 0
tsa
clc
adc #__screenfx_update_locals
tas
.endif
rtl
.ENDS
.SECTION ".screenfx_vblanktext_0x1c" SUPERFREE
screenfx_vblank:
.ifgr __screenfx_vblank_locals 0
tsa
sec
sbc #__screenfx_vblank_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_mos_fix + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_105
+
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_mos_fix + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_fade_fx + 0
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #2
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_106
+
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8454
rep #$20
__local_106:
__local_105:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_fade_dirty + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_107
+
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_fade_dirty + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_fade_fx + 0
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
brl __local_108
+
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
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
brl __local_109
+
jsr.l screenfx_wipe_off
lda.w tccs_{WLA_FILENAME}_fade_tgt8 + 0
xba
and #$00ff
and.w #255
sta.b tcc__r0
sep #$20
sta.l 8448
rep #$20
jmp.w __local_110
__local_109:
lda.w #3840
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
lsr a
lsr a
lsr a
lsr a
sta -6 + __screenfx_vblank_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #224
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
lda.w #224
sta.b tcc__r0
sta -6 + __screenfx_vblank_locals + 1,s
__local_111:
lda -6 + __screenfx_vblank_locals + 1,s
pha
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_fade_fx + 0
pha
rep #$20
jsr.l screenfx_wipe_step
tsa
clc
adc #3
tas
lda.w #15
sta.b tcc__r0
sep #$20
sta.l 8448
rep #$20
__local_110:
jmp.w __local_112
__local_108:
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
xba
and #$00ff
and.w #255
sep #$20
sta -4 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_fade_fx + 0
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_113
+
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
sta.b tcc__r0
cmp #3840
beq +
brl __local_114
+
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8454
rep #$20
jmp.w __local_115
__local_114:
lda.w #0
sep #$20
lda -4 + __screenfx_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #15
sec
sbc.b tcc__r0
sta.b tcc__r1
sep #$20
sta -4 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -4 + __screenfx_vblank_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
ora.w #7
sep #$20
sta -4 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -4 + __screenfx_vblank_locals + 1,s
sta.l 8454
rep #$20
lda.w tccs_{WLA_FILENAME}_fade_lvl8 + 0
xba
and #$00ff
and.w #255
sta.b tcc__r0
sep #$20
sta -4 + __screenfx_vblank_locals + 1,s
rep #$20
__local_115:
__local_113:
lda.w #0
sep #$20
lda -4 + __screenfx_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l 8448
rep #$20
__local_112:
__local_107:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_cm_hold + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_116
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_117
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_r + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
sta.b tcc__r1
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_dur + 0
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
and.w #255
sep #$20
sta -1 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_g + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
sta.b tcc__r1
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_dur + 0
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
and.w #255
sep #$20
sta -2 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_b + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
sta.b tcc__r1
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_dur + 0
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
and.w #255
sep #$20
sta -3 + __screenfx_vblank_locals + 1,s
rep #$20
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8496
rep #$20
lda.w #35
sep #$20
sta.l 8497
rep #$20
lda.w #0
sep #$20
lda -1 + __screenfx_vblank_locals + 1,s
rep #$20
ora.w #32
sep #$20
sta.l 8498
rep #$20
lda.w #0
sep #$20
lda -2 + __screenfx_vblank_locals + 1,s
rep #$20
ora.w #64
sep #$20
sta.l 8498
rep #$20
lda.w #0
sep #$20
lda -3 + __screenfx_vblank_locals + 1,s
rep #$20
ora.w #128
sep #$20
sta.l 8498
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_cm_flash + 0
rep #$20
jmp.w __local_118
__local_117:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_cm_flash + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_119
+
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_cm_flash + 0
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_hold_ts + 0
sta.l 8493
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_hold_wsel + 0
sta.l 8496
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_hold_adsub + 0
sta.l 8497
rep #$20
lda.w #32
sep #$20
sta.l 8498
rep #$20
lda.w #64
sep #$20
sta.l 8498
rep #$20
lda.w #128
sta.b tcc__r0
sep #$20
sta.l 8498
rep #$20
__local_119:
__local_118:
jmp.w __local_120
__local_116:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_cm_dirty + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_121
+
bra __local_122
__local_121:
jmp.w __local_123
__local_122:
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_cm_dirty + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_124
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_r + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
sta.b tcc__r1
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_dur + 0
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
and.w #255
sep #$20
sta -1 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_g + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
sta.b tcc__r1
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_dur + 0
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
and.w #255
sep #$20
sta -2 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_b + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_timer + 0
rep #$20
sta.b tcc__r1
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_flash_dur + 0
rep #$20
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
and.w #255
sep #$20
sta -3 + __screenfx_vblank_locals + 1,s
rep #$20
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8496
rep #$20
lda.w #35
sta.b tcc__r0
sep #$20
sta.l 8497
rep #$20
jmp.w __local_125
__local_124:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_spot_dark + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_126
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_spot_dark + 0
sta -1 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_spot_dark + 0
sta -2 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_spot_dark + 0
sta -3 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #32
sep #$20
sta.l 8485
rep #$20
lda.w #32
sep #$20
sta.l 8496
rep #$20
lda.w #163
sta.b tcc__r0
sep #$20
sta.l 8497
rep #$20
jmp.w __local_127
__local_126:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_128
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_r + 0
sta -1 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_g + 0
sta -2 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_b + 0
sta -3 + __screenfx_vblank_locals + 1,s
rep #$20
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8485
rep #$20
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8496
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_tint_mode + 0
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_129
+
bra __local_130
__local_129:
lda.w #35
sta.b tcc__r0
bra __local_131
__local_130:
lda.w #163
sta.b tcc__r0
__local_131:
sep #$20
lda.b tcc__r0
sta.l 8497
rep #$20
jmp.w __local_132
__local_128:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_grad_mode + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_133
+
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8485
rep #$20
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8496
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_grad_mode + 0
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_134
+
bra __local_135
__local_134:
lda.w #35
sta.b tcc__r0
bra __local_136
__local_135:
lda.w #163
sta.b tcc__r0
__local_136:
sep #$20
lda.b tcc__r0
sta.l 8497
rep #$20
jmp.w __local_137
bra __local_138
__local_133:
lda.w #0
sep #$20
sta -1 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
sta -2 + __screenfx_vblank_locals + 1,s
rep #$20
lda.w #0
sep #$20
sta -3 + __screenfx_vblank_locals + 1,s
rep #$20
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8485
rep #$20
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8497
rep #$20
__local_138:
__local_132:
__local_127:
__local_125:
lda.w #0
sep #$20
lda -1 + __screenfx_vblank_locals + 1,s
rep #$20
ora.w #32
sep #$20
sta.l 8498
rep #$20
lda.w #0
sep #$20
lda -2 + __screenfx_vblank_locals + 1,s
rep #$20
ora.w #64
sep #$20
sta.l 8498
rep #$20
lda.w #0
sep #$20
lda -3 + __screenfx_vblank_locals + 1,s
rep #$20
ora.w #128
sta.b tcc__r0
sep #$20
sta.l 8498
rep #$20
__local_120:
__local_123:
__local_137:
.ifgr __screenfx_vblank_locals 0
tsa
clc
adc #__screenfx_vblank_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_cm_hold dsb 1
tccs_{WLA_FILENAME}_hold_ts dsb 1
tccs_{WLA_FILENAME}_hold_wsel dsb 1
tccs_{WLA_FILENAME}_hold_adsub dsb 1
tccs_{WLA_FILENAME}_cm_flash dsb 1
tccs_{WLA_FILENAME}_wp_on dsb 1
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $0
.db $0
.db $0
.db $0
.db $0
.db $0
.ENDS
.SECTION ".rodata" SUPERFREE
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
tccs_{WLA_FILENAME}_fade_lvl8 dsb 2
tccs_{WLA_FILENAME}_fade_tgt8 dsb 2
tccs_{WLA_FILENAME}_fade_step dsb 2
tccs_{WLA_FILENAME}_fade_dirty dsb 1
tccs_{WLA_FILENAME}_fade_fx dsb 1
tccs_{WLA_FILENAME}_mos_fix dsb 1
tccs_{WLA_FILENAME}_tint_mode dsb 1
tccs_{WLA_FILENAME}_tint_r dsb 1
tccs_{WLA_FILENAME}_tint_g dsb 1
tccs_{WLA_FILENAME}_tint_b dsb 1
tccs_{WLA_FILENAME}_cm_dirty dsb 1
tccs_{WLA_FILENAME}_flash_r dsb 1
tccs_{WLA_FILENAME}_flash_g dsb 1
tccs_{WLA_FILENAME}_flash_b dsb 1
tccs_{WLA_FILENAME}_flash_timer dsb 1
tccs_{WLA_FILENAME}_flash_dur dsb 1
tccs_{WLA_FILENAME}_shake_power dsb 1
tccs_{WLA_FILENAME}_shake_speed dsb 1
tccs_{WLA_FILENAME}_shake_frames dsb 1
tccs_{WLA_FILENAME}_shake_phase dsb 1
tccs_{WLA_FILENAME}_shake_tick dsb 1
tccs_{WLA_FILENAME}_grad_mode dsb 1
tccs_{WLA_FILENAME}_spot_dark dsb 1
tccs_{WLA_FILENAME}_tg_left dsb 1
tccs_{WLA_FILENAME}_tg_mode dsb 1
tccs_{WLA_FILENAME}_tg_phase2 dsb 1
tccs_{WLA_FILENAME}_tg_tr dsb 1
tccs_{WLA_FILENAME}_tg_tg dsb 1
tccs_{WLA_FILENAME}_tg_tb dsb 1
tccs_{WLA_FILENAME}_tg_fr dsb 1
tccs_{WLA_FILENAME}_tg_fg dsb 1
tccs_{WLA_FILENAME}_tg_fb dsb 1
tccs_{WLA_FILENAME}_tg_r8 dsb 2
tccs_{WLA_FILENAME}_tg_g8 dsb 2
tccs_{WLA_FILENAME}_tg_b8 dsb 2
tccs_{WLA_FILENAME}_tg_sr dsb 2
tccs_{WLA_FILENAME}_tg_sg dsb 2
tccs_{WLA_FILENAME}_tg_sb dsb 2
tccs_{WLA_FILENAME}_tg_rn dsb 1
tccs_{WLA_FILENAME}_tg_gn dsb 1
tccs_{WLA_FILENAME}_tg_bn dsb 1
tccs_{WLA_FILENAME}_wp_tbl dsb 16
.ENDS
