#!/usr/bin/env bash
#
# regress.sh — the engine's PIXEL regression.
#
# Builds (or reuses) the demo ROM, runs it in the snes9x libretro core
# for a FIXED number of frames with a FIXED key sequence, and compares
# the resulting image BYTE FOR BYTE against a versioned reference. A
# pixel that moves for no reason shows up.
#
# It is the project's only guard rail against silent regressions: it
# caught a tcc-816 bug where declaring a variable inside a `case`
# corrupted the HUD's row of hearts — invisible on a re-read.
#
#   ./tools/regress.sh              check
#   ./tools/regress.sh --build      regenerate the data + rebuild first
#   ./tools/regress.sh --bless      replace the references (an intended change)
#
# The snes9x core is NOT in the repository (2.4 MB of binary). See
# tools/regress/README.md to get it; the script finds it on its own.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KIT="$ROOT/tools/regress"
OUT="$ROOT/tools/regress/out"
ROM="$ROOT/engine/snesstudio.sfc"

BUILD=0
BLESS=0
for a in "$@"; do
  case "$a" in
    --build) BUILD=1 ;;
    --bless) BLESS=1 ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

# ---- libretro core ---------------------------------------------------
find_core() {
  [ -n "${SNES9X_CORE:-}" ] && { echo "$SNES9X_CORE"; return; }
  local c
  for c in "$KIT"/snes9x_libretro.* \
           "$HOME"/.config/retroarch/cores/snes9x_libretro.* \
           /usr/lib/libretro/snes9x_libretro.*; do
    [ -f "$c" ] && { echo "$c"; return; }
  done
}
CORE="$(find_core || true)"
if [ -z "$CORE" ]; then
  cat >&2 <<EOF
ERROR: snes9x libretro core not found.

It is not versioned (2.4 MB of binary). Drop it in
  tools/regress/snes9x_libretro.so    (.dll on Windows)
or give its path:
  SNES9X_CORE=/path/snes9x_libretro.so ./tools/regress.sh

Details in tools/regress/README.md.
EOF
  exit 3
fi

# ---- harness ---------------------------------------------------------
HARNESS="$KIT/harness"
if [ ! -x "$HARNESS" ] || [ "$KIT/harness.c" -nt "$HARNESS" ]; then
  echo "  building the harness…"
  cc -O2 -I"$KIT" -o "$HARNESS" "$KIT/harness.c" -ldl
fi

# ---- ROM -------------------------------------------------------------
if [ "$BUILD" = 1 ]; then
  echo "  datagen demo -> engine/src/data"
  cargo run --release --quiet --manifest-path "$ROOT/tools/Cargo.toml" \
    -p datagen -- "$ROOT/demo" "$ROOT/engine" >/dev/null
  echo "  make"
  make -C "$ROOT/engine" >/dev/null
fi
[ -f "$ROM" ] || { echo "ERROR: $ROM missing — run with --build." >&2; exit 4; }

# ---- cases -----------------------------------------------------------
mkdir -p "$OUT"
fail=0
total=0
while read -r name frames inputs; do
  case "${name:-}" in ''|\#*) continue ;; esac
  total=$((total + 1))
  got="$OUT/$name.ppm"
  ref="$KIT/ref/$name.ppm"
  "$HARNESS" "$CORE" "$ROM" "$frames" "$got" ${inputs:+"$inputs"} >/dev/null 2>&1 || {
    echo "  ✗ $name — the harness failed (a frozen ROM?)"
    fail=$((fail + 1)); continue
  }
  if [ "$BLESS" = 1 ]; then
    cp "$got" "$ref"
    echo "  ↻ $name — reference replaced"
  elif [ ! -f "$ref" ]; then
    echo "  ✗ $name — no reference (--bless to create it)"
    fail=$((fail + 1))
  elif cmp -s "$got" "$ref"; then
    echo "  ✓ $name"
    rm -f "$got"
  else
    # the number of differing bytes: gives the order of magnitude (one
    # glyph moved vs the whole screen) without depending on image tools
    # `cmp -l` exits 1 when they differ: without the `|| true`, pipefail
    # would kill the script on the FIRST mismatch and hide the others
    n=$({ cmp -l "$got" "$ref" 2>/dev/null || true; } | wc -l | tr -d ' ')
    echo "  ✗ $name — $n bytes differ; got: $got"
    fail=$((fail + 1))
  fi
done < "$KIT/cases.txt"

echo
if [ "$BLESS" = 1 ]; then
  echo "$total reference(s) replaced — RE-READ the git diff before committing."
elif [ "$fail" = 0 ]; then
  echo "$total cases — no difference."
else
  cat <<EOF
$fail case(s) out of $total differ.

If the change is INTENDED (demo/ data, rendering deliberately changed):
look at the .ppm files in tools/regress/out, then ./tools/regress.sh --bless.
Otherwise it is a regression — and the offending ROM is the best clue
you can keep: copy it before rebuilding.
EOF
  exit 1
fi
