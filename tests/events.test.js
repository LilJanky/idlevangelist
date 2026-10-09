import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { CHAPTERS, CROWD_EVENTS } from '../src/data/content.js';
import { createInitialState } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';

const SHAPES = BALANCE.crowdEvents.shapes;

function setup(seed = 'ev') {
  const game = new Game({ state: createInitialState(0, seed) });
  game.crowd.spawnTimer = 1e9;
  game.specialTimer = 1e9;
  game.crowd.peds.length = 0;
  game.eventTimer = 1e9;
  return game;
}

function run(game, seconds) {
  for (let t = 0; t < seconds; t += 0.1) game.advance(0.1);
}

test('every kind of gathering is configured, described, and happens in some part of the day', () => {
  for (const kind of BALANCE.crowdEvents.kinds) {
    assert.ok(SHAPES[kind], `${kind} has a shape`);
    assert.ok(CROWD_EVENTS[kind], `${kind} says what it is`);
    assert.ok(CHAPTERS.some((c) => c.kinds.includes(kind)), `${kind} is part of some chapter`);
  }
  assert.equal(new Set(Object.values(SHAPES).map((s) => s.shape)).size, BALANCE.crowdEvents.kinds.length, 'each kind has its own shape');
});

test('nobody appears out of thin air: every kind of gathering walks in from off screen at an ordinary pace', () => {
  for (const kind of BALANCE.crowdEvents.kinds) {
    const game = setup(`walkin-${kind}`);
    game.startCrowdEvent(kind);
    game.advance(0.05);
    const onScreen = game.crowd.peds.filter((p) => p.x > 0.0 && p.x < 1.0);
    assert.equal(onScreen.length, 0, `${kind}: someone appeared on screen`);
    const fastest = BALANCE.crowd.speed[1] / 100;
    for (const p of game.crowd.peds) assert.ok(p.speed <= fastest * (BALANCE.crowdEvents.shapes[kind].speedMult || 1) + 1e-9 && p.speed > 0, `${kind}: walks at an ordinary pace (${p.speed})`);
  }
});

test('bus: a pack walks in together on one side, open the whole way, and nobody ever stops', () => {
  const game = setup();
  const got = game.startCrowdEvent('bus');
  assert.ok(got.count >= SHAPES.bus.size[0] && got.count <= SHAPES.bus.size[1] + game.mods.eventSize);
  run(game, 7);
  assert.ok(game.crowd.openPeds().length >= got.count - 2, 'nearly all open at the same moment');
  const xs = game.crowd.peds.map((p) => p.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 0.6, 'a group');
  assert.equal(game.crowd.peds.filter((p) => p.hold || p.standing).length, 0, 'nobody stands still');
  assert.equal(game.eventWindowMult, 1);
  run(game, 30);
  assert.equal(game.crowd.peds.filter((p) => p.tag === 'bus').length, 0, 'and then they have walked on');
});
test('lunch: a stream, one person after another from both sides, and your run holds longer meanwhile', () => {
  const game = setup('lunch');
  const got = game.startCrowdEvent('lunch');
  game.advance(0.05);
  assert.equal(game.crowd.peds.length, 1, 'only the first has arrived');
  assert.equal(game.eventWindowMult, SHAPES.lunch.windowMult);
  const sides = new Set();
  const seen = new Set();
  for (let t = 0; t < 40 && game.activeEvent; t += 0.1) {
    game.advance(0.1);
    for (const p of game.crowd.peds) if (p.tag === 'lunch' && !seen.has(p.id)) { seen.add(p.id); sides.add(p.dir); }
  }
  assert.ok(seen.size >= got.count - 1, `${seen.size} of ${got.count} arrived over time`);
  assert.equal(sides.size, 2, 'from both directions');
  assert.ok(Math.max(...game.crowd.peds.filter((p) => p.tag === 'lunch').map((p) => p.oppLeft), 0) <= SHAPES.lunch.life[1] + game.mods.eventLife, 'short windows');
  run(game, 10);
  assert.equal(game.activeEvent, null);
  assert.equal(game.eventWindowMult, 1, 'it ends');
  game.state.gen.street.streak = 10;
  const base = game.street.streakWindowNow;
  game.activeEvent = { windowMult: 1.5 };
  assert.ok(Math.abs(game.street.streakWindowNow / base - 1.5) < 1e-9);
});

