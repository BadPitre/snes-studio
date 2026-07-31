.include "hdr.asm"
.accu 16
.index 16
.16bit
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.ENDS
.SECTION ".rodata" SUPERFREE
dbg_enabled: .db $0
dbg_banks_txt: .db $53,$43,$4e,$20,$32,$34,$32,$33,$2f,$33,$32,$37,$36,$38,$20,$54,$58,$54,$20,$36,$30,$39,$2f,$33,$32,$37,$36,$38,$0
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
.ENDS
