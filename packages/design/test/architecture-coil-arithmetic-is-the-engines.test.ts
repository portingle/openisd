// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// There is no other author here. Every failure it reports is the agent's own mistake, caught by a
// check the agent could not run in its own head. A red result IS the finding — never an obstacle
// standing in front of one.
//
// Two permitted responses when it goes red. ONE: name the defect in a sentence — what is actually
// wrong with the code, that would still be wrong if this gate did not exist — and then repair it.
// If no defect can be named, that option is not available. TWO: STOP and report what it found.
// "Make it pass" is not one of the two, and is what the word "fix" quietly permits. Casting
// past it, renaming so a matcher stops firing, adding an exemption, loosening the assertion or
// deleting the test are one act under different names — making the red go away instead of making
// the code right. After ANY edit to this file, break what it guards and watch it fail, or it is
// not known to test anything. See AGENTS.md "Every architecture test exists to catch the AI".

/**
 * A DRIVER'S COIL FIGURES ARE CALCULATED IN THE ENGINE ONLY. Multiplying or dividing a driver's
 * Re, BL, Le or Znom by a coil count or a wiring factor is a calculation, and calculations live in
 * `packages/design/engine` (`solvers/driverQuantities.ts`, published as `engine.driver.*`). John,
 * 2026-11-15 (QO942): "I want to know that there isn't calc logic all over the place".
 *
 * How it finds one, without trusting a variable's name: a function outside the engine is flagged
 * when it holds a `*` or `/` between two non-literal operands (or `1 / x`, a reciprocal) AND the
 * code that owns it names BOTH a coil key of the record (`numVC`, `VCCon`, `'series'`,
 * `'parallel'`) and a coil figure key (`Re_ohm`, `BL_Tm`, `Le_H`, `Znom_ohm`). "The code that
 * owns it" is the function itself plus every function in the same file that calls it, so a small
 * helper (`scaled(entry, factor)`) is judged with the caller that hands it the coil count. Those
 * keys are the record's schema, not a local name: renaming `factor` or `coils` does not change what
 * the gate sees. Scanned: non-test TypeScript of the design package outside the engine, persistence
 * and the UI, and the `<script>` of every `.vue` file.
 *
 * A RATCHET for what cannot move yet: `COIL_ARITHMETIC_BASELINE` lists a function by
 * `file#function`. A new site fails; a baselined one that has gone must be struck, so the list
 * only shrinks.
 */
import {describe, expect, it} from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {Node, Project, SyntaxKind, type SourceFile} from 'ts-morph';
import {ratchet, relPath, repoRoot} from './architecture-gate-support.js';

/** The one site that still multiplies a coil figure outside the engine, and why.
 *  `multiCoilAsPublished.ts#scaled`: the schema 3 to 4 upgrade runs as a free function on parsed
 *  JSON (`upgradeToCurrent`, called by static factories and by persistence), where no engine
 *  exists: the door exports no loose function, `createEngine(` is allowed in the composition
 *  roots only, and the engine-parameter ratchet's baseline is empty. It goes when the upgrade is
 *  handed an engine area. */
const COIL_ARITHMETIC_BASELINE: ReadonlySet<string> = new Set([
  'packages/design/domain/multiCoilAsPublished.ts#asPublishedSection',
  'packages/design/domain/multiCoilAsPublished.ts#scaled',
  // Found when the gate landed, not moved here (another change owns projectCoilWiring.ts and the
  // wiring's Le/Znom behaviour): the printed-title wiring inference compares Re with the per-coil nominal,
  // and the project's rewire scales a figure's precision by the ratio of converted to stored value.
  'packages/design/domain/driver/wiringInference.ts#inferMeasuredWiring',
  'packages/design/domain/project/projectCoilWiring.ts#driverAtMine',
]);

const COIL_KEYS = ['numVC', 'VCCon', 'series', 'parallel'];
const FIGURE_KEYS = ['Re_ohm', 'BL_Tm', 'Le_H', 'Znom_ohm'];

export interface CoilArithmeticSite {readonly key: string; readonly line: number; readonly text: string}

