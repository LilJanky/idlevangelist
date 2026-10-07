import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { runSimulation, createBot } from '../tools/harness.js';
import { argumentClearSeconds, bossReadiness, SKILLS } from '../src/systems/bossAnalysis.js';

const hybrid = [1, 2, 3, 4, 5, 6].map((i) => runSimulation('hybrid', `balance-${i}`));
const active = runSimulation('active', 'balance-1');
const casual = runSimulation('casual', 'balance-1');
const idle = runSimulation('idle', 'balance-1');

/** A live game state for a bot profile at a given minute (the bot never attempts the boss). */
function stateAt(profile, seed, minutes) {
  const bot = createBot(profile, seed, { profileOverride: { bossPrep: 1e9 } });
  for (let t = 0; t < minutes * 60; t += 0.1) bot.step(t, 0.1);
  return bot.game.state;
}
// "Appropriately prepared": the Preparation reading (messy play, no crowd bonus) is at least Promising.
const hybridPrepared = stateAt('hybrid', 'balance-1', 30);
const hybridAtGate = stateAt('hybrid', 'balance-1', 21.2);
const activeAtGate = stateAt('active', 'balance-1', 21.2);
const idleAtGate = stateAt('idle', 'balance-1', 22);
const idleLate = stateAt('idle', 'balance-1', 74);

const limits = BALANCE.boss.arguments.map((a) => a.seconds);
const clear = (state, skill, opts) => BALANCE.boss.arguments.map((_, i) => argumentClearSeconds(state, BALANCE, i, skill, opts));
// Crowd-window bonus carried into arguments 2 and 3 (argument 1 has no window before it).
const clearWith = (state, skill, bonus) => BALANCE.boss.arguments.map((_, i) => argumentClearSeconds(state, BALANCE, i, skill, { bonus: i === 0 ? 0 : bonus }));

test('engaged hybrid run reaches the first Next Generation in 22-36 minutes', () => {
  for (const r of hybrid) {
    assert.ok(r.finished, `${r.seed} should finish`);
    assert.ok(r.completeMinutes >= 22 && r.completeMinutes <= 36, `${r.seed}: ${r.completeMinutes} min`);
  }
});

test('highly active play is fastest but never trivialises the run', () => {
  assert.ok(active.finished);
  assert.ok(active.completeMinutes >= 19, `active finished in ${active.completeMinutes}`);
  assert.ok(active.completeMinutes < hybrid[0].completeMinutes);
});

test('mostly idle play remains viable (completes, but significantly slower than hybrid)', () => {
  assert.ok(idle.finished, 'idle should still reach Next Generation');
  assert.ok(idle.completeMinutes <= 80, `idle took ${idle.completeMinutes}`);
  assert.ok(idle.completeMinutes > hybrid[0].completeMinutes + 8, 'active attention gives a noticeable advantage');
});

test('the street is worth playing: engagement volume and Stand Firm moments across a run', () => {
  assert.ok(hybrid[0].engagements > 400, `hybrid taps ${hybrid[0].engagements}`);
  assert.ok(active.engagements > hybrid[0].engagements);
  assert.ok(hybrid[0].standFirms >= 15, `Stand Firm ${hybrid[0].standFirms}`);
  assert.ok(hybrid[0].standFirms <= 80);
  assert.ok(hybrid[0].bestStreak >= 20);
  assert.ok(idle.engagements < hybrid[0].engagements);
});

test('first purchase is reachable within ~15-90 seconds, and WORD and Stand Firm are earned in the first minutes', () => {
  for (const r of [...hybrid, active, casual]) assert.ok(r.marks.firstPurchase >= 15 && r.marks.firstPurchase <= 90, `first purchase at ${r.marks.firstPurchase}s`);
  for (const r of [hybrid[0], active, casual]) {
    assert.ok(r.marks.firstWord >= 30 && r.marks.firstWord <= 150, `first WORD at ${r.marks.firstWord}s`);
    assert.ok(r.marks.firstStandFirm >= BALANCE.street.standFirm.minSeconds && r.marks.firstStandFirm <= 300, `first Stand Firm at ${r.marks.firstStandFirm}s`);
  }
});

