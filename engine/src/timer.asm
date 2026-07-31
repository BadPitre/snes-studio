.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_t_render_locals 12
.define __timer_init_locals 0
.define __timer_set_locals 0
.define __timer_stop_locals 0
.define __timer_display_locals 0
.define __timer_refresh_locals 0
.define __timer_secs_locals 0
.define __timer_tick_locals 0
.SECTION ".tccs_{WLA_FILENAME}_t_rendertext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_t_render:
.ifgr __tccs_{WLA_FILENAME}_t_render_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_t_render_locals
tas
.endif
lda.w #58
sta -6 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_t_show + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_0
+
lda.w tccs_{WLA_FILENAME}_t_secs + 0
sta.b tcc__r0
tax
lda.w #60
jsr.l tcc__udiv
lda.b tcc__r9
sta -2 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
lda.w tccs_{WLA_FILENAME}_t_secs + 0
sta.b tcc__r0
tax
lda.w #60
jsr.l tcc__udiv
txa
sta -4 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
lda -2 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #99
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_1
+
lda.w #99
sta.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
__local_1:
lda -6 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -2 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #10
tay
bcc ++
+ dex
++
stx.b tcc__r5
lda.b tcc__r1
sta -12 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
lda.b tcc__r1h
sta -10 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
lda.b tcc__r5 ; DON'T OPTIMIZE
bne +
brl __local_2
+
bra __local_3
__local_2:
lda -2 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
sta.b tcc__r0
tax
lda.w #10
jsr.l tcc__udiv
lda.b tcc__r9
clc
adc.w #48
sec
sbc.w #31
ora.w #12288
sta.b tcc__r0
bra __local_4
__local_3:
lda.w #12289
sta.b tcc__r0
__local_4:
lda -12 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
sta.b tcc__r1
lda -10 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
sta.b tcc__r1h
lda.b tcc__r0
sta.b [tcc__r1]
lda -6 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -2 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
sta.b tcc__r0
tax
lda.w #10
jsr.l tcc__udiv
stx.b tcc__r0
clc
lda.b tcc__r0
adc.w #48
sec
sbc.w #31
ora.w #12288
sta.b [tcc__r1]
lda -6 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
sta.b tcc__r0
inc.b tcc__r0
inc.b tcc__r0
asl.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #12315
sta.b [tcc__r1]
lda -6 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
clc
adc.w #3
asl a
sta.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -4 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
sta.b tcc__r0
tax
lda.w #10
jsr.l tcc__udiv
lda.b tcc__r9
clc
adc.w #48
sec
sbc.w #31
ora.w #12288
sta.b [tcc__r1]
lda -6 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
clc
adc.w #4
asl a
sta.b tcc__r0
lda.w #:ui_map
sta.b tcc__r1h
lda.w #ui_map + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -4 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
sta.b tcc__r0
tax
lda.w #10
jsr.l tcc__udiv
stx.b tcc__r0
clc
lda.b tcc__r0
adc.w #48
sec
sbc.w #31
ora.w #12288
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_5
__local_0:
lda.w #0
sta.b tcc__r0
sep #$20
sta -7 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
rep #$20
__local_8:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #5
bvc +
eor #$8000
+
bmi +
brl __local_6
+
bra __local_7
__local_9:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta -7 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
rep #$20
bra __local_8
__local_7:
lda.w #0
sep #$20
lda -7 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
rep #$20
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_t_render_locals + 1,s
clc
adc.b tcc__r0
asl a
sta.b tcc__r1
lda.w #:ui_map
sta.b tcc__r0h
lda.w #ui_map + 0
clc
adc.b tcc__r1
sta.b tcc__r0
stz.b tcc__r1
lda.b tcc__r1
sta.b [tcc__r0]
jmp.w __local_9
__local_6:
__local_5:
pea.w (1 * 256 + 1)
sep #$20
rep #$20
jsr.l ui_mark
pla
.ifgr __tccs_{WLA_FILENAME}_t_render_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_t_render_locals
tas
.endif
rtl
.ENDS
.SECTION ".timer_inittext_0x1" SUPERFREE
timer_init:
.ifgr __timer_init_locals 0
tsa
sec
sbc #__timer_init_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_t_secs + 0
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_t_frames + 0
rep #$20
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_t_run + 0
rep #$20
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_t_show + 0
rep #$20
.ifgr __timer_init_locals 0
tsa
clc
adc #__timer_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".timer_settext_0x2" SUPERFREE
timer_set:
.ifgr __timer_set_locals 0
tsa
sec
sbc #__timer_set_locals
tas
.endif
lda 3 + __timer_set_locals + 1,s
sta.w tccs_{WLA_FILENAME}_t_secs + 0
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_t_frames + 0
rep #$20
lda.w #1
sep #$20
sta.w tccs_{WLA_FILENAME}_t_run + 0
rep #$20
jsr.l tccs_{WLA_FILENAME}_t_render
.ifgr __timer_set_locals 0
tsa
clc
adc #__timer_set_locals
tas
.endif
rtl
.ENDS
.SECTION ".timer_stoptext_0x3" SUPERFREE
timer_stop:
.ifgr __timer_stop_locals 0
tsa
sec
sbc #__timer_stop_locals
tas
.endif
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_t_run + 0
rep #$20
.ifgr __timer_stop_locals 0
tsa
clc
adc #__timer_stop_locals
tas
.endif
rtl
.ENDS
.SECTION ".timer_displaytext_0x4" SUPERFREE
timer_display:
.ifgr __timer_display_locals 0
tsa
sec
sbc #__timer_display_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __timer_display_locals + 1,s
sta.w tccs_{WLA_FILENAME}_t_show + 0
rep #$20
jsr.l tccs_{WLA_FILENAME}_t_render
.ifgr __timer_display_locals 0
tsa
clc
adc #__timer_display_locals
tas
.endif
rtl
.ENDS
.SECTION ".timer_refreshtext_0x5" SUPERFREE
timer_refresh:
.ifgr __timer_refresh_locals 0
tsa
sec
sbc #__timer_refresh_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_t_show + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_10
+
jsr.l tccs_{WLA_FILENAME}_t_render
__local_10:
.ifgr __timer_refresh_locals 0
tsa
clc
adc #__timer_refresh_locals
tas
.endif
rtl
.ENDS
.SECTION ".timer_secstext_0x6" SUPERFREE
timer_secs:
.ifgr __timer_secs_locals 0
tsa
sec
sbc #__timer_secs_locals
tas
.endif
lda.w tccs_{WLA_FILENAME}_t_secs + 0
sta.b tcc__r0
__local_11:
.ifgr __timer_secs_locals 0
tsa
clc
adc #__timer_secs_locals
tas
.endif
rtl
.ENDS
.SECTION ".timer_ticktext_0x7" SUPERFREE
timer_tick:
.ifgr __timer_tick_locals 0
tsa
sec
sbc #__timer_tick_locals
tas
.endif
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_t_run + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_12
+
lda.w tccs_{WLA_FILENAME}_t_secs + 0
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
__local_12:
brl __local_13
+
bra __local_14
__local_13:
jmp.w __local_15
__local_14:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_t_frames + 0
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
sep #$20
lda.b tcc__r0
sta.w tccs_{WLA_FILENAME}_t_frames + 0
rep #$20
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_t_frames + 0
rep #$20
sta.b tcc__r0
ldx #1
sec
sbc.w #60
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
brl __local_16
+
lda.w #0
sep #$20
sta.w tccs_{WLA_FILENAME}_t_frames + 0
rep #$20
lda.w tccs_{WLA_FILENAME}_t_secs + 0
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
clc
lda.b tcc__r0
adc.w #65535
sta.w tccs_{WLA_FILENAME}_t_secs + 0
lda.w tccs_{WLA_FILENAME}_t_secs + 0
sta.b tcc__r0
cmp #0
beq +
brl __local_17
+
lda.w #0
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_t_run + 0
rep #$20
__local_17:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_t_show + 0
rep #$20
sta.b tcc__r0
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_18
+
jsr.l tccs_{WLA_FILENAME}_t_render
__local_18:
__local_16:
__local_15:
.ifgr __timer_tick_locals 0
tsa
clc
adc #__timer_tick_locals
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
tccs_{WLA_FILENAME}_t_secs dsb 2
tccs_{WLA_FILENAME}_t_frames dsb 1
tccs_{WLA_FILENAME}_t_run dsb 1
tccs_{WLA_FILENAME}_t_show dsb 1
.ENDS