function mentions(text: string, words: readonly string[]): boolean {
  return words.some(w => new RegExp(`\\b${w}\\b`).test(text));
}

/** A `*` or `/` that is arithmetic between two values: not by a plain number, but `1 / x` counts. */
function isScaling(node: Node): boolean {
  if (!Node.isBinaryExpression(node)) return false;
  const op = node.getOperatorToken().getKind();
  const isMul = op === SyntaxKind.AsteriskToken || op === SyntaxKind.AsteriskEqualsToken;
  const isDiv = op === SyntaxKind.SlashToken || op === SyntaxKind.SlashEqualsToken;
  if (!isMul && !isDiv) return false;
  const isNumber = (n: Node): boolean => Node.isNumericLiteral(n);
  const left = node.getLeft();
  const right = node.getRight();
  if (isNumber(left) && left.getText() === '1' && isDiv) return !isNumber(right);
  return !isNumber(left) && !isNumber(right);
}

type FunctionLike = Node & {getName?: () => string | undefined};

function functionName(fn: FunctionLike): string {
  const own = fn.getName?.();
  if (own !== undefined && own !== '') return own;
  const parent = fn.getParent();
  if (Node.isVariableDeclaration(parent)) return parent.getName();
  if (Node.isPropertyAssignment(parent)) return parent.getName();
  return '<anonymous>';
}

function functionsIn(source: SourceFile): FunctionLike[] {
  return [
    ...source.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...source.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ...source.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...source.getDescendantsOfKind(SyntaxKind.FunctionExpression),
  ];
}

/** Innermost function containing `node`. */
function owner(node: Node): FunctionLike | undefined {
  return node.getFirstAncestor((a): a is FunctionLike => Node.isFunctionDeclaration(a) || Node.isMethodDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a));
}

/** Every coil-figure scaling in `source`, as `rel#function` with the line it sits on. */
export function coilArithmeticIn(source: SourceFile, rel: string, lineOffset = 0): CoilArithmeticSite[] {
  const found: CoilArithmeticSite[] = [];
  const all = functionsIn(source);
  for (const node of source.getDescendants()) {
    if (!isScaling(node)) continue;
    const fn = owner(node);
    if (fn === undefined) continue;
    const name = functionName(fn);
    // The function, the function it is written inside, and every function of the file that calls it.
    const callers = all.filter(f => f !== fn && name !== '<anonymous>'
      && f.getDescendantsOfKind(SyntaxKind.CallExpression).some(c => c.getExpression().getText() === name));
    const enclosing = fn.getAncestors().filter(a => Node.isFunctionDeclaration(a) || Node.isMethodDeclaration(a));
    const owning = [fn, ...callers, ...enclosing];
    // A figure key may sit in a constant the function reads (`PER_COIL_FIELDS`), not in its body.
    const used = new Set(owning.flatMap(f => f.getDescendantsOfKind(SyntaxKind.Identifier).map(i => i.getText())));
    const constants = source.getVariableDeclarations()
      .filter(d => used.has(d.getName()) && Node.isVariableStatement(d.getParent()?.getParent()))
      .map(d => d.getText());
    const text = [...owning.map(f => f.getText()), ...constants].join('\n');
    if (!mentions(text, COIL_KEYS) || !mentions(text, FIGURE_KEYS)) continue;
    found.push({
      key: `${rel}#${name}`,
      line: node.getStartLineNumber() + lineOffset,
      text: node.getText().replace(/\s+/g, ' ').slice(0, 80),
    });
  }
  return found;
}

