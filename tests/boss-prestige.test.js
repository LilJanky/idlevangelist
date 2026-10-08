import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';
import { serialize, deserialize } from '../src/systems/save.js';
import {
  faithfulnessBreakdown, completeGeneration, beginNextGeneration, canBuyNode, buyNode,
} from '../src/systems/prestige.js';
import { computeModifiers } from '../src/core/economy.js';
import { BOSS } from '../src/data/content.js';

function bossReadyGame(seed = 'boss') {
  const game = new Game({ state: createInitialState(0, seed) });
  const gen = game.state.gen;
  gen.genSeconds = BALANCE.boss.unlockSeconds + 10;
  gen.totalSeeds = BALANCE.boss.unlockSeeds + 1;
  gen.seeds = 1e6;
  for (const id of Object.keys(gen.ministries)) gen.ministries[id].owned = 3;
  game.checkUnlocks();
  return game;
}

function playToVictory(game) {
  assert.ok(game.challengeBoss());
  game.advance(BALANCE.boss.introSeconds + 0.2);
  for (let phase = 0; phase < 3; phase++) {
    assert.equal(game.boss.stage, 'argument');
    assert.equal(game.boss.phaseIndex, phase);
    game.boss.enc.resistance = 1;
    game.cool.answer = 0;
    assert.ok(game.respond(game.boss.enc.choices.find((c) => c.grade === 'strong').id));
    if (phase < 2) {
      assert.equal(game.boss.stage, 'window', 'the crowd listens between arguments');
      game.advance(BALANCE.boss.windowSeconds + 0.2);
      assert.equal(game.boss.stage, 'transition');
      game.advance(BALANCE.boss.transitionSeconds + 0.2);
    }
  }
}

test('boss stays locked until the lecture time and Discipleship, then becomes available', () => {
  const game = new Game({ state: createInitialState(0, 'b0') });
  const gen = game.state.gen;
  gen.totalSeeds = 1e9;
  gen.ministries.discipleship.owned = 1;
  game.checkUnlocks();
  assert.equal(gen.bossState.status, 'locked', 'time gate prevents a rush');
  gen.genSeconds = BALANCE.boss.unlockSeconds;
  game.checkUnlocks();
  assert.equal(gen.bossState.status, 'available');
});

test('boss is foreshadowed before it can be challenged', () => {
  const game = new Game({ state: createInitialState(0, 'b1') });
  const gen = game.state.gen;
  const seen = [];
  game.on((t) => t === 'bossForeshadow' && seen.push(t));
  gen.genSeconds = BALANCE.boss.foreshadowSeconds + 1;
  gen.totalSeeds = BALANCE.boss.foreshadowSeeds + 1;
  game.checkUnlocks();
  assert.equal(seen.length, 1);
  assert.equal(gen.bossState.status, 'locked');
  assert.ok(BOSS.foreshadow.length >= 2);
});

test('boss has three arguments: naturalism, authority, autonomy', () => {
  assert.deepEqual(BALANCE.boss.arguments.map((p) => p.id), ['naturalism', 'authority', 'autonomy']);
  assert.deepEqual(BOSS.phases.map((p) => p.id), ['naturalism', 'authority', 'autonomy']);
});

test('boss may be attempted before guaranteed victory; a chosen response and applied Scripture both help', () => {
  const game = bossReadyGame();
  assert.ok(game.bossAvailable);
  assert.ok(game.bossPreparation() < 100);
  game.challengeBoss();
  game.advance(BALANCE.boss.introSeconds + 0.1);
  const enc = game.boss.enc;
  assert.equal(enc.step, 'respond');
  assert.equal(enc.choices.length, 3);
  assert.equal(game.castAnswer(), null, 'a line must be chosen before it can be pressed');
  const before = enc.resistance;
  assert.ok(game.respond(enc.choices.find((c) => c.grade === 'strong').id));
  assert.ok(enc.resistance < before);
  assert.equal(enc.step, 'press');
  game.state.gen.scripturesUnlocked = ['romans1_20', 'john14_6'];
  const mid = enc.resistance;
  const r = game.castWord('romans1_20');
  assert.equal(r.grade, 'direct', 'Romans 1:20 applies directly to the naturalism argument');
  assert.ok(enc.resistance < mid);
});

test('boss: the response chosen matters (strong > partial > weak) but any choice keeps the argument winnable', () => {
  const press = (grade) => {
    const game = bossReadyGame('resp');
    game.challengeBoss();
    game.advance(BALANCE.boss.introSeconds + 0.1);
    const enc = game.boss.enc;
    const before = enc.resistance;
    game.respond(enc.choices.find((c) => c.grade === grade).id);
    return before - enc.resistance;
  };
  const strong = press('strong');
  const partial = press('partial');
  const weak = press('weak');
  assert.ok(strong > partial && partial > weak && weak > 0, `${strong} > ${partial} > ${weak} > 0`);
});

