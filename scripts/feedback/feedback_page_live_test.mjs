// Browser check for the live comment thread on feedback-page.template.html (T505, John 20 Oct 2026:
// "I can't see any indication that the agent is responding"; "I don't like that I can't see the things in the same order").
//   node feedback_page_live_test.mjs <generated index.html>   (exit 0 = pass)
// Keep the earlier inline thread assertions active for the lead's decision.
// John posts a comment and sees: his entry in place at once, "Sent", then "<owner> is answering…", then the agent's
// answer, in place, order unchanged.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const page_html = readFileSync(process.argv[2], 'utf8');
const row = (fix, dir) => `<tr><td>${fix}</td><td>T1</td><td>landed</td><td><a href="${dir}/before.png">before</a> · <a href="${dir}/after.png">after</a></td><td>x</td></tr>`;
const md = `<table><thead><tr><th>Fix</th><th>Task</th><th>State</th><th>Pictures</th><th>Look at</th></tr></thead><tbody>
${row('Fix C', 'c')}${row('Fix B', 'b')}${row('Fix A', 'a')}
</tbody></table>`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function serveViewer(page) {
  return page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.endsWith('/F/index.html')) return r.fulfill({ contentType: 'text/html', body: page_html });
    if (u.includes('index.md?html')) return r.fulfill({ contentType: 'text/html', body: md });
    if (u.endsWith('.png')) return r.fulfill({ contentType: 'image/png', body: png });
    return r.fulfill({ status: 404, body: '' });
  });
}
const texts = (loc) => loc.locator('.c .txt').allTextContents().then((a) => a.map((t) => t.trim()));

