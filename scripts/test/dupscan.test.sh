#!/usr/bin/env bash
# T905: the duplicate-logic check (scripts/dupscan.mjs) refuses a NEW copy of a formula and passes without it.
# A scratch tree holds one clean engine file and an empty allow-list; a second file carrying a driver-count
# formula must fail the run naming that file, and the shipped allow-list must pass on this repo.
# T934 (John, 19 Nov 2026: "remove the dupe and fix the guardrail"): the scratch tree is a git repository, because the
# check compares the allow-list with the one on the base commit (--base): the list may only shrink. Each kind of sum
# declares its home in the engine (--homes); a match inside its home is not a copy.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JSCPD="${DUPSCAN_JSCPD:-$REPO/node_modules/.bin/jscpd}"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/dupscan-test.XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
fails=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fails=$((fails + 1)); }

g() { git -C "$SCRATCH" -c user.name=test -c user.email=test@example.invalid -c commit.gpgsign=false "$@"; }
mkdir -p "$SCRATCH/packages/design/engine/array"
printf 'export const area = (w: number, h: number): number => w + h;\n' > "$SCRATCH/packages/design/engine/clean.ts"
printf 'export function eachOfN(whole: number, n: number): number {\n  return whole / n;\n}\n' > "$SCRATCH/packages/design/engine/array/home.ts"
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:eachOfN"]}' > "$SCRATCH/homes.json"
echo '{}' > "$SCRATCH/allow.json"
g init -q -b main
# base: the allow-list as it is on the base commit (tag base); the check compares the working allow-list with it
set_base() { g add -A > /dev/null && g commit -q --allow-empty -m base && g tag -f base > /dev/null; }
set_base
run() { node "$REPO/scripts/dupscan.mjs" "$SCRATCH" --jscpd "$JSCPD" --allow "$SCRATCH/allow.json" --homes "$SCRATCH/homes.json" --base base 2>&1; }

out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "a scratch tree without the formula passes, its home's own line included (exit 0)" || bad "clean tree should pass, got exit $rc: $out"

printf 'export const perDriver = (Vb: number, n: number): number => Vb / n;\n' > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
echo "$out" | sed 's/^/  | /'
{ [ "$rc" = 1 ] && grep -q 'packages/design/engine/newcopy.ts' <<< "$out"; } && ok "a new formula copy is refused (exit 1) and named" || bad "new copy should exit 1 naming newcopy.ts, got exit $rc"
grep -q 'call packages/design/engine/array/home.ts:eachOfN' <<< "$out" && ok "the refusal names the kind's home to call" || bad "refusal should name the home eachOfN: $out"

rm "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "removing the copy passes again (exit 0)" || bad "after removal should pass, got exit $rc"

# T934: the home. The same text inside the declared home function passes; outside it (another function in the same file,
# or another file) it fails.
printf 'export function eachOfN(whole: number, n: number): number {\n  return whole / n;\n}\nexport function other(Vb: number, n: number): number {\n  return Vb / n;\n}\n' > "$SCRATCH/packages/design/engine/array/home.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'packages/design/engine/array/home.ts:5' <<< "$out" && ! grep -q 'home.ts:2' <<< "$out"; } \
  && ok "the same sum in another function of the home's file fails, the home's own line does not" || bad "line 5 (other) should fail and line 2 (eachOfN) pass, got exit $rc: $out"
printf 'export function eachOfN(whole: number, n: number): number {\n  return whole / n;\n}\n' > "$SCRATCH/packages/design/engine/array/home.ts"

echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:gone"]}' > "$SCRATCH/homes.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'home.ts:gone' <<< "$out"; } && ok "a declared home that does not exist fails (exit 1)" || bad "missing home should exit 1 naming it, got exit $rc: $out"
echo '{"driver-count-scaling": ["packages/ui/src/x.ts"]}' > "$SCRATCH/homes.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'packages/design/engine/' <<< "$out"; } && ok "a home outside the engine fails (exit 1)" || bad "home outside engine should exit 1, got exit $rc: $out"
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:eachOfN"]}' > "$SCRATCH/homes.json"

