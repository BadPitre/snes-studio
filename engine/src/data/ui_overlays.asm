.include "hdr.asm"
.accu 16
.index 16
.16bit
.RAMSECTION "ram{WLA_FILENAME}.data" APPENDTO "globram.data"
.ENDS
.SECTION "{WLA_FILENAME}.data" APPENDTO "glob.data"
.ENDS
.SECTION ".rodata" SUPERFREE
ui_ov_x: .db $2,$d
ui_ov_y: .db $2,$2
ui_ov_w: .db $a,$9
ui_ov_h: .db $5,$5
ui_ov_var: .db $0,$0
ui_ov_type: .db $7,$7
ui_ov_frame: .db $1,$1
ui_ov_icon: .db $0,$0
ui_ov_dir: .db $0,$0
ui_ov_pad: .db $0,$0
ui_ov_bg: .db $0,$0
ui_ov_widget: .db $0,$1
ui_ov_maxvar: .db $ff,$ff
ui_ov_maxlo: .db $0,$0
ui_ov_maxhi: .db $0,$0
ui_ov_font: .db $1,$1
ui_widget_vis: .db $0,$0
tccs_{WLA_FILENAME}_ui_ov_l0: .db $41,$74,$74,$61,$71,$75,$65,$a,$4f,$62,$6a,$65,$74,$a,$46,$75,$69,$74,$65,$0
tccs_{WLA_FILENAME}_ui_ov_l1: .db $46,$65,$75,$a,$53,$6f,$69,$6e,$a,$46,$6f,$75,$64,$72,$65,$0,$0,$0
ui_ov_label: .dw tccs_{WLA_FILENAME}_ui_ov_l0 + 0, :tccs_{WLA_FILENAME}_ui_ov_l0
.dw tccs_{WLA_FILENAME}_ui_ov_l1 + 0
.dw :tccs_{WLA_FILENAME}_ui_ov_l1
.ENDS


.RAMSECTION ".bss" BANK $7e SLOT 2
.ENDS
.SECTION ".rel.rodata" SUPERFREE

.db $48,$0,$0,$0,$1,$13,$0,$0,$4c,$0,$0,$0,$1,$14,$0,$0
.ENDS

