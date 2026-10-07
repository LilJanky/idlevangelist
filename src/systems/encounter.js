// Encounter generation and rewards. Encounter content is a pure function of (seed, index, progress tier),
// so a reload re-presents the same person rather than rerolling.
//
// Conversations are the five archetypes in content.js (a person who wants to talk). Ordinary passersby are the
// street crowd itself, not conversations. The Professor's arguments reuse the same response/application structure.
import { BALANCE } from '../config/balance.js';
import { hashUnit } from '../core/rng.js';
import { ENCOUNTERS, ENCOUNTER_ORDER, BOSS, PEOPLE_NAMES, NAME_POOL_BY_ARCHETYPE, SCRIPTURES, PLAIN_LABELS } from '../data/content.js';
import { seedsPerSecond, tierIndex, computeModifiers } from '../core/economy.js';
import { exchangeQuality, applicationLabel } from './scripture.js';

function baseEncounter(kind, index) {
  return {
    kind,
    index,
    state: 'focusEnter',
    step: 'respond', // respond -> apply (conversation) | press (Professor) -> done
    t: 0,
    idle: 0,
    touched: false,
    answer: null, // the chosen response
    approach: null,
    scripture: null, // the applied passage
    wordCharged: false, // WORD was ready when a passage was applied
    resolved: false,
    rewarded: false,
  };
}

