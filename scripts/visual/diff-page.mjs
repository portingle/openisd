#!/usr/bin/env node
// Writes a before/after page for John with a board comment link under each picture.
//   node scripts/visual/diff-page.mjs <outdir> <title> <entries.json> <card-id> <note>
// entries.json: [{"name": "mobile-wizard-sealed-step4", "before": "/path/a.png", "after": "/path/b.png", "diff": "/path/d.png"}]
// note: one or two plain sentences on what the user sees change (the task file's visual_note), shown under the title.
// Pass an empty string if there is no note. A group's first picture points to the red boxes and counts the
// pictures folded below it. Folded pictures point to the group's first picture.
// before, after and diff may each be null (a new or removed screen, or no diff picture). Pictures are
// copied into <outdir>, so the page stands alone.
// The page itself is made by scripts/feedback/feedback-page.py (rule: John's pages are never hand-built):
// this script copies the pictures, marks them with scripts/feedback/mark-diff.py (a red box on what changed,
// or on the whole screen when nothing can be told apart), writes <outdir>/index.md and runs the tool.
import {spawnSync} from 'node:child_process';
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {groupLeaders} from './groups.mjs';
import {plainScreenName} from './screen-names.mjs';

const [outDir, title, entriesFile, card, note] = process.argv.slice(2);
if (!outDir || !title || !entriesFile || !card?.trim() || note === undefined) {
  console.error('usage: diff-page.mjs <outdir> <title> <entries.json> <card-id> <note>');
  process.exit(2);
}
const galleryBin = process.env.VISUAL_GALLERY_BIN ?? resolve(dirname(fileURLToPath(import.meta.url)), '../feedback');
const entries = JSON.parse(readFileSync(entriesFile, 'utf8'));
mkdirSync(outDir, {recursive: true});

const cell = text => String(text).replace(/\|/g, '/').replace(/\n/g, ' ');
const run = (script, args) => spawnSync('python3', [join(galleryBin, script), ...args], {encoding: 'utf8'});

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

const prepared = entries.map(entry => {
  const before = copy(entry.name, 'before', entry.before);
  const after = copy(entry.name, 'after', entry.after);
  const diff = copy(entry.name, 'diff', entry.diff);
  const box = mark(before, after, diff);
  return {entry, before, after, diff, box};
});
const leaders = groupLeaders(prepared.map(p => ({name: p.entry.name, box: p.box})));
const followerCounts = leaders.map(() => 0);
leaders.forEach((leader, i) => {
  if (leader !== i) followerCounts[leader] += 1;
});

// index.md row: Fix | Task | State | Pictures | Look at | Same as. Fix is the screen in words; Task and State stay empty
// (the page shows neither). Same as is the leader's screen name, empty for a group's first picture.
// feedback-page.template.html folds every row that names a leader under that leader.
const names = prepared.map(p => plainScreenName(p.entry.name));
const rows = prepared.map(({before, after, diff}, i) => {
  const links = [['before', before], ['after', after], ['difference', diff]].filter(([, f]) => f).map(([label, f]) => `[${label}](${f})`);
  const isLeader = leaders[i] === i;
  const look = isLeader
    ? `${names[i]}, the red boxes show what changed`
    : `${names[i]}, the same change as the first picture of this group.`;
  const more = followerCounts[i];
  const summary = more ? `. The same change shows in ${more} more picture${more === 1 ? '' : 's'}, folded below.` : '';
  const leader = isLeader ? '' : names[leaders[i]];
  return `| ${cell(names[i])} |  |  | ${links.join(' ')} | ${cell(look + summary)} | ${cell(leader)} |`;
});

writeFileSync(join(outDir, 'index.md'), `# ${cell(title)}\n| Fix | Task | State | Pictures | Look at | Same as |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
const todo = 'Look at the red boxes. Use the link under a picture to say on the board whether the change looks right.';
const page = run('feedback-page.py', [outDir, '--card', card, '--todo', todo, '--note', note]);
if (page.status !== 0) { console.error(`feedback-page.py failed: ${page.stderr}`); process.exit(1); }
console.log(`${entries.length} screen(s) in ${leaders.filter((l, i) => l === i).length} group(s): ${join(outDir, 'index.html')}`);
