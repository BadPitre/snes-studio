#!/usr/bin/env bash
#
# gate-editor.sh — filet de sécurité pour tout remaniement de l'éditeur.
#
# Trois vérifications, de la moins chère à la plus parlante :
#   1. tsc --noEmit          les types tiennent
#   2. vite build            le paquet se construit
#   3. npm run smoke          chaque fenêtre s'ouvre et s'affiche
#   4. npm run smoke:commands chaque formulaire de commande s'affiche
#
# La troisième est celle qui compte. Un remaniement de React ne casse
# presque jamais la compilation — il casse un RENDU, et ça ne se voit
# qu'en ouvrant la fenêtre. Le smoke test les ouvre toutes sur le projet
# demo et relève les erreurs de console.
#
#   ./tools/gate-editor.sh          les trois
#   ./tools/gate-editor.sh --fast   sans le smoke test (tsc + build)
#
# Le mode navigateur de l'éditeur sert le projet depuis editor/public/project
# (voir io.ts, pickProjectDir). Le script y pointe la demo le temps du
# test et remet le lien d'origine en sortant.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ED="$ROOT/editor"
LINK="$ED/public/project"
PORT="${SMOKE_PORT:-4183}"
FAST=0
[ "${1:-}" = "--fast" ] && FAST=1

cd "$ED"
echo "— types"
npx tsc --noEmit -p tsconfig.json
echo "— paquet"
npm run build >/dev/null
[ $FAST -eq 1 ] && { echo ""; echo "éditeur : types et paquet OK (smoke test ignoré)."; exit 0; }

# Le lien vers le projet servi est local et non versionné : on le
# sauvegarde avant de le détourner vers la demo.
SAVED=""
if [ -L "$LINK" ]; then SAVED="$(readlink "$LINK")"; fi
restore() {
  rm -f "$LINK"
  [ -n "$SAVED" ] && ln -s "$SAVED" "$LINK"
  kill "${PREVIEW_PID:-0}" 2>/dev/null || true
}
trap restore EXIT
rm -f "$LINK"
ln -s "$ROOT/demo" "$LINK"

echo "— aperçu sur le port $PORT"
npx vite preview --port "$PORT" --strictPort >/tmp/gate-editor-preview.log 2>&1 &
PREVIEW_PID=$!
for _ in $(seq 1 30); do
  curl -sf -o /dev/null "http://localhost:$PORT/" && break
  sleep 0.5
done

echo "— fenêtres"
SMOKE_URL="http://localhost:$PORT" npm run --silent smoke

echo ""
echo "— formulaires de commande"
SMOKE_URL="http://localhost:$PORT" npm run --silent smoke:commands
