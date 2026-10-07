import { BALANCE } from '../config/balance.js';
import { newSeedString } from './rng.js';

export const MINISTRY_IDS = ['tracts', 'bibles', 'streetTeam', 'bibleStudy', 'discipleship'];

export function createGenerationState() {
  return {
    seeds: 0,
    funds: 0,
    totalSeeds: 0,
    totalFunds: 0,
    genSeconds: 0,
    ministries: Object.fromEntries(MINISTRY_IDS.map((id) => [id, { owned: 0 }])),
    upgrades: {},
    scripturesUnlocked: [],
    fundsUnlocked: false,
    clustersUnlocked: [],
    disciples: BALANCE.disciples.list.map((d) => ({ id: d.id, status: 'hidden', assigned: null })),
    encounterStats: {
      engaged: 0,
      completed: 0,
      activeCompleted: 0,
      scripturesProclaimed: 0,
      answersGiven: 0,
      specialsMet: 0,
      specialsCompleted: 0,
      specialsMissed: 0,
      crits: 0,
      walkedOn: 0,
      engagements: 0, // street engagements (tapped passersby)
      bestStreak: 0,
      standFirms: 0,
      attention: 0, // crowd engagements during the Professor's attention windows
      wordUses: 0, // times WORD was proclaimed to the street
      wordTargets: 0, // people reached by WORD on the street
      wordBest: 0, // most people reached by a single WORD
      wordSeeds: 0, // Seeds from street WORD / street taps / conversations (balance reporting only)
      tapSeeds: 0,
      talkSeeds: 0,
      automated: 0, // learned conversations a disciple carried
      harvested: 0, // learned conversations gathered with a tap
      wordBystanders: 0, // people who heard a proclamation without being open to a moment
    },
    encounterIndex: 0,
    people: [], // every conversation: who, how it went (for the end-of-generation recap)
    regularSerial: {}, // which person is the 'regular' of each kind (changes after someone comes to Christ)
    practice: {}, // per situation: how many times you have talked it through and the best quality reached ({ tries, best })
    lastVariant: {}, // the situation each kind of person last brought (so it is not the same one again)
    mastery: {}, // conversations learned (archetype:variant -> true): the strongest response, then a line aimed at what was raised
    memory: {}, // how the last conversation with each kind of person went ('good' | 'poor'): they remember you
    specialIndex: 0,
    eventIndex: 0,
    // Street rhythm: Active Witness streak (decays), Momentum meter, the earned Stand Firm state, and WORD readiness.
    street: { streak: 0, idle: 0, momentum: 0, momentumIdle: 0, standFirmLeft: 0, word: 0 },
    conversionState: { contacts: 0, converts: [], lastConversionIndex: -1000 },
    bossState: { buzz: 0, status: 'locked', attempts: 0, defeated: false, rewarded: false, foreshadowStage: 0, cooldownUntil: 0, bestPhase: 0, lastDebrief: null },
    milestones: {},
    seenHints: {},
  };
}

export function createInitialState(now = Date.now(), seed = newSeedString()) {
  return {
    version: BALANCE.saveVersion,
    createdAt: now,
    lastSavedAt: now,
    rngSeed: seed,
    generation: 1,
    phase: 'gen1', // gen1 | complete | gen2preview
    debugUsed: false,
    introSeen: false,
    gen: createGenerationState(),
    currencies: { faithfulness: 0 },
    prestige: {
      completedGenerations: 0,
      nodes: {},
      awardedFor: {},
      lastAward: null,
      summary: null,
      legacy: { disciples: [], converts: [] },
    },
    lifetime: { playSeconds: 0, offlineSecondsCredited: 0 },
    settings: { music: true, sfx: true, musicVolume: 0.5, sfxVolume: 0.7, muted: false, reducedMotion: 'auto', hints: true },
  };
}

export function totalMinistryLevels(gen) {
  let n = 0;
  for (const id of MINISTRY_IDS) n += gen.ministries[id]?.owned || 0;
  return n;
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
