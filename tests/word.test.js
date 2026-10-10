import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState, MINISTRY_IDS } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';
import * as encounterModule from '../src/systems/encounter.js';
import * as content from '../src/data/content.js';
import { makeSpecialEncounter, specialIdFor, encounterReward } from '../src/systems/encounter.js';
import { exchangeQuality, applicationGrade, applicationLabel } from '../src/systems/scripture.js';
import { rollConversion, recordConversion, recordContact } from '../src/systems/conversion.js';
import { streakMultiplier, wordCrowdMultiplier, wordCrowdTier } from '../src/core/economy.js';
import { serialize, deserialize } from '../src/systems/save.js';
import { createBot } from '../tools/harness.js';

const lineOf = (enc, grade = 'direct') => enc.lines.find((l) => l.grade === grade).id;

const W = BALANCE.street.word;
const { ENCOUNTERS, ENCOUNTER_ORDER, APPLICATION_TEXT, SCRIPTURE_ORDER, SCRIPTURES, PLAIN_LINES, PLAIN_IDS } = content;

function newGame(seed = 'w1') {
  const game = new Game({ state: createInitialState(0, seed) });
  game.specialTimer = 1e9;
  game.crowd.spawnTimer = 1e9;
  game.state.gen.scripturesUnlocked.push('romans1_20');
  return game;
}

/** Exactly `n` open, on-screen people (standing still); everyone else is removed. */
function setCrowd(game, n) {
  game.crowd.peds.length = 0;
  for (let i = 0; i < n; i++) game.crowd.spawnPed(true, 1);
  game.crowd.peds.forEach((p, i) => {
    p.opp = true;
    p.done = false;
    p.oppLeft = 40;
    p.x = 0.1 + 0.04 * i;
    p.speed = 0;
  });
}

const fullWord = (game) => {
  game.state.gen.street.word = W.max;
};

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

const choiceOf = (enc, grade) => enc.choices.find((c) => c.grade === grade);

// ---------------------------------------------------------------- WORD readiness

test('WORD readiness is earned by working the street; waiting prepares it too, but slowly', () => {
  const game = newGame();
  game.advance(120);
  assert.ok(Math.abs(game.state.gen.street.word - 120 * W.passivePerSecond) < 0.05, 'time alone charges it steadily');
  assert.ok(W.max / W.passivePerSecond >= 240, 'a full WORD takes minutes of waiting');
  assert.ok(W.perEngage > 5 * W.passivePerSecond, 'one tap is worth more than several seconds of waiting');
  game.state.gen.street.word = 0;
  setCrowd(game, 12);
  const before = game.state.gen.street.word;
  assert.ok(game.engageCrowd(game.crowd.peds[0].id));
  assert.ok(Math.abs(game.state.gen.street.word - before - W.perEngage) < 1e-9);
  // a held streak prepares it faster
  game.state.gen.street.streak = 13;
  game.advance(0.2);
  const w1 = game.state.gen.street.word;
  assert.ok(game.engageCrowd(game.crowd.peds[1].id));
  assert.equal(game.street.tier, 3);
  assert.ok(Math.abs(game.state.gen.street.word - w1 - (W.perEngage + 3 * W.perStreakTier)) < 1e-9);
});

test('WORD readiness: Stand Firm accelerates it, it never decays, and a full WORD does not overflow', () => {
  const game = newGame('w2');
  setCrowd(game, 12);
  game.street.startStandFirm();
  const before = game.state.gen.street.word;
  game.engageCrowd(game.crowd.peds[0].id);
  assert.ok(Math.abs(game.state.gen.street.word - before - W.perEngage * W.standFirmMult) < 1e-9);
  fullWord(game);
  game.advance(90);
  assert.equal(game.state.gen.street.word, W.max, 'holding WORD costs nothing and it does not decay');
  game.advance(0.2);
  setCrowd(game, 4);
  game.engageCrowd(game.crowd.peds[0].id);
  assert.equal(game.state.gen.street.word, W.max, 'readiness does not bank past full');
});

