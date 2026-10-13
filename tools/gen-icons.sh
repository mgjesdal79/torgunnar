#!/usr/bin/env bash
# Regenererer alle app-ikoner fra icon-src.svg.
# Bytt ikon: erstatt icon-src.svg, kjør denne, commit PNG-ene.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="icon-src.svg"
rsvg-convert -w 192 -h 192 "$SRC" -o icon-192.png
rsvg-convert -w 512 -h 512 "$SRC" -o icon-512.png
rsvg-convert -w 180 -h 180 "$SRC" -o apple-touch-icon.png
rsvg-convert -w 32  -h 32  "$SRC" -o favicon.png
echo "Ikoner regenerert fra $SRC"
