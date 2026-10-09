// Street gameplay: tap passersby who are open to a brief engagement, build the Active Witness streak, fill the
// Momentum meter, and earn the short "Stand Firm" state. None of this touches conversion outcomes (those are
// hidden, seeded, and decided only by completed conversations); it only paces and rewards attention.
import { seedsPerSecond, tierIndex, critStats, streakMultiplier, streakTierIndex, streakWindow } from '../core/economy.js';
import { rangeFrom } from '../core/rng.js';

export class StreetSystem {
  constructor(game) {
    this.game = game;
    this.lastEngageAt = -10;
  }

  get st() {
    return this.game.state.gen.street;
  }

  get balance() {
    return this.game.balance.street;
  }

  get standFirm() {
    return this.st.standFirmLeft > 0;
  }

  get streakCount() {
    return Math.floor(this.st.streak);
  }

  /** WORD readiness (0..max), earned by working the street. */
  get word() {
    return this.st.word;
  }

  get wordFull() {
    return this.st.word >= this.balance.word.max;
  }

  get multiplier() {
    return streakMultiplier(this.streakCount, this.game.balance, this.game.mods.streakBonus);
  }

  get tier() {
    return streakTierIndex(this.streakCount, this.game.balance);
  }

  /** Seconds the run can go without an engagement before it starts to fade: shorter the hotter the run, longer while WORD is ready or standing firm. */
  get streakWindowNow() {
    const b = this.balance;
    return streakWindow(this.game.mods, this.game.balance, this.streakCount) * (this.standFirm ? b.standFirm.windowMult : 1) * (this.game.wordReady ? b.word.readyWindowMult : 1) * this.game.eventWindowMult;
  }

  /** Seconds left before the run starts to fade (what the Active Witness bar shows). */
  get streakTimeLeft() {
    return Math.max(0, this.streakWindowNow - this.st.idle);
  }

  /** Multiplier applied to opportunity density (Stand Firm and cadence upgrades). */
  get opportunityMult() {
    const mods = this.game.mods;
    return (1 + mods.cadencePct) * (this.standFirm ? this.balance.standFirm.opportunityMult : 1);
  }

  /** Words and Answers recover faster while standing firm. */
  get cooldownSpeed() {
    return this.standFirm ? this.balance.standFirm.cooldownSpeed : 1;
  }

  /** `paused` is true while a conversation or boss argument has the player's attention: timers hold. */
  tick(dt, paused) {
    const st = this.st;
    const b = this.balance;
    if (st.standFirmLeft > 0) {
      st.standFirmLeft = Math.max(0, st.standFirmLeft - dt);
      st.momentum = (b.momentum.max * st.standFirmLeft) / b.standFirm.seconds;
      if (st.standFirmLeft === 0) {
        st.momentum = 0;
        this.game.emit('standFirm', { active: false });
      }
    }
    if (paused) return;
    const mods = this.game.mods;
    // WORD also charges slowly by itself once there is a passage to proclaim.
    if (this.game.state.gen.scripturesUnlocked.length) this.gainWord(b.word.passivePerSecond * dt, { steady: true });
    st.idle += dt;
    if (st.idle > this.streakWindowNow && st.streak > 0) {
      const before = this.tier;
      const was = this.streakCount;
      st.streak = Math.max(0, st.streak - Math.max(b.streakDecayPerSecond, st.streak * b.streakDrainFraction) * dt);
      if (this.tier < before) this.game.emit('streakDown', { from: before, to: this.tier, mult: this.multiplier, lost: was - this.streakCount, why: 'pace' });
    }
    if (!this.standFirm) {
      st.momentumIdle += dt;
      if (st.momentumIdle > b.momentum.decayDelay && st.momentum > 0) st.momentum = Math.max(0, st.momentum - b.momentum.decayPerSecond * dt);
    }
  }

  /** Working the street prepares WORD. Once full it stays full (and unearned readiness is simply not banked). */
  gainWord(amount, { steady = false } = {}) {
    const st = this.st;
    const b = this.balance.word;
    if (st.word >= b.max) return;
    st.word = Math.min(b.max, st.word + amount * (this.standFirm && !steady ? b.standFirmMult : 1) * (1 + this.game.mods.wordCharge));
  }

