#!/usr/bin/env bash
#
# gate-datagen.sh — the safety net for any datagen rework.
#
# datagen is a TRANSLATOR: the same projects in, the same C files and
# binaries out. A refactor that changes one byte of its output has
# changed the game, even if the code compiles and the tests pass. This
# script turns that truism into a mechanical guard rail.
#
#   ./tools/gate-datagen.sh snapshot   records the reference output
#   ./tools/gate-datagen.sh check      regenerates and compares byte for byte
#
# The reference is NOT versioned: you take it just before touching the
# code, and throw it away afterwards. It is a before/after comparator,
# not a golden file — a versioned golden file would go stale at the
# first legitimate format change, and we would get into the habit of
# "blessing" it without looking.
#
# The projects covered are demo (upper layer, warps, dialogue) and
# showcase (database, composed screens, animations, UI): between them
# they go through nearly every emitter.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF="${GATE_DATAGEN_REF:-${TMPDIR:-/tmp}/snesstudio-datagen-ref}"
PROJECTS=(demo showcase)

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; }
[ $# -eq 1 ] || { usage; exit 2; }

# Generates both projects' output into $1/<project>/.
generate() {
  local dest="$1" p
  cargo build --quiet --release --manifest-path "$ROOT/tools/Cargo.toml"
  for p in "${PROJECTS[@]}"; do
    rm -rf "$dest/$p"
    mkdir -p "$dest/$p"
    # datagen writes into <engine>/src/data: hand it a fake engine
    mkdir -p "$dest/$p/src/data"
    "$ROOT/tools/target/release/datagen" "$ROOT/$p" "$dest/$p" >/dev/null
    # the .it files copied from the project prove nothing and weigh a lot
    rm -rf "$dest/$p/src/data/music"
  done
}

case "$1" in
  snapshot)
    generate "$REF"
    echo "reference taken in $REF"
    ;;
  check)
    [ -d "$REF" ] || { echo "no reference — run this first: $0 snapshot" >&2; exit 2; }
    NEW="$(mktemp -d)"
    trap 'rm -rf "$NEW"' EXIT
    generate "$NEW"
    rc=0
    for p in "${PROJECTS[@]}"; do
      if diff -r "$REF/$p" "$NEW/$p" >/dev/null 2>&1; then
        echo "  ✓ $p — identical output"
      else
        echo "  ✗ $p — the output changed:"
        diff -rq "$REF/$p" "$NEW/$p" | sed 's/^/      /'
        rc=1
      fi
    done
    [ $rc -eq 0 ] && echo "" && echo "datagen: output unchanged on ${#PROJECTS[@]} projects."
    exit $rc
    ;;
  *) usage; exit 2 ;;
esac
