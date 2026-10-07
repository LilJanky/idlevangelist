// The short-term goal ladder: always one clear "next thing", with progress. Pure function of the game state.
import { MINISTRY_IDS } from './state.js';
import { MINISTRIES, MILESTONE_TEXT, DISCIPLES, UPGRADE_TEXT } from '../data/content.js';
import { formatCost } from './format.js';

const pct = (a, z) => Math.max(0, Math.min(1, z > 0 ? a / z : 1));

/** @returns {{ id: string, text: string, progress: number }} */
export function currentGoal(game) {
  const gen = game.state.gen;
  const b = game.balance;
  const stats = gen.encounterStats;
  const own = (id) => gen.ministries[id].owned;

  // The first few steps teach the loop in order.
  if (own('tracts') === 0) {
    const cost = game.ministryInfo('tracts').cost1;
    return { id: 'tracts1', text: `Buy your first Tracts (${formatCost(cost)} Seeds)`, progress: pct(gen.seeds, cost) };
  }
  if (own('tracts') < 3) return { id: 'tracts3', text: 'Own 3 Tracts: they carry Scripture', progress: pct(own('tracts'), 3) };
  if (stats.wordUses === 0) return { id: 'word1', text: 'Prepare to proclaim the Word to the street', progress: game.wordFraction };
  if (own('bibles') === 0) {
    const def = b.ministries.bibles;
    if (!game.isMinistryUnlocked('bibles')) {
      return { id: 'bibles-unlock', text: `Keep planting: Bibles unlock at ${formatCost(def.unlockSeeds)} Seeds`, progress: Math.min(pct(gen.totalSeeds, def.unlockSeeds), pct(gen.genSeconds, def.unlockSeconds)) };
    }
    const cost = game.ministryInfo('bibles').cost1;
    return { id: 'bibles1', text: `Buy your first Bibles (${formatCost(cost)} Seeds)`, progress: pct(gen.seeds, cost) };
  }
  if (stats.specialsMet === 0) {
    const s = b.specials;
    return { id: 'talk1', text: 'Someone will stop to talk. Look for the gold arrow.', progress: Math.min(pct(gen.totalSeeds, s.unlockSeeds), pct(gen.genSeconds, s.unlockGenSeconds)) };
  }

  // After that: whichever worthwhile thing is closest.
  const options = [];
  if (game.bossAvailable) options.push({ id: 'boss', text: 'The Professor is in the plaza', progress: 1 });
  for (const d of gen.disciples) {
    if (d.status !== 'candidate') continue;
    const cost = game.discipleDef(d.id).cost;
    options.push({ id: `disciple-${d.id}`, text: `${DISCIPLES[d.id].name} wants to help (${formatCost(cost)} Seeds)`, progress: pct(gen.seeds, cost) * 0.99 });
  }
  for (const id of MINISTRY_IDS) {
    if (!game.isMinistryUnlocked(id)) {
      const def = b.ministries[id];
      options.push({ id: `unlock-${id}`, text: `Plant ${formatCost(def.unlockSeeds)} Seeds to unlock ${MINISTRIES[id].name}`, progress: Math.min(pct(gen.totalSeeds, def.unlockSeeds), pct(gen.genSeconds, def.unlockSeconds)) * 0.98 });
      continue;
    }
    const marks = b.visualMilestones;
    const next = marks.find((m) => m > own(id));
    if (next === undefined) continue;
    const tier = marks.indexOf(next);
    const lines = MILESTONE_TEXT[id];
    options.push({ id: `mark-${id}-${next}`, text: `Own ${next} ${MINISTRIES[id].name}: ${lines[Math.min(lines.length - 1, tier)].toLowerCase()}`, progress: pct(own(id), next) * 0.97 });
  }
  if (gen.bossState.status === 'locked' && gen.bossState.foreshadowStage > 0) {
    const target = b.boss.buzzTarget;
    const n = Math.min(gen.bossState.buzz || 0, target);
    options.push({ id: 'lecture', text: `Spread the word about the lecture (${n}/${target} people reached)`, progress: Math.max(0.5, pct(n, target)) * 0.99 });
  }

  // Upgrades: tease the first set, then point at the nearest one (a fork is presented as a single choice).
  if (!gen.clustersUnlocked.includes(1)) {
    const c = b.clusters[1];
    options.push({ id: 'upgrades-unlock', text: `Plant ${formatCost(c.totalSeeds)} Seeds to unlock Upgrades`, progress: Math.min(pct(gen.totalSeeds, c.totalSeeds), pct(gen.genSeconds, c.genSeconds)) * 0.98 });
  } else {
    let near = null;
    for (const id of Object.keys(b.upgrades)) {
      const def = b.upgrades[id];
      if (def.currency !== 'seeds' || gen.upgrades[id] || !game.isUpgradeVisible(id) || game.isUpgradeForgone(id)) continue;
      if (def.exclusiveWith && id > def.exclusiveWith) continue;
      if (!near || def.cost < b.upgrades[near].cost) near = id;
    }
    if (near) {
      const def = b.upgrades[near];
      const text = def.exclusiveWith
        ? `Choose a path: ${UPGRADE_TEXT[near].name} or ${UPGRADE_TEXT[def.exclusiveWith].name} (${formatCost(def.cost)} Seeds)`
        : `Upgrade: ${UPGRADE_TEXT[near].name} (${formatCost(def.cost)} Seeds)`;
      options.push({ id: `upgrade-${near}`, text, progress: pct(gen.seeds, def.cost) * 0.995 });
    }
  }
  if (!options.length) return { id: 'street', text: 'Work the street. The Word is prepared as you go.', progress: game.wordFraction };
  return options.reduce((a, c) => (c.progress > a.progress ? c : a));
}
