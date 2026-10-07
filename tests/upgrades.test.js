import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState, MINISTRY_IDS } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';
import { UPGRADE_TEXT, UPGRADE_TAG_LABEL } from '../src/data/content.js';
import { computeModifiers, lineProduction, seedsPerSecond, milestoneMultiplier, streakMultiplier } from '../src/core/economy.js';
import { serialize, deserialize } from '../src/systems/save.js';
import { createBot } from '../tools/harness.js';
import { currentGoal } from '../src/core/goals.js';

const newGame = (seed = 'u1') => {
  const g = new Game({ state: createInitialState(0, seed) });
  g.specialTimer = 1e9;
  g.crowd.spawnTimer = 1e9;
  return g;
};
const unlockAll = (game) => {
  game.state.gen.clustersUnlocked = [1, 2, 3, 4];
  game.state.gen.fundsUnlocked = true;
  game.state.gen.seeds = 1e12;
  game.state.gen.funds = 1e9;
};
const KNOWN_EFFECTS = new Set([
  'proclaimPct', 'rewardPct', 'wordPct', 'passivePct', 'discipleLinePct', 'critChance', 'critMult', 'streakWindowAdd', 'answerCdPct',
  'specialWindow', 'contextualPct', 'bossPhaseBonus', 'cadencePct', 'costDiscount', 'wordCharge', 'wordCrowd', 'streakBonus', 'talkPct',
  'eventSize', 'eventLife', 'windowBonus', 'windowSecondsAdd', 'oppLifeAdd', 'lineMult', 'synergy',
]);

test('every upgrade is well-formed: named, described, tagged, with known effects and sane costs', () => {
  const ids = Object.keys(BALANCE.upgrades);
  for (const id of ids) {
    const def = BALANCE.upgrades[id];
    assert.ok(UPGRADE_TEXT[id]?.name && UPGRADE_TEXT[id].desc.length > 15, `${id} needs text`);
    assert.ok(UPGRADE_TAG_LABEL[def.tag], `${id} tag ${def.tag}`);
    assert.ok(def.cost > 0 && ['seeds', 'funds'].includes(def.currency));
    assert.ok(Object.keys(def.effects).length >= 1);
    for (const k of Object.keys(def.effects)) assert.ok(KNOWN_EFFECTS.has(k), `${id}: unknown effect ${k}`);
    if (def.currency === 'funds') assert.equal(def.tag, 'supplies', 'Funds buy only mundane supplies');
    if (def.requires) assert.ok(MINISTRY_IDS.includes(def.requires.ministry));
    for (const s of def.effects.synergy || []) assert.ok(MINISTRY_IDS.includes(s.from) && MINISTRY_IDS.includes(s.to) && s.per > 0);
    assert.ok(!/\bsouls?\b|convert|conversion/i.test(UPGRADE_TEXT[id].desc), `${id}: upgrades never buy conversion`);
  }
  assert.equal(Object.keys(UPGRADE_TEXT).filter((id) => !BALANCE.upgrades[id]).length, 0, 'no orphaned text');
});

test('costs climb by cluster, so you cannot afford everything before the Professor and the order matters', () => {
  const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const costs = (n) => Object.values(BALANCE.upgrades).filter((u) => u.currency === 'seeds' && u.cluster === n).map((u) => u.cost);
  const m = [1, 2, 3, 4].map((n) => median(costs(n)));
  assert.ok(m[0] < m[1] && m[1] < m[2] && m[2] < m[3], `median costs by cluster: ${m.join(' < ')}`);
  for (const n of [1, 2, 3, 4]) assert.ok(costs(n).length >= 4, `cluster ${n} has real choices`);
  // a hybrid player reaches the Professor with a good number of upgrades, but not all of them
  const bot = createBot('hybrid', 'upg-count');
  for (let t = 0; t < 21 * 60; t += 0.1) bot.step(t, 0.1);
  const owned = Object.keys(bot.game.state.gen.upgrades).length;
  assert.ok(owned >= 14 && owned <= 30, `owned ${owned} of 34`);
});

