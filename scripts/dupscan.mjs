#!/usr/bin/env node
// dupscan: find duplicated logic in OpenISD and refuse NEW copies (a ratchet).
//
// Two deterministic checks, no AI:
//   1. Copy detector (jscpd) over packages/ (.ts, .vue; tests, generated files and node_modules left out).
//   2. Formula signatures: regexes for the physics and conversions the engine owns (driver-count
//      scaling, sealed resonance, resonance/compliance, dB, air, unit factors, rounding), plus "any
//      maths in packages/ui". Each hit is keyed by rule + file + the line's own text (no line number,
//      so moving code does not trip the gate; editing the line does).
//
// Every finding must be listed in the allow-list (dupscan-allow.json) with a reason; anything else
// fails the run (exit 1). The first run writes the current state as the baseline:
//   node dupscan.mjs <repo> --homes <homes.json> --write-baseline           # record today's findings, reason "baseline"
//   node dupscan.mjs <repo> --homes <homes.json> --base origin/main         # gate: exit 1 on any finding not in the allow-list
//   node dupscan.mjs <repo> --homes <homes.json> --base origin/main --report out.json   # also write every finding to a file
// Options: --allow <file> (default: dupscan-allow.json next to this script), --jscpd <path to jscpd bin>.
// CI (.github/workflows/pr.yml): --allow scripts/dupscan-allow.json --homes scripts/dupscan-homes.json --base origin/main.
//
// A copy that has been consolidated into the engine is never deleted from the allow-list: its entry stays, marked
//   "resolved": true, "resolved_to": "<engine file>:<function>", "resolved_by": "<task id>", "ruling": "<questions.yml id>"
// (John, QO949, 18 Nov 2026: "old entries stay, marked 'resolved, resolved to <engine function> by T902'; a resolved copy
// that reappears fails"). A resolved entry never allows its key: the copy reappearing fails, naming the function to call.
// An allowed (unresolved) entry whose key no longer matches anything is stale and fails the run (exit 1) until it is
// marked resolved, so every consolidation is recorded.
//
// T934 (John, 19 Nov 2026: "why wasn't the consolidation finished - our guard rail isn't working / remove the dupe and fix
// the guardrail"):
//   - Homes (--homes, scripts/dupscan-homes.json): each kind of sum names its home, the engine function (file:function) or
//     engine file that owns it. A match inside its kind's home is the engine doing its job, not a copy; anywhere else it is a
//     finding, and the refusal names the home to call. A declared home that does not exist, or lies outside
//     packages/design/engine/, fails the run. A kind with no home behaves as before.
//   - Ratchet (--base <git ref>): the allow-list is compared with the one on the base commit and may only shrink. Refused:
//     a new unresolved entry (except help text: a reason starting "help text, no code", QO950), a raised count, a deleted
//     entry, and a resolved entry made unresolved. An entry re-keyed (the key's form changed) names its old key in "was";
//     the old key must be on the base list and gone from this one.
//   - A copy's key hashes its code with comments and whitespace removed, so rewording a comment keeps the key.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const repo = args.find(a => !a.startsWith('--') && !isOptionValue(a));
function isOptionValue(a) { const i = args.indexOf(a); return i > 0 && ['--allow', '--jscpd', '--report', '--homes', '--base'].includes(args[i - 1]); }
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const USAGE = 'usage: node dupscan.mjs <openisd checkout> --homes <homes.json> (--base <git ref> | --write-baseline) [--allow file] [--report file] [--jscpd bin]';
if (!repo) { console.error(USAGE); process.exit(2); }
const allowPath = opt('--allow') ?? join(here, 'dupscan-allow.json');
// No default for the homes or the base: a run that forgot them would quietly check less.
const homesPath = opt('--homes');
const baseRef = opt('--base');
const jscpdBin = opt('--jscpd') ?? join(repo, 'node_modules/.bin/jscpd');
const writeBaseline = args.includes('--write-baseline');
if (homesPath === null || (baseRef === null && !writeBaseline)) { console.error(USAGE); process.exit(2); }

const IGNORE = ['**/node_modules/**', '**/test/**', '**/*.test.ts', '**/*.spec.ts', '**/generated/**', '**/*.generated.ts',
  '**/dist/**', '**/coverage/**', '**/ui-proposals/**', '**/*.config.ts'];