# T934 review (Codex, 19 Nov 2026, finding 1): a home is one named function, never a whole file; the name is matched
# exactly, never as a pattern; only the function's own text is its home, not code after its closing brace.
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts"]}' > "$SCRATCH/homes.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'home packages/design/engine/array/home.ts names no function' <<< "$out"; } \
  && ok "a home naming a whole file is refused (exit 1)" || bad "whole-file home should exit 1 saying it names no function, got exit $rc: $out"
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:e.*"]}' > "$SCRATCH/homes.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'home.ts:e.\*: not declared there' <<< "$out"; } \
  && ok "a home name is matched exactly, not as a pattern (e.* is not eachOfN) (exit 1)" || bad "home name e.* should exit 1 as not declared, got exit $rc: $out"
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:eachOf"]}' > "$SCRATCH/homes.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'home.ts:eachOf: not declared there' <<< "$out"; } \
  && ok "a home name that is only the start of a declared name is refused (exit 1)" || bad "home name eachOf should exit 1 as not declared, got exit $rc: $out"
echo '{"driver-count-scaling": ["packages/design/engine/array/home.ts:eachOfN"]}' > "$SCRATCH/homes.json"
printf 'export function eachOfN(whole: number, n: number): number { return whole / n; } export const leak = (Vb: number, n: number): number => Vb / n;\n' > "$SCRATCH/packages/design/engine/array/home.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'packages/design/engine/array/home.ts:1' <<< "$out"; } \
  && ok "a sum after the home's closing brace on the same line fails (exit 1)" || bad "code after the home's closing brace should exit 1 naming home.ts:1, got exit $rc: $out"
printf 'export function eachOfN(whole: number, n: number): number {\n  return whole / n;\n}\n' > "$SCRATCH/packages/design/engine/array/home.ts"

# T934 review (finding 4): a division by the driver count followed by "+" is a driver-count sum too.
printf 'export const rac = (re: number, n: number, rs: number): number => re / n + rs;\n' > "$SCRATCH/packages/design/engine/plus.ts"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'driver-count-scaling (engine) packages/design/engine/plus.ts:1' <<< "$out"; } \
  && ok "a driver-count division followed by + (re / n + rs) is found (exit 1)" || bad "re / n + rs should exit 1 naming plus.ts:1, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/plus.ts"

# T934 review (finding 3): a formula line's key drops its comments and keeps its literals exactly: a "//" inside a string,
# a regular expression or a nested template is not a comment, and spaces inside a string are not folded.
sig_keys() { node "$REPO/scripts/dupscan.mjs" "$SCRATCH" --jscpd "$JSCPD" --allow "$SCRATCH/allow.json" --homes "$SCRATCH/homes.json" --base base --report "$SCRATCH/r.json" > /dev/null 2>&1
  node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).findings.filter(f => f.kind === "signature").map(f => f.key).sort().join("\n"))' "$SCRATCH/r.json"; }
cat > "$SCRATCH/packages/design/engine/keys.ts" << 'EOF'
export const a = (Vb: number, n: number): number => Vb / n; // one driver's share
export const b = (Vb: number, n: number): string => 'http://x  y' + (Vb / n);
export const c = (Vb: number, n: number): boolean => /\/\/ no/.test(String(Vb / n));
export const d = (Vb: number, n: number): string => `a ${`// in`} b` + (Vb / n);
EOF
keys="$(sig_keys)"
grep -qxF 'sig|driver-count-scaling|packages/design/engine/keys.ts|export const a = (Vb: number, n: number): number => Vb / n;' <<< "$keys" \
  && ok "a formula line's key leaves out its trailing comment" || bad "key of line a should have no comment: $keys"
grep -qxF "sig|driver-count-scaling|packages/design/engine/keys.ts|export const b = (Vb: number, n: number): string => 'http://x  y' + (Vb / n);" <<< "$keys" \
  && ok "a formula line's key keeps a // inside a string and the string's own spaces" || bad "key of line b should keep 'http://x  y': $keys"
grep -qxF 'sig|driver-count-scaling|packages/design/engine/keys.ts|export const c = (Vb: number, n: number): boolean => /\/\/ no/.test(String(Vb / n));' <<< "$keys" \
  && ok "a formula line's key keeps a // inside a regular expression" || bad "key of line c should keep the regex: $keys"
grep -qxF 'sig|driver-count-scaling|packages/design/engine/keys.ts|export const d = (Vb: number, n: number): string => `a ${`// in`} b` + (Vb / n);' <<< "$keys" \
  && ok "a formula line's key keeps a // inside a nested template" || bad "key of line d should keep the nested template: $keys"
rm "$SCRATCH/packages/design/engine/keys.ts"

