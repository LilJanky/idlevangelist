import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';
import { conversionChance } from '../src/systems/conversion.js';
import { lineProduction, computeModifiers, seedsPerSecond } from '../src/core/economy.js';
import { visualCounts, visualTier, crossedMilestone } from '../src/core/ministryVisuals.js';
import { serialize, deserialize } from '../src/systems/save.js';
import { MINISTRY_IDS } from '../src/core/state.js';

const newGame = (seed = 's1') => new Game({ state: createInitialState(0, seed) });

function quiet(game) {
  game.specialTimer = 1e9;
}

// Choose the strongest approach in the Professor's exchange (this also presses the point once).
function bossRespond(game) {
  const enc = game.boss.enc;
  return game.respond(enc.choices.find((c) => c.grade === 'strong').id);
}

// Someone who wants to talk walks in and is met.
function meetSomeone(game) {
  const gen = game.state.gen;
  gen.totalSeeds = Math.max(gen.totalSeeds, 20000);
  gen.genSeconds = Math.max(gen.genSeconds, 400);
  game.checkUnlocks(true);
  game.specialTimer = 0.01;
  game.advance(0.5);
  const sp = game.crowd.specials[0];
  assert.ok(sp, 'someone should want to talk');
  assert.ok(game.tapSpecial(sp.id));
  game.advance(game.balance.encounter.focusEnter + 0.1);
  return game.enc;
}

/** Give every pedestrian an open moment (and plenty of them). */
function openCrowd(game, n = 20) {
  for (let i = game.crowd.peds.length; i < n; i++) game.crowd.spawnPed(true, 1);
  for (const p of game.crowd.peds) {
    p.opp = true;
    p.done = false;
    p.oppLeft = 99;
    p.x = 0.2 + (p.id % 10) * 0.06;
  }
}

function engageN(game, n) {
  const results = [];
  for (let i = 0; i < n; i++) {
    game.advance(0.1);
    const ped = game.crowd.peds.find((p) => p.opp && !p.done);
    assert.ok(ped, 'an open moment is available');
    results.push(game.engageCrowd(ped.id));
  }
  return results;
}

test('street engagement: tapping an open moment pays Seeds, marks the person, and cannot be repeated', () => {
  const game = newGame();
  quiet(game);
  openCrowd(game);
  const ped = game.crowd.peds[0];
  const before = game.state.gen.seeds;
  const r = game.engageCrowd(ped.id);
  assert.ok(r, 'engagement succeeds');
  assert.ok(r.seeds >= BALANCE.street.rewardFloor[0]);
  assert.equal(game.state.gen.seeds - before >= r.seeds - 1e-9, true, 'the Seeds that were shown were actually earned');
  assert.equal(ped.done, true);
  assert.equal(ped.opp, false);
  assert.equal(game.engageCrowd(ped.id), null, 'one moment per person');
  assert.equal(game.state.gen.encounterStats.engagements, 1);
});

test('street engagement: tapping someone without an open moment does nothing and costs nothing', () => {
  const game = newGame();
  quiet(game);
  const ped = game.crowd.peds[0];
  ped.opp = false;
  const state = JSON.stringify(game.state.gen);
  assert.equal(game.engageCrowd(ped.id), null);
  assert.equal(game.engageCrowd(99999), null);
  assert.equal(JSON.stringify(game.state.gen), state);
});

test('street reward scales with passive production (0.5-1.0 s of production, times streak) and respects floors', () => {
  const game = newGame();
  quiet(game);
  game.state.gen.ministries.tracts.owned = 100; // 200/s with the 25-owned milestone
  game.state.gen.totalSeeds = 0;
  openCrowd(game);
  const r = game.engageCrowd(game.crowd.peds[0].id);
  const passive = seedsPerSecond(game.state, computeModifiers(game.state));
  const critMult = r.crit ? BALANCE.proclaim.critMult : 1;
  assert.equal(r.mult, 1);
  assert.ok(r.seeds >= Math.round(passive * BALANCE.street.engageSeconds[0] * critMult) - 1, `${r.seeds}`);
  assert.ok(r.seeds <= Math.round(passive * BALANCE.street.engageSeconds[1] * critMult) + 1, `${r.seeds}`);
});

