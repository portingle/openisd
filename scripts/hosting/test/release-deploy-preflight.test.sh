#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"
cat > "$tmp/bin/gh" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$GH_CALLS"
if [ "$1 $2" = 'workflow view' ]; then exit 1; fi
exit 0
MOCK
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" GH_CALLS="$tmp/calls"
for args in '--latest 20261125T0100Z' '--public 7.0.999 20261125T0100Z'; do
  : > "$GH_CALLS"
  if bash "$repo/scripts/release.sh" $args > "$tmp/out" 2>&1; then
    echo "Expected refusal: $args" >&2; exit 1
  fi
  grep -q 'production deployment workflow is unavailable; release was not changed' "$tmp/out"
  [ "$(cat "$GH_CALLS")" = 'workflow view deploy.yml --ref main' ]
done
echo 'Missing deployment workflow refuses release and Latest before changes.'
