ifeq ($(strip $(PVSNESLIB_HOME)),)
$(error "Please create an environment variable PVSNESLIB_HOME by following this guide: https://github.com/alekmaul/pvsneslib/wiki/Installation")
endif

include ${PVSNESLIB_HOME}/devkitsnes/snes_rules

.PHONY: all clean data

#---------------------------------------------------------------------------------
# ROMNAME is used in snes_rules file
export ROMNAME := snesstudio

# Pas de conversion gfx pour l'instant : les assets du POC sont des C arrays
# écrits à la main (voir src/data/data_assets.c).
all: $(ROMNAME).sfc

clean: cleanBuildRes cleanRom cleanGfx

# Regenere src/data/ depuis le projet source demo/ (outil Rust, Phase 2).
# Prerequis : toolchain Rust (cargo).
data:
	cargo run --release --manifest-path ../tools/Cargo.toml -p datagen -- ../demo ../engine/src/data
