; wram7f.asm — grilles de scène décompressées, en WRAM bank $7F.
;
; POURQUOI ICI ET PAS EN C : le .bss de tcc-816 vit dans le SLOT 2 (bank
; $7E, $2000-$FFFF) tandis que PVSnesLib pose SES variables (dont
; oamMemory) dans le SLOT 0 de la même bank ($8000-$FFFF). WLA alloue les
; deux slots INDÉPENDAMMENT : un .bss qui dépasse $7E:8000 recouvre
; silencieusement l'OAM shadow — sprites fantômes, limite de 32 sprites
; par ligne saturée, PNJ coupés en haut d'écran. Aucun message du linker.
;
; Les 24 Ko de grilles partent donc en bank $7F (libre), et hdr.asm borne
; désormais le SLOT 2 à $2000-$7FFF pour que tout futur dépassement casse
; le build au lieu de corrompre l'OAM. Voir docs/SPEC_FORMATS.md §6.
;
; Budget : MAP_BUF_CELLS = 8192 cellules par grille (spec §1.6), validé
; par datagen. Garder ces tailles en phase avec src/scene.c.

.include "hdr.asm"

.RAMSECTION "scenegrids" BANK $7F SLOT 3 ORGA $8000 FORCE
scn_lower dsb 8192
scn_upper dsb 8192
scn_col   dsb 8192
.ENDS
