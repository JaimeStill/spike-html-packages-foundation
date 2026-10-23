#!/usr/bin/env bash
# The build: src/ into a fresh dist/. tsc emits each module's .js and .d.ts, and the .css and the
# handwritten .d.ts are copied beside them as written.
# Adapted from spike-html-packages (7fb31a8): scripts/build.sh, cut to one layer.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
tsc -p .
(cd src && find . -type f \( -name '*.css' -o -name '*.d.ts' \) -print0 |
  xargs -0 -r cp --parents -t ../dist)
