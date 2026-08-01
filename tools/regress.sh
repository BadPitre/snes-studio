#!/usr/bin/env bash
#
# regress.sh — régression PIXEL du moteur.
#
# Construit (ou reprend) le ROM de la demo, le fait tourner dans le core
# libretro snes9x sur un nombre de frames FIXE avec une séquence de
# touches FIXE, et compare l'image obtenue OCTET À OCTET à une référence
# versionnée. Un pixel qui bouge sans raison se voit.
#
# C'est le seul garde-fou du projet contre les régressions silencieuses :
# il a attrapé un bug tcc-816 où déclarer une variable dans un `case`
# corrompait la rangée de cœurs du HUD — invisible à la relecture.
#
#   ./tools/regress.sh              vérifie
#   ./tools/regress.sh --build      régénère les données + recompile avant
#   ./tools/regress.sh --bless      remplace les références (changement voulu)
#
# Le core snes9x n'est PAS dans le dépôt (2,4 Mo de binaire). Voir
# tools/regress/README.md pour l'obtenir ; le script le cherche seul.
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
    *) echo "option inconnue : $a" >&2; exit 2 ;;
  esac
done

# ---- core libretro ---------------------------------------------------
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
ERREUR : core libretro snes9x introuvable.

Il n'est pas versionné (2,4 Mo de binaire). Posez-le dans
  tools/regress/snes9x_libretro.so    (.dll sous Windows)
ou donnez son chemin :
  SNES9X_CORE=/chemin/snes9x_libretro.so ./tools/regress.sh

Détails dans tools/regress/README.md.
EOF
  exit 3
fi

# ---- harness ---------------------------------------------------------
HARNESS="$KIT/harness"
if [ ! -x "$HARNESS" ] || [ "$KIT/harness.c" -nt "$HARNESS" ]; then
  echo "  compilation du harness…"
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
[ -f "$ROM" ] || { echo "ERREUR : $ROM absent — lancer avec --build." >&2; exit 4; }

# ---- cas -------------------------------------------------------------
mkdir -p "$OUT"
fail=0
total=0
while read -r name frames inputs; do
  case "${name:-}" in ''|\#*) continue ;; esac
  total=$((total + 1))
  got="$OUT/$name.ppm"
  ref="$KIT/ref/$name.ppm"
  "$HARNESS" "$CORE" "$ROM" "$frames" "$got" ${inputs:+"$inputs"} >/dev/null 2>&1 || {
    echo "  ✗ $name — le harness a échoué (ROM qui gèle ?)"
    fail=$((fail + 1)); continue
  }
  if [ "$BLESS" = 1 ]; then
    cp "$got" "$ref"
    echo "  ↻ $name — référence remplacée"
  elif [ ! -f "$ref" ]; then
    echo "  ✗ $name — aucune référence (--bless pour la créer)"
    fail=$((fail + 1))
  elif cmp -s "$got" "$ref"; then
    echo "  ✓ $name"
    rm -f "$got"
  else
    # nombre d'octets qui diffèrent : donne l'ordre de grandeur (un
    # glyphe déplacé vs tout l'écran) sans dépendre d'outils d'image
    # `cmp -l` sort en 1 quand ça diffère : sans le `|| true`, pipefail
    # ferait mourir le script au PREMIER écart et masquerait les autres
    n=$({ cmp -l "$got" "$ref" 2>/dev/null || true; } | wc -l | tr -d ' ')
    echo "  ✗ $name — $n octets diffèrent ; obtenu : $got"
    fail=$((fail + 1))
  fi
done < "$KIT/cases.txt"

echo
if [ "$BLESS" = 1 ]; then
  echo "$total référence(s) remplacée(s) — RELIRE le diff git avant de commiter."
elif [ "$fail" = 0 ]; then
  echo "$total cas — aucune différence."
else
  cat <<EOF
$fail cas sur $total en écart.

Si le changement est VOULU (données de demo/, rendu modifié exprès) :
regarder les .ppm de tools/regress/out, puis ./tools/regress.sh --bless.
Sinon, c'est une régression — et le ROM fautif est le meilleur indice
qu'on puisse garder : le copier avant de recompiler.
EOF
  exit 1
fi
