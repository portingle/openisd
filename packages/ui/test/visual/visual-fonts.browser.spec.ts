import type {CDPSession, Page} from '@playwright/test';
import {expect, test} from '../fixtures.js';
import {SCREENS} from './screens.js';

/**
 * Every glyph of every screen in the visual set is drawn in a font the app carries (John, 2026-11-15: "the fonts are
 * 100pc baked into the app why would they diff?"). Chrome reports, per element, the platform font that drew each run of
 * text (CDP `CSS.getPlatformFontsForNode`); a font that is not a web font from our own @font-face rules is a system font,
 * which looks different on Windows, macOS, Android and Linux and makes the pictures depend on the machine.
 * The walk covers elements and their ::before/::after boxes. Canvas text is covered by the chart-font record in visual.browser.spec.ts.
 */

interface CdpNode {
  nodeId: number;
  nodeName: string;
  nodeType: number;
  attributes?: string[];
  children?: CdpNode[];
  pseudoElements?: CdpNode[];
  shadowRoots?: CdpNode[];
  contentDocument?: CdpNode;
}

interface PlatformFont {familyName: string; postScriptName: string; isCustomFont: boolean; glyphCount: number}

/** One element drawn, wholly or partly, in a font that is not bundled. */
export interface SystemFontUse {readonly element: string; readonly text: string; readonly characters: string; readonly font: string; readonly glyphs: number}

function describe(node: CdpNode): string {
  const attrs = node.attributes ?? [];
  const get = (name: string): string => { const at = attrs.indexOf(name); return at < 0 ? '' : attrs[at + 1] ?? ''; };
  const cls = get('class').trim().split(/\s+/).filter(c => c !== '').join('.');
  const id = get('id');
  return `${node.nodeName.toLowerCase()}${id === '' ? '' : `#${id}`}${cls === '' ? '' : `.${cls}`}`;
}

/** The elements on the page (pseudo-elements included) that draw any glyph in a font that is not one of the app's own. */
export async function systemFontUses(page: Page): Promise<SystemFontUse[]> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const {root} = await cdp.send('DOM.getDocument', {depth: -1, pierce: true}) as {root: CdpNode};
    const found: SystemFontUse[] = [];
    const visit = async (node: CdpNode, path: string): Promise<void> => {
      const here = node.nodeType === 1 || node.nodeName.startsWith('::') ? `${path} > ${describe(node)}` : path;
      // A parent's report includes its children's text: only an element with a text node of its own (or a ::before/::after) is asked.
      const ownText = (node.children ?? []).some(child => child.nodeType === 3) || node.nodeName.startsWith('::') || (node.pseudoElements ?? []).length === 0 && /^(INPUT|TEXTAREA|SELECT)$/.test(node.nodeName);
      if (node.nodeType === 1 || node.nodeName.startsWith('::')) {
        if (ownText && !['SCRIPT', 'STYLE', 'HEAD', 'NOSCRIPT', 'CANVAS'].includes(node.nodeName)) {
          const {fonts} = await cdp.send('CSS.getPlatformFontsForNode', {nodeId: node.nodeId}).catch(() => ({fonts: [] as PlatformFont[]})) as {fonts: PlatformFont[]};
          for (const font of fonts.filter(f => !f.isCustomFont)) {
            const text = await cdp.send('DOM.getOuterHTML', {nodeId: node.nodeId}).then(r => (r as {outerHTML: string}).outerHTML.replace(/<[^>]*>/g, '').trim().slice(0, 60)).catch(() => '');
            const characters = Array.from(new Set(Array.from(text).filter(c => c.codePointAt(0)! > 127))).map(c => `${c} U+${c.codePointAt(0)!.toString(16).toUpperCase()}`).join(' ');
            found.push({element: here.split(' > ').slice(-3).join(' > '), text, characters, font: font.familyName || font.postScriptName, glyphs: font.glyphCount});
          }
        }
      }
      for (const child of [...(node.pseudoElements ?? []), ...(node.shadowRoots ?? []), ...(node.children ?? []), ...(node.contentDocument ? [node.contentDocument] : [])]) await visit(child, here);
    };
    await visit(root, '');
    return found;
  } finally {
    await cdp.detach().catch(() => undefined);
  }
}

for (const screen of SCREENS) {
  test(`visual fonts ${screen.skin.name} ${screen.name}: every glyph is drawn in a bundled font`, async ({page, browserLog}) => {
    await screen.open(page);
    await page.evaluate(() => document.fonts.ready);
    browserLog.reset();
    const uses = await systemFontUses(page);
    expect(uses.map(use => `${screen.skin.name} ${screen.name}: ${use.element} "${use.text}" [${use.characters || 'ASCII only'}] drawn by ${use.font} (${use.glyphs} glyphs)`), 'elements drawn in a system font').toEqual([]);
  });
}
