#!/usr/bin/env bash
# The land.sh gate-files check: a diff touching a GATE_FILES glob refuses `gates` unless the task has
# gates_approved: QO<n> and that board item has a thread entry by John. Scratch repo, real git, fake
# gates, its own QUESTIONS_FILE. Not a locked spec.
set -uo pipefail
GITCFG="$(mktemp "${TMPDIR:-/tmp}/land-gitconfig.XXXXXX")"
printf '[user]\n\tname = t\n\temail = t@t\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = main\n' > "$GITCFG"
export GIT_CONFIG_GLOBAL="$GITCFG" GIT_CONFIG_NOSYSTEM=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/land-gates.XXXXXX")"
fails=0
trap 'rm -rf "$SCRATCH" "$GITCFG"' EXIT
ok()   { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }

# setup <task extra lines> <file to change> ; GATE_FILES copied from the real land.conf
setup() {
    rm -rf "$SCRATCH/w"; mkdir -p "$SCRATCH/w"; cd "$SCRATCH/w" || exit 2
    git init -q --bare -b main origin.git
    git clone -q origin.git c 2>/dev/null; cd c || exit 2
    git config user.email t@t; git config user.name t
    mkdir -p scripts tasks/fixes gates
    cp "$REPO/scripts/land.sh" "$REPO/scripts/paths.sh" scripts/; cp -r "$REPO/scripts/land" scripts/; cp -r "$REPO/scripts/lib" scripts/
    mkdir -p scripts/ci; cp "$REPO/scripts/ci/contract-from-base.sh" scripts/ci/ 2> /dev/null   # the pull request check's runner (17-19)
    printf '#!/usr/bin/env bash\nexit 0\n' > gates/ok.sh; chmod +x gates/ok.sh
    cat > "$SCRATCH/questions.yml" <<'Q'
questions:
- id: QO1
  title: Gate change for T9
  thread:
  - id: QO1.c1
    by: fable
    text: please approve
  - id: QO1.c2
    by: John
    text: ok
- id: QO2
  title: Gate change for T9
  thread:
  - id: QO2.c1
    by: fable
    text: please approve
- id: QO11
  title: Unrelated item, mentions T90 only
  thread:
  - id: QO11.c1
    by: John
    text: ok
Q
    gate_files="$(grep '^GATE_FILES=' "$REPO/land.conf")"
    cat > land.conf <<CONF
LINT_CMD="bash gates/ok.sh"
TYPECHECK_CMD="bash gates/ok.sh"
UNIT_CMD="bash gates/ok.sh"
ARCHITECTURE_CMD="bash gates/ok.sh"
CANDIDATE_CMD="true"
ATTRIBUTION_CMD="bash gates/ok.sh"
GATE_DEADLINE_S=30
LAND_LOCK="$SCRATCH/land.lock"
POST_LAND_LOCK="$SCRATCH/post.lock"
POST_LAND_RECORD="$SCRATCH/post.lock"
QUESTIONS_FILE="$SCRATCH/questions.yml"
$gate_files
CONF
    printf 'id: T9\nowner: t\nstatus: claimed\nrelease_note: internal\ngoal: Do the thing.\ndone_test: true\nfiles:\n  - f.txt\n%s' "${1:-}" > tasks/T9.yml
    git add -A; git commit -qm base; git push -q origin main
    mkdir -p "$(dirname "$2")"; echo 1 > "$2"; git add -A; git commit -qm wip
}
land() { timeout 120 bash scripts/land.sh T9 > "$SCRATCH/out" 2>&1; echo $?; }
refused_gates() { [ "$1" = 1 ] && grep -q 'REFUSED by gate gates:' "$SCRATCH/out"; }

setup "" f.txt; r=$(land)
[ "$r" = 0 ] && ok "1 non-gate file lands" || fail "1 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup "" tsconfig.json; r=$(land)
if refused_gates "$r" && grep -q 'tsconfig.json' "$SCRATCH/out" && grep -q 'John approves gate changes' "$SCRATCH/out"; then ok "2 tsconfig.json without field refuses gates"; else fail "2 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

setup $'gates_approved: QO99\n' tsconfig.json; r=$(land)
refused_gates "$r" && ok "3 QO absent from the board refuses" || fail "3 (r=$r)"

setup $'gates_approved: QO2\n' tsconfig.json; r=$(land)
refused_gates "$r" && ok "4 QO with only agent comments refuses" || fail "4 (r=$r)"

setup $'gates_approved: QO1\n' tsconfig.json; r=$(land)
[ "$r" = 0 ] && ok "5 QO with a by: John entry lands" || fail "5 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup "" packages/ui/coverage-baseline.json; r=$(land)
[ "$r" = 0 ] && ok "6 coverage-baseline.json alone lands" || fail "6 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup "" packages/design/vitest.coverage.config.ts; r=$(land)
refused_gates "$r" && ok "7 packages/design/vitest.coverage.config.ts refuses" || fail "7 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

setup $'gates_approved: QO11\n' scripts/coverage-x.sh; r=$(land)
refused_gates "$r" && ok "8 John-answered QO that names T90, not T9, refuses" || fail "8 (r=$r)"

setup "" tsconfig.json; sed -i '/^GATE_FILES=/d' land.conf; git add -A; git commit -qm nogf; r=$(land)
if refused_gates "$r" && grep -q 'GATE_FILES is not set in land.conf' "$SCRATCH/out"; then ok "9 unset GATE_FILES refuses"; else fail "9 (r=$r)"; fi