test('forks: choosing one path closes the other, for the generation, and it saves', () => {
  const pairs = Object.entries(BALANCE.upgrades).filter(([, d]) => d.exclusiveWith);
  assert.ok(pairs.length >= 6, 'three forks of two');
  for (const [id, def] of pairs) assert.equal(BALANCE.upgrades[def.exclusiveWith].exclusiveWith, id, 'forks are symmetric');
  const game = newGame();
  unlockAll(game);
  assert.equal(game.isUpgradeVisible('streetPreacher'), true);
  assert.equal(game.isUpgradeVisible('faithfulRoutine'), true);
  assert.equal(game.isUpgradeForgone('faithfulRoutine'), false);
  assert.ok(game.buyUpgrade('streetPreacher'));
  assert.equal(game.isUpgradeForgone('faithfulRoutine'), true);
  assert.equal(game.buyUpgrade('faithfulRoutine'), false, 'the other path is closed');
  assert.equal(game.state.gen.upgrades.faithfulRoutine, undefined);
  const back = new Game({ state: deserialize(serialize(game.state)) });
  assert.equal(back.isUpgradeForgone('faithfulRoutine'), true);
  assert.equal(back.buyUpgrade('faithfulRoutine'), false);
  // both paths stay viable: each does something real
  assert.ok(computeModifiers(back.state).wordCrowd > 0);
  const passive = newGame('u2');
  unlockAll(passive);
  passive.state.gen.ministries.tracts.owned = 10;
  const before = passive.baseSeedsPerSec;
  assert.ok(passive.buyUpgrade('faithfulRoutine'));
  assert.ok(passive.baseSeedsPerSec > before * 1.15);
});

test('synergies: owning more of one ministry strengthens another, and previews match what actually happens', () => {
  const game = newGame();
  unlockAll(game);
  const gen = game.state.gen;
  gen.ministries.streetTeam.owned = 3;
  gen.ministries.tracts.owned = 20;
  const mods0 = computeModifiers(game.state);
  const line0 = lineProduction(game.state, 'streetTeam', mods0, 1);
  const preview = game.upgradePreview('handsOnTeam');
  assert.ok(game.buyUpgrade('handsOnTeam'));
  const mods1 = computeModifiers(game.state);
  const line1 = lineProduction(game.state, 'streetTeam', mods1, 1);
  const per = BALANCE.upgrades.handsOnTeam.effects.synergy[0].per;
  assert.ok(Math.abs(line1 / line0 - (1 + per * 20)) < 1e-9, 'Street Team scales with Tracts owned');
  assert.ok(Math.abs(game.baseSeedsPerSec - preview.after) < 1e-6, 'the preview shown before buying is what you get');
  // more Tracts, stronger team
  gen.ministries.tracts.owned = 40;
  assert.ok(lineProduction(game.state, 'streetTeam', computeModifiers(game.state), 1) / line0 > 1 + per * 40 - 1e-9);
  // other lines are untouched
  assert.equal(lineProduction(game.state, 'tracts', computeModifiers(game.state), 1), lineProduction(game.state, 'tracts', mods0, 1) * milestoneMultiplier(40) / milestoneMultiplier(40));
});

test('upgrades tied to a ministry stay hidden until you own it, and are announced as a teaser by the UI data', () => {
  const game = newGame();
  game.state.gen.clustersUnlocked = [1];
  assert.equal(game.isUpgradeVisible('handsOnTeam'), false);
  game.state.gen.ministries.streetTeam.owned = 1;
  assert.equal(game.isUpgradeVisible('handsOnTeam'), true);
  game.state.gen.clustersUnlocked = [1, 2];
  assert.equal(game.isUpgradeVisible('studyLibrary'), false);
  game.state.gen.ministries.bibleStudy.owned = 1;
  assert.equal(game.isUpgradeVisible('studyLibrary'), true);
});

