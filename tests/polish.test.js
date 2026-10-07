import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState, MINISTRY_IDS } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';
import { ENCOUNTERS, ENCOUNTER_ORDER } from '../src/data/content.js';
import { currentGoal } from '../src/core/goals.js';
import { makeSpecialEncounter } from '../src/systems/encounter.js';
import { serialize, deserialize } from '../src/systems/save.js';
import { createBot } from '../tools/harness.js';
import { attachLogger, summarize, formatReport } from '../src/debug/report.js';
import { personFor } from '../src/systems/encounter.js';
import { buildPeople, completeGeneration } from '../src/systems/prestige.js';
import { CHAPTERS, PEOPLE_NAMES, personOutcome } from '../src/data/content.js';

const lineOf = (enc, grade = 'direct') => enc.lines.find((l) => l.grade === grade).id;

const newGame = (seed = 'p1') => {
  const g = new Game({ state: createInitialState(0, seed) });
  g.specialTimer = 1e9;
  return g;
};
const strongOf = (enc) => enc.choices.find((c) => c.grade === 'strong');
const weakOf = (enc) => enc.choices.find((c) => c.grade === 'weak');

function meetSomeone(game, id) {
  const gen = game.state.gen;
  gen.totalSeeds = Math.max(gen.totalSeeds, 20000);
  gen.genSeconds = Math.max(gen.genSeconds, 400);
  if (!gen.scripturesUnlocked.includes('romans1_20')) gen.scripturesUnlocked.push('romans1_20');
  game.enc = makeSpecialEncounter(game.state, id, game.balance);
  game.advance(game.balance.encounter.focusEnter + 0.1);
  return game.enc;
}

// ---------------------------------------------------------------- goal ladder

test('goal ladder: the first goals teach the loop in order, each with honest progress', () => {
  const game = newGame();
  assert.equal(currentGoal(game).id, 'tracts1');
  game.state.gen.seeds = 25;
  const g0 = currentGoal(game);
  assert.ok(Math.abs(g0.progress - 25 / 50) < 1e-9);
  game.state.gen.seeds = 5000;
  assert.ok(game.buyMinistry('tracts', 1));
  assert.equal(currentGoal(game).id, 'tracts3');
  assert.ok(game.buyMinistry('tracts', 2));
  assert.equal(currentGoal(game).id, 'word1');
  game.state.gen.encounterStats.wordUses = 1;
  assert.ok(['bibles-unlock', 'bibles1'].includes(currentGoal(game).id));
});

test('goal ladder: always a goal with progress in [0, 1], and it moves through many goals in a real run', () => {
  const bot = createBot('hybrid', 'goals-run');
  const seen = new Set();
  for (let t = 0; t < 14 * 60; t += 0.1) {
    bot.step(t, 0.1);
    if (Math.round(t * 10) % 100 === 0) {
      const goal = currentGoal(bot.game);
      assert.ok(goal.text.length > 5 && goal.progress >= 0 && goal.progress <= 1, `${goal.id} ${goal.progress}`);
      seen.add(goal.id);
    }
  }
  assert.ok(seen.size >= 7, `goals seen: ${[...seen].join(', ')}`);
});

// ---------------------------------------------------------------- crowd events

test('crowd events: a crowd gathers now and then, never early, and never during a conversation or the Professor', () => {
  const game = newGame('events');
  game.forceEventKind = 'bus';
  game.crowd.spawnTimer = 1e9;
  const events = [];
  game.on((t, d) => t === 'crowdEvent' && events.push({ at: game.time, ...d }));
  game.advance(BALANCE.crowdEvents.first - 5);
  assert.equal(events.length, 0, 'not before the first');
  game.crowd.peds.length = 0;
  game.advance(10);
  assert.equal(events.length, 1);
  assert.ok(events[0].count >= BALANCE.crowdEvents.shapes.bus.size[0] - 1 && events[0].count <= BALANCE.crowdEvents.shapes.bus.size[1]);
  assert.ok(BALANCE.crowdEvents.kinds.includes(events[0].kind));
  game.advance(3); // they walk in from the edge, then stand\n  assert.ok(game.crowd.openPeds().length >= events[0].count - 1, 'they are all open to a moment');
  // frozen during a conversation
  game.eventTimer = 0.01;
  meetSomeone(game, 'skeptic');
  const n = events.length;
  game.advance(5);
  assert.equal(events.length, n, 'events wait while someone is talking');
  assert.equal(game.eventTimer < 0.02 && game.eventTimer > 0, true);
});

