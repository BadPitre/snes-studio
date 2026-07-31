.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_warp_trans_regs_locals 1
.define __tccs_{WLA_FILENAME}_warp_close_locals 4
.define __tccs_{WLA_FILENAME}_warp_open_locals 4
.define __tccs_{WLA_FILENAME}_do_warp_locals 4
.define __main_locals 20
.SECTION ".tccs_{WLA_FILENAME}_warp_trans_regstext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_warp_trans_regs:
.ifgr __tccs_{WLA_FILENAME}_warp_trans_regs_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_warp_trans_regs_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_warp_trans_regs_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #15
sec
sbc.b tcc__r0
sta.b tcc__r1
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_warp_trans_regs_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_warp_trans_regs_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
ora.w #7
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_warp_trans_regs_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_warp_trans_regs_locals + 1,s
sta.l 8454
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_warp_trans_regs_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l 8448
rep #$20
.ifgr __tccs_{WLA_FILENAME}_warp_trans_regs_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_warp_trans_regs_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_warp_closetext_0x1" SUPERFREE
tccs_{WLA_FILENAME}_warp_close:
.ifgr __tccs_{WLA_FILENAME}_warp_close_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_warp_close_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_0
+
jmp.w __local_1
__local_0:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_2
+
sep #$20
lda.b #15
sta -2 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
__local_5:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #16
bvc +
eor #$8000
+
bmi +
brl __local_3
+
bra __local_4
__local_6:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
bra __local_5
__local_4:
jsr.l WaitForVBlank
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_warp_trans_regs
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
jmp.w __local_6
__local_3:
jmp.w __local_7
__local_2:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
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
brl __local_8
+
stz.b tcc__r0
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
__local_11:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #16
bvc +
eor #$8000
+
bmi +
brl __local_9
+
bra __local_10
__local_12:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
rep #$20
bra __local_11
__local_10:
lda -4 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
clc
adc.w #14
sta -4 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
jsr.l WaitForVBlank
lda -4 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
pha
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_warp_close_locals + 1,s
pha
rep #$20
jsr.l screenfx_wipe_step
tsa
clc
adc #3
tas
jmp.w __local_12
__local_9:
jsr.l WaitForVBlank
jsr.l screenfx_wipe_off
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8448
rep #$20
bra __local_13
__local_8:
sep #$20
lda #1
pha
rep #$20
jsr.l setFadeEffect
tsa
clc
adc #1
tas
__local_1:
__local_7:
__local_13:
.ifgr __tccs_{WLA_FILENAME}_warp_close_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_warp_close_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_warp_opentext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_warp_open:
.ifgr __tccs_{WLA_FILENAME}_warp_open_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_warp_open_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_14
+
jsr.l setScreenOn
jmp.w __local_15
__local_14:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_16
+
lda.w #0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
__local_19:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #16
bvc +
eor #$8000
+
bmi +
brl __local_17
+
bra __local_18
__local_20:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
bra __local_19
__local_18:
jsr.l WaitForVBlank
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_warp_trans_regs
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
jmp.w __local_20
__local_17:
jsr.l WaitForVBlank
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8454
rep #$20
jmp.w __local_21
__local_16:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
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
brl __local_22
+
stz.b tcc__r0
sep #$20
lda.b tcc__r0
sta.l 8448
rep #$20
pea.w 224
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
pha
rep #$20
jsr.l screenfx_wipe_step
tsa
clc
adc #3
tas
lda.w #224
sta -4 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
__local_25:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #16
bvc +
eor #$8000
+
bmi +
brl __local_23
+
bra __local_24
__local_26:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
rep #$20
bra __local_25
__local_24:
lda -4 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
sec
sbc.w #14
sta -4 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
jsr.l WaitForVBlank
lda -4 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
pha
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_warp_open_locals + 1,s
pha
rep #$20
jsr.l screenfx_wipe_step
tsa
clc
adc #3
tas
jmp.w __local_26
__local_23:
jsr.l WaitForVBlank
jsr.l screenfx_wipe_off
lda.w #15
sta.b tcc__r0
sep #$20
sta.l 8448
rep #$20
bra __local_27
__local_22:
jsr.l setScreenOn
sep #$20
lda #2
pha
rep #$20
jsr.l setFadeEffect
tsa
clc
adc #1
tas
__local_15:
__local_21:
__local_27:
.ifgr __tccs_{WLA_FILENAME}_warp_open_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_warp_open_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_do_warptext_0x3" SUPERFREE
tccs_{WLA_FILENAME}_do_warp:
.ifgr __tccs_{WLA_FILENAME}_do_warp_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_do_warp_locals
tas
.endif
lda.w #0
sep #$20
lda.l player + 4
sta -4 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 6 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_warp_close
tsa
clc
adc #1
tas
jsr.l setScreenOff
jsr.l picture_reset
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
pha
rep #$20
jsr.l scene_load
tsa
clc
adc #1
tas
jsr.l textbox_load_pal
jsr.l vm_scene_reset
jsr.l camera_init
jsr.l anim_stop
jsr.l player_init
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
pha
rep #$20
jsr.l player_set_pos
pla
jsr.l player_take_warp_dir
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_28
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
rep #$20
sta.b tcc__r0
dec.b tcc__r0
bra __local_29
__local_28:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
rep #$20
sta.b tcc__r0
__local_29:
__local_30:
sep #$20
lda.b tcc__r0
sta.l player + 4
rep #$20
jsr.l actors_init
jsr.l actors_autorun
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc #65535
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_31
+
lda -2 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
pha
jsr.l vm_start
pla
__local_31:
jsr.l camera_update
jsr.l map_init
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
jsr.l player_draw
jsr.l actors_draw
lda.w #0
sep #$20
lda.l scene_ctx + 29
pha
rep #$20
jsr.l audio_play_music
tsa
clc
adc #1
tas
jsr.l screenfx_warp_reset
lda.w #0
sep #$20
lda 7 + __tccs_{WLA_FILENAME}_do_warp_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_warp_open
tsa
clc
adc #1
tas
.ifgr __tccs_{WLA_FILENAME}_do_warp_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_do_warp_locals
tas
.endif
rtl
.ENDS
.SECTION ".maintext_0x4" SUPERFREE
main:
.ifgr __main_locals 0
tsa
sec
sbc #__main_locals
tas
.endif
lda.w #0
sep #$20
sta -3 + __main_locals + 1,s
rep #$20
jsr.l audio_init
jsr.l scene_boot_id
sep #$20
lda.b tcc__r0
pha
rep #$20
jsr.l scene_load
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda.l scene_ctx + 29
pha
rep #$20
jsr.l audio_play_music
tsa
clc
adc #1
tas
jsr.l textbox_init
jsr.l ui_screen_init
jsr.l vm_init
jsr.l sysmenu_init
jsr.l timer_init
jsr.l screenfx_init
jsr.l overlay_init
jsr.l camera_init
jsr.l player_init
jsr.l actors_init
jsr.l actors_autorun
lda.b tcc__r0
sta -2 + __main_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc #65535
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_32
+
lda -2 + __main_locals + 1,s
pha
jsr.l vm_start
pla
__local_32:
jsr.l camera_update
jsr.l map_init
pea.w (8 * 256 + 1)
sep #$20
rep #$20
jsr.l setMode
pla
pea.w 0
pea.w 0
sep #$20
lda #2
pha
rep #$20
jsr.l bgSetScroll
tsa
clc
adc #5
tas
jsr.l effect_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_33
+
jsr.l effect_restore
__local_33:
jsr.l setScreenOn
__local_59:
jsr.l vm_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_34
+
jsr.l vm_update
lda.w #1
sta.b tcc__r0
sep #$20
sta -3 + __main_locals + 1,s
rep #$20
jmp.w __local_35
__local_34:
lda.w #0
sep #$20
lda -3 + __main_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_36
+
lda.w #0
sep #$20
sta -3 + __main_locals + 1,s
rep #$20
jsr.l actors_resolve_pages
jmp.w __local_37
__local_36:
jsr.l sysmenu_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_38
+
jsr.l sysmenu_update
jsr.l sysmenu_take_load
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_39
+
pea.w (0 * 256 + 0)
sep #$20
rep #$20
lda.w #0
sep #$20
lda.l save_info + 2
pha
rep #$20
lda.w #0
sep #$20
lda.l save_info + 1
pha
rep #$20
lda.w #0
sep #$20
lda.l save_info + 0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_do_warp
tsa
clc
adc #5
tas
lda.w #0
sep #$20
lda.l save_info + 3
rep #$20
sta.b tcc__r0
sep #$20
sta.l player + 4
rep #$20
__local_39:
jmp.w __local_40
__local_38:
jsr.l vm_common_auto
lda.b tcc__r0
sta -8 + __main_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc #65535
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_41
+
lda -8 + __main_locals + 1,s
pha
jsr.l vm_start
pla
lda.w #1
sta.b tcc__r0
sep #$20
sta -3 + __main_locals + 1,s
rep #$20
jmp.w __local_42
__local_41:
jsr.l player_update
stz.b tcc__r0h
tsa
clc
adc #(-6 + __main_locals + 1)
pei (tcc__r0h)
sta.b tcc__r0
pha
stz.b tcc__r0h
tsa
clc
adc #(-1 + __main_locals + 1)
pei (tcc__r0h)
sta.b tcc__r0
pha
stz.b tcc__r0h
tsa
clc
adc #(4 + __main_locals + 1)
pei (tcc__r0h)
pha
jsr.l player_take_warp
tsa
clc
adc #12
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_43
+
jsr.l player_take_warp_trans
sep #$20
lda.b tcc__r0
sta -9 + __main_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -9 + __main_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -8 + __main_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -4 + __main_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __main_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __main_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_do_warp
tsa
clc
adc #5
tas
__local_43:
__local_42:
__local_40:
__local_37:
__local_35:
jsr.l picture_apply
jsr.l stage_apply
jsr.l stage_take_close
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_44
+
jsr.l stage_reset
lda.l player + 0
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.l player + 2
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r1
lda.b tcc__r0
sta -16 + __main_locals + 1,s
lda.b tcc__r0h
sta -14 + __main_locals + 1,s
lda.b tcc__r1
sta -20 + __main_locals + 1,s
lda.b tcc__r1h
sta -18 + __main_locals + 1,s
jsr.l stage_close_trans
sep #$20
lda.b tcc__r0
pha
lda #0
pha
rep #$20
lda.w #0
sep #$20
lda -18 + __main_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -13 + __main_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda.l scene_ctx + 32
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_do_warp
tsa
clc
adc #5
tas
__local_44:
jsr.l sysmenu_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_45
+
bra __local_46
__local_45:
jsr.l actors_update
jsr.l timer_tick
jsr.l vm_parallel_update
__local_46:
jsr.l screenfx_update
jsr.l effect_update
jsr.l hdmafx_update
jsr.l overlay_update
jsr.l debug_update
jsr.l stage_update
jsr.l camera_update
jsr.l picture_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_47
+
bra __local_48
__local_47:
jsr.l stage_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_49
+
bra __local_50
__local_49:
jsr.l map_update
jsr.l tileanim_update
__local_48:
__local_50:
jsr.l stage_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_51
+
bra __local_52
__local_51:
jsr.l player_draw
jsr.l actors_draw
jsr.l weather_draw
__local_52:
jsr.l anim_update
jsr.l vig_update
jsr.l audio_process
jsr.l WaitForVBlank
jsr.l picture_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_53
+
jsr.l ui_screen_vblank
jsr.l screenfx_vblank
jsr.l picture_vblank
jsr.l hdmafx_suspend
jmp.w __local_54
__local_53:
jsr.l stage_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_55
+
jsr.l ui_screen_vblank
jsr.l screenfx_vblank
jsr.l stage_vblank
jsr.l vig_vblank
jsr.l hdmafx_suspend
jmp.w __local_56
__local_55:
jsr.l map_vblank
jsr.l tileanim_vblank
jsr.l ui_screen_vblank
jsr.l screenfx_vblank
jsr.l effect_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_57
+
jsr.l effect_vblank
bra __local_58
__local_57:
jsr.l screenfx_shake_x
lda.l camera + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.l camera + 2
pha
pei (tcc__r1)
sep #$20
lda #0
pha
rep #$20
jsr.l bgSetScroll
tsa
clc
adc #5
tas
__local_58:
jsr.l screenfx_shake_x
lda.l camera + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.l camera + 2
pha
pei (tcc__r1)
sep #$20
lda #1
pha
rep #$20
jsr.l bgSetScroll
tsa
clc
adc #5
tas
jsr.l hdmafx_vblank
jsr.l vig_vblank
__local_56:
__local_54:
jmp.w __local_59
lda.w #0
sta.b tcc__r0
__local_60:
.ifgr __main_locals 0
tsa
clc
adc #__main_locals
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
.ENDS