test('school: two fast waves, one from each side', () => {
  const game = setup('school');
  game.startCrowdEvent('school');
  const waves = [];
  for (let t = 0; t < 12; t += 0.05) {
    const before = new Set(game.crowd.peds.map((p) => p.id));
    game.advance(0.05);
    for (const p of game.crowd.peds) if (!before.has(p.id) && p.tag === 'school') waves.push({ t, dir: p.dir, speed: p.speed });
  }
  assert.ok(waves.length >= SHAPES.school.size[0]);
  assert.equal(new Set(waves.map((w) => w.dir)).size, 2);
  const firstDir = waves[0].dir;
  assert.ok(waves.filter((w) => w.dir === firstDir).every((w) => w.t < SHAPES.school.waveGap), 'the first wave is all from one side');
  assert.ok(waves.every((w) => w.speed >= 0.1 * SHAPES.school.speedMult - 1e-9), 'they hurry');
});

test('rain: a few people drift across the street unhurried with long moments, and someone who wants to talk follows soon', () => {
  const game = setup('rain');
  const gen = game.state.gen;
  gen.totalSeeds = BALANCE.specials.unlockSeeds + 1;
  gen.genSeconds = BALANCE.specials.unlockGenSeconds + 1;
  const got = game.startCrowdEvent('rain');
  assert.ok(got.count >= SHAPES.rain.size[0]);
  assert.ok(game.crowd.peds.every((p) => p.oppLeft >= SHAPES.rain.life[0]), 'long moments');
  assert.ok(game.specialTimer <= SHAPES.rain.talkIn);
  run(game, 7);
  assert.equal(game.crowd.peds.filter((p) => p.hold || p.standing).length, 0, 'nobody stands still');
  const xs = game.crowd.peds.map((p) => p.x).sort();
  assert.ok(xs[xs.length - 1] - xs[0] > 0.1, 'spread across the street');
  game.specialTimer = SHAPES.rain.talkIn;
  run(game, SHAPES.rain.talkIn + 1);
  assert.ok(game.crowd.specials.length > 0 || game.enc, 'someone came to talk');
});

test('church: friends stand with you, are nothing to tap, lift Momentum, and move on', () => {
  const game = setup('church');
  game.state.gen.scripturesUnlocked.push('romans1_20');
  const mom = game.state.gen.street.momentum;
  const word = game.state.gen.street.word;
  const got = game.startCrowdEvent('church');
  assert.equal(got.count, SHAPES.church.size[0]);
  assert.ok(game.state.gen.street.momentum >= mom + SHAPES.church.momentum - 1e-9 || game.street.standFirm);
  assert.ok(game.state.gen.street.word > word);
  assert.equal(game.crowd.openPeds().length, 0, 'no moments to tap');
  run(game, 9);
  assert.ok(game.crowd.peds.length === got.count && game.crowd.peds.every((p) => p.far && p.hold), 'standing together on the far side of the street');
  assert.equal(game.crowd.bystanders().length, 0, 'not paid as passers-by');
  const before = game.state.gen.seeds;
  for (const p of game.crowd.peds) assert.equal(game.engageCrowd(p.id), null);
  assert.equal(game.state.gen.seeds, before);
  run(game, SHAPES.church.stay + 12);
  assert.equal(game.crowd.peds.filter((p) => p.far).length, 0, 'they went on their way');
});

test('events never run during the Professor, and a conversation holds a stream where it is', () => {
  const game = setup('hold');
  game.startCrowdEvent('lunch');
  const t0 = game.activeEvent.t;
  game.streetPausedOverride = true;
  Object.defineProperty(game, 'streetPaused', { get: () => true });
  run(game, 3);
  assert.equal(game.activeEvent.t, t0, 'paused with the street');
  const g2 = setup('boss');
  g2.startCrowdEvent('school');
  g2.boss = { stage: 'intro', enc: null };
  g2.updateCrowdEvents(0.1);
  assert.equal(g2.activeEvent, null);
});

test('over a run every kind of event shows up and the street never overfills', () => {
  const game = new Game({ state: createInitialState(0, 'mix') });
  game.crowd.spawnTimer = 1e9;
  game.specialTimer = 1e9;
  const kinds = new Set();
  game.on((t, d) => t === 'crowdEvent' && kinds.add(d.kind));
  let peak = 0;
  for (let genSeconds = 0; genSeconds < 1300; genSeconds += 5) {
    game.state.gen.genSeconds = genSeconds;
    game.eventTimer = Math.min(game.eventTimer, 0.01);
    for (let i = 0; i < 50; i++) {
      game.advance(0.1);
      peak = Math.max(peak, game.crowd.peds.length);
    }
  }
  for (const k of BALANCE.crowdEvents.kinds) assert.ok(kinds.has(k), `${k} happened`);
  assert.ok(peak <= BALANCE.crowd.cap + 6 + 2 + 1, `peak ${peak}`);
});
