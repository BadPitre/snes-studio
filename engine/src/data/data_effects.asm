.include "hdr.asm"
.accu 16
.index 16
.16bit
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.ENDS
.SECTION ".rodata" SUPERFREE
eff_pic: .db $ff,$ff,$ff
eff_blend: .db $0,$0,$0
eff_par: .db $0,$0,$0,$0
eff_dx: .db $0,$0,$0,$0,$0,$0
eff_dy: .db $0,$0,$0,$0,$0,$0
eff_mode: .db $0,$0,$0
eff_repeat: .db $1,$1,$1
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
.ENDS