test('crowd events never overfill the street and give a held WORD a fuller crowd', () => {
  const game = newGame('events2');
  game.crowd.spawnTimer = 1e9;
  const cap = BALANCE.crowd.cap;
  for (let i = 0; i < 30; i++) {
    game.eventTimer = 0.01;
    game.advance(0.3);
    assert.ok(game.crowd.peds.length <= cap + 3 + 6, `${game.crowd.peds.length} people`);
  }
  game.crowd.peds.length = 0;
  game.state.gen.scripturesUnlocked.push('romans1_20');
  game.eventTimer = 0.01;
  game.advance(0.3);
  game.advance(7);
  game.state.gen.street.word = BALANCE.street.word.max;
  assert.ok(game.crowd.openPeds().length >= 4);
});

// ---------------------------------------------------------------- people remember you

test('people remember how you spoke with them last time (and it is saved)', () => {
  const game = newGame('memory');
  game.state.gen.conversionState.lastConversionIndex = 1e6; // no conversion in this test: memory is cleared when someone comes to Christ
  const first = meetSomeone(game, 'skeptic');
  assert.equal(first.returnLine, null);
  game.respond(strongOf(first).id);
  game.sayLine(lineOf(game.enc, 'direct'));
  game.advance(8);
  assert.equal(game.state.gen.memory.skeptic, 'good');
  const again = meetSomeone(game, 'skeptic');
  assert.equal(again.returnLine, ENCOUNTERS.skeptic.returns.good);
  game.respond(weakOf(again).id);
  game.skipScripture();
  game.advance(8);
  assert.equal(game.state.gen.memory.skeptic, 'poor');
  assert.equal(meetSomeone(game, 'skeptic').returnLine, ENCOUNTERS.skeptic.returns.poor);
  // other people do not know you yet
  game.advance(8);
  for (const id of ENCOUNTER_ORDER.filter((x) => x !== 'skeptic')) assert.equal(makeSpecialEncounter(game.state, id).returnLine, null);
  const back = deserialize(serialize(game.state));
  assert.equal(back.gen.memory.skeptic, 'poor');
  assert.equal(deserialize(JSON.stringify({ ...JSON.parse(serialize(game.state)), gen: { ...JSON.parse(serialize(game.state)).gen, memory: undefined } })).gen.memory !== undefined, true, 'older saves gain the field');
});

// ---------------------------------------------------------------- converts on the street

test('people who came to Christ appear on the street; their moments are display only and earn nothing', () => {
  const run = (withConverts) => {
    const game = newGame('converts');
    game.state.gen.ministries.tracts.owned = 10;
    if (withConverts) game.state.gen.conversionState.converts.push({ name: 'Marcus' }, { name: 'Ana' });
    const ticks = [];
    game.on((t, d) => t === 'convertTick' && ticks.push(d.name));
    game.advance(180);
    return { seeds: game.state.gen.seeds, ticks, workers: game.state.gen.disciples.filter((d) => d.status === 'trained').length };
  };
  const without = run(false);
  const withC = run(true);
  assert.equal(without.ticks.length, 0);
  assert.ok(withC.ticks.length >= 3 && withC.ticks.length <= 12, `${withC.ticks.length} moments`);
  assert.ok(withC.ticks.every((n) => ['Marcus', 'Ana'].includes(n)));
  assert.equal(withC.seeds, without.seeds, 'no Seeds, no production: they are people, not workers');
  assert.equal(withC.workers, 0);
});

// ---------------------------------------------------------------- Professor