test('Active Witness streak: tiers raise the multiplier (x1.0 -> x1.2 -> x1.5 -> x2.0)', () => {
  const game = newGame('streak');
  quiet(game);
  openCrowd(game, 40);
  const tiers = BALANCE.street.streakTiers;
  const seen = new Map();
  for (let i = 1; i <= 16; i++) {
    game.advance(0.1);
    const ped = game.crowd.peds.find((p) => p.opp && !p.done);
    const r = game.engageCrowd(ped.id);
    seen.set(r.streak, r.mult);
  }
  for (const t of tiers) assert.equal(seen.get(Math.max(1, t.at)), t.mult, `streak ${t.at}`);
  assert.equal(game.street.multiplier, 2.0);
  assert.ok(game.state.gen.encounterStats.bestStreak >= 16);
});

test('Active Witness streak decays after the window and fully fades; idle time never costs Seeds', () => {
  const game = newGame('decay');
  quiet(game);
  openCrowd(game, 30);
  engageN(game, 10);
  const st = game.state.gen.street;
  const high = st.streak;
  assert.ok(high >= 10);
  game.advance(BALANCE.street.streakWindow - 0.5);
  assert.equal(st.streak, high, 'no decay inside the window');
  game.advance(3);
  assert.ok(st.streak < high && st.streak > 0, 'decays gradually, not all at once');
  const seeds = game.state.gen.seeds;
  game.advance(30);
  assert.equal(st.streak, 0);
  assert.ok(game.state.gen.seeds >= seeds, 'ignoring the street never removes Seeds');
});

test('Endurance extends the streak window', () => {
  const game = newGame();
  const base = BALANCE.street.streakWindow;
  game.state.gen.upgrades.endurance = true;
  const mods = computeModifiers(game.state);
  assert.equal(mods.streakWindowAdd, BALANCE.upgrades.endurance.effects.streakWindowAdd);
  assert.ok(base + mods.streakWindowAdd > base);
});

test('a conversation interrupts the street and the street resumes (streak and open moments are held)', () => {
  const game = newGame('interrupt');
  game.specialTimer = 1e9;
  openCrowd(game, 30);
  engageN(game, 6);
  const st = game.state.gen.street;
  const streak = st.streak;
  openCrowd(game, 30);
  meetSomeone(game);
  assert.ok(game.enc && game.enc.state === 'active');
  assert.equal(game.streetPaused, true);
  const keep = game.crowd.peds.find((p) => p.opp && !p.done);
  keep.oppLeft = 5;
  assert.equal(game.engageCrowd(keep.id), null, 'cannot work the crowd mid-conversation');
  game.advance(4);
  assert.ok(Math.abs(st.streak - streak) < 1e-9, 'streak holds during the conversation');
  assert.ok(Math.abs(keep.oppLeft - 5) < 1e-9, 'open moments hold during the conversation');
  game.respond(game.enc.choices.find((c) => c.grade === 'strong').id);
  game.skipScripture();
  game.advance(8);
  assert.equal(game.enc, null);
  assert.equal(game.streetPaused, false);
  openCrowd(game, 30);
  assert.ok(game.engageCrowd(game.crowd.peds[0].id), 'street resumes');
  assert.ok(st.streak >= streak, 'completing a conversation adds to the streak');
});

test('idle players are not punished for ignoring the street', () => {
  const idle = newGame('idle');
  idle.state.gen.ministries.tracts.owned = 10;
  idle.state.gen.ministries.bibles.owned = 4;
  quiet(idle);
  idle.advance(300);
  assert.ok(Math.abs(idle.state.gen.seeds - 26 * 300) < 1e-6, 'exactly the passive production');
  assert.equal(idle.state.gen.encounterStats.engagements, 0);

  // People who want to talk walk on unattended: no loss, no negative values, nothing broken.
  const g = newGame('idle2');
  g.state.gen.ministries.tracts.owned = 10;
  const passive = 10;
  g.advance(300);
  g.state.gen.totalSeeds = 20000;
  g.state.gen.genSeconds = 400;
  g.advance(300);
  assert.ok(g.state.gen.seeds >= passive * 600 - 1e-6);
  assert.ok(g.state.gen.encounterStats.specialsMissed >= 3, 'unmet people simply walk on');
  assert.equal(g.state.gen.encounterStats.walkedOn, 0);
  for (const v of Object.values(g.state.gen.street)) assert.ok(v >= 0);
  assert.equal(g.state.gen.ministries.tracts.owned, 10);
});

