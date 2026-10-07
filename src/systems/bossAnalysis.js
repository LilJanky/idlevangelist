import { BALANCE } from '../config/balance.js';
import { computeModifiers, proclaimBase, critStats, totalSupportPerSecond } from '../core/economy.js';
import { SCRIPTURE_ORDER, BOSS } from '../data/content.js';
import { applicationGrade, isFitting, answerCooldown } from './scripture.js';

export const SKILLS = {
  // Chooses the strongest response, applies the most direct passage, and presses promptly.
  excellent: { words: 'fit', delay: 0.6, answer: true, approach: 1.0, rebut: 'strong' },
  good: { words: 'fit', delay: 1.5, answer: true, approach: 1.0, rebut: 'strong' },
  // Sometimes picks a partial response, applies passages without reading which fits, a few seconds slower.
  messy: { words: 'any', delay: 3.5, answer: true, approach: 0.8, rebut: 'partial' },
  // A middling response (plus helpers): the bare minimum.
  basic: { words: 'none', delay: 2.5, answer: true, approach: 0.72, rebut: 'partial' },
};

function abilityList(state, balance, phaseIndex, skill) {
  const mods = computeModifiers(state, balance);
  const base = proclaimBase(state, mods, balance);
  const crit = critStats(mods, balance);
  const critFactor = 1 + crit.chance * (crit.mult - 1);
  const phase = balance.boss.arguments[phaseIndex];
  const applications = BOSS.phases[phaseIndex].applications;
  const enc = { tier: 4, applications, id: phase.id };
  const list = [];
  if (skill.answer) {
    const approach = skill.approach ?? 1;
    list.push({ id: 'answer', amount: base * balance.scripture.answer.impactMult * approach * (1 + mods.contextualPct) * critFactor, cd: answerCooldown(mods, balance), fit: approach >= 1, isWord: false });
  }
  if (skill.words !== 'none') {
    for (const id of SCRIPTURE_ORDER) {
      const def = balance.scripture.verses[id];
      if (def.mult <= 0 || !state.gen.scripturesUnlocked.includes(id)) continue;
      const grade = applicationGrade(id, enc.applications);
      const fit = isFitting(grade);
      let amount = base * def.mult * (1 + mods.wordPct) * balance.scripture.application[grade].mult * critFactor;
      if (fit) amount *= 1 + mods.contextualPct;
      if (def.lateTierBonus) amount *= def.lateTierBonus;
      list.push({ id, amount, cd: def.cooldown * (fit ? balance.scripture.contextualCooldownMult : 1), fit, isWord: true });
    }
  }
  return { list, support: totalSupportPerSecond(state, mods, balance), mods };
}

/** Seconds a player of the given skill needs to answer one argument completely (capped at 600). */
export function argumentClearSeconds(state, balance, phaseIndex, skill = SKILLS.good, { bonus = 0 } = {}) {
  const { list, support, mods } = abilityList(state, balance, phaseIndex, skill);
  const phase = balance.boss.arguments[phaseIndex];
  const max = phase.resistance * (1 - bonus);
  let resistance = max;
  const reb = balance.boss.rebuttal;
  let rebutted = false;
  let blockedUntil = 0;
  const ready = Object.fromEntries(list.map((a) => [a.id, skill.delay]));
  let shared = 0;
  let buff = 0;
  let casts = 0;
  const dt = 0.1;
  for (let t = 0; t < 600; t += dt) {
    resistance -= support * dt;
    shared = Math.max(0, shared - dt);
    buff = Math.max(0, buff - dt);
    for (const a of list) ready[a.id] = Math.max(0, ready[a.id] - dt);
    // Halfway, he answers back: the reply takes a moment (no casting), then a strong one cuts what remains and a weak one lets him regain some.
    if (!rebutted && resistance <= max * reb.at) {
      rebutted = true;
      blockedUntil = t + skill.delay + 0.8;
      if (skill.rebut === 'strong') resistance *= 1 - reb.strongCut;
      else if (skill.rebut === 'weak') resistance = Math.min(max, resistance + reb.weakAdd * max);
    }
    const candidates = t < blockedUntil ? [] : list.filter((a) => ready[a.id] <= 0 && (!a.isWord || shared <= 0));
    if (skill.words === 'fit') candidates.sort((x, y) => y.amount - x.amount);
    for (const a of candidates) {
      if (a.isWord && shared > 0) continue;
      // `skill.miss` casts at the start of the argument are simply missed (the ability goes on cooldown unused).
      if (casts++ >= (skill.miss || 0)) resistance -= a.amount * (buff > 0 ? 1 + balance.scripture.bossPhaseBonus.impactPct : 1);
      ready[a.id] = a.cd + skill.delay;
      if (a.isWord) shared = balance.scripture.sharedGap;
      if (a.fit && mods.bossPhaseBonus > 0) buff = balance.scripture.bossPhaseBonus.seconds;
    }
    if (resistance <= 0) return t + dt;
  }
  return 600;
}

/** How many times over the player could answer every argument inside its time limit (min over phases). */
export function bossReadiness(state, balance = BALANCE, skill = SKILLS.messy) {
  const per = balance.boss.arguments.map((p, i) => p.seconds / argumentClearSeconds(state, balance, i, skill));
  return { ratio: Math.min(...per), perPhase: per };
}

export function readinessLabel(ratio) {
  if (ratio >= 1.5) return 'Well prepared';
  if (ratio >= 1.05) return 'Promising';
  if (ratio >= 0.75) return 'Uncertain';
  return 'Daunting';
}

/**
 * A gentle debrief after the opportunity passes: observations the player can act on, without solving the fight.
 * Returns up to three keys the UI turns into text.
 */
export function debriefTips(state, session, balance = BALANCE) {
  const gen = state.gen;
  const tips = [];
  const trained = gen.disciples.filter((d) => d.status === 'trained').length;
  const affordable = Object.keys(balance.upgrades).some((id) => !gen.upgrades[id] && balance.upgrades[id].currency === 'seeds' && gen.clustersUnlocked.includes(balance.upgrades[id].cluster) && gen.seeds >= balance.upgrades[id].cost);
  if (session.auto > 0) tips.push('chooseLine');
  if (session.rebuttals > 0 && session.strongRebuttals < session.rebuttals / 2) tips.push('rebuttal');
  if (session.words < 2 || session.fitWords === 0) tips.push('scripture');
  if (session.reachedPhase >= 1 && session.attention < 5) tips.push('crowd');
  if (trained < 2) tips.push('disciples');
  if (affordable) tips.push('upgrades');
  const readiness = bossReadiness(state, balance).ratio;
  if (readiness < 1.05) tips.push('preparation');
  if (!tips.length) tips.push('practice');
  return tips.slice(0, 3);
}