# T911 (QO949): a consolidated copy stays in the allow-list, marked resolved and resolved to the engine function; it
# never allows its key again, and an allowed entry whose copy is gone fails until it is marked resolved.
COPY_LINE='export const perDriver = (Vb: number, n: number): number => Vb / n;'
KEY="sig|driver-count-scaling|packages/design/engine/newcopy.ts|$COPY_LINE"
resolved_allow() { node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "packages/design/engine/newcopy.ts:1", count: 1,
  resolved: true, resolved_to: "packages/design/engine/sealedResonance.ts:arrayVas", resolved_by: "T902", ruling: "QO949"}}, null, 1));' "$KEY" > "$SCRATCH/allow.json"; }
allowed_allow() { node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "packages/design/engine/newcopy.ts:1", count: 1}}, null, 1));' "$KEY" > "$SCRATCH/allow.json"; }

# T934: the ratchet. A new allowed entry is refused: the list only shrinks.
allowed_allow
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
echo "$out" | sed 's/^/  | /'
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  new entry: $KEY" <<< "$out"; } \
  && ok "a new entry on the known-copies list is refused (exit 1) by the ratchet, naming its key" || bad "new list entry should exit 1 with the ratchet's 'new entry: <key>', got exit $rc"

# T934 review (finding 2): the reason "help text, no code" is checked, not trusted. Executable code with that reason is
# refused; the same words inside a string (help text) are accepted.
node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "help text, no code (John, QO950)", where: "packages/design/engine/newcopy.ts:1", count: 1}}, null, 1));' "$KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  new entry (its reason says help text, but the match is code, not inside a string or comment): $KEY" <<< "$out"; } \
  && ok "a new entry for executable code with the reason \"help text, no code\" is refused (exit 1), naming its key" || bad "help-text reason on code should exit 1 naming the key, got exit $rc: $out"
HELP_LINE="export const HELP = 'One driver of the array gets Vb / n, as WinISD shows it';"
HELP_KEY="sig|driver-count-scaling|packages/design/engine/help.ts|$HELP_LINE"
rm "$SCRATCH/packages/design/engine/newcopy.ts"; printf '%s\n' "$HELP_LINE" > "$SCRATCH/packages/design/engine/help.ts"
node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "help text, no code (John, QO950)", where: "packages/design/engine/help.ts:1", count: 1}}, null, 1));' "$HELP_KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "a new help-text entry whose match lies inside a string is accepted (exit 0)" || bad "help text in a string should pass, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/help.ts"; printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"

allowed_allow; set_base   # from here on the entry is on the base list
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "an allowed copy that is still there passes (exit 0)" || bad "allowed copy should pass, got exit $rc: $out"

node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "packages/design/engine/newcopy.ts:1", count: 2}}, null, 1));' "$KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  count raised from 1 to 2: $KEY" <<< "$out"; } \
  && ok "raising an entry's count is refused (exit 1) by the ratchet, naming its key" || bad "count raised should exit 1 with 'count raised from 1 to 2: <key>', got exit $rc: $out"

echo '{}' > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  deleted (never delete an entry: mark it resolved): $KEY" <<< "$out"; } && ok "deleting an entry is refused (exit 1)" || bad "deleted entry should exit 1, got exit $rc: $out"
allowed_allow

rm "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
echo "$out" | sed 's/^/  | /'
{ [ "$rc" = 1 ] && grep -q 'mark it resolved' <<< "$out"; } && ok "an allowed entry whose copy is gone fails until it is marked resolved (exit 1)" || bad "stale unresolved entry should exit 1 saying mark it resolved, got exit $rc"

resolved_allow
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "a resolved entry whose copy is gone passes (exit 0)" || bad "resolved entry with its copy absent should pass, got exit $rc: $out"

printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
out="$(run)"; rc=$?
echo "$out" | sed 's/^/  | /'
{ [ "$rc" = 1 ] && grep -q 'consolidated into packages/design/engine/sealedResonance.ts:arrayVas by T902; call packages/design/engine/sealedResonance.ts:arrayVas' <<< "$out"; } \
  && ok "a resolved copy that reappears fails (exit 1) naming the function to call" || bad "reappearing resolved copy should exit 1 naming arrayVas and T902, got exit $rc"
rm "$SCRATCH/packages/design/engine/newcopy.ts"

resolved_allow; set_base
allowed_allow
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  resolved on the base, unresolved here: $KEY" <<< "$out"; } && ok "un-resolving a resolved entry is refused (exit 1)" || bad "un-resolving should exit 1, got exit $rc: $out"

