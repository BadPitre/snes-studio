.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_make_far_locals 8
.define __tccs_{WLA_FILENAME}_rle_decode_locals 4
.define __tccs_{WLA_FILENAME}_scene_halt_locals 2
.define __tccs_{WLA_FILENAME}_read_far_locals 0
.define __scene_boot_id_locals 8
.define __scene_load_locals 24
.define __scene_collision_locals 4
.SECTION ".tccs_{WLA_FILENAME}_make_fartext_0x0" SUPERFREE
tccs_{WLA_FILENAME}_make_far:
.ifgr __tccs_{WLA_FILENAME}_make_far_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_make_far_locals
tas
.endif
stz.b tcc__r0h
tsa
clc
adc #(-4 + __tccs_{WLA_FILENAME}_make_far_locals + 1)
sta.b tcc__r0
sta -8 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
lda.b tcc__r0h
sta -6 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
lda -8 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0h
lda 4 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -6 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0h
lda -8 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
inc a
sta.b tcc__r0
lda 4 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
xba
and #$00ff
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -6 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0h
lda -8 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b [tcc__r0]
rep #$20
lda -8 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0
lda -6 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
lda -4 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0
lda -2 + __tccs_{WLA_FILENAME}_make_far_locals + 1,s
sta.b tcc__r0h
__local_0:
.ifgr __tccs_{WLA_FILENAME}_make_far_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_make_far_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_rle_decodetext_0x1" SUPERFREE
tccs_{WLA_FILENAME}_rle_decode:
.ifgr __tccs_{WLA_FILENAME}_rle_decode_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_rle_decode_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
__local_4:
lda -2 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
sta.b tcc__r0
lda 11 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
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
brl __local_1
+
lda 9 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
sta.b tcc__r0h
lda 7 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta 7 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
lda.b tcc__r0h
sta 9 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sep #$20
sta -3 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
rep #$20
lda 9 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
sta.b tcc__r0h
lda 7 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta 7 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
lda.b tcc__r0h
sta 9 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r0
sep #$20
sta -4 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
rep #$20
__local_3:
lda.w #0
sep #$20
lda -3 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta -3 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
rep #$20
lda.b tcc__r1 ; DON'T OPTIMIZE
bne +
brl __local_2
+
lda -2 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
lda 3 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r1
sta.b tcc__r0
lda.w #0
sep #$20
lda -4 + __tccs_{WLA_FILENAME}_rle_decode_locals + 1,s
rep #$20
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
jmp.w __local_3
__local_2:
jmp.w __local_4
__local_1:
.ifgr __tccs_{WLA_FILENAME}_rle_decode_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_rle_decode_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_scene_halttext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_scene_halt:
.ifgr __tccs_{WLA_FILENAME}_scene_halt_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_scene_halt_locals
tas
.endif
lda.w #31
sta -2 + __tccs_{WLA_FILENAME}_scene_halt_locals + 1,s
sep #$20
lda #15
pha
rep #$20
jsr.l setBrightness
tsa
clc
adc #1
tas
pea.w 2
pea.w 0
stz.b tcc__r0h
tsa
clc
adc #(2 + __tccs_{WLA_FILENAME}_scene_halt_locals + 1)
pei (tcc__r0h)
pha
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
__local_5:
bra __local_5
.ifgr __tccs_{WLA_FILENAME}_scene_halt_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_scene_halt_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_read_fartext_0x3" SUPERFREE
tccs_{WLA_FILENAME}_read_far:
.ifgr __tccs_{WLA_FILENAME}_read_far_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_read_far_locals
tas
.endif
lda 3 + __tccs_{WLA_FILENAME}_read_far_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_read_far_locals + 1,s
sta.b tcc__r0h
lda 5 + __tccs_{WLA_FILENAME}_read_far_locals + 1,s
sta.b tcc__r1h
lda 3 + __tccs_{WLA_FILENAME}_read_far_locals + 1,s
inc a
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r2
lda 5 + __tccs_{WLA_FILENAME}_read_far_locals + 1,s
sta.b tcc__r1h
lda 3 + __tccs_{WLA_FILENAME}_read_far_locals + 1,s
inc a
inc a
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
xba
and #$ff00
ora.b tcc__r2
pha
lda.w #0
sep #$20
lda.b [tcc__r0]
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_make_far
tsa
clc
adc #3
tas
__local_6:
.ifgr __tccs_{WLA_FILENAME}_read_far_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_read_far_locals
tas
.endif
rtl
.ENDS
.SECTION ".scene_boot_idtext_0x4" SUPERFREE
scene_boot_id:
.ifgr __scene_boot_id_locals 0
tsa
sec
sbc #__scene_boot_id_locals
tas
.endif
pea.w 32768
sep #$20
lda #130
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_make_far
tsa
clc
adc #3
tas
lda.b tcc__r0
sta -4 + __scene_boot_id_locals + 1,s
lda.b tcc__r0h
sta -2 + __scene_boot_id_locals + 1,s
sta.b tcc__r0h
lda -4 + __scene_boot_id_locals + 1,s
inc a
inc a
sta.b tcc__r0
sta -8 + __scene_boot_id_locals + 1,s
lda.b tcc__r0h
sta -6 + __scene_boot_id_locals + 1,s
lda -8 + __scene_boot_id_locals + 1,s
sta.b tcc__r10
lda -6 + __scene_boot_id_locals + 1,s
sta.b tcc__r10h
lda.w #0
sep #$20
lda.b [tcc__r10]
rep #$20
sta.b tcc__r0
__local_7:
.ifgr __scene_boot_id_locals 0
tsa
clc
adc #__scene_boot_id_locals
tas
.endif
rtl
.ENDS
.SECTION ".scene_loadtext_0x5" SUPERFREE
scene_load:
.ifgr __scene_load_locals 0
tsa
sec
sbc #__scene_load_locals
tas
.endif
pea.w 32768
sep #$20
lda #130
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_make_far
tsa
clc
adc #3
tas
lda.b tcc__r0
sta -4 + __scene_load_locals + 1,s
lda.b tcc__r0h
sta -2 + __scene_load_locals + 1,s
lda -4 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -2 + __scene_load_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda -2 + __scene_load_locals + 1,s
sta.b tcc__r0h
lda -4 + __scene_load_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
xba
and #$ff00
sta.b tcc__r2
ora.b tcc__r1
sta -6 + __scene_load_locals + 1,s
lda.w #0
sep #$20
lda 3 + __scene_load_locals + 1,s
rep #$20
sta.b tcc__r0
lda -6 + __scene_load_locals + 1,s
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
brl __local_8
+
jsr.l tccs_{WLA_FILENAME}_scene_halt
__local_8:
lda -4 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -2 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda.w #0
sep #$20
lda 3 + __scene_load_locals + 1,s
rep #$20
asl a
asl a
sta.b tcc__r1
clc
adc.b tcc__r0
sta.b tcc__r0
sta -12 + __scene_load_locals + 1,s
lda.b tcc__r0h
sta -10 + __scene_load_locals + 1,s
lda -12 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -10 + __scene_load_locals + 1,s
sta.b tcc__r0h
lda -10 + __scene_load_locals + 1,s
sta.b tcc__r1h
lda -12 + __scene_load_locals + 1,s
inc a
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
sta.b tcc__r2
lda -10 + __scene_load_locals + 1,s
sta.b tcc__r1h
lda -12 + __scene_load_locals + 1,s
inc a
inc a
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r1]
rep #$20
xba
and #$ff00
ora.b tcc__r2
pha
lda.w #0
sep #$20
lda.b [tcc__r0]
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_make_far
tsa
clc
adc #3
tas
lda.b tcc__r0
sta -16 + __scene_load_locals + 1,s
lda.b tcc__r0h
sta -14 + __scene_load_locals + 1,s
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
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
brl __local_9
+
jsr.l tccs_{WLA_FILENAME}_scene_halt
__local_9:
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w scene_ctx + 0
rep #$20
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
lda -16 + __scene_load_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w scene_ctx + 1
rep #$20
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w scene_ctx + 2
rep #$20
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #10
pei (tcc__r0h)
pha
jsr.l tccs_{WLA_FILENAME}_read_far
tsa
clc
adc #4
tas
lda.b tcc__r0
sta.w scene_ctx + 16
lda.b tcc__r0h
sta.w scene_ctx + 16 + 2
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #13
pei (tcc__r0h)
pha
jsr.l tccs_{WLA_FILENAME}_read_far
tsa
clc
adc #4
tas
lda.b tcc__r0
sta.w scene_ctx + 20
lda.b tcc__r0h
sta.w scene_ctx + 20 + 2
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #16
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w scene_ctx + 3
rep #$20
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #17
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w scene_ctx + 33
rep #$20
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #18
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w scene_ctx + 34
rep #$20
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
lda -16 + __scene_load_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w scene_ctx + 30
rep #$20
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #19
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w scene_ctx + 29
rep #$20
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #20
pei (tcc__r0h)
pha
jsr.l tccs_{WLA_FILENAME}_read_far
tsa
clc
adc #4
tas
lda.b tcc__r0
sta.w scene_ctx + 24
lda.b tcc__r0h
sta.w scene_ctx + 24 + 2
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #23
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w scene_ctx + 28
rep #$20
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #27
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
sep #$20
sta.w scene_ctx + 31
rep #$20
lda.w #0
sep #$20
lda 3 + __scene_load_locals + 1,s
sta.w scene_ctx + 32
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta -18 + __scene_load_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -20 + __scene_load_locals + 1,s
__local_12:
lda.w #0
sep #$20
lda.w scene_ctx + 2
rep #$20
sta.b tcc__r0
lda -20 + __scene_load_locals + 1,s
sta.b tcc__r1
ldx #1
sec
sbc.b tcc__r0
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_10
+
bra __local_11
__local_13:
lda -20 + __scene_load_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -20 + __scene_load_locals + 1,s
bra __local_12
__local_11:
lda -20 + __scene_load_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_row_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_row_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda -18 + __scene_load_locals + 1,s
sta.b [tcc__r1]
lda.w #0
sep #$20
lda.w scene_ctx + 1
rep #$20
sta.b tcc__r0
lda -18 + __scene_load_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r1
sta -18 + __scene_load_locals + 1,s
bra __local_13
__local_10:
lda.w #0
sep #$20
lda.w scene_ctx + 1
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w scene_ctx + 2
rep #$20
sta.b tcc__r1
sta.b tcc__r9
lda.b tcc__r0
sta.b tcc__r10
jsr.l tcc__mul
sta -22 + __scene_load_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #8192
tay
beq +
bcs ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_14
+
jsr.l tccs_{WLA_FILENAME}_scene_halt
__local_14:
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
pei (tcc__r0h)
pha
jsr.l tccs_{WLA_FILENAME}_read_far
tsa
clc
adc #4
tas
lda -22 + __scene_load_locals + 1,s
pha
pei (tcc__r0h)
pei (tcc__r0)
pea.w :scn_lower
pea.w scn_lower + 0
jsr.l tccs_{WLA_FILENAME}_rle_decode
tsa
clc
adc #10
tas
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #7
pei (tcc__r0h)
pha
jsr.l tccs_{WLA_FILENAME}_read_far
tsa
clc
adc #4
tas
lda -22 + __scene_load_locals + 1,s
pha
pei (tcc__r0h)
pei (tcc__r0)
pea.w :scn_col
pea.w scn_col + 0
jsr.l tccs_{WLA_FILENAME}_rle_decode
tsa
clc
adc #10
tas
lda -16 + __scene_load_locals + 1,s
sta.b tcc__r0
lda -14 + __scene_load_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #24
pei (tcc__r0h)
pha
jsr.l tccs_{WLA_FILENAME}_read_far
tsa
clc
adc #4
tas
lda -22 + __scene_load_locals + 1,s
pha
pei (tcc__r0h)
pei (tcc__r0)
pea.w :scn_upper
pea.w scn_upper + 0
jsr.l tccs_{WLA_FILENAME}_rle_decode
tsa
clc
adc #10
tas
lda.w #:scn_lower
sta.b tcc__r0h
lda.w #scn_lower + 0
sta.b tcc__r0
sta.w scene_ctx + 4
lda.b tcc__r0h
sta.w scene_ctx + 4 + 2
lda.w #:scn_col
sta.b tcc__r0h
lda.w #scn_col + 0
sta.b tcc__r0
sta.w scene_ctx + 12
lda.b tcc__r0h
sta.w scene_ctx + 12 + 2
lda.w #:scn_upper
sta.b tcc__r0h
lda.w #scn_upper + 0
sta.b tcc__r0
sta.w scene_ctx + 8
lda.b tcc__r0h
sta.w scene_ctx + 8 + 2
lda.w #0
sep #$20
lda.w scene_ctx + 30
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:gfx_chars
sta.b tcc__r1h
lda.w #gfx_chars + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.w scene_ctx + 30
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:gfx_pals
sta.b tcc__r2h
lda.w #gfx_pals + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.w scene_ctx + 30
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:gfx_chars_sizes
sta.b tcc__r3h
lda.w #gfx_chars_sizes + 0
clc
adc.b tcc__r0
sta.b tcc__r3
ldy #0
lda.b [tcc__r3],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r3],y
sta.b tcc__r0h
pea.w 8192
pea.w 16
pea.w 256
lda.b [tcc__r0]
pha
sep #$20
lda #0
pha
rep #$20
ldy #0
lda.b [tcc__r2],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r2],y
pha
pei (tcc__r0)
ldy #0
lda.b [tcc__r1],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r1],y
pha
pei (tcc__r0)
sep #$20
lda #0
pha
rep #$20
jsr.l bgInitTileSet
tsa
clc
adc #18
tas
stz.b tcc__r0
lda.b tcc__r0
sta -24 + __scene_load_locals + 1,s
pea.w 2
pea.w 0
stz.b tcc__r0h
tsa
clc
adc #(-20 + __scene_load_locals + 1)
pei (tcc__r0h)
pha
jsr.l dmaCopyCGram
tsa
clc
adc #8
tas
sep #$20
lda #3
pha
rep #$20
pea.w 0
sep #$20
lda #0
pha
rep #$20
jsr.l bgSetMapPtr
tsa
clc
adc #4
tas
pea.w 8192
sep #$20
lda #1
pha
rep #$20
jsr.l bgSetGfxPtr
tsa
clc
adc #3
tas
sep #$20
lda #3
pha
rep #$20
pea.w 24576
sep #$20
lda #1
pha
rep #$20
jsr.l bgSetMapPtr
tsa
clc
adc #4
tas
lda.w #0
sep #$20
lda.w scene_ctx + 30
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:gfx_metas
sta.b tcc__r1h
lda.w #gfx_metas + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda.w scene_ctx + 30
rep #$20
asl a
asl a
sta.b tcc__r0
lda.w #:gfx_prios
sta.b tcc__r2h
lda.w #gfx_prios + 0
clc
adc.b tcc__r0
sta.b tcc__r2
ldy #0
lda.b [tcc__r2],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r2],y
pha
pei (tcc__r0)
ldy #0
lda.b [tcc__r1],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r1],y
pha
pei (tcc__r0)
jsr.l map_set_metatiles
tsa
clc
adc #8
tas
lda.w #0
sep #$20
lda 3 + __scene_load_locals + 1,s
pha
rep #$20
jsr.l effect_load
tsa
clc
adc #1
tas
lda.w #0
sep #$20
lda 3 + __scene_load_locals + 1,s
pha
rep #$20
jsr.l tileanim_init
tsa
clc
adc #1
tas
.ifgr __scene_load_locals 0
tsa
clc
adc #__scene_load_locals
tas
.endif
rtl
.ENDS
.SECTION ".scene_collisiontext_0x6" SUPERFREE
scene_collision:
.ifgr __scene_collision_locals 0
tsa
sec
sbc #__scene_collision_locals
tas
.endif
lda.w #0
sep #$20
lda 4 + __scene_collision_locals + 1,s
rep #$20
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_col_row_ofs
sta.b tcc__r1h
lda.w #tccs_{WLA_FILENAME}_col_row_ofs + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda 3 + __scene_collision_locals + 1,s
rep #$20
sta.b tcc__r0
lda.b [tcc__r1]
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w scene_ctx + 12
sta.b tcc__r0
lda.w scene_ctx + 12 + 2
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.b tcc__r2
sta.b tcc__r0
sta -4 + __scene_collision_locals + 1,s
lda.b tcc__r0h
sta -2 + __scene_collision_locals + 1,s
lda -4 + __scene_collision_locals + 1,s
sta.b tcc__r10
lda -2 + __scene_collision_locals + 1,s
sta.b tcc__r10h
lda.w #0
sep #$20
lda.b [tcc__r10]
rep #$20
sta.b tcc__r0
__local_15:
.ifgr __scene_collision_locals 0
tsa
clc
adc #__scene_collision_locals
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
scene_ctx dsb 36
tccs_{WLA_FILENAME}_col_row_ofs dsb 512
.ENDS