// ---- 1. copy detector ------------------------------------------------------------------------------
function copies() {
  if (!existsSync(jscpdBin)) { console.error(`jscpd not found at ${jscpdBin} (it is a devDependency: npm ci)`); process.exit(2); }
  const out = mkdtempSync(join(tmpdir(), 'dupscan-'));
  execFileSync(jscpdBin, ['packages', '--format', 'typescript,vue', '--min-tokens', '50', '--ignore', IGNORE.join(','),
    '--reporters', 'json', '--output', out, '--silent'], {cwd: repo, stdio: ['ignore', 'ignore', 'inherit']});
  // jscpd exits 0 and writes no report when it finds no clone at all (a tree with nothing to compare); a crash exits non-zero above
  if (!existsSync(join(out, 'jscpd-report.json'))) return [];
  const report = JSON.parse(readFileSync(join(out, 'jscpd-report.json'), 'utf8'));
  return report.duplicates.map(d => {
    const a = d.firstFile.name, b = d.secondFile.name;
    const norm = withoutComments(d.fragment ?? '').replace(/\s+/g, ' ').trim();
    const hash = createHash('sha1').update(norm).digest('hex').slice(0, 12);
    const [f1, f2] = [a, b].sort();
    return {kind: 'copy', key: `copy|${f1}|${f2}|${hash}`, where: `${a}:${d.firstFile.start}-${d.firstFile.end} = ${b}:${d.secondFile.start}-${d.secondFile.end}`, lines: d.lines};
  });
}

/** `code` with its // and /* *\/ comments and <!-- --> blocks taken out; string and template literals are kept whole, so a
 *  "//" inside a string (a URL) is not taken for a comment. */
function withoutComments(code) {
  let out = '';
  for (let i = 0; i < code.length;) {
    const ch = code[i], two = code.slice(i, i + 2);
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) j += code[j] === '\\' ? 2 : 1;
      out += code.slice(i, j + 1); i = j + 1;
    } else if (two === '//') { const j = code.indexOf('\n', i); i = j < 0 ? code.length : j; }
    else if (two === '/*') { const j = code.indexOf('*/', i + 2); i = j < 0 ? code.length : j + 2; out += ' '; }
    else if (code.startsWith('<!--', i)) { const j = code.indexOf('-->', i + 4); i = j < 0 ? code.length : j + 3; out += ' '; }
    else { out += ch; i += 1; }
  }
  return out;
}