test('WORD needs Scripture to proclaim and a full readiness meter', () => {
  const game = newGame('w3');
  game.state.gen.scripturesUnlocked.length = 0;
  setCrowd(game, 5);
  fullWord(game);
  assert.equal(game.wordReady, false, 'no Scripture yet');
  assert.equal(game.proclaimStreet(), null);
  game.state.gen.scripturesUnlocked.push('romans1_20');
  game.state.gen.street.word = W.max - 1;
  assert.equal(game.wordReady, false);
  assert.equal(game.proclaimStreet(), null);
  assert.equal(game.state.gen.street.word, W.max - 1, 'a failed attempt costs nothing');
});

// ---------------------------------------------------------------- street WORD

test('street WORD reaches the open, on-screen people in full; others on screen hear it too, at a reduced share', () => {
  const game = newGame('w4');
  setCrowd(game, 10);
  const peds = game.crowd.peds;
  const closed = peds.slice(0, 2);
  closed.forEach((p) => (p.opp = false));
  const already = peds[2];
  already.done = true;
  already.opp = false;
  const offscreen = peds[3];
  offscreen.x = 1.05;
  const eligible = peds.slice(4);
  fullWord(game);
  const seeds0 = game.state.gen.seeds;
  const touched = [];
  const heard = [];
  game.on((t, d) => t === 'engage' && d.word && (d.bystander ? heard : touched).push(d));
  const shown = game.wordPayout();
  assert.equal(shown.bystanders, closed.length, 'those not open to a moment but on screen');
  const r = game.proclaimStreet();
  assert.equal(r.count, eligible.length);
  assert.equal(r.bystanders, closed.length);
  assert.deepEqual(touched.map((d) => d.pedId).sort(), eligible.map((p) => p.id).sort());
  assert.deepEqual(heard.map((d) => d.pedId).sort(), closed.map((p) => p.id).sort());
  for (const p of eligible) assert.ok(p.done && !p.opp);
  for (const p of closed) assert.ok(!p.done && !p.opp && p.heard, 'they heard it, and are still there');
  for (const d of heard) assert.equal(d.seeds, r.perPerson * 0 + shown.bystanderEach);
  assert.ok(shown.bystanderEach < shown.perPerson * (W.bystanderMult + 0.05) + 1, 'a smaller share than someone who was open');
  assert.ok(!offscreen.done && offscreen.opp, 'off-screen people are not affected');
  assert.ok(already.done);
  assert.equal(game.state.gen.street.word, 0, 'the readiness is spent');
  assert.equal(game.state.gen.seeds - seeds0, r.total, 'the Seeds shown are the Seeds earned');
});

test('street WORD rewards match the crowd state exactly (preview equals payout)', () => {
  for (const n of [1, 3, 8, 14]) {
    const game = newGame(`w5-${n}`);
    game.state.gen.ministries.tracts.owned = 40;
    setCrowd(game, n);
    fullWord(game);
    const preview = game.wordPayout();
    assert.equal(preview.n, n);
    const seeds0 = game.state.gen.seeds;
    const r = game.proclaimStreet();
    assert.equal(r.perPerson, preview.perPerson);
    assert.equal(r.total, preview.total);
    assert.equal(r.total, preview.perPerson * n);
    assert.equal(game.state.gen.seeds - seeds0, r.total);
    assert.equal(game.state.gen.encounterStats.wordTargets, n);
    assert.equal(game.state.gen.encounterStats.engagements, n);
  }
});

test('a packed street pays substantially more than a thin one (per person and in total)', () => {
  const pay = (n) => {
    const game = newGame('w6');
    game.state.gen.ministries.tracts.owned = 40;
    setCrowd(game, n);
    fullWord(game);
    return game.wordPayout();
  };
  const one = pay(1);
  const four = pay(4);
  const eight = pay(8);
  assert.ok(one.perPerson < four.perPerson && four.perPerson < eight.perPerson, 'each person hears more when the street is full');
  assert.ok(eight.total > four.total * 2.1, `${eight.total} vs ${four.total}`);
  assert.ok(eight.total > one.total * 9, 'waiting for eight is worth far more than eight times a lone proclamation');
  const huge = pay(40);
  const top = W.crowdCurve[W.crowdCurve.length - 1];
  assert.ok(Math.abs(huge.crowdMult - top.mult) < 1e-9, 'the multiplier stops growing at the top of the curve');
});