test('Professor: the crowd reacts to how you answered', () => {
  const game = newGame('reaction');
  const gen = game.state.gen;
  gen.genSeconds = BALANCE.boss.unlockSeconds + 5;
  gen.totalSeeds = BALANCE.boss.unlockSeeds + 1;
  gen.seeds = 1e6;
  for (const id of MINISTRY_IDS) gen.ministries[id].owned = 3;
  game.checkUnlocks(true);
  game.challengeBoss();
  game.advance(BALANCE.boss.introSeconds + 0.2);
  game.boss.enc.resistance = 1;
  game.respond(game.boss.enc.choices.find((c) => c.grade === 'partial').id);
  assert.equal(game.boss.stage, 'window');
  assert.equal(game.boss.reaction, 'partial');
});

// ---------------------------------------------------------------- Stand Firm stays special

test('Stand Firm stays an occasional peak: roughly once a minute for an engaged player, not constantly', () => {
  const bot = createBot('hybrid', 'sf-cadence');
  for (let t = 0; t < 15 * 60; t += 0.1) bot.step(t, 0.1);
  const n = bot.game.state.gen.encounterStats.standFirms;
  assert.ok(n >= 6 && n <= 20, `${n} Stand Firms in 15 minutes`);
});

test('Stand Firm is earned: not in the first couple of minutes, however fast you tap', () => {
  const game = newGame('sf-early');
  game.crowd.spawnTimer = 1e9;
  for (let i = 0; i < 60; i++) game.crowd.spawnPed(true, 1);
  for (let k = 0; k < 400; k++) {
    game.advance(0.1);
    const ped = game.crowd.peds.find((x) => !x.done);
    if (ped) {
      ped.opp = true;
      ped.oppLeft = 30;
      ped.x = 0.5;
      game.engageCrowd(ped.id);
    }
    game.state.gen.genSeconds = Math.min(game.state.gen.genSeconds, BALANCE.street.standFirm.minSeconds - 1);
  }
  assert.equal(game.street.standFirm, false);
  assert.equal(game.state.gen.encounterStats.standFirms, 0);
  assert.ok(game.state.gen.street.momentum < 100);
  game.state.gen.genSeconds = BALANCE.street.standFirm.minSeconds + 1;
  game.state.gen.street.momentum = 99;
  game.street.addMomentum(5, 'test');
  assert.equal(game.street.standFirm, true, 'once past the first minutes, filling Momentum starts Stand Firm');
});

test('newer kinds of conversation join the mix as the generation goes on', () => {
  const kinds = (seconds) => {
    const seen = new Set();
    for (let i = 0; i < 80; i++) {
      const state = createInitialState(0, 'late-variants');
      state.gen.genSeconds = seconds;
      state.gen.encounterIndex = i;
      for (const id of ENCOUNTER_ORDER) seen.add(`${id}:${makeSpecialEncounter(state, id).variant}`);
    }
    return seen;
  };
  const early = kinds(200);
  const mid = kinds(700);
  const late = kinds(1200);
  assert.equal(early.size, ENCOUNTER_ORDER.length * 2, 'two situations per person at first');
  assert.equal(mid.size, ENCOUNTER_ORDER.length * 3, 'a third joins after about ten minutes');
  assert.equal(late.size, ENCOUNTER_ORDER.length * 4, 'and a fourth after about eighteen');
  assert.ok([...early].every((k) => /:[01]$/.test(k)));
});

// ---------------------------------------------------------------- Professor safety, lecture buzz

function bossGame(seed = 'bs') {
  const game = newGame(seed);
  const gen = game.state.gen;
  gen.genSeconds = BALANCE.boss.unlockSeconds + 5;
  gen.totalSeeds = BALANCE.boss.unlockSeeds + 1;
  gen.seeds = 1e6;
  for (const id of MINISTRY_IDS) gen.ministries[id].owned = 3;
  game.checkUnlocks(true);
  return game;
}

