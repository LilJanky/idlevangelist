import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { createInitialState } from '../src/core/state.js';
import { createRng, hashUnit, mulberry32, hashString } from '../src/core/rng.js';
import {
  serialize, deserialize, loadState, saveState, createMemoryStorage, SAVE_KEY, clearSave,
} from '../src/systems/save.js';
import { clampOfflineSeconds, computeOffline, applyOffline, effectiveOfflineSeconds } from '../src/systems/offline.js';
import { Game } from '../src/systems/game.js';

test('seeded RNG is deterministic and varied', () => {
  const a = createRng('abc');
  const b = createRng('abc');
  const c = createRng('abd');
  const seqA = Array.from({ length: 5 }, () => a());
  assert.deepEqual(seqA, Array.from({ length: 5 }, () => b()));
  assert.notDeepEqual(seqA, Array.from({ length: 5 }, () => c()));
  assert.ok(seqA.every((v) => v >= 0 && v < 1));
  assert.equal(hashString('x'), hashString('x'));
  assert.equal(mulberry32(5)(), mulberry32(5)());
});

test('keyed hash rolls are stable (reload cannot reroll)', () => {
  assert.equal(hashUnit('seed', 'providence', 'standard', 42), hashUnit('seed', 'providence', 'standard', 42));
  assert.notEqual(hashUnit('seed', 'providence', 'standard', 42), hashUnit('seed', 'providence', 'standard', 43));
});

test('save round-trips and is versioned', () => {
  const s = createInitialState(1000, 'seed-1');
  s.gen.seeds = 123.5;
  s.gen.ministries.tracts.owned = 7;
  s.currencies.faithfulness = 12;
  const text = serialize(s, 5000);
  const raw = JSON.parse(text);
  assert.equal(raw.version, BALANCE.saveVersion);
  assert.equal(raw.lastSavedAt, 5000);
  const back = deserialize(text);
  assert.equal(back.gen.seeds, 123.5);
  assert.equal(back.gen.ministries.tracts.owned, 7);
  assert.equal(back.currencies.faithfulness, 12);
  assert.equal(back.rngSeed, 'seed-1');
});

test('older/partial saves gain new fields from defaults', () => {
  const s = createInitialState(0, 's');
  const raw = JSON.parse(JSON.stringify(s));
  delete raw.settings;
  delete raw.gen.bossState;
  const back = deserialize(JSON.stringify(raw));
  assert.ok(back.settings.musicVolume > 0);
  assert.equal(back.gen.bossState.status, 'locked');
});

test('corrupt, wrong-version, and missing saves fail safely', () => {
  const store = createMemoryStorage();
  assert.equal(loadState(store).status, 'missing');
  store.setItem(SAVE_KEY, '{not json');
  assert.equal(loadState(store).status, 'corrupt');
  assert.equal(store.getItem(`${SAVE_KEY}.corrupt`), '{not json');
  store.setItem(SAVE_KEY, JSON.stringify({ version: 999, gen: {}, currencies: {} }));
  assert.equal(loadState(store).status, 'corrupt');
  store.setItem(SAVE_KEY, JSON.stringify({ version: 1 }));
  assert.equal(loadState(store).status, 'corrupt');
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() {} };
  assert.equal(loadState(throwing).status, 'unavailable');
  assert.equal(saveState(throwing, SAVE_KEY, createInitialState()), false);
  clearSave(store);
  assert.equal(store.getItem(SAVE_KEY), null);
});

test('sanitize clamps NaN, negative and absurd values', () => {
  const s = createInitialState(0, 's');
  s.gen.seeds = NaN;
  s.gen.funds = -5;
  s.gen.ministries.tracts.owned = -3;
  s.currencies.faithfulness = Infinity;
  const back = deserialize(JSON.stringify(s));
  assert.equal(back.gen.seeds, 0);
  assert.equal(back.gen.funds, 0);
  assert.equal(back.gen.ministries.tracts.owned, 0);
  assert.equal(back.currencies.faithfulness, 0);
});

test('offline clock handling: negative, zero, NaN and huge deltas', () => {
  const cap = BALANCE.offline.capHours * 3600;
  assert.equal(clampOfflineSeconds(1000, 500), 0);
  assert.equal(clampOfflineSeconds(1000, 1000), 0);
  assert.equal(clampOfflineSeconds(NaN, 1000), 0);
  assert.equal(clampOfflineSeconds(0, 60_000), 60);
  assert.equal(clampOfflineSeconds(0, 1e15), cap);
});

test('offline rate: 100% for the first 8 hours, reduced after', () => {
  const full = BALANCE.offline.fullRateHours * 3600;
  assert.equal(effectiveOfflineSeconds(3600), 3600);
  assert.equal(effectiveOfflineSeconds(full), full);
  assert.equal(effectiveOfflineSeconds(full + 4000), full + 4000 * BALANCE.offline.reducedRate);
});

test('offline gains accrue Seeds/Funds only; no conversions, specials or boss progress', () => {
  const s = createInitialState(0, 'off');
  s.gen.ministries.tracts.owned = 10;
  s.gen.fundsUnlocked = true;
  const game = new Game({ state: s });
  const before = JSON.stringify({
    conv: s.gen.conversionState, specials: s.gen.encounterStats.specialsCompleted, boss: s.gen.bossState, idx: s.gen.encounterIndex,
  });
  const gains = game.creditOffline(3600);
  assert.equal(gains.seeds, 10 * 3600);
  assert.ok(gains.funds > 0);
  assert.equal(s.gen.seeds, 36000);
  const after = JSON.stringify({
    conv: s.gen.conversionState, specials: s.gen.encounterStats.specialsCompleted, boss: s.gen.bossState, idx: s.gen.encounterIndex,
  });
  assert.equal(before, after);
  assert.equal(computeOffline(s, -5).seeds, 0);
  const g2 = computeOffline({ ...s, phase: 'gen2preview' }, 3600);
  assert.equal(g2.seeds, 0);
  applyOffline(s, { seconds: 1, seeds: 1, funds: 0 });
});