test('Momentum builds from engagement and good responses, then Stand Firm is earned and ends', () => {
  const game = newGame('momentum');
  game.state.gen.genSeconds = BALANCE.street.standFirm.minSeconds + 5;
  quiet(game);
  openCrowd(game, 60);
  const st = game.state.gen.street;
  const events = [];
  game.on((t, d) => (t === 'standFirm' ? events.push(d.active) : null));
  let n = 0;
  while (!game.street.standFirm && n < 200) {
    game.advance(0.1);
    const ped = game.crowd.peds.find((p) => p.opp && !p.done);
    if (!ped) openCrowd(game, 60);
    else game.engageCrowd(ped.id);
    n++;
  }
  assert.ok(game.street.standFirm, 'Stand Firm triggers when momentum fills');
  assert.deepEqual(events, [true]);
  assert.equal(st.standFirmLeft, BALANCE.street.standFirm.seconds);
  assert.ok(game.street.opportunityMult > 1, 'more opportunities while standing firm');
  // faster Word/Answer recovery
  game.cool.answer = 4;
  game.advance(1);
  assert.ok(game.cool.answer <= 4 - BALANCE.street.standFirm.cooldownSpeed + 0.2);
  game.advance(BALANCE.street.standFirm.seconds + 0.5);
  assert.equal(game.street.standFirm, false);
  assert.equal(st.momentum, 0);
  assert.deepEqual(events, [true, false]);
  assert.equal(game.state.gen.encounterStats.standFirms, 1);
});

test('Stand Firm pays more per engagement than normal', () => {
  const a = newGame('sf');
  const b = newGame('sf');
  for (const g of [a, b]) {
    quiet(g);
    g.state.gen.ministries.tracts.owned = 100;
    g.state.gen.upgrades.courage = false;
    openCrowd(g);
  }
  b.street.startStandFirm();
  const ra = a.engageCrowd(a.crowd.peds[0].id);
  const rb = b.engageCrowd(b.crowd.peds[0].id);
  const normal = ra.crit ? ra.seeds / BALANCE.proclaim.critMult : ra.seeds;
  const firm = rb.crit ? rb.seeds / BALANCE.proclaim.critMult : rb.seeds;
  assert.ok(firm > normal * 1.15 || rb.crit !== ra.crit, `${firm} vs ${normal}`);
});

test('what is shown matches the simulation: ministry ticks sum to actual accrued production', () => {
  const game = newGame('ticks');
  quiet(game);
  const own = { tracts: 12, bibles: 7, streetTeam: 3, bibleStudy: 2, discipleship: 1 };
  for (const [id, n] of Object.entries(own)) game.state.gen.ministries[id].owned = n;
  const sums = Object.fromEntries(MINISTRY_IDS.map((id) => [id, 0]));
  let ticks = 0;
  game.on((t, d) => {
    if (t === 'ministryTick') {
      sums[d.id] += d.amount;
      ticks++;
      assert.ok(d.amount > 0 && d.amount <= d.production * (d.cycle + 0.11), 'a cycle never reports more than production x cycle');
    }
  });
  const before = game.state.gen.seeds;
  game.advance(120);
  const mods = computeModifiers(game.state);
  let total = 0;
  for (const id of MINISTRY_IDS) {
    const prod = lineProduction(game.state, id, mods);
    total += prod * 120;
    assert.ok(Math.abs(sums[id] + game.tickAcc[id] - prod * 120) < 1e-6, `${id}: displayed ticks equal accrued Seeds`);
    const info = game.ministryInfo(id);
    assert.equal(info.production, prod);
    assert.equal(info.tickAmount, prod * BALANCE.ministryCycleSeconds[id]);
  }
  assert.ok(ticks > 30);
  assert.ok(Math.abs(game.state.gen.seeds - before - total) < 1e-6);
  assert.ok(Math.abs(game.baseSeedsPerSec - MINISTRY_IDS.reduce((s, id) => s + lineProduction(game.state, id, mods), 0)) < 1e-9);
});

test('ministries without any units report nothing', () => {
  const game = newGame();
  quiet(game);
  let ticks = 0;
  game.on((t) => t === 'ministryTick' && ticks++);
  game.advance(60);
  assert.equal(ticks, 0);
});

