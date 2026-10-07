// Deterministic balance harness: drives the real Game simulation with a scripted "player" to estimate
// pacing for idle, hybrid, and active play. It is a pacing estimator, not a model of every human.
// Bots work the street (tap marked passersby), proclaim WORD on the street, talk with people who stop (choose a
// response, apply a passage), shop greedily, and take on the Professor (choose a line, press it, apply passages, then
// work the crowd during attention windows).
import { Game } from '../src/systems/game.js';
import { createInitialState, MINISTRY_IDS } from '../src/core/state.js';
import { BALANCE } from '../src/config/balance.js';
import { SCRIPTURE_ORDER } from '../src/data/content.js';
import { applicationGrade, APPLICATION_ORDER } from '../src/systems/scripture.js';
import { seedsPerSecond } from '../src/core/economy.js';

// duty: share of each `period` the player is actively watching. engageRate: street taps per second while attentive
// (accuracy = chance a tap lands on a marked person). react: seconds between something becoming available and the
// player acting on it. answerSkill / scriptureSkill: chance of choosing the strongest response / most direct passage.
// wordPolicy: 'none' never proclaims WORD on the street; 'soon' proclaims shortly after it is ready; 'hold' waits for a
// fuller street (or Stand Firm), but not forever. words: how verses are chosen in the Professor's exchange.
export const PROFILES = {
  idle: { build: 'passive', name: 'Mostly idle', period: 150, duty: 0.1, engageRate: 1.0, accuracy: 0.8, react: 1.8, words: 'any', wordPolicy: 'none', answerSkill: 0.5, scriptureSkill: 0.3, specialChance: 0, buyEvery: 60, bossRate: 1.4, bossPrep: 0.9, windowUse: 0.6 },
  semi: { build: 'passive', name: 'Semi-idle (checks in every few minutes and proclaims WORD)', period: 180, duty: 0.12, engageRate: 1.0, accuracy: 0.8, react: 1.2, words: 'any', wordPolicy: 'soon', answerSkill: 0.5, scriptureSkill: 0.3, specialChance: 0.3, buyEvery: 30, bossRate: 1.4, bossPrep: 0.9, windowUse: 0.6 },
  hybrid: { build: 'active', name: 'Engaged hybrid', period: 90, duty: 0.65, engageRate: 1.3, accuracy: 0.85, react: 1.2, words: 'any', wordPolicy: 'soon', answerSkill: 0.55, scriptureSkill: 0.4, specialChance: 0.7, buyEvery: 15, bossRate: 1.6, bossPrep: 0.9, windowUse: 0.85 },
  casual: { build: 'active', name: 'Casual active (WORD soon)', period: 60, duty: 0.97, engageRate: 1.9, accuracy: 0.92, react: 0.6, words: 'fit', wordPolicy: 'soon', answerSkill: 0.7, scriptureSkill: 0.5, specialChance: 1, buyEvery: 5, bossRate: 2.3, bossPrep: 0.9, windowUse: 1 },
  active: { build: 'active', name: 'Optimized active (WORD held)', period: 60, duty: 0.97, engageRate: 1.9, accuracy: 0.92, react: 0.6, words: 'fit', wordPolicy: 'hold', readCrest: true, holdTargets: 6, holdMax: 14, answerSkill: 0.95, scriptureSkill: 0.95, specialChance: 1, buyEvery: 5, bossRate: 2.3, bossPrep: 0.9, windowUse: 1 },
};

function attentive(profile, t) {
  if (t < 150) return true; // first-timers play actively while learning
  return (t % profile.period) < profile.period * profile.duty;
}

// Which side of each fork a build walks. (A real player decides; the bots follow their profile's `build`.)
export const FORKS = {
  active: ['streetPreacher', 'hospitality', 'broadReach'],
  passive: ['faithfulRoutine', 'multiplication', 'deepRoots'],
};

/** True if the best unaffordable upgrade pays back faster than any ministry, so ministry purchases should wait. */
function saveForUpgrade(game, build, banned) {
  const gen = game.state.gen;
  const sps = Math.max(1, game.baseSeedsPerSec);
  let bestUp = null;
  for (const id of Object.keys(BALANCE.upgrades)) {
    const def = BALANCE.upgrades[id];
    if (def.currency !== 'seeds' || gen.upgrades[id] || banned.has(id) || !game.isUpgradeVisible(id) || game.isUpgradeForgone(id)) continue;
    if (def.exclusiveWith && !FORKS[build].includes(id)) continue;
    const p = game.upgradePreview(id);
    const delta = p.delta > 0 ? p.delta : 0.05 * sps; // effects that are not passive production are worth about 5% of income
    if (def.cost > 600 * sps) continue; // not within reach yet
    const payback = def.cost / delta;
    if (!bestUp || payback < bestUp.payback) bestUp = { id, payback };
  }
  if (!bestUp) return false;
  let bestMin = Infinity;
  for (const id of MINISTRY_IDS) {
    const info = game.ministryInfo(id);
    if (info.unlocked) bestMin = Math.min(bestMin, info.cost1 / Math.max(1e-9, info.perUnit || BALANCE.ministries[id].baseProduction));
  }
  return bestUp.payback < bestMin;
}

