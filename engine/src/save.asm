.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __tccs_{WLA_FILENAME}_make_far_locals 8
.define __tccs_{WLA_FILENAME}_slot_base_locals 0
.define __tccs_{WLA_FILENAME}_slot_checksum_locals 4
.define __save_exists_locals 6
.define __save_write_locals 8
.define __save_read_locals 6
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
.SECTION ".tccs_{WLA_FILENAME}_slot_basetext_0x1" SUPERFREE
tccs_{WLA_FILENAME}_slot_base:
.ifgr __tccs_{WLA_FILENAME}_slot_base_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_slot_base_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __tccs_{WLA_FILENAME}_slot_base_locals + 1,s
rep #$20
sta.b tcc__r0
ldy.w #11
-
asl a
dey
bne -
+
pha
sep #$20
lda #112
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_make_far
tsa
clc
adc #3
tas
__local_1:
.ifgr __tccs_{WLA_FILENAME}_slot_base_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_slot_base_locals
tas
.endif
rtl
.ENDS
.SECTION ".tccs_{WLA_FILENAME}_slot_checksumtext_0x2" SUPERFREE
tccs_{WLA_FILENAME}_slot_checksum:
.ifgr __tccs_{WLA_FILENAME}_slot_checksum_locals 0
tsa
sec
sbc #__tccs_{WLA_FILENAME}_slot_checksum_locals
tas
.endif
stz.b tcc__r0
lda.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_slot_checksum_locals + 1,s
stz.b tcc__r0
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_slot_checksum_locals + 1,s
__local_4:
lda -4 + __tccs_{WLA_FILENAME}_slot_checksum_locals + 1,s
sta.b tcc__r0
ldx #1
sec
sbc.w #648
tay
bcc ++
+ dex
++
stx.b tcc__r5
txa
bne +
brl __local_2
+
bra __local_3
__local_5:
lda -4 + __tccs_{WLA_FILENAME}_slot_checksum_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -4 + __tccs_{WLA_FILENAME}_slot_checksum_locals + 1,s
bra __local_4
__local_3:
lda 3 + __tccs_{WLA_FILENAME}_slot_checksum_locals + 1,s
sta.b tcc__r0
lda 5 + __tccs_{WLA_FILENAME}_slot_checksum_locals + 1,s
sta.b tcc__r0h
lda -4 + __tccs_{WLA_FILENAME}_slot_checksum_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
lda -2 + __tccs_{WLA_FILENAME}_slot_checksum_locals + 1,s
clc
adc.b tcc__r1
sta.b tcc__r0
sta -2 + __tccs_{WLA_FILENAME}_slot_checksum_locals + 1,s
bra __local_5
__local_2:
lda -2 + __tccs_{WLA_FILENAME}_slot_checksum_locals + 1,s
sta.b tcc__r0
__local_6:
.ifgr __tccs_{WLA_FILENAME}_slot_checksum_locals 0
tsa
clc
adc #__tccs_{WLA_FILENAME}_slot_checksum_locals
tas
.endif
rtl
.ENDS
.SECTION ".save_existstext_0x3" SUPERFREE
save_exists:
.ifgr __save_exists_locals 0
tsa
sec
sbc #__save_exists_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __save_exists_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_slot_base
tsa
clc
adc #1
tas
lda.b tcc__r0
sta -4 + __save_exists_locals + 1,s
lda.b tcc__r0h
sta -2 + __save_exists_locals + 1,s
lda -4 + __save_exists_locals + 1,s
sta.b tcc__r0
lda -2 + __save_exists_locals + 1,s
sta.b tcc__r0h
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc #83
tay
bne +
dex
+
stx.b tcc__r5
txa
beq +
brl __local_7
+
lda -2 + __save_exists_locals + 1,s
sta.b tcc__r0h
lda -4 + __save_exists_locals + 1,s
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc #71
tay
bne +
dex
+
stx.b tcc__r5
txa
beq +
__local_7:
brl __local_8
+
lda -2 + __save_exists_locals + 1,s
sta.b tcc__r0h
lda -4 + __save_exists_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r1
ldx #1
sec
sbc #2
tay
bne +
dex
+
stx.b tcc__r5
txa
beq +
__local_8:
brl __local_9
+
bra __local_10
__local_9:
lda.w #0
sta.b tcc__r0
jmp.w __local_11
__local_10:
lda -4 + __save_exists_locals + 1,s
sta.b tcc__r0
lda -2 + __save_exists_locals + 1,s
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_slot_checksum
tsa
clc
adc #4
tas
lda.b tcc__r0
sta -6 + __save_exists_locals + 1,s
lda -4 + __save_exists_locals + 1,s
sta.b tcc__r0
lda -2 + __save_exists_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #648
sta.b tcc__r0
lda -6 + __save_exists_locals + 1,s
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r2
ldx #1
sec
sbc.b tcc__r1
tay
beq +
dex
+
stx.b tcc__r5
txa
bne +
brl __local_12
+
lda -4 + __save_exists_locals + 1,s
sta.b tcc__r0
lda -2 + __save_exists_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #649
sta.b tcc__r0
lda -6 + __save_exists_locals + 1,s
xba
and #$00ff
and.w #255
sta.b tcc__r1
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r2
ldx #1
sec
sbc.b tcc__r1
tay
beq +
dex
+
stx.b tcc__r5
txa
bne +
__local_12:
brl __local_13
+
lda #1
bra +
__local_13:
lda #0
+
and.w #255
sta.b tcc__r0
__local_11:
__local_14:
.ifgr __save_exists_locals 0
tsa
clc
adc #__save_exists_locals
tas
.endif
rtl
.ENDS
.SECTION ".save_writetext_0x4" SUPERFREE
save_write:
.ifgr __save_write_locals 0
tsa
sec
sbc #__save_write_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __save_write_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_slot_base
tsa
clc
adc #1
tas
lda.b tcc__r0
sta -4 + __save_write_locals + 1,s
lda.b tcc__r0h
sta -2 + __save_write_locals + 1,s
lda -4 + __save_write_locals + 1,s
sta.b tcc__r0
lda -2 + __save_write_locals + 1,s
sta.b tcc__r0h
lda.w #83
sep #$20
sta.b [tcc__r0]
rep #$20
lda -2 + __save_write_locals + 1,s
sta.b tcc__r0h
lda -4 + __save_write_locals + 1,s
inc a
sta.b tcc__r0
lda.w #71
sep #$20
sta.b [tcc__r0]
rep #$20
lda -2 + __save_write_locals + 1,s
sta.b tcc__r0h
lda -4 + __save_write_locals + 1,s
inc a
inc a
sta.b tcc__r0
lda.w #2
sep #$20
sta.b [tcc__r0]
rep #$20
lda -4 + __save_write_locals + 1,s
sta.b tcc__r0
lda -2 + __save_write_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sep #$20
lda.l scene_ctx + 32
sta.b [tcc__r0]
rep #$20
lda -4 + __save_write_locals + 1,s
sta.b tcc__r0
lda -2 + __save_write_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda.l player + 0
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -4 + __save_write_locals + 1,s
sta.b tcc__r0
lda -2 + __save_write_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #5
sta.b tcc__r0
lda.l player + 2
lsr a
lsr a
lsr a
lsr a
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -4 + __save_write_locals + 1,s
sta.b tcc__r0
lda -2 + __save_write_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #6
sta.b tcc__r0
lda.w #0
sep #$20
lda.l player + 4
sta.b [tcc__r0]
rep #$20
lda -4 + __save_write_locals + 1,s
sta.b tcc__r0
lda -2 + __save_write_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #7
sta.b tcc__r0
lda.w #0
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta -8 + __save_write_locals + 1,s
__local_17:
lda -8 + __save_write_locals + 1,s
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
brl __local_15
+
bra __local_16
__local_18:
lda -8 + __save_write_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -8 + __save_write_locals + 1,s
bra __local_17
__local_16:
lda -8 + __save_write_locals + 1,s
clc
adc.w #8
sta.b tcc__r0
lda -4 + __save_write_locals + 1,s
sta.b tcc__r1
lda -2 + __save_write_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
lda.w #:vm
sta.b tcc__r0h
lda.w #vm + 68
sta.b tcc__r0
lda -8 + __save_write_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.b [tcc__r1]
rep #$20
lda -8 + __save_write_locals + 1,s
clc
adc.w #72
sta.b tcc__r0
lda -4 + __save_write_locals + 1,s
sta.b tcc__r1
lda -2 + __save_write_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
lda.w #:vm
sta.b tcc__r0h
lda.w #vm + 132
sta.b tcc__r0
lda -8 + __save_write_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
rep #$20
sta.b tcc__r2
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_18
__local_15:
stz.b tcc__r0
lda.b tcc__r0
sta -8 + __save_write_locals + 1,s
__local_21:
lda -8 + __save_write_locals + 1,s
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
brl __local_19
+
bra __local_20
__local_22:
lda -8 + __save_write_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -8 + __save_write_locals + 1,s
bra __local_21
__local_20:
lda -8 + __save_write_locals + 1,s
asl a
clc
adc.w #136
sta.b tcc__r0
lda -4 + __save_write_locals + 1,s
sta.b tcc__r1
lda -2 + __save_write_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
lda -8 + __save_write_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r2h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r2
lda.b [tcc__r2]
and.w #255
sep #$20
sta.b [tcc__r1]
rep #$20
lda -8 + __save_write_locals + 1,s
asl a
clc
adc.w #137
sta.b tcc__r0
lda -4 + __save_write_locals + 1,s
sta.b tcc__r1
lda -2 + __save_write_locals + 1,s
sta.b tcc__r1h
clc
lda.b tcc__r1
adc.b tcc__r0
sta.b tcc__r1
lda -8 + __save_write_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r2h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r2
lda.b [tcc__r2]
xba
and #$00ff
and.w #255
sta.b tcc__r0
sep #$20
sta.b [tcc__r1]
rep #$20
jmp.w __local_22
__local_19:
lda -4 + __save_write_locals + 1,s
sta.b tcc__r0
lda -2 + __save_write_locals + 1,s
pha
pei (tcc__r0)
jsr.l tccs_{WLA_FILENAME}_slot_checksum
tsa
clc
adc #4
tas
lda.b tcc__r0
sta -6 + __save_write_locals + 1,s
lda -4 + __save_write_locals + 1,s
sta.b tcc__r0
lda -2 + __save_write_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #648
sta.b tcc__r0
lda -6 + __save_write_locals + 1,s
and.w #255
sep #$20
sta.b [tcc__r0]
rep #$20
lda -4 + __save_write_locals + 1,s
sta.b tcc__r0
lda -2 + __save_write_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #649
sta.b tcc__r0
lda -6 + __save_write_locals + 1,s
xba
and #$00ff
and.w #255
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
.ifgr __save_write_locals 0
tsa
clc
adc #__save_write_locals
tas
.endif
rtl
.ENDS
.SECTION ".save_readtext_0x5" SUPERFREE
save_read:
.ifgr __save_read_locals 0
tsa
sec
sbc #__save_read_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __save_read_locals + 1,s
pha
rep #$20
jsr.l tccs_{WLA_FILENAME}_slot_base
tsa
clc
adc #1
tas
lda.b tcc__r0
sta -4 + __save_read_locals + 1,s
lda.b tcc__r0h
sta -2 + __save_read_locals + 1,s
lda.w #0
sep #$20
lda 3 + __save_read_locals + 1,s
pha
rep #$20
jsr.l save_exists
tsa
clc
adc #1
tas
lda.b tcc__r0 ; DON'T OPTIMIZE
bne +
brl __local_23
+
bra __local_24
__local_23:
lda.w #0
sta.b tcc__r0
jmp.w __local_25
__local_24:
lda -4 + __save_read_locals + 1,s
sta.b tcc__r0
lda -2 + __save_read_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #3
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w save_info + 0
rep #$20
lda -4 + __save_read_locals + 1,s
sta.b tcc__r0
lda -2 + __save_read_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #4
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w save_info + 1
rep #$20
lda -4 + __save_read_locals + 1,s
sta.b tcc__r0
lda -2 + __save_read_locals + 1,s
sta.b tcc__r0h
clc
lda.b tcc__r0
adc.w #5
sta.b tcc__r0
lda.w #0
sep #$20
lda.b [tcc__r0]
sta.w save_info + 2
rep #$20
lda -4 + __save_read_locals + 1,s
sta.b tcc__r0
lda -2 + __save_read_locals + 1,s
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
sta.w save_info + 3
rep #$20
stz.b tcc__r0
lda.b tcc__r0
sta -6 + __save_read_locals + 1,s
__local_28:
lda -6 + __save_read_locals + 1,s
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
brl __local_26
+
bra __local_27
__local_29:
lda -6 + __save_read_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -6 + __save_read_locals + 1,s
bra __local_28
__local_27:
lda.w #:vm
sta.b tcc__r0h
lda.w #vm + 68
sta.b tcc__r0
lda -6 + __save_read_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda -6 + __save_read_locals + 1,s
clc
adc.w #8
sta.b tcc__r1
lda -4 + __save_read_locals + 1,s
sta.b tcc__r2
lda -2 + __save_read_locals + 1,s
sta.b tcc__r2h
clc
lda.b tcc__r2
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
sta.b [tcc__r0]
rep #$20
lda.w #:vm
sta.b tcc__r0h
lda.w #vm + 132
sta.b tcc__r0
lda -6 + __save_read_locals + 1,s
clc
adc.b tcc__r0
sta.b tcc__r0
lda -6 + __save_read_locals + 1,s
clc
adc.w #72
sta.b tcc__r1
lda -4 + __save_read_locals + 1,s
sta.b tcc__r2
lda -2 + __save_read_locals + 1,s
sta.b tcc__r2h
clc
lda.b tcc__r2
adc.b tcc__r1
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r1
sep #$20
sta.b [tcc__r0]
rep #$20
jmp.w __local_29
__local_26:
stz.b tcc__r0
lda.b tcc__r0
sta -6 + __save_read_locals + 1,s
__local_32:
lda -6 + __save_read_locals + 1,s
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
brl __local_30
+
bra __local_31
__local_33:
lda -6 + __save_read_locals + 1,s
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
inc.b tcc__r0
lda.b tcc__r0
sta -6 + __save_read_locals + 1,s
bra __local_32
__local_31:
lda -6 + __save_read_locals + 1,s
asl a
sta.b tcc__r0
lda.w #:vm
sta.b tcc__r1h
lda.w #vm + 196
clc
adc.b tcc__r0
sta.b tcc__r1
lda -6 + __save_read_locals + 1,s
asl a
clc
adc.w #136
sta.b tcc__r0
lda -4 + __save_read_locals + 1,s
sta.b tcc__r2
lda -2 + __save_read_locals + 1,s
sta.b tcc__r2h
clc
lda.b tcc__r2
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda.b [tcc__r2]
rep #$20
sta.b tcc__r0
lda -6 + __save_read_locals + 1,s
asl a
clc
adc.w #137
sta.b tcc__r2
lda -4 + __save_read_locals + 1,s
sta.b tcc__r3
lda -2 + __save_read_locals + 1,s
sta.b tcc__r3h
clc
lda.b tcc__r3
adc.b tcc__r2
sta.b tcc__r3
lda.w #0
sep #$20
lda.b [tcc__r3]
rep #$20
xba
and #$ff00
sta.b tcc__r2
ora.b tcc__r0
sta.b tcc__r0
sta.b [tcc__r1]
jmp.w __local_33
__local_30:
lda.w #1
sta.b tcc__r0
__local_25:
__local_34:
.ifgr __save_read_locals 0
tsa
clc
adc #__save_read_locals
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
save_info dsb 4
.ENDS