test('the WORD multiplier climbs with every extra person, in named steps that pay more than the last, and each person earns more', () => {
  const mult = (n, mods = {}) => wordCrowdMultiplier(n, mods, BALANCE);
  assert.equal(mult(1), 1);
  for (let n = 2; n <= 14; n++) assert.ok(mult(n) > mult(n - 1), `${n} people beat ${n - 1}`);
  // Each named step is worth more than the one before it: the curve accelerates toward a full street and a throng.
  const named = W.crowdCurve.filter((p) => p.name);
  assert.equal(named.length, 4);
  let lastGain = 0;
  for (let i = 1; i < W.crowdCurve.length - 1; i++) {
    const a = W.crowdCurve[i - 1];
    const b = W.crowdCurve[i];
    const perPerson = (b.mult - a.mult) / (b.at - a.at);
    if (i > 1) assert.ok(perPerson >= lastGain - 1e-9, `the step to ${b.at} people pays at least as much per extra person`);
    lastGain = perPerson;
  }
  assert.equal(mult(3), 1.25);
  assert.equal(wordCrowdTier(2).index, 0);
  assert.equal(wordCrowdTier(3).name, 'A small gathering');
  assert.equal(wordCrowdTier(7).name, 'A full street');
  assert.equal(wordCrowdTier(12).name, 'A throng');
  assert.equal(wordCrowdTier(12).next, null);
  assert.deepEqual(wordCrowdTier(4).next, { at: 5, name: 'A crowd', mult: 1.6 });
  // Upgrades add to the multiplier per person, up to a limit
  assert.ok(mult(6, { wordCrowd: 0.08 }) > mult(6));
  assert.ok(Math.abs(mult(12, { wordCrowd: 0.1 }) - mult(12) - 0.1 * W.crowdUpgradeMaxPeople) < 1e-9);
});

test('the total WORD pays rises faster than the crowd: ten people are worth far more than twice five', () => {
  const total = (n) => {
    const game = newGame('w-total');
    game.state.gen.ministries.tracts.owned = 40;
    setCrowd(game, n);
    fullWord(game);
    return game.wordPayout().total;
  };
  assert.ok(total(10) > total(5) * 3.4, `${total(10)} vs ${total(5)}`);
  assert.ok(total(7) > total(3) * 3.2);
});

test('WORD interacts with Streak, Momentum and Stand Firm', () => {
  const run = (setup) => {
    const game = newGame('w7');
    game.state.gen.genSeconds = BALANCE.street.standFirm.minSeconds + 5;
    game.state.gen.ministries.tracts.owned = 60;
    setCrowd(game, 6);
    fullWord(game);
    setup(game);
    const m0 = game.state.gen.street.momentum;
    const streak0 = game.street.streakCount;
    const r = game.proclaimStreet();
    return { r, game, m0, streak0 };
  };
  const plain = run(() => {});
  assert.equal(plain.game.street.streakCount, plain.streak0 + W.streakGain, 'proclaiming holds the streak');
  assert.ok(plain.game.state.gen.street.momentum - plain.m0 >= W.momentumBase + W.momentumPerTarget * 6 - 1e-9);

  const streaky = run((g) => {
    g.state.gen.street.streak = 14;
  });
  assert.ok(streaky.r.perPerson > plain.r.perPerson, 'a strong streak makes the proclamation pay more');
  assert.ok(Math.abs(streaky.r.perPerson / plain.r.perPerson - streakMultiplier(16, BALANCE) / streakMultiplier(2, BALANCE)) < 0.05);

  const firm = run((g) => g.street.startStandFirm());
  assert.ok(Math.abs(firm.r.perPerson / plain.r.perPerson - BALANCE.street.standFirm.rewardMult) < 0.04, 'Stand Firm multiplies the payout');
  assert.equal(firm.r.standFirm, true);
  assert.ok(firm.game.state.gen.street.standFirmLeft > 0, 'proclaiming does not end Stand Firm');

  // Reaching Momentum 100 through a proclamation starts Stand Firm
  const near = run((g) => {
    g.state.gen.street.momentum = 99;
  });
  assert.ok(near.game.street.standFirm, 'WORD can complete Momentum');
});