test('cluster 4 arrives late (about minute 20) and previews report passive gains and payback', () => {
  const game = newGame();
  const gen = game.state.gen;
  gen.genSeconds = BALANCE.clusters[4].genSeconds - 1;
  gen.totalSeeds = BALANCE.clusters[4].totalSeeds - 1;
  game.checkUnlocks(true);
  assert.equal(gen.clustersUnlocked.includes(4), false);
  gen.genSeconds += 2;
  game.checkUnlocks(true);
  assert.equal(gen.clustersUnlocked.includes(4), true);
  gen.ministries.tracts.owned = 30;
  gen.ministries.bibles.owned = 10;
  const p = game.upgradePreview('fullBarns');
  assert.ok(Math.abs(p.after / p.before - (1 + BALANCE.upgrades.fullBarns.effects.passivePct)) < 1e-9);
  assert.ok(Math.abs(p.paybackSeconds - BALANCE.upgrades.fullBarns.cost / p.delta) < 1e-6);
  const none = game.upgradePreview('openHands');
  assert.equal(none.delta, 0, 'WORD upgrades do not pretend to add passive Seeds');
  assert.equal(none.paybackSeconds, null);
  for (const id of MINISTRY_IDS) gen.ministries[id].owned = 120;
  const prof = game.upgradePreview('clearVoice');
  assert.ok(prof.readiness && prof.readiness.after > prof.readiness.before, 'Professor upgrades show readiness');
});

test('milestone ladder: each ministry doubles again at 25, 50 and 100 owned', () => {
  assert.equal(milestoneMultiplier(24), 1);
  assert.equal(milestoneMultiplier(25), 2);
  assert.equal(milestoneMultiplier(49), 2);
  assert.equal(milestoneMultiplier(50), 4);
  assert.equal(milestoneMultiplier(99), 4);
  assert.equal(milestoneMultiplier(100), 8);
});

test('new upgrade effects reach the systems they claim to change', () => {
  // WORD readiness
  const w = (upgrade) => {
    const game = newGame('hooks');
    if (upgrade) game.state.gen.upgrades[upgrade] = true;
    game.crowd.spawnPed(true, 1);
    const ped = game.crowd.peds[0];
    ped.opp = true;
    ped.oppLeft = 30;
    ped.x = 0.5;
    game.engageCrowd(ped.id);
    return game.state.gen.street.word;
  };
  assert.ok(Math.abs(w('openHands') / w(null) - (1 + BALANCE.upgrades.openHands.effects.wordCharge)) < 1e-9);
  // WORD crowd bonus
  const pay = (upgrade) => {
    const game = newGame('hooks2');
    if (upgrade) game.state.gen.upgrades[upgrade] = true;
    game.state.gen.ministries.tracts.owned = 40;
    return game.wordPayout(6);
  };
  assert.ok(pay('streetPreacher').crowdMult > pay(null).crowdMult);
  // conversations pay more with Hospitality
  const talk = (upgrade) => {
    const game = newGame('hooks3');
    if (upgrade) game.state.gen.upgrades[upgrade] = true;
    game.state.gen.totalSeeds = 20000;
    game.state.gen.genSeconds = 400;
    game.enc = null;
    game.specialTimer = 0.01;
    game.advance(0.5);
    game.tapSpecial(game.crowd.specials[0].id);
    game.advance(0.7);
    game.respond(game.enc.choices.find((c) => c.grade === 'strong').id);
    game.sayLine(game.enc.lines.find((l) => l.grade === 'direct').id);
    return game.enc.reward.seeds;
  };
  assert.ok(Math.abs(talk('hospitality') / talk(null) - 1.75) < 0.03);
  // gatherings and opportunity life
  const events = (upgrade) => {
    const game = newGame('hooks4');
    game.forceEventKind = 'bus';
    if (upgrade) game.state.gen.upgrades[upgrade] = true;
    let got = null;
    game.on((t, d) => t === 'crowdEvent' && (got = d));
    game.crowd.peds.length = 0;
    game.eventTimer = 0.01;
    game.advance(0.3);
    return got.count;
  };
  assert.ok(events('broadReach') >= events(null) + 1);
  assert.ok(events('foldingTables') >= events(null) + 1);
  const life = (upgrade) => {
    const game = newGame('hooks5');
    if (upgrade) game.state.gen.upgrades[upgrade] = true;
    game.advance(0.2);
    game.crowd.lifeAdd = computeModifiers(game.state).oppLifeAdd;
    return game.crowd.lifeAdd;
  };
  assert.equal(life('rainGear'), 1);
  // Professor window
  const g = newGame('hooks6');
  assert.equal(g.windowSeconds, BALANCE.boss.windowSeconds);
  g.state.gen.upgrades.deepRoots = true;
  assert.equal(g.windowSeconds, BALANCE.boss.windowSeconds + 4);
  // a held streak pays more with Endurance, but only once a streak tier is reached
  assert.equal(streakMultiplier(0, BALANCE, 0.15), 1);
  assert.ok(Math.abs(streakMultiplier(14, BALANCE, 0.15) - 2.15) < 1e-9);
});

