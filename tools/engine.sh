#!/bin/sh
# The engine in engine/src is a git subtree of the shared Lines of Advance engine (tovbrog-pixel/lines-of-advance-engine).
#   tools/engine.sh pull   take the latest shared engine
#   tools/engine.sh push   send engine changes committed here back to the shared engine
# Before a push, run both games' checks (see engine/src/README.md, "Rules for changes").
URL=https://github.com/tovbrog-pixel/lines-of-advance-engine
case "$1" in
  pull) git subtree pull --prefix engine/src "$URL" main --squash -m "engine/src: take the latest shared engine" ;;
  push) git subtree push --prefix engine/src "$URL" main ;;
  *) echo "usage: tools/engine.sh pull|push"; exit 1 ;;
esac
