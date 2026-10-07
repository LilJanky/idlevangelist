import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';
import { rollConversion, conversionChance } from '../src/systems/conversion.js';
import { makeSpecialEncounter, encounterReward } from '../src/systems/encounter.js';
import { ENCOUNTERS, ENCOUNTER_ORDER, APPLICATION_TEXT, SCRIPTURES } from '../src/data/content.js';
import { verseImpact, applicationGrade, applicationLabel } from '../src/systems/scripture.js';
import { computeModifiers, proclaimBase } from '../src/core/economy.js';
import { serialize, deserialize } from '../src/systems/save.js';

const lineOf = (enc, grade = 'direct') => enc.lines.find((l) => l.grade === grade).id;

function newGame(seed = 'g1') {
  return new Game({ state: createInitialState(0, seed) });
}

// Someone who wants to talk walks in; tap them and the conversation begins (the street holds meanwhile).
function meetSomeone(game) {
  const gen = game.state.gen;
  gen.totalSeeds = Math.max(gen.totalSeeds, 20000);
  gen.genSeconds = Math.max(gen.genSeconds, 400);
  if (!gen.scripturesUnlocked.includes('romans1_20')) gen.scripturesUnlocked.push('romans1_20');
  game.checkUnlocks(true);
  game.specialTimer = 0.01;
  game.advance(0.5);
  const sp = game.crowd.specials[0];
  assert.ok(sp, 'someone should want to talk');
  assert.ok(game.tapSpecial(sp.id));
  game.advance(game.balance.encounter.focusEnter + 0.1);
  assert.equal(game.enc.state, 'active');
  return game.enc;
}

const strongOf = (enc) => enc.choices.find((c) => c.grade === 'strong');

test('conversation: someone stops to talk; respond, apply a passage, resolve, reward, exit', () => {
  const game = newGame();
  const events = [];
  game.on((t) => events.push(t));
  const enc = meetSomeone(game);
  assert.equal(enc.kind, 'special');
  assert.equal(enc.step, 'respond');
  assert.equal(enc.choices.length, 3);
  assert.equal(game.streetPaused, true);
  assert.ok(game.respond(strongOf(enc).id));
  assert.equal(enc.step, 'apply');
  assert.ok(game.sayLine(lineOf(game.enc, 'direct')));
  assert.ok(game.state.gen.seeds > 0, 'seeds rewarded');
  assert.ok(events.includes('resolved'));
  game.advance(8);
  assert.ok(events.includes('encounterEnd'));
  assert.equal(game.enc, null);
  assert.equal(game.state.gen.encounterStats.completed, 1);
  assert.equal(game.streetPaused, false, 'the street resumes');
});

test('encounter content never uses harmful language, and application is never called wrong, bad or false', () => {
  assert.ok(!/kill|souls|destroy/i.test(JSON.stringify([ENCOUNTERS, ENCOUNTER_ORDER])));
  assert.ok(!/wrong|bad verse|false|failed/i.test(JSON.stringify(APPLICATION_TEXT)), 'Scripture is never presented as wrong');
});

test('resolution and rewards happen exactly once', () => {
  const game = newGame();
  const enc = meetSomeone(game);
  game.respond(strongOf(enc).id);
  assert.ok(game.sayLine(lineOf(game.enc, 'direct')));
  const seedsAfter = game.state.gen.seeds;
  const completed = game.state.gen.encounterStats.completed;
  assert.equal(game.sayLine(lineOf(game.enc, 'direct')), null);
  assert.equal(game.respond(strongOf(enc).id), null);
  assert.equal(game.skipScripture(), false);
  game.finishConversation(enc);
  assert.equal(game.state.gen.seeds, seedsAfter);
  assert.equal(game.state.gen.encounterStats.completed, completed);
});

