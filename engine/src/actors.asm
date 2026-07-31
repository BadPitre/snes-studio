.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_mv_rand_locals 0
.define __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals 12
.define __tccs_{WLA_FILENAME}_page_cond_ok_locals 0
.define __tccs_{WLA_FILENAME}_actors_apply_page_route_locals 6
.define __actors_resolve_pages_locals 8
.define __actors_init_locals 8
.define __tccs_{WLA_FILENAME}_actor_oam_pair_locals 16
.define __actors_draw_locals 52
.define __tccs_{WLA_FILENAME}_mv_blocked_locals 1
.define __actors_set_route_locals 0
.define __actors_set_pos_locals 0
.define __actors_swap_pos_locals 2
.define __actors_route_freq_locals 0
.define __actors_route_bind_freq_locals 0
.define __actors_routes_busy_locals 1
.define __tccs_{WLA_FILENAME}_dir_toward_player_locals 4
.define __tccs_{WLA_FILENAME}_route_tick_locals 5
.define __actors_update_locals 13
.define __actor_at_tile_locals 8
.define __actor_standing_at_locals 8
.define __actor_trigger_at_locals 8
.define __actors_autorun_locals 12
.define __actor_face_locals 0
.define __actor_interact_locals 2
.define __actor_pos_x_locals 0
.define __actor_pos_y_locals 0
.SECTION ".tccs_{WLA_FILENAME}_mv_randtext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_mv_rand:
.ifgr __tccs_{WLA_FILENAME}_mv_rand_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_mv_rand_locals
tas
.endif
lda.w tccs_{WLA_FILENAME}_mv_seed + 0
sta.b tcc__r0
ldy.w #7
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_mv_seed + 0
eor.b tcc__r0
sta.b tcc__r1
sta.w tccs_{WLA_FILENAME}_mv_seed + 0
lda.w tccs_{WLA_FILENAME}_mv_seed + 0
sta.b tcc__r0
ldy.w #9
-
lsr a
dey
bne -
+
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_mv_seed + 0
eor.b tcc__r0
sta.w tccs_{WLA_FILENAME}_mv_seed + 0
lda.w tccs_{WLA_FILENAME}_mv_seed + 0
xba
and #$ff00
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_mv_seed + 0
eor.b tcc__r0
sta.b tcc__r1
sta.w tccs_{WLA_FILENAME}_mv_seed + 0
lda.w tccs_{WLA_FILENAME}_mv_seed + 0
sta.b tcc__r0
__local_0:
.ifgr __tccs_{WLA_FILENAME}_mv_rand_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_mv_rand_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_actors_rebuild_blockerstext_0x1" SUPERFREE
tccs_{WLA_FILENAME}_actors_rebuild_blockers:
.ifgr __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals
tas
.endif
lda.w #0
sep #$20
sta -4 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.l scene_ctx + 3
sta -5 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
lda.w #255
sep #$20
sta.l tccs_{WLA_FILENAME}_blk_x0 + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_blk_x1 + 0
rep #$20
lda.w #255
sep #$20
sta.l tccs_{WLA_FILENAME}_blk_y0 + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_blk_y1 + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_blk_ovf + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
__local_3:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -5 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_1
+
bra __local_2
__local_8:
__local_10:
__local_13:
__local_20:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
jmp.w __local_3
__local_2:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #24
bvc +
eor #$8000
+
bmi +
brl __local_4
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
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
brl __local_5
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_prio
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_prio + 0
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
sbc #1
tay
bne +
dex
+
stx.b tcc__r5
txa
beq +
__local_5:
brl __local_6
+
bra __local_7
__local_6:
jmp.w __local_8
__local_7:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_kind
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_kind + 0
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
sbc #1
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_9
+
jmp.w __local_10
__local_9:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
jmp.w __local_11
__local_4:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
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
sta.b tcc__r1
sta -12 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
lda.b tcc__r1h
sta -10 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
lda -12 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc #1
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_12
+
jmp.w __local_13
__local_12:
lda -10 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
sta.b tcc__r0h
lda -12 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta -2 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
lda -10 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
sta.b tcc__r0h
lda -12 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
__local_11:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
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
brl __local_14
+
lda.w #1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_blk_ovf + 0
rep #$20
jmp.w __local_15
__local_14:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_blk_tx
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_blk_tx + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_blk_ty
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_blk_ty + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_blk_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_blk_id + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_blk_x0 + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_16
+
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_blk_x0 + 0
rep #$20
__local_16:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_blk_x1 + 0
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
brl __local_17
+
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_blk_x1 + 0
rep #$20
__local_17:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_blk_y0 + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_18
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_blk_y0 + 0
rep #$20
__local_18:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_blk_y1 + 0
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
brl __local_19
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_blk_y1 + 0
rep #$20
__local_19:
jmp.w __local_20
__local_1:
__local_15:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_blk_n + 0
rep #$20
.ifgr __tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_actors_rebuild_blockers_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_page_cond_oktext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_page_cond_ok:
.ifgr __tccs_{WLA_FILENAME}_page_cond_ok_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_page_cond_ok_locals
tas
.endif
lda 3 + __tccs_{WLA_FILENAME}_page_cond_ok_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_page_cond_ok_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #7
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
and.w #7
sta.b tcc__r1
bra __local_21
bra __local_22
__local_21:
lda.b tcc__r1
cmp #1
beq +
brl __local_23
+
__local_22:
lda 3 + __tccs_{WLA_FILENAME}_page_cond_ok_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_page_cond_ok_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #8
sta.b tcc__r0
lda.b [tcc__r0]
pha
jsr.l vm_switch_get
pla
jmp.w __local_24
bra __local_25
__local_23:
lda.b tcc__r1
cmp #2
beq +
brl __local_26
+
__local_25:
lda 3 + __tccs_{WLA_FILENAME}_page_cond_ok_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_page_cond_ok_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #8
sta.b tcc__r0
lda.b [tcc__r0]
pha
jsr.l vm_switch_get
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_27
+
lda #0
bra +
__local_27:
lda #1
+
and.w #255
sta.b tcc__r0
jmp.w __local_28
bra __local_29
__local_26:
lda.b tcc__r1
cmp #3
beq +
brl __local_30
+
__local_29:
lda 3 + __tccs_{WLA_FILENAME}_page_cond_ok_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_page_cond_ok_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #8
sta.b tcc__r0
lda.b [tcc__r0]
and.w #255
asl a
sta.b tcc__r1
lda.w #:vm
sta.b tcc__r0h
lda.w #vm + 196
clc
adc.b tcc__r1
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_page_cond_ok_locals + 1,s
sta.b tcc__r1
lda 5 + __tccs_{WLA_FILENAME}_page_cond_ok_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.w #10
sta.b tcc__r1
lda.b [tcc__r0]
sta.b tcc__r2
lda.b [tcc__r1]
sta.b tcc__r0
ldx #1
lda.b tcc__r2
sec
sbc.b tcc__r0
tay
bcs ++
+ dex
++
txa
and.w #255
sta.b tcc__r5
sta.b tcc__r0
lda.b tcc__r5h
sta.b tcc__r0h
bra __local_31
__local_30:
lda.w #1
sta.b tcc__r0
__local_24:
__local_28:
__local_31:
__local_32:
.ifgr __tccs_{WLA_FILENAME}_page_cond_ok_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_page_cond_ok_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_actors_apply_page_routetext_0x3" SUPERFREE
tccs_{WLA_FILENAME}_actors_apply_page_route:
.ifgr __tccs_{WLA_FILENAME}_actors_apply_page_route_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_actors_apply_page_route_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
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
sta.b tcc__r1
sta -4 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
lda.b tcc__r1h
sta -2 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
lda -4 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #7
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
and.w #56
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
sta.b tcc__r1
ldx #1
sec
sbc #4
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_33
+
jmp.w __local_34
__local_33:
lda -4 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #14
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r1
sta -6 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
sta.b tcc__r0
cmp #65535
beq +
brl __local_35
+
jmp.w __local_36
__local_35:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_freq
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_freq + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -6 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
inc a
sta.b tcc__r0
lda.l scene_ctx + 20
sta.b tcc__r2
lda.l scene_ctx + 20 + 2
sta.b tcc__r2h
clc
lda.b tcc__r2
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_freq
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_freq + 0
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
sbc.w #1
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
beq +
brl __local_37
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_freq
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_freq + 0
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
beq +
__local_37:
brl __local_38
+
bra __local_39
__local_38:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_freq
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_freq + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #3
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_39:
lda -6 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
clc
adc.w #3
sta.b tcc__r0
lda.l scene_ctx + 20
sta.b tcc__r1
lda.l scene_ctx + 20 + 2
sta.b tcc__r1h
lda -6 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
clc
adc.b tcc__r1
sta.b tcc__r1
lda -6 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
inc a
inc a
sta.b tcc__r2
lda.l scene_ctx + 20
sta.b tcc__r3
lda.l scene_ctx + 20 + 2
sta.b tcc__r3h
clc
lda.b tcc__r3
adc.b tcc__r2
sta.b tcc__r3
lda.w #0
sep #$20
lda.b [tcc__r3]
pha
rep #$20
lda.w #0
sep #$20
lda.b [tcc__r1]
pha
rep #$20
pei (tcc__r0)
lda.w #0
sep #$20
lda 7 + __tccs_{WLA_FILENAME}_actors_apply_page_route_locals + 1,s
pha
rep #$20
jsr.l actors_set_route
tsa
clc
adc #5
tas
__local_34:
__local_36:
.ifgr __tccs_{WLA_FILENAME}_actors_apply_page_route_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_actors_apply_page_route_locals
tas
.endif
rtl
.ENDS
.SECTION ".actors_resolve_pagestext_0x4" SUPERFREE
actors_resolve_pages:
.ifgr __actors_resolve_pages_locals 0
tsa
sec
sbc #__actors_resolve_pages_locals
tas
.endif
lda.l scene_ctx + 16 + 2
sta.b tcc__r0h
lda.l scene_ctx + 16
sta.b tcc__r0
sta -8 + __actors_resolve_pages_locals + 1,s
lda.b tcc__r0h
sta -6 + __actors_resolve_pages_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __actors_resolve_pages_locals + 1,s
rep #$20
__local_43:
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
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
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
__local_40:
brl __local_41
+
bra __local_42
__local_63:
lda.w #0
sep #$20
lda -2 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta -1 + __actors_resolve_pages_locals + 1,s
rep #$20
jmp.w __local_43
__local_42:
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
sta -3 + __actors_resolve_pages_locals + 1,s
lda.b #255
sta -4 + __actors_resolve_pages_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta -2 + __actors_resolve_pages_locals + 1,s
rep #$20
__local_50:
lda.w #0
sep #$20
lda -2 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_44
+
lda.w #0
sep #$20
lda -2 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
__local_44:
brl __local_45
+
lda.w #0
sep #$20
lda -2 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __actors_resolve_pages_locals + 1,s
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
beq +
brl __local_46
+
lda.w #0
sep #$20
lda -2 + __actors_resolve_pages_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda -8 + __actors_resolve_pages_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_resolve_pages_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
clc
adc.w #7
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
and.w #128
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
__local_46:
brl __local_47
+
jmp.w __local_48
__local_47:
bra __local_49
__local_52:
lda.w #0
sep #$20
lda -2 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __actors_resolve_pages_locals + 1,s
rep #$20
jmp.w __local_50
__local_49:
lda.w #0
sep #$20
lda -2 + __actors_resolve_pages_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda -8 + __actors_resolve_pages_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_resolve_pages_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
pei (tcc__r1h)
pha
jsr.l tccs_{WLA_FILENAME}_page_cond_ok
tsa
clc
adc #4
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_51
+
lda.w #0
sep #$20
lda -2 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta -4 + __actors_resolve_pages_locals + 1,s
rep #$20
__local_51:
jmp.w __local_52
__local_45:
__local_48:
lda.w #0
sep #$20
lda -3 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta -1 + __actors_resolve_pages_locals + 1,s
rep #$20
__local_55:
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_53
+
bra __local_54
__local_62:
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actors_resolve_pages_locals + 1,s
rep #$20
jmp.w __local_55
__local_54:
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
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
brl __local_56
+
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __actors_resolve_pages_locals + 1,s
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
__local_56:
brl __local_57
+
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
asl.b tcc__r0
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
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
asl a
clc
adc.w #3
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
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_shown
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_shown + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_lastf
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_lastf + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_x9
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_x9 + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #65535
sta.b tcc__r0
sta.b [tcc__r1]
__local_57:
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __actors_resolve_pages_locals + 1,s
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
brl __local_58
+
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
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
brl __local_59
+
bra __local_60
__local_59:
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #1
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_actors_apply_page_route
tsa
clc
adc #1
tas
jmp.w __local_61
__local_58:
__local_60:
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __actors_resolve_pages_locals + 1,s
rep #$20
sta.b tcc__r2
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r2
tay
beq +
dex
+
stx.b tcc__r5
sep #$20
lda.b tcc__r5
sta.b [tcc__r1]
rep #$20
__local_61:
jmp.w __local_62
__local_53:
jmp.w __local_63
__local_41:
jsr.l tccs_{WLA_FILENAME}_actors_rebuild_blockers
.ifgr __actors_resolve_pages_locals 0
tsa
clc
adc #__actors_resolve_pages_locals
tas
.endif
rtl
.ENDS
.SECTION ".actors_inittext_0x5" SUPERFREE
actors_init:
.ifgr __actors_init_locals 0
tsa
sec
sbc #__actors_init_locals
tas
.endif
lda.l scene_ctx + 16 + 2
sta.b tcc__r0h
lda.l scene_ctx + 16
sta.b tcc__r0
sta -8 + __actors_init_locals + 1,s
lda.b tcc__r0h
sta -6 + __actors_init_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __actors_init_locals + 1,s
rep #$20
__local_66:
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #24
bvc +
eor #$8000
+
bmi +
brl __local_64
+
bra __local_65
__local_67:
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actors_init_locals + 1,s
rep #$20
bra __local_66
__local_65:
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
asl.b tcc__r0
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
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
clc
adc.w #3
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
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_anim
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_anim + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_timer
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_timer + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #13
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
clc
adc.w #20
and.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #65535
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_len
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_len + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_flags
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_flags + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_wait
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_wait + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_speed
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_speed + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #1
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_freq
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_freq + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #3
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirfix
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirfix + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_thru
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_thru + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_gfx
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_gfx + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_mvdir
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_mvdir + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_prio
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_prio + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #1
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_sprite
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_sprite + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_kind
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_kind + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_movet
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_movet + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_fbase
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_fbase + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_shown
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_shown + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_lastf
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_lastf + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_x9
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_x9 + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_67
__local_64:
lda.w #44257
sta.w tccs_{WLA_FILENAME}_mv_seed + 0
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_mv_phase + 0
rep #$20
jsr.l actors_resolve_pages
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __actors_init_locals + 1,s
rep #$20
__local_70:
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_68
+
bra __local_69
__local_76:
__local_77:
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actors_init_locals + 1,s
rep #$20
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #16
sta.b tcc__r0
sta -8 + __actors_init_locals + 1,s
lda.b tcc__r0h
sta -6 + __actors_init_locals + 1,s
jmp.w __local_70
__local_69:
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #24
bvc +
eor #$8000
+
bmi +
brl __local_71
+
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #6
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
lda -8 + __actors_init_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
asl a
asl a
asl a
asl a
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
lda -8 + __actors_init_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
asl a
asl a
asl a
asl a
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_prio
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_prio + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #12
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
and.w #3
sta.b tcc__r2
sep #$20
sta.b [tcc__r1]
rep #$20
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #12
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
sta.b tcc__r1
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
brl __local_72
+
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #12
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
sta.b tcc__r1
ldx #1
sec
sbc.w #4
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
__local_72:
brl __local_73
+
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_speed
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_speed + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #12
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
sta.b tcc__r2
sep #$20
sta.b [tcc__r1]
rep #$20
__local_73:
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_sprite
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_sprite + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_kind
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_kind + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_movet
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_movet + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #7
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
and.w #56
cmp #$8000
ror a
cmp #$8000
ror a
cmp #$8000
ror a
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_fbase
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_fbase + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r2
lda.w #12
sta.b tcc__r9
lda.b tcc__r2
sta.b tcc__r10
jsr.l tcc__mul
and.w #255
sta.b tcc__r2
sep #$20
sta.b [tcc__r1]
rep #$20
__local_71:
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
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
brl __local_74
+
bra __local_75
__local_74:
jmp.w __local_76
__local_75:
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
asl.b tcc__r0
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.w #3
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r2
lda.w #12
sta.b tcc__r9
lda.b tcc__r2
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r2
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.w #6
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r3
asl a
clc
adc.b tcc__r3
clc
adc.b tcc__r2
and.w #255
and.w #248
asl a
asl a
asl a
sta.b tcc__r2
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.w #3
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r3
lda.w #12
sta.b tcc__r9
lda.b tcc__r3
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r3
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.w #6
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r4
asl a
clc
adc.b tcc__r4
sta.b tcc__r4
clc
adc.b tcc__r3
and.w #255
and.w #7
asl a
ora.b tcc__r2
sta.b tcc__r2
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.w #3
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
pha
rep #$20
pei (tcc__r2)
pea.w (0 * 256 + 0)
sep #$20
lda #2
pha
rep #$20
pea.w 240
pea.w 0
pei (tcc__r0)
jsr.l oamSet
tsa
clc
adc #12
tas
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
clc
adc.w #3
asl a
asl a
sta.b tcc__r0
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.w #3
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r2
lda.w #12
sta.b tcc__r9
lda.b tcc__r2
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r2
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.w #6
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r3
asl a
clc
adc.b tcc__r3
clc
adc.b tcc__r2
and.w #255
and.w #248
asl a
asl a
asl a
sta.b tcc__r2
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.w #3
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r3
lda.w #12
sta.b tcc__r9
lda.b tcc__r3
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r3
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.w #6
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r4
asl a
clc
adc.b tcc__r4
sta.b tcc__r4
clc
adc.b tcc__r3
and.w #255
and.w #7
asl a
ora.b tcc__r2
clc
adc.w #32
sta.b tcc__r2
lda -8 + __actors_init_locals + 1,s
sta.b tcc__r1
lda -6 + __actors_init_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.w #3
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
pha
rep #$20
pei (tcc__r2)
pea.w (0 * 256 + 0)
sep #$20
lda #2
pha
rep #$20
pea.w 240
pea.w 0
pei (tcc__r0)
jsr.l oamSet
tsa
clc
adc #12
tas
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
asl.b tcc__r0
pea.w (0 * 256 + 0)
sep #$20
rep #$20
pei (tcc__r0)
jsr.l oamSetEx
tsa
clc
adc #4
tas
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
clc
adc.w #3
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
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
asl.b tcc__r0
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
lda.w #0
sep #$20
lda -1 + __actors_init_locals + 1,s
rep #$20
asl a
clc
adc.w #3
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
jmp.w __local_77
__local_68:
jsr.l tccs_{WLA_FILENAME}_actors_rebuild_blockers
.ifgr __actors_init_locals 0
tsa
clc
adc #__actors_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_actor_oam_pairtext_0x6" SUPERFREE
tccs_{WLA_FILENAME}_actor_oam_pair:
.ifgr __tccs_{WLA_FILENAME}_actor_oam_pair_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_actor_oam_pair_locals
tas
.endif
lda.w #0
sep #$20
lda 9 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
rep #$20
and.w #248
asl a
asl a
asl a
sta.b tcc__r0
lda.w #0
sep #$20
lda 9 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
rep #$20
and.w #7
asl a
ora.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
lda.w #0
sep #$20
lda 11 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #0
sep #$20
lda 10 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r1
ora.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
lda 3 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
lsr a
lsr a
lsr a
lsr a
clc
adc.w #512
sta.b tcc__r0
lda.w #:oamMemory
sta.b tcc__r1h
lda.w #oamMemory + 0
clc
adc.b tcc__r0
sta.b tcc__r1
sta -8 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
lda.b tcc__r1h
sta -6 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
lda.w #:oamMemory
sta.b tcc__r0h
lda.w #oamMemory + 0
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
lda.b tcc__r0h
sta -10 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
lda 5 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
and.w #255
sta -14 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
lda 7 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
and.w #255
sta -16 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
lda -12 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0h
lda -16 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
xba
and #$ff00
sta.b tcc__r1
lda -14 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
ora.b tcc__r1
sta.b [tcc__r0]
lda -10 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0h
lda -12 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
and.w #255
sta.b tcc__r1
lda -2 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
xba
and #$00ff
sta.b tcc__r2
lda -4 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
ora.b tcc__r2
xba
and #$ff00
sta.b tcc__r3
ora.b tcc__r1
sta.b [tcc__r0]
lda -2 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
clc
adc.w #32
sta -2 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
lda -12 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda -16 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
clc
adc.w #16
and.w #255
xba
and #$ff00
sta.b tcc__r1
lda -14 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
ora.b tcc__r1
sta.b [tcc__r0]
lda -12 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #6
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
and.w #255
sta.b tcc__r1
lda -2 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
xba
and #$00ff
sta.b tcc__r2
lda -4 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
ora.b tcc__r2
xba
and #$ff00
sta.b tcc__r3
ora.b tcc__r1
sta.b tcc__r1
sta.b [tcc__r0]
lda 3 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0
lsr.b tcc__r0
lsr.b tcc__r0
lda.b tcc__r0
and.w #3
sta.b tcc__r0
cmp #0
beq +
brl __local_78
+
lda 5 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
and.w #256
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_79
+
lda -8 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
ora.w #5
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
bra __local_80
__local_79:
lda -8 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
and.w #250
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
__local_80:
jmp.w __local_81
__local_78:
lda 5 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
and.w #256
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_82
+
lda -8 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
ora.w #80
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
bra __local_83
__local_82:
lda -8 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_actor_oam_pair_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
and.w #175
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
__local_83:
__local_81:
.ifgr __tccs_{WLA_FILENAME}_actor_oam_pair_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_actor_oam_pair_locals
tas
.endif
rtl
.ENDS
.SECTION ".actors_drawtext_0x7" SUPERFREE
actors_draw:
.ifgr __actors_draw_locals 0
tsa
sec
sbc #__actors_draw_locals
tas
.endif
lda.w #0
sep #$20
lda.l scene_ctx + 3
sta -7 + __actors_draw_locals + 1,s
rep #$20
lda.l camera + 0
sta -10 + __actors_draw_locals + 1,s
lda.l camera + 2
sta -12 + __actors_draw_locals + 1,s
lda -10 + __actors_draw_locals + 1,s
clc
adc.w #256
sta -14 + __actors_draw_locals + 1,s
lda -12 + __actors_draw_locals + 1,s
clc
adc.w #224
clc
adc.w #8
sta -16 + __actors_draw_locals + 1,s
lda.w #0
sep #$20
lda -7 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
brl __local_84
+
bra __local_85
__local_84:
lda.w #0
sep #$20
lda -7 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_86
__local_85:
lda.w #24
sta.b tcc__r0
__local_86:
sep #$20
lda.b tcc__r0
sta -2 + __actors_draw_locals + 1,s
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __actors_draw_locals + 1,s
rep #$20
__local_89:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_87
+
bra __local_88
__local_92:
__local_94:
__local_122:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actors_draw_locals + 1,s
rep #$20
jmp.w __local_89
__local_88:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
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
brl __local_90
+
bra __local_91
__local_90:
jmp.w __local_92
__local_91:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_sprite
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_sprite + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -17 + __actors_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -17 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_93
+
jmp.w __local_94
__local_93:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -4 + __actors_draw_locals + 1,s
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -6 + __actors_draw_locals + 1,s
lda -4 + __actors_draw_locals + 1,s
clc
adc.w #16
sta.b tcc__r0
lda -10 + __actors_draw_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_95
++
lda -4 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -14 + __actors_draw_locals + 1,s
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
__local_95:
brl __local_96
+
lda -6 + __actors_draw_locals + 1,s
clc
adc.w #16
sta.b tcc__r0
lda -12 + __actors_draw_locals + 1,s
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
__local_96:
brl __local_97
+
lda -6 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -16 + __actors_draw_locals + 1,s
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
__local_97:
brl __local_98
+
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
asl.b tcc__r0
lda.b tcc__r0
sta -22 + __actors_draw_locals + 1,s
lda.w #:oamMemory
sta.b tcc__r0h
lda.w #oamMemory + 0
sta.b tcc__r0
lda -22 + __actors_draw_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
sta -28 + __actors_draw_locals + 1,s
lda.b tcc__r0h
sta -26 + __actors_draw_locals + 1,s
lda -4 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -10 + __actors_draw_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta -30 + __actors_draw_locals + 1,s
lda -6 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -12 + __actors_draw_locals + 1,s
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sec
sbc.w #8
and.w #255
sta -32 + __actors_draw_locals + 1,s
lda -30 + __actors_draw_locals + 1,s
and.w #255
sta -34 + __actors_draw_locals + 1,s
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -18 + __actors_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_gfx
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_gfx + 0
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
brl __local_99
+
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_gfx
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_gfx + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #12
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
and.w #255
sta.b tcc__r0
bra __local_100
__local_99:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_fbase
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_fbase + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
__local_100:
__local_101:
sep #$20
lda.b tcc__r0
sta -19 + __actors_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -18 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -18 + __actors_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda -18 + __actors_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -19 + __actors_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
sta.b tcc__r1
sep #$20
sta -19 + __actors_draw_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
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
brl __local_102
+
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_anim
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_anim + 0
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
brl __local_103
+
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_anim
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_anim + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
cmp #$8000
ror.b tcc__r0
inc.b tcc__r0
lda.b tcc__r0
and.w #255
sta.b tcc__r0
bra __local_104
__local_103:
lda.w #0
sta.b tcc__r0
__local_104:
__local_105:
lda.w #0
sep #$20
lda -19 + __actors_draw_locals + 1,s
rep #$20
clc
adc.b tcc__r0
sta.b tcc__r1
sep #$20
sta -19 + __actors_draw_locals + 1,s
rep #$20
__local_102:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_lastf
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_lastf + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -19 + __actors_draw_locals + 1,s
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
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_106
+
lda.w #0
sep #$20
lda -19 + __actors_draw_locals + 1,s
rep #$20
and.w #248
asl a
asl a
asl a
sta.b tcc__r0
lda.w #0
sep #$20
lda -19 + __actors_draw_locals + 1,s
rep #$20
and.w #7
asl a
ora.b tcc__r0
sta -36 + __actors_draw_locals + 1,s
lda.w #0
sep #$20
lda -17 + __actors_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_actor_prio
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_actor_prio + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc #2
tay
beq +
dex
+
stx.b tcc__r5
lda.b tcc__r0
sta -44 + __actors_draw_locals + 1,s
lda.b tcc__r0h
sta -42 + __actors_draw_locals + 1,s
lda.b tcc__r5 ; DON'T OPTIMIZE
bne +
brl __local_107
+
bra __local_108
__local_107:
lda.w #2
sta.b tcc__r0
bra __local_109
__local_108:
lda.w #3
sta.b tcc__r0
__local_109:
lda.b tcc__r0
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda -44 + __actors_draw_locals + 1,s
ora.b tcc__r0
sta.b tcc__r1
sta -38 + __actors_draw_locals + 1,s
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_w1
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_w1 + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -36 + __actors_draw_locals + 1,s
and.w #255
sta.b tcc__r0
lda -36 + __actors_draw_locals + 1,s
xba
and #$00ff
sta.b tcc__r2
lda -38 + __actors_draw_locals + 1,s
ora.b tcc__r2
xba
and #$ff00
sta.b tcc__r3
ora.b tcc__r0
sta.b [tcc__r1]
lda -36 + __actors_draw_locals + 1,s
clc
adc.w #32
sta -36 + __actors_draw_locals + 1,s
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_w3
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_w3 + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -36 + __actors_draw_locals + 1,s
and.w #255
sta.b tcc__r0
lda -36 + __actors_draw_locals + 1,s
xba
and #$00ff
sta.b tcc__r2
lda -38 + __actors_draw_locals + 1,s
ora.b tcc__r2
xba
and #$ff00
sta.b tcc__r3
ora.b tcc__r0
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_lastf
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_lastf + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -19 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_106:
lda -28 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -26 + __actors_draw_locals + 1,s
sta.b tcc__r0h
lda -32 + __actors_draw_locals + 1,s
xba
and #$ff00
sta.b tcc__r1
lda -34 + __actors_draw_locals + 1,s
ora.b tcc__r1
sta.b tcc__r2
sta.b [tcc__r0]
lda -26 + __actors_draw_locals + 1,s
sta.b tcc__r0h
lda -28 + __actors_draw_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_actor_w1
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_actor_w1 + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.b [tcc__r2]
sta.b [tcc__r0]
lda -28 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -26 + __actors_draw_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda -32 + __actors_draw_locals + 1,s
clc
adc.w #16
and.w #255
xba
and #$ff00
sta.b tcc__r1
lda -34 + __actors_draw_locals + 1,s
ora.b tcc__r1
sta.b tcc__r2
sta.b [tcc__r0]
lda -28 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -26 + __actors_draw_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #6
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_actor_w3
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_actor_w3 + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.b [tcc__r2]
sta.b tcc__r1
sta.b [tcc__r0]
lda -30 + __actors_draw_locals + 1,s
and.w #256
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_110
+
bra __local_111
__local_110:
lda.w #0
sta.b tcc__r0
bra __local_112
__local_111:
lda.w #1
sta.b tcc__r0
__local_112:
lda.b tcc__r0
sta -34 + __actors_draw_locals + 1,s
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_x9
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_x9 + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda -34 + __actors_draw_locals + 1,s
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_113
+
lda -22 + __actors_draw_locals + 1,s
lsr a
lsr a
lsr a
lsr a
clc
adc.w #512
sta.b tcc__r0
lda.w #:oamMemory
sta.b tcc__r1h
lda.w #oamMemory + 0
clc
adc.b tcc__r0
sta.b tcc__r1
sta -48 + __actors_draw_locals + 1,s
lda.b tcc__r1h
sta -46 + __actors_draw_locals + 1,s
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_x9
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_x9 + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -34 + __actors_draw_locals + 1,s
and.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda -22 + __actors_draw_locals + 1,s
sta.b tcc__r0
lsr.b tcc__r0
lsr.b tcc__r0
lda.b tcc__r0
and.w #3
sta.b tcc__r0
cmp #0
beq +
brl __local_114
+
lda -34 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_115
+
lda -48 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -46 + __actors_draw_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
ora.w #5
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
bra __local_116
__local_115:
lda -48 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -46 + __actors_draw_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
and.w #250
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
__local_116:
jmp.w __local_117
__local_114:
lda -34 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_118
+
lda -48 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -46 + __actors_draw_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
ora.w #80
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
bra __local_119
__local_118:
lda -48 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -46 + __actors_draw_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
and.w #175
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
__local_119:
__local_117:
__local_113:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_shown
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_shown + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #1
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_120
__local_98:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_shown
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_shown + 0
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
brl __local_121
+
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
asl.b tcc__r0
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
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
clc
adc.w #3
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
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_shown
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_shown + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_x9
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_x9 + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_121:
__local_120:
jmp.w __local_122
__local_87:
lda.w #24
sta.b tcc__r0
sep #$20
sta -1 + __actors_draw_locals + 1,s
rep #$20
__local_125:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -7 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_123
+
bra __local_124
__local_128:
__local_134:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actors_draw_locals + 1,s
rep #$20
jmp.w __local_125
__local_124:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
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
sta.b tcc__r1
sta -52 + __actors_draw_locals + 1,s
lda.b tcc__r1h
sta -50 + __actors_draw_locals + 1,s
lda -52 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -50 + __actors_draw_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
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
brl __local_126
+
bra __local_127
__local_126:
jmp.w __local_128
__local_127:
lda -50 + __actors_draw_locals + 1,s
sta.b tcc__r0h
lda -52 + __actors_draw_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
asl a
asl a
asl a
asl a
sta -4 + __actors_draw_locals + 1,s
lda -50 + __actors_draw_locals + 1,s
sta.b tcc__r0h
lda -52 + __actors_draw_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
asl a
asl a
asl a
asl a
sta -6 + __actors_draw_locals + 1,s
lda -4 + __actors_draw_locals + 1,s
clc
adc.w #16
sta.b tcc__r0
lda -10 + __actors_draw_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_129
++
lda -4 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -14 + __actors_draw_locals + 1,s
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
__local_129:
brl __local_130
+
lda -6 + __actors_draw_locals + 1,s
clc
adc.w #16
sta.b tcc__r0
lda -12 + __actors_draw_locals + 1,s
sta.b tcc__r1
ldx #1
lda.b tcc__r0
sec
sbc.b tcc__r1
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
__local_130:
brl __local_131
+
lda -6 + __actors_draw_locals + 1,s
sta.b tcc__r0
lda -16 + __actors_draw_locals + 1,s
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
__local_131:
brl __local_132
+
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
asl.b tcc__r0
lda -4 + __actors_draw_locals + 1,s
sta.b tcc__r1
lda -10 + __actors_draw_locals + 1,s
sta.b tcc__r2
sec
lda.b tcc__r1
sbc.b tcc__r2
sta.b tcc__r1
lda -6 + __actors_draw_locals + 1,s
sta.b tcc__r2
lda -12 + __actors_draw_locals + 1,s
sta.b tcc__r3
sec
lda.b tcc__r2
sbc.b tcc__r3
sec
sbc.w #8
sta.b tcc__r2
lda -52 + __actors_draw_locals + 1,s
sta.b tcc__r3
lda -50 + __actors_draw_locals + 1,s
sta.b tcc__r3h
clc
lda.b tcc__r3
adc.w #3
sta.b tcc__r3
lda.w #0
sep #$20
lda.b [tcc__r3]
rep #$20
sta.b tcc__r4
lda.w #12
sta.b tcc__r9
lda.b tcc__r4
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r4
lda -52 + __actors_draw_locals + 1,s
sta.b tcc__r3
lda -50 + __actors_draw_locals + 1,s
sta.b tcc__r3h
clc
lda.b tcc__r3
adc.w #6
sta.b tcc__r3
lda.w #0
sep #$20
lda.b [tcc__r3]
rep #$20
sta.b tcc__r5
asl a
clc
adc.b tcc__r5
clc
adc.b tcc__r4
and.w #255
sta.b tcc__r4
lda -52 + __actors_draw_locals + 1,s
sta.b tcc__r3
lda -50 + __actors_draw_locals + 1,s
sta.b tcc__r3h
clc
lda.b tcc__r3
adc.w #3
sta.b tcc__r3
lda.w #0
sep #$20
lda.b [tcc__r3]
pha
lda #2
pha
lda.b tcc__r4
pha
rep #$20
pei (tcc__r2)
pei (tcc__r1)
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_actor_oam_pair
tsa
clc
adc #9
tas
jmp.w __local_133
__local_132:
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
asl.b tcc__r0
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
lda.w #0
sep #$20
lda -1 + __actors_draw_locals + 1,s
rep #$20
asl a
clc
adc.w #3
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
__local_133:
jmp.w __local_134
__local_123:
.ifgr __actors_draw_locals 0
tsa
clc
adc #__actors_draw_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_mv_blockedtext_0x8" SUPERFREE
tccs_{WLA_FILENAME}_mv_blocked:
.ifgr __tccs_{WLA_FILENAME}_mv_blocked_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_mv_blocked_locals
tas
.endif
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 1
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
brl __local_135
+
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 2
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
__local_135:
brl __local_136
+
bra __local_137
__local_136:
lda.w #1
sta.b tcc__r0
jmp.w __local_138
__local_137:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_thru
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_thru + 0
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
brl __local_139
+
lda.w #0
sta.b tcc__r0
jmp.w __local_140
__local_139:
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
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
brl __local_141
+
lda.w #1
sta.b tcc__r0
jmp.w __local_142
__local_141:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
asl a
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.b [tcc__r2]
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
lda 6 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
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
brl __local_143
+
lda.w #1
sta.b tcc__r0
jmp.w __local_144
__local_143:
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
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
lda 6 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
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
brl __local_145
+
lda.w #1
sta.b tcc__r0
jmp.w __local_146
__local_145:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_prio
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_prio + 0
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
brl __local_147
+
lda.l player + 0
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
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
__local_147:
brl __local_148
+
lda.l player + 2
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
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
__local_148:
brl __local_149
+
lda.w #1
sta.b tcc__r0
jmp.w __local_150
__local_149:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
__local_154:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_151
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
__local_151:
brl __local_152
+
bra __local_153
__local_161:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
jmp.w __local_154
__local_153:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
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
brl __local_155
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
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
__local_155:
brl __local_156
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_prio
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_prio + 0
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
sbc #1
tay
beq +
dex
+
stx.b tcc__r5
txa
bne +
__local_156:
brl __local_157
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
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
__local_157:
brl __local_158
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_mv_blocked_locals + 1,s
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
__local_158:
brl __local_159
+
lda.w #1
sta.b tcc__r0
bra __local_160
__local_159:
jmp.w __local_161
__local_152:
lda.w #0
sta.b tcc__r0
__local_138:
__local_140:
__local_142:
__local_144:
__local_146:
__local_150:
__local_160:
__local_162:
.ifgr __tccs_{WLA_FILENAME}_mv_blocked_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_mv_blocked_locals
tas
.endif
rtl
.ENDS
.SECTION ".actors_set_routetext_0x9" SUPERFREE
actors_set_route:
.ifgr __actors_set_route_locals 0
tsa
sec
sbc #__actors_set_route_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __actors_set_route_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
brl __local_163
+
lda.w #0
sep #$20
lda 3 + __actors_set_route_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
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
__local_163:
brl __local_164
+
lda.w #0
sep #$20
lda 7 + __actors_set_route_locals + 1,s
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
__local_164:
brl __local_165
+
bra __local_166
__local_165:
jmp.w __local_167
__local_166:
lda.w #0
sep #$20
lda 3 + __actors_set_route_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __actors_set_route_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda 4 + __actors_set_route_locals + 1,s
sta.b [tcc__r1]
lda.w #0
sep #$20
lda 3 + __actors_set_route_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __actors_set_route_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_len
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_len + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 7 + __actors_set_route_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __actors_set_route_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_flags
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_flags + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 6 + __actors_set_route_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __actors_set_route_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_wait
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_wait + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_167:
.ifgr __actors_set_route_locals 0
tsa
clc
adc #__actors_set_route_locals
tas
.endif
rtl
.ENDS
.SECTION ".actors_set_postext_0xa" SUPERFREE
actors_set_pos:
.ifgr __actors_set_pos_locals 0
tsa
sec
sbc #__actors_set_pos_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __actors_set_pos_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
brl __local_168
+
lda.w #0
sep #$20
lda 3 + __actors_set_pos_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
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
__local_168:
brl __local_169
+
bra __local_170
__local_169:
jmp.w __local_171
__local_170:
lda.w #0
sep #$20
lda 3 + __actors_set_pos_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __actors_set_pos_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b [tcc__r1]
lda.w #0
sep #$20
lda 3 + __actors_set_pos_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 5 + __actors_set_pos_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b [tcc__r1]
lda.w #0
sep #$20
lda 3 + __actors_set_pos_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
jsr.l tccs_{WLA_FILENAME}_actors_rebuild_blockers
__local_171:
.ifgr __actors_set_pos_locals 0
tsa
clc
adc #__actors_set_pos_locals
tas
.endif
rtl
.ENDS
.SECTION ".actors_swap_postext_0xb" SUPERFREE
actors_swap_pos:
.ifgr __actors_swap_pos_locals 0
tsa
sec
sbc #__actors_swap_pos_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __actors_swap_pos_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
brl __local_172
+
lda.w #0
sep #$20
lda 4 + __actors_swap_pos_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
__local_172:
brl __local_173
+
lda.w #0
sep #$20
lda 3 + __actors_swap_pos_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
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
__local_173:
brl __local_174
+
lda.w #0
sep #$20
lda 4 + __actors_swap_pos_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
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
__local_174:
brl __local_175
+
bra __local_176
__local_175:
jmp.w __local_177
__local_176:
lda.w #0
sep #$20
lda 3 + __actors_swap_pos_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -2 + __actors_swap_pos_locals + 1,s
lda.w #0
sep #$20
lda 3 + __actors_swap_pos_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __actors_swap_pos_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.b [tcc__r2]
sta.b [tcc__r1]
lda.w #0
sep #$20
lda 4 + __actors_swap_pos_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -2 + __actors_swap_pos_locals + 1,s
sta.b [tcc__r1]
lda.w #0
sep #$20
lda 3 + __actors_swap_pos_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -2 + __actors_swap_pos_locals + 1,s
lda.w #0
sep #$20
lda 3 + __actors_swap_pos_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __actors_swap_pos_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.b [tcc__r2]
sta.b [tcc__r1]
lda.w #0
sep #$20
lda 4 + __actors_swap_pos_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -2 + __actors_swap_pos_locals + 1,s
sta.b [tcc__r1]
lda.w #0
sep #$20
lda 3 + __actors_swap_pos_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 4 + __actors_swap_pos_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
jsr.l tccs_{WLA_FILENAME}_actors_rebuild_blockers
__local_177:
.ifgr __actors_swap_pos_locals 0
tsa
clc
adc #__actors_swap_pos_locals
tas
.endif
rtl
.ENDS
.SECTION ".actors_route_freqtext_0xc" SUPERFREE
actors_route_freq:
.ifgr __actors_route_freq_locals 0
tsa
sec
sbc #__actors_route_freq_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __actors_route_freq_locals + 1,s
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
brl __local_178
+
lda.w #0
sep #$20
lda 3 + __actors_route_freq_locals + 1,s
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
__local_178:
brl __local_179
+
lda #1
bra +
__local_179:
lda #0
+
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_180
+
bra __local_181
__local_180:
lda.w #3
sta.b tcc__r0
bra __local_182
__local_181:
lda.w #0
sep #$20
lda 3 + __actors_route_freq_locals + 1,s
rep #$20
sta.b tcc__r0
__local_182:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_route_freq_pending + 0
rep #$20
.ifgr __actors_route_freq_locals 0
tsa
clc
adc #__actors_route_freq_locals
tas
.endif
rtl
.ENDS
.SECTION ".actors_route_bind_freqtext_0xd" SUPERFREE
actors_route_bind_freq:
.ifgr __actors_route_bind_freq_locals 0
tsa
sec
sbc #__actors_route_bind_freq_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __actors_route_bind_freq_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #24
bvc +
eor #$8000
+
bmi +
brl __local_183
+
lda.w #0
sep #$20
lda 3 + __actors_route_bind_freq_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_freq
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_freq + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_route_freq_pending + 0
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_183:
.ifgr __actors_route_bind_freq_locals 0
tsa
clc
adc #__actors_route_bind_freq_locals
tas
.endif
rtl
.ENDS
.SECTION ".actors_routes_busytext_0xe" SUPERFREE
actors_routes_busy:
.ifgr __actors_routes_busy_locals 0
tsa
sec
sbc #__actors_routes_busy_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __actors_routes_busy_locals + 1,s
rep #$20
__local_186:
lda.w #0
sep #$20
lda -1 + __actors_routes_busy_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #24
bvc +
eor #$8000
+
bmi +
brl __local_184
+
bra __local_185
__local_191:
lda.w #0
sep #$20
lda -1 + __actors_routes_busy_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actors_routes_busy_locals + 1,s
rep #$20
bra __local_186
__local_185:
lda.w #0
sep #$20
lda -1 + __actors_routes_busy_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
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
brl __local_187
+
lda.w #0
sep #$20
lda -1 + __actors_routes_busy_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_flags
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_flags + 0
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
brl __local_188
+
bra __local_189
__local_188:
lda.w #1
sta.b tcc__r0
bra __local_190
__local_187:
__local_189:
jmp.w __local_191
__local_184:
lda.w #0
sta.b tcc__r0
__local_190:
__local_192:
.ifgr __actors_routes_busy_locals 0
tsa
clc
adc #__actors_routes_busy_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_dir_toward_playertext_0xf" SUPERFREE
tccs_{WLA_FILENAME}_dir_toward_player:
.ifgr __tccs_{WLA_FILENAME}_dir_toward_player_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_dir_toward_player_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.l player + 0
sta.b tcc__r0
lda.b [tcc__r1]
sta.b tcc__r2
lda.b tcc__r0
cmp.b tcc__r2
beq +
bcc +
brl ++
+
brl __local_193
++
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.l player + 0
sta.b tcc__r0
lda.b [tcc__r1]
sta.b tcc__r2
sec
lda.b tcc__r0
sbc.b tcc__r2
sta.b tcc__r0
bra __local_194
__local_193:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
lda.l player + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
__local_194:
__local_195:
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.l player + 2
sta.b tcc__r0
lda.b [tcc__r1]
sta.b tcc__r2
lda.b tcc__r0
cmp.b tcc__r2
beq +
bcc +
brl ++
+
brl __local_196
++
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.l player + 2
sta.b tcc__r0
lda.b [tcc__r1]
sta.b tcc__r2
sec
lda.b tcc__r0
sbc.b tcc__r2
sta.b tcc__r0
bra __local_197
__local_196:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
lda.l player + 2
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
__local_197:
__local_198:
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
lda -2 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_199
++
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.l player + 0
sta.b tcc__r0
lda.b [tcc__r1]
sta.b tcc__r2
lda.b tcc__r0
cmp.b tcc__r2
beq +
bcc +
brl ++
+
brl __local_200
++
bra __local_201
__local_200:
lda.w #2
sta.b tcc__r0
bra __local_202
__local_201:
lda.w #3
sta.b tcc__r0
__local_202:
lda.b tcc__r0
and.w #255
sta.b tcc__r0
jmp.w __local_203
__local_199:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_dir_toward_player_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.l player + 2
sta.b tcc__r0
lda.b [tcc__r1]
sta.b tcc__r2
lda.b tcc__r0
cmp.b tcc__r2
beq +
bcc +
brl ++
+
brl __local_204
++
bra __local_205
__local_204:
lda.w #1
sta.b tcc__r0
bra __local_206
__local_205:
lda.w #0
sta.b tcc__r0
__local_206:
lda.b tcc__r0
and.w #255
sta.b tcc__r0
__local_203:
__local_207:
.ifgr __tccs_{WLA_FILENAME}_dir_toward_player_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_dir_toward_player_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_route_ticktext_0x10" SUPERFREE
tccs_{WLA_FILENAME}_route_tick:
.ifgr __tccs_{WLA_FILENAME}_route_tick_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_route_tick_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
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
brl __local_208
+
jmp.w __local_209
__local_208:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_wait
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_wait + 0
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
brl __local_210
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_wait
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_wait + 0
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
jmp.w __local_211
__local_210:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_len
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_route_len + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
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
bpl +++
++
dex
+++
stx.b tcc__r5
txa
bne +
brl __local_212
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_flags
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_flags + 0
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
brl __local_213
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
bra __local_214
__local_213:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #65535
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_215
__local_214:
__local_212:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r0
lda.b [tcc__r1]
clc
adc.b tcc__r0
sta.b tcc__r2
lda.l scene_ctx + 20
sta.b tcc__r0
lda.l scene_ctx + 20 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r2
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
lda.b #1
sta -5 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
and.w #240
sta.b tcc__r0
cmp #64
beq +
brl __local_216
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_wait
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_wait + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
and.w #15
asl a
asl a
asl a
and.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
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
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
jmp.w __local_217
__local_216:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_218
bra __local_219
__local_218:
lda.b tcc__r0
cmp #4
beq +
brl __local_220
+
__local_219:
jsr.l tccs_{WLA_FILENAME}_mv_rand
lda.b tcc__r0
and.w #3
and.w #255
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_221
bra __local_222
__local_220:
lda.b tcc__r0
cmp #5
beq +
brl __local_223
+
__local_222:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_dir_toward_player
tsa
clc
adc #1
tas
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_224
bra __local_225
__local_223:
lda.b tcc__r0
cmp #6
beq +
brl __local_226
+
__local_225:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_dir_toward_player
tsa
clc
adc #1
tas
lda.b tcc__r0
eor.w #1
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_227
bra __local_228
__local_226:
lda.b tcc__r0
cmp #7
beq +
brl __local_229
+
__local_228:
jmp.w __local_230
bra __local_231
__local_229:
lda.b tcc__r0
cmp #20
beq +
brl __local_232
+
__local_231:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_dir_cw
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_dir_cw + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_233
bra __local_234
__local_232:
lda.b tcc__r0
cmp #21
beq +
brl __local_235
+
__local_234:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_dir_ccw
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_dir_ccw + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_236
bra __local_237
__local_235:
lda.b tcc__r0
cmp #22
beq +
brl __local_238
+
__local_237:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
eor.w #1
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_239
bra __local_240
__local_238:
lda.b tcc__r0
cmp #23
beq +
brl __local_241
+
__local_240:
jsr.l tccs_{WLA_FILENAME}_mv_rand
lda.b tcc__r0
and.w #1
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_242
+
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_dir_cw
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_dir_cw + 0
clc
adc.b tcc__r0
sta.b tcc__r1
bra __local_243
__local_242:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_dir_ccw
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_dir_ccw + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
bra __local_244
__local_243:
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
__local_244:
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_245
bra __local_246
__local_241:
lda.b tcc__r0
cmp #24
beq +
brl __local_247
+
__local_246:
jsr.l tccs_{WLA_FILENAME}_mv_rand
lda.b tcc__r0
and.w #3
and.w #255
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_248
bra __local_249
__local_247:
lda.b tcc__r0
cmp #25
beq +
brl __local_250
+
__local_249:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_dir_toward_player
tsa
clc
adc #1
tas
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_251
bra __local_252
__local_250:
lda.b tcc__r0
cmp #26
beq +
brl __local_253
+
__local_252:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_dir_toward_player
tsa
clc
adc #1
tas
lda.b tcc__r0
eor.w #1
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_254
bra __local_255
__local_253:
lda.b tcc__r0
cmp #32
beq +
brl __local_256
+
__local_255:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_speed
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_speed + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sec
sbc.w #4
bvc +
eor #$8000
+
bmi +
brl __local_257
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_speed
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_speed + 0
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
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
__local_257:
jmp.w __local_258
bra __local_259
__local_256:
lda.b tcc__r0
cmp #33
beq +
brl __local_260
+
__local_259:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_speed
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_speed + 0
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
brl __local_261
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_speed
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_speed + 0
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
__local_261:
jmp.w __local_262
bra __local_263
__local_260:
lda.b tcc__r0
cmp #34
beq +
brl __local_264
+
__local_263:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_freq
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_freq + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sec
sbc.w #8
bvc +
eor #$8000
+
bmi +
brl __local_265
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_freq
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_freq + 0
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
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
__local_265:
jmp.w __local_266
bra __local_267
__local_264:
lda.b tcc__r0
cmp #35
beq +
brl __local_268
+
__local_267:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_freq
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_freq + 0
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
brl __local_269
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_freq
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_freq + 0
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
__local_269:
jmp.w __local_270
bra __local_271
__local_268:
lda.b tcc__r0
cmp #40
beq +
brl __local_272
+
__local_271:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirfix
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirfix + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #1
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_273
bra __local_274
__local_272:
lda.b tcc__r0
cmp #41
beq +
brl __local_275
+
__local_274:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirfix
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirfix + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_276
bra __local_277
__local_275:
lda.b tcc__r0
cmp #42
beq +
brl __local_278
+
__local_277:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_thru
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_thru + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #1
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_279
bra __local_280
__local_278:
lda.b tcc__r0
cmp #43
beq +
brl __local_281
+
__local_280:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_thru
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_thru + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_282
bra __local_283
__local_281:
lda.b tcc__r0
cmp #80
beq +
brl __local_284
+
__local_283:
bra __local_285
__local_284:
lda.b tcc__r0
cmp #81
beq +
brl __local_286
+
__local_285:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r0
lda.b [tcc__r1]
clc
adc.b tcc__r0
inc a
sta.b tcc__r2
lda.l scene_ctx + 20
sta.b tcc__r0
lda.l scene_ctx + 20 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r2
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r3h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r3
lda.w #0
sep #$20
lda.b [tcc__r3]
rep #$20
sta.b tcc__r0
lda.b [tcc__r2]
clc
adc.b tcc__r0
inc a
inc a
sta.b tcc__r3
lda.l scene_ctx + 20
sta.b tcc__r0
lda.l scene_ctx + 20 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r3
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
xba
and #$ff00
sta.b tcc__r2
ora.b tcc__r1
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #80
tay
beq +
dex
+
txa
and.w #255
sep #$20
pha
rep #$20
pei (tcc__r1)
jsr.l vm_switch_set
tsa
clc
adc #3
tas
lda.w #3
sta.b tcc__r0
sep #$20
sta -5 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_287
bra __local_288
__local_286:
lda.b tcc__r0
cmp #82
beq +
brl __local_289
+
__local_288:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_gfx
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_gfx + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r3h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
clc
adc.b tcc__r0
sta.b tcc__r3
lda.w #0
sep #$20
lda.b [tcc__r3]
rep #$20
sta.b tcc__r0
lda.b [tcc__r2]
clc
adc.b tcc__r0
inc a
sta.b tcc__r3
lda.l scene_ctx + 20
sta.b tcc__r0
lda.l scene_ctx + 20 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r3
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r2
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #2
sta.b tcc__r0
sep #$20
sta -5 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_290
__local_289:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
and.w #240
sta.b tcc__r0
cmp #16
beq +
brl __local_291
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
and.w #3
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
bra __local_292
__local_291:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
and.w #3
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
jmp.w __local_293
tccs_tourne:
__local_233:
__local_236:
__local_239:
__local_245:
__local_248:
__local_251:
__local_254:
__local_292:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirfix
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirfix + 0
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
brl __local_294
+
bra __local_295
__local_294:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_295:
jmp.w __local_296
tccs_marche:
__local_221:
__local_224:
__local_227:
__local_230:
__local_293:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_mv_dx
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_mv_dx + 0
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
clc
adc.b tcc__r0
and.w #255
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_mv_dy
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_mv_dy + 0
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
clc
adc.b tcc__r0
and.w #255
sep #$20
sta -4 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 6 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_mv_blocked
tsa
clc
adc #4
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_297
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirfix
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirfix + 0
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
brl __local_298
+
bra __local_299
__local_298:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_299:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_flags
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_flags + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
and.w #2
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_300
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
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
lda -5 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r2
clc
adc.b tcc__r0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_300:
jmp.w __local_301
__local_297:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirfix
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirfix + 0
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
brl __local_302
+
bra __local_303
__local_302:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_303:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_mvdir
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_mvdir + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #16
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
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
lda -5 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r2
clc
adc.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_wait
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_wait + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_freq
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_actor_freq + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r0
lda.w #8
sec
sbc.b tcc__r0
asl a
asl a
and.w #255
sta.b tcc__r2
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_304
tccs_fini:
__local_258:
__local_262:
__local_266:
__local_270:
__local_273:
__local_276:
__local_279:
__local_282:
__local_287:
__local_290:
__local_296:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_pos
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_pos + 0
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
lda -5 + __tccs_{WLA_FILENAME}_route_tick_locals + 1,s
rep #$20
sta.b tcc__r2
clc
adc.b tcc__r0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_209:
__local_211:
__local_215:
__local_217:
__local_301:
__local_304:
.ifgr __tccs_{WLA_FILENAME}_route_tick_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_route_tick_locals
tas
.endif
rtl
.ENDS
.SECTION ".actors_updatetext_0x11" SUPERFREE
actors_update:
.ifgr __actors_update_locals 0
tsa
sec
sbc #__actors_update_locals
tas
.endif
jsr.l vm_active
sep #$20
lda.b tcc__r0
sta -6 + __actors_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
sta -7 + __actors_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.l scene_ctx + 3
sta -8 + __actors_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -8 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
brl __local_305
+
lda.w #24
sta.b tcc__r0
sep #$20
sta -8 + __actors_update_locals + 1,s
rep #$20
__local_305:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_mv_phase + 0
rep #$20
eor.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_mv_phase + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __actors_update_locals + 1,s
rep #$20
__local_308:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -8 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_306
+
bra __local_307
__local_311:
__local_313:
__local_321:
__local_327:
__local_340:
__local_360:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actors_update_locals + 1,s
rep #$20
jmp.w __local_308
__local_307:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
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
brl __local_309
+
bra __local_310
__local_309:
jmp.w __local_311
__local_310:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_kind
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_kind + 0
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
sbc #1
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_312
+
jmp.w __local_313
__local_312:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
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
brl __local_314
+
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_route_tick
tsa
clc
adc #1
tas
__local_314:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_movet
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_movet + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -5 + __actors_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
cmp #65535
beq +
brl __local_315
+
lda.w #0
sep #$20
lda -5 + __actors_update_locals + 1,s
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
brl __local_316
+
lda.w #0
sep #$20
lda -6 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
__local_316:
brl __local_317
+
bra __local_318
__local_317:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
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
brl __local_319
+
bra __local_320
__local_319:
jmp.w __local_321
__local_320:
jmp.w __local_322
__local_315:
__local_318:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_route_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_route_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
cmp #65535
beq +
brl __local_323
+
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
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
brl __local_324
+
jmp.w __local_325
__local_324:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_timer
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_timer + 0
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
brl __local_326
+
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_timer
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_timer + 0
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
jmp.w __local_327
__local_326:
lda.w #0
sep #$20
lda -5 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_328
+
jsr.l tccs_{WLA_FILENAME}_mv_rand
lda.b tcc__r0
and.w #3
and.w #255
sep #$20
sta -2 + __actors_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_timer
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_timer + 0
clc
adc.b tcc__r0
sta.b tcc__r1
sta -12 + __actors_update_locals + 1,s
lda.b tcc__r1h
sta -10 + __actors_update_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_mv_rand
lda.b tcc__r0
and.w #127
clc
adc.w #64
and.w #255
sta.b tcc__r0
lda -12 + __actors_update_locals + 1,s
sta.b tcc__r1
lda -10 + __actors_update_locals + 1,s
sta.b tcc__r1h
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
jmp.w __local_329
__local_328:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -2 + __actors_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -5 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_330
+
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #0
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
__local_330:
brl __local_331
+
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #1
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
__local_331:
brl __local_332
+
lda.w #0
sta.b tcc__r0
sep #$20
sta -2 + __actors_update_locals + 1,s
rep #$20
__local_332:
lda.w #0
sep #$20
lda -5 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #3
beq +
brl __local_333
+
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
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
__local_333:
brl __local_334
+
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #3
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
__local_334:
brl __local_335
+
lda.w #3
sta.b tcc__r0
sep #$20
sta -2 + __actors_update_locals + 1,s
rep #$20
__local_335:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_timer
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_timer + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #16
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_329:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_mv_dx
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_mv_dx + 0
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
clc
adc.b tcc__r0
and.w #255
sep #$20
sta -3 + __actors_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_mv_dy
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_mv_dy + 0
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
clc
adc.b tcc__r0
and.w #255
sep #$20
sta -4 + __actors_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -3 + __actors_update_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 2 + __actors_update_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_mv_blocked
tsa
clc
adc #4
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_336
+
lda.w #0
sep #$20
lda -5 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #1
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_337
+
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirfix
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirfix + 0
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
brl __local_338
+
bra __local_339
__local_338:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
rep #$20
eor.w #1
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_337:
__local_339:
jmp.w __local_340
__local_336:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirfix
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirfix + 0
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
brl __local_341
+
bra __local_342
__local_341:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_342:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_mvdir
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_mvdir + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #16
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_323:
__local_325:
__local_322:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
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
brl __local_343
+
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_speed
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_speed + 0
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
brl __local_344
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_mv_phase + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_345
+
bra __local_346
__local_345:
lda.w #0
sta.b tcc__r0
bra __local_347
__local_346:
lda.w #1
sta.b tcc__r0
__local_347:
jmp.w __local_348
__local_344:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_speed
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_speed + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_349
+
jmp.w __local_350
__local_349:
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_speed
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_speed + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
cmp #3
beq +
brl __local_351
+
bra __local_352
__local_351:
lda.w #4
sta.b tcc__r0
bra __local_353
__local_352:
lda.w #2
sta.b tcc__r0
__local_353:
bra __local_354
__local_350:
lda.w #1
sta.b tcc__r0
__local_354:
__local_348:
__local_355:
sep #$20
lda.b tcc__r0
sta -13 + __actors_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_mvdir
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_mvdir + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sep #$20
sta -2 + __actors_update_locals + 1,s
rep #$20
__local_359:
lda.w #0
sep #$20
lda -13 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_356
+
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
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
__local_356:
brl __local_357
+
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_mv_dx
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_mv_dx + 0
clc
adc.b tcc__r0
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
sta.b tcc__r0
lda.b [tcc__r1]
clc
adc.b tcc__r0
sta.b tcc__r2
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_mv_dy
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_mv_dy + 0
clc
adc.b tcc__r0
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
sta.b tcc__r0
lda.b [tcc__r1]
clc
adc.b tcc__r0
sta.b [tcc__r1]
sep #$20
lda.b #1
sta -7 + __actors_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
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
lda -13 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta -13 + __actors_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_step
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_step + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
and.w #7
sta.b tcc__r0
cmp #0
beq +
brl __local_358
+
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_anim
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_anim + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_anim
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_actor_anim + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
inc a
and.w #3
and.w #255
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_358:
jmp.w __local_359
__local_357:
__local_343:
jmp.w __local_360
__local_306:
lda.w #0
sep #$20
lda -7 + __actors_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_361
+
jsr.l tccs_{WLA_FILENAME}_actors_rebuild_blockers
__local_361:
.ifgr __actors_update_locals 0
tsa
clc
adc #__actors_update_locals
tas
.endif
rtl
.ENDS
.SECTION ".actor_at_tiletext_0x12" SUPERFREE
actor_at_tile:
.ifgr __actor_at_tile_locals 0
tsa
sec
sbc #__actor_at_tile_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_blk_ovf + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_362
+
jmp.w __local_363
__local_362:
lda.w #0
sep #$20
lda 3 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_blk_x0 + 0
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
beq +
brl __local_364
+
lda.w #0
sep #$20
lda 3 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_blk_x1 + 0
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
beq +
__local_364:
brl __local_365
+
lda.w #0
sep #$20
lda 4 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_blk_y0 + 0
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
beq +
__local_365:
brl __local_366
+
lda.w #0
sep #$20
lda 4 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_blk_y1 + 0
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
beq +
__local_366:
brl __local_367
+
bra __local_368
__local_367:
lda.w #255
sta.b tcc__r0
jmp.w __local_369
__local_368:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __actor_at_tile_locals + 1,s
rep #$20
__local_372:
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_blk_n + 0
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_370
+
bra __local_371
__local_376:
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actor_at_tile_locals + 1,s
rep #$20
jmp.w __local_372
__local_371:
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_blk_tx
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_blk_tx + 0
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
lda 3 + __actor_at_tile_locals + 1,s
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
brl __local_373
+
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_blk_ty
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_blk_ty + 0
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
lda 4 + __actor_at_tile_locals + 1,s
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
__local_373:
brl __local_374
+
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_blk_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_blk_id + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
jmp.w __local_375
__local_374:
jmp.w __local_376
__local_370:
lda.w #255
sta.b tcc__r0
jmp.w __local_377
__local_363:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __actor_at_tile_locals + 1,s
rep #$20
__local_380:
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_378
+
bra __local_379
__local_385:
__local_389:
__local_391:
__local_398:
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actor_at_tile_locals + 1,s
rep #$20
jmp.w __local_380
__local_379:
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #24
bvc +
eor #$8000
+
bmi +
brl __local_381
+
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
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
brl __local_382
+
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_prio
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_prio + 0
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
sbc #1
tay
bne +
dex
+
stx.b tcc__r5
txa
beq +
__local_382:
brl __local_383
+
bra __local_384
__local_383:
jmp.w __local_385
__local_384:
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __actor_at_tile_locals + 1,s
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
beq +
brl __local_386
+
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 4 + __actor_at_tile_locals + 1,s
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
beq +
__local_386:
brl __local_387
+
bra __local_388
__local_387:
jmp.w __local_389
__local_388:
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_kind
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_kind + 0
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
sbc #1
tay
bne +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_390
+
jmp.w __local_391
__local_390:
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
jmp.w __local_392
jmp.w __local_393
__local_381:
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
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
sta.b tcc__r1
sta -8 + __actor_at_tile_locals + 1,s
lda.b tcc__r1h
sta -6 + __actor_at_tile_locals + 1,s
lda -8 + __actor_at_tile_locals + 1,s
sta.b tcc__r0
lda -6 + __actor_at_tile_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
cmp #1
beq +
brl __local_394
+
lda -6 + __actor_at_tile_locals + 1,s
sta.b tcc__r0h
lda -8 + __actor_at_tile_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __actor_at_tile_locals + 1,s
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
__local_394:
brl __local_395
+
lda -6 + __actor_at_tile_locals + 1,s
sta.b tcc__r0h
lda -8 + __actor_at_tile_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __actor_at_tile_locals + 1,s
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
__local_395:
brl __local_396
+
lda.w #0
sep #$20
lda -1 + __actor_at_tile_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_397
__local_396:
__local_393:
jmp.w __local_398
__local_378:
lda.w #255
sta.b tcc__r0
__local_369:
__local_375:
__local_377:
__local_392:
__local_397:
__local_399:
.ifgr __actor_at_tile_locals 0
tsa
clc
adc #__actor_at_tile_locals
tas
.endif
rtl
.ENDS
.SECTION ".actor_standing_attext_0x13" SUPERFREE
actor_standing_at:
.ifgr __actor_standing_at_locals 0
tsa
sec
sbc #__actor_standing_at_locals
tas
.endif
lda.l scene_ctx + 16 + 2
sta.b tcc__r0h
lda.l scene_ctx + 16
sta.b tcc__r0
sta -8 + __actor_standing_at_locals + 1,s
lda.b tcc__r0h
sta -6 + __actor_standing_at_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __actor_standing_at_locals + 1,s
rep #$20
__local_403:
lda.w #0
sep #$20
lda -1 + __actor_standing_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_400
+
lda.w #0
sep #$20
lda -1 + __actor_standing_at_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
__local_400:
brl __local_401
+
bra __local_402
__local_410:
lda.w #0
sep #$20
lda -1 + __actor_standing_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actor_standing_at_locals + 1,s
rep #$20
lda -6 + __actor_standing_at_locals + 1,s
sta.b tcc__r0h
lda -8 + __actor_standing_at_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #16
sta.b tcc__r0
sta -8 + __actor_standing_at_locals + 1,s
lda.b tcc__r0h
sta -6 + __actor_standing_at_locals + 1,s
jmp.w __local_403
__local_402:
lda -8 + __actor_standing_at_locals + 1,s
sta.b tcc__r0
lda -6 + __actor_standing_at_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
cmp #1
beq +
brl __local_404
+
lda.w #0
sep #$20
lda -1 + __actor_standing_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
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
__local_404:
brl __local_405
+
lda.w #0
sep #$20
lda -1 + __actor_standing_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_prio
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_prio + 0
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
sbc #0
tay
beq +
dex
+
stx.b tcc__r5
txa
bne +
__local_405:
brl __local_406
+
lda.w #0
sep #$20
lda -1 + __actor_standing_at_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __actor_standing_at_locals + 1,s
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
__local_406:
brl __local_407
+
lda.w #0
sep #$20
lda -1 + __actor_standing_at_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda 4 + __actor_standing_at_locals + 1,s
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
__local_407:
brl __local_408
+
lda.w #0
sep #$20
lda -1 + __actor_standing_at_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_409
__local_408:
jmp.w __local_410
__local_401:
lda.w #255
sta.b tcc__r0
__local_409:
__local_411:
.ifgr __actor_standing_at_locals 0
tsa
clc
adc #__actor_standing_at_locals
tas
.endif
rtl
.ENDS
.SECTION ".actor_trigger_attext_0x14" SUPERFREE
actor_trigger_at:
.ifgr __actor_trigger_at_locals 0
tsa
sec
sbc #__actor_trigger_at_locals
tas
.endif
lda.l scene_ctx + 16 + 2
sta.b tcc__r0h
lda.l scene_ctx + 16
sta.b tcc__r0
sta -8 + __actor_trigger_at_locals + 1,s
lda.b tcc__r0h
sta -6 + __actor_trigger_at_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __actor_trigger_at_locals + 1,s
rep #$20
__local_414:
lda.w #0
sep #$20
lda -1 + __actor_trigger_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_412
+
bra __local_413
__local_423:
lda.w #0
sep #$20
lda -1 + __actor_trigger_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actor_trigger_at_locals + 1,s
rep #$20
lda -6 + __actor_trigger_at_locals + 1,s
sta.b tcc__r0h
lda -8 + __actor_trigger_at_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #16
sta.b tcc__r0
sta -8 + __actor_trigger_at_locals + 1,s
lda.b tcc__r0h
sta -6 + __actor_trigger_at_locals + 1,s
jmp.w __local_414
__local_413:
lda -8 + __actor_trigger_at_locals + 1,s
sta.b tcc__r0
lda -6 + __actor_trigger_at_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
cmp #2
beq +
brl __local_415
+
lda -6 + __actor_trigger_at_locals + 1,s
sta.b tcc__r0h
lda -8 + __actor_trigger_at_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __actor_trigger_at_locals + 1,s
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
__local_415:
brl __local_416
+
lda -6 + __actor_trigger_at_locals + 1,s
sta.b tcc__r0h
lda -8 + __actor_trigger_at_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __actor_trigger_at_locals + 1,s
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
__local_416:
brl __local_417
+
lda -8 + __actor_trigger_at_locals + 1,s
sta.b tcc__r0
lda -6 + __actor_trigger_at_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r1
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
__local_417:
brl __local_418
+
lda.w #0
sep #$20
lda -1 + __actor_trigger_at_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
brl __local_419
+
lda.w #0
sep #$20
lda -1 + __actor_trigger_at_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
__local_419:
brl __local_420
+
bra __local_421
__local_420:
lda.w #0
sep #$20
lda -1 + __actor_trigger_at_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_422
__local_418:
__local_421:
jmp.w __local_423
__local_412:
lda.w #255
sta.b tcc__r0
__local_422:
__local_424:
.ifgr __actor_trigger_at_locals 0
tsa
clc
adc #__actor_trigger_at_locals
tas
.endif
rtl
.ENDS
.SECTION ".actors_autoruntext_0x15" SUPERFREE
actors_autorun:
.ifgr __actors_autorun_locals 0
tsa
sec
sbc #__actors_autorun_locals
tas
.endif
lda.l scene_ctx + 16 + 2
sta.b tcc__r0h
lda.l scene_ctx + 16
sta.b tcc__r0
sta -8 + __actors_autorun_locals + 1,s
lda.b tcc__r0h
sta -6 + __actors_autorun_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __actors_autorun_locals + 1,s
rep #$20
__local_427:
lda.w #0
sep #$20
lda -1 + __actors_autorun_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_425
+
bra __local_426
__local_434:
lda.w #0
sep #$20
lda -1 + __actors_autorun_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __actors_autorun_locals + 1,s
rep #$20
lda -6 + __actors_autorun_locals + 1,s
sta.b tcc__r0h
lda -8 + __actors_autorun_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #16
sta.b tcc__r0
sta -8 + __actors_autorun_locals + 1,s
lda.b tcc__r0h
sta -6 + __actors_autorun_locals + 1,s
jmp.w __local_427
__local_426:
lda -8 + __actors_autorun_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_autorun_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
cmp #3
beq +
brl __local_428
+
lda -8 + __actors_autorun_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_autorun_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r1
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
__local_428:
brl __local_429
+
lda.w #0
sep #$20
lda -1 + __actors_autorun_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #24
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
brl __local_430
+
lda.w #0
sep #$20
lda -1 + __actors_autorun_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_active
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_active + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
__local_430:
brl __local_431
+
bra __local_432
__local_431:
lda -8 + __actors_autorun_locals + 1,s
sta.b tcc__r0
lda -6 + __actors_autorun_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
sta -12 + __actors_autorun_locals + 1,s
lda.b tcc__r0h
sta -10 + __actors_autorun_locals + 1,s
lda -12 + __actors_autorun_locals + 1,s
sta.b tcc__r10
lda -10 + __actors_autorun_locals + 1,s
sta.b tcc__r10h
lda.b [tcc__r10]
sta.b tcc__r0
bra __local_433
__local_429:
__local_432:
jmp.w __local_434
__local_425:
lda.w #65535
sta.b tcc__r0
__local_433:
__local_435:
.ifgr __actors_autorun_locals 0
tsa
clc
adc #__actors_autorun_locals
tas
.endif
rtl
.ENDS
.SECTION ".actor_facetext_0x16" SUPERFREE
actor_face:
.ifgr __actor_face_locals 0
tsa
sec
sbc #__actor_face_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __actor_face_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #24
bvc +
eor #$8000
+
bmi +
brl __local_436
+
lda.w #0
sep #$20
lda 3 + __actor_face_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 3
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
__local_436:
brl __local_437
+
lda.w #0
sep #$20
lda 3 + __actor_face_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirfix
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirfix + 0
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
brl __local_438
+
bra __local_439
__local_438:
lda.w #0
sep #$20
lda 3 + __actor_face_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_dirs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_dirs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __actor_face_locals + 1,s
rep #$20
and.w #3
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_437:
__local_439:
.ifgr __actor_face_locals 0
tsa
clc
adc #__actor_face_locals
tas
.endif
rtl
.ENDS
.SECTION ".actor_interacttext_0x17" SUPERFREE
actor_interact:
.ifgr __actor_interact_locals 0
tsa
sec
sbc #__actor_interact_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __actor_interact_locals + 1,s
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
sta -2 + __actor_interact_locals + 1,s
lda.w #0
sep #$20
lda.l player + 4
rep #$20
eor.w #1
and.w #255
sep #$20
pha
rep #$20
lda.w #0
sep #$20
lda 4 + __actor_interact_locals + 1,s
pha
rep #$20
jsr.l actor_face
pla
lda -2 + __actor_interact_locals + 1,s
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
brl __local_440
+
lda -2 + __actor_interact_locals + 1,s
pha
jsr.l vm_start
pla
lda.w #0
sep #$20
lda 3 + __actor_interact_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.l vm + 709
rep #$20
__local_440:
.ifgr __actor_interact_locals 0
tsa
clc
adc #__actor_interact_locals
tas
.endif
rtl
.ENDS
.SECTION ".actor_pos_xtext_0x18" SUPERFREE
actor_pos_x:
.ifgr __actor_pos_x_locals 0
tsa
sec
sbc #__actor_pos_x_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __actor_pos_x_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #24
bvc +
eor #$8000
+
bmi +
brl __local_441
+
lda.w #0
sep #$20
lda 3 + __actor_pos_x_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_px
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_px + 0
clc
adc.b tcc__r0
sta.b tcc__r1
bra __local_442
__local_441:
lda.w #0
sta.b tcc__r0
bra __local_443
__local_442:
lda.b [tcc__r1]
sta.b tcc__r0
__local_443:
__local_444:
.ifgr __actor_pos_x_locals 0
tsa
clc
adc #__actor_pos_x_locals
tas
.endif
rtl
.ENDS
.SECTION ".actor_pos_ytext_0x19" SUPERFREE
actor_pos_y:
.ifgr __actor_pos_y_locals 0
tsa
sec
sbc #__actor_pos_y_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __actor_pos_y_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #24
bvc +
eor #$8000
+
bmi +
brl __local_445
+
lda.w #0
sep #$20
lda 3 + __actor_pos_y_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_actor_py
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_actor_py + 0
clc
adc.b tcc__r0
sta.b tcc__r1
bra __local_446
__local_445:
lda.w #0
sta.b tcc__r0
bra __local_447
__local_446:
lda.b [tcc__r1]
sta.b tcc__r0
__local_447:
__local_448:
.ifgr __actor_pos_y_locals 0
tsa
clc
adc #__actor_pos_y_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_blk_n dsb 1
tccs_{WLA_FILENAME}_blk_ovf dsb 1
tccs_{WLA_FILENAME}_blk_x0 dsb 1
tccs_{WLA_FILENAME}_blk_x1 dsb 1
tccs_{WLA_FILENAME}_blk_y0 dsb 1
tccs_{WLA_FILENAME}_blk_y1 dsb 1
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $0
.db $0
.db $ff
.db $0
.db $ff
.db $0
.ENDS
.SECTION ".rodata" SUPERFREE
tccs_{WLA_FILENAME}_mv_dx: .db $0,$0,$ff,$1
tccs_{WLA_FILENAME}_mv_dy: .db $1,$ff,$0,$0
tccs_{WLA_FILENAME}_dir_cw: .db $2,$3,$1,$0
tccs_{WLA_FILENAME}_dir_ccw: .db $3,$2,$0,$1
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
tccs_{WLA_FILENAME}_actor_dirs dsb 24
tccs_{WLA_FILENAME}_actor_active dsb 24
tccs_{WLA_FILENAME}_actor_px dsb 48
tccs_{WLA_FILENAME}_actor_py dsb 48
tccs_{WLA_FILENAME}_actor_step dsb 24
tccs_{WLA_FILENAME}_actor_anim dsb 24
tccs_{WLA_FILENAME}_actor_timer dsb 24
tccs_{WLA_FILENAME}_mv_seed dsb 2
tccs_{WLA_FILENAME}_mv_phase dsb 1
tccs_{WLA_FILENAME}_route_ofs dsb 48
tccs_{WLA_FILENAME}_route_pos dsb 24
tccs_{WLA_FILENAME}_route_len dsb 24
tccs_{WLA_FILENAME}_route_flags dsb 24
tccs_{WLA_FILENAME}_route_wait dsb 24
tccs_{WLA_FILENAME}_actor_speed dsb 24
tccs_{WLA_FILENAME}_actor_freq dsb 24
tccs_{WLA_FILENAME}_actor_dirfix dsb 24
tccs_{WLA_FILENAME}_actor_mvdir dsb 24
tccs_{WLA_FILENAME}_actor_thru dsb 24
tccs_{WLA_FILENAME}_actor_gfx dsb 24
tccs_{WLA_FILENAME}_actor_prio dsb 24
tccs_{WLA_FILENAME}_actor_sprite dsb 24
tccs_{WLA_FILENAME}_actor_kind dsb 24
tccs_{WLA_FILENAME}_actor_movet dsb 24
tccs_{WLA_FILENAME}_actor_fbase dsb 24
tccs_{WLA_FILENAME}_actor_shown dsb 24
tccs_{WLA_FILENAME}_actor_lastf dsb 24
tccs_{WLA_FILENAME}_actor_x9 dsb 24
tccs_{WLA_FILENAME}_actor_w1 dsb 48
tccs_{WLA_FILENAME}_actor_w3 dsb 48
tccs_{WLA_FILENAME}_blk_tx dsb 32
tccs_{WLA_FILENAME}_blk_ty dsb 32
tccs_{WLA_FILENAME}_blk_id dsb 32
tccs_{WLA_FILENAME}_route_freq_pending dsb 1
.ENDS