// ---- 2. formula signatures -------------------------------------------------------------------------
// Each rule: id, what it means in plain words, regex, and (optional) the directories it applies to.
const RULES = [
  {id: 'driver-count-scaling', what: 'N drivers scaled into one (n x Sd, Mms/n, Vb/n, x nDrivers)',
    re: /\b(nDrivers|numDrivers|driverCount)\b(\(\))?\s*\|*\s*\d*\)?\s*[*\/][^>]|[*\/]\s*\(?\s*(P\.|this\.#|p\.)?(nDrivers|numDrivers)\b|Sd_m2\s*\*\s*n\b|[^<]\/\s*n\s*[,;)]|\bVb\s*\/\s*n\b/},
  {id: 'coil-wiring-scaling', what: 'voice-coil wiring scaling of Re/BL/Znom (numVC, series/parallel factor)',
    re: /\bnumVC\b\s*[*\/]|[*\/]\s*numVC\b|wiring(\.value)?\s*===\s*["'](series|parallel)["']\s*\?\s*[A-Za-z]+\s*:\s*1\s*\//},
  {id: 'sealed-box-ratio', what: 'sealed resonance factor sqrt(1 + Vas/Vb) or its inverse (Qtc/Qts)^2 - 1',
    re: /sqrt\(\s*1\s*\+\s*[A-Za-z_.]*[Vv]as|\(\s*[A-Za-z_.]*Q[a-z]*c\s*\/\s*[A-Za-z_.]*Q[a-z]*s?\s*\)\s*\*\*\s*2\s*-\s*1/},
  {id: 'resonance-mass-compliance', what: 'resonance from mass and compliance 1/(2 pi sqrt(M C)) or its inverse',
    re: /1\s*\/\s*\(\s*(2\s*\*\s*Math\.PI|TAU)\s*\*\s*Math\.sqrt|1\s*\/\s*\(\s*\(\s*(2\s*\*\s*Math\.PI|TAU)\s*\*[^)]*\)\s*\*\*\s*2/},
  {id: 'q-parallel', what: 'Qts from Qes and Qms, or a source-loaded Qes',
    re: /Qes[A-Za-z_]*\s*\*\s*[A-Za-z_.]*Qms|Qms[A-Za-z_]*\s*\*\s*[A-Za-z_.]*Qes|1\s*\/\s*\(\s*1\s*\/\s*[A-Za-z_.]*Q[a-z]*s[A-Za-z_]*\s*\+\s*1\s*\/|\(\s*[A-Za-z_.]*(re|Re)[A-Za-z_]*\s*\+\s*[^)]*(rg|Rg|RG|rs|Rs)[A-Za-z_]*\)\s*\)?\s*\/\s*[A-Za-z_.]*(re|Re)\b/},
  {id: 'bl-from-qes', what: 'BL from Re, Fs, Qes and Cms',
    re: /Math\.sqrt\([^)]*Re[A-Za-z_]*\s*\/\s*\(\s*(2\s*\*\s*Math\.PI|TAU)\s*\*[^)]*Qes/},
  {id: 'air-compliance', what: 'acoustic compliance V/(rho c^2) or Vas = rho c^2 Sd^2 Cms',
    re: /(rho|roo)[A-Za-z_()]*\s*\*\s*[A-Za-z_.]*c[A-Za-z_()]*\s*\*\s*[A-Za-z_.]*c\b(\(\))?/},
  {id: 'circle-area', what: 'port or cone area from diameter, or diameter from area',
    re: /Math\.PI\s*\*\s*\(?\s*[A-Za-z_.!]+\s*\/\s*2\s*\)?\s*\*\*\s*2|2\s*\*\s*Math\.sqrt\(\s*[A-Za-z_.!]+\s*\/\s*Math\.PI\s*\)/},
  {id: 'displacement', what: 'displacement Vd = Sd x Xmax',
    re: /[Ss]d[A-Za-z_0-9]*\s*\*\s*[A-Za-z_.0-9!]*[Xx]max|[Xx]max[A-Za-z_0-9]*\s*\*\s*[A-Za-z_.0-9!]*[Ss]d\b/},
  {id: 'decibel', what: 'dB conversion 10 log10 / 20 log10 / 10^(x/20)',
    re: /(10|20)\s*\*\s*Math\.log10|Math\.pow\(\s*10\s*,[^)]*\/\s*(10|20)\s*\)|10\s*\*\*\s*\([^)]*\/\s*(10|20)\s*\)/},
  {id: 'drive-voltage-power', what: 'power and voltage through Re (V^2/R, sqrt(P R), the 2.83 V reference)',
    re: /\b2\.83\b|Math\.sqrt\(\s*[A-Za-z_.]*(pin|power|Pe|P)[A-Za-z_]*\s*\*\s*\(?\s*[A-Za-z_.]*(re|Re)/},
  {id: 'end-correction', what: 'port end correction constant or literal',
    re: /\b0\.732\b|\b0\.613\b|END_CORRECTION\b/},
  {id: 'air-defaults', what: 'reference air: 293.15 K, 101325 Pa, 30 %',
    re: /\b293\.15\b|\b101325\b/},
  {id: 'unit-factor', what: 'hand-written unit conversion (litres, cm, mm, inches, cm2, cm3)',
    re: /[*\/]\s*(1000|1e3|1e-3|1e6|1e-6|10_?000|0\.0254|2\.54|25\.4|100)\b(?!\s*\*\s*1000)/,
    skip: /setTimeout|ms\b|_ms|Ms\b|Date|delay|seconds|bytes|interval|elapsed|percent|Pct|pct|%|devicePixelRatio|scale\b/},
  {id: 'display-rounding', what: 'rounding a number for display outside the field formatter',
    re: /\.toFixed\(|\.toPrecision\(|Math\.round\([^)]*\*\s*(10|100|1000|scale)\b/},
  {id: 'ui-maths', what: 'arithmetic maths in packages/ui (the UI is display only)', dirs: ['packages/ui/src/'],
    re: /Math\.(sqrt|pow|log|log10|exp|PI|hypot)\b|\*\*\s*\d/},
];

// ---- homes: where each kind of sum lives -------------------------------------------------------------
// homes.json: {"<rule id>": ["<engine file>" | "<engine file>:<function or const>", ...]}. A whole file is a home when the
// file itself is the kind's one place (engine/array/driverWiring.ts: N identical drivers); a function when only it is.
const homeErrors = [];
const homeSpans = loadHomes();   // [{rule, file, from, to, home}] with 0-based inclusive line numbers

function loadHomes() {
  const declared = JSON.parse(readFileSync(homesPath, 'utf8'));
  const spans = [];
  for (const [rule, homes] of Object.entries(declared)) {
    if (!RULES.some(r => r.id === rule)) { homeErrors.push(`${rule}: no such kind of sum`); continue; }
    for (const home of homes) {
      const [file, fn] = home.split(':');
      if (!file.startsWith('packages/design/engine/')) { homeErrors.push(`${rule}: home ${home} is not in packages/design/engine/`); continue; }
      const path = join(repo, file);
      if (!existsSync(path)) { homeErrors.push(`${rule}: home ${home}: no such file`); continue; }
      const lines = readFileSync(path, 'utf8').split('\n');
      if (fn === undefined) { spans.push({rule, file, from: 0, to: lines.length - 1, home}); continue; }
      const span = declarationSpan(lines, fn);
      if (typeof span === 'string') { homeErrors.push(`${rule}: home ${home}: ${span}`); continue; }
      spans.push({rule, file, ...span, home});
    }
  }
  return spans;
}

/** The lines of the one declaration of `name` in `lines` (a function, a const or a class method), or why not. */
function declarationSpan(lines, name) {
  const decl = new RegExp(`^\\s*(export\\s+)?(async\\s+)?(function\\s+${name}\\b|(const|let)\\s+${name}\\b)`);
  const method = new RegExp(`^\\s*((static|readonly|private|public|protected|async)\\s+)*${name}\\s*[(<]`);
  const starts = lines.map((l, i) => ({l, i})).filter(({l}) => decl.test(l) || (method.test(l) && !l.trim().endsWith(';')));
  if (starts.length !== 1) return starts.length === 0 ? 'not declared there' : `declared ${starts.length} times there`;
  const from = starts[0].i, isConst = /\b(const|let)\s/.test(lines[from].split(name)[0]);
  // Count brackets, skipping strings and comments. A const ends at its ";" at depth 0; a function or method at the "}"
  // closing the first "{" opened at depth 0 after its parameters.
  let depth = 0, paramsDone = false, body = false, block = false;
  for (let i = from; i < lines.length; i++) {
    const t = lines[i];
    for (let j = 0; j < t.length; j++) {
      const ch = t[j];
      if (block) { if (t.startsWith('*/', j)) { block = false; j++; } continue; }
      if (t.startsWith('//', j)) break;
      if (t.startsWith('/*', j)) { block = true; j++; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { let k = j + 1; while (k < t.length && t[k] !== ch) k += t[k] === '\\' ? 2 : 1; j = k; continue; }
      if (isConst && ch === ';' && depth === 0) return {from, to: i};
      if ('([{'.includes(ch)) {
        if (!isConst && ch === '{' && depth === 0 && paramsDone) body = true;
        depth++;
      } else if (')]}'.includes(ch)) {
        depth--;
        if (depth === 0 && ch === ')') paramsDone = true;
        if (depth === 0 && body) return {from, to: i};
      }
    }
  }
  return 'its end was not found';
}

function homeOf(rule, rel, line) {
  return homeSpans.find(h => h.rule === rule && h.file === rel && line >= h.from && line <= h.to)?.home ?? null;
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (['node_modules', 'test', 'dist', 'coverage', 'generated', 'ui-proposals'].includes(name)) continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (/\.(ts|vue)$/.test(name) && !/\.(test|spec|generated)\.ts$|\.config\.ts$|\.d\.ts$/.test(name)) files.push(p);
  }
  return files;
}

function signatures() {
  const hits = [];
  for (const file of walk(join(repo, 'packages'))) {
    const rel = relative(repo, file);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--') || t.startsWith('import ')) return;
      for (const r of RULES) {
        if (r.dirs && !r.dirs.some(d => rel.startsWith(d))) continue;
        if (!r.re.test(line) || (r.skip && r.skip.test(line))) continue;
        hits.push({kind: 'signature', rule: r.id, what: r.what, key: `sig|${r.id}|${rel}|${t.replace(/\s+/g, ' ')}`, where: `${rel}:${i + 1}`, layer: layerOf(rel), home: homeOf(r.id, rel, i)});
      }
    });
  }
  return hits;
}

function layerOf(rel) {
  if (rel.startsWith('packages/design/engine/')) return 'engine';
  if (rel.startsWith('packages/design/domain/')) return 'domain';
  if (rel.startsWith('packages/ui/')) return 'ui';
  return rel.split('/').slice(0, 3).join('/');
}

// ---- gate ------------------------------------------------------------------------------------------
const findings = [...copies(), ...signatures()];
const groups = {};
for (const f of findings.filter(f => f.kind === 'signature')) (groups[f.rule] ??= new Set()).add(f.layer);

if (opt('--report')) writeFileSync(opt('--report'), JSON.stringify({findings, layersPerRule: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, [...v]]))}, null, 2));

if (writeBaseline) {
  // Resolved entries are the record of consolidations (QO949): a new baseline keeps them.
  const previous = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, 'utf8')) : {};
  const entries = Object.fromEntries(Object.entries(previous).filter(([, e]) => e.resolved === true));
  for (const f of findings) {
    const e = entries[f.key] ??= {reason: 'baseline 2026-11-18 (QO946.c256)', where: f.where, count: 0};
    e.count += 1;
  }
  writeFileSync(allowPath, JSON.stringify(entries, null, 1) + '\n');
  console.log(`wrote ${Object.keys(entries).length} allow-list entries to ${allowPath}`);
  process.exit(0);
}