test('ministry visual milestones follow ownership (1 / 5 / 10 / 25)', () => {
  assert.deepEqual(BALANCE.visualMilestones, [1, 5, 10, 25]);
  const tiers = [0, 1, 4, 5, 9, 10, 24, 25, 80].map((n) => visualTier(n));
  assert.deepEqual(tiers, [0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(visualCounts(0).workers, 0);
  assert.equal(visualCounts(1).workers, 1);
  assert.equal(visualCounts(10).workers, 3);
  assert.equal(visualCounts(25).workers, 4);
  assert.equal(visualCounts(5).tractStacks, 2);
  assert.equal(visualCounts(25).bibleStacks, 4);
  assert.ok(visualCounts(25).studyAttendees > visualCounts(1).studyAttendees);
  assert.ok(visualCounts(25).gatherers > visualCounts(1).gatherers);
  assert.deepEqual(crossedMilestone(4, 5), { tier: 2, threshold: 5 });
  assert.equal(crossedMilestone(5, 9), null);
  assert.deepEqual(crossedMilestone(9, 30), { tier: 4, threshold: 25 });
  assert.deepEqual(crossedMilestone(0, 1), { tier: 1, threshold: 1 });
});

test('buying ministries announces milestones exactly when the street changes', () => {
  const game = newGame();
  const gen = game.state.gen;
  gen.seeds = 1e9;
  gen.totalSeeds = 1e9;
  gen.genSeconds = 5000;
  game.checkUnlocks(true);
  const got = [];
  game.on((t, d) => t === 'ministryMilestone' && got.push([d.id, d.tier, d.owned]));
  game.buyMinistry('streetTeam', 1);
  game.buyMinistry('streetTeam', 3);
  assert.deepEqual(got, [['streetTeam', 1, 1]]);
  game.buyMinistry('streetTeam', 1);
  game.buyMinistry('streetTeam', 5);
  game.buyMinistry('streetTeam', 'max');
  assert.deepEqual(got.map((g) => g[1]), [1, 2, 3, 4]);
});

test('purchases update displayed production with before/after numbers that match the simulation', () => {
  const game = newGame();
  const gen = game.state.gen;
  gen.seeds = 1e7;
  gen.totalSeeds = 1e7;
  gen.genSeconds = 5000;
  game.checkUnlocks(true);
  game.buyMinistry('tracts', 12);
  const changes = [];
  game.on((t, d) => t === 'productionChange' && changes.push(d));
  const info = game.ministryInfo('tracts');
  const beforeTotal = game.baseSeedsPerSec;
  game.buyMinistry('tracts', 1);
  assert.equal(changes.length, 1);
  assert.ok(Math.abs(changes[0].before - beforeTotal) < 1e-9);
  assert.ok(Math.abs(changes[0].after - game.baseSeedsPerSec) < 1e-9);
  assert.ok(Math.abs(game.ministryInfo('tracts').production - info.after1) < 1e-9, 'the previewed after-value is what you get');
  const preview10 = game.ministryInfo('bibles').after10;
  game.buyMinistry('bibles', 10);
  assert.ok(Math.abs(game.ministryInfo('bibles').production - preview10) < 1e-9);
  const t0 = game.baseSeedsPerSec;
  game.state.gen.clustersUnlocked.push(1);
  game.buyUpgrade('faithfulHands');
  assert.ok(Math.abs(changes[changes.length - 1].after / t0 - 1.15) < 1e-9, 'Faithful Hands: +15% shown as before -> after');
});

test('active mechanics cannot buy, force, or influence conversion', () => {
  const s = createInitialState(0, 'cv');
  const ctx = { kind: 'standard', index: 60, tier: 2, archetypeId: 'apathetic', scriptureUsed: false, helperOnly: false };
  const base = conversionChance(s, ctx);
  s.gen.street = { streak: 99, idle: 0, momentum: 100, momentumIdle: 0, standFirmLeft: 8 };
  s.gen.encounterStats.engagements = 5000;
  s.gen.encounterStats.standFirms = 99;
  s.gen.encounterStats.attention = 99;
  s.gen.seeds = 1e12;
  assert.equal(conversionChance(s, ctx), base);
  assert.equal(conversionChance(s, { ...ctx, kind: 'boss' }), 0);
  // street taps never touch conversion state
  const game = newGame('cv2');
  quiet(game);
  openCrowd(game, 40);
  const before = JSON.stringify(game.state.gen.conversionState) + game.state.gen.encounterIndex;
  engageN(game, 25);
  assert.equal(JSON.stringify(game.state.gen.conversionState) + game.state.gen.encounterIndex, before);
});

test('save/reload preserves street state, momentum, stats and boss debrief', () => {
  const game = newGame('save');
  quiet(game);
  openCrowd(game, 30);
  engageN(game, 9);
  game.state.gen.street.momentum = 55;
  game.state.gen.bossState.lastDebrief = { phase: 2, label: 'Uncertain', tips: ['crowd'] };
  const back = deserialize(serialize(game.state));
  assert.deepEqual(back.gen.street, game.state.gen.street);
  assert.equal(back.gen.encounterStats.engagements, 9);
  assert.equal(back.gen.encounterStats.bestStreak, game.state.gen.encounterStats.bestStreak);
  assert.deepEqual(back.gen.bossState.lastDebrief, game.state.gen.bossState.lastDebrief);
  // an older save without the new fields loads with safe defaults
  const raw = JSON.parse(serialize(game.state));
  delete raw.gen.street;
  delete raw.gen.encounterStats.engagements;
  const old = deserialize(JSON.stringify(raw));
  assert.equal(old.gen.street.streak, 0);
  assert.equal(old.gen.encounterStats.engagements, 0);
});

test('offline progression is unchanged by street mechanics: Seeds/Funds only', () => {
  const game = newGame('off2');
  game.state.gen.ministries.tracts.owned = 10;
  game.state.gen.street.streak = 7;
  game.state.gen.street.momentum = 40;
  const { word, ...street } = game.state.gen.street; // WORD readiness is the one thing that charges while away (see word.test.js)
  const stats = JSON.stringify(game.state.gen.encounterStats);
  const gains = game.creditOffline(3600);
  assert.equal(gains.seeds, 10 * 3600);
  const { word: wordAfter, ...streetAfter } = game.state.gen.street;
  assert.deepEqual(streetAfter, street, 'no streak/momentum progress offline');
  assert.equal(JSON.stringify(game.state.gen.encounterStats), stats, 'no engagements or conversations offline');
  assert.ok(wordAfter >= word);
});

// ---------------------------------------------------------------- boss: window and tolerance

function bossGame(seed = 'bw') {
  const game = newGame(seed);
  const gen = game.state.gen;
  gen.genSeconds = BALANCE.boss.unlockSeconds + 5;
  gen.totalSeeds = BALANCE.boss.unlockSeeds + 1;
  gen.seeds = 1e6;
  for (const id of MINISTRY_IDS) gen.ministries[id].owned = 3;
  game.checkUnlocks(true);
  game.challengeBoss();
  game.advance(BALANCE.boss.introSeconds + 0.2);
  game.conversationTimer = 1e9;
  return game;
}

test('boss: the crowd attention window turns engagement into an easier next argument', () => {
  const run = (taps) => {
    const game = bossGame();
    game.boss.enc.resistance = 1;
    bossRespond(game);
    assert.equal(game.boss.stage, 'window');
    assert.equal(game.streetPaused, false, 'the street is open during the window');
    openCrowd(game, 30);
    for (let i = 0; i < taps; i++) {
      game.advance(0.2);
      const ped = game.crowd.peds.find((p) => p.opp && !p.done);
      if (ped) game.engageCrowd(ped.id);
    }
    game.advance(Math.max(0.1, BALANCE.boss.windowSeconds - game.boss.t + 0.3));
    assert.equal(game.boss.stage, 'transition');
    game.advance(BALANCE.boss.transitionSeconds + 0.3);
    assert.equal(game.boss.stage, 'argument');
    return game.boss.enc;
  };
  const none = run(0);
  const some = run(6);
  const lots = run(20);
  const full = BALANCE.boss.arguments[1].resistance;
  assert.equal(none.resistanceMax, full);
  assert.equal(some.resistanceMax, Math.round(full * (1 - 6 * BALANCE.boss.windowBonusPerEngage)));
  assert.equal(lots.resistanceMax, Math.round(full * (1 - BALANCE.boss.windowBonusMax)), 'capped');
});

test('boss: window engagements pay extra Seeds', () => {
  const game = bossGame('bw2');
  game.state.gen.ministries.tracts.owned = 100;
  game.boss.enc.resistance = 1;
  bossRespond(game);
  openCrowd(game, 30);
  const r = game.engageCrowd(game.crowd.peds[0].id);
  assert.equal(r.window, true);
  assert.equal(game.boss.attention, 1);
  assert.equal(game.state.gen.encounterStats.attention, 1);
  assert.ok(r.seeds >= BALANCE.street.rewardFloor[0] * BALANCE.boss.windowRewardMult);
});

test('boss: an argument that is nearly answered when time runs out is conceded, not failed', () => {
  const game = bossGame('bw3');
  const enc = game.boss.enc;
  enc.resistance = enc.resistanceMax * BALANCE.boss.graceFraction * 0.9;
  enc.timeLeft = 0.05;
  game.advance(0.2);
  assert.equal(game.boss.stage, 'window');
  assert.equal(game.state.gen.bossState.status, 'available');
});

test('boss: failure gives a gentle debrief and removes nothing', () => {
  const game = bossGame('bw4');
  const gen = game.state.gen;
  gen.seeds = 12345;
  gen.funds = 99;
  const enc = game.boss.enc;
  enc.timeLeft = 0.05;
  game.advance(0.3);
  assert.equal(game.boss.stage, 'passed');
  const d = gen.bossState.lastDebrief;
  assert.ok(d && d.phase === 1 && d.tips.length >= 1 && d.tips.length <= 3);
  assert.ok(gen.seeds >= 12345 && gen.funds >= 99);
  assert.equal(gen.bossState.status, 'cooldown');
  assert.ok(gen.bossState.cooldownUntil - gen.genSeconds >= 30, 'retrying instantly is not the plan');
});

test('boss: Stand Firm and responses build momentum during the argument', () => {
  const game = bossGame('bw5');
  game.state.gen.scripturesUnlocked = ['romans1_20'];
  const m0 = game.state.gen.street.momentum;
  bossRespond(game);
  game.castWord('romans1_20');
  assert.ok(game.state.gen.street.momentum > m0);
});

test('streak criteria: the window shrinks as the run heats up', () => {
  const game = newGame('win1');
  quiet(game);
  const st = game.state.gen.street;
  st.streak = 0;
  const cold = game.street.streakWindowNow;
  st.streak = BALANCE.street.streakHeatAt;
  const hot = game.street.streakWindowNow;
  assert.ok(hot < cold);
  assert.ok(hot >= cold * (1 - BALANCE.street.streakWindowHeat) - 1e-9);
});

test('streak criteria: a long idle gap drains a run proportionally and announces a tier drop', () => {
  const game = newGame('drain1');
  quiet(game);
  game.state.gen.street.streak = 30;
  const events = [];
  const orig = game.emit.bind(game);
  game.emit = (n, d) => { events.push([n, d]); return orig(n, d); };
  const before = game.state.gen.street.streak;
  for (let i = 0; i < 100; i++) game.advance(0.1);
  assert.ok(game.state.gen.street.streak < before - 3, 'a run left alone fades');
  assert.ok(events.some(([n, d]) => n === 'streakDown' && d.why === 'pace'));
});

test('streak criteria: tapping empty street costs a slice of a run, never a small run, and a double tap is one miss', () => {
  const game = newGame('miss1');
  quiet(game);
  const st = game.state.gen.street;
  st.streak = 3;
  st.idle = 0;
  game.advance(1);
  assert.equal(game.missTap(), null);
  assert.equal(Math.floor(st.streak), 3, 'runs under the threshold are safe');
  st.streak = 20;
  st.idle = 0;
  game.advance(1);
  game.missTap();
  const cfg = BALANCE.street.missPenalty;
  const lost = Math.max(cfg.min, Math.ceil(20 * cfg.fraction));
  assert.ok(Math.abs(st.streak - (20 - lost)) < 0.2, `${st.streak}`);
  const after = st.streak;
  game.missTap();
  assert.equal(st.streak, after, 'a second tap inside the gap does nothing');
});

test('streak criteria: a miss while a conversation holds the street costs nothing', () => {
  const game = newGame('miss2');
  quiet(game);
  game.state.gen.street.streak = 20;
  game.advance(1);
  const meet = meetSomeone(game);
  assert.ok(meet);
  const before = game.state.gen.street.streak;
  game.missTap();
  assert.equal(game.state.gen.street.streak, before);
});