test('conversation rewards: a floor early, scaled to passive production, and better exchanges pay more', () => {
  const s = createInitialState(0, 'rew');
  const enc = makeSpecialEncounter(s, 'skeptic');
  enc.answer = strongOf(enc);
  enc.scripture = { id: 'romans1_20', grade: 'direct' };
  const early = encounterReward(s, enc);
  assert.ok(early.seeds >= BALANCE.specials.rewardFloor * BALANCE.specials.qualityReward[1] * 0.99);
  s.gen.ministries.tracts.owned = 100; // 800 seeds/s passive with the 25/50/100-owned milestones
  s.gen.totalSeeds = BALANCE.encounter.tiers[2].minSeeds;
  const e2 = makeSpecialEncounter(s, 'skeptic');
  e2.answer = strongOf(e2);
  e2.scripture = { id: 'romans1_20', grade: 'direct' };
  const best = encounterReward(s, e2);
  const [lo, hi] = BALANCE.specials.rewardSeconds;
  const passive = 800;
  assert.ok(best.seeds >= passive * lo * BALANCE.specials.qualityReward[1] * 0.99, `reward ${best.seeds}`);
  assert.ok(best.seeds <= passive * hi * BALANCE.specials.qualityReward[1] * 1.01 + 1, `reward ${best.seeds}`);
  const e3 = makeSpecialEncounter(s, 'skeptic');
  e3.answer = e3.choices.find((c) => c.grade === 'weak');
  e3.scripture = null;
  const poor = encounterReward(s, e3);
  assert.ok(poor.seeds < best.seeds * 0.6, 'a poor exchange pays much less');
  assert.ok(poor.seeds > 0, 'but is never worth nothing');
});

test('someone left waiting simply walks on without penalty', () => {
  const game = newGame();
  meetSomeone(game);
  const seeds = game.state.gen.seeds;
  game.advance(BALANCE.encounter.walkOnSeconds + 1);
  assert.equal(game.state.gen.encounterStats.walkedOn, 1);
  assert.equal(game.state.gen.seeds, seeds);
  game.advance(2);
  assert.equal(game.enc, null);
});

test('exactly five archetypes exist in the intended order, each with four situations, three graded things to say next in each, and a memory of how you spoke last time', () => {
  assert.deepEqual(ENCOUNTER_ORDER, ['skeptic', 'nominal', 'broken', 'worker', 'visitor']);
  for (const id of ENCOUNTER_ORDER) {
    const arch = ENCOUNTERS[id];
    assert.equal(arch.variants.length, 4, id);
    assert.ok(arch.returns.good && arch.returns.poor);
    assert.equal(new Set(arch.variants.map((v) => v.statement)).size, 4);
    for (const v of arch.variants) {
      assert.equal(new Set(v.choices.map((c) => c.id)).size, 3);
      assert.deepEqual(v.next.map((l) => l.grade).sort(), ['direct', 'proclaimed', 'relevant'], 'one line each: answers it, honest and human, true but not aimed');
      for (const l of v.next) {
        assert.ok(l.say.length > 15 && l.reply.length > 10);
        if (l.verse) assert.ok(SCRIPTURES[l.verse], l.verse);
      }
      assert.ok(v.next.find((l) => l.grade === 'direct').verse, 'the line that answers it draws on Scripture');
      assert.ok(!v.next.find((l) => l.grade === 'relevant').verse, 'the human line is not a citation');
    }
    for (const v of arch.variants) {
      assert.equal(v.choices.length, 3);
      assert.deepEqual(v.choices.map((c) => c.grade).sort(), ['partial', 'strong', 'weak']);
      for (const c of v.choices) assert.ok(c.text && c.label && c.feedback && c.reply, `${id}/${c.id}`);
    }
  }
});

test('archetypes have distinct kits, distinct top colors, and no duplicated special-conversation lines', () => {
  const kits = new Set();
  const tops = new Set();
  const statements = new Set();
  const lineSays = new Set();
  const lineReplies = new Set();
  let variantCount = 0;
  let lineCount = 0;

  for (const id of ENCOUNTER_ORDER) {
    const arch = ENCOUNTERS[id];
    assert.ok(arch.look.kit, `${id} kit`);
    kits.add(arch.look.kit);
    tops.add(arch.look.top);

    for (const variant of arch.variants) {
      variantCount++;
      statements.add(variant.statement);
      for (const line of variant.next) {
        lineCount++;
        lineSays.add(line.say);
        lineReplies.add(line.reply);
      }
    }
  }

  assert.equal(kits.size, ENCOUNTER_ORDER.length, 'each archetype has a distinct look.kit');
  assert.equal(tops.size, ENCOUNTER_ORDER.length, 'each archetype has a distinct top color');
  assert.equal(statements.size, variantCount, 'every variant statement is unique across the whole file');
  assert.equal(lineSays.size, lineCount, 'every follow-up line is unique across the whole file');
  assert.equal(lineReplies.size, lineCount, 'every follow-up reply is unique across the whole file');
});

test('critical proclamations occur on street engagements and responses, but not every time', () => {
  const game = newGame('crit');
  game.state.gen.upgrades.courage = true;
  let crits = 0;
  let total = 0;
  for (let i = 0; i < 600; i++) {
    game.advance(0.2);
    const ped = game.crowd.peds.find((p) => p.opp && !p.done);
    const r = ped && game.engageCrowd(ped.id);
    if (r) {
      total++;
      if (r.crit) crits++;
    }
  }
  assert.ok(total > 40, `engaged ${total}`);
  assert.ok(crits > 0 && crits < total, `${crits}/${total}`);
});

