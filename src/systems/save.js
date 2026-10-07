import { BALANCE } from '../config/balance.js';
import { createInitialState } from '../core/state.js';

export const SAVE_KEY = 'idlevangelist.save';
export const DEBUG_SAVE_KEY = 'idlevangelist.save.debug';

/** In-memory storage with the localStorage surface; used by tests, the simulator, and storage-failure fallback. */
export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

/** Deep-merge saved data over fresh defaults so older saves gain new fields safely. */
function mergeDefaults(defaults, saved) {
  if (!isObject(defaults)) return saved === undefined ? defaults : saved;
  const out = Array.isArray(defaults) ? [] : {};
  for (const key of Object.keys(defaults)) {
    out[key] = isObject(defaults[key]) && isObject(saved?.[key]) ? mergeDefaults(defaults[key], saved[key]) : saved?.[key] !== undefined ? saved[key] : defaults[key];
  }
  for (const key of Object.keys(saved || {})) if (!(key in out)) out[key] = saved[key];
  return out;
}

function num(v, fallback = 0, max = 1e15) {
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : fallback;
}

/** Migration hook: add steps here when `version` increases. */
export function migrate(raw) {
  const data = { ...raw };
  // v1 is current. Future: if (data.version < 2) { ...; data.version = 2; }
  return data;
}

export function sanitize(state) {
  const gen = state.gen;
  gen.seeds = num(gen.seeds);
  gen.funds = num(gen.funds);
  gen.totalSeeds = Math.max(num(gen.totalSeeds), gen.seeds);
  gen.totalFunds = num(gen.totalFunds);
  gen.genSeconds = num(gen.genSeconds, 0, 1e9);
  for (const id of Object.keys(gen.ministries)) gen.ministries[id].owned = Math.floor(num(gen.ministries[id]?.owned, 0, 100000));
  gen.encounterIndex = Math.floor(num(gen.encounterIndex, 0, 1e9));
  gen.specialIndex = Math.floor(num(gen.specialIndex, 0, 1e9));
  if (!Array.isArray(gen.scripturesUnlocked)) gen.scripturesUnlocked = [];
  if (!Array.isArray(gen.conversionState.converts)) gen.conversionState.converts = [];
  gen.street.streak = num(gen.street.streak, 0, 1000);
  gen.street.idle = num(gen.street.idle, 0, 1e6);
  gen.street.momentum = num(gen.street.momentum, 0, 100);
  gen.street.momentumIdle = num(gen.street.momentumIdle, 0, 1e6);
  gen.street.standFirmLeft = num(gen.street.standFirmLeft, 0, 600);
  gen.street.word = num(gen.street.word, 0, BALANCE.street.word.max);
  state.currencies.faithfulness = Math.floor(num(state.currencies.faithfulness, 0, 1e6));
  if (typeof state.rngSeed !== 'string' || !state.rngSeed) state.rngSeed = createInitialState().rngSeed;
  if (!['gen1', 'complete', 'gen2preview'].includes(state.phase)) state.phase = 'gen1';
  return state;
}

export function serialize(state, now = Date.now()) {
  state.lastSavedAt = now;
  return JSON.stringify(state);
}

export function deserialize(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(raw) || !Number.isFinite(raw.version) || raw.version < 1 || raw.version > BALANCE.saveVersion) return null;
  if (!isObject(raw.gen) || !isObject(raw.currencies)) return null;
  const merged = mergeDefaults(createInitialState(0, 'x'), migrate(raw));
  merged.rngSeed = raw.rngSeed;
  return sanitize(merged);
}

/** Returns { state, status } where status is 'ok' | 'missing' | 'corrupt' | 'unavailable'. */
export function loadState(storage, key = SAVE_KEY) {
  let text;
  try {
    text = storage.getItem(key);
  } catch {
    return { state: null, status: 'unavailable' };
  }
  if (text == null) return { state: null, status: 'missing' };
  const state = deserialize(text);
  if (!state) {
    try {
      storage.setItem(`${key}.corrupt`, text);
    } catch {
      // storage full/unavailable: nothing more to do
    }
    return { state: null, status: 'corrupt' };
  }
  return { state, status: 'ok' };
}

export function saveState(storage, key, state, now = Date.now()) {
  try {
    storage.setItem(key, serialize(state, now));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage, key = SAVE_KEY) {
  try {
    storage.removeItem(key);
    storage.removeItem(`${key}.corrupt`);
  } catch {
    // ignore
  }
}
