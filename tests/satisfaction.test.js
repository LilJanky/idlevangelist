import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';
import { runSimulation } from '../tools/harness.js';

const W = BALANCE.street.word;
const C = BALANCE.street.chain;

function newGame(seed = 'sat') {
  const g = new Game({ state: createInitialState(0, seed) });
  g.state.gen.totalSeeds = 20000;
  g.state.gen.seeds = 5000;
  g.state.gen.scripturesUnlocked = ['romans1_20'];
  g.state.gen.ministries.tracts.owned = 20;
  g.specialTimer = 1e9;
  g.eventTimer = 1e9;
  g.crowd.spawnTimer = 1e9;
  return g;
}
function openCrowd(g, n) {
  g.crowd.peds.length = 0;
  g.crowd.surge(n, [60, 60]);
  for (const p of g.crowd.peds) {
    p.speed = 0;
    p.x = 0.2 + Math.random() * 0.6;
  }
}
/** Tap `n` people in a quick run, collecting each result and the chain events. */
function tapRun(g, n) {
  const results = [];
  const chains = [];
  g.on((t, d) => t === 'chain' && chains.push(d));
  for (let i = 0; i < n; i++) {
    const ped = g.crowd.peds.find((p) => p.opp && !p.done);
    g.time += 0.2;
    results.push(g.engageCrowd(ped.id));
  }
  return { results, chains };
}

test('every fifth successive tap pays a small chain bonus that grows with the chain, and it is announced', () => {
  const g = newGame();
  openCrowd(g, 16);
  g.state.gen.street.streak = 0;
  const { results, chains } = tapRun(g, 15);
  const hits = results.map((r, i) => (r.chain ? i + 1 : null)).filter(Boolean);
  assert.deepEqual(hits, [5, 10, 15]);
  assert.deepEqual(chains.map((c) => c.count), [5, 10, 15]);
  for (const c of chains) {
    const tap = results[c.count - 1].seeds;
    const steps = Math.min(C.maxSteps, c.count / C.every);
    assert.ok(Math.abs(c.bonus - Math.max(1, Math.round(tap * C.fraction * steps))) <= 1);
  }
  assert.ok(chains[1].bonus / results[9].seeds > chains[0].bonus / results[4].seeds, 'a longer chain pays more, relative to the tap');
  assert.ok(chains[2].bonus / results[14].seeds <= C.fraction * C.maxSteps + 0.1, 'and it is capped');
  assert.equal(results.filter((r, i) => !r.chain && (i + 1) % C.every === 0).length, 0);
});

test('the chain bonus is small next to the taps themselves and adds Seeds; a broken chain starts again', () => {
  const g = newGame('sat-2');
  openCrowd(g, 12);
  g.state.gen.street.streak = 0;
  const before = g.state.gen.seeds;
  const { results } = tapRun(g, 10);
  const taps = results.reduce((a, r) => a + r.seeds, 0);
  const bonus = results.reduce((a, r) => a + (r.chain?.bonus || 0), 0);
  assert.ok(bonus > 0 && bonus < taps * 0.3, `bonus ${bonus} vs taps ${taps}`);
  assert.ok(g.state.gen.seeds - before >= taps + bonus - 1);
  // a broken chain starts again
  g.state.gen.street.streak = 0;
  openCrowd(g, 12);
  const again = tapRun(g, 4).results;
  assert.ok(again.every((r) => !r.chain), 'four taps is not yet a chain');
});

test('WORD charges slowly by itself once there is a passage, and stops at full', () => {
  const g = newGame('sat-3');
  g.crowd.peds.length = 0;
  g.advance(60);
  assert.ok(Math.abs(g.state.gen.street.word - 60 * W.passivePerSecond) < 0.05);
  g.advance(300);
  assert.equal(g.state.gen.street.word, W.max);
  const none = new Game({ state: createInitialState(0, 'sat-4') });
  none.specialTimer = 1e9;
  none.advance(60);
  assert.equal(none.state.gen.street.word, 0, 'nothing to proclaim yet, nothing to charge');
});

test('the steady charge is helped by Open Hands but not by Stand Firm, and holds while a conversation or the Professor has your attention', () => {
  const g = newGame('sat-5');
  g.state.gen.upgrades.openHands = true;
  g.advance(30);
  const boosted = g.state.gen.street.word;
  assert.ok(Math.abs(boosted - 30 * W.passivePerSecond * (1 + BALANCE.upgrades.openHands.effects.wordCharge)) < 0.05);
  const f = newGame('sat-6');
  f.street.startStandFirm();
  f.advance(5);
  assert.ok(Math.abs(f.state.gen.street.word - 5 * W.passivePerSecond) < 0.05, 'Stand Firm speeds working the street, not waiting');
  const p = newGame('sat-7');
  p.enc = { kind: 'special', state: 'active', step: 'respond', resolved: false, t: 0, idle: 0 };
  const w0 = p.state.gen.street.word;
  p.advance(10);
  assert.equal(p.state.gen.street.word, w0, 'held during a conversation');
});

