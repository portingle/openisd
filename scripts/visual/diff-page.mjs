#!/usr/bin/env node
// Writes a before/after page for John: one item per picture, each with its own comment box.
//   node scripts/visual/diff-page.mjs <outdir> <title> <entries.json> [note] [--ranked]
// entries.json: [{"name": "mobile-wizard-sealed-step4", "before": "/path/a.png", "after": "/path/b.png", "diff": "/path/d.png"}]
// note: one or two plain sentences on what the user sees change (the task file's visual_note); shown under the title
// and in the first picture's Look at line.
// before, after and diff may each be null (a new or removed screen, or no diff picture). Pictures are
// copied into <outdir>, so the page stands alone.
// The page itself is made by scripts/feedback/feedback-page.py (rule: John's pages are never hand-built):
// this script copies the pictures, marks them with scripts/feedback/mark-diff.py (a red box on what changed,
// or on the whole screen when nothing can be told apart), writes <outdir>/index.md and runs the tool.
// Comments go to the board item in VISUAL_FEEDBACK_ITEM (default QO284).
import {spawnSync} from 'node:child_process';
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {groupLeaders} from './groups.mjs';
import {plainScreenName, screenFamily} from './screen-names.mjs';

const [outDir, title, entriesFile, note = '', mode] = process.argv.slice(2);
if (!outDir || !title || !entriesFile) {
  console.error('usage: diff-page.mjs <outdir> <title> <entries.json> [note] [--ranked]');
  process.exit(2);
}
const galleryBin = process.env.VISUAL_GALLERY_BIN ?? resolve(dirname(fileURLToPath(import.meta.url)), '../feedback');
const item = process.env.VISUAL_FEEDBACK_ITEM ?? 'QO284';
const ranked = mode === '--ranked';
mkdirSync(outDir, {recursive: true});

const cell = text => String(text).replace(/\|/g, '/').replace(/\n/g, ' ');
const run = (script, args) => spawnSync(process.env.VISUAL_PYTHON ?? 'python3', [join(galleryBin, script), ...args],
  {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});

function copy(name, kind, source) {
  if (source === null || source === undefined) return null;
  const file = `${name}.${kind}.png`;
  copyFileSync(source, join(outDir, file));
  return file;
}

// PNG width and height are the two big-endian ints after the 8-byte signature and the IHDR header.
function size(file) {
  const head = readFileSync(join(outDir, file)).subarray(0, 24);
  return [head.readUInt32BE(16), head.readUInt32BE(20)];
}

function markWhole(file) {
  let w, h;
  try { [w, h] = size(file); } catch { return null; }  // not a picture: nothing to mark
  return run('mark-diff.py', [join(outDir, file), '--box', `0,0,${w},${h}`]);
}

// Marks the pair and returns the changed box {before, after} as mark-diff.py drew it, or null when the pair has
// no box (new, removed, same, or the change fills the picture): such a pair is its own group.
function mark(before, after, diff) {
  let box = null;
  if (before && after) {
    const r = run('mark-diff.py', [join(outDir, before), join(outDir, after), '--print-box']);
    if (r.status === 1 || r.status === 2) { markWhole(before); markWhole(after); }  // same, or the change fills the picture
    else if (r.status !== 0) console.error(`mark-diff failed: ${r.stderr}`);
    else box = JSON.parse(r.stdout.trim().split('\n').pop());
  } else {
    for (const f of [before, after]) if (f) markWhole(f);
  }
  if (diff) run('mark-diff.py', ['--stamp', join(outDir, diff)]);
  return box;
}

function look(screen, before, after, diff, isLeader) {
  if (!before) return `${screen}, the whole screen: it is new, there is no before picture`;
  if (!after) return `${screen}, the whole screen: it is removed, there is no after picture`;
  if (!isLeader) return `${screen}, the same change as the first picture of this group.`;
  const what = note && !ranked ? `the red boxes: ${note}` : 'the red boxes show what changed';
  return `${screen}, ${what}${diff ? ' (the third picture shows where they differ)' : ''}`;
}

