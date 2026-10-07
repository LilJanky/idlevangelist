// Game: the simulation orchestrator. Owns runtime-only state (current conversation, cooldowns, boss session)
// and mutates the persistent state object. Contains no DOM/canvas code; the UI listens to events.
//
// Two layers of play:
//   * the STREET (fast): tap passersby who are open to a moment -> Seeds, Active Witness streak, Momentum, Stand Firm
//   * CONVERSATIONS (deliberate): a person who wants to talk stops with a real objection; choose how to respond, then
//     apply a passage of Scripture. WORD is the same idea in both layers: proclaim Scripture. On the street it reaches
//     everyone currently open to a moment; in a conversation it applies a passage to what was said.
// A conversation pauses the street and the street resumes afterwards. Passive ministries run continuously.
import { BALANCE } from '../config/balance.js';
import { createRng, rangeFrom, hashUnit } from '../core/rng.js';
import {
  computeModifiers, seedsPerSecond, fundsPerSecond, ministryCost, bulkCost, maxAffordable, lineProduction,
  lineProductionForOwned, critStats, totalSupportPerSecond, tierIndex, streakMultiplier, wordCrowdMultiplier, wordCrowdTier,
} from '../core/economy.js';
import { MINISTRY_IDS } from '../core/state.js';
import { crossedMilestone } from '../core/ministryVisuals.js';
import {
  SCRIPTURE_ORDER, TIMOTHY_TEXT, SCRIPTURES, PLAIN_LABELS, CHAPTERS,
} from '../data/content.js';
import { CrowdSystem } from './crowd.js';
import { StreetSystem } from './street.js';
import {
  makeSpecialEncounter, makeAutoEncounter, makeBossEncounter, encounterReward, bossReward, specialIdFor, pickReaction, chooseVariant, masteryKey, treatmentFor,
} from './encounter.js';
import {
  verseImpact, answerImpact, verseCooldown, answerCooldown, applicationGrade, applicationLabel, isFitting, 
} from './scripture.js';
import { rollConversion, recordContact, recordConversion } from './conversion.js';
import { unlockMet } from './unlocks.js';
import { completeGeneration, beginNextGeneration, buyNode, canBuyNode } from './prestige.js';
import { clampOfflineSeconds, computeOffline, applyOffline } from './offline.js';
import { bossReadiness, debriefTips, readinessLabel } from './bossAnalysis.js';

const CONVERSION_SECONDS = 5.2;
// Upgrade effects that change how strongly the player answers the Professor (so their cards show a readiness preview).
const PROFESSOR_KEYS = ['proclaimPct', 'wordPct', 'critChance', 'critMult', 'contextualPct', 'answerCdPct', 'bossPhaseBonus', 'discipleLinePct'];
const CONVERSION_SKIP_AFTER = 1.4;
const SPECIAL_OUTCOME_HOLD = 3.0;

export class Game {
  constructor({ state, balance = BALANCE, debug = false } = {}) {
    this.state = state;
    this.balance = balance;
    this.debug = debug;
    this.listeners = new Set();
    this.rng = createRng(`${state.rngSeed}:runtime`);
    this.crowd = new CrowdSystem(createRng(`${state.rngSeed}:crowd`), balance);
    this.street = new StreetSystem(this);
    this.enc = null;
    this.boss = null;
    this.cool = { words: {}, answer: 0, shared: 0 };
    this.buffs = { phase: 0 };
    this.wordAnnounced = false;
    this.specialTimer = -1;
    this.eventTimer = balance.crowdEvents.first;
    this.activeEvent = null; // a stream or a rush still arriving (runtime only)
    this.forceEventKind = null; // tests and debug tools
    this.chapterShown = this.chapterIndex;
    this.nextSpecialLife = null;
    this.wordCrest = 0; // the most people open at once during this hold of WORD (runtime only)
    this.convertTimer = 20;
    this.convertTicks = 0;
    this.unlockTimer = 0;
    this.debugMult = 1;
    this.time = 0;
    // Passive ministries announce what they produced every few seconds (display only; accrual is continuous).
    this.tickAcc = {};
    this.tickT = {};
    MINISTRY_IDS.forEach((id, i) => {
      this.tickAcc[id] = 0;
      this.tickT[id] = (balance.ministryCycleSeconds[id] * i) / MINISTRY_IDS.length;
    });
    this.checkUnlocks(true);
  }