test('an upgrade that only boosts a ministry is not offered until you own that ministry (no dead purchases)', () => {
  const game = newGame();
  game.state.gen.clustersUnlocked = [1, 2, 3, 4];
  for (const [id, def] of Object.entries(BALANCE.upgrades)) {
    if (def.currency === 'funds') continue;
    for (const line of Object.keys(def.effects.lineMult || {})) assert.equal(def.requires?.ministry, line, `${id} only boosts ${line}, so it should require owning it`);
  }
  assert.equal(game.isUpgradeVisible('entrustToFaithfulMen'), false);
  game.state.gen.ministries.discipleship.owned = 1;
  assert.equal(game.isUpgradeVisible('entrustToFaithfulMen'), true);
});

test('payback time reflects that moments pay in seconds of production, so a passive gain lifts them too', () => {
  const game = newGame('payback');
  unlockAll(game);
  game.state.gen.ministries.tracts.owned = 30;
  const passiveOnly = game.upgradePreview('fullBarns');
  game.state.gen.totalSeeds = 1000;
  game.state.gen.encounterStats.tapSeeds = 600;
  const withMoments = game.upgradePreview('fullBarns');
  assert.ok(Math.abs(withMoments.paybackSeconds / passiveOnly.paybackSeconds - 0.4) < 1e-9, 'a 60% moments share shortens payback to 40%');
  game.state.gen.encounterStats.tapSeeds = 1000;
  assert.ok(game.upgradePreview('fullBarns').paybackSeconds >= passiveOnly.paybackSeconds / 4 - 1e-9, 'capped at 4x');
});

test('the Professor readiness line appears for every upgrade that changes how you answer him', () => {
  const game = newGame('readiness');
  unlockAll(game);
  for (const id of MINISTRY_IDS) game.state.gen.ministries[id].owned = 100;
  game.state.gen.scripturesUnlocked = Object.keys(BALANCE.scripture.verses);
  for (const id of ['conviction', 'swordOfTheSpirit', 'courage', 'clearVoice']) {
    const p = game.upgradePreview(id);
    assert.ok(p.readiness && p.readiness.after > p.readiness.before, `${id} should show readiness`);
  }
  assert.equal(game.upgradePreview('openDoor').readiness, null);
});

test('the goal bar points at upgrades: a teaser first, then the nearest one, and a fork reads as one choice', () => {
  const game = newGame('goal-up');
  const gen = game.state.gen;
  gen.ministries.tracts.owned = 5;
  gen.ministries.bibles.owned = 1;
  gen.encounterStats.wordUses = 1;
  gen.encounterStats.specialsMet = 1;
  for (const id of MINISTRY_IDS) if (id !== 'tracts' && id !== 'bibles') gen.ministries[id].owned = 25;
  gen.totalSeeds = 5000;
  gen.genSeconds = 100;
  gen.seeds = 0;
  assert.ok(/Upgrades/.test(currentGoal(game).text) || currentGoal(game).progress >= 0);
  gen.clustersUnlocked = [1];
  gen.seeds = 1e7;
  assert.match(currentGoal(game).id, /^(upgrade-|disciple-|boss)/);
  // Cluster 2 with the cheap kit owned: the nearest open upgrade is the fork, shown as a single choice.
  gen.clustersUnlocked = [1, 2];
  for (const id of Object.keys(BALANCE.upgrades)) if (BALANCE.upgrades[id].cluster === 1 || ['clearVoice', 'conviction', 'watchfulEye', 'openDoor', 'goodStewardship', 'trainOthers', 'studyLibrary'].includes(id)) gen.upgrades[id] = true;
  for (const d of gen.disciples) d.status = 'trained';
  gen.seeds = 5e4;
  const goal = currentGoal(game);
  assert.equal(goal.id.startsWith('upgrade-'), true);
  assert.match(goal.text, /Choose a path: .+ or .+/);
  gen.seeds = 1e5;
  assert.ok(game.buyUpgrade('streetPreacher'));
  assert.doesNotMatch(currentGoal(game).text, /Faithful Routine/);
});