test('holding WORD is gentle: the streak holds longer, open moments linger, and nothing is lost', () => {
  const make = (ready) => {
    const game = newGame('w8');
    setCrowd(game, 4);
    if (ready) fullWord(game);
    game.state.gen.street.streak = 6;
    return game;
  };
  const held = make(true);
  const spent = make(false);
  held.advance(3.3);
  spent.advance(3.3);
  assert.equal(held.state.gen.street.streak, 6, 'streak holds while WORD waits for the crowd');
  assert.ok(spent.state.gen.street.streak < 6);
  const lose = (g) => 40 - g.crowd.peds[0].oppLeft;
  assert.ok(lose(held) < lose(spent) * 0.6, 'open moments linger while WORD is ready');
  assert.ok(held.crowd.peds[0].x - 0.1 < 1e-9, 'standing in place in this test');
});

test('proclaiming to an empty street does nothing and keeps your WORD; passers-by alone are enough to proclaim to', () => {
  const lone = newGame('w9b');
  setCrowd(lone, 4);
  lone.crowd.peds.forEach((p) => (p.opp = false));
  fullWord(lone);
  const r = lone.proclaimStreet();
  assert.ok(r && r.count === 0 && r.bystanders === 4 && r.total > 0, 'they hear it');
  const game = newGame('w9');
  setCrowd(game, 5);
  game.crowd.peds.length = 0;
  fullWord(game);
  const events = [];
  game.on((t) => events.push(t));
  assert.equal(game.proclaimStreet(), null);
  assert.equal(game.state.gen.street.word, W.max);
  assert.ok(events.includes('wordNoTarget'));
});

test('WORD cannot be proclaimed to the street mid-conversation, and is not required to finish one', () => {
  const game = newGame('w10');
  fullWord(game);
  const enc = meetSomeone(game);
  setCrowd(game, 5);
  assert.equal(game.proclaimStreet(), null);
  game.state.gen.street.word = 0;
  game.respond(choiceOf(enc, 'strong').id);
  assert.ok(game.sayLine(lineOf(game.enc, 'direct')), 'the conversation does not need WORD');
  assert.equal(game.state.gen.encounterStats.completed, 1);
});

test('WORD in a conversation shares the street readiness: ready WORD adds weight, and is spent', () => {
  const play = (charged) => {
    const game = newGame('w11');
    const enc = meetSomeone(game);
    game.state.gen.street.word = charged ? W.max : 0;
    game.respond(choiceOf(enc, 'strong').id);
    const grade = game.sayLine(lineOf(game.enc, 'direct'));
    return { game, enc, grade };
  };
  const ready = play(true);
  const plain = play(false);
  assert.equal(ready.enc.wordCharged, true);
  assert.equal(plain.enc.wordCharged, false);
  assert.ok(Math.abs(ready.enc.reward.seeds / plain.enc.reward.seeds - W.encounterBonus) < 0.02);
  assert.equal(ready.game.state.gen.street.word, W.perEncounter, 'readiness was spent, then a conversation prepares a little');
  assert.equal(plain.game.state.gen.street.word, W.perEncounter);
  assert.equal(ready.enc.scripture.grade, 'direct');
});

test('WORD in the Professor\'s attention window reaches the whole attentive crowd and counts as attention', () => {
  const game = newGame('w12');
  const gen = game.state.gen;
  gen.genSeconds = BALANCE.boss.unlockSeconds + 5;
  gen.totalSeeds = BALANCE.boss.unlockSeeds + 1;
  gen.seeds = 1e6;
  for (const id of MINISTRY_IDS) gen.ministries[id].owned = 3;
  game.checkUnlocks(true);
  game.challengeBoss();
  game.advance(BALANCE.boss.introSeconds + 0.2);
  game.boss.enc.resistance = 1;
  game.respond(choiceOf(game.boss.enc, 'strong').id);
  assert.equal(game.boss.stage, 'window');
  game.advance(0.3);
  fullWord(game);
  const open = game.crowd.openPeds().length;
  assert.ok(open >= 4, `the crowd is attentive (${open})`);
  const r = game.proclaimStreet();
  assert.equal(r.count, open);
  assert.equal(r.window, true);
  assert.equal(r.crowdMult, 1, 'attention, not a bigger payout');
  assert.equal(game.boss.attention, open);
  assert.equal(gen.encounterStats.attention, open);
});

