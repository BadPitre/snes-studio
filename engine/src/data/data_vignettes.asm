.include "hdr.asm"
.accu 16
.index 16
.16bit
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.ENDS
.SECTION ".rodata" SUPERFREE
vig_count: .db $2
vig_frames: .db $2,$4,$0
vig_chars: .dw vig0_chars + 0, :vig0_chars
.dw vig1_chars + 0
.dw :vig1_chars
vig_pals: .dw vig0_pal + 0, :vig0_pal
.dw vig1_pal + 0
.dw :vig1_pal
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
.ENDS
.SECTION ".rel.rodata" SUPERFREE

.db $4,$0,$0,$0,$1,$5,$0,$0,$8,$0,$0,$0,$1,$6,$0,$0,$c,$0,$0,$0,$1,$8,$0,$0,$10,$0,$0,$0,$1,$9,$0,$0
.ENDS

