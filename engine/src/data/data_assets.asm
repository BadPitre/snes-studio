.include "hdr.asm"
.accu 16
.index 16
.16bit
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.ENDS
.SECTION ".rodata" SUPERFREE
gfx_chars: .dw gs0_chars + 0, :gs0_chars
.dw gs1_chars + 0
.dw :gs1_chars
.dw gs2_chars + 0
.dw :gs2_chars
gfx_chars_sizes: .dw gs0_chars_size + 0, :gs0_chars_size
.dw gs1_chars_size + 0
.dw :gs1_chars_size
.dw gs2_chars_size + 0
.dw :gs2_chars_size
gfx_metas: .dw gs0_meta + 0, :gs0_meta
.dw gs1_meta + 0
.dw :gs1_meta
.dw gs2_meta + 0
.dw :gs2_meta
gfx_prios: .dw gs0_prio + 0, :gs0_prio
.dw gs1_prio + 0
.dw :gs1_prio
.dw gs2_prio + 0
.dw :gs2_prio
gfx_pals: .dw gs0_pal + 0, :gs0_pal
.dw gs1_pal + 0
.dw :gs1_pal
.dw gs2_pal + 0
.dw :gs2_pal
sprite_chars: .dw ss0_chars + 0, :ss0_chars
.dw ss1_chars + 0
.dw :ss1_chars
sprite_chars_sizes: .dw ss0_chars_size + 0, :ss0_chars_size
.dw ss1_chars_size + 0
.dw :ss1_chars_size
sprite_pals: .dw ss0_pal + 0, :ss0_pal
.dw ss1_pal + 0
.dw :ss1_pal
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
.ENDS
.SECTION ".rel.rodata" SUPERFREE

.db $0,$0,$0,$0,$1,$3,$0,$0,$4,$0,$0,$0,$1,$4,$0,$0,$8,$0,$0,$0,$1,$5,$0,$0,$c,$0,$0,$0,$1,$7,$0,$0,$10,$0,$0,$0,$1,$8,$0,$0,$14,$0,$0,$0,$1,$9,$0,$0,$18,$0,$0,$0,$1,$b,$0,$0,$1c,$0,$0,$0,$1,$c,$0,$0,$20,$0,$0,$0,$1,$d,$0,$0,$24,$0,$0,$0,$1,$f,$0,$0,$28,$0,$0,$0,$1,$10,$0,$0,$2c,$0,$0,$0,$1,$11,$0,$0,$30,$0,$0,$0,$1,$13,$0,$0,$34,$0,$0,$0,$1,$14,$0,$0,$38,$0,$0,$0,$1,$15,$0,$0,$3c,$0,$0,$0,$1,$17,$0,$0,$40,$0,$0,$0,$1,$18,$0,$0,$44,$0,$0,$0,$1,$1a,$0,$0,$48,$0,$0,$0,$1,$1b,$0,$0,$4c,$0,$0,$0,$1,$1d,$0,$0,$50,$0,$0,$0,$1,$1e,$0,$0
.ENDS

