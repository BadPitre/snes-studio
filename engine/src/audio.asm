.include "hdr.asm"
.accu 16
.index 16
.16bit
.define __audio_init_locals 1
.define __audio_play_sfx_locals 0
.define __audio_play_music_locals 0
.define __audio_process_locals 0
.SECTION ".audio_inittext_0x0" SUPERFREE
audio_init:
.ifgr __audio_init_locals 0
tsa
sec
sbc #__audio_init_locals
tas
.endif
lda.w #255
sep #$20
sta.w tccs_{WLA_FILENAME}_current_music + 0
rep #$20
jsr.l spcBoot
pea.w :SOUNDBANK__
pea.w SOUNDBANK__ + 0
jsr.l spcSetBank
tsa
clc
adc #4
tas
sep #$20
lda #4
pha
rep #$20
jsr.l spcAllocateSoundRegion
tsa
clc
adc #1
tas
lda.w #2
sta.b tcc__r0
sep #$20
sta -1 + __audio_init_locals + 1,s
rep #$20
__local_2:
lda.w #0
sep #$20
lda -1 + __audio_init_locals + 1,s
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
brl __local_0
+
bra __local_1
__local_3:
lda.w #0
sep #$20
lda -1 + __audio_init_locals + 1,s
rep #$20
sta.b tcc__r0
sta.b tcc__r1
lda.b tcc__r0h
sta.b tcc__r1h
dec.b tcc__r0
sep #$20
lda.b tcc__r0
sta -1 + __audio_init_locals + 1,s
rep #$20
jmp.w __local_2
__local_1:
lda.w #0
sep #$20
lda -1 + __audio_init_locals + 1,s
rep #$20
sta.b tcc__r0
dec.b tcc__r0
asl.b tcc__r0
lda.w #:sfx_len
sta.b tcc__r1h
lda.w #sfx_len + 0
clc
adc.b tcc__r0
sta.b tcc__r1
lda.w #0
sep #$20
lda -1 + __audio_init_locals + 1,s
rep #$20
sta.b tcc__r0
dec.b tcc__r0
asl.b tcc__r0
asl.b tcc__r0
lda.w #:sfx_ptr
sta.b tcc__r2h
lda.w #sfx_ptr + 0
clc
adc.b tcc__r0
sta.b tcc__r2
lda.w #0
sep #$20
lda -1 + __audio_init_locals + 1,s
rep #$20
dec a
asl a
asl a
asl a
sta.b tcc__r0
lda.w #:tccs_{WLA_FILENAME}_sfx_tab
sta.b tcc__r3h
lda.w #tccs_{WLA_FILENAME}_sfx_tab + 0
sta.b tcc__r3
clc
adc.b tcc__r0
pei (tcc__r3h)
pha
ldy #0
lda.b [tcc__r2],y
sta.b tcc__r0
iny
iny
lda.b [tcc__r2],y
pha
pei (tcc__r0)
lda.b [tcc__r1]
pha
pea.w (4 * 256 + 8)
sep #$20
lda #15
pha
rep #$20
jsr.l spcSetSoundEntry
tsa
clc
adc #13
tas
jmp.w __local_3
__local_0:
.ifgr __audio_init_locals 0
tsa
clc
adc #__audio_init_locals
tas
.endif
rtl
.ENDS
.SECTION ".audio_play_sfxtext_0x1" SUPERFREE
audio_play_sfx:
.ifgr __audio_play_sfx_locals 0
tsa
sec
sbc #__audio_play_sfx_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __audio_play_sfx_locals + 1,s
rep #$20
sta.b tcc__r0
sec
sbc.w #2
bvc +
eor #$8000
+
bmi +
brl __local_4
+
lda.w #0
sep #$20
lda 3 + __audio_play_sfx_locals + 1,s
pha
rep #$20
jsr.l spcPlaySound
tsa
clc
adc #1
tas
__local_4:
.ifgr __audio_play_sfx_locals 0
tsa
clc
adc #__audio_play_sfx_locals
tas
.endif
rtl
.ENDS
.SECTION ".audio_play_musictext_0x2" SUPERFREE
audio_play_music:
.ifgr __audio_play_music_locals 0
tsa
sec
sbc #__audio_play_music_locals
tas
.endif
lda.w #0
sep #$20
lda 3 + __audio_play_music_locals + 1,s
rep #$20
sta.b tcc__r0
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_current_music + 0
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
brl __local_5
+
jmp.w __local_6
__local_5:
lda.w #0
sep #$20
lda.w tccs_{WLA_FILENAME}_current_music + 0
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
brl __local_7
+
jsr.l spcStop
__local_7:
lda.w #0
sep #$20
lda 3 + __audio_play_music_locals + 1,s
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
brl __local_8
+
lda.w #0
sep #$20
lda 3 + __audio_play_music_locals + 1,s
rep #$20
pha
jsr.l spcLoad
pla
sep #$20
lda #0
pha
rep #$20
jsr.l spcPlay
tsa
clc
adc #1
tas
__local_8:
lda.w #0
sep #$20
lda 3 + __audio_play_music_locals + 1,s
rep #$20
sta.b tcc__r0
sep #$20
sta.w tccs_{WLA_FILENAME}_current_music + 0
rep #$20
__local_6:
.ifgr __audio_play_music_locals 0
tsa
clc
adc #__audio_play_music_locals
tas
.endif
rtl
.ENDS
.SECTION ".audio_processtext_0x3" SUPERFREE
audio_process:
.ifgr __audio_process_locals 0
tsa
sec
sbc #__audio_process_locals
tas
.endif
jsr.l spcProcess
.ifgr __audio_process_locals 0
tsa
clc
adc #__audio_process_locals
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
tccs_{WLA_FILENAME}_sfx_tab dsb 16
tccs_{WLA_FILENAME}_current_music dsb 1
.ENDS
