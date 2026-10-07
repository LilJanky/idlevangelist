// Scripted human-like playthrough through the real DOM (optional, slow: ~10 minutes of wall time): `npm run playthrough`.
// A fake clock drives the page at 1 s per step. The bot taps people, proclaims WORD when a crowd has gathered, answers conversations
// (mixing strongest and weaker answers), shops from the Ministry and Upgrades tabs, and works the Professor through the real buttons.
// It fails on any console/page error, or if Next Generation is not reached within 45 game minutes. Needs playwright-core and Chrome/Edge.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 8124;
const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.log('playthrough: no Chrome/Edge found; set CHROME_PATH. Skipping.');
  process.exit(0);
}
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'idlevangelist-playthrough-'));
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.clock.install({ time: Date.now() });
await page.goto(`http://localhost:${PORT}/?debug=1`);
await page.clock.runFor(500);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.clock.runFor(500);
await page.getByRole('button', { name: 'Begin' }).click();
await page.evaluate(() => {
  window.__log = [];
  const g = window.__idlevangelist.game;
  const keep = new Set(['wordProclaimed', 'standFirm', 'specialSpawn', 'specialEngaged', 'specialMissed', 'resolved', 'automated', 'harvested', 'learned', 'purchase', 'ministryMilestone', 'crowdEvent', 'scriptureUnlocked', 'conversion', 'bossAvailable', 'bossStart', 'bossVictory', 'bossPassed', 'discipleTrained', 'ministryUnlocked', 'clusterUnlocked']);
  g.on((type, d) => {
    if (!keep.has(type)) return;
    const o = { t: +g.time.toFixed(1), type };
    if (type === 'wordProclaimed') Object.assign(o, { n: d.count, total: d.total });
    if (type === 'resolved' || type === 'automated' || type === 'harvested') Object.assign(o, { q: +d.reward.quality.toFixed(2), seeds: d.reward.seeds, conv: d.converted });
    if (type === 'purchase') Object.assign(o, { kind: d.kind, id: d.id });
    window.__log.push(o);
  });
});
const botTick = (a) => {
  const { attentive, rate, shop } = a;
  const $ = (s) => document.querySelector(s);
  const g = window.__idlevangelist.game;
  const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  for (const b of document.querySelectorAll('#overlay .btn')) if (/Begin Next Generation|Continue/.test(b.textContent)) click(b);
  const cont = [...document.querySelectorAll('#moment .btn')].find((b) => /Continue/.test(b.textContent));
  if (cont) click(cont);
  const inBoss = g.inBoss;
  const act = attentive || inBoss;
  const meet = document.querySelector('#boss-row .btn:not([disabled])');
  if (meet && act && g.bossPreparation() >= 0.9) click(meet);
  // a person reading: tap the moment away after a beat
  if (g.enc && (g.enc.state === 'outcome') && g.enc.t > 2.5) { const mo = $('#moment'); if (mo && !mo.classList.contains('hidden')) click(mo); }
  if (act) {
    const scene = $('#scene');
    const r = window.__idlevangelist.renderer;
    const cr = r.canvas.getBoundingClientRect();
    const sp = g.crowd.specials[0];
    if (sp && !inBoss && !g.enc && Math.random() < 0.8) scene.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cr.left + sp.x * cr.width, clientY: cr.top + (r.specialFeet() - 18) * r.scale, pointerId: 1 }));
    const choices = [...document.querySelectorAll('.choice')];
    if (choices.length && g.activeEncounter && g.activeEncounter.t > 2.0 + Math.random() * 3) {
      const enc = g.activeEncounter;
      if (enc.step === 'respond') {
        const sIdx = enc.choices.findIndex((c) => c.grade === 'strong');
        click(choices[Math.random() < 0.6 ? sIdx : Math.floor(Math.random() * choices.length)]);
      } else if (enc.step === 'apply') {
        const best = (enc.lines || []).findIndex((l) => l.grade === 'direct');
        click(choices[Math.random() < 0.6 && best >= 0 ? best : Math.floor(Math.random() * choices.length)]);
      }
      if (enc.t > 0 && enc.step !== 'respond' && enc.step !== 'apply') enc.t = enc.t;
    }
    if (g.streetOpen) {
      const word = $('#btn-word');
      if (word && word.classList.contains('ready')) {
        const open = g.crowd.openPeds().length;
        const waited = (g._botWait = (g._botWait || 0) + 1);
        if (open >= 4 || waited > 8) { click(word); g._botWait = 0; }
      }
      let n = rate;
      while (n > 0) {
        if (Math.random() < Math.min(1, n)) {
          const p = g.crowd.peds.find((q) => q.opp && !q.done && q.x > 0.06 && q.x < 0.94);
          if (p) scene.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cr.left + p.x * cr.width, clientY: cr.top + (r.pedFeet(p) - 12) * r.scale, pointerId: 1 }));
        }
        n -= 1;
      }
    }
    const enc = g.activeEncounter;
    if (enc && enc.kind === 'boss') {
      if (enc.step === 'respond') {
        const ch = [...document.querySelectorAll('.choice')];
        if (ch.length && enc.t > 3) click(ch[Math.random() < 0.6 ? enc.choices.findIndex((c) => c.grade === 'strong') : Math.floor(Math.random() * ch.length)]);
      }
      if (enc.step === 'rebut') {
        const ch = [...document.querySelectorAll('.choice')];
        if (ch.length && enc.rebutWait > 2) click(ch[Math.random() < 0.6 ? enc.rebuttalChoices.findIndex((c) => c.grade === 'strong') : Math.floor(Math.random() * ch.length)]);
      }
      if (enc.step === 'press') {
        const ans = $('#btn-answer');
        if (ans && !ans.disabled) click(ans);
        const word = $('#btn-word');
        if (word && !word.disabled && g.state.gen.scripturesUnlocked.length) {
          click(word);
          const tray = $('#word-tray');
          if (!tray.classList.contains('hidden')) { const v = tray.querySelector('.verse-btn:not(:disabled)'); if (v) click(v); else click(word); }
        }
      }
    }
  }
  if (shop && attentive && !g.enc) {
    const nav = (t) => click(document.querySelector(`.nav-btn[data-tab=${t}]`));
    nav('ministry');
    for (let pass = 0; pass < 4; pass++) for (const b of [...document.querySelectorAll('#tab-ministry .buy:not([disabled])')].reverse()) click(b);
    nav('upgrades');
    for (let pass = 0; pass < 2; pass++) for (const b of [...document.querySelectorAll('#tab-upgrades .buy:not([disabled])')]) click(b);
    nav('street');
  }
  return { phase: g.state.phase, seeds: g.state.gen.totalSeeds, sps: g.seedsPerSec, stage: g.boss?.stage, enc: g.enc?.step || null, word: Math.round(g.state.gen.street.word) };
};
await page.evaluate(`window.__bot = ${botTick.toString()}`);
let t = 0;
const start = Date.now();
let phase = 'gen1';
while (t < 45 * 60) {
  const attentive = t < 150 || t % 90 < 90 * 0.7;
  const r = await page.evaluate((a) => window.__bot(a), { attentive, rate: 0.9, shop: t % 15 === 0 });
  await page.clock.runFor(1000);
  t += 1;
  phase = r.phase;
  if (errors.length || r.phase === 'gen2preview') break;
}
const log = await page.evaluate(() => window.__log);
fs.writeFileSync(path.join(OUT, 'playthrough-log.json'), JSON.stringify({ log, minutes: t / 60, errors }, null, 1));
const count = (type) => log.filter((e) => e.type === type).length;
console.log(`playthrough: ${phase === 'gen2preview' ? 'reached Next Generation' : `STOPPED in ${phase}`} at ${(t / 60).toFixed(1)} game min (${((Date.now() - start) / 1000).toFixed(0)} s wall)`);
console.log(`  upgrades ${log.filter((e) => e.type === 'purchase' && e.kind === 'upgrade').length}, WORD ${count('wordProclaimed')}, conversations ${count('resolved')} (learned ${count('learned')}, gathered ${count('harvested')}, carried by a disciple ${count('automated')}), conversions ${count('conversion')}, Stand Firms ${count('standFirm')}`);
console.log(`  log: ${path.join(OUT, 'playthrough-log.json')}`);
await browser.close();
server.kill();
if (errors.length || phase !== 'gen2preview') {
  console.log(`FAIL: ${errors.length ? `console errors: ${errors.slice(0, 3).join(' | ')}` : 'Next Generation was not reached'}`);
  process.exit(1);
}
console.log('PASS');
