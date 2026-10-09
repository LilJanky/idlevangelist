// Central balance configuration. Every tunable economy/pacing value lives here.
// Seeds are mundane "faithful witness" progress; Provisions (internally `funds`) are material supplies; Faithfulness is the
// prestige currency and can only be earned through generation milestones (never bought).

export const BALANCE = {
  saveVersion: 1,

  sim: {
    maxFrameDt: 0.25, // clamp for a single frame delta (seconds)
    maxCatchUpSeconds: 3, // anything longer than this per frame is treated as a pause, not simulated
  },

  // "Witness power": the base weight behind Answers and Scripture in a conversation.
  proclaim: {
    baseImpact: 10,
    critChance: 0.08,
    critMult: 2.0,
    critChanceCap: 0.6,
    impactPerMinistryLevel: 0.03, // "open hearing": an established ministry lends weight to a conversation
  },

  // Street gameplay: tap people with an opportunity marker as they pass. Reward = seconds of passive production
  // (with a floor so the first minutes work), multiplied by the Active Witness streak.
  street: {
    engageSeconds: [0.45, 0.9],
    rewardFloor: [3, 5, 12, 28, 65], // per resistance tier
    streakTiers: [
      { at: 0, mult: 1.0 },
      { at: 4, mult: 1.2 },
      { at: 8, mult: 1.5 },
      { at: 14, mult: 2.0 },
    ],
    // Every Nth successive engagement pays a small chain bonus (a fraction of that tap, growing with the chain up to maxSteps), so a held run feels like it is building.
    chain: { every: 5, fraction: 0.2, maxSteps: 2 },
    streakWindow: 2.4, // seconds between engagements before the streak starts to fade...
    streakWindowHeat: 0.5, // ...shrinking by up to this much as the run grows (a hot run needs a quicker pace)...
    streakHeatAt: 80, // ...fully at a run of this many
    streakDecayPerSecond: 1.5,
    streakDrainFraction: 0.12, // once it fades, a long run drains faster: max(streakDecayPerSecond, run x this) per second
    // Tapping where no one is open to a moment (once the run is worth protecting) costs part of it, so a run is kept by being on target.
    conversationStreakBonus: 2,
    minEngageGap: 0.08, // anti-macro guard (seconds)
    hitRadiusPx: 48,
    momentum: {
      max: 100,
      perEngage: 1.6,
      perStreakTier: 0.8,
      perAnswer: 7,
      perWord: 5,
      perFitWord: 11,
      perConversation: 8,
      decayPerSecond: 3,
      decayDelay: 3,
    },
    // WORD: Scripture proclaimed to everyone currently open to a moment. Readiness is earned by working the street (it never
    // decays and there is no timer). It only ever fills while not full, so holding a full WORD costs the readiness you
    // would have earned: waiting for a fuller street is a real, optional decision. It is not a resource to buy.
    word: {
      max: 100,
      perEngage: 2.0, // readiness per street engagement
      passivePerSecond: 100 / 300, // ...and slowly on its own (full in 5 minutes), so a check-in now and then finds WORD ready. Also earned while away.
      perStreakTier: 0.6, // extra per streak tier held when you engage
      perEncounter: 14, // completing a conversation with someone who wanted to talk
      standFirmMult: 1.5, // readiness comes faster while standing firm
      rewardMult: 2.1, // each reached person is worth this many ordinary engagements
      // A fuller street makes WORD carry further for *every* person who hears it, so the payoff grows faster than the crowd does:
      // total = people x multiplier. The multiplier ramps between these points and each named step is announced, so waiting for a
      // bigger street (a bus, a lunch rush, Stand Firm) is a goal you can see. Upgrades (`wordCrowd`) add to it per person.
      crowdCurve: [
        { at: 1, mult: 1.0 },
        { at: 3, mult: 1.25, name: 'A small gathering' },
        { at: 5, mult: 1.6, name: 'A crowd' },
        { at: 7, mult: 2.0, name: 'A full street' },
        { at: 10, mult: 2.8, name: 'A throng' },
        { at: 14, mult: 3.4 },
      ],
      bystanderMult: 0.2, // people on the street who are not open to a moment still hear it, at this share of what an open person is paid
      leavingSeconds: 2.5, // an open moment with less than this left (or about to walk off screen) is "leaving": the cost of holding WORD
      crestBonus: 0.2, // proclaiming when the street is at its fullest this hold (and decent in size) pays this much more per person
      crestMinPeople: 5,
      crowdUpgradeMaxPeople: 9, // wordCrowd upgrades stop adding beyond this many people
      streakGain: 2, // proclaiming holds your Active Witness streak
      momentumBase: 6,
      momentumPerTarget: 1.5,
      readyWindowMult: 1.5, // the streak holds longer while WORD is ready, so waiting for the crowd is forgiving
      readyPaceMult: 0.7, // ...and people walk a little slower, so a fuller street is there to be reached
      readyHoldMult: 0.4, // open moments linger (decay at this rate) while WORD is ready, so a fuller street can build
      engageSeconds: 0.75, // fixed (no variance) so the total is predictable
      encounterBonus: 1.25, // arriving at a conversation with WORD ready: the passage carries fuller weight
    },
    // "Stand Firm": a short earned power state. Purely a pacing/excitement spike; it never touches conversion.
    standFirm: { minSeconds: 150, seconds: 8, rewardMult: 1.5, windowMult: 1.6, opportunityMult: 1.8, cooldownSpeed: 2, critBonus: 0.15 },
  },

  encounter: {
    // Resistance tier follows total Seeds planted this generation (progress, not wall-clock).
    tiers: [
      { minSeeds: 0, resistance: [35, 80], rewardFloor: 7 },
      { minSeeds: 1500, resistance: [70, 170], rewardFloor: 14 },
      { minSeeds: 30000, resistance: [120, 400], rewardFloor: 35 },
      { minSeeds: 400000, resistance: [300, 800], rewardFloor: 90 },
      { minSeeds: 2000000, resistance: [500, 1500], rewardFloor: 220 },
    ],
    focusEnter: 0.55,
    outcomeHold: 4.2,
    focusExit: 0.45,
    walkOnSeconds: 45, // someone left waiting simply walks on (no penalty)
  },

  support: {
    // Disciples/helpers join the conversation automatically (automation of the active layer).
    impactPerSecondPerDisciple: 3.5,
    scalesWithHearing: true,
  },

  scripture: {
    sharedGap: 1.2, // global gap between Word applications in the Professor's exchange
    // How directly a passage applies to what was raised (all Scripture is true; this is application, never truth).
    // `value` feeds the quality of a conversation; `mult` is the weight of a Word in the Professor's exchange.
    application: {
      direct: { value: 1.0, mult: 1.8 },
      contextual: { value: 0.7, mult: 1.4 },
      relevant: { value: 0.5, mult: 1.15 },
      proclaimed: { value: 0.35, mult: 1.0 },
    },
    // How well a response answered the issue raised.
    approach: {
      strong: { value: 1.0, mult: 1.0 },
      partial: { value: 0.6, mult: 0.72 },
      weak: { value: 0.25, mult: 0.5 },
    },
    answer: { impactMult: 3.96, cooldown: 4 }, // pressing the point once an approach is chosen (Professor's exchange)
    contextualCooldownMult: 0.75,
    verses: {
      // Unlock text lives in content.js. Every passage is usable on the street (as part of WORD) and in conversations.
      romans1_20: { mult: 4.0, cooldown: 12, unlock: { any: [{ ministry: 'tracts', owned: 3 }, { ministry: 'bibles', owned: 1 }] } },
      proverbs30_5: { mult: 4.0, cooldown: 12, unlock: { any: [{ totalSeeds: 12000 }, { ministry: 'bibles', owned: 5 }] } },
      john14_6: { mult: 4.0, cooldown: 12, unlock: { any: [{ specials: 1 }, { totalSeeds: 40000 }] } },
      romans3_23: { mult: 5.0, cooldown: 13, unlock: { any: [{ totalSeeds: 8000 }, { ministry: 'streetTeam', owned: 1 }] } },
      acts17_30: { mult: 5.5, cooldown: 14, lateTierBonus: 1.35, unlock: { any: [{ ministry: 'bibleStudy', owned: 1 }] } },
      first_cor3_6: { mult: 4.0, cooldown: 12, unlock: { any: [{ conversions: 1 }, { ministry: 'bibleStudy', owned: 4 }] } },
    },
    bossPhaseBonus: { seconds: 8, impactPct: 0.25 },
  },

  // Passive ministries. Costs: baseCost * costRatio^owned. Production per owned unit per second.
  ministryCostRatio: 1.15,
  ministries: {
    tracts: { baseCost: 50, baseProduction: 1, unlockSeeds: 0, unlockSeconds: 0 },
    bibles: { baseCost: 320, baseProduction: 4, unlockSeeds: 200, unlockSeconds: 150 },
    streetTeam: { baseCost: 2300, baseProduction: 14, unlockSeeds: 1500, unlockSeconds: 400 },
    bibleStudy: { baseCost: 13000, baseProduction: 45, unlockSeeds: 8000, unlockSeconds: 780 },
    discipleship: { baseCost: 71000, baseProduction: 135, unlockSeeds: 40000, unlockSeconds: 1140 },
  },
  // Owning more of a ministry doubles it again at each step (the classic milestone ladder: generators stay worth buying).
  ministryMilestones: [
    { owned: 25, mult: 2 },
    { owned: 50, mult: 2 },
    { owned: 100, mult: 2 },
  ],
  // Passive production is announced in cycles: every N seconds each ministry reports what it just produced
  // (the Seeds themselves accrue continuously; the cycle only decides when the number is shown).
  ministryCycleSeconds: { tracts: 2, bibles: 3, streetTeam: 4, bibleStudy: 5, discipleship: 6 },
  // Owned counts at which a ministry visibly grows in the street scene (and earns a milestone notice).
  visualMilestones: [1, 5, 10, 25],

  funds: {
    unlockSeeds: 12000, // introduced after the player understands Seeds (~min 7-10)
    unlockSeconds: 420,
    basePerSecond: 0.3,
    perSeedPerSecond: 0.0025, // stewardship/support ticker scales gently with ministry
  },

  disciples: {
    lineBoost: 0.5, // assigned disciple boosts that ministry's production
    list: [
      { id: 'ruth', unlock: { ministry: 'streetTeam', owned: 1 }, cost: 1400 },
      { id: 'tomas', unlock: { ministry: 'bibleStudy', owned: 1 }, cost: 5200 },
      { id: 'hannah', unlock: { ministry: 'discipleship', owned: 1 }, cost: 20000 },
      { id: 'elias', unlock: { ministry: 'discipleship', owned: 4 }, cost: 55000 },
    ],
  },

  // People who stop to talk: the five archetypes in content.js. They are the only conversations on the street.
  specials: {
    unlockSeeds: 2500,
    unlockGenSeconds: 180, // both must be met: the first person who wants to talk appears around minute 3-5
    interval: [32, 52],
    lifetime: 6.0,
    rewardSeconds: [45, 75], // seconds of current passive production, scaled by how well the exchange went
    rewardFloor: 60,
    funds: [30, 70],
    hitRadiusPx: 46,
    // Quality of an exchange = answerWeight * response + (1 - answerWeight) * Scripture application (0 if no passage).
    answerWeight: 0.5,
    qualityReward: [0.6, 1.4], // reward multiplier at quality 0 -> 1
    momentum: [6, 24], // Momentum gained at quality 0 -> 1
    familiarAfter: 2, // conversations about the same situation that fell short of the best path, after which it is simply gathered (like a learned one, at the best quality reached)
    // Reactions follow how well the exchange went: only a fully fitting exchange earns the warmest one.
    reactionBands: { high: 0.95, mid: 0.5, remembered: 0.75 }, // `remembered`: the exchange they will say they thought about
  },

  // A conversation you have learned (the strongest response, then a line aimed at what was raised) can be carried by a trained
  // disciple. It never happens offline or during the Professor, you can always take it yourself first, and it pays less than a
  // conversation you have yourself (no streak, Momentum or WORD readiness). Conversion stays hidden and independent of all of it.
  automation: {
    delay: 3.5, // seconds after the person appears before a disciple steps in (tap them before then to talk yourself)
    rewardMult: 0.6, // of a perfect exchange's Seeds and Funds
  },

  // Street happenings: now and then something brings people to the street. Each kind has its own shape and asks something different
  // of the player (see shapes). None of it touches conversion (hidden and independent) and none of it needs a conversation or the
  // Professor's exchange: events wait while either is happening.
  crowdEvents: {
    first: 90, // seconds of street play before the first
    interval: [55, 85],
    kinds: ['bus', 'lunch', 'school', 'rain', 'church'],
    foreshadowBonus: 2, // extra people per gathering while the lecture is being talked about
    shapes: {
      // A pack: everyone steps off together and lingers on one side. The moment to hold the Word for.
      bus: { shape: 'pack', size: [6, 8], life: [12, 15], speedMult: 1 },
      // A stream: people arrive one after another from both sides, each open only briefly. The moment to tap, and your run holds longer.
      lunch: { shape: 'stream', size: [9, 11], life: [5, 6.5], gap: [1.0, 1.6], speedMult: 1.0, windowMult: 1.5 },
      // A rush: two fast waves, one from each side, each with short windows. The moment for quick fingers.
      school: { shape: 'rush', size: [8, 10], life: [4, 5], waves: 2, waveGap: 3.5, speedMult: 1.8 },
      // Lingering: a few people spread across the street with all the time in the world, and someone who wants to talk soon follows.
      rain: { shape: 'linger', size: [4, 5], life: [16, 20], spread: [0.28, 0.88], talkIn: 5 },
      // Friends from a nearby church stop to encourage you: nobody to tap, but your Momentum jumps and the Word is closer.
      church: { shape: 'friends', size: [3, 3], stay: 14, momentum: 40, word: 0.15 },
    },
  },

  // The day moves on: the street changes character every so often (names and kinds in content.js).
  chapterSeconds: [0, 420, 840, 1260],

  crowd: {
    cap: 14,
    maxCapBonus: 3, // how many more people the street can hold by the end of a run (see Game.crowdCapBonus)
    spawnInterval: [0.55, 1.1],
    speed: [10, 20], // % of scene width per second x 0.01 (normalized units/sec * 100)
    gatherCapBonus: 2,
    maxHold: 5.5, // seconds an arriving gathering (bus, rain) stands before drifting on, however long their moment lasts
    queueGap: 0.075, // a walker will not close in on a slower walker ahead of them in the same lane (a sprite is about 0.1 of the width)
    opportunityChance: 0.6, // share of passersby who are open to a brief engagement
    opportunityLife: [4, 7], // seconds a marker stays on someone
  },

  // Upgrade unlock clusters are time-or-progress based so slower players are never stuck.
  clusters: {
    1: { totalSeeds: 12000, genSeconds: 300 },
    2: { totalSeeds: 650000, genSeconds: 720 },
    3: { totalSeeds: 4800000, genSeconds: 1080 },
    4: { totalSeeds: 12000000, genSeconds: 1230 },
  },

  // Effects are summed (percentages are additive within a key, then multiplied across keys).
  // Design notes (see tools/upgrade-analysis.js): costs grow faster than income per cluster so you cannot buy everything before the
  // Professor (order and forks are decisions); every upgrade should be worth roughly 5% or more of what it touches; forks
  // (`exclusiveWith`) split active and passive paths; `requires` ties an upgrade to a ministry you own; synergies reward breadth.
  upgrades: {
    // ---- Cluster 1: the first season on the street
    persistence: { cluster: 1, cost: 2500, currency: 'seeds', tag: 'active', effects: { rewardPct: 0.1 } },
    faithfulHands: { cluster: 1, cost: 3500, currency: 'seeds', tag: 'ministry', effects: { passivePct: 0.15 } },
    swordOfTheSpirit: { cluster: 1, cost: 4000, currency: 'seeds', tag: 'scripture', effects: { wordPct: 0.45 } },
    openHands: { cluster: 1, cost: 6000, currency: 'seeds', tag: 'active', effects: { wordCharge: 0.3 } },
    courage: { cluster: 1, cost: 9000, currency: 'seeds', tag: 'active', effects: { critChance: 0.08, rewardPct: 0.05 } },
    handsOnTeam: { cluster: 1, requires: { ministry: 'streetTeam', owned: 1 }, cost: 20000, currency: 'seeds', tag: 'ministry', effects: { synergy: [{ from: 'tracts', to: 'streetTeam', per: 0.008 }] } },

    // ---- Cluster 2: a fork between the street and the routine
    streetPreacher: { cluster: 2, cost: 60000, currency: 'seeds', tag: 'active', exclusiveWith: 'faithfulRoutine', effects: { wordCrowd: 0.08, wordCharge: 0.2, rewardPct: 0.1 } },
    faithfulRoutine: { cluster: 2, cost: 60000, currency: 'seeds', tag: 'ministry', exclusiveWith: 'streetPreacher', effects: { passivePct: 0.35 } },
    openDoor: { cluster: 2, cost: 80000, currency: 'seeds', tag: 'ministry', effects: { cadencePct: 0.15 } },
    goodStewardship: { cluster: 2, cost: 110000, currency: 'seeds', tag: 'ministry', effects: { costDiscount: 0.15 } },
    trainOthers: { cluster: 2, cost: 100000, currency: 'seeds', tag: 'ministry', effects: { discipleLinePct: 0.3 } },
    studyLibrary: { cluster: 2, requires: { ministry: 'bibleStudy', owned: 1 }, cost: 120000, currency: 'seeds', tag: 'ministry', effects: { synergy: [{ from: 'bibles', to: 'bibleStudy', per: 0.01 }] } },
    conviction: { cluster: 2, cost: 50000, currency: 'seeds', tag: 'active', effects: { critMult: 1 } },
    watchfulEye: { cluster: 2, cost: 40000, currency: 'seeds', tag: 'scripture', effects: { specialWindow: 4, oppLifeAdd: 0.5 } },
    clearVoice: { cluster: 2, cost: 45000, currency: 'seeds', tag: 'professor', effects: { proclaimPct: 0.3 } },

    // ---- Cluster 3: what you invest in as the lecture draws near
    hospitality: { cluster: 3, cost: 380000, currency: 'seeds', tag: 'active', exclusiveWith: 'multiplication', effects: { talkPct: 0.75, specialWindow: 1.5 } },
    multiplication: { cluster: 3, cost: 380000, currency: 'seeds', tag: 'ministry', exclusiveWith: 'hospitality', effects: { passivePct: 0.2, discipleLinePct: 0.4, costDiscount: 0.05 } },
    endurance: { cluster: 3, cost: 280000, currency: 'seeds', tag: 'active', effects: { streakWindowAdd: 1.5, streakBonus: 0.25 } },
    mentorship: { cluster: 3, requires: { ministry: 'discipleship', owned: 1 }, cost: 560000, currency: 'seeds', tag: 'ministry', effects: { synergy: [{ from: 'bibleStudy', to: 'discipleship', per: 0.02 }] } },
    entrustToFaithfulMen: { cluster: 3, requires: { ministry: 'discipleship', owned: 1 }, cost: 650000, currency: 'seeds', tag: 'ministry', effects: { lineMult: { discipleship: 0.5 } } },
    readyAnswer: { cluster: 3, cost: 320000, currency: 'seeds', tag: 'professor', effects: { answerCdPct: 0.15 } },
    preparedMind: { cluster: 3, cost: 410000, currency: 'seeds', tag: 'professor', effects: { contextualPct: 0.2 } },
    everyThought: { cluster: 3, cost: 480000, currency: 'seeds', tag: 'professor', effects: { bossPhaseBonus: 1 } },

    // ---- Cluster 4: the last fork before the Professor
    deepRoots: { cluster: 4, cost: 1200000, currency: 'seeds', tag: 'professor', exclusiveWith: 'broadReach', effects: { windowSecondsAdd: 4, windowBonus: 0.1 } },
    broadReach: { cluster: 4, cost: 1200000, currency: 'seeds', tag: 'active', exclusiveWith: 'deepRoots', effects: { eventSize: 3, eventLife: 3, wordCrowd: 0.04 } },
    ironSharpens: { cluster: 4, cost: 1600000, currency: 'seeds', tag: 'active', effects: { wordCharge: 0.25 } },
    fullBarns: { cluster: 4, cost: 2300000, currency: 'seeds', tag: 'ministry', effects: { passivePct: 0.25 } },

    // Funds purchases: strictly mundane/material supplies.
    literatureBundle: { cluster: 0, unlockFunds: true, cost: 300, currency: 'funds', tag: 'supplies', effects: { lineMult: { tracts: 0.5 } } },
    betterBibleSupply: { cluster: 0, unlockFunds: true, cost: 700, currency: 'funds', tag: 'supplies', effects: { lineMult: { bibles: 0.5 } } },
    rainGear: { cluster: 0, unlockFunds: true, cost: 800, currency: 'funds', tag: 'supplies', effects: { oppLifeAdd: 1 } },
    transportation: { cluster: 0, unlockFunds: true, cost: 1700, currency: 'funds', tag: 'supplies', effects: { lineMult: { streetTeam: 0.5 } } },
    portableMicrophone: { cluster: 0, unlockFunds: true, cost: 1800, currency: 'funds', tag: 'supplies', effects: { cadencePct: 0.1 } },
    foldingTables: { cluster: 0, unlockFunds: true, cost: 2200, currency: 'funds', tag: 'supplies', effects: { eventSize: 2 } },
    meetingSpace: { cluster: 0, unlockFunds: true, cost: 1300, currency: 'funds', tag: 'supplies', effects: { lineMult: { bibleStudy: 0.25, discipleship: 0.25 } } },
  },

  boss: {
    unlockSeconds: 1260, // the Professor's lecture: not before ~minute 21 (skill brings readiness closer to it)
    unlockSeeds: 1500000,
    requireMinistry: { id: 'discipleship', owned: 1 },
    foreshadowSeconds: 960,
    foreshadowSeeds: 500000,
    introSeconds: 3.0,
    victorySeconds: 4.6, // the celebration plays this long before the Seeds dialog (a tap skips ahead)
    transitionSeconds: 2.6,
    cooldownSeconds: 45, // the crowd needs time to gather again; retrying instantly is not the plan
    autoRespondSeconds: 8, // no line chosen: you press on with a measured answer rather than stalling
    buzzTarget: 80, // people reached while the lecture is foreshadowed...
    buzzMaxBonus: 0.15, // ...give the first argument a head start: the word got around
    windowSeconds: 12, // crowd attention window between arguments (fast street burst)
    windowRewardMult: 3, // each engagement during a window is worth more Seeds
    windowBonusPerEngage: 0.03, // each engagement weakens the next argument's Resistance by 3%...
    windowBonusMax: 0.3, // ...up to 30%
    // Halfway through an argument he answers back. Your reply decides how the rest goes: a strong one cuts what remains of his argument,
    // a middling one changes nothing, a weak one lets him press his advantage (he regains part of it). The clock keeps running.
    rebuttal: { at: 0.5, strongCut: 0.35, weakAdd: 0.08, autoSeconds: 10 },
    graceFraction: 0.12, // an argument that is almost answered when time runs out is conceded
    arguments: [
      { id: 'naturalism', resistance: 29000, seconds: 50, tags: ['naturalism', 'neutrality'] },
      { id: 'authority', resistance: 37500, seconds: 50, tags: ['scripture', 'authority'] },
      { id: 'autonomy', resistance: 46000, seconds: 50, tags: ['autonomy', 'authority'] },
    ],
    // Seconds of passive production granted on victory.
    rewardSeconds: 240,
    rewardFloor: 50000,
  },

  faithfulness: {
    base: 6,
    allMinistries: 2,
    disciples: { count: 2, bonus: 1 },
    boss: 2,
    activeMilestone: { engagements: 150, bonus: 1 }, // street engagements
    conversion: { count: 3, bonus: 1 }, // capped bonus; never required for the nominal 12
  },

  conversion: {
    // Hidden outcome logic. Never displayed. Outcomes derive from hash(seed, encounterIndex).
    baseChance: 0.09,
    minGapEncounters: 4,
    maxPerGeneration: 7,
    tierWeights: [0.4, 0.9, 1.0, 1.0, 1.05],
    contactRampPer50: 0.15,
  },

  offline: {
    fullRateHours: 8,
    reducedRate: 0.25,
    capHours: 24,
    minSecondsForSummary: 30,
  },

  autosaveSeconds: 15,

  prestige: {
    // After the first Next Generation the player may spend Faithfulness here.
    nodes: {
      steadfastWitness: { branch: 'word', tier: 1, cost: 3, effects: { proclaimPct: 0.1 } },
      rootedInTheWord: { branch: 'word', tier: 2, cost: 5, requires: 'steadfastWitness', effects: { wordPct: 0.15, contextualPct: 0.1 } },
      establishedLabor: { branch: 'work', tier: 1, cost: 3, effects: { passivePct: 0.1 } },
      willingHands: { branch: 'work', tier: 2, cost: 5, requires: 'establishedLabor', effects: { discipleLinePct: 0.2 } },
      faithfulInheritance: { branch: 'generations', tier: 1, cost: 3, effects: { startSeeds: 1000, startMinistry: { tracts: 5, bibles: 2 } } },
      passedOnWisdom: { branch: 'generations', tier: 2, cost: 5, requires: 'faithfulInheritance', effects: { startClusters: 1, offlineBonusPct: 0.1 } },
    },
  },
};