# 10: land.conf and scripts/land.sh are themselves gate files (QO313). Edit = append a comment so the scratch run still works.
for gf in land.conf scripts/land.sh; do
    setup "" f.txt; echo "# edit" >> "$gf"; git add -A; git commit -qm wip2; r=$(land)
    if refused_gates "$r" && grep -q "$gf" "$SCRATCH/out"; then ok "10 $gf without field refuses gates"; else fail "10 $gf (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi
done

# 11: the duplicate check's known-copies list is a gate file (John, 18 Nov 2026, QO948): refused without gates_approved, lands with it.
setup "" scripts/dupscan-allow.json; r=$(land)
if refused_gates "$r" && grep -q 'scripts/dupscan-allow.json' "$SCRATCH/out"; then ok "11 dupscan-allow.json without field refuses gates"; else fail "11 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

setup $'gates_approved: QO1\n' scripts/dupscan-allow.json; r=$(land)
[ "$r" = 0 ] && ok "12 dupscan-allow.json with a John-answered gates_approved lands" || fail "12 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"

# 13: the duplicate check's homes and the check itself are gate files too (T934 review, Codex 19 Nov 2026: a home declared in
# the proposed change, or an edited scanner, would otherwise pass the check it is meant to tighten).
for gf in scripts/dupscan-homes.json scripts/dupscan.mjs; do
    setup "" "$gf"; r=$(land)
    if refused_gates "$r" && grep -q "$gf" "$SCRATCH/out"; then ok "13 $gf without field refuses gates"; else fail "13 $gf (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi
    setup $'gates_approved: QO1\n' "$gf"; r=$(land)
    [ "$r" = 0 ] && ok "14 $gf with a John-answered gates_approved lands" || fail "14 $gf (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"
done

# 15: the pull request workflow runs the duplicate check and the other gates, so it is a gate file (T934 review 2).
setup "" .github/workflows/pr.yml; r=$(land)
if refused_gates "$r" && grep -q '.github/workflows/pr.yml' "$SCRATCH/out"; then ok "15 .github/workflows/pr.yml without field refuses gates"; else fail "15 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-300)"; fi

# 16: the protected list is the BASE revision's (T934 review 2): a change that drops dupscan-homes.json from GATE_FILES in
# its own land.conf still has its change to dupscan-homes.json named as a gate change.
setup "" scripts/dupscan-homes.json
sed -i 's# scripts/dupscan-homes.json##' land.conf; git add -A; git commit -qm drop-gate; r=$(land)
if refused_gates "$r" && grep -q 'gate files changed: [^;]*scripts/dupscan-homes.json' "$SCRATCH/out"; then ok "16 a gate file dropped from the proposed land.conf is still a gate file (the base list counts)"; else fail "16 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi

# 17-19: the pull request check runs the gate-approval check from the BASE revision's own scripts (T934 review 3, Codex
# 19 Nov 2026: "CI invokes the proposed checker"): pr.yml takes scripts/ci/contract-from-base.sh from the base commit, and it
# runs the base commit's scripts/land/, reading the proposed land.conf, task file and file list as data, never as shell.
# A change that edits the checker to always pass, and changes a gate file, is still refused; its land.conf is never run.
ci_contract() {   # what pr.yml's task-contract step does, with the base commit origin/main
    git show origin/main:scripts/ci/contract-from-base.sh > "$SCRATCH/runner.sh" 2> /dev/null || { echo "no scripts/ci/contract-from-base.sh on the base" > "$SCRATCH/out"; echo 2; return; }
    (unset GATE_FILES QUESTIONS_FILE; timeout 120 bash "$SCRATCH/runner.sh" origin/main) > "$SCRATCH/out" 2>&1; echo $?
}
ci_setup() {   # setup (the runner is on the base), then the change: <task extra lines>
    setup "$(printf '  - tsconfig.json\n  - land.conf\n  - scripts/land/check-task-contract.sh\nwhy: John asked for this change (John, 10 Nov 2026)\n%s' "$1")" f.txt
    printf '#!/usr/bin/env bash\nexit 0\n' > scripts/land/check-task-contract.sh
    printf 'touch "%s/sourced"\n' "$SCRATCH" >> land.conf
    echo 2 > tsconfig.json; echo 2 > f.txt; rm -f "$SCRATCH/sourced"
    printf '\n# the change\n' >> tasks/T9.yml
    git add -A; git commit -qm 'checker always passes'
}
ci_setup ""; r=$(ci_contract)
if [ "$r" = 1 ] && grep -q $'REFUSE\tgates' "$SCRATCH/out" && grep -q 'tsconfig.json' "$SCRATCH/out"; then ok "17 the checker edited to always pass: the base's checker still refuses the gate change"; else fail "17 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"; fi
[ "$r" != 2 ] && [ ! -e "$SCRATCH/sourced" ] && ok "18 the proposed land.conf is read as data, never run" || fail "18 the proposed land.conf was run as shell"
ci_setup $'gates_approved: QO1\n'; r=$(ci_contract)
[ "$r" = 0 ] && ok "19 the same change with a John-answered gates_approved passes the base's checker" || fail "19 (r=$r): $(tr '\n' ' ' < "$SCRATCH/out" | cut -c1-400)"

[ $fails = 0 ] && { echo "land-gates: all passed"; exit 0; }
echo "land-gates: $fails failed"; exit 1
