import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';
import { BOSS } from '../src/data/content.js';
import { SKILLS, argumentClearSeconds, debriefTips } from '../src/systems/bossAnalysis.js';

const R = BALANCE.boss.rebuttal;

function bossGame(seed = 'prof') {
  const game = new Game({ state: createInitialState(0, seed) });
  const gen = game.state.gen;
  gen.genSeconds = BALANCE.boss.unlockSeconds + 10;
  gen.totalSeeds = BALANCE.boss.unlockSeeds + 1;
  gen.seeds = 1e6;
  gen.scripturesUnlocked = ['romans1_20', 'proverbs30_5', 'acts17_30'];
  for (const id of Object.keys(gen.ministries)) gen.ministries[id].owned = 3;
  game.checkUnlocks();
  game.specialTimer = 1e9;
  assert.ok(game.challengeBoss());
  game.advance(BALANCE.boss.introSeconds + 0.2);
  return game;
}
const choose = (game, grade) => game.respond(game.boss.enc.choices.find((c) => c.grade === grade).id);
/** Get the argument to the point where he answers back. */
function toRebuttal(game, grade = 'strong') {
  choose(game, grade);
  const enc = game.boss.enc;
  enc.resistance = enc.resistanceMax * (R.at - 0.05);
  game.advance(0.2);
  assert.equal(enc.step, 'rebut');
  return enc;
}

test('every argument has him answer each of your responses, then answer back with a graded rebuttal', () => {
  for (const phase of BOSS.phases) {
    assert.ok(phase.choices.every((c) => c.reply && c.reply.length > 10), `${phase.id}: he replies to every response`);
    assert.equal(phase.rebuttal.choices.length, 3);
    assert.deepEqual(phase.rebuttal.choices.map((c) => c.grade).sort(), ['partial', 'strong', 'weak']);
    assert.ok(phase.rebuttal.statement.length > 20);
    for (const c of phase.rebuttal.choices) assert.ok(c.text && c.feedback && c.reply && c.label);
  }
});

test('halfway through an argument he answers back; casting pauses while you reply, and it happens once', () => {
  const game = bossGame();
  const enc = toRebuttal(game);
  assert.equal(enc.rebutted, true);
  assert.equal(game.castAnswer(), null, 'no pressing the point while you are replying');
  game.cool.shared = 0;
  assert.equal(game.castWord('romans1_20'), null);
  assert.equal(game.boss.stage, 'argument');
  game.rebut(enc.rebuttalChoices.find((c) => c.grade === 'partial').id);
  assert.equal(enc.step, 'press');
  enc.resistance = enc.resistanceMax * 0.2;
  game.advance(0.3);
  assert.equal(enc.step, 'press', 'he does not answer back a second time');
  assert.equal(game.boss.stats.rebuttals, 1);
});

test('a strong reply cuts what remains of his argument, a middling one changes nothing, a weak one lets him regain some', () => {
  const run = (grade) => {
    const game = bossGame(`prof-${grade}`);
    const enc = toRebuttal(game);
    const before = enc.resistance;
    game.rebut(enc.rebuttalChoices.find((c) => c.grade === grade).id);
    return { before, after: enc.resistance, max: enc.resistanceMax, game };
  };
  const strong = run('strong');
  assert.ok(Math.abs(strong.after - strong.before * (1 - R.strongCut)) < 1e-6);
  assert.equal(strong.game.boss.stats.strongRebuttals, 1);
  const partial = run('partial');
  assert.equal(partial.after, partial.before);
  const weak = run('weak');
  assert.ok(Math.abs(weak.after - (weak.before + R.weakAdd * weak.max)) < 1e-6);
  assert.ok(weak.after <= weak.max);
  assert.ok(strong.after < partial.after && partial.after < weak.after, 'the reply matters');
});

test('if you do not reply he waits, then you press on with a measured answer', () => {
  const game = bossGame('prof-auto');
  const enc = toRebuttal(game);
  const seen = [];
  game.on((t) => seen.push(t));
  game.advance(R.autoSeconds - 1);
  assert.equal(enc.step, 'rebut');
  game.advance(1.5);
  assert.equal(enc.step, 'press');
  assert.equal(enc.rebuttalAnswer.grade, 'partial');
  assert.equal(game.boss.stats.auto, 1);
  assert.ok(seen.includes('bossAutoRespond'));
});

test('the clock keeps running while he answers back, and an argument can still be won or conceded after it', () => {
  const game = bossGame('prof-clock');
  const enc = toRebuttal(game);
  const left = enc.timeLeft;
  game.advance(2);
  assert.ok(enc.timeLeft < left - 1.9);
  game.rebut(enc.rebuttalChoices.find((c) => c.grade === 'strong').id);
  enc.resistance = 1;
  game.cool.answer = 0;
  game.castAnswer();
  assert.equal(game.boss.stage, 'window', 'argument answered');
});

test('an argument answered outright never needs a rebuttal, and a weak run of replies is named in the debrief', () => {
  const game = bossGame('prof-skip');
  game.boss.enc.resistance = 1;
  game.cool.answer = 0;
  choose(game, 'strong');
  assert.equal(game.boss.stage, 'window');
  assert.equal(game.boss.stats.rebuttals, 0);
  const state = createInitialState(0, 'tips');
  const tips = debriefTips(state, { auto: 0, words: 5, fitWords: 3, attention: 9, reachedPhase: 1, rebuttals: 3, strongRebuttals: 0 });
  assert.ok(tips.includes('rebuttal'));
  assert.ok(BOSS.debrief.rebuttal.length > 20);
  assert.ok(!debriefTips(state, { auto: 0, words: 5, fitWords: 3, attention: 9, reachedPhase: 1, rebuttals: 3, strongRebuttals: 3 }).includes('rebuttal'));
});

test('readiness counts how well you answer him back: strong replies shorten the argument, a weak one lengthens it', () => {
  const state = createInitialState(0, 'ready');
  for (const id of Object.keys(state.gen.ministries)) state.gen.ministries[id].owned = 40;
  state.gen.scripturesUnlocked = ['romans1_20', 'proverbs30_5', 'acts17_30', 'john14_6'];
  const base = { ...SKILLS.good };
  const secs = (rebut) => argumentClearSeconds(state, BALANCE, 0, { ...base, rebut });
  assert.ok(secs('strong') < secs('partial'));
  assert.ok(secs('partial') < secs('weak'));
});
