#!/usr/bin/env bash
# Build a ranked before/after page from two release versions, commits or branches.
set -euo pipefail
[ "$#" = 2 ] || { echo "usage: compare-releases.sh <old-version-or-ref> <new-version-or-ref>" >&2; exit 2; }
# shellcheck source=./lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$VISUAL_CHECKOUT_DIR"
VISUAL_PYTHON="$(visual_python compare)"
export VISUAL_PYTHON
exec "$VISUAL_PYTHON" "$VISUAL_SCRIPTS/release-screens.py" compare "$VISUAL_SNAPSHOT_DIR" "$VISUAL_PAGES_DIR" "$1" "$2"
