// Hidden conversion outcome logic. Outcomes derive from a keyed hash of the save's providence seed and the
// encounter index, so reloading can never reroll an outcome. Nothing here is ever shown as a percentage,
// and nothing here is purchasable or earnable: Funds, Seeds, speed, WORD, Momentum, which response or passage was
// chosen, and upgrades do not enter. A well-answered conversation may end with no visible response at all.
import { BALANCE } from '../config/balance.js';
import { hashUnit } from '../core/rng.js';
import { CONVERT_NAMES } from '../data/content.js';

export function conversionChance(state, ctx, balance = BALANCE) {
  const cfg = balance.conversion;
  const conv = state.gen.conversionState;
  if (ctx.kind === 'boss') return 0;
  if (conv.converts.length >= cfg.maxPerGeneration) return 0;
  if (ctx.index - conv.lastConversionIndex < cfg.minGapEncounters) return 0;
  let p = cfg.baseChance;
  p *= cfg.tierWeights[Math.min(ctx.tier, cfg.tierWeights.length - 1)] ?? 1;
  p *= 1 + cfg.contactRampPer50 * Math.min(2, conv.contacts / 50);
  return p;
}

/** Deterministic: the same (seed, kind, index) always yields the same outcome. Does not mutate state. */
export function rollConversion(state, ctx, balance = BALANCE) {
  const p = conversionChance(state, ctx, balance);
  if (p <= 0) return { converted: false };
  const roll = hashUnit(state.rngSeed, 'providence', ctx.kind, ctx.index);
  if (roll >= p) return { converted: false, roll };
  const nameRoll = hashUnit(state.rngSeed, 'convert-name', ctx.index);
  const taken = new Set(state.gen.conversionState.converts.map((c) => c.name));
  const pool = CONVERT_NAMES.filter((n) => !taken.has(n));
  const names = pool.length ? pool : CONVERT_NAMES;
  return { converted: true, roll, name: names[Math.floor(nameRoll * names.length)] };
}

export function recordContact(state) {
  state.gen.conversionState.contacts += 1;
}

export function recordConversion(state, ctx, name, genSeconds) {
  const conv = state.gen.conversionState;
  conv.converts.push({ name, index: ctx.index, kind: ctx.kind, archetype: ctx.archetypeId, at: Math.floor(genSeconds) });
  conv.lastConversionIndex = ctx.index;
}
