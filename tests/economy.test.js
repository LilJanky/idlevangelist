import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState } from '../src/core/state.js';
import {
  ministryCost, bulkCost, maxAffordable, lineProduction, seedsPerSecond, computeModifiers, milestoneMultiplier,
  proclaimBase, fundsPerSecond, tierIndex,
} from '../src/core/economy.js';
import { formatNumber, formatDuration } from '../src/core/format.js';

const fresh = () => createInitialState(0, 'test-seed');

test('ministry cost follows base * 1.15^owned', () => {
  for (const id of Object.keys(BALANCE.ministries)) {
    const base = BALANCE.ministries[id].baseCost;
    assert.equal(ministryCost(id, 0), base);
    assert.equal(ministryCost(id, 10), Math.ceil(base * Math.pow(1.15, 10)));
    assert.equal(ministryCost(id, 25), Math.ceil(base * Math.pow(1.15, 25)));
  }
});

test('bulk cost equals the sum of individual costs (within one rounding unit)', () => {
  for (const owned of [0, 3, 17]) {
    for (const n of [1, 5, 10]) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += BALANCE.ministries.bibles.baseCost * Math.pow(1.15, owned + i);
      assert.equal(bulkCost('bibles', owned, n), Math.ceil(sum - 1e-9));
    }
  }
  assert.equal(bulkCost('tracts', 0, 0), 0);
});

test('max affordable is exact: affordable at n, unaffordable at n+1', () => {
  for (const budget of [0, 49, 50, 51, 500, 12345, 9.9e6]) {
    for (const owned of [0, 4, 30]) {
      const n = maxAffordable('tracts', owned, budget);
      assert.ok(bulkCost('tracts', owned, n) <= budget || n === 0);
      assert.ok(bulkCost('tracts', owned, n + 1) > budget);
    }
  }
});

test('cost discount from Good Stewardship lowers costs', () => {
  const s = fresh();
  s.gen.upgrades.goodStewardship = true;
  const mods = computeModifiers(s);
  assert.equal(mods.costDiscount, BALANCE.upgrades.goodStewardship.effects.costDiscount);
  assert.ok(ministryCost('tracts', 5, mods.costDiscount) < ministryCost('tracts', 5, 0));
});

test('production = owned * base * multipliers, with milestone doubling at 25', () => {
  const s = fresh();
  s.gen.ministries.tracts.owned = 10;
  let mods = computeModifiers(s);
  assert.equal(lineProduction(s, 'tracts', mods), 10 * BALANCE.ministries.tracts.baseProduction);
  s.gen.ministries.tracts.owned = 25;
  assert.equal(milestoneMultiplier(25), 2);
  assert.equal(lineProduction(s, 'tracts', mods), 25 * BALANCE.ministries.tracts.baseProduction * 2);
  s.gen.upgrades.faithfulHands = true;
  s.gen.upgrades.literatureBundle = true;
  mods = computeModifiers(s);
  assert.ok(Math.abs(lineProduction(s, 'tracts', mods) - 25 * 1 * 2 * 1.5 * 1.15) < 1e-9);
});

test('seeds per second sums lines and is independent of frame rate', () => {
  const s = fresh();
  s.gen.ministries.tracts.owned = 3;
  s.gen.ministries.bibles.owned = 2;
  const sps = seedsPerSecond(s);
  assert.equal(sps, 3 * 1 + 2 * 4);
  // Integrating at different step sizes yields the same total (linear in dt).
  let a = 0;
  let b = 0;
  for (let i = 0; i < 600; i++) a += sps * 0.1;
  for (let i = 0; i < 3600; i++) b += sps * (1 / 60);
  assert.ok(Math.abs(a - b) < 1e-6);
});

test('upgrade multipliers: Clear Voice +30% proclaim, prestige adds', () => {
  const s = fresh();
  const base = proclaimBase(s);
  s.gen.upgrades.clearVoice = true;
  assert.ok(Math.abs(proclaimBase(s) / base - 1.3) < 1e-9);
  s.prestige.nodes.steadfastWitness = true;
  assert.ok(Math.abs(proclaimBase(s) / base - 1.4) < 1e-9);
});

test('disciple assignment boosts only the assigned line', () => {
  const s = fresh();
  s.gen.ministries.tracts.owned = 4;
  s.gen.ministries.bibles.owned = 4;
  const d = s.gen.disciples[0];
  d.status = 'trained';
  d.assigned = 'bibles';
  const mods = computeModifiers(s);
  assert.equal(lineProduction(s, 'tracts', mods), 4);
  assert.equal(lineProduction(s, 'bibles', mods), 16 * (1 + BALANCE.disciples.lineBoost));
});

test('funds are only produced after unlock and are a modest trickle', () => {
  const s = fresh();
  assert.equal(fundsPerSecond(s), 0);
  s.gen.fundsUnlocked = true;
  assert.ok(fundsPerSecond(s) > 0 && fundsPerSecond(s) < 1);
});

test('tier index follows progress thresholds', () => {
  assert.equal(tierIndex(0), 0);
  assert.equal(tierIndex(BALANCE.encounter.tiers[2].minSeeds), 2);
  assert.equal(tierIndex(1e12), BALANCE.encounter.tiers.length - 1);
});

test('number formatting is readable and consistent', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(7), '7');
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1000), '1K');
  assert.equal(formatNumber(1234), '1.23K');
  assert.equal(formatNumber(12345), '12.3K');
  assert.equal(formatNumber(1.2e6), '1.2M');
  assert.equal(formatNumber(4.8e6), '4.8M');
  assert.equal(formatNumber(2.1e9), '2.1B');
  assert.equal(formatNumber(999950), '1M');
  assert.equal(formatNumber(NaN), '0');
  assert.equal(formatDuration(3725), '1h 2m');
  assert.equal(formatDuration(65), '1m 05s');
});