function prepare(entry) {
  const before = copy(entry.name, 'before', entry.before);
  const after = copy(entry.name, 'after', entry.after);
  const diff = copy(entry.name, 'diff', entry.diff);
  const box = mark(before, after, diff);
  return {entry, before, after, diff, box};
}

function rankedScreens() {
  const marks = run('mark-diff.py', ['--ranked', outDir, entriesFile]);
  if (marks.status !== 0 || marks.error) {
    console.error(`mark-diff failed: ${marks.error ?? marks.stderr}`);
    process.exit(1);
  }
  return JSON.parse(marks.stdout).map(({name, before, after}) => ({entry: {name}, before, after}));
}

const prepared = ranked
  ? rankedScreens().map(p => ({...p, family: screenFamily(p.entry.name)}))
    .sort((a, b) => a.family.localeCompare(b.family))
  : JSON.parse(readFileSync(entriesFile, 'utf8')).map(prepare);
const leaders = ranked ? prepared.map((_, i) => i) : groupLeaders(prepared.map(p => ({name: p.entry.name, box: p.box})));
const followers = leaders.map((_, i) => leaders.filter((x, k) => x === i && k !== i).length);  // pictures folded under entry i

// index.md row: Fix | Task | State | Pictures | Look at | Same as. Fix is the screen in words; Task and State stay empty
// (the page shows neither). Same as is the leader's screen name, empty for a group's first picture.
// feedback-page.template.html folds every row that names a leader under that leader, with its own comment box.
const names = prepared.map(p => plainScreenName(p.entry.name));
const rows = prepared.map(({before, after, diff, family}, i) => {
  const links = [['before', before], ['after', after], ['difference', diff]].filter(([, f]) => f).map(([label, f]) => {
    const url = ranked ? f.split('/').map(part => encodeURIComponent(part).replace(/\(/g, '%28').replace(/\)/g, '%29')).join('/') : f;
    return `[${label}](${url})`;
  });
  const more = followers[i];
  const lookText = look(names[i], before, after, diff, leaders[i] === i);
  const text = more ? `${lookText.replace(/\.$/, '')}. The same change shows in ${more} more picture${more === 1 ? '' : 's'}, folded below.` : lookText;
  const leader = leaders[i] === i ? '' : names[leaders[i]];
  const row = [cell(names[i]), '', '', links.join(' '), cell(text), cell(leader)];
  if (ranked) row.push(family);
  return row;
});

const table = rows.map(row => `| ${row.join(' | ')} |`).join('\n');
writeFileSync(join(outDir, 'index.md'), `# ${cell(title)}\n| Fix | Task | State | Pictures | Look at | Same as |${ranked ? ' Family |' : ''}\n|---|---|---|---|---|---|${ranked ? '---|' : ''}\n${table}\n`);
const todo = ranked
  ? (rows.length ? 'Compare the cropped pictures. The biggest changes in each group appear first.' : 'No screens changed.')
  : 'Look at the red boxes and type under each picture whether the new look is right or wrong. Nothing else to do.';
const args = [outDir, '--item', item, '--todo', todo, '--note', note];
if (ranked) {
  const renderedRows = join(dirname(entriesFile), 'rows.json');
  writeFileSync(renderedRows, JSON.stringify(rows));
  args.push('--standalone-rows', renderedRows);
}
const page = run('feedback-page.py', args);
if (page.status !== 0 || page.error) { console.error(`feedback-page.py failed: ${page.error ?? page.stderr}`); process.exit(1); }
const groupCount = ranked ? new Set(prepared.map(p => p.family)).size : leaders.filter((l, i) => l === i).length;
console.log(`${prepared.length} screen(s) in ${groupCount} group(s): ${join(outDir, 'index.html')}`);