test('Professor: if no line is chosen, the argument presses on with a measured answer instead of stalling', () => {
  const game = bossGame();
  game.challengeBoss();
  game.advance(BALANCE.boss.introSeconds + 0.2);
  const enc = game.boss.enc;
  const events = [];
  game.on((t) => events.push(t));
  game.advance(BALANCE.boss.autoRespondSeconds - 1);
  assert.equal(enc.step, 'respond', 'plenty of time to choose');
  game.advance(2);
  assert.equal(enc.step, 'press');
  assert.equal(enc.answer.grade, 'partial');
  assert.ok(events.includes('bossAutoRespond'));
  assert.ok(enc.resistance < enc.resistanceMax, 'and it makes progress');
  assert.ok(game.castAnswer() === null || game.cool.answer >= 0);
  // the debrief names it
  enc.timeLeft = 0.05;
  game.advance(0.3);
  assert.ok(game.state.gen.bossState.lastDebrief.tips.includes('chooseLine'));
});

test('lecture buzz: people reached while the lecture is foreshadowed give the first argument a head start', () => {
  const game = newGame('buzz');
  game.crowd.spawnTimer = 1e9;
  const gen = game.state.gen;
  // before the foreshadowing nothing counts
  for (let i = 0; i < 6; i++) game.addBuzz(1);
  assert.equal(gen.bossState.buzz, 0);
  gen.genSeconds = BALANCE.boss.foreshadowSeconds + 1;
  gen.totalSeeds = BALANCE.boss.foreshadowSeeds + 1;
  game.checkUnlocks();
  assert.ok(gen.bossState.foreshadowStage >= 1);
  assert.equal(currentGoal(game).id === 'lecture' || currentGoal(game).progress >= 0, true);
  game.addBuzz(40);
  assert.equal(gen.bossState.buzz, 40);
  assert.ok(Math.abs(game.lectureBonus() - 0.5 * BALANCE.boss.buzzMaxBonus) < 1e-9);
  game.addBuzz(1000);
  assert.ok(Math.abs(game.lectureBonus() - BALANCE.boss.buzzMaxBonus) < 1e-9, 'capped');
  // it shows up as the first argument being easier
  const g2 = bossGame('buzz2');
  g2.state.gen.bossState.foreshadowStage = 3;
  g2.state.gen.bossState.buzz = BALANCE.boss.buzzTarget;
  g2.challengeBoss();
  g2.advance(BALANCE.boss.introSeconds + 0.2);
  assert.equal(g2.boss.enc.resistanceMax, Math.round(BALANCE.boss.arguments[0].resistance * (1 - BALANCE.boss.buzzMaxBonus)));
  const g3 = bossGame('buzz3');
  g3.challengeBoss();
  g3.advance(BALANCE.boss.introSeconds + 0.2);
  assert.equal(g3.boss.enc.resistanceMax, BALANCE.boss.arguments[0].resistance, 'no buzz, no head start');
});

test('lecture buzz: engaging people and proclaiming WORD both count, and gatherings are bigger while the lecture is talked about', () => {
  const game = newGame('buzz4');
  game.crowd.spawnTimer = 1e9;
  const gen = game.state.gen;
  gen.genSeconds = BALANCE.boss.foreshadowSeconds + 1;
  gen.bossState.foreshadowStage = 1;
  for (let i = 0; i < 6; i++) game.crowd.spawnPed(true, 1);
  game.crowd.peds.forEach((p, i) => { p.opp = true; p.oppLeft = 30; p.x = 0.2 + 0.05 * i; p.speed = 0; });
  game.engageCrowd(game.crowd.peds[0].id);
  assert.equal(gen.bossState.buzz, 1);
  gen.scripturesUnlocked.push('romans1_20');
  gen.street.word = BALANCE.street.word.max;
  const n = game.crowd.openPeds().length;
  game.proclaimStreet();
  assert.equal(gen.bossState.buzz, 1 + n);
  const sizes = [];
  game.forceEventKind = 'bus';
  game.on((t, d) => t === 'crowdEvent' && sizes.push(d.count));
  game.crowd.peds.length = 0;
  game.eventTimer = 0.01;
  game.advance(0.3);
  assert.ok(sizes[0] >= BALANCE.crowdEvents.shapes.bus.size[0] + BALANCE.crowdEvents.foreshadowBonus - 1, `gathering of ${sizes[0]}`);
});