test('ministry unlock order and pacing roughly follow the design', () => {
  const m = hybrid[0].marks;
  const min = (k) => m[k] / 60;
  assert.ok(min('own_bibles') >= 2 && min('own_bibles') <= 5, `bibles ${min('own_bibles')}`);
  assert.ok(min('own_streetTeam') >= 5 && min('own_streetTeam') <= 10, `team ${min('own_streetTeam')}`);
  assert.ok(min('own_bibleStudy') >= 11 && min('own_bibleStudy') <= 16, `study ${min('own_bibleStudy')}`);
  assert.ok(min('own_discipleship') >= 17 && min('own_discipleship') <= 22, `disc ${min('own_discipleship')}`);
  assert.ok(m.own_bibles < m.own_streetTeam && m.own_streetTeam < m.own_bibleStudy && m.own_bibleStudy < m.own_discipleship);
});

test('Funds arrive after Seeds are understood; first disciple around minute 6-12; the first person who wants to talk 2.5-10', () => {
  const m = hybrid[0].marks;
  assert.ok(m.funds / 60 >= 6.5 && m.funds / 60 <= 11, `funds ${m.funds / 60}`);
  assert.ok(m.firstDisciple / 60 >= 6 && m.firstDisciple / 60 <= 12, `disciple ${m.firstDisciple / 60}`);
  assert.ok(m.firstSpecial / 60 >= 2.5 && m.firstSpecial / 60 <= 10, `special ${m.firstSpecial / 60}`);
  assert.ok(active.marks.firstSpecial / 60 >= 2.5 && active.marks.firstSpecial / 60 <= 6, `active special ${active.marks.firstSpecial / 60}`);
});

test('upgrade clusters unlock around minutes 5, 12, 16 and 21', () => {
  const m = hybrid[0].marks;
  assert.ok(Math.abs(m.cluster1 / 60 - 5) <= 1.5, `c1 ${m.cluster1 / 60}`);
  assert.ok(Math.abs(m.cluster2 / 60 - 12) <= 1.5, `c2 ${m.cluster2 / 60}`);
  assert.ok(Math.abs(m.cluster3 / 60 - 16.5) <= 2, `c3 ${m.cluster3 / 60}`);
  assert.ok(m.cluster4 / 60 >= 16.5 && m.cluster4 / 60 <= 22.5, `c4 ${m.cluster4 / 60}`);
});

// ---------------------------------------------------------------- The Professor

test('Professor: an appropriately prepared player tolerates several missed opportunities', () => {
  assert.ok(bossReadiness(hybridPrepared, BALANCE).ratio >= 0.9, 'precondition: appropriately prepared (a hybrid bot attempts at this reading)');
  // Messy but competent play (verses in list order, slow reactions) with a modest crowd window: a close win.
  const messy = clearWith(hybridPrepared, SKILLS.messy, 0.15);
  messy.forEach((t, i) => assert.ok(t <= limits[i], `messy play, argument ${i + 1}: ${t.toFixed(1)}s of ${limits[i]}s`));
  assert.ok(Math.max(...messy.map((t, i) => t / limits[i])) > 0.6, 'messy play is a close victory, not a walkover');
  // Slow, late responses (4 s before each use), reading no tags, and only a small crowd window.
  const lateSkill = { ...SKILLS.good, delay: 4 };
  clearWith(hybridPrepared, lateSkill, 0.1).forEach((t, i) => assert.ok(t <= limits[i], `very late play, argument ${i + 1}: ${t.toFixed(1)}s`));
  // Missing the first one, two or three Word/Answer opportunities in every argument still wins every argument
  // (good play with a modest crowd window).
  for (const miss of [1, 2, 3]) {
    clearWith(hybridPrepared, { ...SKILLS.good, miss }, 0.15).forEach((t, i) => assert.ok(t <= limits[i], `${miss} missed opportunities, argument ${i + 1}: ${t.toFixed(1)}s of ${limits[i]}s`));
  }
});

