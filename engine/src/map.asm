.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_map_win_target_locals 2
.define __map_set_metatiles_locals 0
.define __tccs_{WLA_FILENAME}_map_fill_layer_locals 24
.define __map_init_locals 0
.define __tccs_{WLA_FILENAME}_map_queue_col_locals 24
.define __tccs_{WLA_FILENAME}_map_queue_row_locals 24
.define __map_update_locals 4
.define __tccs_{WLA_FILENAME}_map_col_dma_locals 2
.define __tccs_{WLA_FILENAME}_map_row_dma_locals 2
.define __map_vblank_locals 0
.SECTION ".tccs_{WLA_FILENAME}_map_win_targettext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_map_win_target:
.ifgr __tccs_{WLA_FILENAME}_map_win_target_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_map_win_target_locals
tas
.endif
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_map_win_target_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #32
tay
beq ++
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_0
+
lda.w #0
sta.b tcc__r0
jmp.w __local_1
__local_0:
lda 3 + __tccs_{WLA_FILENAME}_map_win_target_locals + 1,s
lsr a
lsr a
lsr a
lsr a
sta -2 + __tccs_{WLA_FILENAME}_map_win_target_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #8
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_2
+
lda -2 + __tccs_{WLA_FILENAME}_map_win_target_locals + 1,s
sec
sbc.w #8
sta.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_map_win_target_locals + 1,s
bra __local_3
__local_2:
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_map_win_target_locals + 1,s
__local_3:
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_map_win_target_locals + 1,s
rep #$20
sec
sbc.w #32
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_map_win_target_locals + 1,s
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_4
+
lda.w #0
sep #$20
lda 5 + __tccs_{WLA_FILENAME}_map_win_target_locals + 1,s
rep #$20
sec
sbc.w #32
sta.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_map_win_target_locals + 1,s
__local_4:
lda -2 + __tccs_{WLA_FILENAME}_map_win_target_locals + 1,s
sta.b tcc__r0
__local_1:
__local_5:
.ifgr __tccs_{WLA_FILENAME}_map_win_target_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_map_win_target_locals
tas
.endif
rtl
.ENDS
.SECTION ".map_set_metatilestext_0x1" SUPERFREE
map_set_metatiles:
.ifgr __map_set_metatiles_locals 0
tsa
sec
sbc #__map_set_metatiles_locals
tas
.endif
lda 5 + __map_set_metatiles_locals + 1,s
sta.b tcc__r0h
lda 3 + __map_set_metatiles_locals + 1,s
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_mt_table + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_mt_table + 0 + 2
lda 9 + __map_set_metatiles_locals + 1,s
sta.b tcc__r0h
lda 7 + __map_set_metatiles_locals + 1,s
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_prio_table + 0
lda.b tcc__r0h
sta.w tccs_{WLA_FILENAME}_prio_table + 0 + 2
.ifgr __map_set_metatiles_locals 0
tsa
clc
adc #__map_set_metatiles_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_map_fill_layertext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_map_fill_layer:
.ifgr __tccs_{WLA_FILENAME}_map_fill_layer_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_map_fill_layer_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
__local_8:
lda -4 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #32
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_6
+
bra __local_7
__local_38:
lda -4 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
bra __local_8
__local_7:
lda.w tccs_{WLA_FILENAME}_win_y + 0
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
clc
adc.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
lda.w #0
sep #$20
lda.l scene_ctx + 1
rep #$20
sta.b tcc__r0
lda -8 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
sta.b tcc__r9
lda.b tcc__r1
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r1
lda 3 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_win_x + 0
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
sta -24 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
lda.b tcc__r0h
sta -22 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
__local_11:
lda -2 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #32
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
__local_23:
__local_37:
lda -2 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
bra __local_11
__local_10:
lda.w tccs_{WLA_FILENAME}_win_x + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
clc
adc.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
lda.w #0
sep #$20
lda.l scene_ctx + 2
rep #$20
sta.b tcc__r0
lda -8 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
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
beq +
brl __local_12
+
lda.w #0
sep #$20
lda.l scene_ctx + 1
rep #$20
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
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
beq +
__local_12:
brl __local_13
+
jmp.w __local_14
__local_13:
lda -8 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
asl a
and.w #63
sta.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
__local_17:
lda -8 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
asl a
and.w #63
inc a
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
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
brl __local_15
+
bra __local_16
__local_22:
lda -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
bra __local_17
__local_16:
lda -6 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
asl a
and.w #63
sta.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
__local_20:
lda -6 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
asl a
and.w #63
inc a
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
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
brl __local_18
+
bra __local_19
__local_21:
lda -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
bra __local_20
__local_19:
lda -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
ldy.w #5
-
lsr a
dey
bne -
+
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r1
ldy.w #5
-
lsr a
dey
bne -
+
asl a
sta.b tcc__r1
clc
adc.b tcc__r0
sta -16 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
ldy.w #10
-
asl a
dey
bne -
+
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
and.w #31
sta.b tcc__r1
ldy.w #5
-
asl a
dey
bne -
+
clc
adc.b tcc__r0
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
and.w #31
sta.b tcc__r1
clc
adc.b tcc__r0
sta -18 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_bg_map_buffer
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_bg_map_buffer + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_21
__local_18:
jmp.w __local_22
__local_15:
jmp.w __local_23
__local_14:
lda -24 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
asl a
asl a
sta.b tcc__r1
sta -14 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
lda.w #0
sep #$20
lda 9 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_24
+
bra __local_25
__local_24:
lda.w tccs_{WLA_FILENAME}_lo_prio + 0
sta.b tcc__r0
bra __local_26
__local_25:
lda.w #0
sta.b tcc__r0
__local_26:
lda.b tcc__r0
sta -20 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
lda.w #0
sep #$20
lda 9 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_27
+
lda -24 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.w tccs_{WLA_FILENAME}_prio_table + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_prio_table + 0 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
__local_27:
brl __local_28
+
lda.w #8192
sta.b tcc__r0
sta -20 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
__local_28:
lda -22 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0h
lda -24 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -24 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
lda.b tcc__r0h
sta -22 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
lda -8 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
asl a
and.w #63
sta.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
__local_31:
lda -8 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
asl a
and.w #63
inc a
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
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
brl __local_29
+
bra __local_30
__local_36:
lda -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
bra __local_31
__local_30:
lda -6 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
asl a
and.w #63
sta.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
__local_34:
lda -6 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
asl a
and.w #63
inc a
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
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
brl __local_32
+
bra __local_33
__local_35:
lda -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
bra __local_34
__local_33:
lda -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
ldy.w #5
-
lsr a
dey
bne -
+
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r1
ldy.w #5
-
lsr a
dey
bne -
+
asl a
sta.b tcc__r1
clc
adc.b tcc__r0
sta -16 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
ldy.w #10
-
asl a
dey
bne -
+
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
and.w #31
sta.b tcc__r1
ldy.w #5
-
asl a
dey
bne -
+
clc
adc.b tcc__r0
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
and.w #31
sta.b tcc__r1
clc
adc.b tcc__r0
sta -18 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_bg_map_buffer
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_bg_map_buffer + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -12 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
and.w #1
asl a
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r2
lda -10 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
and.w #1
clc
adc.b tcc__r2
asl a
sta.b tcc__r2
lda.w tccs_{WLA_FILENAME}_mt_table + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_mt_table + 0 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r2
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda -20 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
sta.b tcc__r0
ora.b tcc__r2
sta.b tcc__r2
sta.b [tcc__r1]
jmp.w __local_35
__local_32:
jmp.w __local_36
__local_29:
jmp.w __local_37
__local_9:
jmp.w __local_38
__local_6:
pea.w 8192
lda 9 + __tccs_{WLA_FILENAME}_map_fill_layer_locals + 1,s
pha
pea.w :tccs_{WLA_FILENAME}_bg_map_buffer
pea.w tccs_{WLA_FILENAME}_bg_map_buffer + 0
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
.ifgr __tccs_{WLA_FILENAME}_map_fill_layer_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_map_fill_layer_locals
tas
.endif
rtl
.ENDS
.SECTION ".map_inittext_0x3" SUPERFREE
map_init:
.ifgr __map_init_locals 0
tsa
sec
sbc #__map_init_locals
tas
.endif
jsr.l effect_is_back
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_39
+
bra __local_40
__local_39:
lda.w #0
sta.b tcc__r0
bra __local_41
__local_40:
lda.w #8192
sta.b tcc__r0
__local_41:
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_lo_prio + 0
lda.w #0
sep #$20
lda.l scene_ctx + 1
pha
rep #$20
lda.l camera + 0
pha
jsr.l tccs_{WLA_FILENAME}_map_win_target
tsa
clc
adc #3
tas
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_win_x + 0
lda.w #0
sep #$20
lda.l scene_ctx + 2
pha
rep #$20
lda.l camera + 2
pha
jsr.l tccs_{WLA_FILENAME}_map_win_target
tsa
clc
adc #3
tas
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_win_y + 0
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_col_pending + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_row_pending + 0
lda #0
pha
rep #$20
pea.w 24576
lda.l scene_ctx + 4
sta.b tcc__r0
lda.l scene_ctx + 4 + 2
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_map_fill_layer
tsa
clc
adc #7
tas
jsr.l effect_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_42
+
bra __local_43
__local_42:
sep #$20
lda #1
pha
rep #$20
pea.w 0
lda.l scene_ctx + 8
sta.b tcc__r0
lda.l scene_ctx + 8 + 2
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_map_fill_layer
tsa
clc
adc #7
tas
__local_43:
.ifgr __map_init_locals 0
tsa
clc
adc #__map_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_map_queue_coltext_0x4" SUPERFREE
tccs_{WLA_FILENAME}_map_queue_col:
.ifgr __tccs_{WLA_FILENAME}_map_queue_col_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_map_queue_col_locals
tas
.endif
lda.w #0
sep #$20
lda.l scene_ctx + 1
rep #$20
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_win_y + 0
sta.b tcc__r1
lda.b tcc__r0
sta.b tcc__r9
lda.b tcc__r1
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r1
lda.l scene_ctx + 4
sta.b tcc__r0
lda.l scene_ctx + 4 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
lda.b tcc__r0h
sta -10 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
lda.w #0
sep #$20
lda.l scene_ctx + 1
rep #$20
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_win_y + 0
sta.b tcc__r1
lda.b tcc__r0
sta.b tcc__r9
lda.b tcc__r1
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r1
lda.l scene_ctx + 8
sta.b tcc__r0
lda.l scene_ctx + 8 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
sta -16 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
lda.b tcc__r0h
sta -14 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
__local_46:
lda -2 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #32
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_44
+
bra __local_45
__local_48:
__local_52:
lda -2 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
bra __local_46
__local_45:
lda.w tccs_{WLA_FILENAME}_win_y + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
clc
adc.b tcc__r0
asl a
and.w #63
sta -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
lda.w tccs_{WLA_FILENAME}_win_y + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
clc
adc.b tcc__r0
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
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_47
+
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_lo + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_lo + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_lo + 128
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_lo + 128
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_up + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_up + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_up + 128
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_up + 128
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_48
__local_47:
lda -12 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
asl a
asl a
asl a
sta.b tcc__r1
lda.w tccs_{WLA_FILENAME}_mt_table + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_mt_table + 0 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
sta -20 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
lda.b tcc__r0h
sta -18 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
lda -16 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
asl a
asl a
asl a
sta.b tcc__r1
lda.w tccs_{WLA_FILENAME}_mt_table + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_mt_table + 0 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
sta -24 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
lda.b tcc__r0h
sta -22 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
lda -16 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.w tccs_{WLA_FILENAME}_prio_table + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_prio_table + 0 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_49
+
bra __local_50
__local_49:
lda.w #0
sta.b tcc__r0
bra __local_51
__local_50:
lda.w #8192
sta.b tcc__r0
__local_51:
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_lo + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -20 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0h
lda.b [tcc__r0]
sta.b tcc__r2
lda.w tccs_{WLA_FILENAME}_lo_prio + 0
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_lo + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -20 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda.w tccs_{WLA_FILENAME}_lo_prio + 0
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_lo + 128
clc
adc.b tcc__r0
sta.b tcc__r1
lda -18 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda.w tccs_{WLA_FILENAME}_lo_prio + 0
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_lo + 128
clc
adc.b tcc__r0
sta.b tcc__r1
lda -20 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #6
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda.w tccs_{WLA_FILENAME}_lo_prio + 0
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_up + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -24 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0h
lda.b [tcc__r0]
sta.b tcc__r2
lda -6 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_up + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -24 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda -6 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_up + 128
clc
adc.b tcc__r0
sta.b tcc__r1
lda -22 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0h
lda -24 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda -6 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_up + 128
clc
adc.b tcc__r0
sta.b tcc__r1
lda -24 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #6
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda -6 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
ora.b tcc__r2
sta.b tcc__r2
sta.b [tcc__r1]
lda.w #0
sep #$20
lda.l scene_ctx + 1
rep #$20
sta.b tcc__r0
lda -12 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r1
lda -10 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
clc
lda.b tcc__r1
adc.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
lda.w #0
sep #$20
lda.l scene_ctx + 1
rep #$20
sta.b tcc__r0
lda -16 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r1
lda -14 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
sta -16 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
jmp.w __local_52
__local_44:
lda 3 + __tccs_{WLA_FILENAME}_map_queue_col_locals + 1,s
asl a
and.w #63
sta.w tccs_{WLA_FILENAME}_col_vram_x + 0
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_col_pending + 0
rep #$20
.ifgr __tccs_{WLA_FILENAME}_map_queue_col_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_map_queue_col_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_map_queue_rowtext_0x5" SUPERFREE
tccs_{WLA_FILENAME}_map_queue_row:
.ifgr __tccs_{WLA_FILENAME}_map_queue_row_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_map_queue_row_locals
tas
.endif
lda.w #0
sep #$20
lda.l scene_ctx + 1
rep #$20
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
sta.b tcc__r9
lda.b tcc__r1
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r1
lda.l scene_ctx + 4
sta.b tcc__r0
lda.l scene_ctx + 4 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_win_x + 0
clc
adc.b tcc__r0
sta.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda.b tcc__r0h
sta -10 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda.w #0
sep #$20
lda.l scene_ctx + 1
rep #$20
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
sta.b tcc__r9
lda.b tcc__r1
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r1
lda.l scene_ctx + 8
sta.b tcc__r0
lda.l scene_ctx + 8 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_win_x + 0
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
sta -16 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda.b tcc__r0h
sta -14 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
__local_55:
lda -2 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #32
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_53
+
bra __local_54
__local_57:
__local_61:
lda -2 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
bra __local_55
__local_54:
lda.w tccs_{WLA_FILENAME}_win_x + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
clc
adc.b tcc__r0
asl a
and.w #63
sta -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda.w tccs_{WLA_FILENAME}_win_x + 0
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
clc
adc.b tcc__r0
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
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_56
+
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_lo + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_lo + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_lo + 128
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_lo + 128
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_up + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_up + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_up + 128
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_up + 128
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_57
__local_56:
lda -12 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
asl a
asl a
asl a
sta.b tcc__r1
lda.w tccs_{WLA_FILENAME}_mt_table + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_mt_table + 0 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
sta -20 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda.b tcc__r0h
sta -18 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda -16 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
asl a
asl a
asl a
sta.b tcc__r1
lda.w tccs_{WLA_FILENAME}_mt_table + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_mt_table + 0 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
sta -24 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda.b tcc__r0h
sta -22 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda -16 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
lda -14 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.w tccs_{WLA_FILENAME}_prio_table + 0
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_prio_table + 0 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_58
+
bra __local_59
__local_58:
lda.w #0
sta.b tcc__r0
bra __local_60
__local_59:
lda.w #8192
sta.b tcc__r0
__local_60:
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_lo + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -20 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
lda.b [tcc__r0]
sta.b tcc__r2
lda.w tccs_{WLA_FILENAME}_lo_prio + 0
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_lo + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -18 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
lda -20 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda.w tccs_{WLA_FILENAME}_lo_prio + 0
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_lo + 128
clc
adc.b tcc__r0
sta.b tcc__r1
lda -20 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda.w tccs_{WLA_FILENAME}_lo_prio + 0
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_lo
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_lo + 128
clc
adc.b tcc__r0
sta.b tcc__r1
lda -20 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
lda -18 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #6
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda.w tccs_{WLA_FILENAME}_lo_prio + 0
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_up + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -24 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
lda.b [tcc__r0]
sta.b tcc__r2
lda -6 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_up + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -22 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
lda -24 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda -6 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_up + 128
clc
adc.b tcc__r0
sta.b tcc__r1
lda -24 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda -6 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
ora.b tcc__r2
sta.b [tcc__r1]
lda -4 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_row_up
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_row_up + 128
clc
adc.b tcc__r0
sta.b tcc__r1
lda -24 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
lda -22 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #6
sta.b tcc__r0
lda.b [tcc__r0]
sta.b tcc__r2
lda -6 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
ora.b tcc__r2
sta.b tcc__r2
sta.b [tcc__r1]
lda -10 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda -12 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
inc a
sta.b tcc__r0
sta -12 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda -14 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0h
lda -16 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -16 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
lda.b tcc__r0h
sta -14 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
jmp.w __local_61
__local_53:
lda 3 + __tccs_{WLA_FILENAME}_map_queue_row_locals + 1,s
asl a
and.w #63
sta.w tccs_{WLA_FILENAME}_row_vram_y + 0
lda.w #1
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_row_pending + 0
rep #$20
.ifgr __tccs_{WLA_FILENAME}_map_queue_row_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_map_queue_row_locals
tas
.endif
rtl
.ENDS
.SECTION ".map_updatetext_0x6" SUPERFREE
map_update:
.ifgr __map_update_locals 0
tsa
sec
sbc #__map_update_locals
tas
.endif
lda.w #0
sep #$20
lda.l scene_ctx + 1
pha
rep #$20
lda.l camera + 0
pha
jsr.l tccs_{WLA_FILENAME}_map_win_target
tsa
clc
adc #3
tas
lda.b tcc__r0
sta -2 + __map_update_locals + 1,s
lda.w #0
sep #$20
lda.l scene_ctx + 2
pha
rep #$20
lda.l camera + 2
pha
jsr.l tccs_{WLA_FILENAME}_map_win_target
tsa
clc
adc #3
tas
lda.b tcc__r0
sta -4 + __map_update_locals + 1,s
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_win_y + 0
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_62
++
lda.w tccs_{WLA_FILENAME}_win_y + 0
inc a
sta.w tccs_{WLA_FILENAME}_win_y + 0
lda.w tccs_{WLA_FILENAME}_win_y + 0
clc
adc.w #32
sta.b tcc__r0
dec.b tcc__r0
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_map_queue_row
pla
bra __local_63
__local_62:
lda -4 + __map_update_locals + 1,s
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_win_y + 0
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
brl __local_64
+
lda.w tccs_{WLA_FILENAME}_win_y + 0
clc
adc.w #65535
sta.w tccs_{WLA_FILENAME}_win_y + 0
lda.w tccs_{WLA_FILENAME}_win_y + 0
pha
jsr.l tccs_{WLA_FILENAME}_map_queue_row
pla
__local_64:
__local_63:
lda -2 + __map_update_locals + 1,s
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_win_x + 0
sta.b tcc__r1
lda.b tcc__r0
cmp.b tcc__r1
beq +
bcc +
brl ++
+
brl __local_65
++
lda.w tccs_{WLA_FILENAME}_win_x + 0
inc a
sta.w tccs_{WLA_FILENAME}_win_x + 0
lda.w tccs_{WLA_FILENAME}_win_x + 0
clc
adc.w #32
sta.b tcc__r0
dec.b tcc__r0
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_map_queue_col
pla
bra __local_66
__local_65:
lda -2 + __map_update_locals + 1,s
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_win_x + 0
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
brl __local_67
+
lda.w tccs_{WLA_FILENAME}_win_x + 0
clc
adc.w #65535
sta.w tccs_{WLA_FILENAME}_win_x + 0
lda.w tccs_{WLA_FILENAME}_win_x + 0
pha
jsr.l tccs_{WLA_FILENAME}_map_queue_col
pla
__local_67:
__local_66:
.ifgr __map_update_locals 0
tsa
clc
adc #__map_update_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_map_col_dmatext_0x7" SUPERFREE
tccs_{WLA_FILENAME}_map_col_dma:
.ifgr __tccs_{WLA_FILENAME}_map_col_dma_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_map_col_dma_locals
tas
.endif
lda 5 + __tccs_{WLA_FILENAME}_map_col_dma_locals + 1,s
sta.b tcc__r0
ldy.w #5
-
lsr a
dey
bne -
+
sta.b tcc__r0
ldy.w #10
-
asl a
dey
bne -
+
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_map_col_dma_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
lda 5 + __tccs_{WLA_FILENAME}_map_col_dma_locals + 1,s
and.w #31
clc
adc.b tcc__r1
sta -2 + __tccs_{WLA_FILENAME}_map_col_dma_locals + 1,s
lda 7 + __tccs_{WLA_FILENAME}_map_col_dma_locals + 1,s
sta.b tcc__r0
lda 9 + __tccs_{WLA_FILENAME}_map_col_dma_locals + 1,s
sta.b tcc__r0h
pea.w 6145
sep #$20
lda #129
pha
rep #$20
pea.w 64
lda 3 + __tccs_{WLA_FILENAME}_map_col_dma_locals + 1,s
pha
pei (tcc__r0h)
pei (tcc__r0)
jsr.l dmaCopyVram7
tsa
clc
adc #11
tas
lda 7 + __tccs_{WLA_FILENAME}_map_col_dma_locals + 1,s
sta.b tcc__r0
lda 9 + __tccs_{WLA_FILENAME}_map_col_dma_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #64
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_map_col_dma_locals + 1,s
clc
adc.w #2048
sta.b tcc__r1
pea.w 6145
sep #$20
lda #129
pha
rep #$20
pea.w 64
pei (tcc__r1)
pei (tcc__r0h)
pei (tcc__r0)
jsr.l dmaCopyVram7
tsa
clc
adc #11
tas
.ifgr __tccs_{WLA_FILENAME}_map_col_dma_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_map_col_dma_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_map_row_dmatext_0x8" SUPERFREE
tccs_{WLA_FILENAME}_map_row_dma:
.ifgr __tccs_{WLA_FILENAME}_map_row_dma_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_map_row_dma_locals
tas
.endif
lda 5 + __tccs_{WLA_FILENAME}_map_row_dma_locals + 1,s
sta.b tcc__r0
ldy.w #5
-
lsr a
dey
bne -
+
asl a
sta.b tcc__r0
ldy.w #10
-
asl a
dey
bne -
+
sta.b tcc__r0
lda 3 + __tccs_{WLA_FILENAME}_map_row_dma_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
lda 5 + __tccs_{WLA_FILENAME}_map_row_dma_locals + 1,s
and.w #31
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
clc
adc.b tcc__r1
sta -2 + __tccs_{WLA_FILENAME}_map_row_dma_locals + 1,s
lda 7 + __tccs_{WLA_FILENAME}_map_row_dma_locals + 1,s
sta.b tcc__r0
lda 9 + __tccs_{WLA_FILENAME}_map_row_dma_locals + 1,s
sta.b tcc__r0h
pea.w 6145
sep #$20
lda #128
pha
rep #$20
pea.w 64
lda 3 + __tccs_{WLA_FILENAME}_map_row_dma_locals + 1,s
pha
pei (tcc__r0h)
pei (tcc__r0)
jsr.l dmaCopyVram7
tsa
clc
adc #11
tas
lda 7 + __tccs_{WLA_FILENAME}_map_row_dma_locals + 1,s
sta.b tcc__r0
lda 9 + __tccs_{WLA_FILENAME}_map_row_dma_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #64
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_map_row_dma_locals + 1,s
clc
adc.w #1024
sta.b tcc__r1
pea.w 6145
sep #$20
lda #128
pha
rep #$20
pea.w 64
pei (tcc__r1)
pei (tcc__r0h)
pei (tcc__r0)
jsr.l dmaCopyVram7
tsa
clc
adc #11
tas
.ifgr __tccs_{WLA_FILENAME}_map_row_dma_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_map_row_dma_locals
tas
.endif
rtl
.ENDS
.SECTION ".map_vblanktext_0x9" SUPERFREE
map_vblank:
.ifgr __map_vblank_locals 0
tsa
sec
sbc #__map_vblank_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_col_pending + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_68
+
pea.w :tccs_{WLA_FILENAME}_col_lo
pea.w tccs_{WLA_FILENAME}_col_lo + 0
lda.w tccs_{WLA_FILENAME}_col_vram_x + 0
pha
pea.w 24576
jsr.l tccs_{WLA_FILENAME}_map_col_dma
tsa
clc
adc #8
tas
lda.w tccs_{WLA_FILENAME}_col_vram_x + 0
sta.b tcc__r0
inc.b tcc__r0
pea.w :tccs_{WLA_FILENAME}_col_lo
pea.w tccs_{WLA_FILENAME}_col_lo + 128
pei (tcc__r0)
pea.w 24576
jsr.l tccs_{WLA_FILENAME}_map_col_dma
tsa
clc
adc #8
tas
jsr.l effect_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_69
+
bra __local_70
__local_69:
pea.w :tccs_{WLA_FILENAME}_col_up
pea.w tccs_{WLA_FILENAME}_col_up + 0
lda.w tccs_{WLA_FILENAME}_col_vram_x + 0
pha
pea.w 0
jsr.l tccs_{WLA_FILENAME}_map_col_dma
tsa
clc
adc #8
tas
lda.w tccs_{WLA_FILENAME}_col_vram_x + 0
sta.b tcc__r0
inc.b tcc__r0
pea.w :tccs_{WLA_FILENAME}_col_up
pea.w tccs_{WLA_FILENAME}_col_up + 128
pei (tcc__r0)
pea.w 0
jsr.l tccs_{WLA_FILENAME}_map_col_dma
tsa
clc
adc #8
tas
__local_70:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_col_pending + 0
rep #$20
__local_68:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_row_pending + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_71
+
pea.w :tccs_{WLA_FILENAME}_row_lo
pea.w tccs_{WLA_FILENAME}_row_lo + 0
lda.w tccs_{WLA_FILENAME}_row_vram_y + 0
pha
pea.w 24576
jsr.l tccs_{WLA_FILENAME}_map_row_dma
tsa
clc
adc #8
tas
lda.w tccs_{WLA_FILENAME}_row_vram_y + 0
sta.b tcc__r0
inc.b tcc__r0
pea.w :tccs_{WLA_FILENAME}_row_lo
pea.w tccs_{WLA_FILENAME}_row_lo + 128
pei (tcc__r0)
pea.w 24576
jsr.l tccs_{WLA_FILENAME}_map_row_dma
tsa
clc
adc #8
tas
jsr.l effect_active
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_72
+
bra __local_73
__local_72:
pea.w :tccs_{WLA_FILENAME}_row_up
pea.w tccs_{WLA_FILENAME}_row_up + 0
lda.w tccs_{WLA_FILENAME}_row_vram_y + 0
pha
pea.w 0
jsr.l tccs_{WLA_FILENAME}_map_row_dma
tsa
clc
adc #8
tas
lda.w tccs_{WLA_FILENAME}_row_vram_y + 0
sta.b tcc__r0
inc.b tcc__r0
pea.w :tccs_{WLA_FILENAME}_row_up
pea.w tccs_{WLA_FILENAME}_row_up + 128
pei (tcc__r0)
pea.w 0
jsr.l tccs_{WLA_FILENAME}_map_row_dma
tsa
clc
adc #8
tas
__local_73:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_row_pending + 0
rep #$20
__local_71:
.ifgr __map_vblank_locals 0
tsa
clc
adc #__map_vblank_locals
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
tccs_{WLA_FILENAME}_mt_table dsb 4
tccs_{WLA_FILENAME}_prio_table dsb 4
tccs_{WLA_FILENAME}_lo_prio dsb 2
tccs_{WLA_FILENAME}_win_x dsb 2
tccs_{WLA_FILENAME}_win_y dsb 2
tccs_{WLA_FILENAME}_bg_map_buffer dsb 8192
tccs_{WLA_FILENAME}_col_lo dsb 256
tccs_{WLA_FILENAME}_col_up dsb 256
tccs_{WLA_FILENAME}_row_lo dsb 256
tccs_{WLA_FILENAME}_row_up dsb 256
tccs_{WLA_FILENAME}_col_pending dsb 1
tccs_{WLA_FILENAME}_row_pending dsb 1
tccs_{WLA_FILENAME}_col_vram_x dsb 2
tccs_{WLA_FILENAME}_row_vram_y dsb 2
.ENDS
