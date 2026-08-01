#!/usr/bin/env bash
#
# gate-datagen.sh — filet de sécurité pour tout remaniement de datagen.
#
# datagen est un TRADUCTEUR : mêmes projets en entrée, mêmes fichiers C
# et binaires en sortie. Un refactor qui change un octet de sa sortie a
# changé le jeu, même si le code compile et que les tests passent. Ce
# script transforme cette évidence en garde-fou mécanique.
#
#   ./tools/gate-datagen.sh snapshot   enregistre la sortie de référence
#   ./tools/gate-datagen.sh check      régénère et compare octet à octet
#
# La référence n'est PAS versionnée : elle se prend juste avant de
# toucher au code, et se jette après. C'est un comparateur avant/après,
# pas un golden file — un golden file versionné deviendrait périmé au
# premier changement de format légitime, et on prendrait l'habitude de
# le « bénir » sans regarder.
#
# Les projets couverts sont demo (couche supérieure, warps, dialogues)
# et showcase (base de données, écrans composés, animations, UI) : à
# eux deux ils traversent la quasi-totalité des émetteurs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF="${GATE_DATAGEN_REF:-${TMPDIR:-/tmp}/snesstudio-datagen-ref}"
PROJECTS=(demo showcase)

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; }
[ $# -eq 1 ] || { usage; exit 2; }

# Génère la sortie des deux projets dans $1/<projet>/.
generate() {
  local dest="$1" p
  cargo build --quiet --release --manifest-path "$ROOT/tools/Cargo.toml"
  for p in "${PROJECTS[@]}"; do
    rm -rf "$dest/$p"
    mkdir -p "$dest/$p"
    # datagen écrit dans <engine>/src/data : on lui donne un faux engine
    mkdir -p "$dest/$p/src/data"
    "$ROOT/tools/target/release/datagen" "$ROOT/$p" "$dest/$p" >/dev/null
    # les .it copiés depuis le projet ne prouvent rien et pèsent lourd
    rm -rf "$dest/$p/src/data/music"
  done
}

case "$1" in
  snapshot)
    generate "$REF"
    echo "référence prise dans $REF"
    ;;
  check)
    [ -d "$REF" ] || { echo "aucune référence — lancer d'abord : $0 snapshot" >&2; exit 2; }
    NEW="$(mktemp -d)"
    trap 'rm -rf "$NEW"' EXIT
    generate "$NEW"
    rc=0
    for p in "${PROJECTS[@]}"; do
      if diff -r "$REF/$p" "$NEW/$p" >/dev/null 2>&1; then
        echo "  ✓ $p — sortie identique"
      else
        echo "  ✗ $p — la sortie a changé :"
        diff -rq "$REF/$p" "$NEW/$p" | sed 's/^/      /'
        rc=1
      fi
    done
    [ $rc -eq 0 ] && echo "" && echo "datagen : sortie inchangée sur ${#PROJECTS[@]} projets."
    exit $rc
    ;;
  *) usage; exit 2 ;;
esac