/** Deterministic Fisher-Yates so the same encounter always lists its responses in the same order. */
function shuffled(list, seed, label, index) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(hashUnit(seed, label, index, i) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The first people met are always the first three archetypes in order, so each is learned once before any repeats. */
export function specialIdFor(state) {
  const met = state.gen.encounterStats.specialsMet;
  if (met < ENCOUNTER_ORDER.length) return ENCOUNTER_ORDER[met];
  return ENCOUNTER_ORDER[Math.floor(hashUnit(state.rngSeed, 'special', state.gen.specialIndex) * ENCOUNTER_ORDER.length)];
}

/** The person you keep meeting for each kind of conversation. Stable until they come to Christ, then someone new. */
export function personFor(state, archetype) {
  const gen = state.gen;
  const taken = new Set(gen.conversionState.converts.map((c) => c.name));
  for (const id of ENCOUNTER_ORDER) {
    const serial = gen.regularSerial?.[id] || 0;
    const pool = NAME_POOL_BY_ARCHETYPE[id] || PEOPLE_NAMES;
    let name = pool[0];
    for (let k = 0; k < pool.length * 2; k++) {
      const pick = pool[Math.floor(hashUnit(state.rngSeed, 'pname', id, serial, k) * pool.length)];
      if (!taken.has(pick)) {
        name = pick;
        break;
      }
    }
    if (id === archetype) return name;
    taken.add(name);
  }
  return PEOPLE_NAMES[0];
}

/**
 * Which situation this person brings next. Newer kinds join the mix as the generation goes on. It is never the one they last brought
 * (a person you missed does not simply repeat themselves), and it is a pure function of the saved state.
 */
export function chooseVariant(state, specialId) {
  const gen = state.gen;
  const arch = ENCOUNTERS[specialId];
  let open = arch.variants.map((v, i) => i).filter((i) => (arch.variants[i].after || 0) <= gen.genSeconds);
  const last = gen.lastVariant?.[specialId];
  if (open.length > 1 && last !== undefined) open = open.filter((i) => i !== last);
  return open[Math.floor(hashUnit(state.rngSeed, 'variant', gen.encounterIndex, gen.specialIndex) * open.length)];
}

/** A learned conversation is one situation (archetype + variant). */
export const masteryKey = (specialId, variant) => `${specialId}:${variant}`;
/**
 * How a situation you have met before is handled: 'learned' (the best path was found: gathered at full quality) or 'familiar'
 * (talked through `familiarAfter` times without finding it: gathered at the best quality reached). New situations are a conversation.
 */
export function treatmentFor(state, specialId, variant, balance = BALANCE) {
  const gen = state.gen;
  const key = masteryKey(specialId, variant);
  if (gen.mastery?.[key]) return { kind: 'learned', quality: 1 };
  const pr = gen.practice?.[key];
  if (pr && pr.tries >= balance.specials.familiarAfter) return { kind: 'familiar', quality: pr.best };
  return null;
}
export const situationCount = () => ENCOUNTER_ORDER.reduce((n, id) => n + ENCOUNTERS[id].variants.length, 0);

export function makeSpecialEncounter(state, specialId, balance = BALANCE, variantIndex = chooseVariant(state, specialId)) {
  const gen = state.gen;
  const index = gen.encounterIndex; // shares the encounter counter so outcomes stay unique per encounter
  const arch = ENCOUNTERS[specialId];
  const seed = state.rngSeed;
  const variant = arch.variants[variantIndex];
  const [sMin, sMax] = balance.specials.rewardSeconds;
  return {
    ...baseEncounter('special', index),
    archetypeId: specialId,
    specialId,
    name: arch.name,
    person: personFor(state, specialId),
    label: arch.issue,
    statement: variant.statement,
    variant: variantIndex,
    choices: shuffled(variant.choices, seed, 'order', index),
    askScripture: arch.askScripture,
    lines: shuffled(variant.next, seed, 'lines', index),
    returnLine: gen.memory?.[specialId] ? arch.returns[gen.memory[specialId]] : null,
    tier: tierIndex(gen.totalSeeds, balance),
    rewardSecs: sMin + (sMax - sMin) * hashUnit(seed, 'srew', index),
    look: arch.look,
  };
}

/** The conversation as you would have it, once learned: the strongest response and the line aimed at what was raised. */
export function makeAutoEncounter(state, specialId, variantIndex, balance = BALANCE, quality = 1) {
  const enc = makeSpecialEncounter(state, specialId, balance, variantIndex);
  if (quality < 1) enc.qualityOverride = quality;
  const choice = enc.choices.find((c) => c.grade === 'strong');
  const line = enc.lines.find((l) => l.grade === 'direct');
  const verse = line.verse ? SCRIPTURES[line.verse] : null;
  enc.answer = choice;
  enc.approach = balance.scripture.approach.strong;
  enc.scripture = {
    id: line.id,
    plain: !verse,
    grade: 'direct',
    label: verse ? applicationLabel('direct') : PLAIN_LABELS.direct,
    say: line.say,
    reply: line.reply,
    ref: verse ? verse.ref : null,
  };
  enc.step = 'apply';
  enc.state = 'active';
  enc.auto = true;
  return enc;
}

export function makeBossEncounter(phaseIndex, balance = BALANCE, bonus = 0, seed = 'boss') {
  const phase = balance.boss.arguments[phaseIndex];
  const text = BOSS.phases[phaseIndex];
  return {
    ...baseEncounter('boss', 1000 + phaseIndex),
    state: 'active',
    archetypeId: `boss_${phase.id}`,
    name: BOSS.name,
    label: `Argument ${phaseIndex + 1} · ${text.title}`,
    statement: text.statement,
    choices: shuffled(text.choices, seed, 'boss-order', phaseIndex),
    rebuttal: text.rebuttal, // what he says when he answers back, halfway through
    rebuttalChoices: shuffled(text.rebuttal.choices, seed, 'boss-rebut', phaseIndex),
    rebutted: false,
    rebutWait: 0,
    applications: text.applications,
    tier: 4,
    resistanceMax: Math.round(phase.resistance * (1 - bonus)),
    resistance: Math.round(phase.resistance * (1 - bonus)),
    crowdBonus: bonus,
    timeLimit: phase.seconds,
    timeLeft: phase.seconds,
    phaseIndex,
  };
}

/** What a finished conversation pays. Better answers and better-applied Scripture pay more; nothing here touches conversion. */
export function encounterReward(state, enc, balance = BALANCE) {
  const mods = computeModifiers(state, balance);
  const p = seedsPerSecond(state, mods, 1, balance);
  const cfg = balance.specials;
  const quality = exchangeQuality(enc, balance);
  const [lo, hi] = cfg.qualityReward;
  const base = Math.max(cfg.rewardFloor, p * enc.rewardSecs);
  let seeds = base * (1 + mods.rewardPct) * (1 + mods.talkPct) * (lo + (hi - lo) * quality);
  if (enc.wordCharged) seeds *= balance.street.word.encounterBonus;
  let funds = 0;
  if (state.gen.fundsUnlocked) {
    const [fMin, fMax] = cfg.funds;
    funds = Math.round((fMin + (fMax - fMin) * hashUnit(state.rngSeed, 'sfund', enc.index)) * (ENCOUNTERS[enc.specialId]?.funds ?? 1));
  }
  return { seeds: Math.max(1, Math.round(seeds)), funds, quality };
}

/** Presentation only: how the person is seen to respond. It tracks the exchange, never regeneration. */
export function pickReaction(state, enc, quality) {
  const reactions = ENCOUNTERS[enc.specialId].reactions;
  const bands = BALANCE.specials.reactionBands;
  const band = quality >= bands.high ? 'high' : quality >= bands.mid ? 'mid' : 'low';
  const list = reactions[band];
  return list[Math.floor(hashUnit(state.rngSeed, 'react', enc.index) * list.length)];
}

export function bossReward(state, balance = BALANCE) {
  const p = seedsPerSecond(state, computeModifiers(state, balance), 1, balance);
  return Math.round(Math.max(balance.boss.rewardFloor, p * balance.boss.rewardSeconds));
}
