#!/usr/bin/env bash
# Build a before/after page from two release versions, commits or branches.
set -euo pipefail
[ "$#" = 2 ] || { echo "usage: compare-releases.sh <old-version-or-ref> <new-version-or-ref> | --latest-pair <ledger>" >&2; exit 2; }
# shellcheck source=./lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
if [ "$1" = --latest-pair ]; then
  ledger="$(realpath -- "$2")"
  set -- "$1" "$ledger"
else
  set -- -- "$@"
fi
cd "$VISUAL_CHECKOUT_DIR"
VISUAL_PYTHON="$(visual_python)"
export VISUAL_PYTHON
exec "$VISUAL_PYTHON" "$VISUAL_SCRIPTS/compare-releases.py" "$VISUAL_SNAPSHOT_DIR" "$VISUAL_PAGES_DIR" "$@"
