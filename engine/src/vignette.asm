.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_pal_acquire_locals 1
.define __tccs_{WLA_FILENAME}_pal_release_locals 1
.define __tccs_{WLA_FILENAME}_vig_init_once_locals 1
.define __vig_pal_available_locals 1
.define __vig_show_locals 1
.define __vig_anchor_locals 0
.define __vig_anchor_actor_locals 0
.define __vig_set_frame_locals 0
.define __vig_set_visible_locals 4
.define __vig_move_locals 0
.define __vig_free_slot_locals 1
.define __vig_own_anim_locals 0
.define __vig_is_anim_locals 0
.define __vig_play_locals 8
.define __vig_hide_locals 0
.define __vig_reload_locals 1
.define __vig_update_locals 12
.define __vig_vblank_locals 10
.SECTION ".tccs_{WLA_FILENAME}_pal_acquiretext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_pal_acquire:
.ifgr __tccs_{WLA_FILENAME}_pal_acquire_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_pal_acquire_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
__local_2:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #2
bvc +
eor #$8000
+
bmi +
brl __local_0
+
bra __local_1
__local_6:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
bra __local_2
__local_1:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_rc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_rc + 0
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
brl __local_3
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_vig
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_vig + 0
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
lda 3 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
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
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_rc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_rc + 0
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
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
jmp.w __local_5
__local_4:
jmp.w __local_6
__local_0:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
__local_9:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #2
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
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
bra __local_9
__local_8:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_rc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_rc + 0
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
brl __local_10
+
jmp.w __local_11
__local_10:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_vig
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_vig + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_rc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_rc + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #1
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
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
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_pal + 0
rep #$20
ora.b tcc__r1
sep #$20
sta.l tccs_{WLA_FILENAME}_v_pal + 0
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_acquire_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_12
__local_11:
jmp.w __local_13
__local_7:
lda.w #255
sta.b tcc__r0
__local_5:
__local_12:
__local_14:
.ifgr __tccs_{WLA_FILENAME}_pal_acquire_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_pal_acquire_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_pal_releasetext_0x1" SUPERFREE
tccs_{WLA_FILENAME}_pal_release:
.ifgr __tccs_{WLA_FILENAME}_pal_release_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_pal_release_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pal_release_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_pi
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_pi + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -1 + __tccs_{WLA_FILENAME}_pal_release_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_release_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #2
bvc +
eor #$8000
+
bmi +
brl __local_15
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_release_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_rc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_rc + 0
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
__local_15:
brl __local_16
+
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_pal_release_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_rc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_rc + 0
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
__local_16:
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_pal_release_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_pi
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_pi + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
.ifgr __tccs_{WLA_FILENAME}_pal_release_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_pal_release_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_vig_init_oncetext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_vig_init_once:
.ifgr __tccs_{WLA_FILENAME}_vig_init_once_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_vig_init_once_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_init + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_17
+
jmp.w __local_18
__local_17:
lda.w #1
sep #$20
sta.l tccs_{WLA_FILENAME}_v_init + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
__local_21:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #4
bvc +
eor #$8000
+
bmi +
brl __local_19
+
bra __local_20
__local_22:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
bra __local_21
__local_20:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_own
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_own + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_anc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_anc + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_act
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_act + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_pi
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_pi + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_off
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_off + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_22
__local_19:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
__local_25:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #2
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
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
bra __local_25
__local_24:
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_vig
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_vig + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __tccs_{WLA_FILENAME}_vig_init_once_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_rc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_rc + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_26
__local_23:
lda.w #0
sep #$20
sta.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_v_pal + 0
rep #$20
__local_18:
.ifgr __tccs_{WLA_FILENAME}_vig_init_once_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_vig_init_once_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_pal_availabletext_0x3" SUPERFREE
vig_pal_available:
.ifgr __vig_pal_available_locals 0
tsa
sec
sbc #__vig_pal_available_locals
tas
.endif
jsr.l tccs_{WLA_FILENAME}_vig_init_once
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __vig_pal_available_locals + 1,s
rep #$20
__local_29:
lda.w #0
sep #$20
lda -1 + __vig_pal_available_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #2
bvc +
eor #$8000
+
bmi +
brl __local_27
+
bra __local_28
__local_34:
lda.w #0
sep #$20
lda -1 + __vig_pal_available_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __vig_pal_available_locals + 1,s
rep #$20
bra __local_29
__local_28:
lda.w #0
sep #$20
lda -1 + __vig_pal_available_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_rc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_rc + 0
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
brl __local_30
+
lda.w #0
sep #$20
lda -1 + __vig_pal_available_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_vig
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_vig + 0
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
lda 3 + __vig_pal_available_locals + 1,s
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
__local_30:
brl __local_31
+
bra __local_32
__local_31:
lda.w #1
sta.b tcc__r0
bra __local_33
__local_32:
jmp.w __local_34
__local_27:
lda.w #0
sta.b tcc__r0
__local_33:
__local_35:
.ifgr __vig_pal_available_locals 0
tsa
clc
adc #__vig_pal_available_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_showtext_0x4" SUPERFREE
vig_show:
.ifgr __vig_show_locals 0
tsa
sec
sbc #__vig_show_locals
tas
.endif
jsr.l tccs_{WLA_FILENAME}_vig_init_once
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #4
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
brl __local_36
+
lda.w #0
sep #$20
lda 4 + __vig_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.l vig_count + 0
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
__local_36:
brl __local_37
+
bra __local_38
__local_37:
jmp.w __local_39
__local_38:
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pal_release
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda 4 + __vig_show_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pal_acquire
tsa
clc
adc #1
tas
sep #$20
lda.b tcc__r0
sta -1 + __vig_show_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __vig_show_locals + 1,s
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_40
+
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
pha
rep #$20
jsr.l vig_hide
tsa
clc
adc #1
tas
jmp.w __local_41
__local_40:
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_pi
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_pi + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __vig_show_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __vig_show_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_frame
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_frame + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_own
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_own + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_x
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_x + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 5 + __vig_show_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_y
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_y + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 6 + __vig_show_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_off
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_off + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_show_locals + 1,s
rep #$20
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
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
ora.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
__local_39:
__local_41:
.ifgr __vig_show_locals 0
tsa
clc
adc #__vig_show_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_anchortext_0x5" SUPERFREE
vig_anchor:
.ifgr __vig_anchor_locals 0
tsa
sec
sbc #__vig_anchor_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __vig_anchor_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #4
bvc +
eor #$8000
+
bmi +
brl __local_42
+
lda.w #0
sep #$20
lda 3 + __vig_anchor_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_anc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_anc + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __vig_anchor_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_42:
.ifgr __vig_anchor_locals 0
tsa
clc
adc #__vig_anchor_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_anchor_actortext_0x6" SUPERFREE
vig_anchor_actor:
.ifgr __vig_anchor_actor_locals 0
tsa
sec
sbc #__vig_anchor_actor_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __vig_anchor_actor_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #4
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
brl __local_43
+
jmp.w __local_44
__local_43:
lda.w #0
sep #$20
lda 3 + __vig_anchor_actor_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_anc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_anc + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #2
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_anchor_actor_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_act
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_act + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __vig_anchor_actor_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_44:
.ifgr __vig_anchor_actor_locals 0
tsa
clc
adc #__vig_anchor_actor_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_set_frametext_0x7" SUPERFREE
vig_set_frame:
.ifgr __vig_set_frame_locals 0
tsa
sec
sbc #__vig_set_frame_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __vig_set_frame_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #4
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
brl __local_45
+
lda.w #0
sep #$20
lda 3 + __vig_set_frame_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
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
beq +
dex
+
stx.b tcc__r5
txa
beq +
__local_45:
brl __local_46
+
bra __local_47
__local_46:
jmp.w __local_48
__local_47:
lda.w #0
sep #$20
lda 3 + __vig_set_frame_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
lda.w #:vig_frames
sta.b tcc__r1h
lda.w #vig_frames + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __vig_set_frame_locals + 1,s
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
brl __local_49
+
lda.w #0
sep #$20
lda 3 + __vig_set_frame_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_frame
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_frame + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __vig_set_frame_locals + 1,s
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
beq +
dex
+
stx.b tcc__r5
txa
beq +
__local_49:
brl __local_50
+
bra __local_51
__local_50:
jmp.w __local_52
__local_51:
lda.w #0
sep #$20
lda 3 + __vig_set_frame_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_frame
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_frame + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __vig_set_frame_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_set_frame_locals + 1,s
rep #$20
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
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
ora.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
__local_48:
__local_52:
.ifgr __vig_set_frame_locals 0
tsa
clc
adc #__vig_set_frame_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_set_visibletext_0x8" SUPERFREE
vig_set_visible:
.ifgr __vig_set_visible_locals 0
tsa
sec
sbc #__vig_set_visible_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __vig_set_visible_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #4
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
brl __local_53
+
jmp.w __local_54
__local_53:
lda.w #0
sep #$20
lda 3 + __vig_set_visible_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_off
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_off + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __vig_set_visible_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r1
sta -4 + __vig_set_visible_locals + 1,s
lda.b tcc__r1h
sta -2 + __vig_set_visible_locals + 1,s
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_55
+
bra __local_56
__local_55:
lda.w #1
sta.b tcc__r0
bra __local_57
__local_56:
lda.w #0
sta.b tcc__r0
__local_57:
lda -4 + __vig_set_visible_locals + 1,s
sta.b tcc__r1
lda -2 + __vig_set_visible_locals + 1,s
sta.b tcc__r1h
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 4 + __vig_set_visible_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_58
+
bra __local_59
__local_58:
lda.w #0
sep #$20
lda 3 + __vig_set_visible_locals + 1,s
rep #$20
clc
adc.w #96
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
__local_59:
__local_54:
.ifgr __vig_set_visible_locals 0
tsa
clc
adc #__vig_set_visible_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_movetext_0x9" SUPERFREE
vig_move:
.ifgr __vig_move_locals 0
tsa
sec
sbc #__vig_move_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __vig_move_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #4
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
brl __local_60
+
jmp.w __local_61
__local_60:
lda.w #0
sep #$20
lda 3 + __vig_move_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_x
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_x + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __vig_move_locals + 1,s
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_move_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_y
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_y + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 5 + __vig_move_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_61:
.ifgr __vig_move_locals 0
tsa
clc
adc #__vig_move_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_free_slottext_0xa" SUPERFREE
vig_free_slot:
.ifgr __vig_free_slot_locals 0
tsa
sec
sbc #__vig_free_slot_locals
tas
.endif
jsr.l tccs_{WLA_FILENAME}_vig_init_once
lda.w #4
sta.b tcc__r0
sep #$20
sta -1 + __vig_free_slot_locals + 1,s
rep #$20
__local_65:
lda.w #0
sep #$20
lda -1 + __vig_free_slot_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __vig_free_slot_locals + 1,s
rep #$20
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_62
+
lda.w #0
sep #$20
lda -1 + __vig_free_slot_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_63
+
lda.w #0
sep #$20
lda -1 + __vig_free_slot_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_64
__local_63:
jmp.w __local_65
__local_62:
lda.w #255
sta.b tcc__r0
__local_64:
__local_66:
.ifgr __vig_free_slot_locals 0
tsa
clc
adc #__vig_free_slot_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_own_animtext_0xb" SUPERFREE
vig_own_anim:
.ifgr __vig_own_anim_locals 0
tsa
sec
sbc #__vig_own_anim_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __vig_own_anim_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #4
bvc +
eor #$8000
+
bmi +
brl __local_67
+
lda.w #0
sep #$20
lda 3 + __vig_own_anim_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_own
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_own + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #1
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_67:
.ifgr __vig_own_anim_locals 0
tsa
clc
adc #__vig_own_anim_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_is_animtext_0xc" SUPERFREE
vig_is_anim:
.ifgr __vig_is_anim_locals 0
tsa
sec
sbc #__vig_is_anim_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __vig_is_anim_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #4
bvc +
eor #$8000
+
bmi +
brl __local_68
+
lda.w #0
sep #$20
lda 3 + __vig_is_anim_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_own
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_own + 0
clc
adc.b tcc__r0
sta.b tcc__r1
bra __local_69
__local_68:
lda.w #0
sta.b tcc__r0
bra __local_70
__local_69:
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
__local_70:
lda.b tcc__r0
and.w #255
sta.b tcc__r0
__local_71:
.ifgr __vig_is_anim_locals 0
tsa
clc
adc #__vig_is_anim_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_playtext_0xd" SUPERFREE
vig_play:
.ifgr __vig_play_locals 0
tsa
sec
sbc #__vig_play_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __vig_play_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #4
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
brl __local_72
+
lda.w #0
sep #$20
lda 3 + __vig_play_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
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
beq +
dex
+
stx.b tcc__r5
txa
beq +
__local_72:
brl __local_73
+
bra __local_74
__local_73:
jmp.w __local_75
__local_74:
lda.w #0
sep #$20
lda 3 + __vig_play_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_mode + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 4 + __vig_play_locals + 1,s
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
lda.b tcc__r1
sta -4 + __vig_play_locals + 1,s
lda.b tcc__r1h
sta -2 + __vig_play_locals + 1,s
lda.b tcc__r5 ; DON'T OPTIMIZE
bne +
brl __local_76
+
bra __local_77
__local_76:
lda.w #0
sep #$20
lda 4 + __vig_play_locals + 1,s
rep #$20
sta.b tcc__r0
bra __local_78
__local_77:
lda.w #2
sta.b tcc__r0
__local_78:
lda -4 + __vig_play_locals + 1,s
sta.b tcc__r1
lda -2 + __vig_play_locals + 1,s
sta.b tcc__r1h
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_play_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_speed
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_speed + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 5 + __vig_play_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b tcc__r1
sta -8 + __vig_play_locals + 1,s
lda.b tcc__r1h
sta -6 + __vig_play_locals + 1,s
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_79
+
bra __local_80
__local_79:
lda.w #8
sta.b tcc__r0
bra __local_81
__local_80:
lda.w #0
sep #$20
lda 5 + __vig_play_locals + 1,s
rep #$20
sta.b tcc__r0
__local_81:
lda -8 + __vig_play_locals + 1,s
sta.b tcc__r1
lda -6 + __vig_play_locals + 1,s
sta.b tcc__r1h
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_play_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_timer
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_timer + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __vig_play_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_speed
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_v_speed + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_75:
.ifgr __vig_play_locals 0
tsa
clc
adc #__vig_play_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_hidetext_0xe" SUPERFREE
vig_hide:
.ifgr __vig_hide_locals 0
tsa
sec
sbc #__vig_hide_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __vig_hide_locals + 1,s
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #4
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
brl __local_82
+
jmp.w __local_83
__local_82:
lda.w #0
sep #$20
lda 3 + __vig_hide_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_pal_release
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda 3 + __vig_hide_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_hide_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_own
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_own + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_hide_locals + 1,s
rep #$20
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
eor.w #65535
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
and.b tcc__r1
sep #$20
sta.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
lda.w #0
sep #$20
lda 3 + __vig_hide_locals + 1,s
rep #$20
clc
adc.w #96
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
__local_83:
.ifgr __vig_hide_locals 0
tsa
clc
adc #__vig_hide_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_reloadtext_0xf" SUPERFREE
vig_reload:
.ifgr __vig_reload_locals 0
tsa
sec
sbc #__vig_reload_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_init + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_84
+
bra __local_85
__local_84:
jmp.w __local_86
__local_85:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __vig_reload_locals + 1,s
rep #$20
__local_89:
lda.w #0
sep #$20
lda -1 + __vig_reload_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #4
bvc +
eor #$8000
+
bmi +
brl __local_87
+
bra __local_88
__local_92:
lda.w #0
sep #$20
lda -1 + __vig_reload_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __vig_reload_locals + 1,s
rep #$20
bra __local_89
__local_88:
lda.w #0
sep #$20
lda -1 + __vig_reload_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
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
brl __local_90
+
lda.w #0
sep #$20
lda -1 + __vig_reload_locals + 1,s
rep #$20
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
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
ora.b tcc__r1
sep #$20
sta.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
lda.w #0
sep #$20
lda -1 + __vig_reload_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_pi
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_pi + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sec
sbc.w #2
bvc +
eor #$8000
+
bmi +
brl __local_91
+
lda.w #0
sep #$20
lda -1 + __vig_reload_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_pi
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_pi + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
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
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_pal + 0
rep #$20
ora.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_v_pal + 0
rep #$20
__local_91:
__local_90:
jmp.w __local_92
__local_87:
__local_86:
.ifgr __vig_reload_locals 0
tsa
clc
adc #__vig_reload_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_updatetext_0x10" SUPERFREE
vig_update:
.ifgr __vig_update_locals 0
tsa
sec
sbc #__vig_update_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_init + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_93
+
bra __local_94
__local_93:
jmp.w __local_95
__local_94:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __vig_update_locals + 1,s
rep #$20
__local_98:
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #4
bvc +
eor #$8000
+
bmi +
brl __local_96
+
bra __local_97
__local_100:
__local_102:
__local_107:
__local_112:
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __vig_update_locals + 1,s
rep #$20
bra __local_98
__local_97:
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_99
+
jmp.w __local_100
__local_99:
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_off
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_off + 0
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
brl __local_101
+
jmp.w __local_102
__local_101:
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_mode + 0
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
brl __local_103
+
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_timer
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_timer + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
lda.b tcc__r0
and.w #255
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
__local_103:
brl __local_104
+
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_timer
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_timer + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_speed
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_v_speed + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_frame
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_frame + 0
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
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.b [tcc__r1]
rep #$20
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_frame
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_frame + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r0
lda.w #:vig_frames
sta.b tcc__r2h
lda.w #vig_frames + 0
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
brl __local_105
+
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_mode
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_mode + 0
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
brl __local_106
+
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
pha
rep #$20
jsr.l vig_hide
tsa
clc
adc #1
tas
jmp.w __local_107
__local_106:
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_frame
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_frame + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
__local_105:
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
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
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
ora.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
__local_104:
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_anc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_anc + 0
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
brl __local_108
+
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_act
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_act + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
pha
rep #$20
jsr.l actor_pos_x
tsa
clc
adc #1
tas
lda.l camera + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_v_x
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_v_x + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
xba
and #$ff00
sta.b tcc__r1
ldy.w #8
-
cmp #$8000
ror a
dey
bne -
+
sta.b tcc__r1
clc
adc.b tcc__r0
sta -6 + __vig_update_locals + 1,s
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_act
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_act + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
pha
rep #$20
jsr.l actor_pos_y
tsa
clc
adc #1
tas
lda.l camera + 2
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_v_y
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_v_y + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
xba
and #$ff00
sta.b tcc__r1
ldy.w #8
-
cmp #$8000
ror a
dey
bne -
+
sta.b tcc__r1
clc
adc.b tcc__r0
sta -8 + __vig_update_locals + 1,s
lda -6 + __vig_update_locals + 1,s
and.w #255
sep #$20
sta -2 + __vig_update_locals + 1,s
rep #$20
lda -8 + __vig_update_locals + 1,s
and.w #255
sta.b tcc__r0
sep #$20
sta -3 + __vig_update_locals + 1,s
rep #$20
jmp.w __local_109
__local_108:
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_anc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_anc + 0
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
brl __local_110
+
lda.l player + 0
sta.b tcc__r0
lda.l camera + 0
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_v_x
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_v_x + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
xba
and #$ff00
sta.b tcc__r1
ldy.w #8
-
cmp #$8000
ror a
dey
bne -
+
clc
adc.b tcc__r0
sta -6 + __vig_update_locals + 1,s
lda.l player + 2
sta.b tcc__r0
lda.l camera + 2
sta.b tcc__r1
sec
lda.b tcc__r0
sbc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_v_y
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_v_y + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
xba
and #$ff00
sta.b tcc__r1
ldy.w #8
-
cmp #$8000
ror a
dey
bne -
+
sta.b tcc__r1
clc
adc.b tcc__r0
sta -8 + __vig_update_locals + 1,s
lda -6 + __vig_update_locals + 1,s
and.w #255
sep #$20
sta -2 + __vig_update_locals + 1,s
rep #$20
lda -8 + __vig_update_locals + 1,s
and.w #255
sta.b tcc__r0
sep #$20
sta -3 + __vig_update_locals + 1,s
rep #$20
jmp.w __local_111
__local_110:
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_x
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_x + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
sta -2 + __vig_update_locals + 1,s
rep #$20
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_y
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_y + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sep #$20
sta -3 + __vig_update_locals + 1,s
rep #$20
__local_111:
__local_109:
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
clc
adc.w #96
asl a
asl a
sta.b tcc__r0
lda.w #:oamMemory
sta.b tcc__r1h
lda.w #oamMemory + 0
clc
adc.b tcc__r0
sta.b tcc__r1
sta -12 + __vig_update_locals + 1,s
lda.b tcc__r1h
sta -10 + __vig_update_locals + 1,s
lda -12 + __vig_update_locals + 1,s
sta.b tcc__r0
lda -10 + __vig_update_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda -2 + __vig_update_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -10 + __vig_update_locals + 1,s
sta.b tcc__r0h
lda -12 + __vig_update_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -3 + __vig_update_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -10 + __vig_update_locals + 1,s
sta.b tcc__r0h
lda -12 + __vig_update_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
asl a
asl a
clc
adc.w #384
sec
sbc.w #256
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -12 + __vig_update_locals + 1,s
sta.b tcc__r0
lda -10 + __vig_update_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
sta.b tcc__r1
lda.w #:tccs_{WLA_FILENAME}_v_pi
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_v_pi + 0
clc
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
clc
adc.w #5
and.w #255
asl a
ora.w #48
ora.w #1
sep #$20
sta.b [tcc__r0]
rep #$20
lda.w #0
sep #$20
lda -1 + __vig_update_locals + 1,s
rep #$20
clc
adc.w #96
asl a
asl a
sta.b tcc__r0
pea.w (0 * 256 + 1)
sep #$20
rep #$20
pei (tcc__r0)
jsr.l oamSetEx
tsa
clc
adc #4
tas
jmp.w __local_112
__local_96:
__local_95:
.ifgr __vig_update_locals 0
tsa
clc
adc #__vig_update_locals
tas
.endif
rtl
.ENDS
.SECTION ".vig_vblanktext_0x11" SUPERFREE
vig_vblank:
.ifgr __vig_vblank_locals 0
tsa
sec
sbc #__vig_vblank_locals
tas
.endif
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_113
+
bra __local_114
__local_113:
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_pal + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_115
+
bra __local_116
__local_115:
jmp.w __local_117
__local_114:
__local_116:
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __vig_vblank_locals + 1,s
rep #$20
__local_120:
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #2
bvc +
eor #$8000
+
bmi +
brl __local_118
+
bra __local_119
__local_124:
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __vig_vblank_locals + 1,s
rep #$20
bra __local_120
__local_119:
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
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
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_pal + 0
rep #$20
and.b tcc__r1
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_121
+
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_rc
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_rc + 0
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
brl __local_122
+
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_pal_vig
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_pal_vig + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:vig_pals
sta.b tcc__r1h
lda.w #vig_pals + 0
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
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
clc
adc.w #5
asl a
asl a
asl a
asl a
clc
adc.w #128
sta.b tcc__r1
inc.b tcc__r1
pea.w 30
pei (tcc__r1)
pei (tcc__r0h)
pei (tcc__r0)
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
__local_122:
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
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
eor.w #65535
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_pal + 0
rep #$20
and.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_v_pal + 0
rep #$20
jmp.w __local_123
__local_121:
jmp.w __local_124
__local_118:
lda.w #0
sep #$20
sta -3 + __vig_vblank_locals + 1,s
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta -1 + __vig_vblank_locals + 1,s
rep #$20
__local_127:
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #4
bvc +
eor #$8000
+
bmi +
brl __local_125
+
bra __local_126
__local_130:
__local_132:
__local_139:
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __vig_vblank_locals + 1,s
rep #$20
bra __local_127
__local_126:
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
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
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
and.b tcc__r1
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_128
+
bra __local_129
__local_128:
jmp.w __local_130
__local_129:
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
cmp #255
beq +
brl __local_131
+
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
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
eor.w #65535
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
and.b tcc__r1
sta.b tcc__r0
sep #$20
sta.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
jmp.w __local_132
__local_131:
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_id
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_v_id + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:vig_chars
sta.b tcc__r1h
lda.w #vig_chars + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_v_frame
sta.b tcc__r2h
lda.w #tccs_{WLA_FILENAME}_v_frame + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r0
ldy.w #9
-
asl a
dey
bne -
+
sta.b tcc__r0
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
sta -8 + __vig_vblank_locals + 1,s
lda.b tcc__r2h
sta -6 + __vig_vblank_locals + 1,s
lda.w #0
sta.b tcc__r0
sep #$20
sta -2 + __vig_vblank_locals + 1,s
rep #$20
__local_135:
lda.w #0
sep #$20
lda -2 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #4
bvc +
eor #$8000
+
bmi +
brl __local_133
+
bra __local_134
__local_136:
lda.w #0
sep #$20
lda -2 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -2 + __vig_vblank_locals + 1,s
rep #$20
bra __local_135
__local_134:
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
asl a
asl a
clc
adc.w #384
sta.b tcc__r0
lda.w #0
sep #$20
lda -2 + __vig_vblank_locals + 1,s
rep #$20
asl a
asl a
asl a
asl a
sta.b tcc__r1
clc
adc.b tcc__r0
asl a
asl a
asl a
asl a
clc
adc.w #16384
sta -10 + __vig_vblank_locals + 1,s
lda.w #0
sep #$20
lda -2 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
ldy.w #7
-
asl a
dey
bne -
+
sta.b tcc__r0
lda -8 + __vig_vblank_locals + 1,s
sta.b tcc__r1
lda -6 + __vig_vblank_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
pea.w 128
lda -8 + __vig_vblank_locals + 1,s
pha
pei (tcc__r1h)
pei (tcc__r1)
jsr.l dmaCopyVram
tsa
clc
adc #8
tas
jmp.w __local_136
__local_133:
lda.w #0
sep #$20
lda -1 + __vig_vblank_locals + 1,s
rep #$20
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
eor.w #65535
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
and.b tcc__r1
sep #$20
sta.l tccs_{WLA_FILENAME}_v_dirty + 0
rep #$20
lda.w #0
sep #$20
lda -3 + __vig_vblank_locals + 1,s
rep #$20
sta.b tcc__r0
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -3 + __vig_vblank_locals + 1,s
rep #$20
lda.b tcc__r0
and.w #255
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
brl __local_137
+
bra __local_138
__local_137:
jmp.w __local_139
__local_125:
__local_117:
__local_123:
__local_138:
.ifgr __vig_vblank_locals 0
tsa
clc
adc #__vig_vblank_locals
tas
.endif
rtl
.ENDS
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
tccs_{WLA_FILENAME}_v_dirty dsb 1
tccs_{WLA_FILENAME}_v_pal dsb 1
tccs_{WLA_FILENAME}_v_init dsb 1
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.db $0
.db $0
.db $0
.ENDS
.SECTION ".rodata" SUPERFREE
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
tccs_{WLA_FILENAME}_v_id dsb 4
tccs_{WLA_FILENAME}_v_frame dsb 4
tccs_{WLA_FILENAME}_v_mode dsb 4
tccs_{WLA_FILENAME}_v_speed dsb 4
tccs_{WLA_FILENAME}_v_timer dsb 4
tccs_{WLA_FILENAME}_v_x dsb 4
tccs_{WLA_FILENAME}_v_y dsb 4
tccs_{WLA_FILENAME}_v_anc dsb 4
tccs_{WLA_FILENAME}_v_act dsb 4
tccs_{WLA_FILENAME}_v_own dsb 4
tccs_{WLA_FILENAME}_v_pi dsb 4
tccs_{WLA_FILENAME}_v_off dsb 4
tccs_{WLA_FILENAME}_pal_vig dsb 2
tccs_{WLA_FILENAME}_pal_rc dsb 2
.ENDS
