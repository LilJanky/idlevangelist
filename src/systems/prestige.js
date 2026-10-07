// Generation completion, Faithfulness, and the first prestige (Next Generation).
// Faithfulness is milestone-heavy; conversions add at most one capped bonus point and are never required.
import { BALANCE } from '../config/balance.js';
import { createGenerationState, MINISTRY_IDS } from '../core/state.js';
import { computeModifiers } from '../core/economy.js';

export function trainedDiscipleCount(gen) {
  return gen.disciples.filter((d) => d.status === 'trained').length;
}

export function faithfulnessBreakdown(state, balance = BALANCE) {
  const gen = state.gen;
  const f = balance.faithfulness;
  const parts = [{ id: 'base', value: f.base, earned: true }];
  parts.push({ id: 'ministries', value: f.allMinistries, earned: MINISTRY_IDS.every((id) => gen.ministries[id].owned > 0) });
  parts.push({ id: 'disciples', value: f.disciples.bonus, earned: trainedDiscipleCount(gen) >= f.disciples.count });
  parts.push({ id: 'boss', value: f.boss, earned: !!gen.bossState.defeated });
  parts.push({ id: 'active', value: f.activeMilestone.bonus, earned: gen.encounterStats.engagements >= f.activeMilestone.engagements });
  parts.push({ id: 'conversions', value: f.conversion.bonus, earned: gen.conversionState.converts.length >= f.conversion.count });
  const total = parts.reduce((sum, p) => sum + (p.earned ? p.value : 0), 0);
  return { parts, total };
}

export function buildSummary(state) {
  const gen = state.gen;
  const s = gen.encounterStats;
  return {
    seedsPlanted: Math.floor(gen.totalSeeds),
    scripturesProclaimed: s.scripturesProclaimed,
    peopleEngaged: s.engaged,
    conversationsCompleted: s.completed,
    specialOpportunities: s.specialsCompleted,
    disciplesTrained: trainedDiscipleCount(gen),
    conversionsWitnessed: gen.conversionState.converts.length,
    ministriesEstablished: MINISTRY_IDS.filter((id) => gen.ministries[id].owned > 0).length,
    secondsPlayed: Math.floor(gen.genSeconds),
  };
}

/** The people you spoke with, one row each (a regular met several times is one person), converted first. */
export function buildPeople(state) {
  const by = new Map();
  for (const e of state.gen.people || []) {
    const r = by.get(e.person) || { name: e.person, archetype: e.archetype, meetings: 0, bestQ: 0, lastQ: 0, converted: false, firstAt: e.at };
    r.meetings += 1;
    r.bestQ = Math.max(r.bestQ, e.q);
    r.lastQ = e.q;
    r.converted = r.converted || !!e.converted;
    by.set(e.person, r);
  }
  return [...by.values()].sort((a, b) => Number(b.converted) - Number(a.converted) || b.meetings - a.meetings || b.bestQ - a.bestQ).slice(0, 8);
}

/** Called once on boss victory. Idempotent: repeated calls change nothing. */
export function completeGeneration(state, balance = BALANCE) {
  if (state.phase !== 'gen1') return false;
  state.phase = 'complete';
  const breakdown = faithfulnessBreakdown(state, balance);
  state.prestige.summary = { stats: buildSummary(state), breakdown, generation: state.generation, people: buildPeople(state) };
  return true;
}

export function startingGenState(state, balance = BALANCE) {
  const gen = createGenerationState();
  const mods = computeModifiers({ gen, prestige: state.prestige }, balance);
  gen.seeds = mods.startSeeds;
  gen.totalSeeds = mods.startSeeds;
  for (const [id, n] of Object.entries(mods.startMinistry)) gen.ministries[id].owned = n;
  if (mods.startClusters > 0) gen.clustersUnlocked = [1];
  return gen;
}

/** Awards Faithfulness exactly once per completed generation, then resets generation-scoped state. */
export function beginNextGeneration(state, balance = BALANCE) {
  if (state.phase !== 'complete' || !state.prestige.summary) return { ok: false };
  const key = String(state.generation);
  let awarded = 0;
  if (!state.prestige.awardedFor[key]) {
    awarded = state.prestige.summary.breakdown.total;
    state.currencies.faithfulness += awarded;
    state.prestige.awardedFor[key] = awarded;
    state.prestige.lastAward = awarded;
  }
  const old = state.gen;
  state.prestige.legacy = {
    disciples: old.disciples.filter((d) => d.status === 'trained').map((d) => d.id),
    converts: old.conversionState.converts.map((c) => c.name),
    ministries: Object.fromEntries(MINISTRY_IDS.map((id) => [id, old.ministries[id].owned])),
  };
  state.prestige.completedGenerations += 1;
  state.generation += 1;
  state.phase = 'gen2preview';
  state.gen = startingGenState(state, balance);
  return { ok: true, awarded };
}

export function canBuyNode(state, id, balance = BALANCE) {
  const def = balance.prestige.nodes[id];
  if (!def || state.phase !== 'gen2preview') return false;
  if (state.prestige.nodes[id]) return false;
  if (def.requires && !state.prestige.nodes[def.requires]) return false;
  return state.currencies.faithfulness >= def.cost;
}

export function buyNode(state, id, balance = BALANCE) {
  if (!canBuyNode(state, id, balance)) return false;
  state.currencies.faithfulness -= balance.prestige.nodes[id].cost;
  state.prestige.nodes[id] = true;
  state.gen = startingGenState(state, balance); // refresh the previewed head start
  return true;
}