test('boss failure: the opportunity passes with no loss of Seeds, Funds, upgrades, or ministries', () => {
  const game = bossReadyGame();
  const gen = game.state.gen;
  gen.funds = 777;
  gen.upgrades.clearVoice = true;
  const snapshot = { seeds: gen.seeds, funds: gen.funds, up: { ...gen.upgrades }, min: JSON.stringify(gen.ministries), disc: JSON.stringify(gen.disciples) };
  game.challengeBoss();
  game.advance(BALANCE.boss.introSeconds + 0.1);
  let failed = false;
  game.on((t) => t === 'bossPassed' && (failed = true));
  game.advance(BALANCE.boss.arguments[0].seconds + 1);
  assert.ok(failed);
  assert.equal(game.boss.stage, 'passed');
  assert.ok(gen.seeds >= snapshot.seeds, 'no Seeds lost');
  assert.equal(gen.funds >= snapshot.funds, true);
  assert.deepEqual(gen.upgrades, snapshot.up);
  assert.equal(JSON.stringify(gen.ministries), snapshot.min);
  assert.equal(JSON.stringify(gen.disciples), snapshot.disc);
  assert.equal(gen.bossState.status, 'cooldown');
  assert.equal(game.state.phase, 'gen1');
  game.endBossSession(); // the debrief waits for a tap
  assert.equal(game.boss, null, 'session ends cleanly');
  // short cooldown, then retryable
  assert.ok(BALANCE.boss.cooldownSeconds <= 60);
  assert.equal(game.challengeBoss(), false);
  game.advance(BALANCE.boss.cooldownSeconds + 1);
  assert.equal(gen.bossState.status, 'available');
  assert.ok(game.challengeBoss());
  assert.equal(gen.bossState.attempts, 2);
});

test('boss victory completes the generation, rewards once, and does not require a conversion', () => {
  const game = bossReadyGame('victory');
  const gen = game.state.gen;
  assert.equal(gen.conversionState.converts.length, 0);
  const rewards = [];
  game.on((t, d) => t === 'bossVictory' && rewards.push(d.seeds));
  playToVictory(game);
  assert.equal(rewards.length, 1);
  const seedsAfter = gen.seeds;
  game.bossVictory();
  game.bossVictory();
  assert.equal(rewards.length, 1, 'victory rewards only once');
  assert.equal(gen.seeds, seedsAfter);
  assert.ok(game.finishBossVictory());
  assert.equal(game.state.phase, 'complete');
  assert.ok(gen.bossState.defeated);
  assert.equal(game.state.prestige.summary.breakdown.total >= BALANCE.faithfulness.base + BALANCE.faithfulness.boss, true);
  assert.equal(game.finishBossVictory(), false);
});

test('boss arguments are timed exchanges: only the argument timer ends an attempt', () => {
  const game = bossReadyGame();
  game.challengeBoss();
  game.advance(BALANCE.boss.introSeconds + 0.1);
  const enc = game.boss.enc;
  assert.ok(Math.abs(enc.timeLeft - BALANCE.boss.arguments[0].seconds) < 0.3);
  const before = enc.timeLeft;
  game.advance(5);
  assert.ok(Math.abs(before - enc.timeLeft - 5) < 0.2);
  assert.equal(game.boss.stage, 'argument');
});

// ---------------------------------------------------------------- Faithfulness / prestige

function completedState({ conversions = 0, disciples = 2, ministries = 5, active = 200, boss = true } = {}) {
  const s = createInitialState(0, 'faith');
  const gen = s.gen;
  const ids = Object.keys(gen.ministries);
  ids.slice(0, ministries).forEach((id) => (gen.ministries[id].owned = 2));
  gen.disciples.slice(0, disciples).forEach((d) => (d.status = 'trained'));
  gen.encounterStats.engagements = active;
  gen.bossState.defeated = boss;
  for (let i = 0; i < conversions; i++) gen.conversionState.converts.push({ name: `c${i}` });
  s.phase = 'gen1';
  completeGeneration(s);
  return s;
}

test('Faithfulness nominal result is 12 without needing any conversion', () => {
  const s = completedState({ conversions: 0 });
  assert.equal(s.prestige.summary.breakdown.total, 12);
});

test('conversion count adds at most +1 and the best result is 13', () => {
  const none = faithfulnessBreakdown(completedState({ conversions: 0 })).total;
  const some = completedState({ conversions: 3 }).prestige.summary.breakdown.total;
  const many = completedState({ conversions: 7 }).prestige.summary.breakdown.total;
  assert.equal(some - none, 1);
  assert.equal(many, some, 'forcing more conversions yields no further Faithfulness');
  assert.ok(many <= 13);
});

test('Faithfulness is milestone-based: missing milestones lowers it, typical runs land in 10-13', () => {
  assert.equal(completedState({ ministries: 4, conversions: 0 }).prestige.summary.breakdown.total, 10);
  assert.equal(completedState({ disciples: 1 }).prestige.summary.breakdown.total, 11);
  assert.equal(completedState({ active: 5 }).prestige.summary.breakdown.total, 11);
  assert.equal(completedState({ boss: false }).prestige.summary.breakdown.total, 10);
});