node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, resolved: true}}));' "$KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'resolved_to' <<< "$out"; } && ok "a resolved entry without resolved_to, resolved_by and ruling is refused (exit 1)" || bad "incomplete resolved entry should exit 1 naming resolved_to, got exit $rc: $out"

# T934 review (finding 2): a resolved entry's history is never replaced: not by a new resolved entry naming it in "was",
# and not by rewriting its resolved_to, resolved_by or ruling.
NEWKEY="sig|driver-count-scaling|packages/design/engine/newcopy.ts|export const perDriver = (Vb: number, n: number): number => Vb / n; "
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o,
  resolved: true, resolved_to: "packages/design/engine/elsewhere.ts:other", resolved_by: "T999", ruling: "QO949"}}));' "$NEWKEY" "$KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  resolved entry replaced (a resolved entry's history is never replaced): $KEY" <<< "$out"; } \
  && ok "a resolved entry replaced through another entry's \"was\" is refused (exit 1)" || bad "replacing a resolved entry via was should exit 1 naming it, got exit $rc: $out"
node -e 'const [k] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "packages/design/engine/newcopy.ts:1", count: 1,
  resolved: true, resolved_to: "packages/design/engine/elsewhere.ts:other", resolved_by: "T902", ruling: "QO949"}}));' "$KEY" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  resolved entry rewritten (resolved_to changed): $KEY" <<< "$out"; } \
  && ok "rewriting a resolved entry's resolved_to is refused (exit 1)" || bad "changed resolved_to should exit 1 naming the key, got exit $rc: $out"

# T934: a copy's key ignores comments and whitespace, so rewording a comment inside a known copy keeps its key; an entry
# re-keyed from the old form names it in "was" and is not a new entry.
echo '{}' > "$SCRATCH/allow.json"; set_base
block() { cat << EOF
export function mix(volume: number, area: number, length: number, count: number): number {
  const total = volume * area + length * count - volume / area + length / count;
  const other = total * volume + area * length - count / total + volume / length;
  // $1
  const third = other * total + volume * area - length / other + count / volume; /* $1 */
  const fourth = third * other + total * volume - area / third + length / count;
  return fourth + third + other + total + volume + area + length + count;
}
EOF
}
# jscpd itself matches comments, so a comment reworded inside a known copy is reworded in both places
block 'one comment' > "$SCRATCH/packages/design/engine/a.ts"; block 'one comment' > "$SCRATCH/packages/design/engine/b.ts"
copy_keys() { node "$REPO/scripts/dupscan.mjs" "$SCRATCH" --jscpd "$JSCPD" --allow "$SCRATCH/allow.json" --homes "$SCRATCH/homes.json" --base base --report "$SCRATCH/r.json" > /dev/null 2>&1
  node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).findings.filter(f => f.kind === "copy").map(f => f.key).sort().join("\n"))' "$SCRATCH/r.json"; }