/** The `.ts` files and `.vue` scripts outside the engine, tests and build output. */
function scannedFiles(): {path: string; rel: string; code: string; offset: number}[] {
  const roots = [
    path.join(repoRoot, 'packages', 'design'),
    path.join(repoRoot, 'packages', 'persistence', 'src'),
    path.join(repoRoot, 'packages', 'ui', 'src'),
  ];
  const out: {path: string; rel: string; code: string; offset: number}[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['node_modules', 'dist', 'build', 'test', 'tests', 'engine'].includes(e.name) || e.name.startsWith('.')) continue;
        walk(full);
        continue;
      }
      const rel = relPath(full);
      if (/\.(test|spec)\.ts$|\.d\.ts$/.test(e.name)) continue;
      if (/\.ts$/.test(e.name)) {
        out.push({path: full, rel, code: fs.readFileSync(full, 'utf8'), offset: 0});
      } else if (/\.vue$/.test(e.name)) {
        const text = fs.readFileSync(full, 'utf8');
        for (const m of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
          out.push({path: full + '.ts', rel, code: m[1]!, offset: text.slice(0, m.index! + m[0].indexOf('>') + 1).split('\n').length - 1});
        }
      }
    }
  };
  roots.forEach(walk);
  return out;
}

function demo(code: string): CoilArithmeticSite[] {
  const project = new Project({useInMemoryFileSystem: true});
  return coilArithmeticIn(project.createSourceFile('/demo.ts', code), 'demo.ts');
}

describe('coil arithmetic gate — it can fail (non-vacuous demonstration)', () => {
  const original = [
    'export function rewire(fields: Record<string, any>) {',
    '  const n = fields.numVC.value; const w = fields.VCCon.value;',
    '  const factor = w === "series" ? n : 1 / n;',
    '  return {...fields.Re_ohm, value: fields.Re_ohm.value * factor};',
    '}',
  ].join('\n');
  const renamed = [
    'export function q(zz: Record<string, any>) {',
    '  const a = zz.numVC.value; const b = zz.VCCon.value;',
    '  const k = b === "series" ? a : 1 / a;',
    '  return {...zz.Re_ohm, value: zz.Re_ohm.value * k};',
    '}',
  ].join('\n');
  const helper = [
    'function scaled(e: any, f: number) { return {...e, value: e.value * f}; }',
    'export function up(s: any) { return {...s, Re_ohm: scaled(s.Re_ohm, s.numVC.value)}; }',
  ].join('\n');

  it('flags a coil factor applied to a coil figure', () => {
    expect(demo(original).map(s => s.line)).toEqual([3, 4]);
  });
  it('flags the same code with every local name changed', () => {
    expect(demo(renamed).map(s => s.line)).toEqual([3, 4]);
  });
  it('flags a helper that scales, judged with the caller that names the coil count', () => {
    expect(demo(helper).map(s => s.key)).toEqual(['demo.ts#scaled']);
  });
  it('lets arithmetic that is not on a coil figure, or not by a coil count, through', () => {
    expect(demo('export function f(a: number, b: number) { return a * b; }')).toEqual([]);
    expect(demo('export function g(s: any) { return s.Re_ohm.value * 2; }')).toEqual([]);
  });
});

describe('a driver coil figure is scaled by a coil count in the engine only', () => {
  it('no site outside the baseline, and every baselined site still exists', () => {
    const found: CoilArithmeticSite[] = [];
    const project = new Project({useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true});
    const files = scannedFiles();
    expect(files.length, 'the gate scans nothing').toBeGreaterThan(100);
    files.forEach((f, i) => {
      found.push(...coilArithmeticIn(project.createSourceFile(`/scan/${i}.ts`, f.code), f.rel, f.offset));
    });
    const {added, gone} = ratchet([...new Set(found.map(s => s.key))], COIL_ARITHMETIC_BASELINE);
    const report = (keys: string[]): string[] =>
      keys.flatMap(k => found.filter(s => s.key === k).map(s => `${k.split('#')[0]}:${s.line} in ${k.split('#')[1]}: ${s.text}`));
    expect(report(added), [
      'A driver coil figure (Re, BL, Le, Znom) is multiplied or divided by a coil count or a wiring factor',
      'outside packages/design/engine. That is a calculation: put it in the engine (solvers/driverQuantities.ts,',
      'published on engine.driver) and call it. John, 2026-11-15, QO942: "there isn\'t calc logic all over the place".',
    ].join(' ')).toEqual([]);
    expect(gone, 'A baselined site no longer exists: strike it from COIL_ARITHMETIC_BASELINE.').toEqual([]);
  });
});

