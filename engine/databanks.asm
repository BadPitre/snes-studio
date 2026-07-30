; FICHIER GENERE par tools/datagen — NE PAS EDITER A LA MAIN.
; Epingle les blobs binaires dans leurs banks ROM (spec kit §3).
.include "hdr.asm"

.BANK 2 SLOT 0
.ORG 0
.SECTION "SceneBank0" FORCE
.incbin "src/data/scenes.bin"
.ENDS

.BANK 6 SLOT 0
.ORG 0
.SECTION "TextBank0" FORCE
.incbin "src/data/texts.bin"
.ENDS
