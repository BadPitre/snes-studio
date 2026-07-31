.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_tile_blocked_locals 0
.define __tccs_{WLA_FILENAME}_check_warp_locals 8
.define __player_request_warp_locals 0
.define __player_take_warp_dir_locals 1
.define __player_take_warp_trans_locals 1
.define __player_set_pos_locals 0
.define __player_take_warp_locals 0
.define __tccs_{WLA_FILENAME}_blocked_locals 4
.define __tccs_{WLA_FILENAME}_edge_blocked_locals 4
.define __tccs_{WLA_FILENAME}_slide_v_locals 3
.define __tccs_{WLA_FILENAME}_slide_h_locals 3
.define __tccs_{WLA_FILENAME}_player_try_interact_locals 3
.define __player_init_locals 0
.define __player_update_locals 6
.define __player_draw_locals 20
.SECTION ".tccs_{WLA_FILENAME}_tile_blockedtext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_tile_blocked:
.ifgr __tccs_{WLA_FILENAME}_tile_blocked_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_tile_blocked_locals
tas
.endif
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_tile_blocked_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_tile_blocked_locals + 1,s
pha
rep #$20
jsr.l scene_collision
pla
lda.b tcc__r0
and.w #15
and.w #255
sta.b tcc__r0
cmp #1
beq +
brl __local_0
+
lda.w #1
sta.b tcc__r0
bra __local_1
__local_0:
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_tile_blocked_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_tile_blocked_locals + 1,s
pha
rep #$20
jsr.l actor_at_tile
pla
ldx #1
lda.b tcc__r0
sec
sbc #255
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
__local_2:
.ifgr __tccs_{WLA_FILENAME}_tile_blocked_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_tile_blocked_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_check_warptext_0x1" SUPERFREE
tccs_{WLA_FILENAME}_check_warp:
.ifgr __tccs_{WLA_FILENAME}_check_warp_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_check_warp_locals
tas
.endif
lda.w player + 0
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
lda.w player + 2
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_prev_ctx + 0
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
brl __local_3
+
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_prev_cty + 0
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
__local_3:
brl __local_4
+
jmp.w __local_5
__local_4:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.l tccs_{WLA_FILENAME}_prev_ctx + 0
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.l tccs_{WLA_FILENAME}_prev_cty + 0
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
pha
rep #$20
jsr.l scene_collision
pla
lda.b tcc__r0
and.w #15
and.w #255
sta.b tcc__r0
cmp #2
beq +
brl __local_6
+
lda.l scene_ctx + 24 + 2
sta.b tcc__r0h
lda.l scene_ctx + 24
sta.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
lda.b tcc__r0h
sta -6 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
__local_9:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 28
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_7
+
bra __local_8
__local_13:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
lda -6 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0h
lda -8 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #8
sta.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
lda.b tcc__r0h
sta -6 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
jmp.w __local_9
__local_8:
lda -8 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
lda.b tcc__r1
sec
sbc.b tcc__r0
tay
beq +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_10
+
lda -6 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0h
lda -8 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
lda.b tcc__r1
sec
sbc.b tcc__r0
tay
beq +
dex
+
stx.b tcc__r5
txa
bne +
__local_10:
brl __local_11
+
lda.w #1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_warp_pending + 0
rep #$20
lda -6 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0h
lda -8 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.l tccs_{WLA_FILENAME}_warp_dest_scene + 0
rep #$20
lda -8 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.l tccs_{WLA_FILENAME}_warp_dest_x + 0
rep #$20
lda -8 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.l tccs_{WLA_FILENAME}_warp_dest_y + 0
rep #$20
lda -8 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #5
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
and.w #7
sep #$20
sta.l tccs_{WLA_FILENAME}_warp_dest_dir + 0
rep #$20
lda -8 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #6
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
sep #$20
sta.l tccs_{WLA_FILENAME}_warp_dest_trans + 0
rep #$20
jmp.w __local_12
__local_11:
jmp.w __local_13
__local_7:
__local_6:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
pha
rep #$20
jsr.l actor_trigger_at
pla
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
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
brl __local_14
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.l scene_ctx + 16
sta.b tcc__r1
lda.l scene_ctx + 16 + 2
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
clc
adc.w #4
sta.b tcc__r1
lda.b [tcc__r1]
pha
jsr.l vm_start
pla
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_check_warp_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l vm + 709
rep #$20
__local_14:
__local_5:
__local_12:
.ifgr __tccs_{WLA_FILENAME}_check_warp_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_check_warp_locals
tas
.endif
rtl
.ENDS
.SECTION ".player_request_warptext_0x2" SUPERFREE
player_request_warp:
.ifgr __player_request_warp_locals 0
tsa
sec
sbc #__player_request_warp_locals
tas
.endif
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_warp_pending + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __player_request_warp_locals + 1,s
sta.l tccs_{WLA_FILENAME}_warp_dest_scene + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __player_request_warp_locals + 1,s
sta.l tccs_{WLA_FILENAME}_warp_dest_x + 0
rep #$20
lda.w #0
sep #$20
lda 5 + __player_request_warp_locals + 1,s
sta.l tccs_{WLA_FILENAME}_warp_dest_y + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_warp_dest_dir + 0
rep #$20
lda.w #0
sep #$20
lda 6 + __player_request_warp_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_warp_dest_trans + 0
rep #$20
.ifgr __player_request_warp_locals 0
tsa
clc
adc #__player_request_warp_locals
tas
.endif
rtl
.ENDS
.SECTION ".player_take_warp_dirtext_0x3" SUPERFREE
player_take_warp_dir:
.ifgr __player_take_warp_dir_locals 0
tsa
sec
sbc #__player_take_warp_dir_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_warp_dest_dir + 0
sta -1 + __player_take_warp_dir_locals + 1,s
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_warp_dest_dir + 0
rep #$20
lda.w #0
sep #$20
lda -1 + __player_take_warp_dir_locals + 1,s
rep #$20
sta.b tcc__r0
__local_15:
.ifgr __player_take_warp_dir_locals 0
tsa
clc
adc #__player_take_warp_dir_locals
tas
.endif
rtl
.ENDS
.SECTION ".player_take_warp_transtext_0x4" SUPERFREE
player_take_warp_trans:
.ifgr __player_take_warp_trans_locals 0
tsa
sec
sbc #__player_take_warp_trans_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_warp_dest_trans + 0
sta -1 + __player_take_warp_trans_locals + 1,s
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_warp_dest_trans + 0
rep #$20
lda.w #0
sep #$20
lda -1 + __player_take_warp_trans_locals + 1,s
rep #$20
sta.b tcc__r0
__local_16:
.ifgr __player_take_warp_trans_locals 0
tsa
clc
adc #__player_take_warp_trans_locals
tas
.endif
rtl
.ENDS
.SECTION ".player_set_postext_0x5" SUPERFREE
player_set_pos:
.ifgr __player_set_pos_locals 0
tsa
sec
sbc #__player_set_pos_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __player_set_pos_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.w player + 0
lda.w #0
sep #$20
lda 4 + __player_set_pos_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.w player + 2
lda.w #0
sep #$20
lda 3 + __player_set_pos_locals + 1,s
sta.l tccs_{WLA_FILENAME}_prev_ctx + 0
rep #$20
lda.w #0
sep #$20
lda 4 + __player_set_pos_locals + 1,s
sta.l tccs_{WLA_FILENAME}_prev_cty + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_warp_pending + 0
rep #$20
.ifgr __player_set_pos_locals 0
tsa
clc
adc #__player_set_pos_locals
tas
.endif
rtl
.ENDS
.SECTION ".player_take_warptext_0x6" SUPERFREE
player_take_warp:
.ifgr __player_take_warp_locals 0
tsa
sec
sbc #__player_take_warp_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_warp_pending + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_17
+
bra __local_18
__local_17:
lda.w #0
sta.b tcc__r0
jmp.w __local_19
__local_18:
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_warp_pending + 0
rep #$20
lda 3 + __player_take_warp_locals + 1,s
sta.b tcc__r0
lda 5 + __player_take_warp_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_warp_dest_scene + 0
sta.b [tcc__r0]
rep #$20
lda 7 + __player_take_warp_locals + 1,s
sta.b tcc__r0
lda 9 + __player_take_warp_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_warp_dest_x + 0
sta.b [tcc__r0]
rep #$20
lda 11 + __player_take_warp_locals + 1,s
sta.b tcc__r0
lda 13 + __player_take_warp_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_warp_dest_y + 0
rep #$20
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #1
sta.b tcc__r0
__local_19:
__local_20:
.ifgr __player_take_warp_locals 0
tsa
clc
adc #__player_take_warp_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_blockedtext_0x7" SUPERFREE
tccs_{WLA_FILENAME}_blocked:
.ifgr __tccs_{WLA_FILENAME}_blocked_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_blocked_locals
tas
.endif
lda 3 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
lsr a
lsr a
lsr a
lsr a
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
lsr a
lsr a
lsr a
lsr a
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
rep #$20
lda 3 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
clc
adc.w #15
lsr a
lsr a
lsr a
lsr a
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
clc
adc.w #15
lsr a
lsr a
lsr a
lsr a
sep #$20
sta -4 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_21
+
lda.w #1
sta.b tcc__r0
jmp.w __local_22
__local_21:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
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
brl __local_23
+
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_23:
brl __local_24
+
lda.w #1
sta.b tcc__r0
jmp.w __local_25
__local_24:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
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
brl __local_26
+
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_27
+
lda.w #1
sta.b tcc__r0
jmp.w __local_28
__local_27:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
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
brl __local_29
+
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_blocked_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_29:
brl __local_30
+
lda.w #1
sta.b tcc__r0
bra __local_31
__local_30:
__local_26:
lda.w #0
sta.b tcc__r0
__local_22:
__local_25:
__local_28:
__local_31:
__local_32:
.ifgr __tccs_{WLA_FILENAME}_blocked_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_blocked_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_edge_blockedtext_0x8" SUPERFREE
tccs_{WLA_FILENAME}_edge_blocked:
.ifgr __tccs_{WLA_FILENAME}_edge_blocked_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_edge_blocked_locals
tas
.endif
lda.w player + 0
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
rep #$20
lda.w player + 2
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
rep #$20
lda 3 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
rep #$20
lda 5 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
sta -4 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
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
brl __local_33
+
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
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
__local_33:
brl __local_34
+
lda.w #0
sta.b tcc__r0
jmp.w __local_35
__local_34:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
pha
rep #$20
jsr.l scene_collision
pla
lda.b tcc__r0
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 7 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #1
sta.b tcc__r2
ldy.b tcc__r1
beq +
-
asl a
dey
bne -
+
and.w #255
sta.b tcc__r2
and.b tcc__r0
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_36
+
lda.w #1
sta.b tcc__r0
jmp.w __local_37
__local_36:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
pha
rep #$20
jsr.l scene_collision
pla
lda.b tcc__r0
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 7 + __tccs_{WLA_FILENAME}_edge_blocked_locals + 1,s
rep #$20
eor.w #1
sta.b tcc__r1
lda.w #1
sta.b tcc__r2
ldy.b tcc__r1
beq +
-
asl a
dey
bne -
+
and.w #255
sta.b tcc__r2
and.b tcc__r0
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_38
+
lda.w #1
sta.b tcc__r0
bra __local_39
__local_38:
lda.w #0
sta.b tcc__r0
__local_35:
__local_37:
__local_39:
__local_40:
.ifgr __tccs_{WLA_FILENAME}_edge_blocked_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_edge_blocked_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_slide_vtext_0x9" SUPERFREE
tccs_{WLA_FILENAME}_slide_v:
.ifgr __tccs_{WLA_FILENAME}_slide_v_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_slide_v_locals
tas
.endif
lda.w player + 2
lsr a
lsr a
lsr a
lsr a
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
rep #$20
lda.w player + 2
clc
adc.w #15
lsr a
lsr a
lsr a
lsr a
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
rep #$20
lda.w player + 2
and.w #15
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
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
brl __local_41
+
jmp.w __local_42
__local_41:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_43
+
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_44
+
jmp.w __local_45
__local_44:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #16
sec
sbc.b tcc__r0
sta.b tcc__r1
ldx #1
sec
sbc.w #8
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
brl __local_46
+
lda.w player + 2
sta.b tcc__r0
inc.b tcc__r0
pei (tcc__r0)
lda.w player + 0
pha
jsr.l tccs_{WLA_FILENAME}_blocked
tsa
clc
adc #4
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_47
+
bra __local_48
__local_47:
lda.w player + 2
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w player + 2
__local_46:
__local_48:
jmp.w __local_49
__local_43:
__local_45:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_50
+
bra __local_51
__local_50:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_51:
brl __local_52
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_slide_v_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #8
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
brl __local_53
+
lda.w player + 2
sta.b tcc__r0
dec.b tcc__r0
pei (tcc__r0)
lda.w player + 0
pha
jsr.l tccs_{WLA_FILENAME}_blocked
tsa
clc
adc #4
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_54
+
bra __local_55
__local_54:
lda.w player + 2
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #65535
sta.b tcc__r0
sta.w player + 2
__local_53:
__local_55:
__local_52:
__local_49:
__local_42:
.ifgr __tccs_{WLA_FILENAME}_slide_v_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_slide_v_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_slide_htext_0xa" SUPERFREE
tccs_{WLA_FILENAME}_slide_h:
.ifgr __tccs_{WLA_FILENAME}_slide_h_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_slide_h_locals
tas
.endif
lda.w player + 0
lsr a
lsr a
lsr a
lsr a
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
rep #$20
lda.w player + 0
clc
adc.w #15
lsr a
lsr a
lsr a
lsr a
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
rep #$20
lda.w player + 0
and.w #15
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
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
brl __local_56
+
jmp.w __local_57
__local_56:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_58
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_59
+
jmp.w __local_60
__local_59:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #16
sec
sbc.b tcc__r0
sta.b tcc__r1
ldx #1
sec
sbc.w #8
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
brl __local_61
+
lda.w player + 0
inc a
sta.b tcc__r0
lda.w player + 2
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_blocked
tsa
clc
adc #4
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_62
+
bra __local_63
__local_62:
lda.w player + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w player + 0
__local_61:
__local_63:
jmp.w __local_64
__local_58:
__local_60:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_65
+
bra __local_66
__local_65:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_tile_blocked
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_66:
brl __local_67
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_slide_h_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #8
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
brl __local_68
+
lda.w player + 0
dec a
sta.b tcc__r0
lda.w player + 2
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_blocked
tsa
clc
adc #4
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_69
+
bra __local_70
__local_69:
lda.w player + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #65535
sta.b tcc__r0
sta.w player + 0
__local_68:
__local_70:
__local_67:
__local_64:
__local_57:
.ifgr __tccs_{WLA_FILENAME}_slide_h_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_slide_h_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_player_try_interacttext_0xb" SUPERFREE
tccs_{WLA_FILENAME}_player_try_interact:
.ifgr __tccs_{WLA_FILENAME}_player_try_interact_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_player_try_interact_locals
tas
.endif
lda.w player + 0
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
lda.w player + 2
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w player + 4
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_71
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_72
+
jmp.w __local_73
__local_72:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
jmp.w __local_74
__local_71:
lda.w #0
sep #$20
lda.w player + 4
rep #$20
sta.b tcc__r0
cmp #3
beq +
brl __local_75
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
jmp.w __local_76
__local_75:
lda.w #0
sep #$20
lda.w player + 4
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_77
+
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_78
+
jmp.w __local_79
__local_78:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
bra __local_80
__local_77:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
__local_80:
__local_76:
__local_74:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
pha
rep #$20
jsr.l actor_at_tile
pla
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_81
+
lda.w player + 0
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w player + 2
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
pha
lda.b tcc__r0
pha
rep #$20
jsr.l actor_standing_at
pla
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
rep #$20
__local_81:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
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
brl __local_82
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_player_try_interact_locals + 1,s
pha
rep #$20
jsr.l actor_interact
tsa
clc
adc #1
tas
__local_82:
__local_73:
__local_79:
.ifgr __tccs_{WLA_FILENAME}_player_try_interact_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_player_try_interact_locals
tas
.endif
rtl
.ENDS
.SECTION ".player_inittext_0xc" SUPERFREE
player_init:
.ifgr __player_init_locals 0
tsa
sec
sbc #__player_init_locals
tas
.endif
lda.w #0
sep #$20
lda.l scene_ctx + 34
pha
rep #$20
lda.w #0
sep #$20
lda.l scene_ctx + 33
pha
rep #$20
jsr.l player_set_pos
pla
lda.w #0
sep #$20
sta.w player + 4
rep #$20
lda.w #0
sep #$20
sta.w player + 5
rep #$20
lda.w #0
sep #$20
sta.w player + 6
rep #$20
lda.w #0
sep #$20
sta.w player + 7
rep #$20
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
lda.w #0
sep #$20
lda.l scene_ctx + 31
rep #$20
asl a
asl a
sta.b tcc__r2
lda.w #:sprite_pals
sta.b tcc__r3h
lda.w #sprite_pals + 0
clc
adc.b tcc__r2
sta.b tcc__r3
sep #$20
lda #96
pha
rep #$20
pea.w 16384
sep #$20
lda #0
pha
rep #$20
pea.w 256
ldy #0
lda.b [tcc__r3],y
sta.b tcc__r2
iny
iny
lda.b [tcc__r3],y
pha
pei (tcc__r2)
lda.b [tcc__r0]
pha
ldy #0
lda.b [tcc__r1],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r1],y
pha
pei (tcc__r0)
jsr.l oamInitGfxSet
tsa
clc
adc #16
tas
jsr.l weather_load
jsr.l vig_reload
sep #$20
lda #0
pha
rep #$20
pea.w 0
pea.w (0 * 256 + 0)
sep #$20
lda #2
pha
rep #$20
lda.w player + 2
pha
lda.w player + 0
pha
pea.w 0
jsr.l oamSet
tsa
clc
adc #12
tas
sep #$20
lda #0
pha
rep #$20
pea.w 0
pea.w (0 * 256 + 0)
sep #$20
lda #2
pha
rep #$20
lda.w player + 2
pha
lda.w player + 0
pha
pea.w 4
jsr.l oamSet
tsa
clc
adc #12
tas
pea.w (0 * 256 + 0)
sep #$20
rep #$20
pea.w 0
jsr.l oamSetEx
tsa
clc
adc #4
tas
pea.w (0 * 256 + 0)
sep #$20
rep #$20
pea.w 4
jsr.l oamSetEx
tsa
clc
adc #4
tas
.ifgr __player_init_locals 0
tsa
clc
adc #__player_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".player_updatetext_0xd" SUPERFREE
player_update:
.ifgr __player_update_locals 0
tsa
sec
sbc #__player_update_locals
tas
.endif
lda.l pad_keys + 0
sta -2 + __player_update_locals + 1,s
lda.w #0
sep #$20
lda.l scene_ctx + 1
rep #$20
asl a
asl a
asl a
asl a
sec
sbc.w #16
sta -4 + __player_update_locals + 1,s
lda.w #0
sep #$20
lda.l scene_ctx + 2
rep #$20
asl a
asl a
asl a
asl a
sec
sbc.w #16
sta -6 + __player_update_locals + 1,s
lda -2 + __player_update_locals + 1,s
and.w #768
sta.b tcc__r0
ldx #1
sec
sbc #768
tay
beq +
dex
+
stx.b tcc__r5
txa
beq +
brl __local_83
+
lda -2 + __player_update_locals + 1,s
and.w #3072
sta.b tcc__r0
ldx #1
sec
sbc #3072
tay
beq +
dex
+
stx.b tcc__r5
txa
beq +
__local_83:
brl __local_84
+
bra __local_85
__local_84:
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __player_update_locals + 1,s
__local_85:
lda.w #0
sep #$20
sta.w player + 5
rep #$20
lda -2 + __player_update_locals + 1,s
and.w #512
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_86
+
lda.w #2
sep #$20
sta.w player + 4
rep #$20
lda.w #1
sep #$20
sta.w player + 5
rep #$20
lda.w player + 0
sta.b tcc__r0
ldx #1
sec
sbc.w #0
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_87
+
lda.w player + 0
dec a
sta.b tcc__r0
lda.w player + 2
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_blocked
tsa
clc
adc #4
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_88
+
jmp.w __local_89
__local_88:
lda.w player + 0
sta.b tcc__r0
dec.b tcc__r0
sep #$20
lda #2
pha
rep #$20
lda.w player + 2
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_edge_blocked
tsa
clc
adc #5
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_90
+
bra __local_91
__local_90:
lda.w player + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #65535
sta.b tcc__r0
sta.w player + 0
bra __local_92
__local_89:
__local_91:
lda.w player + 0
dec a
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_slide_v
tsa
clc
adc #1
tas
__local_92:
__local_87:
jmp.w __local_93
__local_86:
lda -2 + __player_update_locals + 1,s
and.w #256
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_94
+
lda.w #3
sep #$20
sta.w player + 4
rep #$20
lda.w #1
sep #$20
sta.w player + 5
rep #$20
lda.w player + 0
sta.b tcc__r0
lda -4 + __player_update_locals + 1,s
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
brl __local_95
+
lda.w player + 0
inc a
sta.b tcc__r0
lda.w player + 2
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_blocked
tsa
clc
adc #4
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_96
+
jmp.w __local_97
__local_96:
lda.w player + 0
sta.b tcc__r0
inc.b tcc__r0
sep #$20
lda #3
pha
rep #$20
lda.w player + 2
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_edge_blocked
tsa
clc
adc #5
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_98
+
bra __local_99
__local_98:
lda.w player + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w player + 0
bra __local_100
__local_97:
__local_99:
lda.w player + 0
clc
adc.w #16
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_slide_v
tsa
clc
adc #1
tas
__local_100:
__local_95:
jmp.w __local_101
__local_94:
lda -2 + __player_update_locals + 1,s
and.w #2048
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_102
+
lda.w #1
sep #$20
sta.w player + 4
rep #$20
lda.w #1
sep #$20
sta.w player + 5
rep #$20
lda.w player + 2
sta.b tcc__r0
ldx #1
sec
sbc.w #0
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_103
+
lda.w player + 2
sta.b tcc__r0
dec.b tcc__r0
pei (tcc__r0)
lda.w player + 0
pha
jsr.l tccs_{WLA_FILENAME}_blocked
tsa
clc
adc #4
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_104
+
jmp.w __local_105
__local_104:
lda.w player + 2
sta.b tcc__r0
dec.b tcc__r0
sep #$20
lda #1
pha
rep #$20
pei (tcc__r0)
lda.w player + 0
pha
jsr.l tccs_{WLA_FILENAME}_edge_blocked
tsa
clc
adc #5
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_106
+
bra __local_107
__local_106:
lda.w player + 2
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #65535
sta.b tcc__r0
sta.w player + 2
bra __local_108
__local_105:
__local_107:
lda.w player + 2
dec a
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_slide_h
tsa
clc
adc #1
tas
__local_108:
__local_103:
jmp.w __local_109
__local_102:
lda -2 + __player_update_locals + 1,s
and.w #1024
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_110
+
lda.w #0
sep #$20
sta.w player + 4
rep #$20
lda.w #1
sep #$20
sta.w player + 5
rep #$20
lda.w player + 2
sta.b tcc__r0
lda -6 + __player_update_locals + 1,s
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
brl __local_111
+
lda.w player + 2
sta.b tcc__r0
inc.b tcc__r0
pei (tcc__r0)
lda.w player + 0
pha
jsr.l tccs_{WLA_FILENAME}_blocked
tsa
clc
adc #4
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_112
+
jmp.w __local_113
__local_112:
lda.w player + 2
sta.b tcc__r0
inc.b tcc__r0
sep #$20
lda #0
pha
rep #$20
pei (tcc__r0)
lda.w player + 0
pha
jsr.l tccs_{WLA_FILENAME}_edge_blocked
tsa
clc
adc #5
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_114
+
bra __local_115
__local_114:
lda.w player + 2
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w player + 2
bra __local_116
__local_113:
__local_115:
lda.w player + 2
clc
adc.w #16
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_slide_h
tsa
clc
adc #1
tas
__local_116:
__local_111:
__local_110:
__local_109:
__local_101:
__local_93:
jsr.l tccs_{WLA_FILENAME}_check_warp
lda.l pad_keysdown + 0
and.w #128
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_117
+
jsr.l tccs_{WLA_FILENAME}_player_try_interact
__local_117:
lda.w #0
sep #$20
lda.w player + 5
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_118
+
lda.w #0
sep #$20
lda.w player + 7
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w player + 7
rep #$20
lda.w #0
sep #$20
lda.w player + 7
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #8
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
brl __local_119
+
lda.w #0
sep #$20
sta.w player + 7
rep #$20
lda.w #0
sep #$20
lda.w player + 6
rep #$20
inc a
and.w #3
sta.b tcc__r0
sep #$20
sta.w player + 6
rep #$20
__local_119:
bra __local_120
__local_118:
lda.w #0
sep #$20
sta.w player + 7
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w player + 6
rep #$20
__local_120:
.ifgr __player_update_locals 0
tsa
clc
adc #__player_update_locals
tas
.endif
rtl
.ENDS
.SECTION ".player_drawtext_0xe" SUPERFREE
player_draw:
.ifgr __player_draw_locals 0
tsa
sec
sbc #__player_draw_locals
tas
.endif
lda.w player + 0
sta.b tcc__r0
lda.l camera + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta -2 + __player_draw_locals + 1,s
lda.w player + 2
sta.b tcc__r0
lda.l camera + 2
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta -4 + __player_draw_locals + 1,s
lda.w #0
sep #$20
lda.w player + 6
rep #$20
and.w #1
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_121
+
lda.w #0
sep #$20
lda.w player + 6
rep #$20
sta.b tcc__r0
cmp #$8000
ror.b tcc__r0
inc.b tcc__r0
lda.b tcc__r0
and.w #255
sta.b tcc__r0
bra __local_122
__local_121:
lda.w #0
sta.b tcc__r0
__local_122:
__local_123:
sep #$20
lda.b tcc__r0
sta -5 + __player_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w player + 4
rep #$20
sta.b tcc__r0
asl a
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda -5 + __player_draw_locals + 1,s
rep #$20
sta.b tcc__r1
clc
adc.b tcc__r0
and.w #255
sta.b tcc__r0
sep #$20
sta -6 + __player_draw_locals + 1,s
rep #$20
lda.w #:oamMemory
sta.b tcc__r0h
lda.w #oamMemory + 0
sta.b tcc__r0
sta -12 + __player_draw_locals + 1,s
lda.b tcc__r0h
sta -10 + __player_draw_locals + 1,s
lda -2 + __player_draw_locals + 1,s
and.w #255
sta -14 + __player_draw_locals + 1,s
lda -4 + __player_draw_locals + 1,s
sec
sbc.w #8
and.w #255
sta -16 + __player_draw_locals + 1,s
lda.w #0
sep #$20
lda -6 + __player_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pl_lastf + 0
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
brl __local_124
+
lda.w #0
sep #$20
lda -6 + __player_draw_locals + 1,s
rep #$20
and.w #248
asl a
asl a
asl a
sta.b tcc__r0
lda.w #0
sep #$20
lda -6 + __player_draw_locals + 1,s
rep #$20
and.w #7
asl a
ora.b tcc__r0
sta -18 + __player_draw_locals + 1,s
lda.w #32
sta -20 + __player_draw_locals + 1,s
lda -18 + __player_draw_locals + 1,s
and.w #255
sta.b tcc__r0
lda -18 + __player_draw_locals + 1,s
xba
and #$00ff
sta.b tcc__r1
lda -20 + __player_draw_locals + 1,s
ora.b tcc__r1
xba
and #$ff00
ora.b tcc__r0
sta.l tccs_{WLA_FILENAME}_pl_w1 + 0
lda -18 + __player_draw_locals + 1,s
clc
adc.w #32
sta -18 + __player_draw_locals + 1,s
and.w #255
sta.b tcc__r0
lda -18 + __player_draw_locals + 1,s
xba
and #$00ff
sta.b tcc__r1
lda -20 + __player_draw_locals + 1,s
ora.b tcc__r1
xba
and #$ff00
sta.b tcc__r2
ora.b tcc__r0
sta.l tccs_{WLA_FILENAME}_pl_w3 + 0
lda.w #0
sep #$20
lda -6 + __player_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_pl_lastf + 0
rep #$20
__local_124:
lda -12 + __player_draw_locals + 1,s
sta.b tcc__r0
lda -10 + __player_draw_locals + 1,s
sta.b tcc__r0h
lda -16 + __player_draw_locals + 1,s
xba
and #$ff00
sta.b tcc__r1
lda -14 + __player_draw_locals + 1,s
ora.b tcc__r1
sta.b [tcc__r0]
lda -10 + __player_draw_locals + 1,s
sta.b tcc__r0h
lda -12 + __player_draw_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_pl_w1 + 0
sta.b [tcc__r0]
lda -12 + __player_draw_locals + 1,s
sta.b tcc__r0
lda -10 + __player_draw_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda -16 + __player_draw_locals + 1,s
clc
adc.w #16
and.w #255
xba
and #$ff00
sta.b tcc__r1
lda -14 + __player_draw_locals + 1,s
ora.b tcc__r1
sta.b tcc__r2
sta.b [tcc__r0]
lda -12 + __player_draw_locals + 1,s
sta.b tcc__r0
lda -10 + __player_draw_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #6
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_pl_w3 + 0
sta.b tcc__r1
sta.b [tcc__r0]
lda -2 + __player_draw_locals + 1,s
and.w #256
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_125
+
bra __local_126
__local_125:
lda.w #0
sta.b tcc__r0
bra __local_127
__local_126:
lda.w #1
sta.b tcc__r0
__local_127:
sep #$20
lda.b tcc__r0
sta -5 + __player_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -5 + __player_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_pl_x9 + 0
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
brl __local_128
+
lda.w #0
sep #$20
lda -5 + __player_draw_locals + 1,s
sta.l tccs_{WLA_FILENAME}_pl_x9 + 0
rep #$20
lda.w #0
sep #$20
lda -5 + __player_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_129
+
lda.w #0
sep #$20
lda.l oamMemory + 512
rep #$20
ora.w #5
sta.b tcc__r0
sep #$20
sta.l oamMemory + 512
rep #$20
bra __local_130
__local_129:
lda.w #0
sep #$20
lda.l oamMemory + 512
rep #$20
and.w #250
sta.b tcc__r0
sep #$20
sta.l oamMemory + 512
rep #$20
__local_130:
__local_128:
.ifgr __player_draw_locals 0
tsa
clc
adc #__player_draw_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_prev_ctx dsb 1
tccs_{WLA_FILENAME}_prev_cty dsb 1
tccs_{WLA_FILENAME}_warp_pending dsb 1
tccs_{WLA_FILENAME}_warp_dest_scene dsb 1
tccs_{WLA_FILENAME}_warp_dest_x dsb 1
tccs_{WLA_FILENAME}_warp_dest_y dsb 1
tccs_{WLA_FILENAME}_warp_dest_dir dsb 1
tccs_{WLA_FILENAME}_warp_dest_trans dsb 1
tccs_{WLA_FILENAME}_pl_lastf dsb 2
tccs_{WLA_FILENAME}_pl_w1 dsb 2
tccs_{WLA_FILENAME}_pl_w3 dsb 2
tccs_{WLA_FILENAME}_pl_x9 dsb 1
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
.db $ff,$0
.db $0,$0
.db $0,$0
.db $0
.ENDS
.SECTION ".rodata" SUPERFREE
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
player dsb 8
.ENDS
