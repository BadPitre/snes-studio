; wram7f.asm — the decompressed scene grids, in WRAM bank $7F.
;
; WHY HERE AND NOT IN C: tcc-816's .bss lives in SLOT 2 (bank $7E,
; $2000-$FFFF) while PVSnesLib puts ITS OWN variables (oamMemory among
; them) in SLOT 0 of the same bank ($8000-$FFFF). WLA allocates the two
; slots INDEPENDENTLY: a .bss running past $7E:8000 silently overwrites
; the OAM shadow — ghost sprites, the 32-sprites-per-line limit
; saturated, NPCs cut off at the top of the screen. Not a word from the
; linker.
;
; So the 24 KB of grids go into bank $7F (free), and hdr.asm now bounds
; SLOT 2 to $2000-$7FFF so that any future overflow breaks the build
; instead of corrupting the OAM. See docs/SPEC_FORMATS.md §6.
;
; Budget: MAP_BUF_CELLS = 8192 cells per grid (spec §1.6), validated by
; datagen. Keep these sizes in step with src/scene.c.

.include "hdr.asm"

.RAMSECTION "scenegrids" BANK $7F SLOT 3 ORGA $8000 FORCE
scn_lower dsb 8192
scn_upper dsb 8192
scn_col   dsb 8192
.ENDS
