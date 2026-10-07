import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';
import { CrowdSystem } from '../src/systems/crowd.js';
import { createRng } from '../src/core/rng.js';

function samePlaceCount(peds) {
  let n = 0;
  for (let i = 0; i < peds.length; i++) for (let j = i + 1; j < peds.length; j++) {
    if (peds[i].lane === peds[j].lane && Math.abs(peds[i].x - peds[j].x) < 0.04) n++;
  }
  return n;
}

test('walkers queue behind a slower walker in their lane instead of stacking on top of them', () => {
  const crowd = new CrowdSystem(createRng('queue'), BALANCE);
  crowd.peds.length = 0;
  crowd.spawnTimer = 1e9;
  const slow = { id: 1, x: 0.4, lane: 1, dir: 1, speed: 0.1, standing: false, hold: false, opp: false, oppLeft: 0, done: false, react: 0, phase: 0 };
  const fast = { id: 2, x: 0.2, lane: 1, dir: 1, speed: 0.2, standing: false, hold: false, opp: false, oppLeft: 0, done: false, react: 0, phase: 0 };
  crowd.peds.push(slow, fast);
  for (let t = 0; t < 3; t += 0.1) crowd.update(0.1);
  assert.ok(slow.x - fast.x >= BALANCE.crowd.queueGap - 0.02, `gap ${(slow.x - fast.x).toFixed(3)}`);
  assert.ok(fast.x < slow.x, 'no overtaking through someone');
});

test('new walkers enter in the lane with the most room, and event packs fan out over all three lanes', () => {
  const crowd = new CrowdSystem(createRng('lanes'), BALANCE);
  crowd.peds.length = 0;
  for (let i = 0; i < 2; i++) crowd.peds.push({ id: 100 + i, x: 0.05, lane: i, dir: 1, speed: 0.1, standing: false, hold: false, opp: false, done: false, react: 0, phase: 0 });
  const p = { id: 7, x: -0.08, lane: 0, dir: 1, speed: 0.1 };
  crowd.peds.push(p);
  crowd.placeInRoomiestLane(p);
  assert.equal(p.lane, 2, 'the empty lane');
  const g = new Game({ state: createInitialState(0, 'pack') });
  g.crowd.peds.length = 0;
  g.crowd.spawnTimer = 1e9;
  g.specialTimer = 1e9;
  g.startCrowdEvent('bus');
  const lanes = new Set(g.crowd.peds.map((q) => q.lane));
  assert.equal(lanes.size, 3);
  for (let t = 0; t < 12; t += 0.1) g.advance(0.1);
  assert.equal(samePlaceCount(g.crowd.peds.filter((q) => q.tag === 'bus')), 0, 'nobody stands on top of someone else');
});

test('the crowd that gathers for the Professor stands in open spots rather than on one spot', () => {
  const crowd = new CrowdSystem(createRng('gather'), BALANCE);
  crowd.peds.length = 0;
  crowd.spawnTimer = 1e9;
  for (let i = 0; i < 14; i++) crowd.peds.push({ id: 3 * i + 1, x: 0.05 - i * 0.03, lane: 1 + (i % 2), dir: 1, speed: 0.15, standing: false, hold: false, opp: false, oppLeft: 0, done: false, react: 0, phase: 0 });
  for (let t = 0; t < 20; t += 0.1) crowd.update(0.1, { gather: true });
  const standing = crowd.peds.filter((p) => p.standing);
  assert.ok(standing.length >= 4);
  assert.equal(samePlaceCount(standing), 0, 'spaced out');
});
