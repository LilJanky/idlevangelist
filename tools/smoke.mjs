// Browser-level smoke test (optional): `npm run smoke`.
// Needs playwright-core (devDependency) and an installed Chrome/Edge (set CHROME_PATH to override).
// Starts the local server, then exercises boot, layout at key viewports, street play, a conversation,
// the Professor (argument -> crowd window -> argument), prestige, and persistence.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 8123;
const LOCAL_URL = 'http://localhost:8080/?debug=1';
const SPAWNED_URL = `http://localhost:${PORT}/?debug=1`;
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
  console.log('smoke: no Chrome/Edge found; set CHROME_PATH. Skipping.');
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function isReachable(url, tries = 1, delay = 150) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.ok || res.status === 304) return true;
    } catch {}
    if (i < tries - 1) await sleep(delay);
  }
  return false;
}

let server = null;
let url = LOCAL_URL;
if (!(await isReachable(url, 3, 200))) {
  server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  url = SPAWNED_URL;
  if (!(await isReachable(url, 20, 200))) throw new Error(`smoke: could not start local server on ${url}`);
}

const browser = await chromium.launch({ executablePath, headless: true });
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

/** Tap the first person with an open moment by clicking where they are on screen. */
async function tapOpenMoment(page) {
  const pt = await page.evaluate(() => {
    const { game, renderer } = window.__idlevangelist;
    const r = renderer.canvas.getBoundingClientRect();
    const p = game.crowd.peds.find((q) => q.opp && !q.done && q.x > 0.06 && q.x < 0.94);
    if (!p) return null;
    return { x: r.left + p.x * r.width, y: r.top + (renderer.pedFeet(p) - 12) * renderer.scale };
  });
  if (!pt) return false;
  await page.mouse.click(pt.x, pt.y);
  return true;
}