test('Scripture application is a gradient (direct > contextual > relevant > proclaimed) and every passage still helps', () => {
  const s = createInitialState(0, 'sc');
  s.gen.scripturesUnlocked = ['romans1_20', 'proverbs30_5', 'acts17_30', 'romans3_23'];
  const mods = computeModifiers(s);
  const enc = { tier: 0, applications: { direct: ['romans1_20'], contextual: ['proverbs30_5'], relevant: ['acts17_30'] } };
  const direct = verseImpact(s, mods, 'romans1_20', enc);
  const contextual = verseImpact(s, mods, 'proverbs30_5', enc);
  const relevant = verseImpact(s, mods, 'acts17_30', enc);
  const proclaimed = verseImpact(s, mods, 'romans3_23', enc);
  assert.deepEqual([direct.grade, contextual.grade, relevant.grade, proclaimed.grade], ['direct', 'contextual', 'relevant', 'proclaimed']);
  // per-point-of-verse-strength comparison (verses differ in base weight, so compare the application multipliers)
  const mult = (g) => BALANCE.scripture.application[g].mult;
  assert.ok(mult('direct') > mult('contextual') && mult('contextual') > mult('relevant') && mult('relevant') > mult('proclaimed'));
  assert.ok(proclaimed.amount > proclaimBase(s, mods), 'a passage that applies less directly is still useful');
  assert.equal(applicationGrade('first_cor3_6', enc.applications), 'proclaimed');
  assert.equal(applicationLabel('direct'), 'DIRECT APPLICATION');
});

test('Scripture is never a mandatory gate: a conversation can be completed without a passage', () => {
  const game = newGame();
  const enc = meetSomeone(game);
  game.respond(strongOf(enc).id);
  assert.ok(game.skipScripture());
  assert.equal(game.state.gen.encounterStats.completed, 1);
  assert.equal(game.state.gen.encounterStats.scripturesProclaimed, 0);
  assert.ok(game.enc.reward.seeds > 0);
});

test('the growth passage is ordinary Scripture: no ministry buff and no effect on conversion', () => {
  const game = newGame();
  const gen = game.state.gen;
  gen.totalSeeds = 20000;
  gen.ministries.bibles.owned = 1;
  gen.ministries.bibleStudy.owned = 5;
  game.checkUnlocks();
  assert.ok(gen.scripturesUnlocked.includes('first_cor3_6'));
  assert.equal(game.buffs.growth, undefined);
  assert.equal(game.passiveMultiplier, 1);
  // when someone recites it in a conversation it is a true passage, but it was not aimed at the question
  const enc = meetSomeone(game);
  game.respond(strongOf(enc).id);
  const line = enc.lines.find((l) => l.verse === 'first_cor3_6');
  if (line) assert.equal(line.grade, 'proclaimed');
});

test('conversion: outcome is a pure function of seed+index (reload cannot reroll)', () => {
  const s = createInitialState(0, 'providence');
  const ctx = { kind: 'special', index: 77, tier: 2, archetypeId: 'skeptic' };
  const a = rollConversion(s, ctx);
  const copy = deserialize(serialize(s));
  const b = rollConversion(copy, ctx);
  assert.deepEqual(a, b);
  let hit = null;
  for (let i = 0; i < 5000 && !hit; i++) {
    const c = { ...ctx, index: i };
    const r = rollConversion(s, c);
    if (r.converted) hit = { c, r };
  }
  assert.ok(hit, 'conversions are possible');
  assert.deepEqual(rollConversion(deserialize(serialize(s)), hit.c), hit.r);
});

test('conversion cannot be bought or forced by money, speed, WORD, Momentum, or impact', () => {
  const s = createInitialState(0, 'x');
  const ctx = { kind: 'special', index: 50, tier: 2, archetypeId: 'skeptic' };
  const base = conversionChance(s, ctx);
  s.gen.seeds = 1e12;
  s.gen.funds = 1e12;
  s.gen.upgrades.clearVoice = true;
  s.gen.upgrades.courage = true;
  s.gen.upgrades.conviction = true;
  s.gen.street.word = 100;
  s.gen.street.momentum = 100;
  s.gen.street.streak = 40;
  assert.equal(conversionChance(s, ctx), base);
  assert.ok(base < 0.12, 'rare');
  assert.equal(conversionChance(s, { ...ctx, kind: 'boss' }), 0);
});