// ---------------------------------------------------------------- retired generic encounters

test('generic random named encounters are retired from normal play', () => {
  assert.equal(encounterModule.makeStandardEncounter, undefined);
  assert.equal(content.ARCHETYPES, undefined);
  assert.equal(content.SPECIALS, undefined);
  assert.equal(BALANCE.encounter.conversationGap, undefined);
  // Nothing interrupts the street while no one is waiting to talk.
  const game = newGame('retired');
  game.specialTimer = 1e9;
  game.state.gen.ministries.tracts.owned = 30;
  for (let i = 0; i < 2400; i++) {
    game.tick(0.1);
    assert.equal(game.enc, null);
  }
  assert.equal(game.state.gen.encounterStats.engaged, 0);
  assert.equal(game.state.gen.encounterStats.completed, 0);
});

test('over a real run, the only conversations are the special archetypes and they arrive in order first', () => {
  const bot = createBot('casual', 'retire-run');
  const seen = [];
  const kinds = new Set();
  for (let t = 0; t < 14 * 60; t += 0.1) {
    bot.step(t, 0.1);
    const enc = bot.game.enc;
    if (enc) {
      kinds.add(enc.kind);
      if (!seen.includes(enc.index + ':' + enc.archetypeId)) seen.push(enc.index + ':' + enc.archetypeId);
    }
  }
  assert.deepEqual([...kinds], ['special']);
  const ids = seen.map((s) => s.split(':')[1]);
  assert.ok(ids.length >= ENCOUNTER_ORDER.length, `conversations met: ${ids.length}`);
  for (const id of ids) assert.ok(ENCOUNTER_ORDER.includes(id));
  assert.deepEqual(ids.slice(0, ENCOUNTER_ORDER.length), ENCOUNTER_ORDER);
  const state = createInitialState(0, 'ord');
  assert.equal(specialIdFor(state), 'skeptic');
});

test('each archetype can appear and be completed', () => {
  for (const id of ENCOUNTER_ORDER) {
    const game = newGame(`arch-${id}`);
    game.enc = makeSpecialEncounter(game.state, id, game.balance);
    game.advance(0.7);
    const enc = game.enc;
    assert.equal(enc.state, 'active');
    assert.equal(enc.name, ENCOUNTERS[id].name);
    assert.ok(game.respond(choiceOf(enc, 'strong').id));
    assert.ok(game.sayLine(lineOf(enc, 'direct')));
    assert.ok(enc.resolved);
    assert.ok(game.state.gen.seeds > 0);
    assert.equal(game.state.gen.encounterStats.completed, 1);
    game.advance(8);
    assert.equal(game.enc, null);
  }
});

test('after a response, three things to say are offered, written for what that person raised, in a stable order', () => {
  for (const id of ENCOUNTER_ORDER) {
    for (let index = 0; index < 12; index++) {
      const state = createInitialState(0, `lines-${id}`);
      state.gen.encounterIndex = index;
      state.gen.genSeconds = 2000; // all four situations are open
      const enc = makeSpecialEncounter(state, id);
      const variant = ENCOUNTERS[id].variants[enc.variant];
      assert.equal(enc.lines.length, 3);
      assert.deepEqual(enc.lines.map((l) => l.id).sort(), ['a', 'b', 'c']);
      assert.deepEqual(enc.lines.map((l) => l.say).sort(), variant.next.map((l) => l.say).sort(), 'the lines belong to this situation, not a shared pool');
      assert.deepEqual(makeSpecialEncounter(state, id).lines.map((l) => l.id), enc.lines.map((l) => l.id), 'deterministic');
    }
  }
  const positions = new Set();
  for (let index = 0; index < 40; index++) {
    const state = createInitialState(0, 'line-order');
    state.gen.encounterIndex = index;
    positions.add(makeSpecialEncounter(state, 'skeptic').lines.findIndex((l) => l.grade === 'direct'));
  }
  assert.equal(positions.size, 3, 'the best line is not always the same letter');
  const game = newGame('after-response');
  const enc = meetSomeone(game);
  assert.equal(enc.step, 'respond');
  game.respond(choiceOf(enc, 'strong').id);
  assert.equal(enc.step, 'apply');
});