try {
  for (const [w, h] of [[320, 568], [390, 844], [1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(url);
    await page.getByRole('button', { name: 'Begin' }).click();
    let taps = 0;
    for (let i = 0; i < 40 && taps < 8; i++) {
      if (await tapOpenMoment(page)) taps++;
      await page.waitForTimeout(250);
    }
    const stats = await page.evaluate(() => ({ seeds: window.__idlevangelist.game.state.gen.totalSeeds, taps: window.__idlevangelist.game.state.gen.encounterStats.engagements }));
    check(stats.taps >= 5 && stats.seeds > 0, `${w}x${h}: tapping people on the street earns Seeds immediately (${stats.taps} engagements)`);
    for (const tab of ['street', 'ministry', 'upgrades']) {
      await page.locator(`.nav-btn[data-tab=${tab}]`).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.getElementById('panel').scrollWidth > document.getElementById('panel').clientWidth);
      check(!overflow, `${w}x${h}: no horizontal overflow on ${tab}`);
    }
    await page.locator('.nav-btn[data-tab=street]').click();
    const wordBtn = await page.locator('#btn-word').boundingBox();
    check(wordBtn.height >= 44, `${w}x${h}: WORD control meets touch-target size`);
    const hud = await page.locator('#street-hud').boundingBox();
    check(!!hud && hud.width > 0, `${w}x${h}: streak and momentum are visible`);

    // WORD: charges from street work, shows who it will reach, and proclaims to the open crowd.
    check(/Preparing/.test(await page.locator('#btn-word').innerText()) || /Locked/.test(await page.locator('#btn-word').innerText()), `${w}x${h}: WORD shows its readiness while charging`);
    await page.evaluate(() => {
      const { game } = window.__idlevangelist;
      const gen = game.state.gen;
      if (!gen.scripturesUnlocked.includes('romans1_20')) gen.scripturesUnlocked.push('romans1_20');
      gen.street.word = 100;
      game.specialTimer = 1e9;
      for (const p of game.crowd.peds) if (p.x > 0.1 && p.x < 0.9) { p.opp = true; p.done = false; p.oppLeft = 30; }
    });
    await page.waitForTimeout(400);
    check(/READY/.test(await page.locator('#btn-word').innerText()), `${w}x${h}: WORD announces READY`);
    const wordSeedsBefore = await page.evaluate(() => window.__idlevangelist.game.state.gen.seeds);
    await page.locator('#btn-word').click();
    const word = await page.evaluate(() => ({ uses: window.__idlevangelist.game.state.gen.encounterStats.wordUses, targets: window.__idlevangelist.game.state.gen.encounterStats.wordTargets, seeds: window.__idlevangelist.game.state.gen.seeds }));
    check(word.uses === 1 && word.targets >= 2 && word.seeds > wordSeedsBefore, `${w}x${h}: WORD reaches many people at once (${word.targets}) and pays them all`);

    // A deliberate conversation: it pauses the street; respond, apply a passage, return to the street.
    await page.evaluate(() => {
      const { game } = window.__idlevangelist;
      const gen = game.state.gen;
      gen.totalSeeds = Math.max(gen.totalSeeds, 20000);
      gen.genSeconds = Math.max(gen.genSeconds, 400);
      gen.scripturesUnlocked = ['romans1_20', 'romans3_23', 'proverbs30_5'];
      gen.encounterStats.specialsMet = 3;
      game.specialTimer = 0.01;
    });
    await page.waitForFunction(() => window.__idlevangelist.game.crowd.specials.length > 0, null, { timeout: 8000 });
    await page.evaluate(() => { const { game } = window.__idlevangelist; game.tapSpecial(game.crowd.specials[0].id); });
    await page.waitForFunction(() => window.__idlevangelist.game.enc?.state === 'active', null, { timeout: 4000 });
    check(await page.evaluate(() => window.__idlevangelist.game.streetPaused), `${w}x${h}: a conversation pauses the street`);
    const responseChoices = page.locator('#choice-box .choice:not(.passage)');
    await responseChoices.first().waitFor({ state: 'visible', timeout: 3000 });
    const choices = await responseChoices.count();
    const boxes = await responseChoices.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { h: r.height, bottom: r.bottom }; }));
    check(choices === 3 && boxes.every((b) => b.h >= 38 && b.bottom <= h + 1), `${w}x${h}: three response choices are tappable and on screen`);
    const strongIndex = await page.evaluate(() => window.__idlevangelist.game.enc.choices.findIndex((c) => c.grade === 'strong'));
    await responseChoices.nth(strongIndex).click();
    await page.waitForSelector('.passage, #choice-box .choice', { timeout: 3000 });
    const verseBoxes = await page.locator('.passage').evaluateAll((els) => els
      .filter((e) => e.offsetParent !== null)
      .map((e) => e.getBoundingClientRect().bottom));
    check(verseBoxes.length === 0 || verseBoxes.every((bt) => bt <= h + 1), `${w}x${h}: Scripture options fit on screen`);
    const direct = await page.evaluate(() => window.__idlevangelist.game.enc.lines.findIndex((l) => l.grade === 'direct'));
    check(direct >= 0 && (await page.locator('.passage').count()) === 3, `${w}x${h}: three things to say are offered, one of which answers what was raised`);
    await page.locator('.passage').nth(direct).click();
    // The hidden outcome may (rarely) be a conversion; the exchange summary or the conversion moment is shown.
    await page.waitForFunction(() => ['outcome', 'conversion'].includes(window.__idlevangelist.game.enc?.state), null, { timeout: 3000 });
    await page.waitForSelector('#moment:not(.hidden)', { timeout: 3000 });
    const converted = await page.evaluate(() => window.__idlevangelist.game.enc.state === 'conversion');
    if (converted) {
      await page.waitForTimeout(1600);
    } else {
      const outcomeText = await page.locator('#moment').innerText();
      check(/DIRECT APPLICATION/.test(outcomeText) && /Seeds/.test(outcomeText), `${w}x${h}: the outcome names how Scripture applied and what was earned`);
    }
    await page.locator('#moment').click();
    await page.waitForFunction(() => !window.__idlevangelist.game.enc, null, { timeout: 8000 });
    check(!(await page.evaluate(() => window.__idlevangelist.game.streetPaused)), `${w}x${h}: the street resumes after the conversation`);

    // People who came to Christ appear on the street and a crowd event gathers people (rendering must stay error-free).
    await page.evaluate(() => {
      const { game } = window.__idlevangelist;
      game.state.gen.conversionState.converts.push({ name: 'Marcus' }, { name: 'Ana' });
      game.convertTimer = 0.1;
      game.eventTimer = 0.3;
    });
    await page.waitForTimeout(1500);
    check(await page.evaluate(() => window.__idlevangelist.game.crowd.openPeds().length >= 4), `${w}x${h}: a crowd event puts a gathering on the street`);
    await page.evaluate(() => { window.__idlevangelist.game.state.gen.conversionState.converts.length = 0; });

    if (w === 390) {
      // Ministry legibility and milestones
      await page.evaluate(() => {
        const { game } = window.__idlevangelist;
        const g = game.state.gen;
        g.genSeconds += 1500;
        game.addSeeds(2e6);
        game.checkUnlocks();
        for (const id of ['tracts', 'bibles', 'streetTeam', 'bibleStudy', 'discipleship']) game.buyMinistry(id, 5);
        game.trainDisciple('ruth');
        game.trainDisciple('tomas');
        g.encounterStats.engagements = 200;
        g.bossState.status = 'available';
        game.specialTimer = 1e9;
      });
      await page.locator('.nav-btn[data-tab=ministry]').click();
      await page.waitForTimeout(500);
      const text = await page.locator('#tab-ministry').innerText();
      check(/Seeds\/sec/.test(text) && /→/.test(text), 'Ministry tab shows production numbers and before/after previews');
      await page.locator('.nav-btn[data-tab=street]').click();

      // The Professor: argument -> crowd window -> argument ... -> victory
      await page.getByRole('button', { name: /Meet/ }).first().click();
      await page.waitForFunction(() => window.__idlevangelist.game.boss?.stage === 'argument', null, { timeout: 8000 });
      await page.evaluate(() => {
        const moment = document.getElementById('moment');
        if (moment && !moment.classList.contains('hidden')) moment.click();
      });
      for (let phase = 0; phase < 3; phase++) {
        await page.waitForFunction(() => {
          const enc = window.__idlevangelist.game.boss?.enc;
          return enc && enc.step === 'respond' && Array.isArray(enc.choices) && enc.choices.length === 3;
        }, null, { timeout: 4000 });
        const strong = await page.evaluate(() => window.__idlevangelist.game.boss.enc.choices.findIndex((c) => c.grade === 'strong'));
        if (phase === 0) {
          const step = await page.evaluate((index) => {
            const { game } = window.__idlevangelist;
            game.respond(game.boss.enc.choices[index].id);
            return game.boss.enc.step;
          }, strong);
          check(step === 'press', 'the Professor exchange advances to pressing the point');
          const live = await page.evaluate(() => {
            const { game } = window.__idlevangelist;
            game.cool.answer = 0;
            const verse = game.state.gen.scripturesUnlocked[0];
            game.castAnswer();
            if (verse) game.castWord(verse);
            game.boss.enc.resistance = 1;
            return game.boss.enc.step === 'press';
          });
          check(live, 'the Professor exchange stays live while pressing the point');
        } else {
          await page.evaluate((index) => {
            const { game } = window.__idlevangelist;
            game.boss.enc.resistance = 1;
            game.respond(game.boss.enc.choices[index].id);
          }, strong);
        }
        if (phase < 2) {
          await page.waitForFunction(() => window.__idlevangelist.game.boss.stage === 'window', null, { timeout: 4000 });
          for (let i = 0; i < 6; i++) {
            await tapOpenMoment(page);
            await page.waitForTimeout(300);
          }
          await page.waitForFunction((p) => window.__idlevangelist.game.boss.stage === 'argument' && window.__idlevangelist.game.boss.phaseIndex === p + 1, phase, { timeout: 20000 });
        }
      }
      await page.getByRole('button', { name: 'Continue' }).click();
      check(await page.getByRole('button', { name: 'Begin Next Generation' }).isVisible(), 'boss victory leads to Generation Complete with a deliberate Begin button');
      await page.getByRole('button', { name: 'Begin Next Generation' }).click();
      await page.getByRole('button', { name: 'Skip' }).click();
      const faith = await page.evaluate(() => window.__idlevangelist.game.state.currencies.faithfulness);
      check(faith >= 10 && faith <= 13, `Faithfulness awarded (${faith})`);
      check(await page.locator('#tab-legacy').isVisible(), 'Legacy tree appears after the first generation');
      await page.locator('#tab-legacy .buy:not([disabled])').first().click();
      await page.reload();
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => ({ f: window.__idlevangelist.game.state.currencies.faithfulness, phase: window.__idlevangelist.game.state.phase, nodes: Object.keys(window.__idlevangelist.game.state.prestige.nodes).length }));
      check(after.phase === 'gen2preview' && after.nodes === 1 && after.f === faith - 3, 'reload preserves phase, Faithfulness, and purchased legacy nodes');
    }
    check(errors.length === 0, `${w}x${h}: no console errors${errors.length ? ` (${errors[0]})` : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log(failures === 0 ? '\nSmoke test passed.' : `\n${failures} smoke check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
