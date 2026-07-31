.include "hdr.asm"
.accu 16
.index 16
.16bit
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.ENDS
.SECTION ".rodata" SUPERFREE
ui_st_mx: .db $0
ui_st_my: .db $14
ui_st_mw: .db $20
ui_st_mh: .db $8
ui_st_cx: .db $0
ui_st_cy: .db $14
ui_st_cw: .db $20
ui_st_ch: .db $8
ui_st_font: .db $1
ui_st_skin: .db $61
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
.ENDS
