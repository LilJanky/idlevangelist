// Pure economy functions: modifiers, costs, production, tiers. No DOM, no randomness.
import { BALANCE } from '../config/balance.js';
import { MINISTRY_IDS, totalMinistryLevels } from './state.js';

const MOD_KEYS = [
  'proclaimPct', 'rewardPct', 'wordPct', 'passivePct', 'discipleLinePct', 'critChance', 'critMult',
  'streakWindowAdd', 'answerCdPct', 'specialWindow', 'contextualPct', 'bossPhaseBonus', 'cadencePct',
  'costDiscount', 'startSeeds', 'startClusters', 'offlineBonusPct',
  'wordCharge', 'wordCrowd', 'streakBonus', 'talkPct', 'eventSize', 'eventLife', 'windowBonus', 'windowSecondsAdd', 'oppLifeAdd',
];

function addEffects(mods, effects) {
  for (const key of MOD_KEYS) if (typeof effects[key] === 'number') mods[key] += effects[key];
  if (effects.synergy) mods.synergy.push(...effects.synergy);
  if (effects.lineMult) {
    for (const [id, v] of Object.entries(effects.lineMult)) mods.lineMult[id] = (mods.lineMult[id] || 0) + v;
  }
  if (effects.startMinistry) {
    for (const [id, v] of Object.entries(effects.startMinistry)) mods.startMinistry[id] = (mods.startMinistry[id] || 0) + v;
  }
}

export function computeModifiers(state, balance = BALANCE) {
  const mods = { lineMult: {}, startMinistry: {}, synergy: [] };
  for (const key of MOD_KEYS) mods[key] = 0;
  for (const id of Object.keys(state.gen.upgrades)) {
    const def = balance.upgrades[id];
    if (def) addEffects(mods, def.effects);
  }
  for (const id of Object.keys(state.prestige.nodes)) {
    const def = balance.prestige.nodes[id];
    if (def && state.prestige.nodes[id]) addEffects(mods, def.effects);
  }
  mods.cadencePct = Math.min(0.5, mods.cadencePct);
  mods.costDiscount = Math.min(0.5, mods.costDiscount);
  return mods;
}

export function ministryCost(id, owned, discount = 0, balance = BALANCE) {
  const base = balance.ministries[id].baseCost;
  return Math.ceil(base * Math.pow(balance.ministryCostRatio, owned) * (1 - discount) - 1e-9);
}

/** Cost of buying `n` more of a ministry (geometric series), rounded up once at the end. */
export function bulkCost(id, owned, n, discount = 0, balance = BALANCE) {
  if (n <= 0) return 0;
  const r = balance.ministryCostRatio;
  const first = balance.ministries[id].baseCost * Math.pow(r, owned) * (1 - discount);
  return Math.ceil((first * (Math.pow(r, n) - 1)) / (r - 1) - 1e-9);
}

export function maxAffordable(id, owned, budget, discount = 0, balance = BALANCE) {
  const r = balance.ministryCostRatio;
  const first = balance.ministries[id].baseCost * Math.pow(r, owned) * (1 - discount);
  if (budget < first) return 0;
  let n = Math.floor(Math.log(1 + (budget * (r - 1)) / first) / Math.log(r));
  while (n > 0 && bulkCost(id, owned, n, discount, balance) > budget) n--;
  while (bulkCost(id, owned, n + 1, discount, balance) <= budget) n++;
  return Math.max(0, n);
}

export function milestoneMultiplier(owned, balance = BALANCE) {
  let m = 1;
  for (const ms of balance.ministryMilestones) if (owned >= ms.owned) m *= ms.mult;
  return m;
}

export function assignedDiscipleCount(gen, ministryId) {
  let n = 0;
  for (const d of gen.disciples) if (d.status === 'trained' && d.assigned === ministryId) n++;
  return n;
}

export function lineProduction(state, id, mods, buffMult = 1, balance = BALANCE) {
  return lineProductionForOwned(state, id, state.gen.ministries[id].owned, mods, buffMult, balance);
}

/** Production of a line as if `owned` units were held (used for before/after previews). */
export function lineProductionForOwned(state, id, owned, mods, buffMult = 1, balance = BALANCE) {
  const gen = state.gen;
  if (owned <= 0) return 0;
  const def = balance.ministries[id];
  const discipleBoost = 1 + assignedDiscipleCount(gen, id) * (balance.disciples.lineBoost + mods.discipleLinePct);
  let lineMult = 1 + (mods.lineMult[id] || 0);
  // Synergies: owning more of one ministry strengthens another (Tracts feed the Street Team, and so on).
  for (const s of mods.synergy) if (s.to === id) lineMult += s.per * (gen.ministries[s.from]?.owned || 0);
  return owned * def.baseProduction * lineMult * milestoneMultiplier(owned, balance) * discipleBoost * (1 + mods.passivePct) * buffMult;
}