  addStreak(n) {
    const st = this.st;
    const before = this.tier;
    st.streak += n;
    st.idle = 0;
    const stats = this.game.state.gen.encounterStats;
    stats.bestStreak = Math.max(stats.bestStreak, this.streakCount);
    if (this.tier > before) this.game.emit('streakTier', { mult: this.multiplier, count: this.streakCount });
  }

  addMomentum(amount, reason) {
    const st = this.st;
    const b = this.balance;
    if (this.standFirm) return;
    // Stand Firm has to be earned: not in the first couple of minutes, while you are still learning the street.
    const cap = this.game.state.gen.genSeconds < b.standFirm.minSeconds ? b.momentum.max - 0.5 : b.momentum.max;
    st.momentum = Math.min(cap, st.momentum + amount);
    st.momentumIdle = 0;
    this.game.emit('momentum', { amount, reason, value: st.momentum });
    if (st.momentum >= b.momentum.max) this.startStandFirm();
  }

  startStandFirm() {
    const st = this.st;
    st.standFirmLeft = this.balance.standFirm.seconds;
    st.momentum = this.balance.momentum.max;
    this.game.state.gen.encounterStats.standFirms += 1;
    this.game.emit('standFirm', { active: true, seconds: st.standFirmLeft });
    this.game.hint('standFirm');
  }

  /**
   * Engage a passerby with an open moment. `window` marks the Professor's crowd-attention window, where each
   * engagement is worth more Seeds. Returns the result or null (no opportunity / too fast / not allowed).
   */
  engage(pedId, { window = false } = {}) {
    const g = this.game;
    const state = g.state;
    const gen = state.gen;
    const bal = g.balance;
    const ped = g.crowd.peds.find((p) => p.id === pedId);
    if (!ped || !ped.opp || ped.done) return null;
    if (g.time - this.lastEngageAt < this.balance.minEngageGap) return null;
    this.lastEngageAt = g.time;

    const mods = g.mods;
    this.addStreak(1);
    const count = this.streakCount;
    const mult = streakMultiplier(count, bal, mods.streakBonus);
    const tier = tierIndex(gen.totalSeeds, bal);
    const passive = seedsPerSecond(state, mods, 1, bal);
    const base = Math.max(this.balance.rewardFloor[tier], passive * rangeFrom(g.rng, this.balance.engageSeconds));
    const crit = critStats(mods, bal);
    const chance = Math.min(bal.proclaim.critChanceCap, crit.chance + (this.standFirm ? this.balance.standFirm.critBonus : 0));
    const isCrit = g.rng() < chance;
    let seeds = base * (1 + mods.rewardPct) * mult * (this.standFirm ? this.balance.standFirm.rewardMult : 1);
    if (isCrit) seeds *= crit.mult;
    if (window) seeds *= bal.boss.windowRewardMult;
    seeds = Math.max(1, Math.round(seeds));

    g.addSeeds(seeds);
    ped.opp = false;
    ped.done = true;
    ped.react = 0.7;
    const stats = gen.encounterStats;
    stats.engagements += 1;
    stats.tapSeeds += seeds;
    // A small chain bonus on every Nth successive tap (not in the Professor's window, where taps already pay more).
    let chain = null;
    const cc = this.balance.chain;
    if (!window && count >= cc.every && count % cc.every === 0) {
      const bonus = Math.max(1, Math.round(seeds * cc.fraction * Math.min(cc.maxSteps, count / cc.every)));
      g.addSeeds(bonus);
      stats.tapSeeds += bonus;
      chain = { count, bonus };
    }
    g.addBuzz(1);
    if (isCrit) stats.crits += 1;
    this.addMomentum(this.balance.momentum.perEngage + this.balance.momentum.perStreakTier * this.tier, 'engage');
    this.gainWord(this.balance.word.perEngage + this.balance.word.perStreakTier * this.tier);
    const result = { pedId, x: ped.x, lane: ped.lane, seeds, crit: isCrit, streak: count, mult, window, standFirm: this.standFirm, chain };
    g.emit('engage', result);
    if (chain) {
      g.emit('chain', { ...chain, pedId });
      g.hint('chain');
    }
    return result;
  }
}