test('Answer choices produce graded outcomes: strong > partial > weak, with teaching feedback', () => {
  const strongLabels = ['FOUNDATION EXPOSED', 'BIBLICALLY GROUNDED', 'GRACE AND TRUTH'];
  const weakLabels = ['GROUND SURRENDERED', 'ASSURANCE LEFT STANDING', 'GRACE OBSCURED'];
  for (const id of ENCOUNTER_ORDER) {
    const state = createInitialState(0, `grades-${id}`);
    for (const variant of ENCOUNTERS[id].variants) {
      const labels = variant.choices.map((c) => `${c.grade}:${c.label}`);
      const strong = variant.choices.find((c) => c.grade === 'strong');
      const partial = variant.choices.find((c) => c.grade === 'partial');
      const weak = variant.choices.find((c) => c.grade === 'weak');
      assert.ok(strongLabels.includes(strong.label), labels.join());
      assert.equal(partial.label, 'PARTIAL ANSWER');
      assert.ok(weakLabels.includes(weak.label));
      for (const c of variant.choices) assert.ok(c.feedback.length > 40, 'feedback teaches rather than shouting');
    }
    const quality = (grade) => {
      const enc = makeSpecialEncounter(state, id);
      enc.answer = choiceOf(enc, grade);
      enc.scripture = { id: 'a', grade: 'direct' };
      return { q: exchangeQuality(enc), reward: encounterReward(state, enc).seeds };
    };
    const s = quality('strong');
    const p = quality('partial');
    const w = quality('weak');
    assert.ok(s.q > p.q && p.q > w.q, `${id}: ${s.q} ${p.q} ${w.q}`);
    assert.ok(s.reward > p.reward && p.reward > w.reward, `${id} rewards`);
    assert.ok(w.reward > 0);
  }
});

test('responses are shuffled deterministically: the best answer is not always the same letter', () => {
  const positions = new Set();
  for (let index = 0; index < 40; index++) {
    const state = createInitialState(0, 'shuffle');
    state.gen.encounterIndex = index;
    const a = makeSpecialEncounter(state, 'skeptic');
    const b = makeSpecialEncounter(state, 'skeptic');
    assert.deepEqual(a.choices.map((c) => c.id), b.choices.map((c) => c.id), 'same encounter, same order');
    positions.add(a.choices.findIndex((c) => c.grade === 'strong'));
  }
  assert.equal(positions.size, 3);
});

test('every situation\'s lines draw on real passages, and the line that answers it is the one that draws on Scripture', () => {
  const direct = new Set();
  for (const id of ENCOUNTER_ORDER) {
    for (const v of ENCOUNTERS[id].variants) {
      const answers = v.next.find((l) => l.grade === 'direct');
      assert.ok(SCRIPTURES[answers.verse], `${id}: ${answers.verse}`);
      direct.add(answers.verse);
      const off = v.next.find((l) => l.grade === 'proclaimed');
      assert.ok(SCRIPTURES[off.verse]);
      assert.notEqual(off.verse, answers.verse, 'the unaimed passage is a different one');
    }
  }
  assert.ok(direct.size >= 4, `the passages that answer situations: ${[...direct].join(', ')}`);
  assert.ok(direct.has('romans1_20') && direct.has('romans3_23') && direct.has('acts17_30'));
  assert.equal(applicationGrade('romans1_20', { direct: ['romans1_20'] }), 'direct');
  assert.equal(applicationGrade('john14_6', { direct: ['romans1_20'] }), 'proclaimed');
});