// ---------------------------------------------------------------- chapters

test('chapters: the day moves on at set times, announced once, with different gatherings', () => {
  const game = newGame('chap');
  const seen = [];
  game.on((t, d) => t === 'chapter' && seen.push(d.name));
  assert.equal(game.chapter.name, CHAPTERS[0].name);
  game.crowd.spawnTimer = 1e9;
  game.state.gen.genSeconds = BALANCE.chapterSeconds[1] - 1;
  game.advance(2);
  assert.deepEqual(seen, [CHAPTERS[1].name]);
  game.advance(5);
  assert.equal(seen.length, 1, 'announced once');
  game.state.gen.genSeconds = BALANCE.chapterSeconds[3] + 1;
  game.advance(0.2);
  assert.equal(seen.length, 2, 'catching up announces the current chapter, not every skipped one');
  assert.equal(game.chapter.name, CHAPTERS[3].name);
  // gatherings follow the chapter
  const kinds = new Set();
  game.on((t, d) => t === 'crowdEvent' && kinds.add(d.kind));
  for (let i = 0; i < 20; i++) {
    game.eventTimer = 0.01;
    game.advance(0.2);
  }
  for (const k of kinds) assert.ok(CHAPTERS[3].kinds.includes(k));
  assert.ok(BALANCE.chapterSeconds.every((s, i, a) => i === 0 || s > a[i - 1]));
  // a reload does not re-announce the chapter you are already in
  const reloaded = new Game({ state: game.state });
  const again = [];
  reloaded.on((t) => t === 'chapter' && again.push(t));
  reloaded.advance(1);
  assert.equal(again.length, 0);
});

// ---------------------------------------------------------------- regulars and the recap

test('regulars: the same person keeps coming back until they come to Christ; then someone new', () => {
  const state = createInitialState(0, 'regulars');
  const names = ENCOUNTER_ORDER.map((id) => personFor(state, id));
  assert.equal(new Set(names).size, ENCOUNTER_ORDER.length, 'one different person per archetype');
  assert.ok(names.every((n) => PEOPLE_NAMES.includes(n)));
  assert.deepEqual(names, ENCOUNTER_ORDER.map((id) => personFor(state, id)), 'stable');
  // a convert's name is never reused for a regular
  state.gen.conversionState.converts.push({ name: names[0] });
  state.gen.regularSerial.skeptic = 1;
  assert.notEqual(personFor(state, 'skeptic'), names[0]);

  const game = newGame('regulars2');
  game.state.gen.conversionState.lastConversionIndex = 1e6;
  const first = meetSomeone(game, 'skeptic');
  const who = first.person;
  game.respond(strongOf(first).id);
  game.sayLine(lineOf(game.enc, 'direct'));
  game.advance(8);
  const second = meetSomeone(game, 'skeptic');
  assert.equal(second.person, who, 'you keep meeting the same person');
  assert.equal(game.state.gen.people.length, 1);
  assert.equal(game.state.gen.people[0].person, who);
});

