#!/usr/bin/env bash
#
# gate-editor.sh — the safety net for any editor rework.
#
# Four checks, from the cheapest to the most telling:
#   1. tsc --noEmit           the types hold
#   2. vite build             the bundle builds
#   3. npm run smoke          every window opens and renders
#   4. npm run smoke:commands every command form renders
#
# The last two are the ones that matter. A React rework almost never
# breaks the compile — it breaks a RENDER, and that only shows when the
# window is opened. The smoke test opens them all on the demo project
# and picks up console errors.
#
#   ./tools/gate-editor.sh          all of them
#   ./tools/gate-editor.sh --fast   without the smoke tests (tsc + build)
#
# The editor's browser mode serves the project from editor/public/project
# (see io.ts, pickProjectDir). The script points that at the demo for the
# duration of the test and restores the original link on the way out.
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
echo "— bundle"
npm run build >/dev/null
[ $FAST -eq 1 ] && { echo ""; echo "editor: types and bundle OK (smoke tests skipped)."; exit 0; }

# The link to the served project is local and unversioned: save it before
# diverting it to the demo.
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

echo "— preview on port $PORT"
npx vite preview --port "$PORT" --strictPort >/tmp/gate-editor-preview.log 2>&1 &
PREVIEW_PID=$!
for _ in $(seq 1 30); do
  curl -sf -o /dev/null "http://localhost:$PORT/" && break
  sleep 0.5
done

echo "— windows"
SMOKE_URL="http://localhost:$PORT" npm run --silent smoke

echo ""
echo "— command forms"
SMOKE_URL="http://localhost:$PORT" npm run --silent smoke:commands