test('a true passage that was not aimed at the question is never called wrong: it is welcome, replied to, and still rewarded', () => {
  const text = JSON.stringify(APPLICATION_TEXT);
  assert.ok(!/wrong|bad|false|fail|incorrect/i.test(text));
  for (const grade of ['direct', 'contextual', 'relevant', 'proclaimed']) assert.ok(APPLICATION_TEXT[grade].label && APPLICATION_TEXT[grade].note);
  assert.equal(applicationLabel('proclaimed'), 'WORD PROCLAIMED');
  const game = newGame('wrongverse');
  const enc = meetSomeone(game);
  game.respond(choiceOf(enc, 'strong').id);
  const used = game.sayLine(lineOf(enc, 'proclaimed'));
  assert.equal(used.grade, 'proclaimed');
  assert.equal(used.label, 'WORD PROCLAIMED');
  assert.ok(used.ref, 'it is a real passage');
  assert.ok(used.reply.length > 10);
  assert.ok(!/wrong|bad|false|fail/i.test(used.label + used.reply));
  assert.ok(enc.reward.seeds > 0);
  assert.ok(enc.reaction && !/wrong/i.test(enc.reaction));
  assert.ok(BALANCE.scripture.application.direct.value > BALANCE.scripture.application.proclaimed.value);
  assert.ok(BALANCE.scripture.application.proclaimed.value > 0);
});

test('completing a conversation perfectly does not guarantee conversion; outcomes ignore every choice', () => {
  const state = createInitialState(0, 'sovereign');
  let converted = 0;
  const outcomes = [];
  for (let i = 0; i < 300; i++) {
    const ctx = { kind: 'special', index: i, tier: 4, archetypeId: 'skeptic' };
    const r = rollConversion(state, ctx);
    outcomes.push(!!r.converted);
    recordContact(state);
    if (r.converted) {
      converted++;
      recordConversion(state, ctx, r.name, 100);
    }
  }
  assert.ok(converted <= BALANCE.conversion.maxPerGeneration);
  assert.ok(converted / 300 < 0.1, `${converted} of 300 perfect exchanges converted`);
  assert.ok(converted >= 1, 'but conversions do occur');
  // Same index, same outcome, regardless of how the exchange went.
  const play = (grade, verse) => {
    const game = newGame('sov2');
    const enc = meetSomeone(game);
    let result = null;
    game.on((t, d) => t === 'resolved' && (result = d.converted));
    game.respond(choiceOf(enc, grade).id);
    if (verse) game.sayLine(lineOf(game.enc, 'direct'));
    else game.skipScripture();
    return result;
  };
  assert.equal(play('strong', 'romans1_20'), play('weak', null));
});

test('conversion never depends on WORD, Momentum or streak', () => {
  const state = createInitialState(0, 'sov3');
  const ctx = { kind: 'special', index: 31, tier: 2, archetypeId: 'broken' };
  const baseRoll = rollConversion(state, ctx);
  state.gen.street.word = W.max;
  state.gen.street.momentum = 100;
  state.gen.street.streak = 50;
  state.gen.street.standFirmLeft = 8;
  state.gen.encounterStats.wordUses = 99;
  assert.deepEqual(rollConversion(state, ctx), baseRoll);
});

// ---------------------------------------------------------------- persistence and offline

test('save/reload preserves WORD readiness and WORD statistics; bad values are clamped', () => {
  const game = newGame('save-word');
  setCrowd(game, 6);
  game.state.gen.street.word = 64.5;
  game.state.gen.street.word += 0;
  game.state.gen.street.word = W.max;
  game.proclaimStreet();
  game.state.gen.street.word = 37.25;
  const back = deserialize(serialize(game.state));
  assert.equal(back.gen.street.word, 37.25);
  assert.equal(back.gen.encounterStats.wordUses, 1);
  assert.equal(back.gen.encounterStats.wordTargets, 6);
  assert.equal(back.gen.encounterStats.wordBest, 6);
  const raw = JSON.parse(serialize(game.state));
  raw.gen.street.word = 1e9;
  assert.equal(deserialize(JSON.stringify(raw)).gen.street.word, W.max);
  raw.gen.street.word = 'nope';
  assert.equal(deserialize(JSON.stringify(raw)).gen.street.word, 0);
  // an older save without WORD fields loads safely
  delete raw.gen.street.word;
  delete raw.gen.encounterStats.wordUses;
  const old = deserialize(JSON.stringify(raw));
  assert.equal(old.gen.street.word, 0);
  assert.equal(old.gen.encounterStats.wordUses, 0);
});

