#!/usr/bin/env bash
#
# gate-savestate.sh — the machinery gate: runs the ROM headless and
# checks SEMANTIC facts in the savestate (OAM, VRAM, CGRAM).
#
# The pixel regression (regress.sh) proves the demo LOOKS the same;
# this gate proves the MACHINERY still works on the paths where it
# broke for real: the battler vignettes of a composed screen (H-bugfix
# chased invisible, half-transferred and wrongly-coloured battlers
# through savestates for a whole campaign) and the plain scene boot.
# The assertions are semantic — "posed where the screen says, chars
# non-empty, palette loaded" — not golden bytes, so art changes never
# trip them; only the engine breaking does.
#
# Two cases:
#   battle  a copy of showcase/ derived to boot into combat_gobelins
#           (tools/savestate/derive-battle.mjs), photographed at frame
#           600, battlers checked against the screen's own JSON;
#   boot    the demo's plain boot, player metasprite checked.
# battle runs FIRST so the engine ends the gate holding the demo's
# data, matching the repository (git diff -- engine/src/data stays
# clean).
#
# Needs: the snes9x libretro core (same discovery as regress.sh,
# SNES9X_CORE honoured), node, cargo, and a PVSnesLib toolchain —
# PVSNESLIB_HOME if set, else the vendored editor copy.
#
#   ./tools/gate-savestate.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KIT="$ROOT/tools/savestate"
OUT="$KIT/out"

for a in "$@"; do
  case "$a" in
    -h|--help) sed -n '2,31p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

# ---- libretro core (regress.sh's discovery) --------------------------
find_core() {
  [ -n "${SNES9X_CORE:-}" ] && { echo "$SNES9X_CORE"; return; }
  local c
  for c in "$ROOT"/tools/regress/snes9x_libretro.* \
           "$HOME"/.config/retroarch/cores/snes9x_libretro.* \
           /usr/lib/libretro/snes9x_libretro.*; do
    [ -f "$c" ] && { echo "$c"; return; }
  done
}
CORE="$(find_core || true)"
[ -n "$CORE" ] || { echo "ERROR: snes9x core not found (see tools/regress/README.md)." >&2; exit 3; }

# ---- toolchain -------------------------------------------------------
TOOLCHAIN="${PVSNESLIB_HOME:-$ROOT/editor/src-tauri/vendor/pvsneslib}"
[ -d "$TOOLCHAIN/devkitsnes" ] || {
  echo "ERROR: no PVSnesLib at $TOOLCHAIN — set PVSNESLIB_HOME or run 'npm run vendor'." >&2
  exit 3
}

echo "  building the tools…"
cargo build --release --quiet --manifest-path "$ROOT/tools/Cargo.toml"
BIN="$ROOT/tools/target/release"

rm -rf "$OUT"
mkdir -p "$OUT"

build_and_shoot() { # <project dir> <frames> <photo dir>
  "$BIN/datagen" "$1" "$ROOT/engine" >/dev/null
  "$BIN/snesbuild" build --engine "$ROOT/engine" --toolchain "$TOOLCHAIN" >/dev/null
  "$BIN/snesphoto" "$CORE" "$ROOT/engine/snesstudio.sfc" "$2" "$3" >/dev/null
}

echo "  case battle (showcase dérivé -> combat_gobelins)"
node "$KIT/derive-battle.mjs" "$ROOT/showcase" "$OUT/battleproj"
build_and_shoot "$OUT/battleproj" 600 "$OUT/battle"
node "$KIT/check.mjs" battle "$OUT/battle" "$ROOT/showcase/screens/combat_gobelins.json"

echo "  case boot (demo + canaris tcc-816)"
build_and_shoot "$ROOT/demo" 240 "$OUT/boot"
node "$KIT/check.mjs" boot "$OUT/boot" "$ROOT/engine/snesstudio.sym"

echo "savestate gate: OK"