const browser = await chromium.launch();
const failures = [];
const threadCalls = [];
const posts = [];
try {
  const p = await browser.newPage({ viewport: { width: 374, height: 705 } });
  p.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/board/api/thread') threadCalls.push(url.search);
    if (url.pathname === '/board/api/inbox') posts.push(request.postData());
  });
  await serveViewer(p);
  await p.goto('http://test.invalid/F/index.html');
  await p.waitForSelector('figure[data-item]');

  // Order: pictures keep page order A, B, C; answered ones sit in their own closed fold in place.
  const order = await p.$$eval('figure[data-item]', (fs) => fs.map((f) => [f.dataset.name, !!f.closest('details.ruled')]));
  if (JSON.stringify(order.map(([name]) => name)) !== '["F/a/before.png","F/b/before.png","F/c/before.png"]') failures.push(`page order ${JSON.stringify(order)}`);
  const wantOrder = JSON.stringify([['F/a/before.png', true], ['F/b/before.png', false], ['F/c/before.png', true]]);
  if (JSON.stringify(order) !== wantOrder) failures.push(`order/fold ${JSON.stringify(order)}, want ${wantOrder}`);
  const sums = await p.$$eval('details.ruled > summary', (ss) => ss.map((s) => s.textContent.trim()));
  if (JSON.stringify(sums) !== '["Answered: tap to show","Answered: tap to show"]') failures.push(`summaries ${JSON.stringify(sums)}`);
  if (await p.$('#out > details.ruled:last-child') && (await p.$$eval('#out > details.ruled', (d) => d.length))) failures.push('answered fold moved to the bottom');
  // Comments newest first by entry number (not time): eleven (c11) before five (c5).
  const said = await texts(p.locator('figure[data-name="F/b/before.png"]'));
  if (JSON.stringify(said) !== '["eleven","five"]') failures.push(`comment order ${JSON.stringify(said)}, want eleven, five`);

  // Send.
  const fig = p.locator('figure[data-name="F/b/before.png"]');
  await fig.locator('form.compose textarea').waitFor({ timeout: 3000 }).catch(() => {
    throw new Error('The retained inline thread assertions require the retired board comment form.');
  });
  await fig.locator('form.compose textarea').fill('please recheck?');
  const t0 = Date.now();
  await fig.locator('button[type=submit]').click();
  // Within 200 ms, before the server answers: the box is clear and his entry is in place, marked Sent.
  await p.waitForTimeout(150);
  if ((await fig.locator('form.compose textarea').inputValue()) !== '') failures.push('box not cleared at once');
  if (!(await fig.locator('.c.john', { hasText: 'please recheck?' }).count())) failures.push('entry not shown at once');
  const sent = (await fig.locator('.c.john .sent').allTextContents()).map((t) => t.trim());
  if (JSON.stringify(sent) !== '["Sent"]') failures.push(`sent line ${JSON.stringify(sent)}`);
  await fig.locator('.answering').waitFor({ timeout: 4000 });
  const sentText = (await fig.locator('.answering').textContent()).trim();
  if (!/^bob is answering… 0:\d\d$/.test(sentText)) failures.push(`answering line ${JSON.stringify(sentText)}`);
  if (await p.evaluate(() => /\{\s*"id"/.test(document.body.innerText))) failures.push('raw JSON shown');
  if (await fig.locator('.err:visible').count()) failures.push('error shown after a good send');
  if ((await fig.locator('form.compose textarea').inputValue()) !== '') failures.push('box not cleared');
  const mine = await fig.locator('.c.john').allTextContents();
  if (mine.length !== 1 || !/please recheck\?/.test(mine[0])) failures.push(`John entry ${JSON.stringify(mine)}`);
  if (!(await fig.locator('form.compose textarea').evaluate((t) => t === document.activeElement))) failures.push('box lost focus after Send');
  // Same text again within 10 s: nothing more is posted, and the page says so.
  await fig.locator('form.compose textarea').fill('please recheck?');
  await fig.locator('button[type=submit]').click();
  if (Date.now() - t0 < 9000) {
    await p.waitForTimeout(300);
    if (posts.length !== 1) failures.push(`same text within 10 s posted again (${posts.length} posts)`);
    if (!/Already sent/.test((await fig.locator('form.compose .note').textContent()))) failures.push('no "Already sent" note for a repeat');
  }

  // Live: the answer appears under its picture, the answering line goes, order unchanged.
  await fig.locator('.c.fable', { hasText: 'the answer' }).waitFor({ timeout: 9000 });
  if (await fig.locator('.answering').count()) failures.push('answering line still shown after the answer');
  const seq = await texts(fig);
  const ix = (w) => seq.findIndex((t) => t.includes(w));
  if (!(ix('the answer') < ix('please recheck') && ix('please recheck') < ix('eleven') && ix('eleven') < ix('five'))) failures.push(`thread order ${JSON.stringify(seq)}`);
  // The poll asks for entries after the newest it knows.
  if (!threadCalls.length || !threadCalls.every((q) => q.includes('item=QO0') && q.includes('since='))) failures.push(`thread calls ${JSON.stringify(threadCalls)}`);
  if (!threadCalls.some((q) => q.includes('since=QO0.c20'))) failures.push('poll never asked after the sent entry');
  // An answer on a folded picture unfolds it, in place.
  await p.waitForFunction(() => !document.querySelector('figure[data-name="F/a/before.png"]').closest('details.ruled'), null, { timeout: 5000 })
    .catch(() => failures.push('answer to a folded picture did not unfold it'));
  const order2 = await p.$$eval('figure[data-item]', (fs) => fs.map((f) => f.dataset.name));
  if (JSON.stringify(order2) !== '["F/a/before.png","F/b/before.png","F/c/before.png"]') failures.push(`order after live ${JSON.stringify(order2)}`);
  if (!(await p.locator('figure[data-name="F/a/before.png"] .c', { hasText: 'a changed' }).count())) failures.push('folded picture answer not shown');
  // No answer for 130 s: the line says so and the entry stays.
  const q = await browser.newPage({ viewport: { width: 374, height: 705 } });
  await q.clock.install();
  await serveViewer(q);
  await q.goto('http://test.invalid/F/index.html');
  await q.waitForSelector('form.compose', { state: 'attached' });
  const qf = q.locator('figure[data-name="F/b/before.png"]');
  await qf.locator('form.compose textarea').fill('hello?');
  await qf.locator('button[type=submit]').click();
  await qf.locator('.answering').waitFor();
  await q.clock.runFor(135000);
  const late = (await qf.locator('.answering').textContent()).trim();
  if (late !== 'no answer yet; sent to bob') failures.push(`timeout line ${JSON.stringify(late)}`);
  if (!(await qf.locator('.c.john', { hasText: 'hello?' }).count())) failures.push('entry gone after timeout');
  // Reload: a John question with no agent entry after it shows the answering line again, counted from its time;
  // a note gets none; an answered question shows its answer (found by `answers`, not by the picture) and no line.
  const r2 = await browser.newPage({ viewport: { width: 374, height: 705 } });
  await serveViewer(r2);
  await r2.goto('http://test.invalid/F/index.html');
  await r2.waitForSelector('form.compose', { state: 'attached' });
  const lineOf = async (n) => (await r2.locator(`figure[data-name="${n}"] .answering`).allTextContents()).map((t) => t.trim());
  const la = await lineOf('F/a/before.png');
  if (la.length !== 1 || !/^bob is answering… 0:(3\d|4[0-5])$/.test(la[0])) failures.push(`reload question line ${JSON.stringify(la)}`);
  const lb = await lineOf('F/b/before.png');
  if (lb.length) failures.push(`answered question still waiting ${JSON.stringify(lb)}`);
  if (!(await r2.locator('figure[data-name="F/b/before.png"] .c', { hasText: 'loaded answer' }).count())) failures.push('answer linked by answers not shown under its picture on load');
  if ((await lineOf('F/c/before.png')).length) failures.push('note got an answering line');
  if (!(await r2.locator('figure[data-name="F/a/before.png"]').isVisible())) failures.push('waiting question hidden in a fold');
  // A send the server refuses: his entry goes, his words come back into the box, and the error says why.
  const cf = r2.locator('figure[data-name="F/b/before.png"]');
  await cf.locator('form.compose textarea').fill('will fail');
  await cf.locator('button[type=submit]').click();
  await cf.locator('.err:visible').waitFor({ timeout: 3000 }).catch(() => failures.push('no error after a refused send'));
  if ((await cf.locator('form.compose textarea').inputValue()) !== 'will fail') failures.push('words not back in the box after a refused send');
  if (await cf.locator('.c.john', { hasText: 'will fail' }).count()) failures.push('refused entry still shown');
  if (!/The board is down/.test(await cf.locator('.err').textContent())) failures.push('error does not say why');
} catch (error) {
  failures.push(error.message);
} finally {
  await browser.close();
}
for (const f of failures) console.log('FAIL ' + f);
process.exit(failures.length ? 1 : 0);
