import { BALANCE } from '../config/balance.js';
import { computeModifiers, seedsPerSecond, fundsPerSecond } from '../core/economy.js';

/** Seconds that count as offline, clamped for negative/NaN/absurd clock changes. */
export function clampOfflineSeconds(lastSavedAt, now, balance = BALANCE) {
  const raw = (now - lastSavedAt) / 1000;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, balance.offline.capHours * 3600);
}

export function effectiveOfflineSeconds(seconds, bonusPct = 0, balance = BALANCE) {
  const full = balance.offline.fullRateHours * 3600;
  const eff = Math.min(seconds, full) + Math.max(0, seconds - full) * balance.offline.reducedRate;
  return eff * (1 + bonusPct);
}

/**
 * Passive-only gains. No conversions, no special encounters, no boss progress are ever produced here.
 * Does not mutate state; call applyOffline to credit.
 */
export function computeOffline(state, seconds, balance = BALANCE) {
  if (state.phase !== 'gen1' || seconds <= 0) return { seconds: 0, seeds: 0, funds: 0 };
  const mods = computeModifiers(state, balance);
  const eff = effectiveOfflineSeconds(seconds, mods.offlineBonusPct, balance);
  return {
    seconds,
    seeds: seedsPerSecond(state, mods, 1, balance) * eff,
    funds: fundsPerSecond(state, mods, balance) * eff,
  };
}

export function applyOffline(state, gains) {
  state.gen.seeds += gains.seeds;
  state.gen.totalSeeds += gains.seeds;
  state.gen.funds += gains.funds;
  state.gen.totalFunds += gains.funds;
  state.lifetime.offlineSecondsCredited += gains.seconds;
}
