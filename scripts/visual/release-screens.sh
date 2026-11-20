#!/usr/bin/env bash
# Save all visual baselines in the release's ledger commit as lossless WebP.
set -euo pipefail
[ "$#" = 1 ] || { echo "usage: release-screens.sh <version>" >&2; exit 2; }
# shellcheck source=./lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$VISUAL_CHECKOUT_DIR"
python="$(visual_python archive)"
exec "$python" "$VISUAL_SCRIPTS/release-screens.py" archive "$VISUAL_SNAPSHOT_DIR" "$1"