test('regulars: a conversion is the person you were speaking with, and the next regular is someone new', () => {
  // find an encounter index that converts for this seed
  const state = createInitialState(0, 'regconv');
  let idx = null;
  for (let i = 0; i < 400 && idx === null; i++) {
    state.gen.encounterIndex = i;
    state.gen.conversionState.lastConversionIndex = -1000;
    const probe = new Game({ state: JSON.parse(JSON.stringify(state)) });
    const enc = meetSomeone(probe, 'broken');
    let conv = false;
    probe.on((t, d) => t === 'resolved' && (conv = d.converted));
    probe.respond(strongOf(enc).id);
    probe.sayLine(lineOf(probe.enc, 'direct'));
    if (conv) idx = i;
  }
  assert.notEqual(idx, null);
  state.gen.encounterIndex = idx;
  state.gen.conversionState.lastConversionIndex = -1000;
  const game = new Game({ state });
  game.specialTimer = 1e9;
  const enc = meetSomeone(game, 'broken');
  const who = enc.person;
  game.respond(strongOf(enc).id);
  game.sayLine(lineOf(game.enc, 'direct'));
  assert.equal(state.gen.conversionState.converts.at(-1).name, who);
  assert.equal(state.gen.regularSerial.broken, 1);
  assert.equal(state.gen.memory.broken, undefined);
  assert.notEqual(personFor(state, 'broken'), who);
  assert.equal(state.gen.people.at(-1).converted, true);
});

test('end-of-generation recap lists the people you met, one row each, converted first, with gentle outcomes', () => {
  const state = createInitialState(0, 'recap');
  state.gen.people = [
    { index: 0, archetype: 'skeptic', person: 'Dana', at: 200, q: 0.5, converted: false },
    { index: 1, archetype: 'nominal', person: 'Omar', at: 300, q: 1, converted: false },
    { index: 2, archetype: 'skeptic', person: 'Dana', at: 400, q: 0.9, converted: false },
    { index: 3, archetype: 'broken', person: 'Mei', at: 500, q: 1, converted: true },
    { index: 4, archetype: 'nominal', person: 'Omar', at: 600, q: 0.2, converted: false },
  ];
  const people = buildPeople(state);
  assert.deepEqual(people.map((p) => p.name), ['Mei', 'Omar', 'Dana']);
  const dana = people.find((p) => p.name === 'Dana');
  const omar = people.find((p) => p.name === 'Omar');
  assert.equal(dana.meetings, 2);
  assert.equal(dana.lastQ, 0.9);
  assert.match(personOutcome(people[0]), /Came to Christ\. You planted; God gave the growth\./);
  assert.match(personOutcome(dana), /Listened closely/);
  assert.match(personOutcome(omar), /God is not finished with them/);
  assert.ok(!/fail|wrong|lost/i.test(people.map(personOutcome).join(' ')));
  state.gen.bossState.defeated = true;
  assert.ok(completeGeneration(state));
  assert.equal(state.prestige.summary.people.length, 3);
});

// ---------------------------------------------------------------- idle return and session report

test('coming back after being away: someone is waiting to talk (never resolved for you)', () => {
  const game = newGame('away');
  game.state.gen.totalSeeds = 20000;
  game.state.gen.genSeconds = 400;
  game.state.gen.ministries.tracts.owned = 10;
  const short = game.creditOffline(120);
  assert.notEqual(short.waiting, true);
  const gains = game.creditOffline(1800);
  assert.equal(gains.waiting, true);
  const completed = game.state.gen.encounterStats.completed;
  game.advance(1);
  assert.equal(game.crowd.specials.length, 1);
  assert.equal(game.crowd.specials[0].life, BALANCE.specials.lifetime * 3, 'they wait longer than usual');
  assert.equal(game.state.gen.encounterStats.completed, completed, 'no conversation was resolved offline');
  assert.equal(game.enc, null);
});

test('session report: the same log and summary work for a bot run and a human session', () => {
  const bot = createBot('hybrid', 'report-run');
  const log = attachLogger(bot.game);
  for (let t = 0; t < 8 * 60; t += 0.1) bot.step(t, 0.1);
  const sum = summarize(log, bot.game);
  assert.ok(sum.first.wordProclaimed > 0 && sum.first.chapter > 0);
  assert.ok(sum.word.uses >= 5 && sum.word.avgReach >= 1);
  assert.ok(sum.talks.count >= 2);
  assert.ok(sum.blocks.length >= 2);
  assert.ok(Array.isArray(sum.quiet));
  const text = formatReport(sum);
  assert.match(text, /SESSION REPORT/);
  assert.match(text, /WORD: \d+ uses/);
  JSON.stringify({ sum, log });
});
