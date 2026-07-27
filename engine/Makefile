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
all: $(ROMNAME).sfc

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