before="$(copy_keys)"
block 'the comment, reworded at length' > "$SCRATCH/packages/design/engine/a.ts"; block 'the comment, reworded at length' > "$SCRATCH/packages/design/engine/b.ts"
after="$(copy_keys)"
{ [ -n "$before" ] && [ "$before" = "$after" ]; } && ok "rewording the comments inside a copy keeps its key" || bad "copy key should not change with comments: before [$before] after [$after]"
sed -i 's/volume \* area + length/volume * area * length/' "$SCRATCH/packages/design/engine/a.ts" "$SCRATCH/packages/design/engine/b.ts"
changed="$(copy_keys)"
{ [ -n "$changed" ] && [ "$changed" != "$before" ]; } && ok "changing the code inside a copy changes its key" || bad "code change should change the copy key: [$before] -> [$changed]"
# A "/*" inside a regular expression is not a comment: code after it still counts for the key.
rx_block() { cat << EOF
export function scan(volume: number, area: number, length: number, count: number): number {
  const re = /a\/*b/;
  const total = volume * area + length * count - volume / area + length / count;
  const other = total * volume + area * length - count / total + volume / length;
  const third = other * total + volume * area - length / other + count / volume;
  const fourth = third * other + total * volume - area / third + length / count + (re.test('x') ? 1 : 0);
  return fourth + third + other + total + volume + area + length + $1;
}
EOF
}
rx_block count > "$SCRATCH/packages/design/engine/a.ts"; rx_block count > "$SCRATCH/packages/design/engine/b.ts"
before="$(copy_keys)"
rx_block 'count * 2' > "$SCRATCH/packages/design/engine/a.ts"; rx_block 'count * 2' > "$SCRATCH/packages/design/engine/b.ts"
after="$(copy_keys)"
{ [ -n "$before" ] && [ -n "$after" ] && [ "$before" != "$after" ]; } \
  && ok "a /* inside a regular expression does not hide the code after it from the copy's key" || bad "code after /a\\/*b/ should change the key: [$before] -> [$after]"
rm "$SCRATCH/packages/design/engine/a.ts" "$SCRATCH/packages/design/engine/b.ts"

OLD='sig|driver-count-scaling|packages/design/engine/newcopy.ts|old form of the key'
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$OLD" > "$SCRATCH/allow.json"; set_base
printf '%s\n' "$COPY_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$KEY" "$OLD" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
[ "$rc" = 0 ] && ok "an entry re-keyed with \"was\" naming its old key on the base passes (exit 0)" || bad "re-keyed entry should pass, got exit $rc: $out"
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}, [k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$KEY" "$OLD" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "is not an unresolved base entry this one replaces): $KEY" <<< "$out"; } \
  && ok "a \"was\" whose old key is still listed is a new entry and is refused (exit 1)" || bad "was with the old key kept should exit 1 naming the key, got exit $rc: $out"
# T934 review (finding 2): "was" moves one finding to its new key: the same rule and the same file (a copy: the same two
# files), one new key for one old key. An allowance is never carried to another rule or another file.
OTHER_RULE='sig|decibel|packages/design/engine/newcopy.ts|old form of the key'
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$OTHER_RULE" > "$SCRATCH/allow.json"; set_base
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$KEY" "$OTHER_RULE" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  new entry (its \"was\" is another rule or another file, not this finding's old key): $KEY" <<< "$out"; } \
  && ok "a \"was\" naming another rule's entry is refused (exit 1)" || bad "was across rules should exit 1 naming the key, got exit $rc: $out"
OTHER_FILE='sig|driver-count-scaling|packages/design/engine/elsewhere.ts|old form of the key'
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$OTHER_FILE" > "$SCRATCH/allow.json"; set_base
node -e 'const [k, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}}));' "$KEY" "$OTHER_FILE" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  new entry (its \"was\" is another rule or another file, not this finding's old key): $KEY" <<< "$out"; } \
  && ok "a \"was\" naming another file's entry is refused (exit 1)" || bad "was across files should exit 1 naming the key, got exit $rc: $out"
SECOND_LINE='export const perDriver2 = (Vb: number, n: number): number => Vb / n;'
KEY2="sig|driver-count-scaling|packages/design/engine/newcopy.ts|$SECOND_LINE"
printf '%s\n%s\n' "$COPY_LINE" "$SECOND_LINE" > "$SCRATCH/packages/design/engine/newcopy.ts"
node -e 'const [o] = process.argv.slice(1); console.log(JSON.stringify({[o]: {reason: "baseline", where: "x:1", count: 1}}));' "$OLD" > "$SCRATCH/allow.json"; set_base
node -e 'const [k, k2, o] = process.argv.slice(1); console.log(JSON.stringify({[k]: {reason: "baseline", where: "x:1", count: 1, was: o}, [k2]: {reason: "baseline", where: "x:2", count: 1, was: o}}));' "$KEY" "$KEY2" "$OLD" > "$SCRATCH/allow.json"
out="$(run)"; rc=$?
{ [ "$rc" = 1 ] && grep -q 'grew against base' <<< "$out" && grep -qF "  new entry (its \"was\" is claimed by 2 entries; one old key moves to one new key)" <<< "$out"; } \
  && ok "one old key claimed by two entries' \"was\" is refused (exit 1)" || bad "two entries with one was should exit 1, got exit $rc: $out"
rm "$SCRATCH/packages/design/engine/newcopy.ts"

out="$(node "$REPO/scripts/dupscan.mjs" "$REPO" --jscpd "$JSCPD" --allow "$REPO/scripts/dupscan-allow.json" --homes "$REPO/scripts/dupscan-homes.json" --base origin/main 2>&1)"; rc=$?
[ "$rc" = 0 ] && ok "this repo passes with the shipped allow-list and homes, against origin/main" || bad "repo should pass with its allow-list, got exit $rc: $out"

[ "$fails" = 0 ] || { echo "dupscan.test: $fails failed"; exit 1; }
echo "dupscan.test: all passed"