test('conversion: spacing, per-generation cap, and not guaranteed by completion', () => {
  const s = createInitialState(0, 'cap');
  s.gen.conversionState.lastConversionIndex = 40;
  assert.equal(conversionChance(s, { kind: 'special', index: 41, tier: 2 }), 0);
  s.gen.conversionState.lastConversionIndex = -1000;
  s.gen.conversionState.converts = new Array(BALANCE.conversion.maxPerGeneration).fill({ name: 'x' });
  assert.equal(conversionChance(s, { kind: 'special', index: 400, tier: 2 }), 0);
});

test('conversion rates over many seeds stay rare but visible (about one or two in a typical run of conversations)', () => {
  let total = 0;
  const runs = 80;
  const conversations = 16;
  for (let seed = 0; seed < runs; seed++) {
    const s = createInitialState(0, `dist-${seed}`);
    for (let i = 0; i < conversations; i++) {
      const ctx = { kind: 'special', index: i, tier: Math.min(4, Math.floor(i / 5)), archetypeId: 'x' };
      const r = rollConversion(s, ctx);
      s.gen.conversionState.contacts += 1;
      if (r.converted) {
        s.gen.conversionState.converts.push({ name: r.name });
        s.gen.conversionState.lastConversionIndex = i;
        total++;
      }
    }
  }
  const mean = total / runs;
  assert.ok(mean >= 0.7 && mean <= 3.5, `mean conversions ${mean}`);
});

test('purchases: ministries, Buy 1/10/Max, upgrades with correct currency', () => {
  const game = newGame();
  const gen = game.state.gen;
  gen.seeds = 100000;
  gen.totalSeeds = 100000;
  gen.genSeconds = 5000;
  game.checkUnlocks();
  assert.ok(game.buyMinistry('tracts', 10));
  assert.equal(gen.ministries.tracts.owned, 10);
  const before = gen.seeds;
  assert.ok(game.buyMinistry('tracts', 'max'));
  assert.ok(gen.seeds < before);
  assert.ok(gen.seeds < game.ministryInfo('tracts').cost1);
  gen.seeds = 10;
  assert.equal(game.buyMinistry('tracts', 1), false, 'cannot afford');
  // Funds upgrade needs Funds, not Seeds
  gen.seeds = 1e9;
  gen.funds = 0;
  gen.fundsUnlocked = true;
  assert.equal(game.buyUpgrade('literatureBundle'), false);
  gen.funds = 1000;
  assert.ok(game.buyUpgrade('literatureBundle'));
  assert.equal(gen.seeds, 1e9, 'Seeds untouched by a Funds purchase');
  assert.equal(gen.upgrades.literatureBundle, true);
  assert.equal(game.buyUpgrade('literatureBundle'), false, 'cannot buy twice');
});

test('there are 34 upgrades, with no Faithfulness or conversion purchase', () => {
  const ids = Object.keys(BALANCE.upgrades);
  assert.equal(ids.length, 34);
  for (const id of ids) {
    const def = BALANCE.upgrades[id];
    assert.ok(['seeds', 'funds'].includes(def.currency));
    assert.ok(!('faithfulness' in def.effects));
    assert.ok(!Object.keys(def.effects).some((k) => /conver/i.test(k)));
  }
});

test('upgrades are progressively disclosed by cluster', () => {
  const game = newGame();
  assert.equal(game.isUpgradeVisible('persistence'), false);
  game.state.gen.genSeconds = 301;
  game.checkUnlocks();
  assert.ok(game.isUpgradeVisible('persistence'));
  assert.equal(game.isUpgradeVisible('conviction'), false);
  assert.equal(game.isUpgradeVisible('endurance'), false);
});

test('people who want to talk: tap before they pass; missing is free; Watchful Eye extends', () => {
  const game = newGame();
  const gen = game.state.gen;
  gen.totalSeeds = 20000;
  gen.genSeconds = 400;
  game.checkUnlocks(true);
  game.specialTimer = 0.01;
  game.advance(0.5);
  assert.equal(game.crowd.specials.length, 1);
  const sp = game.crowd.specials[0];
  assert.equal(sp.life, BALANCE.specials.lifetime);
  assert.equal(sp.specialId, 'skeptic', 'the first person met is always the Skeptic');
  assert.ok(game.tapSpecial(sp.id));
  assert.equal(game.enc.kind, 'special');
  game.advance(1);
  game.respond(strongOf(game.enc).id);
  game.skipScripture();
  assert.equal(gen.encounterStats.specialsCompleted, 1);
  // miss one
  game.advance(30);
  game.specialTimer = 0.01;
  const seedsBefore = gen.seeds;
  game.spawnTimer = 999;
  game.advance(0.5);
  game.advance(BALANCE.specials.lifetime + 1);
  assert.ok(gen.encounterStats.specialsMissed >= 1);
  assert.ok(gen.seeds >= seedsBefore, 'nothing lost for missing');
  gen.upgrades.watchfulEye = true;
  game.specialTimer = 0.01;
  game.advance(1);
  const sp2 = game.crowd.specials[0];
  assert.equal(sp2.life, BALANCE.specials.lifetime + BALANCE.upgrades.watchfulEye.effects.specialWindow);
});