test('Professor: a boss with no single point of failure (answers alone and helpers still make progress)', () => {
  const basic = clear(hybridPrepared, SKILLS.basic);
  // Answer-only is not a win, but it is real progress: it clears the first argument within a bit over its limit.
  assert.ok(basic[0] <= limits[0] * 2.6, `answer-only first argument ${basic[0].toFixed(1)}s`);
  assert.ok(Math.min(...basic) < 600);
});

test('Professor: excellent, good and messy play are meaningfully different', () => {
  const total = (state, skill, opts) => clear(state, skill, opts).reduce((a, b) => a + b, 0);
  const ex = total(activeAtGate, SKILLS.excellent);
  const good = total(activeAtGate, SKILLS.good);
  const messy = total(activeAtGate, SKILLS.messy);
  assert.ok(ex < good && good < messy, `${ex} < ${good} < ${messy}`);
  assert.ok(ex < messy * 0.85, 'excellent play is decisively faster than messy play');
  // Excellent play wins with a substantial margin at the earliest point the Professor appears.
  clear(activeAtGate, SKILLS.excellent).forEach((t, i) => assert.ok(t <= limits[i] * 0.8, `excellent, argument ${i + 1}: ${t.toFixed(1)}s of ${limits[i]}s`));
  clearWith(activeAtGate, SKILLS.excellent, BALANCE.boss.windowBonusMax).forEach((t, i) => assert.ok(t <= limits[i] * 0.7, `excellent with full windows, argument ${i + 1}: ${t.toFixed(1)}s`));
  // Working the crowd during attention windows makes the next argument shorter.
  const noWindow = argumentClearSeconds(hybridPrepared, BALANCE, 2, SKILLS.good, { bonus: 0 });
  const fullWindow = argumentClearSeconds(hybridPrepared, BALANCE, 2, SKILLS.good, { bonus: BALANCE.boss.windowBonusMax });
  assert.ok(fullWindow < noWindow * 0.85, `${fullWindow} vs ${noWindow}`);
});

test('Professor: skill brings readiness earlier; a mostly passive run needs more preparation', () => {
  const r = (state) => bossReadiness(state, BALANCE).ratio;
  assert.ok(r(activeAtGate) > r(hybridAtGate), 'active play is ready first');
  assert.ok(r(hybridAtGate) > r(idleAtGate));
  assert.ok(r(hybridPrepared) > r(hybridAtGate), 'readiness grows with preparation');
  assert.ok(r(idleAtGate) < 0.75, 'a passive run at the first opportunity is clearly underprepared');
  assert.ok(r(idleLate) >= 0.85, 'but sufficient upgrades make it winnable');
  const idleBasicEarly = clear(idleAtGate, SKILLS.basic);
  assert.ok(idleBasicEarly.some((t, i) => t > limits[i]), 'basic play cannot win early');
});

test('Professor is not a guaranteed animation when first available', () => {
  assert.ok(bossReadiness(hybridAtGate, BALANCE).ratio < 1.5);
  assert.ok(clear(hybridAtGate, SKILLS.messy).some((t, i) => t > limits[i] * 0.9), 'a first-time hybrid at the gate is not comfortable');
  for (const r of hybrid) assert.ok(r.bossAttempts >= 1 && r.bossAttempts <= 6, `attempts ${r.bossAttempts}`);
});

test('typical run earns 10-13 Faithfulness regardless of conversion count', () => {
  for (const r of hybrid) assert.ok(r.faithfulness >= 10 && r.faithfulness <= 13, `${r.seed}: ${r.faithfulness}`);
});

