.include "hdr.asm"
.accu 16
.index 16
.16bit
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.ENDS
.SECTION ".rodata" SUPERFREE
ta_first: .db $0,$1,$1,$1
ta_ffirst: .db $0,$3
ta_mode: .db $1
ta_speed: .db $16
ta_dest: .db $13,$0,$14,$0,$15,$0,$16,$0
ta_src: .db $13,$0,$14,$0,$15,$0,$16,$0,$17,$0,$18,$0,$19,$0,$1a,$0,$17,$0,$14,$0,$1b,$0,$1c,$0
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
.ENDS
