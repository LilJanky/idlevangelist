import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';
import { ENCOUNTER_ORDER } from '../src/data/content.js';
import { masteryKey, treatmentFor } from '../src/systems/encounter.js';
import { serialize, deserialize } from '../src/systems/save.js';

const SP = BALANCE.specials;

const newGame = (seed = 'harvest-1') => {
  const g = new Game({ state: createInitialState(0, seed) });
  const gen = g.state.gen;
  gen.totalSeeds = 50000;
  gen.seeds = 5000;
  gen.genSeconds = 400;
  gen.scripturesUnlocked = ['romans1_20'];
  g.specialTimer = 1e9;
  g.crowd.spawnTimer = 1e9;
  return g;
};
/** Replay the same person and situation: put the street back to just before them. */
const replay = (g, enc) => {
  const gen = g.state.gen;
  gen.encounterIndex = enc.index;
  gen.encounterStats.specialsMet = ENCOUNTER_ORDER.indexOf(enc.specialId);
  gen.genSeconds = 400;
};
function talk(g, { response = 'strong', line = 'direct', variant, seed = false } = {}) {
  const sp = g.spawnSpecial(6, { variant });
  assert.ok(g.tapSpecial(sp.id, { seed }));
  g.advance(0.7);
  g.respond(g.enc.choices.find((c) => c.grade === response).id);
  g.sayLine(g.enc.lines.find((l) => l.grade === line).id);
  return g.enc;
}
const finish = (g) => g.advance(8);
const qualityReward = (q) => SP.qualityReward[0] + (SP.qualityReward[1] - SP.qualityReward[0]) * q;

test('learning a situation turns it into a seed to gather: tap them and the conversation is skipped, paid as the best path was', () => {
  const g = newGame();
  const first = talk(g);
  const perfect = first.reward.seeds;
  finish(g);
  replay(g, first);
  const sp = g.spawnSpecial(6, { variant: first.variant });
  assert.equal(sp.treatment, 'learned');
  assert.equal(sp.quality, 1);
  const stats = g.state.gen.encounterStats;
  const streak0 = g.state.gen.street.streak;
  const events = [];
  g.on((t, d) => (t === 'harvested' || t === 'resolved') && events.push([t, d]));
  assert.ok(g.tapSpecial(sp.id)); // anywhere on them
  assert.deepEqual(events.map((e) => e[0]), ['harvested']);
  assert.equal(g.enc, null, 'no conversation, no card, no pause');
  assert.equal(g.streetPaused, false);
  assert.ok(Math.abs(events[0][1].reward.seeds / perfect - 1) < 0.1, `${events[0][1].reward.seeds} vs ${perfect}`);
  assert.equal(stats.harvested, 1);
  assert.ok(g.state.gen.street.streak > streak0, 'still an active moment: it builds the run');
  g.advance(0.2);
  assert.equal(g.crowd.specials.length, 0);
  assert.equal(stats.specialsMissed, 0);
});

test('a new situation is still a conversation', () => {
  const g = newGame('harvest-new');
  const sp = g.spawnSpecial(6);
  assert.equal(sp.treatment, undefined);
  assert.ok(g.tapSpecial(sp.id));
  assert.ok(g.enc, 'the exchange happens');
});

test('after two tries that fall short it is familiar: gather it at the best you reached, or tap them to talk again', () => {
  const g = newGame('harvest-familiar');
  const events = [];
  g.on((t, d) => t === 'familiar' && events.push(d));
  const one = talk(g, { response: 'partial', line: 'relevant' });
  assert.equal(one.newlyFamiliar, undefined, 'once is not enough');
  finish(g);
  replay(g, one);
  const two = talk(g, { response: 'strong', line: 'relevant', variant: one.variant });
  assert.equal(two.newlyFamiliar, true, 'the second try that falls short');
  assert.equal(events.length, 1);
  const best = Math.max(one.reward.quality, two.reward.quality);
  finish(g);
  assert.deepEqual(treatmentFor(g.state, one.specialId, one.variant), { kind: 'familiar', quality: best });
  assert.equal(g.isMastered(one.specialId, one.variant), false, 'not learned: that needs the best path');

  // third time: a seed over them
  replay(g, one);
  const sp = g.spawnSpecial(6, { variant: one.variant });
  assert.equal(sp.treatment, 'familiar');
  // tapping the seed gathers what you reached
  const before = g.state.gen.seeds;
  const harvested = [];
  g.on((t, d) => t === 'harvested' && harvested.push(d));
  assert.ok(g.tapSpecial(sp.id, { seed: true }));
  assert.equal(g.enc, null);
  assert.equal(harvested.length, 1);
  // ...worth the quality you reached, not more
  assert.ok(harvested[0].reward.quality <= best + 1e-9 && harvested[0].reward.quality < 1);
  assert.ok(harvested[0].reward.seeds < two.reward.seeds * 1.3 + 5);
  assert.ok(g.state.gen.seeds > before);
});

test('tapping a familiar person (not the seed) still talks it through, and the best path can still be found', () => {
  const g = newGame('harvest-familiar-2');
  const one = talk(g, { response: 'weak', line: 'proclaimed' });
  finish(g);
  replay(g, one);
  talk(g, { response: 'weak', line: 'relevant', variant: one.variant });
  finish(g);
  replay(g, one);
  const sp = g.spawnSpecial(6, { variant: one.variant });
  assert.equal(sp.treatment, 'familiar');
  assert.ok(g.tapSpecial(sp.id)); // the person, not the seed
  assert.ok(g.enc, 'a conversation');
  g.advance(0.7);
  g.respond(g.enc.choices.find((c) => c.grade === 'strong').id);
  g.sayLine(g.enc.lines.find((l) => l.grade === 'direct').id);
  assert.equal(g.enc.newlyLearned, true);
  finish(g);
  replay(g, one);
  assert.equal(g.spawnSpecial(6, { variant: one.variant }).treatment, 'learned');
});