function bestPurchases(game, profile = {}) {
  const gen = game.state.gen;
  const build = profile.build || 'active';
  const banned = new Set(profile.banned || []);
  let bought = false;
  for (const d of gen.disciples) if (d.status === 'candidate' && game.trainDisciple(d.id)) bought = true;
  const ups = Object.keys(BALANCE.upgrades).filter((id) => {
    const def = BALANCE.upgrades[id];
    if (gen.upgrades[id] || banned.has(id) || !game.isUpgradeVisible(id) || game.isUpgradeForgone(id) || !game.canAffordUpgrade(id)) return false;
    if (def.exclusiveWith && !FORKS[build].includes(id)) return false;
    return true;
  });
  ups.sort((a, b) => BALANCE.upgrades[a].cost - BALANCE.upgrades[b].cost);
  for (const id of ups) if (game.buyUpgrade(id)) bought = true;
  // A sensible player saves for an upgrade that pays back faster than the next ministry would (small purchases do not out-buy it).
  if (profile.saves !== false && saveForUpgrade(game, build, banned)) return bought;
  for (let guard = 0; guard < 60; guard++) {
    let best = null;
    for (const id of MINISTRY_IDS) {
      const info = game.ministryInfo(id);
      if (!info.unlocked || info.cost1 > gen.seeds) continue;
      const roi = (info.perUnit || BALANCE.ministries[id].baseProduction) / info.cost1;
      if (!best || roi > best.roi) best = { id, roi };
    }
    if (!best || !game.buyMinistry(best.id, 1)) break;
    bought = true;
  }
  return bought;
}

/** Choose a passage: with probability `skill` the most direct one available, otherwise any unlocked passage. */
export function pickPassage(game, enc, skill, rng, { needReady = false } = {}) {
  const unlocked = game.state.gen.scripturesUnlocked.filter((id) => !needReady || (BALANCE.scripture.verses[id].mult > 0 && game.isVerseReady(id)));
  if (!unlocked.length) return null;
  if (rng() < skill) {
    let best = null;
    let bestRank = 99;
    for (const id of SCRIPTURE_ORDER) {
      if (!unlocked.includes(id)) continue;
      const rank = APPLICATION_ORDER.indexOf(applicationGrade(id, enc.applications));
      if (rank < bestRank) {
        best = id;
        bestRank = rank;
      }
    }
    return best;
  }
  return unlocked[Math.floor(rng() * unlocked.length)];
}

/** What to say next in a conversation: with probability `skill` the line that answers what was raised, otherwise any offered line. */
const LINE_RANK = ['direct', 'contextual', 'relevant', 'proclaimed'];
function pickLine(enc, skill, rng) {
  const lines = enc.lines;
  if (rng() < skill) return lines.reduce((a, b) => (LINE_RANK.indexOf(b.grade) < LINE_RANK.indexOf(a.grade) ? b : a)).id;
  return lines[Math.floor(rng() * lines.length)].id;
}

function pickResponse(enc, skill, rng, choices = enc.choices) {
  const strong = choices.find((c) => c.grade === 'strong');
  if (rng() < skill) return strong;
  const rest = choices.filter((c) => c !== strong);
  return rest[Math.floor(rng() * rest.length)];
}

