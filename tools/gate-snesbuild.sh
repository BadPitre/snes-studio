#!/usr/bin/env bash
#
# gate-snesbuild.sh — proves snesbuild and make still agree.
#
# snesbuild replaced make + PVSnesLib's snes_rules + mkcart.sh so the
# editor could be installed without MSYS2. A build driver that is "close
# enough" is worse than no rewrite at all: it changes the game silently,
# and the pixel regression would blame the last engine edit rather than
# the build. So the contract is exact — the .sfc, the .smc and the symbol
# file must come out BYTE FOR BYTE the same either way.
#
#   ./tools/gate-snesbuild.sh
#
# Needs PVSNESLIB_HOME, like any engine build. Both builds run from clean,
# in sequence, in the real engine folder — the second overwrites the first,
# which is why the reference is copied aside before comparing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF="$(mktemp -d)"
trap 'rm -rf "$REF"' EXIT

: "${PVSNESLIB_HOME:?PVSNESLIB_HOME is not set}"
ROM=snesstudio

echo "— reference: make"
make -C "$ROOT/engine" clean >/dev/null 2>&1 || true
make -C "$ROOT/engine" >/dev/null
bash "$ROOT/tools/mkcart.sh" "$ROOT/engine/$ROM.sfc" "$ROOT/engine/$ROM.smc" >/dev/null
cp "$ROOT/engine/$ROM.sfc" "$REF/"
cp "$ROOT/engine/$ROM.smc" "$REF/"
cp "$ROOT/engine/$ROM.sym" "$REF/"

echo "— snesbuild"
cargo build --quiet --release --manifest-path "$ROOT/tools/Cargo.toml" -p snesbuild
"$ROOT/tools/target/release/snesbuild" clean --engine "$ROOT/engine" >/dev/null
"$ROOT/tools/target/release/snesbuild" cart --engine "$ROOT/engine" >/dev/null

rc=0
# linkfile is deliberately NOT compared: make writes the runtime libraries
# as absolute paths, snesbuild copies them in and writes them relative,
# because wlalink splits that file on whitespace and an installed toolchain
# lives under "SNES Studio". Different text, same objects, same ROM.
for f in "$ROM.sfc" "$ROM.smc" "$ROM.sym"; do
  if cmp -s "$REF/$f" "$ROOT/engine/$f"; then
    echo "  ✓ $f — identical"
  else
    echo "  ✗ $f — differs:"
    cmp "$REF/$f" "$ROOT/engine/$f" 2>&1 | sed 's/^/      /' || true
    rc=1
  fi
done

echo
if [ $rc -eq 0 ]; then
  echo "snesbuild: output identical to make on 3 files."
else
  echo "snesbuild DIVERGES from make — do not ship this build."
fi
exit $rc
