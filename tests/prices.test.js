import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { formatNumber, formatCost, formatHave } from '../src/core/format.js';
import { ministryCost, bulkCost } from '../src/core/economy.js';
import { createInitialState } from '../src/core/state.js';
import { Game } from '../src/systems/game.js';

test('round numbers keep their zeros: 250K is 250K, 100K is 100K, 10K is 10K', () => {
  for (const [v, s] of [[250000, '250K'], [100000, '100K'], [650000, '650K'], [10000, '10K'], [20, '20'], [100, '100'], [3e6, '3M'], [120e6, '120M'], [1500, '1.5K']]) {
    assert.equal(formatNumber(v), s);
    assert.equal(formatCost(v), s);
    assert.equal(formatHave(v), s);
  }
});

test('a balance that reads at least the shown price really covers it (price rounds up, holdings round down)', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = 0; i < 20000; i++) {
    const cost = Math.ceil(Math.pow(10, rnd() * 9));
    const have = Math.floor(cost * (0.97 + rnd() * 0.06));
    const sameText = formatHave(have) === formatCost(cost);
    if (sameText) assert.ok(have >= cost, `${have} reads as ${formatHave(have)} but ${cost} is priced ${formatCost(cost)}`);
    assert.ok(Number.isFinite(parseFloat(formatCost(cost))));
  }
  assert.equal(formatHave(1996000), '1.99M');
  assert.equal(formatCost(1996000), '2M');
  assert.equal(formatCost(999950), '1M');
  assert.equal(formatHave(999950), '999K');
});

test('every price in the game: the button is enabled exactly when the balance covers what it shows', () => {
  const game = new Game({ state: createInitialState(0, 'prices') });
  const gen = game.state.gen;
  for (const [id, def] of Object.entries(BALANCE.upgrades)) {
    const have = def.currency === 'funds' ? 'funds' : 'seeds';
    gen[have] = def.cost - 1;
    assert.equal(game.canAffordUpgrade(id), false, id);
    gen[have] = def.cost;
    assert.equal(game.canAffordUpgrade(id), true, id);
    const shownCost = formatCost(def.cost);
    gen[have] = def.cost - 1;
    assert.notEqual(formatHave(gen[have]), shownCost, `${id}: one short must not read as the price (${shownCost})`);
  }
  for (const id of Object.keys(BALANCE.ministries)) {
    for (const owned of [0, 1, 7, 24, 25, 60]) {
      assert.equal(ministryCost(id, owned), bulkCost(id, owned, 1), `${id} x${owned}`);
    }
  }
});
