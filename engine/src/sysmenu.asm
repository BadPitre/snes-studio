.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_sm_build_slots_locals 2
.define __sysmenu_init_locals 0
.define __sysmenu_active_locals 0
.define __sysmenu_open_locals 0
.define __sysmenu_take_load_locals 0
.define __tccs_{WLA_FILENAME}_sm_close_locals 0
.define __sysmenu_update_locals 3
.SECTION ".tccs_{WLA_FILENAME}_sm_build_slotstext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_sm_build_slots:
.ifgr __tccs_{WLA_FILENAME}_sm_build_slots_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_sm_build_slots_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
__local_2:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #4
bvc +
eor #$8000
+
bmi +
brl __local_0
+
bra __local_1
__local_9:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
bra __local_2
__local_1:
lda.w #0
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
__local_5:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs__FUNC_tccs_{WLA_FILENAME}_sm_build_slots_base
sta.b tcc__r1h
lda.w #tccs__FUNC_tccs_{WLA_FILENAME}_sm_build_slots_base + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
xba
xba
bpl +
ora.w #$ff00
+
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_3
+
bra __local_4
__local_6:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
jmp.w __local_5
__local_4:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slots
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sm_slots + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
clc
adc.b tcc__r1
sta.b tcc__r1
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs__FUNC_tccs_{WLA_FILENAME}_sm_build_slots_base
sta.b tcc__r2h
lda.w #tccs__FUNC_tccs_{WLA_FILENAME}_sm_build_slots_base + 0
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
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_6
__local_3:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slots
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sm_slots + 0
clc
adc.b tcc__r0
clc
adc.w #5
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
clc
adc.w #49
xba
and #$ff00
sta.b tcc__r0
ldy.w #8
-
cmp #$8000
ror a
dey
bne -
+
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
pha
rep #$20
jsr.l save_exists
tsa
clc
adc #1
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_7
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slots
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sm_slots + 0
clc
adc.b tcc__r0
clc
adc.w #9
sta.b tcc__r1
lda.w #79
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slots
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sm_slots + 0
clc
adc.b tcc__r0
clc
adc.w #10
sta.b tcc__r1
lda.w #75
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slots
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sm_slots + 0
clc
adc.b tcc__r0
clc
adc.w #11
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_8
__local_7:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slots
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sm_slots + 0
clc
adc.b tcc__r0
clc
adc.w #9
sta.b tcc__r1
lda.w #118
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slots
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sm_slots + 0
clc
adc.b tcc__r0
clc
adc.w #10
sta.b tcc__r1
lda.w #105
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slots
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sm_slots + 0
clc
adc.b tcc__r0
clc
adc.w #11
sta.b tcc__r1
lda.w #100
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slots
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sm_slots + 0
clc
adc.b tcc__r0
clc
adc.w #12
sta.b tcc__r1
lda.w #101
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slots
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sm_slots + 0
clc
adc.b tcc__r0
clc
adc.w #13
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_8:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slot_ptrs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_sm_slot_ptrs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_sm_build_slots_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sm_slots
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_sm_slots + 0
clc
adc.b tcc__r0
sta.b tcc__r2
ldy #0
sta.b [tcc__r1],y
lda.b tcc__r2h
iny
iny
sta.b [tcc__r1],y
jmp.w __local_9
__local_0:
.ifgr __tccs_{WLA_FILENAME}_sm_build_slots_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_sm_build_slots_locals
tas
.endif
rtl
.ENDS
.SECTION ".sysmenu_inittext_0x1" SUPERFREE
sysmenu_init:
.ifgr __sysmenu_init_locals 0
tsa
sec
sbc #__sysmenu_init_locals
tas
.endif
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_sel + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_load_pending + 0
rep #$20
.ifgr __sysmenu_init_locals 0
tsa
clc
adc #__sysmenu_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".sysmenu_activetext_0x2" SUPERFREE
sysmenu_active:
.ifgr __sysmenu_active_locals 0
tsa
sec
sbc #__sysmenu_active_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_state + 0
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
__local_10:
.ifgr __sysmenu_active_locals 0
tsa
clc
adc #__sysmenu_active_locals
tas
.endif
rtl
.ENDS
.SECTION ".sysmenu_opentext_0x3" SUPERFREE
sysmenu_open:
.ifgr __sysmenu_open_locals 0
tsa
sec
sbc #__sysmenu_open_locals
tas
.endif
lda.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_sel + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_load_pending + 0
lda #0
pha
lda #3
pha
rep #$20
pea.w :tccs_{WLA_FILENAME}_sm_main
pea.w tccs_{WLA_FILENAME}_sm_main + 0
jsr.l textbox_choices_raw
tsa
clc
adc #6
tas
.ifgr __sysmenu_open_locals 0
tsa
clc
adc #__sysmenu_open_locals
tas
.endif
rtl
.ENDS
.SECTION ".sysmenu_take_loadtext_0x4" SUPERFREE
sysmenu_take_load:
.ifgr __sysmenu_take_load_locals 0
tsa
sec
sbc #__sysmenu_take_load_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_load_pending + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_11
+
bra __local_12
__local_11:
lda.w #0
sta.b tcc__r0
bra __local_13
__local_12:
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_load_pending + 0
rep #$20
lda.w #1
sta.b tcc__r0
__local_13:
__local_14:
.ifgr __sysmenu_take_load_locals 0
tsa
clc
adc #__sysmenu_take_load_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_sm_closetext_0x5" SUPERFREE
tccs_{WLA_FILENAME}_sm_close:
.ifgr __tccs_{WLA_FILENAME}_sm_close_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_sm_close_locals
tas
.endif
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
jsr.l textbox_close
.ifgr __tccs_{WLA_FILENAME}_sm_close_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_sm_close_locals
tas
.endif
rtl
.ENDS
.SECTION ".sysmenu_updatetext_0x6" SUPERFREE
sysmenu_update:
.ifgr __sysmenu_update_locals 0
tsa
sec
sbc #__sysmenu_update_locals
tas
.endif
lda.l pad_keysdown + 0
sta -2 + __sysmenu_update_locals + 1,s
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
sta.b tcc__r0
cmp #4
beq +
brl __local_15
+
lda -2 + __sysmenu_update_locals + 1,s
and.w #32896
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_16
+
jsr.l tccs_{WLA_FILENAME}_sm_close
__local_16:
jmp.w __local_17
__local_15:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_18
+
bra __local_19
__local_18:
lda.w #4
sta.b tcc__r0
bra __local_20
__local_19:
lda.w #3
sta.b tcc__r0
__local_20:
sep #$20
lda.b tcc__r0
sta -3 + __sysmenu_update_locals + 1,s
rep #$20
lda -2 + __sysmenu_update_locals + 1,s
and.w #2048
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_21
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #0
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
__local_21:
brl __local_22
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_sm_sel + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
pha
rep #$20
jsr.l textbox_choice_cursor
tsa
clc
adc #1
tas
jmp.w __local_23
__local_22:
lda -2 + __sysmenu_update_locals + 1,s
and.w #1024
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_24
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
rep #$20
inc a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __sysmenu_update_locals + 1,s
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
__local_24:
brl __local_25
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_sm_sel + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
pha
rep #$20
jsr.l textbox_choice_cursor
tsa
clc
adc #1
tas
jmp.w __local_26
__local_25:
lda -2 + __sysmenu_update_locals + 1,s
and.w #32768
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_27
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_28
+
jsr.l tccs_{WLA_FILENAME}_sm_close
bra __local_29
__local_28:
lda.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_sel + 0
lda #0
pha
lda #3
pha
rep #$20
pea.w :tccs_{WLA_FILENAME}_sm_main
pea.w tccs_{WLA_FILENAME}_sm_main + 0
jsr.l textbox_choices_raw
tsa
clc
adc #6
tas
__local_29:
jmp.w __local_30
__local_27:
lda -2 + __sysmenu_update_locals + 1,s
and.w #128
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_31
+
bra __local_32
__local_31:
jmp.w __local_33
__local_32:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_34
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
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
brl __local_35
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
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
__local_35:
brl __local_36
+
jmp.w __local_37
__local_36:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_38
+
bra __local_39
__local_38:
lda.w #3
sta.b tcc__r0
bra __local_40
__local_39:
lda.w #2
sta.b tcc__r0
__local_40:
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_sel + 0
rep #$20
jsr.l tccs_{WLA_FILENAME}_sm_build_slots
pea.w (0 * 256 + 4)
sep #$20
rep #$20
pea.w :tccs_{WLA_FILENAME}_sm_slot_ptrs
pea.w tccs_{WLA_FILENAME}_sm_slot_ptrs + 0
jsr.l textbox_choices_raw
tsa
clc
adc #6
tas
bra __local_41
__local_37:
jsr.l tccs_{WLA_FILENAME}_sm_close
__local_41:
jmp.w __local_42
__local_34:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_43
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
pha
rep #$20
jsr.l save_write
tsa
clc
adc #1
tas
lda.w #4
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
pha
rep #$20
jsr.l save_exists
tsa
clc
adc #1
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_44
+
pea.w :tccs_{WLA_FILENAME}_L.{WLA_FILENAME}15
pea.w tccs_{WLA_FILENAME}_L.{WLA_FILENAME}15 + 0
jsr.l textbox_open_raw
tsa
clc
adc #4
tas
bra __local_45
__local_44:
pea.w :tccs_{WLA_FILENAME}_L.{WLA_FILENAME}16
pea.w tccs_{WLA_FILENAME}_L.{WLA_FILENAME}16 + 0
jsr.l textbox_open_raw
tsa
clc
adc #4
tas
__local_45:
jmp.w __local_46
__local_43:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_sm_sel + 0
pha
rep #$20
jsr.l save_read
tsa
clc
adc #1
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_47
+
lda.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_load_pending + 0
rep #$20
jsr.l tccs_{WLA_FILENAME}_sm_close
bra __local_48
__local_47:
lda.w #4
sep #$20
sta.w tccs_{WLA_FILENAME}_sm_state + 0
rep #$20
pea.w :tccs_{WLA_FILENAME}_L.{WLA_FILENAME}17
pea.w tccs_{WLA_FILENAME}_L.{WLA_FILENAME}17 + 0
jsr.l textbox_open_raw
tsa
clc
adc #4
tas
__local_48:
__local_17:
__local_23:
__local_26:
__local_30:
__local_33:
__local_42:
__local_46:
.ifgr __sysmenu_update_locals 0
tsa
clc
adc #__sysmenu_update_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs__FUNC_tccs_{WLA_FILENAME}_sm_build_slots_base dsb 10
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $53,$6c,$6f,$74,$20,$20,$20,$3a,$20,$0
.ENDS
.SECTION ".rodata" SUPERFREE
tccs_{WLA_FILENAME}_sm_main: .dw tccs_{WLA_FILENAME}_L.{WLA_FILENAME}12 + 0, :tccs_{WLA_FILENAME}_L.{WLA_FILENAME}12
.dw tccs_{WLA_FILENAME}_L.{WLA_FILENAME}13 + 0
.dw :tccs_{WLA_FILENAME}_L.{WLA_FILENAME}13
.dw tccs_{WLA_FILENAME}_L.{WLA_FILENAME}14 + 0
.dw :tccs_{WLA_FILENAME}_L.{WLA_FILENAME}14
tccs_{WLA_FILENAME}_L.{WLA_FILENAME}12: .db $53,$61,$75,$76,$65,$67,$61,$72,$64,$65,$72,$0
tccs_{WLA_FILENAME}_L.{WLA_FILENAME}13: .db $43,$68,$61,$72,$67,$65,$72,$0
tccs_{WLA_FILENAME}_L.{WLA_FILENAME}14: .db $46,$65,$72,$6d,$65,$72,$0
tccs_{WLA_FILENAME}_L.{WLA_FILENAME}15: .db $50,$61,$72,$74,$69,$65,$20,$73,$61,$75,$76,$65,$67,$61,$72,$64,$65,$65,$20,$21,$0
tccs_{WLA_FILENAME}_L.{WLA_FILENAME}16: .db $45,$72,$72,$65,$75,$72,$20,$3a,$20,$53,$52,$41,$4d,$20,$69,$6e,$64,$69,$73,$70,$6f,$6e,$69,$62,$6c,$65,$20,$3f,$0
tccs_{WLA_FILENAME}_L.{WLA_FILENAME}17: .db $43,$65,$20,$73,$6c,$6f,$74,$20,$65,$73,$74,$20,$76,$69,$64,$65,$2e,$0
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
tccs_{WLA_FILENAME}_sm_state dsb 1
tccs_{WLA_FILENAME}_sm_sel dsb 1
tccs_{WLA_FILENAME}_sm_load_pending dsb 1
tccs_{WLA_FILENAME}_sm_slots dsb 64
tccs_{WLA_FILENAME}_sm_slot_ptrs dsb 16
.ENDS
.SECTION ".rel.rodata" SUPERFREE

.db $0,$0,$0,$0,$1,$6,$0,$0,$4,$0,$0,$0,$1,$7,$0,$0,$8,$0,$0,$0,$1,$8,$0,$0
.ENDS