test('disciples appear, train for Seeds, and 2 Timothy 2:2 introduces multiplication', () => {
  const game = newGame();
  const gen = game.state.gen;
  gen.ministries.streetTeam.owned = 1;
  gen.totalSeeds = 5000;
  game.checkUnlocks();
  const ruth = gen.disciples.find((d) => d.id === 'ruth');
  assert.equal(ruth.status, 'candidate');
  gen.seeds = 100000;
  let verse = null;
  game.on((t, d) => t === 'discipleTrained' && (verse = d.verse));
  assert.ok(game.trainDisciple('ruth'));
  assert.equal(verse.ref, '2 Timothy 2:2');
  assert.equal(gen.disciples.find((d) => d.id === 'tomas').status, 'hidden', 'not every disciple appears at once');
  assert.ok(game.assignDisciple('ruth', 'streetTeam'));
  assert.equal(ruth.assigned, 'streetTeam');
});

test('conversions never mark converts as automatic workers', () => {
  const game = newGame();
  game.state.gen.conversionState.converts.push({ name: 'Marcus' });
  game.checkUnlocks();
  assert.ok(game.state.gen.disciples.every((d) => d.status !== 'trained'));
});

test('passive production is frame-rate independent at the Game level', () => {
  const run = (step) => {
    const game = newGame('fps');
    game.state.gen.ministries.tracts.owned = 7;
    game.state.gen.ministries.bibles.owned = 3;
    game.spawnTimer = 1e9;
    game.specialTimer = 1e9;
    game.advance(60, step);
    return game.state.gen.seeds;
  };
  const a = run(1 / 60);
  const b = run(0.25);
  assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, a), `${a} vs ${b}`);
  assert.ok(Math.abs(a - 19 * 60) < 1e-6 * a);
});

test('crowd and effects stay bounded over long sessions and boss gatherings', () => {
  const game = newGame('crowd');
  game.state.gen.totalSeeds = 1e8;
  game.state.gen.genSeconds = 5000;
  game.checkUnlocks(true);
  let max = 0;
  for (let i = 0; i < 6000; i++) {
    game.tick(0.1);
    max = Math.max(max, game.crowd.peds.length, game.crowd.specials.length);
    if (i === 3000) {
      game.state.gen.bossState.status = 'available';
      game.challengeBoss();
    }
  }
  const cap = BALANCE.crowd.cap + BALANCE.crowd.gatherCapBonus + 6;
  assert.ok(max <= cap, `crowd ${max} > ${cap}`);
});

test('a reload re-presents the same encounter and the same hidden outcome (no reroll, whatever you answer)', () => {
  const play = (state, grade) => {
    const game = new Game({ state });
    const enc = meetSomeone(game);
    const info = { index: enc.index, arch: enc.archetypeId, variant: enc.variant, order: enc.choices.map((c) => c.id).join(','), name: enc.name };
    let converted = null;
    game.on((t, d) => t === 'resolved' && (converted = d.converted));
    game.respond(enc.choices.find((c) => c.grade === grade).id);
    if (grade === 'strong') game.sayLine(lineOf(game.enc, 'direct'));
    else game.skipScripture();
    return { info, converted };
  };
  const base = createInitialState(0, 'noreroll');
  let found = null;
  for (let i = 0; i < 400 && !found; i++) {
    const saved = serialize(base);
    const first = play(deserialize(saved), 'strong');
    if (first.converted) found = { saved, first };
    base.gen.encounterIndex += 1;
  }
  assert.ok(found, 'a converting encounter exists within 400 encounters');
  const again = play(deserialize(found.saved), 'strong');
  assert.deepEqual(again.info, found.first.info);
  assert.equal(again.converted, true, 'reloading cannot erase or reroll a determined outcome');
  const weak = play(deserialize(found.saved), 'weak');
  assert.equal(weak.converted, true, 'a weaker exchange does not change the hidden outcome either');
});