/** Create a bot-driven game. `step(t)` advances one 0.1 s tick of play. */
export function createBot(profileName = 'hybrid', seed = 'sim-1', { balance = BALANCE, profileOverride = {} } = {}) {
  const profile = { ...PROFILES[profileName], ...profileOverride };
  const state = createInitialState(0, seed);
  const game = new Game({ state, balance });
  const bot = {
    game, profile, tapAcc: 0, buyTimer: 0, nextCheckin: 0, noticed: { id: -1, will: false }, windowUse: true, prepTimer: 0, prep: 0,
    encKey: null, encWait: 0, wordSince: null, answerWait: 0, wordWait: 0, wordHeld: 0,
  };
  const rng = game.rng;

  bot.step = (t, step = 0.1) => {
    const g = game.state.gen;
    const watching = attentive(profile, t) || game.inBoss;
    game.tick(step);
    if (game.state.phase !== 'gen1') return;

    bot.buyTimer -= step;
    const checkin = profile.duty < 0.3 && t >= bot.nextCheckin;
    if ((watching && bot.buyTimer <= 0) || checkin) {
      bot.buyTimer = profile.buyEvery;
      if (checkin) bot.nextCheckin = t + profile.buyEvery;
      bestPurchases(game, profile);
    }

    if (game.bossAvailable) {
      bot.prepTimer -= step;
      if (bot.prepTimer <= 0) {
        bot.prepTimer = 5;
        bot.prep = game.bossPreparation();
      }
      if (bot.prep >= profile.bossPrep && (watching || profile.duty < 0.3)) game.challengeBoss();
    }
    if (game.boss?.stage === 'victory') game.finishBossVictory();
    if (!watching) return;

    // The Professor's argument and conversations: deliberate responses
    const enc = game.activeEncounter;
    if (enc && enc.state === 'active' && !enc.resolved) {
      if (enc.kind === 'special') bot.conversation(enc, step);
      else bot.exchange(enc, step, t);
    } else bot.encKey = null;

    // Someone who wants to talk: notice with some probability, react after a short delay
    const special = game.crowd.specials[0];
    if (special && !game.inBoss && !game.enc) {
      if (special.id !== bot.noticed.id) {
        bot.noticed.id = special.id;
        bot.noticed.will = rng() < profile.specialChance;
      }
      if (bot.noticed.will && special.age >= profile.react + 0.4) game.tapSpecial(special.id);
    }

    // The street: WORD, then taps on people with open moments (also the Professor's attention window)
    const window = game.boss?.stage === 'window';
    if (game.streetOpen) {
      bot.street(step, t, window);
      if (window && game.boss.t < 0.2) bot.windowUse = rng() < profile.windowUse;
    }
  };

  bot.conversation = (enc, step) => {
    const key = `${enc.index}-${enc.step}`;
    if (key !== bot.encKey) {
      bot.encKey = key;
      bot.encWait = profile.react + 1.2 + rng();
    }
    bot.encWait -= step;
    if (bot.encWait > 0) return;
    if (enc.step === 'respond') game.respond(pickResponse(enc, profile.answerSkill, rng).id);
    else if (enc.step === 'apply') {
      game.sayLine(pickLine(enc, profile.scriptureSkill, rng));
    }
  };

  bot.exchange = (enc, step) => {
    if (enc.step === 'rebut') {
      const key = `rebut-${enc.index}`;
      if (key !== bot.encKey) {
        bot.encKey = key;
        bot.encWait = profile.react + 1;
      }
      bot.encWait -= step;
      if (bot.encWait <= 0) game.rebut(pickResponse(enc, profile.answerSkill, rng, enc.rebuttalChoices).id);
      return;
    }
    if (enc.step === 'respond') {
      const key = `boss-${enc.index}`;
      if (key !== bot.encKey) {
        bot.encKey = key;
        bot.encWait = profile.react + 1;
      }
      bot.encWait -= step;
      if (bot.encWait <= 0) game.respond(pickResponse(enc, profile.answerSkill, rng).id);
      return;
    }
    bot.answerWait = game.cool.answer <= 0 ? bot.answerWait + step : 0;
    if (bot.answerWait >= profile.react && game.castAnswer()) bot.answerWait = 0;
    if (profile.words !== 'none') {
      const verse = pickPassage(game, enc, profile.words === 'fit' ? 1 : 0, rng, { needReady: true });
      bot.wordWait = verse && game.cool.shared <= 0 ? bot.wordWait + step : 0;
      if (verse && bot.wordWait >= profile.react && game.castWord(verse)) bot.wordWait = 0;
    }
  };

  /** Whether the bot proclaims WORD on the street now. */
  bot.shouldProclaim = (targets, window) => {
    if (profile.wordPolicy === 'none' || !game.wordReady || !targets) return false;
    if (bot.wordSince === null) bot.wordSince = game.time;
    const waited = game.time - bot.wordSince;
    if (waited < profile.react) return false;
    if (profile.wordPolicy === 'soon') return true;
    if (window) return targets >= 3 || waited > 4;
    const firm = game.street.standFirm;
    const need = firm ? Math.max(2, profile.holdTargets - 2) : profile.holdTargets;
    // Read the street: a decent crowd that is at its fullest and starting to thin is the moment to cash out.
    if (profile.readCrest && targets >= Math.max(5, need - 1) && game.crowdOutlook.leaving >= 1 && game.isCrest(targets)) return true;
    const talkerNear = game.crowd.specials.length > 0 && !game.enc;
    if (talkerNear && targets < profile.holdTargets + 2 && waited < profile.holdMax + 4) return false;
    return targets >= need || waited >= profile.holdMax;
  };

  bot.street = (step, t, window) => {
    const open = game.crowd.openPeds();
    if (game.wordReady) {
      if (bot.shouldProclaim(open.length, window)) {
        game.proclaimStreet();
        bot.wordSince = null;
        return;
      }
    } else bot.wordSince = null;
    if (window && !bot.windowUse) return;
    // While holding a ready WORD for a fuller street, keep the streak alive without using everyone up.
    const holding = profile.wordPolicy === 'hold' && game.wordReady && !window;
    const rate = (window ? profile.bossRate : profile.engageRate) * (holding ? 0.35 : 1);
    bot.tapAcc = Math.min(2, bot.tapAcc + rate * step);
    while (bot.tapAcc >= 1) {
      bot.tapAcc -= 1;
      if (rng() > profile.accuracy) {
        game.missTap();
        continue;
      }
      const pool = game.crowd.openPeds();
      if (pool.length) game.engageCrowd(pool[Math.floor(rng() * pool.length)].id);
    }
  };
  return bot;
}