const allowFile = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, 'utf8')) : {};
const resolved = Object.fromEntries(Object.entries(allowFile).filter(([, e]) => e.resolved === true));
const allow = Object.fromEntries(Object.entries(allowFile).filter(([, e]) => e.resolved !== true));
const incomplete = Object.keys(resolved).filter(k => !['resolved_to', 'resolved_by', 'ruling'].every(f => typeof resolved[k][f] === 'string' && resolved[k][f] !== ''));
// A match inside its kind's home is not a copy (T934).
const inHome = findings.filter(f => f.home);
const active = findings.filter(f => !f.home);
const homeOfKey = Object.fromEntries(inHome.map(f => [f.key, f.home]));
const seen = new Set(active.map(f => f.key));
const counts = {};
const fresh = active.filter(f => { counts[f.key] = (counts[f.key] ?? 0) + 1; return !(f.key in allow) || counts[f.key] > (allow[f.key].count ?? 1); });
const back = fresh.filter(f => f.key in resolved);
const unlisted = fresh.filter(f => !(f.key in resolved));
const stale = Object.keys(allow).filter(k => !seen.has(k));
const ratchet = ratchetAgainstBase();

/** Why the allow-list grew against the one on the base commit (T934: it may only shrink). */
function ratchetAgainstBase() {
  const rel = relative(repo, allowPath);
  if (rel.startsWith('..')) return [`the allow-list ${allowPath} is not inside ${repo}, so it cannot be compared with the base`];
  let base;
  try { base = JSON.parse(execFileSync('git', ['-C', repo, 'show', `${baseRef}:${rel}`], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})); }
  catch (e) { return [`cannot read ${rel} at the base ${baseRef}: ${String(e.stderr ?? e.message).trim()}`]; }
  const out = [];
  const renamedFrom = new Map(Object.entries(allowFile).filter(([, e]) => typeof e.was === 'string' && !(e.was in allowFile)).map(([k, e]) => [e.was, k]));
  for (const [k, b] of Object.entries(base)) {
    const e = allowFile[k];
    if (e === undefined && !renamedFrom.has(k)) out.push(`deleted (never delete an entry: mark it resolved): ${k.slice(0, 140)}`);
    else if (e !== undefined && b.resolved === true && e.resolved !== true) out.push(`resolved on the base, unresolved here: ${k.slice(0, 140)}`);
    else if (e !== undefined && e.resolved !== true && (e.count ?? 1) > (b.count ?? 1)) out.push(`count raised from ${b.count ?? 1} to ${e.count}: ${k.slice(0, 140)}`);
  }
  for (const [k, e] of Object.entries(allowFile)) {
    if (k in base || e.resolved === true) continue;
    if (typeof e.was === 'string') {
      const b = base[e.was];
      if (b !== undefined && b.resolved !== true && !(e.was in allowFile) && renamedFrom.get(e.was) === k && (e.count ?? 1) <= (b.count ?? 1)) continue;
      out.push(`new entry (its "was" ${e.was.slice(0, 60)} is not an unresolved base entry this one replaces): ${k.slice(0, 140)}`);
      continue;
    }
    if (typeof e.reason === 'string' && e.reason.startsWith('help text, no code')) continue;
    out.push(`new entry: ${k.slice(0, 140)}`);
  }
  return out;
}