test('generation summary has meaningful stats and no moral grade', () => {
  const s = completedState({ conversions: 2 });
  const stats = s.prestige.summary.stats;
  for (const key of ['seedsPlanted', 'scripturesProclaimed', 'peopleEngaged', 'specialOpportunities', 'disciplesTrained', 'conversionsWitnessed', 'ministriesEstablished']) {
    assert.ok(key in stats, key);
  }
  assert.ok(!JSON.stringify(s.prestige.summary).match(/grade|score|rank/i));
});

test('Begin Next Generation awards Faithfulness exactly once and Faithfulness persists through reload', () => {
  const s = completedState();
  assert.equal(s.currencies.faithfulness, 0, 'not awarded until the player begins');
  const first = beginNextGeneration(s);
  assert.ok(first.ok);
  assert.equal(first.awarded, 12);
  assert.equal(s.currencies.faithfulness, 12);
  assert.equal(s.phase, 'gen2preview');
  assert.equal(s.generation, 2);
  assert.equal(beginNextGeneration(s).ok, false, 'cannot double-award');
  assert.equal(s.currencies.faithfulness, 12);
  const back = deserialize(serialize(s));
  assert.equal(back.currencies.faithfulness, 12);
  assert.equal(back.phase, 'gen2preview');
  assert.equal(back.prestige.completedGenerations, 1);
});

test('Next Generation retains legacy (believers, ministry) and resets generation-scoped progress', () => {
  const s = completedState({ conversions: 2 });
  s.gen.seeds = 5e6;
  beginNextGeneration(s);
  assert.equal(s.gen.seeds, 0);
  assert.equal(s.gen.ministries.tracts.owned, 0);
  assert.deepEqual(s.prestige.legacy.disciples.length, 2);
  assert.equal(s.prestige.legacy.converts.length, 2);
  assert.ok(s.prestige.legacy.ministries.tracts > 0, 'the old ministry is remembered, not erased');
});

test('with a normal first-run award the player can buy at least 2 meaningful prestige nodes', () => {
  const s = completedState();
  beginNextGeneration(s);
  assert.ok(canBuyNode(s, 'steadfastWitness'));
  assert.ok(buyNode(s, 'steadfastWitness'));
  assert.equal(canBuyNode(s, 'rootedInTheWord'), true, 'tier 2 unlocks after tier 1 in the same branch');
  assert.ok(buyNode(s, 'establishedLabor'));
  assert.ok(buyNode(s, 'faithfulInheritance'));
  assert.equal(s.currencies.faithfulness, 12 - 9);
  assert.equal(buyNode(s, 'steadfastWitness'), false, 'cannot buy twice');
  assert.equal(buyNode(s, 'willingHands'), false, 'not enough Faithfulness left');
  const mods = computeModifiers(s);
  assert.equal(mods.proclaimPct, 0.1);
  assert.equal(mods.passivePct, 0.1);
  assert.equal(mods.startSeeds, 1000);
  assert.equal(s.gen.seeds, 1000, 'head start shows in the preview generation state');
});

test('Faithfulness cannot be purchased with Seeds or Funds and prestige nodes cost only Faithfulness', () => {
  const s = completedState();
  beginNextGeneration(s);
  s.currencies.faithfulness = 0;
  s.gen.seeds = 1e12;
  s.gen.funds = 1e12;
  assert.equal(canBuyNode(s, 'steadfastWitness'), false);
  assert.equal(buyNode(s, 'steadfastWitness'), false);
  assert.equal(s.currencies.faithfulness, 0);
  for (const def of Object.values(BALANCE.prestige.nodes)) assert.ok(def.cost > 0 && def.cost <= 12);
});

test('prestige tree is hidden until Generation 1 ends: nodes cannot be bought during gen1', () => {
  const s = createInitialState(0, 'x');
  s.currencies.faithfulness = 99;
  assert.equal(canBuyNode(s, 'steadfastWitness'), false);
});

test('Game wrapper: boss victory -> complete -> next generation -> spend Faithfulness', () => {
  const game = bossReadyGame('wrapper');
  game.state.gen.disciples.slice(0, 2).forEach((d) => (d.status = 'trained'));
  game.state.gen.encounterStats.engagements = 200;
  playToVictory(game);
  game.finishBossVictory();
  const events = [];
  game.on((t) => events.push(t));
  const r = game.beginNextGeneration();
  assert.ok(r.ok);
  assert.ok(events.includes('nextGeneration'));
  assert.equal(game.state.currencies.faithfulness, r.awarded);
  assert.ok(game.buyPrestigeNode('steadfastWitness'));
  assert.equal(game.state.currencies.faithfulness, r.awarded - 3);
  // gameplay is locked in the preview: no encounters surface
  game.advance(30);
  assert.equal(game.enc, null);
});
