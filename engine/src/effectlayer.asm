.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __effect_active_locals 0
.define __effect_is_back_locals 0
.define __tccs_{WLA_FILENAME}_eff_regs_locals 1
.define __effect_load_locals 12
.define __effect_restore_locals 0
.define __effect_update_locals 0
.define __effect_hofs_locals 2
.define __effect_vblank_locals 2
.SECTION ".effect_activetext_0x0" SUPERFREE
effect_active:
.ifgr __effect_active_locals 0
tsa
sec
sbc #__effect_active_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_on + 0
rep #$20
sta.b tcc__r0
__local_0:
.ifgr __effect_active_locals 0
tsa
clc
adc #__effect_active_locals
tas
.endif
rtl
.ENDS
.SECTION ".effect_is_backtext_0x1" SUPERFREE
effect_is_back:
.ifgr __effect_is_back_locals 0
tsa
sec
sbc #__effect_is_back_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_1
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_bk + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_1:
brl __local_2
+
lda #1
bra +
__local_2:
lda #0
+
and.w #255
sta.b tcc__r0
__local_3:
.ifgr __effect_is_back_locals 0
tsa
clc
adc #__effect_is_back_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_eff_regstext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_eff_regs:
.ifgr __tccs_{WLA_FILENAME}_eff_regs_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_eff_regs_locals
tas
.endif
pea.w 0
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
pea.w 7168
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
lda.l tccs_{WLA_FILENAME}_eff_cur + 0
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
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_bl + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_4
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_bl + 0
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_5
+
bra __local_6
__local_5:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_bl + 0
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_7
+
bra __local_8
__local_7:
lda.w #129
sta.b tcc__r0
bra __local_9
__local_8:
lda.w #1
sta.b tcc__r0
__local_9:
bra __local_10
__local_6:
lda.w #65
sta.b tcc__r0
__local_10:
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_eff_regs_locals + 1,s
rep #$20
lda.w #18
sep #$20
sta.l 8493
rep #$20
lda.w #2
sep #$20
sta.l 8496
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_eff_regs_locals + 1,s
sta.l 8497
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_eff_regs_locals + 1,s
pha
lda #2
pha
lda #18
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
bra __local_11
__local_4:
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
__local_11:
.ifgr __tccs_{WLA_FILENAME}_eff_regs_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_eff_regs_locals
tas
.endif
rtl
.ENDS
.SECTION ".effect_loadtext_0x3" SUPERFREE
effect_load:
.ifgr __effect_load_locals 0
tsa
sec
sbc #__effect_load_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __effect_load_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:eff_pic
sta.b tcc__r1h
lda.w #eff_pic + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -3 + __effect_load_locals + 1,s
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_eff_x8 + 0
stz.b tcc__r0
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_eff_y8 + 0
lda.w #0
sep #$20
lda -3 + __effect_load_locals + 1,s
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
brl __local_12
+
lda.w #0
sep #$20
lda -3 + __effect_load_locals + 1,s
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
__local_12:
brl __local_13
+
bra __local_14
__local_13:
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_eff_on + 0
rep #$20
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_eff_bl + 0
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
jmp.w __local_15
__local_14:
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_eff_on + 0
rep #$20
lda.w #0
sep #$20
lda -3 + __effect_load_locals + 1,s
sta.l tccs_{WLA_FILENAME}_eff_cur + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __effect_load_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:eff_mode
sta.b tcc__r1h
lda.w #eff_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_eff_bk + 0
rep #$20
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_bk + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_16
+
bra __local_17
__local_16:
lda.w #0
sep #$20
lda 3 + __effect_load_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:eff_blend
sta.b tcc__r1h
lda.w #eff_blend + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
bra __local_18
__local_17:
lda.w #0
sta.b tcc__r0
__local_18:
sep #$20
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_eff_bl + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __effect_load_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:eff_par
sta.b tcc__r1h
lda.w #eff_par + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_eff_pr + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __effect_load_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:eff_dx
sta.b tcc__r1h
lda.w #eff_dx + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_eff_vx + 0
lda.w #0
sep #$20
lda 3 + __effect_load_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:eff_dy
sta.b tcc__r1h
lda.w #eff_dy + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.l tccs_{WLA_FILENAME}_eff_vy + 0
lda.w #0
sep #$20
lda 3 + __effect_load_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:eff_repeat
sta.b tcc__r1h
lda.w #eff_repeat + 0
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
brl __local_19
+
bra __local_20
__local_19:
stz.b tcc__r0
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_eff_vx + 0
stz.b tcc__r0
lda.b tcc__r0
sta.l tccs_{WLA_FILENAME}_eff_vy + 0
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_eff_pr + 0
rep #$20
__local_20:
lda.w #0
sep #$20
lda -3 + __effect_load_locals + 1,s
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
lda -3 + __effect_load_locals + 1,s
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
pea.w 0
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
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __effect_load_locals + 1,s
__local_23:
lda -2 + __effect_load_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #1024
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
lda -2 + __effect_load_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __effect_load_locals + 1,s
bra __local_23
__local_22:
lda -2 + __effect_load_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_eff_buf
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_eff_buf + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -3 + __effect_load_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:pic_maps
sta.b tcc__r2h
lda.w #pic_maps + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda -2 + __effect_load_locals + 1,s
asl a
sta.b tcc__r0
ldy #0
lda.b [tcc__r2],y
sta.b tcc__r3
iny
iny
lda.b [tcc__r2],y
sta.b tcc__r3h
clc
lda.b tcc__r3
adc.b tcc__r0
sta.b tcc__r3
lda.b [tcc__r3]
ora.w #7168
sta.b tcc__r0
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_bk + 0
rep #$20
sta.b tcc__r2
lda.b tcc__r1
sta -8 + __effect_load_locals + 1,s
lda.b tcc__r1h
sta -6 + __effect_load_locals + 1,s
lda.b tcc__r0
sta -12 + __effect_load_locals + 1,s
lda.b tcc__r0h
sta -10 + __effect_load_locals + 1,s
lda.b tcc__r2 ; DON'T OPTIMIZE
bne +
brl __local_24
+
bra __local_25
__local_24:
lda.w #8192
sta.b tcc__r0
bra __local_26
__local_25:
lda.w #0
sta.b tcc__r0
__local_26:
lda -12 + __effect_load_locals + 1,s
ora.b tcc__r0
sta.b tcc__r1
lda -8 + __effect_load_locals + 1,s
sta.b tcc__r0
lda -6 + __effect_load_locals + 1,s
sta.b tcc__r0h
lda.b tcc__r1
sta.b [tcc__r0]
jmp.w __local_27
__local_21:
pea.w 2048
pea.w 7168
pea.w :tccs_{WLA_FILENAME}_eff_buf
pea.w tccs_{WLA_FILENAME}_eff_buf + 0
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
jsr.l tccs_{WLA_FILENAME}_eff_regs
__local_15:
.ifgr __effect_load_locals 0
tsa
clc
adc #__effect_load_locals
tas
.endif
rtl
.ENDS
.SECTION ".effect_restoretext_0x4" SUPERFREE
effect_restore:
.ifgr __effect_restore_locals 0
tsa
sec
sbc #__effect_restore_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_28
+
bra __local_29
__local_28:
bra __local_30
__local_29:
jsr.l tccs_{WLA_FILENAME}_eff_regs
__local_30:
.ifgr __effect_restore_locals 0
tsa
clc
adc #__effect_restore_locals
tas
.endif
rtl
.ENDS
.SECTION ".effect_updatetext_0x5" SUPERFREE
effect_update:
.ifgr __effect_update_locals 0
tsa
sec
sbc #__effect_update_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_on + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_31
+
bra __local_32
__local_31:
bra __local_33
__local_32:
lda.l tccs_{WLA_FILENAME}_eff_x8 + 0
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_eff_vx + 0
clc
adc.b tcc__r0
sta.l tccs_{WLA_FILENAME}_eff_x8 + 0
lda.l tccs_{WLA_FILENAME}_eff_y8 + 0
sta.b tcc__r0
lda.l tccs_{WLA_FILENAME}_eff_vy + 0
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
sta.l tccs_{WLA_FILENAME}_eff_y8 + 0
__local_33:
.ifgr __effect_update_locals 0
tsa
clc
adc #__effect_update_locals
tas
.endif
rtl
.ENDS
.SECTION ".effect_hofstext_0x6" SUPERFREE
effect_hofs:
.ifgr __effect_hofs_locals 0
tsa
sec
sbc #__effect_hofs_locals
tas
.endif
lda.l tccs_{WLA_FILENAME}_eff_x8 + 0
xba
and #$00ff
sta -2 + __effect_hofs_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_pr + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_34
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_pr + 0
rep #$20
sta.b tcc__r0
cmp #3
beq +
brl __local_35
+
bra __local_36
__local_35:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_pr + 0
rep #$20
sta.b tcc__r0
bra __local_37
__local_36:
lda.w #0
sta.b tcc__r0
__local_37:
lda.l camera + 0
sta.b tcc__r1
ldy.b tcc__r0
beq +
-
lsr a
dey
bne -
+
sta.b tcc__r1
lda -2 + __effect_hofs_locals + 1,s
clc
adc.b tcc__r1
sta.b tcc__r0
sta -2 + __effect_hofs_locals + 1,s
__local_34:
lda -2 + __effect_hofs_locals + 1,s
sta.b tcc__r0
__local_38:
.ifgr __effect_hofs_locals 0
tsa
clc
adc #__effect_hofs_locals
tas
.endif
rtl
.ENDS
.SECTION ".effect_vblanktext_0x7" SUPERFREE
effect_vblank:
.ifgr __effect_vblank_locals 0
tsa
sec
sbc #__effect_vblank_locals
tas
.endif
lda.l tccs_{WLA_FILENAME}_eff_y8 + 0
xba
and #$00ff
sta -2 + __effect_vblank_locals + 1,s
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_pr + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_39
+
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_pr + 0
rep #$20
sta.b tcc__r0
cmp #3
beq +
brl __local_40
+
bra __local_41
__local_40:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_eff_pr + 0
rep #$20
sta.b tcc__r0
bra __local_42
__local_41:
lda.w #0
sta.b tcc__r0
__local_42:
lda.l camera + 2
sta.b tcc__r1
ldy.b tcc__r0
beq +
-
lsr a
dey
bne -
+
sta.b tcc__r1
lda -2 + __effect_vblank_locals + 1,s
clc
adc.b tcc__r1
sta.b tcc__r0
sta -2 + __effect_vblank_locals + 1,s
__local_39:
jsr.l effect_hofs
lda -2 + __effect_vblank_locals + 1,s
pha
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
.ifgr __effect_vblank_locals 0
tsa
clc
adc #__effect_vblank_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_eff_on dsb 1
tccs_{WLA_FILENAME}_eff_cur dsb 1
tccs_{WLA_FILENAME}_eff_bl dsb 1
tccs_{WLA_FILENAME}_eff_pr dsb 1
tccs_{WLA_FILENAME}_eff_bk dsb 2
tccs_{WLA_FILENAME}_eff_vx dsb 2
tccs_{WLA_FILENAME}_eff_vy dsb 2
tccs_{WLA_FILENAME}_eff_x8 dsb 2
tccs_{WLA_FILENAME}_eff_y8 dsb 2
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $0
.db $0
.db $0
.db $0
.db $0,$0
.db $0,$0
.db $0,$0
.db $0,$0
.db $0,$0
.ENDS
.SECTION ".rodata" SUPERFREE
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
tccs_{WLA_FILENAME}_eff_buf dsb 2048
.ENDS