console.log(`dupscan: ${findings.length} findings (${findings.filter(f => f.kind === 'copy').length} copies, ${findings.filter(f => f.kind === 'signature').length} formula signatures, ${inHome.length} of them in their kind's home), ${Object.keys(allow).length} allowed, ${Object.keys(resolved).length} resolved`);
for (const [rule, layers] of Object.entries(groups)) console.log(`  ${rule.padEnd(26)} in: ${[...layers].join(', ')}`);
const homesOf = rule => homeSpans.filter(h => h.rule === rule).map(h => h.home).filter((h, i, all) => all.indexOf(h) === i);
const where = f => {
  if (f.kind === 'copy') return `copy ${f.lines} lines: ${f.where}`;
  const homes = homesOf(f.rule);
  return `${f.rule} (${f.layer}) ${f.where}: ${f.what}${homes.length ? `\n    the engine's home for this sum: call ${homes.join(' or ')}` : ''}`;
};
if (homeErrors.length) {
  console.log(`\nFAIL: ${homeErrors.length} declared homes are wrong (${homesPath}); a home is an engine file or file:function that exists:`);
  for (const e of homeErrors) console.log(`  ${e}`);
}
if (ratchet.length) {
  console.log(`\nFAIL: the allow-list (${allowPath}) grew against ${baseRef}; it only shrinks (T934; only a help-text entry, reason "help text, no code", may be added):`);
  for (const e of ratchet) console.log(`  ${e}`);
}
if (incomplete.length) {
  console.log(`\nFAIL: ${incomplete.length} resolved allow-list entries lack resolved_to, resolved_by or ruling (${allowPath}):`);
  for (const k of incomplete) console.log(`  ${resolved[k].where}  ${k.slice(0, 140)}`);
}
if (stale.length) {
  console.log(`\nFAIL: ${stale.length} allowed entries no longer match (copy removed or line edited). Never delete one: mark it resolved, with resolved_to (the engine function now used), resolved_by (the task) and ruling (QO949):`);
  for (const k of stale) console.log(`  ${allow[k].where}  ${k.slice(0, 140)}${k in homeOfKey ? `\n    this line is inside its kind's home: mark it resolved with resolved_to ${homeOfKey[k]}` : ''}`);
}
if (back.length) {
  console.log(`\nFAIL: ${back.length} consolidated copies are back:`);
  for (const f of back) { const e = resolved[f.key]; console.log(`  ${where(f)}\n    this copy was consolidated into ${e.resolved_to} by ${e.resolved_by}; call ${e.resolved_to}`); }
}
if (unlisted.length) {
  console.log(`\nFAIL: ${unlisted.length} new duplicated logic not in the allow-list (${allowPath}):`);
  for (const f of unlisted) console.log(`  ${where(f)}`);
  console.log('\nCall the engine function that owns the sum (move the calculation into the engine first if it has none). The allow-list only shrinks: a new entry is refused.');
}
if (homeErrors.length || ratchet.length || incomplete.length || stale.length || back.length || unlisted.length) process.exit(1);
console.log('\nOK: no new duplicated logic.');