export function seedsPerSecond(state, mods = computeModifiers(state), buffMult = 1, balance = BALANCE) {
  let total = 0;
  for (const id of MINISTRY_IDS) total += lineProduction(state, id, mods, buffMult, balance);
  return total;
}

export function fundsPerSecond(state, mods = computeModifiers(state), balance = BALANCE) {
  if (!state.gen.fundsUnlocked) return 0;
  return balance.funds.basePerSecond + balance.funds.perSeedPerSecond * seedsPerSecond(state, mods, 1, balance);
}

export function tierIndex(totalSeeds, balance = BALANCE) {
  let t = 0;
  balance.encounter.tiers.forEach((tier, i) => {
    if (totalSeeds >= tier.minSeeds) t = i;
  });
  return t;
}

/** Proclaim base impact before crit/verse multipliers: grows with ministry and upgrades. */
export function proclaimBase(state, mods = computeModifiers(state), balance = BALANCE) {
  const hearing = 1 + balance.proclaim.impactPerMinistryLevel * totalMinistryLevels(state.gen);
  return balance.proclaim.baseImpact * hearing * (1 + mods.proclaimPct);
}

export function critStats(mods, balance = BALANCE) {
  return {
    chance: Math.min(balance.proclaim.critChanceCap, balance.proclaim.critChance + mods.critChance),
    mult: balance.proclaim.critMult + mods.critMult,
  };
}

export function streakWindow(mods, balance = BALANCE, count = 0) {
  const b = balance.street;
  const heat = Math.min(1, count / b.streakHeatAt) * b.streakWindowHeat;
  return (b.streakWindow + mods.streakWindowAdd) * (1 - heat);
}

export function streakMultiplier(streakCount, balance = BALANCE, bonus = 0) {
  let mult = 1;
  for (const t of balance.street.streakTiers) if (streakCount >= t.at) mult = t.mult;
  return mult > 1 ? mult + bonus : mult; // a held streak is worth a little more with Endurance
}

/** Per-person multiplier for a street WORD that reaches `people`: ramps through `crowdCurve`, plus the `wordCrowd` upgrades. */
export function wordCrowdMultiplier(people, mods, balance = BALANCE) {
  const cfg = balance.street.word;
  const pts = cfg.crowdCurve;
  const n = Math.max(1, people);
  let mult = pts[pts.length - 1].mult;
  if (n < pts[pts.length - 1].at) {
    for (let i = 1; i < pts.length; i++) {
      if (n <= pts[i].at) {
        const a = pts[i - 1];
        const b = pts[i];
        mult = a.mult + ((b.mult - a.mult) * (n - a.at)) / (b.at - a.at);
        break;
      }
    }
  }
  return mult + (mods?.wordCrowd || 0) * Math.min(n - 1, cfg.crowdUpgradeMaxPeople);
}

/** The named step a crowd of this size has reached (index 0 = none), and the next one to wait for. */
export function wordCrowdTier(people, balance = BALANCE) {
  const named = balance.street.word.crowdCurve.filter((p) => p.name);
  let index = 0;
  named.forEach((p, i) => {
    if (people >= p.at) index = i + 1;
  });
  const next = named[index] || null;
  return {
    index,
    name: index ? named[index - 1].name : null,
    next: next ? { at: next.at, name: next.name, mult: next.mult } : null,
    count: named.length,
  };
}

export function streakTierIndex(streakCount, balance = BALANCE) {
  let idx = 0;
  balance.street.streakTiers.forEach((t, i) => {
    if (streakCount >= t.at) idx = i;
  });
  return idx;
}

export function totalSupportPerSecond(state, mods, balance = BALANCE) {
  let n = 0;
  for (const d of state.gen.disciples) if (d.status === 'trained') n++;
  if (n === 0) return 0;
  const hearing = balance.support.scalesWithHearing ? 1 + balance.proclaim.impactPerMinistryLevel * totalMinistryLevels(state.gen) : 1;
  return n * balance.support.impactPerSecondPerDisciple * hearing * (1 + mods.proclaimPct);
}
