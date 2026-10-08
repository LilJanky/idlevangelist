// Accessibility audit (optional): `npm run a11y` with the game served on :8080 (npm start).
// Computes the WCAG contrast ratio of every visible text node against its real background on each screen, and flags
// unlabeled controls and touch targets under 44px. Exits non-zero if anything fails.
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const URL = process.env.IV_URL || 'http://localhost:8080/?debug=1';
const exe = [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean).find((p) => fs.existsSync(p));
if (!exe) { console.log('a11y: no Chrome/Edge found; set CHROME_PATH. Skipping.'); process.exit(0); }

const AUDIT = () => {
  const parse = (c) => { const q = c.match(/color\(srgb ([^)]+)\)/); if (q) { const p = q[1].split(/[ \/]+/).filter(Boolean).map(Number); return { r: p[0]*255, g: p[1]*255, b: p[2]*255, a: p[3] ?? 1 }; } const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = (el) => {
    const stack = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const bc = parse(cs.backgroundColor);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/repeating|svg/.test(cs.backgroundImage) && /gradient/.test(cs.backgroundImage)) {
        const cols = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)|color\(srgb[^)]+\)/g)].map((m) => parse(m[0]));
        if (cols.length) { stack.push(cols[0]); if (cols[0].a >= 1) break; }
      }
      if (bc && bc.a > 0) { stack.push(bc); if (bc.a >= 1) break; }
    }
    let base = { r: 13, g: 15, b: 20, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const n = walker.currentNode; const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if (el.closest('canvas, #floaters, #toasts, #word-slam')) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    if (op < 0.05) continue;
    const fg0 = parse(cs.color); if (!fg0) continue;
    const bg = bgOf(el);
    const fg = over({ ...fg0, a: fg0.a * op }, bg);
    const l1 = L(fg), l2 = L(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize); const large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    const need = large ? 3 : 4.5;
    const dis = el.closest('button:disabled');
    if (ratio < need) out.push({ ratio: +ratio.toFixed(2), need, dis: !!dis, text: t.slice(0, 32), sel: (el.id ? '#' + el.id : '') + '.' + [...el.classList].join('.') + ' < ' + (el.parentElement?.className || '').toString().slice(0, 40), fg: cs.color, bg: `rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0})` });
  }
  return out;
};


const STRUCT = () => {
  const o = [];
  const name = (e) => (e.getAttribute('aria-label') || e.textContent || e.title || '').trim();
  for (const e of document.querySelectorAll('button, [role=button], a, input, select')) {
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect(); if (!r.width) continue;
    if (!name(e) && !e.labels?.length) o.push('no accessible name: ' + e.outerHTML.slice(0, 90));
    if ((r.width < 44 || r.height < 44) && e.tagName === 'BUTTON') o.push(`small target ${Math.round(r.width)}x${Math.round(r.height)}: ${name(e).slice(0, 30)}`);
  }
  return o;
};

const problems = [];
for (const [w, h] of [[390, 844], [320, 568]]) {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  await page.goto(URL); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(600);
  const check = async (screen) => {
    await page.evaluate(() => document.querySelectorAll('.toast,#toasts').forEach((t) => { t.style.display = 'none'; }));
    for (const x of await page.evaluate(AUDIT)) problems.push(`${w}x${h} ${screen}: ${x.ratio}:1 (needs ${x.need}) "${x.text}" ${x.sel}`);
    for (const x of await page.evaluate(STRUCT)) problems.push(`${w}x${h} ${screen}: ${x}`);
  };
  await check('intro');
  await page.getByRole('button', { name: 'Begin' }).click(); await page.waitForTimeout(500);
  await page.evaluate(() => {
    const { game } = window.__idlevangelist; const g = game.state.gen;
    g.genSeconds += 1500; game.addSeeds(5e8); game.checkUnlocks(true);
    for (const [id, n] of [['tracts', 60], ['bibles', 50], ['streetTeam', 30], ['bibleStudy', 20], ['discipleship', 10]]) game.buyMinistry(id, n);
    for (const d of g.disciples) { game.buyDisciple?.(d.id); game.trainDisciple?.(d.id); } g.fundsUnlocked = true; g.funds = 5; game.specialTimer = 1e9; game.eventTimer = 1e9; g.scripturesUnlocked = ['romans1_20', 'john3_16'];
  });
  await page.waitForTimeout(1200); await check('street');
  for (const t of ['ministry', 'upgrades']) { await page.locator(`button[data-tab="${t}"]`).click(); await page.waitForTimeout(400); await check(t); }
  await page.locator('button[data-tab="street"]').click();
  await page.evaluate(() => { const { game } = window.__idlevangelist; const sp = game.spawnSpecial(40); sp.specialId = 'skeptic'; sp.variant = 1; game.tapSpecial(sp.id); });
  await page.waitForTimeout(2000); await check('conversation');
  await page.evaluate(() => { window.__idlevangelist.game.enc = null; });
  await page.locator('#btn-settings').click(); await page.waitForTimeout(400); await check('settings');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const { game } = window.__idlevangelist; game.state.gen.bossState.status = 'available'; game.challengeBoss(); game.boss.stage = 'victory'; game.finishBossVictory(); });
  await page.waitForTimeout(2000); await check('generation complete');
  await browser.close();
}
const uniq = [...new Set(problems)];
for (const p of uniq) console.log('FAIL ', p);
console.log(uniq.length ? `\n${uniq.length} accessibility problem(s).` : 'Accessibility audit passed.');
process.exit(uniq.length ? 1 : 0);