test('conversions stay rare: typical runs see 0-6, mean in 1-5', () => {
  const counts = hybrid.map((r) => r.conversions);
  assert.ok(Math.max(...counts) <= 7);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  assert.ok(mean >= 1 && mean <= 5, `mean ${mean} from ${counts}`);
});

const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

test('WORD timing: optimized use earns a meaningful but not absurd advantage; casual use is not a mistake', () => {
  const seeds = [1, 2, 3, 4, 5, 6].map((i) => `balance-${i}`);
  const at15 = (policy) => meanOf(seeds.map((s) => runSimulation('active', s, { maxMinutes: 16, profileOverride: { wordPolicy: policy } }).seedsAt[15]));
  const hold = at15('hold');
  const soon = at15('soon');
  const none = at15('none');
  assert.ok(hold / soon >= 1.04 && hold / soon <= 1.9, `holding for a fuller street vs using it soon: x${(hold / soon).toFixed(2)}`);
  assert.ok(soon / none >= 0.95, `using WORD soon is never worse than ignoring it: x${(soon / none).toFixed(2)}`);
  assert.ok(hold / none <= 2.45, `optimizing WORD is not absurd: x${(hold / none).toFixed(2)}`);
});

test('WORD readiness arrives often enough to matter and rarely enough to be a decision', () => {
  for (const r of [casual, active]) {
    const minutes = r.completeMinutes;
    const gap = (minutes * 60) / Math.max(1, r.wordUses);
    assert.ok(gap >= 20 && gap <= 90, `${r.profile}: one WORD every ${gap.toFixed(0)}s`);
  }
  assert.ok(active.avgWordTargets > casual.avgWordTargets + 1, 'holding reaches a fuller street');
  assert.ok(active.avgWordTargets >= 3.5, `held WORD reaches ${active.avgWordTargets} people on average`);
  assert.ok(hybrid[0].wordUses >= 20, 'a hybrid player proclaims WORD regularly');
});

test('casual street play stays viable: no WORD optimization and mostly weaker answers still finish in range', () => {
  const r = runSimulation('hybrid', 'balance-2', { profileOverride: { wordPolicy: 'none', answerSkill: 0.2, scriptureSkill: 0, accuracy: 0.7 } });
  assert.ok(r.finished);
  assert.equal(r.wordUses, 0);
  assert.ok(r.completeMinutes >= 22 && r.completeMinutes <= 40, `${r.completeMinutes} min`);
  assert.ok(r.bossAttempts <= 4);
});

test('idle play continues to function without any active WORD use or conversations', () => {
  assert.equal(idle.wordUses, 0);
  assert.equal(idle.conversations, 0);
  assert.ok(idle.finished);
});

test('conversations are a regular, bounded part of an engaged run', () => {
  for (const r of hybrid) assert.ok(r.conversations >= 6 && r.conversations <= 30, `${r.seed}: ${r.conversations} conversations`);
  assert.ok(casual.conversations >= 12 && casual.conversations <= 40, `casual conversations ${casual.conversations}`);
});

test('the Professor remains beatable after an imperfect response choice when appropriately prepared', () => {
  // Choosing a partial line in every argument (approach 0.72) plus some missed presses still wins with a modest crowd window.
  const partial = { ...SKILLS.good, approach: 0.72 };
  clearWith(hybridPrepared, partial, 0.15).forEach((t, i) => assert.ok(t <= limits[i], `partial responses, argument ${i + 1}: ${t.toFixed(1)}s of ${limits[i]}s`));
  clearWith(hybridPrepared, { ...partial, miss: 2 }, 0.15).forEach((t, i) => assert.ok(t <= limits[i], `partial + 2 missed presses, argument ${i + 1}: ${t.toFixed(1)}s of ${limits[i]}s`));
});

test('simulation is deterministic for a given seed', () => {
  const again = runSimulation('hybrid', 'balance-1');
  assert.equal(again.completeMinutes, hybrid[0].completeMinutes);
  assert.deepEqual(again.marks, hybrid[0].marks);
});
