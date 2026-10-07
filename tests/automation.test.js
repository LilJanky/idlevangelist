import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';
import { ENCOUNTERS, ENCOUNTER_ORDER } from '../src/data/content.js';
import { masteryKey, situationCount, makeAutoEncounter, encounterReward, pickReaction } from '../src/systems/encounter.js';
import { serialize, deserialize } from '../src/systems/save.js';

const newGame = (seed = 'auto-1') => {
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
const trainHelper = (g) => { g.state.gen.disciples[0].status = 'trained'; };

/** Talk to whoever is on the street. response / line: the grade to choose ('strong'|'partial'|'weak', 'direct'|'relevant'|'proclaimed'). */
function talk(g, { response = 'strong', line = 'direct', variant } = {}) {
  const sp = g.spawnSpecial(6, { variant });
  assert.ok(g.tapSpecial(sp.id));
  g.advance(0.7);
  g.respond(g.enc.choices.find((c) => c.grade === response).id);
  g.sayLine(g.enc.lines.find((l) => l.grade === line).id);
  return g.enc;
}
const finish = (g) => g.advance(8);
/** Put the street back to just before this person arrived, so the same kind of conversation comes round again. */
const replay = (g, enc) => {
  const gen = g.state.gen;
  gen.encounterIndex = enc.index;
  gen.encounterStats.specialsMet = ENCOUNTER_ORDER.indexOf(enc.specialId);
  gen.genSeconds = 400;
};

test('answering with the strongest response and a line aimed at what was raised learns that conversation', () => {
  const g = newGame();
  const events = [];
  g.on((t, d) => t === 'learned' && events.push(d));
  const enc = talk(g);
  const key = masteryKey(enc.archetypeId, enc.variant);
  assert.equal(g.state.gen.mastery[key], true);
  assert.equal(enc.newlyLearned, true);
  assert.equal(g.learnedCount, 1);
  assert.equal(events.length, 1);
  assert.deepEqual(enc.missed, []);
  finish(g);
  // the same situation again is gathered, not talked through, and does not "learn" it a second time
  replay(g, enc);
  const sp = g.spawnSpecial(6, { variant: enc.variant });
  assert.equal(sp.treatment, 'learned');
  assert.ok(g.tapSpecial(sp.id));
  assert.equal(g.enc, null, 'no conversation');
  assert.equal(events.length, 1);
});

test('anything less than the strongest path leaves it unlearned, and the exchange says where it fell short', () => {
  for (const [response, line, missed] of [['partial', 'direct', ['response']], ['strong', 'relevant', ['line']], ['strong', 'proclaimed', ['line']], ['weak', 'proclaimed', ['response', 'line']]]) {
    const g = newGame(`short-${response}-${line}`);
    const enc = talk(g, { response, line });
    assert.equal(g.learnedCount, 0, `${response}+${line} should not be learned`);
    assert.deepEqual(enc.missed, missed);
    assert.ok(enc.hold > BALANCE.encounter.outcomeHold, 'there is time to read what was missed');
  }
});

test('the person\'s closing reaction reflects the whole exchange: only a fully fitting one earns the warmest', () => {
  const g = newGame('reaction');
  const quality = (response, line) => {
    const enc = talk(g, { response, line });
    const q = enc.reward.quality;
    finish(g);
    return { q, band: ENCOUNTERS[enc.specialId].reactions };
  };
  const best = quality('strong', 'direct');
  assert.ok(best.q >= BALANCE.specials.reactionBands.high);
  const good = quality('strong', 'relevant');
  assert.ok(good.q < BALANCE.specials.reactionBands.high, 'a fine but unfinished exchange is not the best one');
  const reactionFor = (q) => {
    const enc = g.enc || {};
    return pickReaction(g.state, { specialId: 'skeptic', index: 1 }, q);
  };
  const high = ENCOUNTERS.skeptic.reactions.high;
  const mid = ENCOUNTERS.skeptic.reactions.mid;
  assert.ok(high.includes(reactionFor(1)));
  assert.ok(mid.includes(reactionFor(0.75)));
  assert.ok(ENCOUNTERS.skeptic.reactions.low.includes(reactionFor(0.3)));
});

test('a helper is only offered for a learned conversation, and only with a trained disciple', () => {
  const g = newGame('who-helps');
  // first meeting: nothing learned, nobody to help
  let sp = g.spawnSpecial(6);
  assert.equal(sp.autoAt, undefined);
  g.crowd.clearSpecials();
  // learn everything, still no disciple
  for (const id of ENCOUNTER_ORDER) ENCOUNTERS[id].variants.forEach((v, i) => { g.state.gen.mastery[masteryKey(id, i)] = true; });
  sp = g.spawnSpecial(6);
  assert.equal(sp.autoAt, undefined, 'no helper without a disciple');
  g.crowd.clearSpecials();
  trainHelper(g);
  sp = g.spawnSpecial(6);
  assert.ok(sp.autoAt > 0 && sp.autoAt <= BALANCE.automation.delay);
  assert.equal(sp.helper, g.state.gen.disciples[0].id);
  assert.equal(situationCount(), ENCOUNTER_ORDER.length * 4);
});

test('a learned conversation is carried by a disciple if you do not take it: it pays less, adds no streak or WORD, and is not missed', () => {
  const g = newGame('carried');
  const first = talk(g); // learn this one
  const perfect = first.reward.seeds;
  finish(g);
  trainHelper(g);
  const gen = g.state.gen;
  replay(g, first);
  const stats = gen.encounterStats;
  const before = { completed: stats.specialsCompleted, active: stats.activeCompleted, streak: gen.street.streak, momentum: gen.street.momentum, word: gen.street.word, seeds: gen.seeds, index: gen.encounterIndex, missed: stats.specialsMissed };
  const startedAt = g.time;
  const events = [];
  g.on((t, d) => (t === 'automated' || t === 'resolved' || t === 'specialMissed') && events.push([t, d]));
  const sp = g.spawnSpecial(6, { variant: first.variant });
  assert.ok(sp.autoAt);
  g.advance(sp.autoAt - 0.3);
  assert.equal(events.length, 0, 'the player still has time to take it');
  g.advance(0.6);
  assert.deepEqual(events.map((e) => e[0]), ['automated']);
  const reward = events[0][1].reward;
  assert.ok(Math.abs(reward.seeds / perfect - BALANCE.automation.rewardMult) < 0.06, `paid ${reward.seeds} vs ${perfect}`);
  assert.equal(stats.specialsCompleted, before.completed + 1);
  assert.equal(stats.automated, 1);
  assert.equal(stats.activeCompleted, before.active, 'not counted as one you had yourself');
  assert.ok(gen.street.streak <= before.streak, 'no streak earned (it only fades)');
  assert.ok(gen.street.momentum <= before.momentum, 'no Momentum earned');
  assert.ok(gen.street.word - before.word <= (g.time - startedAt) * BALANCE.street.word.passivePerSecond * 1.01 + 1e-6, 'no WORD readiness from the conversation itself (only the steady charge)');
  assert.ok(gen.seeds >= before.seeds + reward.seeds);
  assert.equal(gen.encounterIndex, before.index + 1);
  assert.equal(g.crowd.specials.length, 0);
  g.advance(7);
  assert.equal(stats.specialsMissed, before.missed, 'carried, not missed');
  assert.equal(g.enc, null, 'no outcome card for a quiet hand-off');
});

test('tapping a person you know gathers it at once, at full reward, and the helper never also pays', () => {
  const g = newGame('first');
  const learn = talk(g);
  const perfect = learn.reward.seeds;
  finish(g);
  trainHelper(g);
  replay(g, learn);
  const before = g.state.gen.seeds;
  const sp = g.spawnSpecial(6, { variant: learn.variant });
  g.advance(1);
  assert.ok(g.tapSpecial(sp.id));
  g.advance(10);
  const stats = g.state.gen.encounterStats;
  assert.equal(stats.automated, 0, 'the helper had nothing left to carry');
  assert.equal(stats.harvested, 1);
  assert.ok(Math.abs((g.state.gen.seeds - before) / perfect - 1) < 0.35, 'about what the conversation itself paid (ministries also earned while waiting)');
  assert.equal(g.enc, null);
});

test('automation never happens for someone who waited while you were away, nor offline, nor during the Professor', () => {
  const g = newGame('never');
  for (const id of ENCOUNTER_ORDER) ENCOUNTERS[id].variants.forEach((v, i) => { g.state.gen.mastery[masteryKey(id, i)] = true; });
  trainHelper(g);
  g.nextSpecialLife = 18;
  const waiting = g.spawnSpecial(18, { waiting: true });
  assert.equal(waiting.autoAt, undefined);
  g.crowd.clearSpecials();
  const before = g.state.gen.encounterStats.specialsCompleted;
  g.creditOffline(3600);
  g.advance(0.2);
  assert.equal(g.state.gen.encounterStats.specialsCompleted, before, 'offline time resolves no conversations');
  // the Professor: no street conversations at all
  g.crowd.clearSpecials();
  const sp = g.spawnSpecial(6);
  g.state.gen.bossState.status = 'available';
  g.state.gen.ministries.discipleship.owned = 1;
  assert.ok(g.challengeBoss());
  g.advance(sp.autoAt + 1);
  assert.equal(g.state.gen.encounterStats.automated, 0);
});

test('whether someone comes to Christ does not depend on whether you or a disciple had the conversation', () => {
  let compared = 0;
  let converted = 0;
  for (let i = 0; i < 160; i++) {
    const seed = `faith-${i}`;
    const manual = newGame(seed);
    const helped = newGame(seed);
    trainHelper(helped);
    for (const g of [manual, helped]) {
      g.state.gen.encounterIndex = 5 + (i % 7);
      g.state.gen.encounterStats.specialsMet = 3;
      g.state.gen.conversionState.lastConversionIndex = -1000;
    }
    const sp = manual.spawnSpecial(6);
    manual.tapSpecial(sp.id);
    manual.advance(0.7);
    manual.respond(manual.enc.choices.find((c) => c.grade === 'strong').id);
    manual.sayLine(manual.enc.lines.find((l) => l.grade === 'direct').id);
    const variant = manual.enc.variant;
    const a = manual.state.gen.people.at(-1);
    helped.state.gen.mastery[masteryKey(manual.enc.archetypeId, variant)] = true;
    helped.spawnSpecial(6);
    helped.advance(BALANCE.automation.delay + 0.2);
    const b = helped.state.gen.people.at(-1);
    assert.ok(b?.auto, 'a disciple carried it');
    assert.equal(b.converted, a.converted, `seed ${seed}`);
    compared++;
    if (a.converted) converted++;
  }
  assert.equal(compared, 160);
  assert.ok(converted >= 1 && converted < 60, `${converted} conversions across the comparisons: uncommon but present`);
});

test('a conversion during a carried conversation is not passed over: the street pauses for it', () => {
  let found = null;
  for (let i = 0; i < 400 && !found; i++) {
    const g = newGame(`pause-${i}`);
    trainHelper(g);
    g.state.gen.encounterIndex = 6 + (i % 9);
    g.state.gen.encounterStats.specialsMet = 3;
    const sp = g.spawnSpecial(6);
    g.state.gen.mastery[masteryKey(sp.specialId, sp.variant)] = true;
    sp.autoAt = 0.5;
    sp.helper = g.state.gen.disciples[0].id;
    g.advance(0.9);
    if (g.state.gen.conversionState.converts.length) found = g;
  }
  assert.ok(found, 'some seed converts');
  assert.equal(found.enc?.state, 'conversion');
  assert.equal(found.streetPaused, true);
  found.advance(8);
  assert.equal(found.enc, null);
});

test('learned conversations are saved, and old saves without any load cleanly', () => {
  const g = newGame('save');
  const enc = talk(g);
  const back = new Game({ state: deserialize(serialize(g.state)) });
  assert.equal(back.isMastered(enc.archetypeId, enc.variant), true);
  assert.equal(back.learnedCount, 1);
  const raw = JSON.parse(serialize(g.state));
  delete raw.gen.mastery;
  delete raw.gen.encounterStats.automated;
  const old = new Game({ state: deserialize(JSON.stringify(raw)) });
  assert.equal(old.learnedCount, 0);
  assert.equal(old.state.gen.encounterStats.automated, 0);
});

test('an auto encounter is exactly the strongest path and pays a perfect exchange before the helper discount', () => {
  const g = newGame('shape');
  const enc = makeAutoEncounter(g.state, 'skeptic', 0, g.balance);
  assert.equal(enc.answer.grade, 'strong');
  assert.equal(enc.scripture.grade, 'direct');
  assert.equal(encounterReward(g.state, enc, g.balance).quality, 1);
});


test('a person you missed does not bring the same situation again, and every situation still comes round', () => {
  const g = newGame('variety');
  const seen = [];
  for (let i = 0; i < 24; i++) {
    g.state.gen.encounterStats.specialsMet = ENCOUNTER_ORDER.length; // past the first ordered introductions, so the kind of person varies
    const sp = g.spawnSpecial(6);
    seen.push([sp.specialId, sp.variant]);
    g.crowd.clearSpecials(); // missed: encounterIndex does not move
  }
  const byPerson = {};
  for (const [id, v] of seen) {
    if (byPerson[id] !== undefined) assert.notEqual(v, byPerson[id], `${id} repeated situation ${v} straight away`);
    byPerson[id] = v;
  }
  assert.ok(new Set(seen.map(([id, v]) => `${id}:${v}`)).size >= ENCOUNTER_ORDER.length * 2 - 1, 'a wide spread of situations');
});
