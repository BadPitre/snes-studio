.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_vm_halt_locals 0
.define __vm_init_locals 2
.define __vm_switch_get_locals 0
.define __vm_switch_set_locals 1
.define __vm_scene_reset_locals 1
.define __vm_start_locals 0
.define __tccs_{WLA_FILENAME}_common_lookup_locals 8
.define __vm_common_auto_locals 0
.define __tccs_{WLA_FILENAME}_keyin_scan_locals 0
.define __tccs_{WLA_FILENAME}_pvm_swap_locals 6
.define __vm_parallel_reset_locals 1
.define __vm_active_locals 0
.define __tccs_{WLA_FILENAME}_fetch8_locals 4
.define __tccs_{WLA_FILENAME}_fetch16_locals 2
.define __tccs_{WLA_FILENAME}_var_get_locals 0
.define __tccs_{WLA_FILENAME}_var_set_locals 0
.define __tccs_{WLA_FILENAME}_vm_rand_locals 0
.define __tccs_{WLA_FILENAME}_varop_src_locals 0
.define __tccs_{WLA_FILENAME}_vm_step_locals 108
.define __vm_update_locals 8
.define __vm_parallel_update_locals 3
.SECTION ".tccs_{WLA_FILENAME}_vm_halttext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_vm_halt:
.ifgr __tccs_{WLA_FILENAME}_vm_halt_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_vm_halt_locals
tas
.endif
__local_0:
bra __local_0
.ifgr __tccs_{WLA_FILENAME}_vm_halt_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_vm_halt_locals
tas
.endif
rtl
.ENDS
.SECTION ".vm_inittext_0x1" SUPERFREE
vm_init:
.ifgr __vm_init_locals 0
tsa
sec
sbc #__vm_init_locals
tas
.endif
lda.w #48879
sta.w tccs_{WLA_FILENAME}_vm_seed + 0
lda.w #0
sep #$20
sta.w vm + 0
rep #$20
lda.w #0
sep #$20
sta.w vm + 1
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta.w vm + 2
lda.w #0
sep #$20
sta.w vm + 708
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta.w vm + 728
lda.w #0
sep #$20
sta.w vm + 730
rep #$20
lda.w #255
sep #$20
sta.w vm + 709
rep #$20
lda.w #0
sep #$20
sta.w vm + 726
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __vm_init_locals + 1,s
__local_3:
lda -2 + __vm_init_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #8
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_1
+
bra __local_2
__local_4:
lda -2 + __vm_init_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __vm_init_locals + 1,s
bra __local_3
__local_2:
lda -2 + __vm_init_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 710
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
bra __local_4
__local_1:
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __vm_init_locals + 1,s
__local_7:
lda -2 + __vm_init_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #64
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_5
+
bra __local_6
__local_8:
lda -2 + __vm_init_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __vm_init_locals + 1,s
bra __local_7
__local_6:
lda.w #:vm
sta.b tcc__r0h
lda.w #vm + 4
sta.b tcc__r0
lda -2 + __vm_init_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #:vm
sta.b tcc__r0h
lda.w #vm + 68
sta.b tcc__r0
lda -2 + __vm_init_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #:vm
sta.b tcc__r0h
lda.w #vm + 132
sta.b tcc__r0
lda -2 + __vm_init_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
jmp.w __local_8
__local_5:
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __vm_init_locals + 1,s
__local_11:
lda -2 + __vm_init_locals + 1,s
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
lda -2 + __vm_init_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __vm_init_locals + 1,s
bra __local_11
__local_10:
lda -2 + __vm_init_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
bra __local_12
__local_9:
jsr.l vm_parallel_reset
.ifgr __vm_init_locals 0
tsa
clc
adc #__vm_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".vm_switch_gettext_0x2" SUPERFREE
vm_switch_get:
.ifgr __vm_switch_get_locals 0
tsa
sec
sbc #__vm_switch_get_locals
tas
.endif
lda 3 + __vm_switch_get_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #512
tay
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_13
+
lda.w #0
sta.b tcc__r0
jmp.w __local_14
__local_13:
lda 3 + __vm_switch_get_locals + 1,s
lsr a
lsr a
lsr a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 132
clc
adc.b tcc__r0
sta.b tcc__r1
lda 3 + __vm_switch_get_locals + 1,s
and.w #7
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r2
ldy.b tcc__r0
beq +
-
cmp #$8000
ror a
dey
bne -
+
and.w #1
and.w #255
sta.b tcc__r2
sta.b tcc__r0
lda.b tcc__r2h
sta.b tcc__r0h
__local_14:
__local_15:
.ifgr __vm_switch_get_locals 0
tsa
clc
adc #__vm_switch_get_locals
tas
.endif
rtl
.ENDS
.SECTION ".vm_switch_settext_0x3" SUPERFREE
vm_switch_set:
.ifgr __vm_switch_set_locals 0
tsa
sec
sbc #__vm_switch_set_locals
tas
.endif
lda 3 + __vm_switch_set_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #512
tay
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_16
+
jmp.w __local_17
__local_16:
lda 3 + __vm_switch_set_locals + 1,s
and.w #7
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
sep #$20
sta -1 + __vm_switch_set_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda 5 + __vm_switch_set_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_18
+
lda 3 + __vm_switch_set_locals + 1,s
lsr a
lsr a
lsr a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 132
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
lda -1 + __vm_switch_set_locals + 1,s
rep #$20
sta.b tcc__r2
ora.b tcc__r0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
bra __local_19
__local_18:
lda 3 + __vm_switch_set_locals + 1,s
lsr a
lsr a
lsr a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 132
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __vm_switch_set_locals + 1,s
rep #$20
eor.w #65535
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
and.b tcc__r0
sta.b tcc__r2
sep #$20
sta.b [tcc__r1]
rep #$20
__local_19:
__local_17:
.ifgr __vm_switch_set_locals 0
tsa
clc
adc #__vm_switch_set_locals
tas
.endif
rtl
.ENDS
.SECTION ".vm_scene_resettext_0x4" SUPERFREE
vm_scene_reset:
.ifgr __vm_scene_reset_locals 0
tsa
sec
sbc #__vm_scene_reset_locals
tas
.endif
lda.w #0
sep #$20
sta.w vm + 0
rep #$20
lda.w #0
sep #$20
sta.w vm + 1
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __vm_scene_reset_locals + 1,s
rep #$20
__local_22:
lda.w #0
sep #$20
lda -1 + __vm_scene_reset_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #64
bvc +
eor #$8000
+
bmi +
brl __local_20
+
bra __local_21
__local_23:
lda.w #0
sep #$20
lda -1 + __vm_scene_reset_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __vm_scene_reset_locals + 1,s
rep #$20
bra __local_22
__local_21:
lda.w #0
sep #$20
lda -1 + __vm_scene_reset_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 4
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
bra __local_23
__local_20:
jsr.l vm_parallel_reset
.ifgr __vm_scene_reset_locals 0
tsa
clc
adc #__vm_scene_reset_locals
tas
.endif
rtl
.ENDS
.SECTION ".vm_starttext_0x5" SUPERFREE
vm_start:
.ifgr __vm_start_locals 0
tsa
sec
sbc #__vm_start_locals
tas
.endif
lda.w #1
sep #$20
sta.w vm + 0
rep #$20
lda.w #0
sep #$20
sta.w vm + 1
rep #$20
lda 3 + __vm_start_locals + 1,s
sta.w vm + 2
lda.w #255
sep #$20
sta.w vm + 709
rep #$20
lda.w #0
sep #$20
sta.w vm + 726
rep #$20
lda.l player + 2
sta.b tcc__r0
ldy.w #5
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.l player + 0
eor.b tcc__r0
eor.w #1
sta.b tcc__r1
lda.w tccs_{WLA_FILENAME}_vm_seed + 0
eor.b tcc__r1
sta.b tcc__r0
sta.w tccs_{WLA_FILENAME}_vm_seed + 0
.ifgr __vm_start_locals 0
tsa
clc
adc #__vm_start_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_common_lookuptext_0x6" SUPERFREE
tccs_{WLA_FILENAME}_common_lookup:
.ifgr __tccs_{WLA_FILENAME}_common_lookup_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_common_lookup_locals
tas
.endif
lda.l scene_ctx + 20
sta.b tcc__r0
lda.l scene_ctx + 20 + 2
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
rep #$20
lda.w #1
sta -4 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
rep #$20
__local_26:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_24
+
bra __local_25
__local_32:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
rep #$20
jmp.w __local_26
__local_25:
lda.l scene_ctx + 20
sta.b tcc__r0
lda.l scene_ctx + 20 + 2
sta.b tcc__r0h
lda -4 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
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
brl __local_27
+
lda -4 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
inc a
sta.b tcc__r0
lda.l scene_ctx + 20
sta.b tcc__r1
lda.l scene_ctx + 20 + 2
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
lda -4 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
inc a
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
rep #$20
xba
and #$ff00
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
ora.b tcc__r0
sta.b tcc__r2
sta -6 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc #65535
tay
beq +
dex
+
stx.b tcc__r5
txa
beq +
brl __local_28
+
lda -6 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
pha
jsr.l vm_switch_get
pla
lda.b tcc__r0 ; DON'T OPTIMIZE
beq +
__local_28:
brl __local_29
+
jmp.w __local_30
__local_29:
lda -4 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
clc
adc.w #3
sta.b tcc__r0
lda.l scene_ctx + 20
sta.b tcc__r1
lda.l scene_ctx + 20 + 2
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda -4 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
clc
adc.w #4
sta.b tcc__r1
lda.l scene_ctx + 20
sta.b tcc__r2
lda.l scene_ctx + 20 + 2
sta.b tcc__r2h
clc
lda.b tcc__r2
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
xba
and #$ff00
sta.b tcc__r1
ora.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
sta.b tcc__r0
bra __local_31
__local_30:
__local_27:
lda -4 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
clc
adc.w #5
sta.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_common_lookup_locals + 1,s
jmp.w __local_32
__local_24:
lda.w #65535
sta.b tcc__r0
__local_31:
__local_33:
.ifgr __tccs_{WLA_FILENAME}_common_lookup_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_common_lookup_locals
tas
.endif
rtl
.ENDS
.SECTION ".vm_common_autotext_0x7" SUPERFREE
vm_common_auto:
.ifgr __vm_common_auto_locals 0
tsa
sec
sbc #__vm_common_auto_locals
tas
.endif
sep #$20
lda #0
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_common_lookup
tsa
clc
adc #1
tas
__local_34:
.ifgr __vm_common_auto_locals 0
tsa
clc
adc #__vm_common_auto_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_keyin_scantext_0x8" SUPERFREE
tccs_{WLA_FILENAME}_keyin_scan:
.ifgr __tccs_{WLA_FILENAME}_keyin_scan_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_keyin_scan_locals
tas
.endif
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_35
+
bra __local_36
__local_35:
lda.w #0
sta.b tcc__r0
jmp.w __local_37
__local_36:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #2
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_38
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #1024
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_38:
brl __local_39
+
lda.w #1
sta.b tcc__r0
jmp.w __local_40
__local_39:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #4
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_41
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #512
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_41:
brl __local_42
+
lda.w #2
sta.b tcc__r0
jmp.w __local_43
__local_42:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #8
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_44
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #256
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_44:
brl __local_45
+
lda.w #3
sta.b tcc__r0
jmp.w __local_46
__local_45:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #16
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_47
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #2048
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_47:
brl __local_48
+
lda.w #4
sta.b tcc__r0
jmp.w __local_49
__local_48:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #32
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_50
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #128
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_50:
brl __local_51
+
lda.w #5
sta.b tcc__r0
jmp.w __local_52
__local_51:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #64
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_53
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #32768
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_53:
brl __local_54
+
lda.w #6
sta.b tcc__r0
jmp.w __local_55
__local_54:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #128
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_56
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #16384
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_56:
brl __local_57
+
lda.w #7
sta.b tcc__r0
jmp.w __local_58
__local_57:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #256
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_59
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #64
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_59:
brl __local_60
+
lda.w #8
sta.b tcc__r0
jmp.w __local_61
__local_60:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #512
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_62
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #32
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_62:
brl __local_63
+
lda.w #9
sta.b tcc__r0
jmp.w __local_64
__local_63:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #1024
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_65
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #16
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_65:
brl __local_66
+
lda.w #10
sta.b tcc__r0
jmp.w __local_67
__local_66:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #2048
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_68
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #8192
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_68:
brl __local_69
+
lda.w #11
sta.b tcc__r0
jmp.w __local_70
__local_69:
lda 3 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #4096
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_71
+
lda 5 + __tccs_{WLA_FILENAME}_keyin_scan_locals + 1,s
and.w #4096
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_71:
brl __local_72
+
lda.w #12
sta.b tcc__r0
bra __local_73
__local_72:
lda.w #0
sta.b tcc__r0
__local_37:
__local_40:
__local_43:
__local_46:
__local_49:
__local_52:
__local_55:
__local_58:
__local_61:
__local_64:
__local_67:
__local_70:
__local_73:
__local_74:
.ifgr __tccs_{WLA_FILENAME}_keyin_scan_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_keyin_scan_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_pvm_swaptext_0x9" SUPERFREE
tccs_{WLA_FILENAME}_pvm_swap:
.ifgr __tccs_{WLA_FILENAME}_pvm_swap_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_pvm_swap_locals
tas
.endif
lda.w #0
sep #$20
lda.w vm + 0
sta -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_active + 0
sta.w vm + 0
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
sta.w tccs_{WLA_FILENAME}_p_active + 0
rep #$20
lda.w vm + 2
sta -6 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
lda.w tccs_{WLA_FILENAME}_p_pc + 0
sta.w vm + 2
lda -6 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
sta.w tccs_{WLA_FILENAME}_p_pc + 0
lda.w #0
sep #$20
lda.w vm + 1
sta -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_mode + 0
sta.w vm + 1
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
sta.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
lda.w #0
sep #$20
lda.w vm + 708
sta -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_timer + 0
sta.w vm + 708
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
sta.w tccs_{WLA_FILENAME}_p_wait_timer + 0
rep #$20
lda.w #0
sep #$20
lda.w vm + 709
sta -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_script_actor + 0
sta.w vm + 709
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
sta.w tccs_{WLA_FILENAME}_p_script_actor + 0
rep #$20
lda.w #0
sep #$20
lda.w vm + 726
sta -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_call_sp + 0
sta.w vm + 726
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
sta.w tccs_{WLA_FILENAME}_p_call_sp + 0
rep #$20
lda.w vm + 728
sta -6 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
lda.w tccs_{WLA_FILENAME}_p_keyin_mask + 0
sta.w vm + 728
lda -6 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
sta.w tccs_{WLA_FILENAME}_p_keyin_mask + 0
lda.w #0
sep #$20
lda.w vm + 730
sta -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_keyin_dst + 0
sta.w vm + 730
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
sta.w tccs_{WLA_FILENAME}_p_keyin_dst + 0
rep #$20
lda.w #0
sep #$20
lda.w vm + 726
sta -2 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_call_sp + 0
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
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
brl __local_75
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_call_sp + 0
rep #$20
sta.b tcc__r0
sep #$20
sta -2 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
__local_75:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
__local_78:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_76
+
bra __local_77
__local_79:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
jmp.w __local_78
__local_77:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 710
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -6 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 710
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_p_call_stack
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_p_call_stack + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.b [tcc__r2]
sta.b [tcc__r1]
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_p_call_stack
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_p_call_stack + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -6 + __tccs_{WLA_FILENAME}_pvm_swap_locals + 1,s
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_79
__local_76:
.ifgr __tccs_{WLA_FILENAME}_pvm_swap_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_pvm_swap_locals
tas
.endif
rtl
.ENDS
.SECTION ".vm_parallel_resettext_0xa" SUPERFREE
vm_parallel_reset:
.ifgr __vm_parallel_reset_locals 0
tsa
sec
sbc #__vm_parallel_reset_locals
tas
.endif
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_active + 0
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_p_pc + 0
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_p_keyin_mask + 0
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_keyin_dst + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_wait_timer + 0
rep #$20
lda.w #255
sep #$20
sta.w tccs_{WLA_FILENAME}_p_script_actor + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_call_sp + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __vm_parallel_reset_locals + 1,s
rep #$20
__local_82:
lda.w #0
sep #$20
lda -1 + __vm_parallel_reset_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #8
bvc +
eor #$8000
+
bmi +
brl __local_80
+
bra __local_81
__local_83:
lda.w #0
sep #$20
lda -1 + __vm_parallel_reset_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __vm_parallel_reset_locals + 1,s
rep #$20
bra __local_82
__local_81:
lda.w #0
sep #$20
lda -1 + __vm_parallel_reset_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_p_call_stack
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_p_call_stack + 0
clc
adc.b tcc__r0
sta.b tcc__r1
stz.b tcc__r0
lda.b tcc__r0
sta.b [tcc__r1]
bra __local_83
__local_80:
.ifgr __vm_parallel_reset_locals 0
tsa
clc
adc #__vm_parallel_reset_locals
tas
.endif
rtl
.ENDS
.SECTION ".vm_activetext_0xb" SUPERFREE
vm_active:
.ifgr __vm_active_locals 0
tsa
sec
sbc #__vm_active_locals
tas
.endif
lda.w #0
sep #$20
lda.w vm + 0
rep #$20
sta.b tcc__r0
__local_84:
.ifgr __vm_active_locals 0
tsa
clc
adc #__vm_active_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_fetch8text_0xc" SUPERFREE
tccs_{WLA_FILENAME}_fetch8:
.ifgr __tccs_{WLA_FILENAME}_fetch8_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_fetch8_locals
tas
.endif
lda.w vm + 2
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta.w vm + 2
lda.l scene_ctx + 20
sta.b tcc__r0
lda.l scene_ctx + 20 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_fetch8_locals + 1,s
lda.b tcc__r0h
sta -2 + __tccs_{WLA_FILENAME}_fetch8_locals + 1,s
lda -4 + __tccs_{WLA_FILENAME}_fetch8_locals + 1,s
sta.b tcc__r10
lda -2 + __tccs_{WLA_FILENAME}_fetch8_locals + 1,s
sta.b tcc__r10h
lda.w #0
sep #$20
lda.b [tcc__r10]
rep #$20
sta.b tcc__r0
__local_85:
.ifgr __tccs_{WLA_FILENAME}_fetch8_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_fetch8_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_fetch16text_0xd" SUPERFREE
tccs_{WLA_FILENAME}_fetch16:
.ifgr __tccs_{WLA_FILENAME}_fetch16_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_fetch16_locals
tas
.endif
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_fetch16_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
xba
and #$ff00
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_fetch16_locals + 1,s
ora.b tcc__r0
sta.b tcc__r1
sta -2 + __tccs_{WLA_FILENAME}_fetch16_locals + 1,s
sta.b tcc__r0
__local_86:
.ifgr __tccs_{WLA_FILENAME}_fetch16_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_fetch16_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_var_gettext_0xe" SUPERFREE
tccs_{WLA_FILENAME}_var_get:
.ifgr __tccs_{WLA_FILENAME}_var_get_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_var_get_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_var_get_locals + 1,s
rep #$20
and.w #128
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_87
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_var_get_locals + 1,s
rep #$20
and.w #63
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 68
clc
adc.b tcc__r0
sta.b tcc__r1
bra __local_88
__local_87:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_var_get_locals + 1,s
rep #$20
and.w #63
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 4
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
bra __local_89
__local_88:
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
__local_89:
lda.b tcc__r0
and.w #255
sta.b tcc__r0
__local_90:
.ifgr __tccs_{WLA_FILENAME}_var_get_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_var_get_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_var_settext_0xf" SUPERFREE
tccs_{WLA_FILENAME}_var_set:
.ifgr __tccs_{WLA_FILENAME}_var_set_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_var_set_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_var_set_locals + 1,s
rep #$20
and.w #128
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_91
+
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_var_set_locals + 1,s
rep #$20
and.w #63
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 68
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_var_set_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
bra __local_92
__local_91:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_var_set_locals + 1,s
rep #$20
and.w #63
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 4
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __tccs_{WLA_FILENAME}_var_set_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_92:
.ifgr __tccs_{WLA_FILENAME}_var_set_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_var_set_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_vm_randtext_0x10" SUPERFREE
tccs_{WLA_FILENAME}_vm_rand:
.ifgr __tccs_{WLA_FILENAME}_vm_rand_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_vm_rand_locals
tas
.endif
lda.w tccs_{WLA_FILENAME}_vm_seed + 0
sta.b tcc__r0
ldy.w #7
-
asl a
dey
bne -
+
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_vm_seed + 0
eor.b tcc__r0
sta.b tcc__r1
sta.w tccs_{WLA_FILENAME}_vm_seed + 0
lda.w tccs_{WLA_FILENAME}_vm_seed + 0
sta.b tcc__r0
ldy.w #9
-
lsr a
dey
bne -
+
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_vm_seed + 0
eor.b tcc__r0
sta.w tccs_{WLA_FILENAME}_vm_seed + 0
lda.w tccs_{WLA_FILENAME}_vm_seed + 0
xba
and #$ff00
sta.b tcc__r0
lda.w tccs_{WLA_FILENAME}_vm_seed + 0
eor.b tcc__r0
sta.b tcc__r1
sta.w tccs_{WLA_FILENAME}_vm_seed + 0
lda.w tccs_{WLA_FILENAME}_vm_seed + 0
sta.b tcc__r0
__local_93:
.ifgr __tccs_{WLA_FILENAME}_vm_rand_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_vm_rand_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_varop_srctext_0x11" SUPERFREE
tccs_{WLA_FILENAME}_varop_src:
.ifgr __tccs_{WLA_FILENAME}_varop_src_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_varop_src_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_varop_src_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_94
bra __local_95
__local_94:
lda.b tcc__r0
cmp #1
beq +
brl __local_96
+
__local_95:
lda 4 + __tccs_{WLA_FILENAME}_varop_src_locals + 1,s
and.w #255
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
jmp.w __local_97
bra __local_98
__local_96:
lda.b tcc__r0
cmp #2
beq +
brl __local_99
+
__local_98:
lda.l player + 0
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
sta.b tcc__r0
jmp.w __local_100
bra __local_101
__local_99:
lda.b tcc__r0
cmp #3
beq +
brl __local_102
+
__local_101:
lda.l player + 2
clc
adc.w #8
lsr a
lsr a
lsr a
lsr a
sta.b tcc__r0
bra __local_103
bra __local_104
__local_102:
lda.b tcc__r0
cmp #4
beq +
brl __local_105
+
__local_104:
jsr.l timer_secs
bra __local_106
bra __local_107
__local_105:
lda.b tcc__r0
cmp #5
beq +
brl __local_108
+
__local_107:
lda.w #0
sep #$20
lda.l scene_ctx + 32
rep #$20
sta.b tcc__r0
bra __local_109
__local_108:
lda 4 + __tccs_{WLA_FILENAME}_varop_src_locals + 1,s
sta.b tcc__r0
__local_97:
__local_100:
__local_103:
__local_106:
__local_109:
__local_110:
.ifgr __tccs_{WLA_FILENAME}_varop_src_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_varop_src_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_vm_steptext_0x12" SUPERFREE
tccs_{WLA_FILENAME}_vm_step:
.ifgr __tccs_{WLA_FILENAME}_vm_step_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_vm_step_locals
tas
.endif
lda.w #32
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
__local_375:
lda.w #0
sep #$20
lda.w vm + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_111
+
lda.w #0
sep #$20
lda.w vm + 1
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
__local_111:
brl __local_112
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_113
+
jmp.w __local_114
__local_113:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_115
bra __local_116
__local_115:
lda.b tcc__r0
cmp #0
beq +
brl __local_117
+
__local_116:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 0
rep #$20
jmp.w __local_118
bra __local_119
__local_117:
lda.b tcc__r0
cmp #1
beq +
brl __local_120
+
__local_119:
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
jsr.l textbox_open
pla
lda.w #2
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_121
bra __local_122
__local_120:
lda.b tcc__r0
cmp #2
beq +
brl __local_123
+
__local_122:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_var_set
pla
jmp.w __local_124
bra __local_125
__local_123:
lda.b tcc__r0
cmp #3
beq +
brl __local_126
+
__local_125:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_var_get
tsa
clc
adc #1
tas
lda.b tcc__r0
sta -16 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -14 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.w #0
sep #$20
lda -16 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
clc
adc.b tcc__r0
and.w #255
sep #$20
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_var_set
pla
jmp.w __local_127
bra __local_128
__local_126:
lda.b tcc__r0
cmp #4
beq +
brl __local_129
+
__local_128:
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta.w vm + 2
jmp.w __local_130
bra __local_131
__local_129:
lda.b tcc__r0
cmp #5
beq +
brl __local_132
+
__local_131:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_var_get
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
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
brl __local_133
+
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
sta.w vm + 2
__local_133:
jmp.w __local_134
bra __local_135
__local_132:
lda.b tcc__r0
cmp #6
beq +
brl __local_136
+
__local_135:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_var_get
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
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
brl __local_137
+
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
sta.w vm + 2
__local_137:
jmp.w __local_138
bra __local_139
__local_136:
lda.b tcc__r0
cmp #7
beq +
brl __local_140
+
__local_139:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
and.w #63
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 68
clc
adc.b tcc__r0
sta.b tcc__r1
sta -20 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1h
sta -18 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
lda -20 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
lda -18 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1h
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
jmp.w __local_141
bra __local_142
__local_140:
lda.b tcc__r0
cmp #8
beq +
brl __local_143
+
__local_142:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_var_get
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
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
brl __local_144
+
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
sta.w vm + 2
__local_144:
jmp.w __local_145
bra __local_146
__local_143:
lda.b tcc__r0
cmp #9
beq +
brl __local_147
+
__local_146:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta.w vm + 731
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta.w vm + 732
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
__local_150:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w vm + 732
rep #$20
sta.b tcc__r1
lda.b tcc__r0
sec
sbc.b tcc__r1
bvc +
eor #$8000
+
bmi +
brl __local_148
+
bra __local_149
__local_151:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jmp.w __local_150
__local_149:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
and.w #3
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_choice_ids
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_choice_ids + 0
clc
adc.b tcc__r0
sta.b tcc__r1
sta -24 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1h
sta -22 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch16
lda -24 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
lda -22 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_151
__local_148:
lda.w #0
sep #$20
sta.w vm + 733
lda #0
pha
rep #$20
lda.w #0
sep #$20
lda.w vm + 732
pha
rep #$20
pea.w :tccs_{WLA_FILENAME}_choice_ids
pea.w tccs_{WLA_FILENAME}_choice_ids + 0
jsr.l textbox_open_choices
tsa
clc
adc #6
tas
lda.w #3
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_152
bra __local_153
__local_147:
lda.b tcc__r0
cmp #10
beq +
brl __local_154
+
__local_153:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
sta -28 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -26 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -27 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l player_request_warp
tsa
clc
adc #4
tas
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 0
rep #$20
jmp.w __local_155
bra __local_156
__local_154:
lda.b tcc__r0
cmp #11
beq +
brl __local_157
+
__local_156:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l actor_face
pla
jmp.w __local_158
bra __local_159
__local_157:
lda.b tcc__r0
cmp #12
beq +
brl __local_160
+
__local_159:
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda -7 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
jsr.l vm_switch_set
tsa
clc
adc #3
tas
jmp.w __local_161
bra __local_162
__local_160:
lda.b tcc__r0
cmp #13
beq +
brl __local_163
+
__local_162:
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
jsr.l vm_switch_get
pla
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
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
brl __local_164
+
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
sta.w vm + 2
__local_164:
jmp.w __local_165
bra __local_166
__local_163:
lda.b tcc__r0
cmp #14
beq +
brl __local_167
+
__local_166:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
sta -32 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1h
sta -30 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch16
lda -32 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
lda -30 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_168
bra __local_169
__local_167:
lda.b tcc__r0
cmp #15
beq +
brl __local_170
+
__local_169:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
sta -36 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1h
sta -34 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch16
lda -36 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r10
lda -34 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r10h
lda.b [tcc__r10]
clc
adc.b tcc__r0
sta.b tcc__r1
lda -36 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
lda -34 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0h
lda.b tcc__r1
sta.b [tcc__r0]
jmp.w __local_171
bra __local_172
__local_170:
lda.b tcc__r0
cmp #17
beq +
brl __local_173
+
__local_172:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
jsr.l actors_route_freq
tsa
clc
adc #1
tas
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_174
+
lda.w #0
sep #$20
lda.w vm + 709
rep #$20
sta.b tcc__r0
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
__local_174:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l actors_route_bind_freq
tsa
clc
adc #1
tas
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sep #$20
pha
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w vm + 2
pha
lda.w #0
sep #$20
lda 1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l actors_set_route
tsa
clc
adc #5
tas
lda.w vm + 2
sta.b tcc__r0
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
sta.w vm + 2
jmp.w __local_175
bra __local_176
__local_173:
lda.b tcc__r0
cmp #18
beq +
brl __local_177
+
__local_176:
lda.w #4
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_178
bra __local_179
__local_177:
lda.b tcc__r0
cmp #19
beq +
brl __local_180
+
__local_179:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta.w vm + 708
rep #$20
lda.w #5
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_181
bra __local_182
__local_180:
lda.b tcc__r0
cmp #20
beq +
brl __local_183
+
__local_182:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
sta -40 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -38 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch16
pei (tcc__r0)
lda.w #0
sep #$20
lda -38 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_varop_src
tsa
clc
adc #3
tas
lda.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_184
bra __local_185
__local_184:
lda.b tcc__r0
cmp #0
beq +
brl __local_186
+
__local_185:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_187
bra __local_188
__local_186:
lda.b tcc__r0
cmp #1
beq +
brl __local_189
+
__local_188:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r2
clc
adc.b tcc__r0
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_190
bra __local_191
__local_189:
lda.b tcc__r0
cmp #2
beq +
brl __local_192
+
__local_191:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r2
sec
lda.b tcc__r0
sbc.b tcc__r2
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_193
bra __local_194
__local_192:
lda.b tcc__r0
cmp #3
beq +
brl __local_195
+
__local_194:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r2
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_196
bra __local_197
__local_195:
lda.b tcc__r0
cmp #4
beq +
brl __local_198
+
__local_197:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
lda.b tcc__r1
sta -44 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1h
sta -42 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_199
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
lda.b tcc__r9
sta.b tcc__r0
bra __local_200
__local_199:
lda.w #0
sta.b tcc__r0
__local_200:
__local_201:
lda -44 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
lda -42 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_202
bra __local_203
__local_198:
lda.b tcc__r0
cmp #5
beq +
brl __local_204
+
__local_203:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
lda.b tcc__r1
sta -48 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1h
sta -46 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_205
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
ldx.b tcc__r0
jsr.l tcc__udiv
stx.b tcc__r0
bra __local_206
__local_205:
lda.w #0
sta.b tcc__r0
__local_206:
__local_207:
lda -48 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
lda -46 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_208
__local_204:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc #65535
tay
beq +
dex
+
stx.b tcc__r5
lda.b tcc__r1
sta -52 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1h
sta -50 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r5 ; DON'T OPTIMIZE
bne +
brl __local_209
+
jsr.l tccs_{WLA_FILENAME}_vm_rand
bra __local_210
__local_209:
jsr.l tccs_{WLA_FILENAME}_vm_rand
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
inc.b tcc__r1
ldx.b tcc__r0
lda.b tcc__r1
jsr.l tcc__udiv
stx.b tcc__r0
__local_210:
__local_211:
lda -52 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
lda -50 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
__local_187:
__local_190:
__local_193:
__local_196:
__local_202:
__local_208:
__local_212:
jmp.w __local_213
bra __local_214
__local_183:
lda.b tcc__r0
cmp #21
beq +
brl __local_215
+
__local_214:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_216
+
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
jsr.l timer_set
pla
jmp.w __local_217
__local_216:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_218
+
jsr.l timer_stop
bra __local_219
__local_218:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc #2
tay
beq +
dex
+
txa
and.w #255
sep #$20
pha
rep #$20
jsr.l timer_display
tsa
clc
adc #1
tas
__local_219:
__local_217:
jmp.w __local_220
bra __local_221
__local_215:
lda.b tcc__r0
cmp #22
beq +
brl __local_222
+
__local_221:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l camera_pan_to
tsa
clc
adc #3
tas
jmp.w __local_223
bra __local_224
__local_222:
lda.b tcc__r0
cmp #23
beq +
brl __local_225
+
__local_224:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
jsr.l camera_return
tsa
clc
adc #1
tas
jmp.w __local_226
bra __local_227
__local_225:
lda.b tcc__r0
cmp #24
beq +
brl __local_228
+
__local_227:
lda.w #6
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_229
bra __local_230
__local_228:
lda.b tcc__r0
cmp #25
beq +
brl __local_231
+
__local_230:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r1
lda.w #:vm
sta.b tcc__r2h
lda.w #vm + 196
clc
adc.b tcc__r1
sta.b tcc__r2
lda.b [tcc__r2]
and.w #255
sta.b tcc__r1
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
asl a
sta.b tcc__r2
lda.w #:vm
sta.b tcc__r3h
lda.w #vm + 196
clc
adc.b tcc__r2
sta.b tcc__r3
lda.b [tcc__r3]
and.w #255
sta.b tcc__r2
lda.b tcc__r0
sta -56 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -54 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1
sta -60 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1h
sta -58 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r2
sta -64 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r2h
sta -62 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -63 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -58 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -53 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l player_request_warp
tsa
clc
adc #4
tas
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 0
rep #$20
jmp.w __local_232
bra __local_233
__local_231:
lda.b tcc__r0
cmp #26
beq +
brl __local_234
+
__local_233:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_235
+
lda.w #0
sep #$20
lda.w vm + 709
rep #$20
sta.b tcc__r0
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
__local_235:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_236
+
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
__local_236:
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sep #$20
pha
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l actors_set_pos
tsa
clc
adc #3
tas
jmp.w __local_237
bra __local_238
__local_234:
lda.b tcc__r0
cmp #27
beq +
brl __local_239
+
__local_238:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_240
+
lda.w #0
sep #$20
lda.w vm + 709
rep #$20
sta.b tcc__r0
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
__local_240:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_241
+
lda.w #0
sep #$20
lda.w vm + 709
rep #$20
sta.b tcc__r0
sep #$20
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
__local_241:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l actors_swap_pos
pla
jmp.w __local_242
bra __local_243
__local_239:
lda.b tcc__r0
cmp #28
beq +
brl __local_244
+
__local_243:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l screenfx_hide
pla
lda.w #7
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_245
bra __local_246
__local_244:
lda.b tcc__r0
cmp #29
beq +
brl __local_247
+
__local_246:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l screenfx_show
pla
lda.w #7
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_248
bra __local_249
__local_247:
lda.b tcc__r0
cmp #30
beq +
brl __local_250
+
__local_249:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
sta -68 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -66 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -67 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l screenfx_tint_rgb
tsa
clc
adc #3
tas
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l screenfx_tint
tsa
clc
adc #1
tas
jmp.w __local_251
bra __local_252
__local_250:
lda.b tcc__r0
cmp #45
beq +
brl __local_253
+
__local_252:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l hdmafx_wave
pla
jmp.w __local_254
bra __local_255
__local_253:
lda.b tcc__r0
cmp #46
beq +
brl __local_256
+
__local_255:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
sta -72 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -70 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -71 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l hdmafx_grad_top
tsa
clc
adc #3
tas
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
sta -76 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -74 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -75 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l hdmafx_grad_bottom
tsa
clc
adc #3
tas
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l hdmafx_grad
tsa
clc
adc #1
tas
jmp.w __local_257
bra __local_258
__local_256:
lda.b tcc__r0
cmp #47
beq +
brl __local_259
+
__local_258:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l hdmafx_spot
pla
jmp.w __local_260
bra __local_261
__local_259:
lda.b tcc__r0
cmp #50
beq +
brl __local_262
+
__local_261:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l stage_request_open
tsa
clc
adc #3
tas
lda.w #5
sep #$20
sta.w vm + 1
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w vm + 708
rep #$20
jmp.w __local_263
bra __local_264
__local_262:
lda.b tcc__r0
cmp #51
beq +
brl __local_265
+
__local_264:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
sta -80 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -78 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -79 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l stage_pose
tsa
clc
adc #4
tas
lda.w #8
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_266
bra __local_267
__local_265:
lda.b tcc__r0
cmp #52
beq +
brl __local_268
+
__local_267:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
jsr.l stage_clear
tsa
clc
adc #1
tas
lda.w #8
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_269
bra __local_270
__local_268:
lda.b tcc__r0
cmp #53
beq +
brl __local_271
+
__local_270:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l stage_request_close
pla
lda.w #5
sep #$20
sta.w vm + 1
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w vm + 708
rep #$20
jmp.w __local_272
bra __local_273
__local_271:
lda.b tcc__r0
cmp #54
beq +
brl __local_274
+
__local_273:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l stage_slotfx
tsa
clc
adc #3
tas
jmp.w __local_275
bra __local_276
__local_274:
lda.b tcc__r0
cmp #55
beq +
brl __local_277
+
__local_276:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
sta -84 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -82 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -83 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 0 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l vig_show
tsa
clc
adc #4
tas
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l vig_anchor
pla
jmp.w __local_278
bra __local_279
__local_277:
lda.b tcc__r0
cmp #56
beq +
brl __local_280
+
__local_279:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l vig_play
tsa
clc
adc #3
tas
jmp.w __local_281
bra __local_282
__local_280:
lda.b tcc__r0
cmp #57
beq +
brl __local_283
+
__local_282:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
jsr.l vig_hide
tsa
clc
adc #1
tas
jmp.w __local_284
bra __local_285
__local_283:
lda.b tcc__r0
cmp #59
beq +
brl __local_286
+
__local_285:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_287
+
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
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
bne +
__local_287:
brl __local_288
+
lda.w #0
sep #$20
lda.w vm + 709
rep #$20
sta.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
__local_288:
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sep #$20
pha
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l anim_play
tsa
clc
adc #3
tas
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
and.w #1
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_289
+
lda.w #10
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
__local_289:
jmp.w __local_290
bra __local_291
__local_286:
lda.b tcc__r0
cmp #60
beq +
brl __local_292
+
__local_291:
jsr.l anim_stop
jmp.w __local_293
bra __local_294
__local_292:
lda.b tcc__r0
cmp #58
beq +
brl __local_295
+
__local_294:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta.w vm + 731
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l overlay_list_open
tsa
clc
adc #1
tas
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_296
+
bra __local_297
__local_296:
jmp.w __local_298
__local_297:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.w vm + 732
rep #$20
lda.w #0
sep #$20
sta.w vm + 733
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.w vm + 734
rep #$20
lda.w #9
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_299
bra __local_300
__local_295:
lda.b tcc__r0
cmp #48
beq +
brl __local_301
+
__local_300:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
jsr.l audio_play_sfx
tsa
clc
adc #1
tas
jmp.w __local_302
bra __local_303
__local_301:
lda.b tcc__r0
cmp #49
beq +
brl __local_304
+
__local_303:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
jsr.l audio_play_music
tsa
clc
adc #1
tas
jmp.w __local_305
bra __local_306
__local_304:
lda.b tcc__r0
cmp #44
beq +
brl __local_307
+
__local_306:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l weather_set
pla
jmp.w __local_308
bra __local_309
__local_307:
lda.b tcc__r0
cmp #43
beq +
brl __local_310
+
__local_309:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
sta -88 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -86 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -87 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l screenfx_tintg_rgb
tsa
clc
adc #3
tas
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l screenfx_tintg
pla
jmp.w __local_311
bra __local_312
__local_310:
lda.b tcc__r0
cmp #31
beq +
brl __local_313
+
__local_312:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sep #$20
pha
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l screenfx_flash
tsa
clc
adc #3
tas
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
jsr.l screenfx_flash_start
tsa
clc
adc #1
tas
jmp.w __local_314
bra __local_315
__local_313:
lda.b tcc__r0
cmp #32
beq +
brl __local_316
+
__local_315:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l screenfx_shake
tsa
clc
adc #3
tas
jmp.w __local_317
bra __local_318
__local_316:
lda.b tcc__r0
cmp #33
beq +
brl __local_319
+
__local_318:
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda.w vm + 726
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
brl __local_320
+
jsr.l tccs_{WLA_FILENAME}_vm_halt
__local_320:
lda.w #0
sep #$20
lda.w vm + 726
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w vm + 726
rep #$20
asl.b tcc__r1
lda.w #:vm
sta.b tcc__r0h
lda.w #vm + 710
clc
adc.b tcc__r1
sta.b tcc__r0
lda.w vm + 2
sta.b tcc__r1
sta.b [tcc__r0]
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
sta.w vm + 2
jmp.w __local_321
bra __local_322
__local_319:
lda.b tcc__r0
cmp #34
beq +
brl __local_323
+
__local_322:
lda.w #0
sep #$20
lda.w vm + 726
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_324
+
lda.w #0
sep #$20
lda.w vm + 726
rep #$20
sta.b tcc__r0
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w vm + 726
rep #$20
lda.b tcc__r0
and.w #255
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 710
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
sta.w vm + 2
bra __local_325
__local_324:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 0
rep #$20
__local_325:
jmp.w __local_326
bra __local_327
__local_323:
lda.b tcc__r0
cmp #35
beq +
brl __local_328
+
__local_327:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_329
+
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
__local_329:
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
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
beq +
brl __local_330
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:db_table_counts
sta.b tcc__r1h
lda.w #db_table_counts + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
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
__local_330:
brl __local_331
+
bra __local_332
__local_331:
stz.b tcc__r0
lda.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jmp.w __local_333
__local_332:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:db_table_sizes
sta.b tcc__r1h
lda.w #db_table_sizes + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
lda.b tcc__r0
sta.b tcc__r9
lda.b tcc__r1
sta.b tcc__r10
jsr.l tcc__mul
sta.b tcc__r1
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
clc
adc.b tcc__r1
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:db_tables
sta.b tcc__r1h
lda.w #db_tables + 0
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
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
sta -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_334
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:db_tables
sta.b tcc__r1h
lda.w #db_tables + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
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
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
xba
and #$ff00
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
ora.b tcc__r0
sta.b tcc__r1
sta -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
__local_334:
__local_333:
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_335
bra __local_336
__local_328:
lda.b tcc__r0
cmp #36
beq +
brl __local_337
+
__local_336:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l overlay_show
pla
jmp.w __local_338
bra __local_339
__local_337:
lda.b tcc__r0
cmp #37
beq +
brl __local_340
+
__local_339:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
xba
and #$ff00
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
ora.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -2 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_341
+
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.w vm + 728
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.w vm + 730
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_342
__local_341:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.l pad_keys + 0
pha
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
lda.b tcc__r1
sta -88 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1h
sta -86 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_keyin_scan
tsa
clc
adc #4
tas
lda -92 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1
lda -90 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
__local_342:
jmp.w __local_343
bra __local_344
__local_340:
lda.b tcc__r0
cmp #39
beq +
brl __local_345
+
__local_344:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
jsr.l textbox_set_style
tsa
clc
adc #1
tas
jmp.w __local_346
bra __local_347
__local_345:
lda.b tcc__r0
cmp #38
beq +
brl __local_348
+
__local_347:
jsr.l sysmenu_open
jmp.w __local_349
bra __local_350
__local_348:
lda.b tcc__r0
cmp #40
beq +
brl __local_351
+
__local_350:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #1
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_352
+
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
and.w #255
sta.b tcc__r0
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
__local_352:
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #2
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_353
+
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
and.w #255
sep #$20
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
and.w #255
sta.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
__local_353:
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r1
lda.b tcc__r0
sta -96 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -94 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1
sta -100 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1h
sta -98 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -99 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -94 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda 1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
lda #1
pha
rep #$20
jsr.l picture_request
tsa
clc
adc #6
tas
lda.w #5
sep #$20
sta.w vm + 1
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w vm + 708
rep #$20
jmp.w __local_354
bra __local_355
__local_351:
lda.b tcc__r0
cmp #41
beq +
brl __local_356
+
__local_355:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
lda #0
pha
lda #0
pha
lda #0
pha
lda #0
pha
lda #0
pha
rep #$20
jsr.l picture_request
tsa
clc
adc #6
tas
lda.w #5
sep #$20
sta.w vm + 1
rep #$20
lda.w #1
sta.b tcc__r0
sep #$20
sta.w vm + 708
rep #$20
jmp.w __local_357
bra __local_358
__local_356:
lda.b tcc__r0
cmp #42
beq +
brl __local_359
+
__local_358:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #2
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_360
+
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
and.w #255
sep #$20
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
and.w #255
sta.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
__local_360:
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
and.w #255
sta.b tcc__r1
lda.b tcc__r0
sta -104 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r0h
sta -102 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1
sta -108 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.b tcc__r1h
sta -106 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
pha
rep #$20
lda.w #0
sep #$20
lda -107 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -102 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
pha
rep #$20
jsr.l picture_move
tsa
clc
adc #4
tas
jmp.w __local_361
bra __local_362
__local_359:
lda.b tcc__r0
cmp #16
beq +
brl __local_363
+
__local_362:
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch8
sep #$20
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
jsr.l tccs_{WLA_FILENAME}_fetch16
lda.b tcc__r0
sta -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.b [tcc__r1]
sta -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #0
beq +
brl __local_364
+
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
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
__local_364:
brl __local_365
+
jmp.w __local_366
__local_365:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_367
+
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
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
__local_367:
brl __local_368
+
jmp.w __local_369
__local_368:
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_370
+
lda -8 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
lda -10 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
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
__local_370:
brl __local_371
+
bra __local_372
__local_371:
bra __local_373
__local_366:
__local_369:
__local_372:
lda -6 + __tccs_{WLA_FILENAME}_vm_step_locals + 1,s
sta.b tcc__r0
sta.w vm + 2
__local_373:
jmp.w __local_374
__local_363:
jsr.l tccs_{WLA_FILENAME}_vm_halt
__local_118:
__local_121:
__local_124:
__local_127:
__local_130:
__local_134:
__local_138:
__local_141:
__local_145:
__local_152:
__local_155:
__local_158:
__local_161:
__local_165:
__local_168:
__local_171:
__local_175:
__local_178:
__local_181:
__local_213:
__local_220:
__local_223:
__local_226:
__local_229:
__local_232:
__local_237:
__local_242:
__local_245:
__local_248:
__local_251:
__local_254:
__local_257:
__local_260:
__local_263:
__local_266:
__local_269:
__local_272:
__local_275:
__local_278:
__local_281:
__local_284:
__local_290:
__local_293:
__local_298:
__local_299:
__local_302:
__local_305:
__local_308:
__local_311:
__local_314:
__local_317:
__local_321:
__local_326:
__local_335:
__local_338:
__local_343:
__local_346:
__local_349:
__local_354:
__local_357:
__local_361:
__local_374:
jmp.w __local_375
__local_112:
__local_114:
.ifgr __tccs_{WLA_FILENAME}_vm_step_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_vm_step_locals
tas
.endif
rtl
.ENDS
.SECTION ".vm_updatetext_0x13" SUPERFREE
vm_update:
.ifgr __vm_update_locals 0
tsa
sec
sbc #__vm_update_locals
tas
.endif
lda.w #0
sep #$20
lda.w vm + 1
rep #$20
sta.b tcc__r0
cmp #2
beq +
brl __local_376
+
jsr.l textbox_tick
lda.l pad_keysdown + 0
and.w #128
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_377
+
jsr.l textbox_waiting_key
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_378
+
jsr.l textbox_resume
bra __local_379
__local_378:
jsr.l textbox_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_380
+
jsr.l textbox_finish
bra __local_381
__local_380:
jsr.l textbox_close
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
__local_381:
__local_379:
bra __local_382
__local_377:
jsr.l textbox_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_383
+
bra __local_384
__local_383:
jsr.l textbox_autoclose
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_384:
brl __local_385
+
jsr.l textbox_close
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
__local_385:
__local_382:
jmp.w __local_386
__local_376:
lda.w #0
sep #$20
lda.w vm + 1
rep #$20
sta.b tcc__r0
cmp #4
beq +
brl __local_387
+
jsr.l actors_routes_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_388
+
bra __local_389
__local_388:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
bra __local_390
__local_389:
jmp.w __local_391
__local_390:
__local_387:
lda.w #0
sep #$20
lda.w vm + 1
rep #$20
sta.b tcc__r0
cmp #6
beq +
brl __local_392
+
jsr.l camera_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_393
+
bra __local_394
__local_393:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
bra __local_395
__local_394:
jmp.w __local_396
__local_395:
__local_392:
lda.w #0
sep #$20
lda.w vm + 1
rep #$20
sta.b tcc__r0
cmp #7
beq +
brl __local_397
+
jsr.l screenfx_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_398
+
bra __local_399
__local_398:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
bra __local_400
__local_399:
jmp.w __local_401
__local_400:
__local_397:
lda.w #0
sep #$20
lda.w vm + 1
rep #$20
sta.b tcc__r0
cmp #8
beq +
brl __local_402
+
jsr.l stage_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_403
+
bra __local_404
__local_403:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
bra __local_405
__local_404:
jmp.w __local_406
__local_405:
__local_402:
lda.w #0
sep #$20
lda.w vm + 1
rep #$20
sta.b tcc__r0
cmp #10
beq +
brl __local_407
+
jsr.l anim_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_408
+
bra __local_409
__local_408:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
bra __local_410
__local_409:
jmp.w __local_411
__local_410:
__local_407:
lda.w #0
sep #$20
lda.w vm + 1
rep #$20
sta.b tcc__r0
cmp #5
beq +
brl __local_412
+
lda.w #0
sep #$20
lda.w vm + 708
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_413
+
lda.w #0
sep #$20
lda.w vm + 708
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w vm + 708
rep #$20
jmp.w __local_414
__local_413:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
__local_412:
lda.w #0
sep #$20
lda.w vm + 1
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_415
+
lda.l pad_keysdown + 0
pha
lda.w vm + 728
pha
jsr.l tccs_{WLA_FILENAME}_keyin_scan
tsa
clc
adc #4
tas
lda.b tcc__r0
sta -2 + __vm_update_locals + 1,s
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_416
+
bra __local_417
__local_416:
jmp.w __local_418
__local_417:
lda.w #0
sep #$20
lda.w vm + 730
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda -2 + __vm_update_locals + 1,s
sta.b [tcc__r1]
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
__local_415:
lda.w #0
sep #$20
lda.w vm + 1
rep #$20
sta.b tcc__r0
cmp #9
beq +
brl __local_419
+
lda.l pad_keysdown + 0
sta -2 + __vm_update_locals + 1,s
and.w #2048
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_420
+
lda.w #0
sep #$20
lda.w vm + 733
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_421
+
lda.w #0
sep #$20
lda.w vm + 733
rep #$20
dec a
and.w #255
sta.b tcc__r0
bra __local_422
__local_421:
lda.w #0
sep #$20
lda.w vm + 732
rep #$20
dec a
and.w #255
sta.b tcc__r0
__local_422:
__local_423:
sep #$20
lda.b tcc__r0
sta.w vm + 733
rep #$20
lda.w #0
sep #$20
lda.w vm + 733
pha
rep #$20
jsr.l overlay_list_cursor
tsa
clc
adc #1
tas
jmp.w __local_424
__local_420:
lda -2 + __vm_update_locals + 1,s
and.w #1024
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_425
+
lda.w #0
sep #$20
lda.w vm + 733
rep #$20
inc a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.w vm + 732
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
brl __local_426
+
bra __local_427
__local_426:
lda.w #0
sep #$20
lda.w vm + 733
rep #$20
inc a
and.w #255
sta.b tcc__r0
bra __local_428
__local_427:
lda.w #0
sta.b tcc__r0
__local_428:
sep #$20
lda.b tcc__r0
sta.w vm + 733
rep #$20
lda.w #0
sep #$20
lda.w vm + 733
pha
rep #$20
jsr.l overlay_list_cursor
tsa
clc
adc #1
tas
jmp.w __local_429
__local_425:
lda -2 + __vm_update_locals + 1,s
and.w #128
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_430
+
lda.w #0
sep #$20
lda.w vm + 731
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.w vm + 733
rep #$20
sta.b [tcc__r1]
lda.w #0
sep #$20
lda.w vm + 734
rep #$20
and.w #2
and.w #255
sep #$20
pha
rep #$20
jsr.l overlay_list_close
tsa
clc
adc #1
tas
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_431
__local_430:
lda -2 + __vm_update_locals + 1,s
and.w #32768
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_432
+
lda.w #0
sep #$20
lda.w vm + 734
rep #$20
and.w #1
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_432:
brl __local_433
+
lda.w #0
sep #$20
lda.w vm + 731
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sta.b [tcc__r1]
lda.w #0
sep #$20
lda.w vm + 734
rep #$20
and.w #2
and.w #255
sep #$20
pha
rep #$20
jsr.l overlay_list_close
tsa
clc
adc #1
tas
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
jmp.w __local_434
__local_433:
lda -2 + __vm_update_locals + 1,s
and.w #768
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_435
+
lda.w #0
sep #$20
lda.w vm + 734
rep #$20
and.w #4
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
__local_435:
brl __local_436
+
lda.w #0
sep #$20
lda.w vm + 731
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda -2 + __vm_update_locals + 1,s
and.w #512
sta.b tcc__r0
lda.b tcc__r1
sta -8 + __vm_update_locals + 1,s
lda.b tcc__r1h
sta -6 + __vm_update_locals + 1,s
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_437
+
bra __local_438
__local_437:
lda.w #253
sta.b tcc__r0
bra __local_439
__local_438:
lda.w #254
sta.b tcc__r0
__local_439:
lda -8 + __vm_update_locals + 1,s
sta.b tcc__r1
lda -6 + __vm_update_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
lda.w #0
sep #$20
lda.w vm + 734
rep #$20
and.w #2
and.w #255
sep #$20
pha
rep #$20
jsr.l overlay_list_close
tsa
clc
adc #1
tas
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
__local_436:
__local_434:
__local_431:
__local_429:
__local_424:
jmp.w __local_440
__local_419:
lda.w #0
sep #$20
lda.w vm + 1
rep #$20
sta.b tcc__r0
cmp #3
beq +
brl __local_441
+
lda.l pad_keysdown + 0
sta -2 + __vm_update_locals + 1,s
and.w #2048
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_442
+
lda.w #0
sep #$20
lda.w vm + 733
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
__local_442:
brl __local_443
+
lda.w #0
sep #$20
lda.w vm + 733
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w vm + 733
rep #$20
lda.w #0
sep #$20
lda.w vm + 733
pha
rep #$20
jsr.l textbox_choice_cursor
tsa
clc
adc #1
tas
jmp.w __local_444
__local_443:
lda -2 + __vm_update_locals + 1,s
and.w #1024
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_445
+
lda.w #0
sep #$20
lda.w vm + 733
rep #$20
inc a
and.w #255
sta.b tcc__r0
lda.w #0
sep #$20
lda.w vm + 732
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
__local_445:
brl __local_446
+
lda.w #0
sep #$20
lda.w vm + 733
rep #$20
sta.b tcc__r0
lda.b tcc__r0h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w vm + 733
rep #$20
lda.w #0
sep #$20
lda.w vm + 733
pha
rep #$20
jsr.l textbox_choice_cursor
tsa
clc
adc #1
tas
bra __local_447
__local_446:
lda -2 + __vm_update_locals + 1,s
and.w #128
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_448
+
lda.w #0
sep #$20
lda.w vm + 733
pha
rep #$20
lda.w #0
sep #$20
lda.w vm + 731
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_var_set
pla
jsr.l textbox_close
lda.w #0
sta.b tcc__r0
sep #$20
sta.w vm + 1
rep #$20
__local_448:
__local_447:
__local_444:
bra __local_449
__local_441:
jsr.l tccs_{WLA_FILENAME}_vm_step
__local_386:
__local_391:
__local_396:
__local_401:
__local_406:
__local_411:
__local_414:
__local_418:
__local_440:
__local_449:
.ifgr __vm_update_locals 0
tsa
clc
adc #__vm_update_locals
tas
.endif
rtl
.ENDS
.SECTION ".vm_parallel_updatetext_0x14" SUPERFREE
vm_parallel_update:
.ifgr __vm_parallel_update_locals 0
tsa
sec
sbc #__vm_parallel_update_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_active + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_450
+
jmp.w __local_451
__local_450:
sep #$20
lda #1
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_common_lookup
tsa
clc
adc #1
tas
lda.b tcc__r0
sta -2 + __vm_parallel_update_locals + 1,s
sta.b tcc__r0
cmp #65535
beq +
brl __local_452
+
jmp.w __local_453
__local_452:
lda.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_p_active + 0
rep #$20
lda -2 + __vm_parallel_update_locals + 1,s
sta.w tccs_{WLA_FILENAME}_p_pc + 0
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_wait_timer + 0
rep #$20
lda.w #255
sep #$20
sta.w tccs_{WLA_FILENAME}_p_script_actor + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_call_sp + 0
rep #$20
__local_451:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
sta.b tcc__r0
cmp #4
beq +
brl __local_454
+
jsr.l actors_routes_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_455
+
jmp.w __local_456
__local_455:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
__local_454:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
sta.b tcc__r0
cmp #6
beq +
brl __local_457
+
jsr.l camera_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_458
+
jmp.w __local_459
__local_458:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
__local_457:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
sta.b tcc__r0
cmp #7
beq +
brl __local_460
+
jsr.l screenfx_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_461
+
jmp.w __local_462
__local_461:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
__local_460:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
sta.b tcc__r0
cmp #8
beq +
brl __local_463
+
jsr.l stage_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_464
+
jmp.w __local_465
__local_464:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
__local_463:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
sta.b tcc__r0
cmp #10
beq +
brl __local_466
+
jsr.l anim_busy
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_467
+
jmp.w __local_468
__local_467:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
__local_466:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
sta.b tcc__r0
cmp #5
beq +
brl __local_469
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_timer + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_470
+
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_timer + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_p_wait_timer + 0
rep #$20
jmp.w __local_471
__local_470:
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
__local_469:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
sta.b tcc__r0
cmp #1
beq +
brl __local_472
+
lda.l pad_keysdown + 0
pha
lda.w tccs_{WLA_FILENAME}_p_keyin_mask + 0
pha
jsr.l tccs_{WLA_FILENAME}_keyin_scan
tsa
clc
adc #4
tas
sep #$20
lda.b tcc__r0
sta -3 + __vm_parallel_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -3 + __vm_parallel_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_473
+
bra __local_474
__local_473:
jmp.w __local_475
__local_474:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_keyin_dst + 0
rep #$20
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -3 + __vm_parallel_update_locals + 1,s
rep #$20
sta.b [tcc__r1]
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_p_wait_mode + 0
rep #$20
__local_472:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_p_wait_mode + 0
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
brl __local_476
+
bra __local_477
__local_476:
jsr.l tccs_{WLA_FILENAME}_pvm_swap
jsr.l tccs_{WLA_FILENAME}_vm_step
jsr.l tccs_{WLA_FILENAME}_pvm_swap
__local_453:
__local_456:
__local_459:
__local_462:
__local_465:
__local_468:
__local_471:
__local_475:
__local_477:
.ifgr __vm_parallel_update_locals 0
tsa
clc
adc #__vm_parallel_update_locals
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
vm dsb 736
tccs_{WLA_FILENAME}_vm_seed dsb 2
tccs_{WLA_FILENAME}_p_active dsb 1
tccs_{WLA_FILENAME}_p_pc dsb 2
tccs_{WLA_FILENAME}_p_wait_mode dsb 1
tccs_{WLA_FILENAME}_p_wait_timer dsb 1
tccs_{WLA_FILENAME}_p_script_actor dsb 1
tccs_{WLA_FILENAME}_p_call_sp dsb 1
tccs_{WLA_FILENAME}_p_call_stack dsb 16
tccs_{WLA_FILENAME}_p_keyin_mask dsb 2
tccs_{WLA_FILENAME}_p_keyin_dst dsb 1
tccs_{WLA_FILENAME}_choice_ids dsb 8
.ENDS