  // ---- events -------------------------------------------------------------------------------------
  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, data = {}) {
    for (const fn of this.listeners) fn(type, data);
  }

  dirty(now = false) {
    this.emit('save', { now });
  }

  hint(id) {
    const seen = this.state.gen.seenHints;
    if (seen[id] || this.state.settings.hints === false) return;
    seen[id] = true;
    this.emit('hint', { id });
  }

  // ---- derived values -----------------------------------------------------------------------------
  get mods() {
    return computeModifiers(this.state, this.balance);
  }

  get passiveMultiplier() {
    return this.debugMult;
  }

  get seedsPerSec() {
    return seedsPerSecond(this.state, this.mods, this.passiveMultiplier, this.balance);
  }

  /** Passive production without temporary buffs: the stable number shown before/after purchases. */
  get baseSeedsPerSec() {
    return seedsPerSecond(this.state, this.mods, 1, this.balance);
  }

  get fundsPerSec() {
    return fundsPerSecond(this.state, this.mods, this.balance) * this.debugMult;
  }

  get activeEncounter() {
    return this.boss?.enc && this.boss.stage === 'argument' ? this.boss.enc : this.enc;
  }

  /** Which part of the day the street is in (changes how it feels and which gatherings happen). */
  get chapterIndex() {
    const secs = this.balance.chapterSeconds;
    let idx = 0;
    for (let i = 0; i < secs.length; i++) if (this.state.gen.genSeconds >= secs[i]) idx = i;
    return idx;
  }

  get chapter() {
    return { index: this.chapterIndex, ...CHAPTERS[this.chapterIndex] };
  }

  /** How long the crowd listens between the Professor's arguments. */
  get windowSeconds() {
    return this.balance.boss.windowSeconds + this.mods.windowSecondsAdd;
  }

  /** While the lecture is being talked about, everyone you reach helps a crowd gather for it. */
  addBuzz(n) {
    const bs = this.state.gen.bossState;
    if (bs.status === 'locked' && bs.foreshadowStage >= 1) bs.buzz = (bs.buzz || 0) + n;
  }

  lectureBonus() {
    const cfg = this.balance.boss;
    return Math.min(cfg.buzzMaxBonus, ((this.state.gen.bossState.buzz || 0) / cfg.buzzTarget) * cfg.buzzMaxBonus);
  }

  get inBoss() {
    return !!this.boss;
  }

  /** True while a conversation or boss argument has the player's attention; the street holds and resumes after. */
  get streetPaused() {
    if (this.boss) return this.boss.stage !== 'window';
    return !!this.enc && this.enc.state !== 'focusExit';
  }

  get streetOpen() {
    return this.state.phase === 'gen1' && !this.streetPaused;
  }

  isMinistryUnlocked(id) {
    const gen = this.state.gen;
    const def = this.balance.ministries[id];
    return gen.ministries[id].owned > 0 || (gen.totalSeeds >= def.unlockSeeds && gen.genSeconds >= def.unlockSeconds);
  }

  isVerseReady(id) {
    return (this.cool.words[id] || 0) <= 0 && this.cool.shared <= 0;
  }

  // ---- main loop ----------------------------------------------------------------------------------
  /** Advance by dt seconds (callers clamp). Passive economy is linear in dt so it is frame-rate independent. */
  tick(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, this.balance.sim.maxFrameDt);
    this.time += dt;
    const state = this.state;
    const gen = state.gen;
    const gameplay = state.phase === 'gen1';
    const paused = this.streetPaused;

    const conversionSlow = this.enc?.state === 'conversion' ? 0.22 : 1;
    this.crowd.update(dt, {
      gather: !!this.boss && this.boss.stage !== 'passed',
      speedScale: conversionSlow * (gameplay && this.wordReady ? this.balance.street.word.readyPaceMult : 1),
      capBonus: Math.min(6, Math.floor(gen.totalSeeds / 6000)),
      oppMult: gameplay ? this.street.opportunityMult : 1,
      oppDecay: gameplay && this.wordReady ? this.balance.street.word.readyHoldMult : 1,
      lifeAdd: gameplay ? this.mods.oppLifeAdd : 0,
      paused,
      markAll: this.boss?.stage === 'window',
    });
    if (this.crowd.missed > 0) {
      gen.encounterStats.specialsMissed += this.crowd.missed;
      this.emit('specialMissed', { count: this.crowd.missed });
      this.crowd.missed = 0;
    }
    if (!gameplay) return;

    gen.genSeconds += dt;
    state.lifetime.playSeconds += dt;

    const mods = this.mods;
    const sps = seedsPerSecond(state, mods, this.passiveMultiplier, this.balance);
    this.addSeeds(sps * dt);
    if (gen.fundsUnlocked) this.addFunds(this.fundsPerSec * dt);
    this.updateMinistryTicks(dt, mods);

    const coolDt = dt * this.street.cooldownSpeed;
    for (const k of Object.keys(this.cool.words)) this.cool.words[k] = Math.max(0, this.cool.words[k] - coolDt);
    this.cool.answer = Math.max(0, this.cool.answer - coolDt);
    this.cool.shared = Math.max(0, this.cool.shared - dt);
    this.buffs.phase = Math.max(0, this.buffs.phase - dt);
    this.street.tick(dt, paused);

    this.unlockTimer -= dt;
    if (this.unlockTimer <= 0) {
      this.unlockTimer = 0.4;
      this.checkUnlocks();
    }

    if (this.wordReady !== this.wordAnnounced) {
      this.wordAnnounced = this.wordReady;
      if (this.wordReady) {
        this.emit('wordReady');
        this.hint('wordReady');
      }
    }

    if (this.wordReady && this.streetOpen) this.wordCrest = Math.max(this.wordCrest, this.crowd.openPeds().length);
    else if (!this.wordReady) this.wordCrest = 0;
    this.updateChapter();
    this.updateSpecialSpawning(dt);
    this.updateAutomation();
    this.updateCrowdEvents(dt);
    this.updateConverts(dt);
    if (this.boss) this.updateBoss(dt, mods);
    else this.updateEncounter(dt);
  }

  /** Deterministic stepping helper for tests/sim/debug. */
  advance(seconds, step = 0.1) {
    let left = seconds;
    while (left > 1e-9) {
      const dt = Math.min(step, left);
      this.tick(dt);
      left -= dt;
    }
  }

  addSeeds(amount) {
    const gen = this.state.gen;
    gen.seeds += amount;
    gen.totalSeeds += amount;
  }

  addFunds(amount) {
    const gen = this.state.gen;
    gen.funds += amount;
    gen.totalFunds += amount;
  }

  updateMinistryTicks(dt, mods) {
    for (const id of MINISTRY_IDS) {
      if (this.state.gen.ministries[id].owned <= 0) {
        this.tickAcc[id] = 0;
        continue;
      }
      const production = lineProduction(this.state, id, mods, this.passiveMultiplier, this.balance);
      this.tickAcc[id] += production * dt;
      this.tickT[id] += dt;
      const cycle = this.balance.ministryCycleSeconds[id];
      if (this.tickT[id] >= cycle) {
        this.emit('ministryTick', { id, amount: this.tickAcc[id], production, cycle });
        this.tickAcc[id] = 0;
        this.tickT[id] = 0;
      }
    }
  }

  // ---- unlocks ------------------------------------------------------------------------------------
  checkUnlocks(silent = false) {
    const state = this.state;
    const gen = state.gen;
    const b = this.balance;
    const say = (type, data) => {
      if (!silent) this.emit(type, data);
    };
    const hint = (id) => {
      if (!silent) this.hint(id);
    };
    if (state.phase !== 'gen1') return;

    if (!gen.fundsUnlocked && gen.totalSeeds >= b.funds.unlockSeeds && gen.genSeconds >= b.funds.unlockSeconds) {
      gen.fundsUnlocked = true;
      say('fundsUnlocked');
      hint('funds');
    }
    if (gen.ministries.tracts.owned === 0 && gen.seeds >= b.ministries.tracts.baseCost) hint('firstPurchase');
    for (const id of MINISTRY_IDS) {
      if (!gen.milestones[`min_${id}`] && this.isMinistryUnlocked(id)) {
        gen.milestones[`min_${id}`] = true;
        if (id !== 'tracts') say('ministryUnlocked', { id });
      }
    }
    for (const id of SCRIPTURE_ORDER) {
      if (!gen.scripturesUnlocked.includes(id) && unlockMet(b.scripture.verses[id].unlock, state)) {
        gen.scripturesUnlocked.push(id);
        say('scriptureUnlocked', { id });
        hint('word');
      }
    }
    for (const n of [1, 2, 3, 4]) {
      const c = b.clusters[n];
      if (!gen.clustersUnlocked.includes(n) && (gen.totalSeeds >= c.totalSeeds || gen.genSeconds >= c.genSeconds)) {
        gen.clustersUnlocked.push(n);
        say('clusterUnlocked', { cluster: n });
      }
    }
    for (const d of gen.disciples) {
      const def = b.disciples.list.find((x) => x.id === d.id);
      if (d.status === 'hidden' && unlockMet(def.unlock, state)) {
        d.status = 'candidate';
        say('discipleCandidate', { id: d.id });
        hint('disciple');
      }
    }
    const boss = gen.bossState;
    if (boss.status === 'locked') {
      const ready = (secs, seeds) => gen.genSeconds >= secs && gen.totalSeeds >= seeds;
      const stage = ready((b.boss.foreshadowSeconds + b.boss.unlockSeconds) / 2, (b.boss.foreshadowSeeds + b.boss.unlockSeeds) / 2) ? 2 : ready(b.boss.foreshadowSeconds, b.boss.foreshadowSeeds) ? 1 : 0;
      if (stage > boss.foreshadowStage) {
        boss.foreshadowStage = stage;
        say('bossForeshadow', { stage });
      }
      const req = b.boss.requireMinistry;
      if (ready(b.boss.unlockSeconds, b.boss.unlockSeeds) && gen.ministries[req.id].owned >= req.owned) {
        boss.status = 'available';
        boss.foreshadowStage = 3;
        say('bossAvailable');
        hint('boss');
        this.dirty(true);
      }
    } else if (boss.status === 'cooldown' && gen.genSeconds >= boss.cooldownUntil) {
      boss.status = 'available';
      say('bossAvailable', { retry: true });
    }
  }

  // ---- WORD on the street -------------------------------------------------------------------------
  /** WORD is ready once the street has filled it and there is Scripture to proclaim. */
  get wordReady() {
    const gen = this.state.gen;
    return this.state.phase === 'gen1' && gen.scripturesUnlocked.length > 0 && gen.street.word >= this.balance.street.word.max;
  }

  /** 0..1 progress toward WORD. */
  get wordFraction() {
    return Math.min(1, this.state.gen.street.word / this.balance.street.word.max);
  }

  /** The Scripture read aloud on the street. It rotates; the passage has no special power of its own. */
  streetVerse() {
    const list = this.state.gen.scripturesUnlocked;
    return list.length ? list[this.state.gen.encounterStats.wordUses % list.length] : null;
  }

  /** Seconds left on someone's open moment at the street's current rates. */
  pedTimeLeft(p) {
    const w = this.balance.street.word;
    const ready = this.wordReady;
    return this.crowd.pedTimeLeft(p, { oppDecay: ready ? w.readyHoldMult : 1, speedScale: ready ? w.readyPaceMult : 1 });
  }

  /** How many are open now and how many of them are about to be gone: what holding WORD risks. */
  get crowdOutlook() {
    const open = this.crowd.openPeds();
    const limit = this.balance.street.word.leavingSeconds;
    return { open: open.length, leaving: open.filter((p) => this.pedTimeLeft(p) < limit).length };
  }

  /** Proclaiming when a decent crowd is at its fullest this hold and has begun to thin (someone is about to go) lands at the crest. */
  isCrest(n) {
    const w = this.balance.street.word;
    return n >= w.crestMinPeople && n >= this.wordCrest && this.crowdOutlook.leaving >= 1;
  }

  /** What a street WORD would pay for `n` people right now (shown to the player before they commit). */
  wordPayout(n = this.crowd.openPeds().length, bystanders = this.boss?.stage === 'window' ? 0 : this.crowd.bystanders().length) {
    const state = this.state;
    const bal = this.balance;
    const cfg = bal.street.word;
    const mods = this.mods;
    const window = this.boss?.stage === 'window';
    const streak = this.street.streakCount + cfg.streakGain;
    const tier = tierIndex(state.gen.totalSeeds, bal);
    const passive = seedsPerSecond(state, mods, 1, bal);
    const base = Math.max(bal.street.rewardFloor[tier], passive * cfg.engageSeconds);
    // In the Professor's attention window everyone is open, so a bigger crowd adds attention rather than a bigger payout.
    const crowdMult = window ? 1 : wordCrowdMultiplier(n, mods, bal);
    const crest = !window && this.isCrest(n);
    const perPerson = Math.max(1, Math.round(
      base * (1 + mods.rewardPct) * (1 + mods.wordPct) * streakMultiplier(streak, bal, mods.streakBonus) * (this.street.standFirm ? bal.street.standFirm.rewardMult : 1)
      * cfg.rewardMult * crowdMult * (crest ? 1 + cfg.crestBonus : 1),
    ));
    const bystanderEach = Math.max(1, Math.round(perPerson * cfg.bystanderMult));
    return { n, perPerson, bystanders, bystanderEach, total: perPerson * n + (bystanders ? bystanderEach * bystanders : 0), crowdMult, crest, streak, tier: window ? wordCrowdTier(0, bal) : wordCrowdTier(n, bal) };
  }

  /** Proclaim Scripture to everyone currently open to a moment (and on screen). */
  proclaimStreet() {
    if (!this.wordReady || this.streetPaused) return null;
    const targets = this.crowd.openPeds();
    const hearers = this.boss?.stage === 'window' ? [] : this.crowd.bystanders();
    if (!targets.length && !hearers.length) {
      this.emit('wordNoTarget');
      return null;
    }
    const state = this.state;
    const gen = state.gen;
    const cfg = this.balance.street.word;
    const window = this.boss?.stage === 'window';
    const verseId = this.streetVerse();
    const { perPerson, crowdMult, tier, crest, bystanderEach } = this.wordPayout(targets.length, hearers.length);
    this.street.addStreak(cfg.streakGain);
    const count = this.street.streakCount;
    gen.street.word = 0;
    this.wordCrest = 0;
    let total = 0;
    for (const ped of targets) {
      this.addSeeds(perPerson);
      total += perPerson;
      ped.opp = false;
      ped.done = true;
      ped.react = 0.7;
      this.emit('engage', {
        pedId: ped.id, x: ped.x, lane: ped.lane, seeds: perPerson, crit: false, streak: count, mult: this.street.multiplier,
        window, standFirm: this.street.standFirm, word: true, crowdTier: tier.index, crest,
      });
    }
    // Everyone else on the street hears it too, though they were not ready for a moment: a smaller share, once each.
    for (const ped of hearers) {
      this.addSeeds(bystanderEach);
      total += bystanderEach;
      ped.heard = true;
      ped.react = 0.7;
      this.emit('engage', { pedId: ped.id, x: ped.x, lane: ped.lane, seeds: bystanderEach, crit: false, streak: count, mult: 1, window, standFirm: this.street.standFirm, word: true, bystander: true });
    }
    const stats = gen.encounterStats;
    stats.engagements += targets.length;
    stats.wordUses += 1;
    stats.wordTargets += targets.length;
    stats.wordBystanders = (stats.wordBystanders || 0) + hearers.length;
    stats.wordSeeds += total;
    this.addBuzz(targets.length + hearers.length);
    stats.wordBest = Math.max(stats.wordBest, targets.length);
    if (window) {
      this.boss.attention += targets.length;
      this.boss.attentionTotal += targets.length;
      stats.attention += targets.length;
    }
    this.street.addMomentum(cfg.momentumBase + cfg.momentumPerTarget * targets.length, 'word');
    const result = {
      verseId, count: targets.length, bystanders: hearers.length, total, perPerson, crowdMult, crest, tier: tier.index, tierName: tier.name, streak: count, standFirm: this.street.standFirm, window,
    };
    this.emit('wordProclaimed', result);
    this.dirty();
    return result;
  }

  // ---- conversations: the people who stop to talk -------------------------------------------------
  updateSpecialSpawning(dt) {
    const gen = this.state.gen;
    const cfg = this.balance.specials;
    if (this.boss || this.enc) return;
    const enabled = gen.totalSeeds >= cfg.unlockSeeds && gen.genSeconds >= cfg.unlockGenSeconds;
    if (!enabled) return;
    if (this.specialTimer < 0) this.specialTimer = rangeFrom(this.rng, [6, 12]);
    this.specialTimer -= dt;
    if (this.specialTimer <= 0 && this.crowd.specials.length === 0) {
      const waiting = this.nextSpecialLife !== null; // someone who waited while you were away: never carried for you
      const life = (this.nextSpecialLife ?? cfg.lifetime) + this.mods.specialWindow;
      this.nextSpecialLife = null;
      const sp = this.spawnSpecial(life, { waiting });
      this.specialTimer = rangeFrom(this.rng, cfg.interval) * (1 - this.mods.cadencePct);
      this.emit('specialSpawn', { special: sp });
      this.hint('special');
    }
  }

  /** Someone who wants to talk walks in. If you have learned their kind of conversation, a helper may carry it (see updateAutomation). */
  spawnSpecial(life, { waiting = false, variant } = {}) {
    const gen = this.state.gen;
    const specialId = specialIdFor(this.state);
    gen.specialIndex += 1;
    const sp = this.crowd.spawnSpecial(specialId, life);
    sp.variant = variant ?? chooseVariant(this.state, specialId);
    if (!gen.lastVariant) gen.lastVariant = {};
    gen.lastVariant[specialId] = sp.variant;
    // A situation you know is not a conversation any more: a seed floats over them to gather, and a disciple may carry it.
    const treat = treatmentFor(this.state, specialId, sp.variant, this.balance);
    if (treat) {
      sp.treatment = treat.kind;
      sp.quality = treat.quality;
      this.hint('harvest');
      const helper = this.automationHelper();
      if (helper && !waiting) {
        sp.helper = helper;
        sp.autoAt = Math.min(this.balance.automation.delay, life * 0.6);
        this.hint('helper');
      }
    }
    return sp;
  }

  // ---- learned conversations ----------------------------------------------------------------------
  /** The first trained disciple: the helper who stands with you and can carry a conversation you have learned. */
  automationHelper() {
    return this.state.gen.disciples.find((d) => d.status === 'trained')?.id ?? null;
  }

  isMastered(specialId, variant) {
    return !!this.state.gen.mastery?.[masteryKey(specialId, variant)];
  }

  get learnedCount() {
    return Object.keys(this.state.gen.mastery || {}).length;
  }

  /** A disciple steps in when a learned conversation has waited past the delay and you have not taken it. */
  updateAutomation() {
    if (this.boss || this.enc || this.state.phase !== 'gen1') return;
    for (const sp of this.crowd.specials) {
      if (sp.autoAt === undefined || sp.engaged || sp.age < sp.autoAt) continue;
      this.automateConversation(sp);
      return;
    }
  }

  automateConversation(sp) {
    const stats = this.state.gen.encounterStats;
    sp.engaged = true; // leaves the street without counting as someone who was missed
    stats.specialsMet += 1;
    const enc = makeAutoEncounter(this.state, sp.specialId, sp.variant, this.balance, sp.quality ?? 1);
    enc.helper = sp.helper;
    enc.spX = sp.x;
    this.finishConversation(enc, { auto: true });
  }

  /** Tap the seed over someone whose situation you know: gather what it is worth, no conversation. */
  harvestConversation(sp) {
    sp.engaged = true;
    this.state.gen.encounterStats.specialsMet += 1;
    const enc = makeAutoEncounter(this.state, sp.specialId, sp.variant, this.balance, sp.quality ?? 1);
    enc.harvest = true;
    enc.spX = sp.x;
    this.finishConversation(enc, { harvest: true });
    return true;
  }

  /** People who came to Christ are part of the street now. Their moments are display only: nothing here earns Seeds. */
  updateConverts(dt) {
    const list = this.state.gen.conversionState.converts;
    if (!list.length) return;
    this.convertTimer -= dt;
    if (this.convertTimer > 0) return;
    this.convertTicks += 1;
    this.convertTimer = 24 + 14 * hashUnit(this.state.rngSeed, 'convert-timer', this.convertTicks);
    const index = Math.floor(hashUnit(this.state.rngSeed, 'convert-who', this.convertTicks) * Math.min(list.length, 5));
    const line = Math.floor(hashUnit(this.state.rngSeed, 'convert-line', this.convertTicks) * 3);
    this.emit('convertTick', { name: list[index].name, index, line });
  }

  updateChapter() {
    const idx = this.chapterIndex;
    if (idx > this.chapterShown) {
      this.chapterShown = idx;
      this.emit('chapter', this.chapter);
    }
  }

  /** The street's pace holds longer while a lunch crowd streams by: a run is easier to keep. */
  get eventWindowMult() {
    return this.activeEvent?.windowMult || 1;
  }

  /** Now and then something brings people to the street. Each kind has its own shape (see balance.crowdEvents.shapes). */
  updateCrowdEvents(dt) {
    if (this.boss || this.state.phase !== 'gen1') {
      this.activeEvent = null;
      return;
    }
    if (this.streetPaused) return;
    this.tickActiveEvent(dt);
    if (this.activeEvent) return;
    const cfg = this.balance.crowdEvents;
    this.eventTimer -= dt;
    if (this.eventTimer > 0) return;
    this.eventTimer = rangeFrom(this.rng, cfg.interval);
    const gen = this.state.gen;
    const kinds = CHAPTERS[this.chapterIndex].kinds;
    const kind = this.forceEventKind || kinds[Math.floor(hashUnit(this.state.rngSeed, 'event', gen.eventIndex || 0) * kinds.length)];
    gen.eventIndex = (gen.eventIndex || 0) + 1;
    this.startCrowdEvent(kind);
  }

  startCrowdEvent(kind) {
    const cfg = this.balance.crowdEvents;
    const shape = cfg.shapes[kind];
    if (!shape || this.state.phase !== 'gen1') return null;
    const gen = this.state.gen;
    const mods = this.mods;
    const lecture = gen.bossState.status === 'locked' && gen.bossState.foreshadowStage >= 1;
    const friends = shape.shape === 'friends';
    const count = friends ? shape.size[0] : Math.max(1, Math.round(rangeFrom(this.rng, shape.size)) + (lecture ? cfg.foreshadowBonus : 0) + mods.eventSize);
    const life = [(shape.life?.[0] ?? 0) + mods.eventLife, (shape.life?.[1] ?? 0) + mods.eventLife];
    const capBonus = Math.min(6, Math.floor(gen.totalSeeds / 6000));
    let arrived = { count: 0, side: 'left' };
    switch (shape.shape) {
      case 'pack':
        arrived = this.crowd.surge(count, life, capBonus, { speedMult: shape.speedMult, tag: kind });
        break;
      case 'linger':
        arrived = this.crowd.linger(count, life, shape.spread, capBonus, kind);
        break;
      case 'stream':
      case 'rush': {
        const schedule = [];
        const first = this.rng() < 0.5 ? 1 : -1;
        if (shape.shape === 'stream') {
          let at = 0;
          for (let i = 0; i < count; i++) {
            schedule.push({ at, side: i % 2 === 0 ? first : -first });
            at += rangeFrom(this.rng, shape.gap);
          }
        } else {
          const per = Math.ceil(count / shape.waves);
          for (let i = 0; i < count; i++) {
            const wave = Math.floor(i / per);
            schedule.push({ at: wave * shape.waveGap + (i % per) * 0.2, side: wave % 2 === 0 ? first : -first });
          }
        }
        this.activeEvent = { kind, shape, t: 0, next: 0, schedule, life, capBonus, windowMult: shape.windowMult || 1, endAt: schedule[schedule.length - 1].at + life[1] };
        arrived = { count, side: 'both' };
        break;
      }
      case 'friends':
        arrived = this.crowd.friends(count, shape.stay, kind);
        this.street.addMomentum(shape.momentum, 'friends');
        if (gen.scripturesUnlocked.length) this.street.gainWord(shape.word * this.balance.street.word.max, { steady: true });
        break;
      default:
        break;
    }
    if (shape.talkIn) this.callSomeoneSoon(shape.talkIn);
    if (arrived.count > 0) {
      this.emit('crowdEvent', { kind, shape: shape.shape, ...arrived });
      this.hint('crowdEvent');
    }
    return arrived;
  }

  /** A stream or rush keeps sending people in until its schedule is done. */
  tickActiveEvent(dt) {
    const ev = this.activeEvent;
    if (!ev) return;
    ev.t += dt;
    while (ev.next < ev.schedule.length && ev.schedule[ev.next].at <= ev.t) {
      const s = ev.schedule[ev.next++];
      this.crowd.arrive(s.side, ev.life, ev.capBonus, { speedMult: ev.shape.speedMult, tag: ev.kind });
    }
    if (ev.next >= ev.schedule.length && ev.t >= ev.endAt) this.activeEvent = null;
  }

  /** People linger when the rain eases, and someone who wants to talk is likelier to be among them soon. */
  callSomeoneSoon(seconds) {
    const gen = this.state.gen;
    const cfg = this.balance.specials;
    if (this.boss || this.enc || gen.totalSeeds < cfg.unlockSeeds || gen.genSeconds < cfg.unlockGenSeconds) return;
    if (this.crowd.specials.length === 0 && (this.specialTimer < 0 || this.specialTimer > seconds)) this.specialTimer = seconds;
  }

  updateEncounter(dt) {
    const enc = this.enc;
    if (!enc) return;
    const cfg = this.balance.encounter;
    enc.t += dt;
    switch (enc.state) {
      case 'focusEnter':
        if (enc.t >= cfg.focusEnter) {
          enc.state = 'active';
          enc.t = 0;
        }
        break;
      case 'active':
        enc.idle += dt;
        if (!enc.resolved && enc.idle >= cfg.walkOnSeconds) this.walkOn(enc);
        break;
      case 'outcome':
        if (enc.t >= (enc.hold ?? cfg.outcomeHold)) this.beginExit(enc);
        break;
      case 'conversion':
        if (enc.t >= CONVERSION_SECONDS) this.beginExit(enc);
        break;
      case 'focusExit':
        if (enc.t >= cfg.focusExit) {
          this.enc = null;
          this.emit('encounterEnd');
        }
        break;
      default:
        break;
    }
  }

  beginExit(enc) {
    enc.state = 'focusExit';
    enc.t = 0;
  }

  walkOn(enc) {
    // No punishment: the person simply continues on their way.
    this.state.gen.encounterStats.walkedOn += 1;
    enc.resolved = true;
    enc.walkedOn = true;
    this.state.gen.encounterIndex += 1;
    this.beginExit(enc);
    this.emit('walkedOn', { enc });
  }

  /** Skip presentation holds (conversion / outcome text). */
  skipPresentation() {
    const enc = this.enc;
    if (!enc) return;
    if (enc.state === 'conversion' && enc.t >= CONVERSION_SKIP_AFTER) this.beginExit(enc);
    else if (enc.state === 'outcome' && enc.t >= 0.8) this.beginExit(enc);
  }

  /** Argument Resistance (the Professor's exchange only): the weight of the argument still to be answered. */
  applyImpact(enc, amount, info) {
    if (enc.resolved || amount <= 0) return;
    enc.resistance = Math.max(0, enc.resistance - amount);
    this.emit('impact', { amount, ...info });
    this.checkResolved(enc);
  }

  checkResolved(enc) {
    if (enc.resolved || enc.resistance > 0 || enc.kind !== 'boss') return;
    enc.resolved = true; // guard against double resolution / duplicate rewards
    this.onBossPhaseCleared(enc);
  }

  /**
   * A conversation is complete: Seeds for the faithful exchange, then the person responds as they will.
   * `auto`: a disciple carried a situation you know. It pays less and adds no streak, Momentum or WORD readiness.
   * `harvest`: you tapped the seed over a situation you know: full pay for what you reached, no conversation, a little street momentum.
   * Neither shows an outcome card.
   */
  finishConversation(enc, { auto = false, harvest = false } = {}) {
    if (enc.resolved || enc.kind !== 'special') return;
    const state = this.state;
    const gen = state.gen;
    const stats = gen.encounterStats;
    const manual = !auto && !harvest;
    enc.resolved = true;
    enc.step = 'done';
    const reward = encounterReward(state, enc, this.balance);
    if (auto) {
      reward.seeds = Math.max(1, Math.round(reward.seeds * this.balance.automation.rewardMult));
      reward.funds = Math.round(reward.funds * this.balance.automation.rewardMult);
    }
    enc.rewarded = true;
    this.addSeeds(reward.seeds);
    stats.talkSeeds += reward.seeds;
    if (reward.funds) this.addFunds(reward.funds);
    stats.completed += 1;
    stats.specialsCompleted += 1;
    if (auto) stats.automated = (stats.automated || 0) + 1;
    if (harvest) stats.harvested = (stats.harvested || 0) + 1;
    if (!auto) {
      stats.activeCompleted += 1;
      const [mLo, mHi] = this.balance.specials.momentum;
      this.street.addStreak(this.balance.street.conversationStreakBonus);
      this.street.addMomentum(mLo + (mHi - mLo) * reward.quality, 'conversation');
      this.street.gainWord(this.balance.street.word.perEncounter * (harvest ? 0.5 : 1));
    }
    recordContact(state);
    if (!gen.memory) gen.memory = {};
    gen.memory[enc.archetypeId] = reward.quality >= this.balance.specials.reactionBands.remembered ? 'good' : 'poor';

    // Talking a situation through teaches you: the best path learns it; two tries that fall short make it familiar.
    const missed = [];
    if (manual) {
      if (enc.answer?.grade !== 'strong') missed.push('response');
      if (enc.scripture?.grade !== 'direct') missed.push('line');
      const key = masteryKey(enc.archetypeId, enc.variant);
      if (!gen.practice) gen.practice = {};
      const pr = (gen.practice[key] = gen.practice[key] || { tries: 0, best: 0 });
      pr.tries += 1;
      pr.best = Math.max(pr.best, reward.quality);
      if (!missed.length) {
        if (!gen.mastery) gen.mastery = {};
        if (!gen.mastery[key]) {
          gen.mastery[key] = true;
          enc.newlyLearned = true;
          this.emit('learned', { enc, key, count: this.learnedCount, helper: this.automationHelper() });
        }
      } else if (!gen.mastery?.[key] && pr.tries === this.balance.specials.familiarAfter) {
        enc.newlyFamiliar = true;
        this.emit('familiar', { enc, key, quality: pr.best });
      }
    }
    enc.missed = missed;
    enc.hold = this.balance.encounter.outcomeHold + (missed.length ? 2.4 : 0);

    // Hidden, deterministic, and independent of every choice made above.
    const ctx = { kind: 'special', index: enc.index, tier: enc.tier, archetypeId: enc.archetypeId };
    const outcome = rollConversion(state, ctx, this.balance);
    enc.reward = reward;
    enc.reaction = pickReaction(state, enc, reward.quality);
    enc.state = manual ? 'outcome' : 'done';
    enc.t = 0;
    if (outcome.converted) {
      outcome.name = enc.person; // the person you have been talking with is the one who came to Christ
      recordConversion(state, ctx, outcome.name, gen.genSeconds);
      enc.state = 'conversion';
      enc.convert = { name: outcome.name };
      if (!manual) this.enc = enc; // a conversion is never passed over quietly: the street pauses for it
      this.emit('conversion', { name: outcome.name, enc });
      this.hint('conversionSeen');
    }
    gen.people.push({ index: enc.index, archetype: enc.archetypeId, person: enc.person, at: Math.round(gen.genSeconds), q: +reward.quality.toFixed(2), converted: !!outcome.converted, auto: auto || undefined, harvest: harvest || undefined });
    if (gen.people.length > 80) gen.people.shift();
    if (outcome.converted) {
      gen.regularSerial[enc.archetypeId] = (gen.regularSerial[enc.archetypeId] || 0) + 1; // next time, someone new
      delete gen.memory[enc.archetypeId];
    }
    gen.encounterIndex += 1; // advance only on completion so a reload replays the same encounter, same outcome
    this.emit(auto ? 'automated' : harvest ? 'harvested' : 'resolved', { enc, reward, converted: !!outcome.converted, helper: enc.helper });
    this.dirty(true);
  }

  // ---- street actions -----------------------------------------------------------------------------
  /** Tap a passerby with an open moment. Works on the street, and during the Professor's attention window. */
  engageCrowd(pedId) {
    if (this.state.phase !== 'gen1') return null;
    const window = this.boss?.stage === 'window';
    if (this.streetPaused) return null;
    const result = this.street.engage(pedId, { window });
    if (result && window) {
      this.boss.attention += 1;
      this.boss.attentionTotal += 1;
      this.state.gen.encounterStats.attention += 1;
    }
    if (result) this.hint('street');
    return result;
  }

  /** A tap on the street that found no one open to a moment. */
  missTap() {
    return this.street.miss();
  }

  /** Keyboard/assist: engage the most central open moment. */
  engageNearest() {
    let best = null;
    let bestD = Infinity;
    for (const p of this.crowd.peds) {
      if (!p.opp || p.done || p.x < 0.04 || p.x > 0.96) continue;
      const d = Math.abs(p.x - 0.5);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best ? this.engageCrowd(best.id) : null;
  }

  // ---- conversation actions -----------------------------------------------------------------------
  touch(enc) {
    const gen = this.state.gen;
    if (!enc.touched) {
      enc.touched = true;
      if (enc.kind !== 'boss') gen.encounterStats.engaged += 1;
    }
    enc.idle = 0;
  }

  /** Crit roll for the Professor's exchange ("Critical Proclamation"). */
  rollResponseCrit(mods) {
    const crit = critStats(mods, this.balance);
    const chance = Math.min(this.balance.proclaim.critChanceCap, crit.chance + (this.street.standFirm ? this.balance.street.standFirm.critBonus : 0));
    const isCrit = this.rng() < chance;
    if (isCrit) this.state.gen.encounterStats.crits += 1;
    return { isCrit, mult: isCrit ? crit.mult : 1 };
  }

  /**
   * Choose how to respond. In a conversation this is the first step (then a passage is applied). In the Professor's
   * exchange it sets the line you press for the rest of the argument.
   */
  respond(choiceId) {
    const enc = this.activeEncounter;
    if (this.state.phase !== 'gen1' || !enc || enc.resolved || enc.state !== 'active' || enc.step !== 'respond') return null;
    const choice = enc.choices.find((c) => c.id === choiceId);
    if (!choice) return null;
    const gen = this.state.gen;
    const approach = this.balance.scripture.approach[choice.grade];
    enc.answer = choice;
    enc.approach = approach;
    this.touch(enc);
    gen.encounterStats.answersGiven += 1;
    this.street.addMomentum(this.balance.street.momentum.perAnswer * approach.value, 'answer');
    this.emit('responded', { enc, choice });
    if (enc.kind === 'boss') {
      enc.step = 'press';
      this.boss.stats.answers += 1;
      this.pressPoint(enc);
    } else {
      enc.step = 'apply';
    }
    return choice;
  }

  /**
   * Say one of the three lines this person's situation offers. The most direct one draws on Scripture and answers what they
   * raised; another is honest and human; another recites a true passage that is not aimed at the question. The person replies to
   * what was actually said.
   */
  sayLine(lineId) {
    const enc = this.enc;
    const gen = this.state.gen;
    if (this.state.phase !== 'gen1' || !enc || enc.kind !== 'special' || enc.resolved || enc.state !== 'active' || enc.step !== 'apply') return null;
    const line = enc.lines.find((l) => l.id === lineId);
    if (!line) return null;
    const verse = line.verse ? SCRIPTURES[line.verse] : null;
    enc.wordCharged = !!verse && this.wordReady;
    if (enc.wordCharged) gen.street.word = 0;
    enc.scripture = {
      id: line.id,
      plain: !verse,
      grade: line.grade,
      label: verse ? applicationLabel(line.grade) : PLAIN_LABELS[line.grade],
      say: line.say,
      reply: line.reply,
      ref: verse ? verse.ref : null,
    };
    this.touch(enc);
    if (verse) gen.encounterStats.scripturesProclaimed += 1;
    this.street.addMomentum(isFitting(line.grade) ? this.balance.street.momentum.perFitWord : this.balance.street.momentum.perWord, 'word');
    this.emit('applied', { enc, lineId, grade: line.grade, charged: enc.wordCharged });
    this.finishConversation(enc);
    return enc.scripture;
  }

  /** Move on without applying a passage. Nothing is lost beyond what the passage would have added. */
  skipScripture() {
    const enc = this.enc;
    if (!enc || enc.kind !== 'special' || enc.resolved || enc.state !== 'active' || enc.step !== 'apply') return false;
    this.finishConversation(enc);
    return true;
  }

  /** WORD in an exchange: in a conversation or the Professor's argument it applies a passage; on the street, see proclaimStreet. */
  castWord(verseId) {
    const enc = this.activeEncounter;
    if (enc?.kind === 'special') return null; // in a conversation you say a line instead (sayLine)
    const state = this.state;
    const gen = state.gen;
    if (!enc || enc.kind !== 'boss' || enc.resolved || enc.state !== 'active' || enc.step !== 'press') return null;
    if (!this.balance.scripture.verses[verseId] || !gen.scripturesUnlocked.includes(verseId) || state.phase !== 'gen1') return null;
    if (!this.isVerseReady(verseId)) return null;
    const mods = this.mods;
    const { amount: raw, grade } = verseImpact(state, mods, verseId, enc, this.balance);
    const { isCrit, mult } = this.rollResponseCrit(mods);
    let amount = raw * mult;
    if (this.buffs.phase > 0) amount *= 1 + this.balance.scripture.bossPhaseBonus.impactPct;
    const charged = this.wordReady;
    if (charged) {
      amount *= this.balance.street.word.encounterBonus;
      gen.street.word = 0;
    }
    this.cool.words[verseId] = verseCooldown(verseId, grade, this.balance);
    this.cool.shared = this.balance.scripture.sharedGap;
    this.touch(enc);
    gen.encounterStats.scripturesProclaimed += 1;
    this.boss.stats.words += 1;
    if (isFitting(grade)) this.boss.stats.fitWords += 1;
    this.afterContextual(enc, grade, mods);
    this.street.addMomentum(isFitting(grade) ? this.balance.street.momentum.perFitWord : this.balance.street.momentum.perWord, 'word');
    this.emit('word', { id: verseId, grade, label: applicationLabel(grade), amount, charged });
    this.applyImpact(enc, amount, { amount, crit: isCrit, source: 'word', grade });
    return { id: verseId, grade, amount, crit: isCrit, charged };
  }

  /** Press the chosen line in the Professor's exchange. */
  castAnswer() {
    const enc = this.activeEncounter;
    if (this.state.phase !== 'gen1' || this.cool.answer > 0 || !enc || enc.kind !== 'boss' || !enc.approach || enc.resolved || enc.state !== 'active' || enc.step !== 'press') return null;
    return this.pressPoint(enc);
  }

  pressPoint(enc) {
    const mods = this.mods;
    const raw = answerImpact(this.state, mods, enc, this.balance);
    const { isCrit, mult } = this.rollResponseCrit(mods);
    let amount = raw * mult;
    if (this.buffs.phase > 0) amount *= 1 + this.balance.scripture.bossPhaseBonus.impactPct;
    this.cool.answer = answerCooldown(mods, this.balance);
    this.touch(enc);
    this.afterContextual(enc, enc.answer?.grade === 'strong' ? 'direct' : 'proclaimed', mods);
    this.emit('answer', { choice: enc.answer, amount });
    this.applyImpact(enc, amount, { amount, crit: isCrit, source: 'answer', grade: enc.answer?.grade });
    return { amount, crit: isCrit, grade: enc.answer?.grade };
  }

  afterContextual(enc, grade, mods) {
    if (enc.kind === 'boss' && isFitting(grade) && mods.bossPhaseBonus > 0) this.buffs.phase = this.balance.scripture.bossPhaseBonus.seconds;
  }

  /** `seed`: the tap landed on the seed floating over them (only matters for a familiar situation, where tapping them still talks). */
  tapSpecial(specialId, { seed = false } = {}) {
    if (this.state.phase !== 'gen1' || this.boss) return false;
    const sp = this.crowd.specials.find((s) => s.id === specialId && !s.engaged);
    if (!sp || this.enc) return false;
    if (sp.treatment === 'learned' || (sp.treatment === 'familiar' && seed)) return this.harvestConversation(sp);
    sp.engaged = true;
    this.state.gen.encounterStats.specialsMet += 1;
    this.enc = makeSpecialEncounter(this.state, sp.specialId, this.balance, sp.variant);
    this.emit('specialEngaged', { enc: this.enc });
    this.emit('encounterStart', { enc: this.enc });
    this.hint('respond');
    return true;
  }

  // ---- purchases ----------------------------------------------------------------------------------
  ministryInfo(id) {
    const gen = this.state.gen;
    const mods = this.mods;
    const owned = gen.ministries[id].owned;
    const d = mods.costDiscount;
    const b = this.balance;
    const at = (n) => lineProductionForOwned(this.state, id, owned + n, mods, 1, b);
    const maxN = maxAffordable(id, owned, gen.seeds, d, b);
    const production = lineProduction(this.state, id, mods, 1, b);
    const cycle = b.ministryCycleSeconds[id];
    return {
      id,
      owned,
      unlocked: this.isMinistryUnlocked(id),
      cost1: ministryCost(id, owned, d, b),
      cost10: bulkCost(id, owned, 10, d, b),
      maxN,
      costMax: bulkCost(id, owned, Math.max(1, maxN), d, b),
      production,
      perUnit: owned > 0 ? production / owned : b.ministries[id].baseProduction,
      cycle,
      tickAmount: production * cycle,
      after1: at(1),
      after10: at(10),
      afterMax: at(Math.max(1, maxN)),
    };
  }

  /** Emit a production change (HUD before/after) if passive production moved. */
  announceProduction(before, cause) {
    const after = this.baseSeedsPerSec;
    if (Math.abs(after - before) > 1e-9) this.emit('productionChange', { before, after, cause });
  }

  buyMinistry(id, qty = 1) {
    const gen = this.state.gen;
    if (this.state.phase !== 'gen1' || !gen.ministries[id] || !this.isMinistryUnlocked(id)) return false;
    const d = this.mods.costDiscount;
    const owned = gen.ministries[id].owned;
    const n = qty === 'max' ? maxAffordable(id, owned, gen.seeds, d, this.balance) : qty;
    if (n <= 0) return false;
    const cost = bulkCost(id, owned, n, d, this.balance);
    if (cost > gen.seeds + 1e-9) return false;
    const before = this.baseSeedsPerSec;
    gen.seeds = Math.max(0, gen.seeds - cost);
    gen.ministries[id].owned += n;
    this.checkUnlocks();
    this.emit('purchase', { kind: 'ministry', id, n });
    this.announceProduction(before, { kind: 'ministry', id, n });
    const crossed = crossedMilestone(owned, owned + n, this.balance.visualMilestones);
    if (crossed) this.emit('ministryMilestone', { id, owned: owned + n, ...crossed });
    this.dirty(true);
    return true;
  }

  isUpgradeVisible(id) {
    const def = this.balance.upgrades[id];
    const gen = this.state.gen;
    if (def.requires && (gen.ministries[def.requires.ministry]?.owned || 0) < def.requires.owned) return false;
    if (def.unlockFunds) return gen.fundsUnlocked;
    return gen.clustersUnlocked.includes(def.cluster);
  }

  /** The other half of a fork has been chosen: this one is closed. */
  isUpgradeForgone(id) {
    const other = this.balance.upgrades[id]?.exclusiveWith;
    return !!other && !!this.state.gen.upgrades[other];
  }

  /** What buying an upgrade would do to passive production (shown before you buy), and how long that takes to pay back. */
  upgradePreview(id) {
    const def = this.balance.upgrades[id];
    const state = this.state;
    const before = this.baseSeedsPerSec;
    const hypothetical = { ...state, gen: { ...state.gen, upgrades: { ...state.gen.upgrades, [id]: true } } };
    const after = seedsPerSecond(hypothetical, computeModifiers(hypothetical, this.balance), 1, this.balance);
    const delta = after - before;
    const costInSeeds = def.currency === 'seeds' ? def.cost : 0;
    // Street moments, WORD and conversations are paid in seconds of production, so a passive gain lifts them too.
    const st = state.gen.encounterStats;
    const momentShare = (st.tapSeeds + st.wordSeeds + st.talkSeeds) / Math.max(1, state.gen.totalSeeds);
    const reach = Math.min(4, 1 / Math.max(0.25, 1 - momentShare));
    const professor = def.tag === 'professor' || PROFESSOR_KEYS.some((k) => def.effects[k]);
    const readiness = professor
      ? { before: bossReadiness(state, this.balance).ratio, after: bossReadiness(hypothetical, this.balance).ratio }
      : null;
    return { before, after, delta, paybackSeconds: delta > 1e-9 && costInSeeds ? costInSeeds / (delta * reach) : null, readiness };
  }

  canAffordUpgrade(id) {
    const def = this.balance.upgrades[id];
    const gen = this.state.gen;
    return (def.currency === 'funds' ? gen.funds : gen.seeds) >= def.cost;
  }

  buyUpgrade(id) {
    const gen = this.state.gen;
    const def = this.balance.upgrades[id];
    if (this.state.phase !== 'gen1' || !def || gen.upgrades[id] || !this.isUpgradeVisible(id) || this.isUpgradeForgone(id) || !this.canAffordUpgrade(id)) return false;
    const before = this.baseSeedsPerSec;
    // Funds only ever pay for mundane supplies; Seeds only for Seed upgrades.
    if (def.currency === 'funds') gen.funds -= def.cost;
    else gen.seeds -= def.cost;
    gen.upgrades[id] = true;
    this.emit('purchase', { kind: 'upgrade', id });
    this.announceProduction(before, { kind: 'upgrade', id });
    this.dirty(true);
    return true;
  }

  discipleDef(id) {
    return this.balance.disciples.list.find((d) => d.id === id);
  }

  trainDisciple(id) {
    const gen = this.state.gen;
    const d = gen.disciples.find((x) => x.id === id);
    const def = this.discipleDef(id);
    if (this.state.phase !== 'gen1' || !d || d.status !== 'candidate' || gen.seeds < def.cost) return false;
    const before = this.baseSeedsPerSec;
    gen.seeds -= def.cost;
    d.status = 'trained';
    d.assigned = this.bestLineForDisciple();
    const first = !gen.milestones.timothySeen;
    gen.milestones.timothySeen = true;
    this.emit('discipleTrained', { id, first, verse: first ? TIMOTHY_TEXT : null });
    this.emit('purchase', { kind: 'disciple', id });
    this.announceProduction(before, { kind: 'disciple', id });
    this.dirty(true);
    return true;
  }

  bestLineForDisciple() {
    const mods = this.mods;
    let best = 'tracts';
    let bestProd = -1;
    for (const id of MINISTRY_IDS) {
      const prod = lineProduction(this.state, id, mods, 1, this.balance);
      if (prod > bestProd) {
        best = id;
        bestProd = prod;
      }
    }
    return best;
  }

  assignDisciple(id, ministryId) {
    const gen = this.state.gen;
    const d = gen.disciples.find((x) => x.id === id);
    if (!d || d.status !== 'trained' || !gen.ministries[ministryId] || !this.isMinistryUnlocked(ministryId)) return false;
    const before = this.baseSeedsPerSec;
    d.assigned = ministryId;
    this.announceProduction(before, { kind: 'assign', id, ministryId });
    this.dirty(true);
    return true;
  }

  // ---- boss ---------------------------------------------------------------------------------------
  get bossAvailable() {
    const b = this.state.gen.bossState;
    return this.state.phase === 'gen1' && !this.boss && b.status === 'available';
  }

  challengeBoss() {
    if (!this.bossAvailable) return false;
    const b = this.state.gen.bossState;
    b.attempts += 1;
    this.enc = null;
    this.crowd.clearSpecials();
    this.boss = {
      stage: 'intro', t: 0, phaseIndex: 0, enc: null, attention: 0, bonus: 0,
      stats: { answers: 0, words: 0, fitWords: 0, auto: 0, rebuttals: 0, strongRebuttals: 0 }, attentionTotal: 0,
    };
    this.buffs.phase = 0;
    this.emit('bossStart', { attempt: b.attempts });
    return true;
  }

  updateBoss(dt, mods) {
    const boss = this.boss;
    const cfg = this.balance.boss;
    boss.t += dt;
    switch (boss.stage) {
      case 'intro':
        if (boss.t >= cfg.introSeconds) this.startBossPhase(0, this.lectureBonus());
        break;
      case 'argument': {
        const enc = boss.enc;
        if (enc.resolved) break;
        if (enc.step === 'respond' && boss.t >= cfg.autoRespondSeconds) {
          // Nobody chose a line: press on with a measured answer rather than stalling.
          const choice = enc.choices.find((c) => c.grade === 'partial');
          boss.stats.auto += 1;
          this.respond(choice.id);
          this.emit('bossAutoRespond', { enc, choice });
          break;
        }
        enc.timeLeft -= dt;
        const support = totalSupportPerSecond(this.state, mods, this.balance);
        if (support > 0) {
          enc.resistance = Math.max(0, enc.resistance - support * dt);
          this.checkResolved(enc);
        }
        // Halfway through, he answers back; the clock and your helpers keep going while you reply.
        if (!enc.resolved && enc.step === 'press' && !enc.rebutted && enc.resistance <= enc.resistanceMax * cfg.rebuttal.at) this.beginRebuttal(enc);
        if (!enc.resolved && enc.step === 'rebut') {
          enc.rebutWait += dt;
          if (enc.rebutWait >= cfg.rebuttal.autoSeconds) {
            this.rebut(enc.rebuttalChoices.find((c) => c.grade === 'partial').id, { auto: true });
            this.emit('bossAutoRespond', { enc, rebuttal: true });
          }
        }
        if (!enc.resolved && enc.timeLeft <= 0) {
          if (enc.resistance <= cfg.graceFraction * enc.resistanceMax) {
            // Nearly answered: the Professor concedes the point rather than letting the exchange collapse.
            enc.resistance = 0;
            this.emit('bossConcession', { index: boss.phaseIndex });
            this.checkResolved(enc);
          } else this.failBoss();
        }
        break;
      }
      case 'window':
        if (boss.t >= this.windowSeconds) {
          boss.bonus = Math.min(cfg.windowBonusMax + mods.windowBonus, boss.attention * cfg.windowBonusPerEngage);
          boss.stage = 'transition';
          boss.t = 0;
          this.emit('bossWindowEnd', { attention: boss.attention, bonus: boss.bonus });
        }
        break;
      case 'transition':
        if (boss.t >= cfg.transitionSeconds) this.startBossPhase(boss.phaseIndex + 1, boss.bonus);
        break;
      case 'victory':
        break;
      case 'passed':
        if (boss.t >= 3.2) this.endBossSession();
        break;
      default:
        break;
    }
  }

  beginRebuttal(enc) {
    enc.step = 'rebut';
    enc.rebutted = true;
    enc.rebutWait = 0;
    this.emit('bossRebuttal', { enc });
  }

  /** Reply when he answers back. Strong: what remains of his argument is cut. Middling: nothing changes. Weak: he presses his advantage. */
  rebut(choiceId, { auto = false } = {}) {
    const boss = this.boss;
    const enc = boss?.enc;
    if (this.state.phase !== 'gen1' || !enc || enc.resolved || enc.step !== 'rebut' || boss.stage !== 'argument') return null;
    const choice = enc.rebuttalChoices.find((c) => c.id === choiceId);
    if (!choice) return null;
    const cfg = this.balance.boss.rebuttal;
    const before = enc.resistance;
    if (choice.grade === 'strong') enc.resistance = Math.max(1, enc.resistance * (1 - cfg.strongCut));
    else if (choice.grade === 'weak') enc.resistance = Math.min(enc.resistanceMax, enc.resistance + cfg.weakAdd * enc.resistanceMax);
    enc.rebuttalAnswer = choice;
    enc.step = 'press';
    this.touch(enc);
    boss.stats.rebuttals += 1;
    if (choice.grade === 'strong') boss.stats.strongRebuttals += 1;
    if (auto) boss.stats.auto += 1;
    this.emit('bossRebutted', { enc, choice, before, after: enc.resistance, auto });
    return choice;
  }

  startBossPhase(index, bonus = 0) {
    const boss = this.boss;
    boss.phaseIndex = index;
    boss.stage = 'argument';
    boss.t = 0;
    boss.enc = makeBossEncounter(index, this.balance, bonus, `${this.state.rngSeed}:${this.state.gen.bossState.attempts}`);
    const bs = this.state.gen.bossState;
    bs.bestPhase = Math.max(bs.bestPhase, index + 1);
    this.emit('bossPhase', { index, enc: boss.enc, bonus });
  }

  onBossPhaseCleared(enc) {
    const boss = this.boss;
    if (!boss) return;
    boss.reaction = enc.answer?.grade || 'partial';
    if (enc.phaseIndex < this.balance.boss.arguments.length - 1) {
      boss.stage = 'window';
      boss.t = 0;
      boss.attention = 0;
      this.emit('bossWindow', { index: enc.phaseIndex });
      return;
    }
    this.bossVictory();
  }

  bossVictory() {
    const state = this.state;
    const gen = state.gen;
    const bs = gen.bossState;
    this.boss.stage = 'victory';
    this.boss.t = 0;
    if (bs.rewarded) return; // victory rewards only once
    bs.rewarded = true;
    bs.defeated = true;
    bs.status = 'victory';
    const seeds = bossReward(state, this.balance);
    this.addSeeds(seeds);
    this.emit('bossVictory', { seeds });
    this.dirty(true);
  }

  /** Continue from the victory exchange into Generation Complete. */
  finishBossVictory() {
    if (!this.boss || this.boss.stage !== 'victory') return false;
    this.boss = null;
    this.enc = null;
    if (completeGeneration(this.state, this.balance)) {
      this.emit('generationComplete', { summary: this.state.prestige.summary });
      this.dirty(true);
    }
    return true;
  }

  failBoss() {
    // The opportunity passes. Nothing is lost: no Seeds, Funds, upgrades or progress are removed.
    const boss = this.boss;
    if (!boss || boss.stage === 'passed' || boss.stage === 'victory') return;
    const reached = boss.phaseIndex;
    boss.stage = 'passed';
    boss.t = 0;
    const bs = this.state.gen.bossState;
    bs.status = 'cooldown';
    bs.cooldownUntil = this.state.gen.genSeconds + this.balance.boss.cooldownSeconds;
    const session = { ...boss.stats, attention: boss.attentionTotal, reachedPhase: reached };
    const ratio = bossReadiness(this.state, this.balance).ratio;
    bs.lastDebrief = { phase: reached + 1, label: readinessLabel(ratio), tips: debriefTips(this.state, session, this.balance) };
    this.emit('bossPassed', { debrief: bs.lastDebrief });
    this.dirty(true);
  }

  endBossSession() {
    this.boss = null;
  }

  /** Advisory, never gating: how many times over a basic Answer-and-helpers player could answer each argument. */
  bossPreparation() {
    return bossReadiness(this.state, this.balance).ratio;
  }

  // ---- offline ------------------------------------------------------------------------------------
  creditOffline(seconds) {
    const gains = computeOffline(this.state, seconds, this.balance);
    if (gains.seeds > 0 || gains.funds > 0) {
      applyOffline(this.state, gains);
      this.checkUnlocks(true);
    }
    // Conversations are never resolved for you, but someone may be waiting on the street when you return.
    const sp = this.balance.specials;
    const gen = this.state.gen;
    if (seconds >= 300 && this.state.phase === 'gen1' && gen.totalSeeds >= sp.unlockSeeds && gen.genSeconds >= sp.unlockGenSeconds) {
      this.specialTimer = 0.5;
      this.nextSpecialLife = sp.lifetime * 3;
      gains.waiting = true;
    }
    // WORD kept preparing while you were away: coming back to find it ready is a reason to check in.
    const w = this.balance.street.word;
    if (this.state.phase === 'gen1' && gen.scripturesUnlocked.length && gen.street.word < w.max && seconds > 0) {
      gen.street.word = Math.min(w.max, gen.street.word + seconds * w.passivePerSecond * (1 + this.mods.wordCharge));
      if (gen.street.word >= w.max) gains.wordReady = true;
    }
    return gains;
  }

  creditOfflineSinceSave(now) {
    const seconds = clampOfflineSeconds(this.state.lastSavedAt, now, this.balance);
    return this.creditOffline(seconds);
  }

  // ---- prestige -----------------------------------------------------------------------------------
  beginNextGeneration() {
    const result = beginNextGeneration(this.state, this.balance);
    if (!result.ok) return result;
    this.enc = null;
    this.boss = null;
    this.crowd.clearSpecials();
    this.cool = { words: {}, answer: 0, shared: 0 };
    this.buffs = { phase: 0 };
    this.chapterShown = 0;
    this.emit('nextGeneration', { awarded: result.awarded });
    this.dirty(true);
    return result;
  }

  buyPrestigeNode(id) {
    if (!canBuyNode(this.state, id, this.balance)) return false;
    const ok = buyNode(this.state, id, this.balance);
    if (ok) {
      this.emit('purchase', { kind: 'prestige', id });
      this.dirty(true);
    }
    return ok;
  }
}
