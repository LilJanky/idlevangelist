// Scripture in conversation. Scripture is authoritative truth, not magic: every passage is true wherever it is
// used. "Application" only describes how directly a passage speaks to the issue raised (a gradient, never a
// right-versus-wrong judgment), and "approach" describes how well a response answered the issue.
import { BALANCE } from '../config/balance.js';
import { APPLICATION_TEXT } from '../data/content.js';
import { proclaimBase } from '../core/economy.js';

export const APPLICATION_ORDER = ['direct', 'contextual', 'relevant', 'proclaimed'];

/** 'direct' | 'contextual' | 'relevant' | 'proclaimed' for a passage against an encounter's/argument's applications. */
export function applicationGrade(verseId, applications) {
  if (applications) for (const grade of ['direct', 'contextual', 'relevant']) if (applications[grade]?.includes(verseId)) return grade;
  return 'proclaimed';
}

export function applicationLabel(grade) {
  return APPLICATION_TEXT[grade]?.label || APPLICATION_TEXT.proclaimed.label;
}

/** A direct or contextual application: the passage speaks to the heart of the matter. */
export function isFitting(grade) {
  return grade === 'direct' || grade === 'contextual';
}

export function verseCooldown(verseId, grade, balance = BALANCE) {
  const v = balance.scripture.verses[verseId];
  return v.cooldown * (isFitting(grade) ? balance.scripture.contextualCooldownMult : 1);
}

/** Weight of a Word in the Professor's exchange. */
export function verseImpact(state, mods, verseId, enc, balance = BALANCE) {
  const v = balance.scripture.verses[verseId];
  if (!v || !enc) return { amount: 0, grade: 'proclaimed' };
  const grade = applicationGrade(verseId, enc.applications);
  let amount = proclaimBase(state, mods, balance) * v.mult * (1 + mods.wordPct) * balance.scripture.application[grade].mult;
  if (isFitting(grade)) amount *= 1 + mods.contextualPct;
  if (v.lateTierBonus && enc.tier >= 3) amount *= v.lateTierBonus;
  return { amount, grade };
}

/** Pressing the point after choosing an approach in the Professor's exchange. */
export function answerImpact(state, mods, enc, balance = BALANCE) {
  const approach = enc.approach || balance.scripture.approach.partial;
  return proclaimBase(state, mods, balance) * balance.scripture.answer.impactMult * approach.mult * (1 + mods.contextualPct);
}

export function answerCooldown(mods, balance = BALANCE) {
  return balance.scripture.answer.cooldown * (1 - mods.answerCdPct);
}

/** 0..1 quality of a completed conversation: how well the response answered, and how directly Scripture applied. */
export function exchangeQuality(enc, balance = BALANCE) {
  if (enc.qualityOverride !== undefined) return enc.qualityOverride; // a conversation you already know: gathered at the quality you reached
  const w = balance.specials.answerWeight;
  const a = enc.answer ? balance.scripture.approach[enc.answer.grade].value : 0;
  const s = enc.scripture ? balance.scripture.application[enc.scripture.grade].value : 0;
  return w * a + (1 - w) * s;
}