export function runSimulation(profileName = 'hybrid', seed = 'sim-1', { maxMinutes = 90, step = 0.1, balance = BALANCE, log = false, profileOverride = {} } = {}) {
  const bot = createBot(profileName, seed, { balance, profileOverride });
  const { game } = bot;
  const marks = {};
  const mark = (key, t) => {
    if (marks[key] === undefined) marks[key] = Math.round(t);
  };
  const timeline = [];
  const seedsAt = {};
  const gen = () => game.state.gen;

  for (let t = 0; t < maxMinutes * 60; t += step) {
    bot.step(t, step);
    const g = gen();
    for (const m of [10, 15, 20]) if (seedsAt[m] === undefined && t >= m * 60) seedsAt[m] = Math.round(g.totalSeeds);
    if (g.ministries.tracts.owned > 0) mark('firstPurchase', t);
    for (const id of MINISTRY_IDS) if (g.ministries[id].owned > 0) mark(`own_${id}`, t);
    if (g.fundsUnlocked) mark('funds', t);
    for (const n of [1, 2, 3, 4]) if (g.clustersUnlocked.includes(n)) mark(`cluster${n}`, t);
    if (g.disciples.some((d) => d.status === 'trained')) mark('firstDisciple', t);
    if (g.conversionState.converts.length > 0) mark('firstConversion', t);
    if (g.encounterStats.specialsCompleted > 0) mark('firstSpecial', t);
    if (g.encounterStats.standFirms > 0) mark('firstStandFirm', t);
    if (g.encounterStats.wordUses > 0) mark('firstWord', t);
    if (g.scripturesUnlocked.length > 0) mark('firstScripture', t);
    if (g.bossState.status !== 'locked') mark('bossAvailable', t);
    if (g.bossState.attempts > 0) mark('bossFirstAttempt', t);
    if (game.state.phase !== 'gen1') {
      mark('complete', t);
      break;
    }
    if (log && Math.floor(t) % 60 === 0 && Math.abs(t - Math.round(t)) < step / 2) {
      timeline.push({ min: Math.round(t / 60), seeds: Math.round(g.totalSeeds), sps: Math.round(game.seedsPerSec) });
    }
  }

  const g = gen();
  const stats = g.encounterStats;
  return {
    profile: profileName,
    seed,
    finished: game.state.phase !== 'gen1',
    completeMinutes: marks.complete !== undefined ? +(marks.complete / 60).toFixed(1) : null,
    marks,
    bossAttempts: g.bossState.attempts,
    conversions: g.conversionState.converts.length,
    conversations: stats.specialsCompleted,
    specialsMissed: stats.specialsMissed,
    engagements: stats.engagements,
    standFirms: stats.standFirms,
    bestStreak: stats.bestStreak,
    wordUses: stats.wordUses,
    wordTargets: stats.wordTargets,
    wordBest: stats.wordBest,
    avgWordTargets: stats.wordUses ? +(stats.wordTargets / stats.wordUses).toFixed(1) : 0,
    totalSeeds: Math.round(g.totalSeeds),
    seedsAt,
    shares: { passive: Math.max(0, g.totalSeeds - stats.wordSeeds - stats.tapSeeds - stats.talkSeeds), word: stats.wordSeeds, taps: stats.tapSeeds, talk: stats.talkSeeds },
    seedsPerSec: Math.round(seedsPerSecond(game.state)),
    trainedDisciples: g.disciples.filter((d) => d.status === 'trained').length,
    faithfulness: game.state.prestige.summary?.breakdown.total ?? null,
    timeline,
  };
}

/** Play until the Professor becomes available (no attempt), returning the live game for analysis. */
export function runUntilBossAvailable(profileName = 'hybrid', seed = 'sim-1', { maxMinutes = 90, balance = BALANCE } = {}) {
  const bot = createBot(profileName, seed, { balance, profileOverride: { bossPrep: 1e9 } });
  for (let t = 0; t < maxMinutes * 60; t += 0.1) {
    bot.step(t, 0.1);
    if (bot.game.state.gen.bossState.status === 'available') return bot.game;
  }
  return bot.game;
}
