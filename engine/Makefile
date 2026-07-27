ifeq ($(strip $(PVSNESLIB_HOME)),)
$(error "Please create an environment variable PVSNESLIB_HOME by following this guide: https://github.com/alekmaul/pvsneslib/wiki/Installation")
endif

# Musiques copiees par datagen (prefixe numerique = ordre des music_id).
# Le soundbank est genere par smconv et epingle en bank $87 (kit §3).
AUDIOFILES := $(sort $(wildcard src/data/music/*.it))
ifneq ($(strip $(AUDIOFILES)),)
export SOUNDBANK := src/data/soundbank
endif

include ${PVSNESLIB_HOME}/devkitsnes/snes_rules

# snes_rules ne suit PAS les dépendances d'en-têtes : sans cette règle, un
# build incrémental après un changement de struct (scene.h, formats.h…)
# mélange des .obj compilés contre des layouts différents — bugs fantômes
# (positions corrompues, données décalées) sur console/émulateur fidèle.
$(OFILES): $(wildcard src/*.h) $(wildcard src/data/*.h) hdr.asm

SMCONVFLAGS := -s -o $(SOUNDBANK) -V -b 7

.PHONY: all clean data

#---------------------------------------------------------------------------------
# ROMNAME is used in snes_rules file
export ROMNAME := snesstudio

# Pas de conversion gfx pour l'instant : les assets du POC sont des C arrays
# écrits à la main (voir src/data/data_assets.c).
all: $(ROMNAME).sfc checkwram

# Garde-fou WRAM : le .bss de tcc-816 (bank $7E, SLOT 2) et les variables
# de PVSnesLib (oamMemory à $7E:9094, SLOT 0) partagent la bank $7E, et WLA
# alloue les deux slots SANS détecter le recouvrement. Un .bss qui dépasse
# $7E:8000 écrase donc l'OAM shadow en silence : sprites fantômes empilés
# en haut d'écran, limite de 32 sprites par ligne saturée, PNJ tronqués.
# Les gros tampons doivent aller en bank $7F (wram7f.asm).
.PHONY: checkwram
checkwram:
	@if grep -Eiq '^007e[89a-f][0-9a-f]{3} tccs_' $(ROMNAME).sym; then \
	  echo "ERREUR: le .bss deborde sur la RAM PVSnesLib (>= \$$7E:8000)."; \
	  echo "        Deplacer les gros tampons en bank \$$7F (voir wram7f.asm)."; \
	  grep -Ei '^007e[89a-f][0-9a-f]{3} tccs_' $(ROMNAME).sym; \
	  rm -f $(ROMNAME).sfc; \
	  exit 1; \
	fi

clean: cleanBuildRes cleanRom cleanGfx cleanAudio

# Regenere src/data/ depuis le projet source demo/ (outil Rust, Phase 2).
# Prerequis : toolchain Rust (cargo) — https://rustup.rs
# Sous MSYS2, si cargo est installe cote Windows mais introuvable ici :
#   export PATH="$PATH:$HOME/.cargo/bin"   (ou /c/Users/<toi>/.cargo/bin)
data:
	@command -v cargo >/dev/null 2>&1 || { \
	  echo "ERREUR: cargo introuvable dans le PATH."; \
	  echo "Installe Rust via https://rustup.rs puis, sous MSYS2, ajoute :"; \
	  echo "  export PATH=\"\$$PATH:/c/Users/$$USER/.cargo/bin\""; \
	  exit 1; }
	cargo run --release --manifest-path ../tools/Cargo.toml -p datagen -- ../demo ../engine