test('while you are away WORD keeps preparing (never proclaimed for you), and coming back to it ready is reported', () => {
  const game = newGame('off-word');
  game.state.gen.ministries.tracts.owned = 10;
  game.state.gen.street.word = 0;
  const brief = game.creditOffline(60);
  assert.ok(Math.abs(game.state.gen.street.word - 60 * W.passivePerSecond) < 1e-6);
  assert.ok(!brief.wordReady);
  const gains = game.creditOffline(3600);
  assert.equal(gains.seeds, 10 * 3600);
  assert.equal(game.state.gen.street.word, W.max, 'it stops at full');
  assert.equal(gains.wordReady, true);
  assert.equal(game.state.gen.encounterStats.wordUses, 0, 'it is never proclaimed for you');
  assert.equal(game.state.gen.encounterStats.completed, 0);
  // nothing to proclaim yet: nothing to charge
  const fresh = new Game({ state: createInitialState(0, 'off-word-2') });
  fresh.creditOffline(3600);
  assert.equal(fresh.state.gen.street.word, 0);
});

// ---------------------------------------------------------------- dialogue, not a reference list

test('the next step is spoken dialogue: every line is something a person would say, and the other person answers that exact line', () => {
  for (const id of ENCOUNTER_ORDER) {
    for (const v of ENCOUNTERS[id].variants) {
      for (const l of v.next) {
        assert.ok(l.say.length > 15 && l.say.length < 175, `${id}: ${l.say}`);
        assert.ok(l.reply.length > 10 && l.reply.length < 110, `${id}: ${l.reply}`);
        assert.ok(!/wrong scripture|bad verse|false verse/i.test(l.say + l.reply), `${id}: ${l.say}`);
      }
    }
  }
  assert.ok(/What do you say next\?/.test(ENCOUNTERS.skeptic.askScripture));
});

test('saying a line: the person replies to exactly that line; a human line does not spend WORD, a line from Scripture can', () => {
  const play = (grade, charged) => {
    const game = newGame('dialogue');
    const enc = meetSomeone(game);
    game.state.gen.street.word = charged ? W.max : 0;
    game.respond(choiceOf(enc, 'strong').id);
    const said = game.sayLine(lineOf(enc, grade));
    return { game, enc, said, line: enc.lines.find((l) => l.grade === grade) };
  };
  const human = play('relevant', true);
  assert.equal(human.said.plain, true);
  assert.equal(human.said.ref, null);
  assert.equal(human.said.reply, human.line.reply);
  assert.equal(human.said.say, human.line.say);
  assert.equal(human.game.state.gen.street.word, W.max, 'WORD is kept for later');
  assert.equal(human.game.state.gen.encounterStats.scripturesProclaimed, 0);
  assert.equal(human.enc.wordCharged, false);
  const verse = play('direct', true);
  assert.equal(verse.said.plain, false);
  assert.ok(verse.said.ref);
  assert.equal(verse.said.reply, verse.line.reply);
  assert.equal(verse.enc.wordCharged, true);
  assert.equal(verse.game.state.gen.encounterStats.scripturesProclaimed, 1);
  assert.equal(verse.said.label, 'DIRECT APPLICATION');
  assert.equal(human.said.label, 'HONEST AND HUMAN');
  // it does not depend on what you have unlocked: a conversation works with no passages at all
  const bare = newGame('bare');
  bare.state.gen.scripturesUnlocked = [];
  const enc = meetSomeone(bare);
  bare.state.gen.scripturesUnlocked = [];
  bare.respond(choiceOf(enc, 'strong').id);
  assert.equal(enc.step, 'apply');
  assert.ok(bare.sayLine(lineOf(enc, 'direct')));
  assert.equal(bare.sayLine('zzz'), null, 'a line that was not offered cannot be said');
});

test('a street WORD reaches people who are only half walked on at either edge, and not people fully off screen', () => {
  const game = newGame('edges');
  const mk = (id, x) => ({ id, x, lane: 1, dir: 1, speed: 0.1, standing: false, hold: false, opp: true, oppLeft: 60, done: false, react: 0, phase: 0, look: 1 });
  game.crowd.peds.length = 0;
  game.crowd.spawnTimer = 1e9;
  game.crowd.peds.push(mk(901, 0.0), mk(902, 1.0), mk(903, 0.5), mk(904, -0.2), mk(905, 1.2));
  const ids = game.crowd.openPeds().map((p) => p.id).sort();
  assert.deepEqual(ids, [901, 902, 903], 'half on at the left and right edges counts; fully off screen does not');
});