test('a helper gathers a familiar situation too, for less, at the quality you reached', () => {
  const g = newGame('harvest-helper');
  const one = talk(g, { response: 'partial', line: 'proclaimed' });
  finish(g);
  replay(g, one);
  const two = talk(g, { response: 'partial', line: 'relevant', variant: one.variant });
  finish(g);
  g.state.gen.disciples[0].status = 'trained';
  replay(g, one);
  const sp = g.spawnSpecial(6, { variant: one.variant });
  assert.ok(sp.autoAt > 0 && sp.helper);
  const got = [];
  g.on((t, d) => t === 'automated' && got.push(d));
  g.advance(sp.autoAt + 0.5);
  assert.equal(got.length, 1);
  assert.ok(Math.abs(got[0].reward.quality - Math.max(one.reward.quality, two.reward.quality)) < 1e-9);
  assert.equal(g.state.gen.encounterStats.automated, 1);
});

test('what a familiar situation pays follows the quality reached, by the same rule as a conversation', () => {
  const g = newGame('harvest-pay');
  const learned = talk(g);
  finish(g);
  const perfect = learned.reward.seeds;
  replay(g, learned);
  const sp = g.spawnSpecial(6, { variant: learned.variant });
  sp.treatment = 'familiar';
  sp.quality = 0.5;
  let seeds = null;
  g.on((t, d) => t === 'harvested' && (seeds = d.reward.seeds));
  g.tapSpecial(sp.id, { seed: true });
  assert.ok(Math.abs(seeds / perfect - qualityReward(0.5) / qualityReward(1)) < 0.08, `${seeds} vs ${perfect}`);
});

test('whether someone comes to Christ does not depend on whether you talked, gathered, or a disciple did', () => {
  let compared = 0;
  for (let i = 0; i < 120; i++) {
    const seed = `harvest-faith-${i}`;
    const manual = newGame(seed);
    const gathered = newGame(seed);
    for (const g of [manual, gathered]) {
      g.state.gen.encounterIndex = 5 + (i % 7);
      g.state.gen.encounterStats.specialsMet = 3;
      g.state.gen.conversionState.lastConversionIndex = -1000;
    }
    const talked = talk(manual);
    const a = manual.state.gen.people.at(-1);
    gathered.state.gen.mastery[masteryKey(talked.archetypeId, talked.variant)] = true;
    const sp = gathered.spawnSpecial(6, { variant: talked.variant });
    gathered.tapSpecial(sp.id);
    const b = gathered.state.gen.people.at(-1);
    assert.ok(b?.harvest);
    assert.equal(b.converted, a.converted, `seed ${seed}`);
    compared++;
  }
  assert.equal(compared, 120);
});

test('practice is saved, and old saves without it load', () => {
  const g = newGame('harvest-save');
  const one = talk(g, { response: 'partial', line: 'relevant' });
  const back = new Game({ state: deserialize(serialize(g.state)) });
  const key = masteryKey(one.specialId, one.variant);
  assert.equal(back.state.gen.practice[key].tries, 1);
  const raw = JSON.parse(serialize(g.state));
  delete raw.gen.practice;
  assert.deepEqual(new Game({ state: deserialize(JSON.stringify(raw)) }).state.gen.practice, {});
});

// ---------------------------------------------------------------- everyone on screen hears it

function street(g, specs) {
  g.crowd.peds.length = 0;
  g.crowd.surge(specs.length, [60, 60]);
  g.crowd.peds.forEach((p, i) => {
    p.speed = 0;
    p.standing = true;
    p.x = specs[i].x ?? 0.2 + 0.07 * i;
    p.opp = specs[i].open !== false;
    p.oppLeft = 60;
    p.done = false;
    p.heard = false;
  });
  g.state.gen.street.word = BALANCE.street.word.max;
}

test('proclaiming reaches everyone on screen: the open in full, the rest at a reduced share, once each', () => {
  const g = newGame('hear-1');
  g.state.gen.ministries.tracts.owned = 200;
  street(g, [{}, {}, {}, { open: false }, { open: false }, { open: false, x: 1.05 }]);
  const shown = g.wordPayout();
  assert.equal(shown.n, 3);
  assert.equal(shown.bystanders, 2, 'off-screen people are not counted');
  const r = g.proclaimStreet();
  assert.equal(r.count, 3);
  assert.equal(r.bystanders, 2);
  assert.equal(r.total, shown.total);
  assert.ok(Math.abs(shown.bystanderEach / shown.perPerson - BALANCE.street.word.bystanderMult) < 0.02);
  assert.equal(g.state.gen.encounterStats.wordBystanders, 2);
  // a second proclamation does not pay the same bystanders again
  g.state.gen.street.word = BALANCE.street.word.max;
  assert.equal(g.crowd.bystanders().length, 0);
  g.crowd.peds.push({ ...g.crowd.peds[0], id: 9999, opp: true, done: false, heard: false, x: 0.5 });
  const second = g.proclaimStreet();
  assert.equal(second.bystanders, 0);
  assert.equal(second.count, 1);
});

test('bystanders do not change the crowd step or the crest, and in the Professor\'s window everyone is already open', () => {
  const g = newGame('hear-2');
  street(g, [{}, {}, {}, {}, {}, { open: false }, { open: false }, { open: false }, { open: false }]);
  const p = g.wordPayout();
  assert.equal(p.n, 5);
  assert.equal(p.tier.index, 2, 'five open is a crowd, however many more are nearby');
  const none = g.wordPayout(5, 0);
  assert.equal(none.perPerson, p.perPerson);
  assert.ok(p.total > none.total);
});