test('a player who only checks in now and then still finishes, faster than pure idle and slower than an engaged one', () => {
  const semi = runSimulation('semi', 'balance-1');
  assert.ok(semi.finished, 'semi-idle finishes');
  assert.ok(semi.wordUses >= 8, `checked in and proclaimed ${semi.wordUses} times`);
  assert.ok(semi.avgWordTargets >= 3, `each check-in finds a gathered street (${semi.avgWordTargets})`);
  assert.ok(semi.completeMinutes > 30 && semi.completeMinutes < 58, `${semi.completeMinutes} min`);
});

function setScene(g, specs) {
  g.crowd.peds.length = 0;
  g.crowd.surge(specs.length, [60, 60]);
  g.crowd.peds.forEach((p, i) => {
    p.speed = specs[i].speed ?? 0;
    p.standing = (specs[i].speed ?? 0) === 0;
    p.dir = 1;
    p.x = specs[i].x ?? 0.4;
    p.oppLeft = specs[i].left ?? 60;
    p.opp = true;
    p.done = false;
  });
  g.state.gen.street.word = W.max;
}

test('holding WORD shows its cost: how long each open moment has, whether the marker runs out or they walk off screen', () => {
  const g = newGame('risk-1');
  setScene(g, [{ left: 40 }, { left: 0.9 }, { speed: 0.1, x: 0.8, left: 60 }]);
  const [steady, fading, walking] = g.crowd.peds;
  assert.ok(g.wordReady);
  // while WORD is ready markers decay slower and people walk slower
  const decay = W.readyHoldMult;
  assert.ok(Math.abs(g.pedTimeLeft(fading) - 0.9 / decay) < 1e-9);
  const expectWalk = (0.97 - 0.8) / (0.1 * W.readyPaceMult);
  assert.ok(Math.abs(g.pedTimeLeft(walking) - expectWalk) < 1e-9);
  assert.ok(g.pedTimeLeft(steady) > 30);
  const out = g.crowdOutlook;
  assert.equal(out.open, 3);
  assert.equal(out.leaving, 1 + (expectWalk < W.leavingSeconds ? 1 : 0));
  // not ready: normal rates
  g.state.gen.street.word = 0;
  assert.ok(Math.abs(g.pedTimeLeft(fading) - 0.9) < 1e-9);
});

test('proclaiming at the crest (a decent crowd at its fullest that has begun to thin) pays more, and the preview says so', () => {
  const crowd = (n, leaving) => Array.from({ length: n }, (_, i) => ({ left: i < leaving ? 0.5 : 60 }));
  const make = (n, leaving, peak) => {
    const g = newGame('crest');
    setScene(g, crowd(n, leaving));
    g.wordCrest = peak;
    return g;
  };
  const base = make(6, 0, 6).wordPayout();
  assert.equal(base.crest, false, 'nobody leaving yet: still building');
  const crest = make(6, 2, 6).wordPayout();
  assert.equal(crest.crest, true);
  assert.ok(Math.abs(crest.perPerson / base.perPerson - (1 + W.crestBonus)) < 0.03);
  assert.equal(make(6, 2, 9).wordPayout().crest, false, 'it was fuller a moment ago: you waited too long');
  assert.equal(make(4, 2, 4).wordPayout().crest, false, 'too small a street to count');
  // what is paid is what was shown
  const g = make(7, 1, 7);
  const shown = g.wordPayout();
  const result = g.proclaimStreet();
  assert.equal(result.crest, true);
  assert.equal(result.total, shown.total);
  assert.equal(g.wordCrest, 0, 'the next hold starts fresh');
});

test('the crest is tracked while you hold: the biggest the street has been since WORD was ready', () => {
  const g = newGame('crest-track');
  setScene(g, crowd8());
  g.state.gen.street.word = W.max;
  g.advance(0.3);
  assert.ok(g.wordCrest >= 6);
  g.state.gen.street.word = 0;
  g.advance(0.2);
  assert.equal(g.wordCrest, 0, 'not holding: nothing to track');
  function crowd8() {
    return Array.from({ length: 8 }, () => ({ left: 60 }));
  }
});
