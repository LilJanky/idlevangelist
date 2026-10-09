// Moving background crowd and special-opportunity characters. Positions are normalized (0..1 across the
// scene) so simulation never depends on screen size. One shared update for all pedestrians (no per-person timers).
// Some pedestrians carry an "opportunity" (open to a brief engagement); missing one costs nothing.
import { BALANCE } from '../config/balance.js';
import { rangeFrom } from '../core/rng.js';

export class CrowdSystem {
  constructor(rng, balance = BALANCE) {
    this.rng = rng;
    this.balance = balance;
    this.peds = [];
    this.specials = [];
    this.nextId = 1;
    this.spawnTimer = 0;
    this.missed = 0;
    this.lifeAdd = 0; // supplies (rain gear) keep moments open a little longer
    // Start with a populated street rather than an empty one.
    for (let i = 0; i < 8; i++) this.spawnPed(true, 1);
  }

  spawnPed(anywhere = false, oppMult = 1) {
    const dir = this.rng() < 0.5 ? 1 : -1;
    const cfg = this.balance.crowd;
    const opp = this.rng() < cfg.opportunityChance * oppMult;
    this.peds.push({
      id: this.nextId++,
      x: anywhere ? this.rng() * 1.1 - 0.05 : dir > 0 ? -0.08 : 1.08,
      lane: Math.floor(this.rng() * 3),
      dir,
      speed: rangeFrom(this.rng, cfg.speed) / 100,
      look: Math.floor(this.rng() * 1e6),
      standing: false,
      phase: this.rng() * 10,
      opp,
      oppLeft: opp ? rangeFrom(this.rng, cfg.opportunityLife) + this.lifeAdd : 0,
      done: false,
      react: 0,
    });
  }

  /** A new walker takes the lane with the most room just inside their edge, so people do not stack up in one lane. */
  placeInRoomiestLane(p) {
    let best = p.lane;
    let bestGap = -1;
    for (let lane = 0; lane < 3; lane++) {
      let gap = 1;
      for (const q of this.peds) {
        if (q === p || q.lane !== lane || q.far) continue;
        const d = Math.abs(q.x - (p.dir > 0 ? 0 : 1));
        if (d < gap) gap = d;
      }
      if (gap > bestGap + 1e-9) {
        bestGap = gap;
        best = lane;
      }
    }
    p.lane = best;
  }

  spawnSpecial(specialId, life) {
    const dir = this.rng() < 0.5 ? 1 : -1;
    const sp = {
      id: this.nextId++,
      specialId,
      x: dir > 0 ? 0.12 : 0.88,
      x0: dir > 0 ? 0.12 : 0.88,
      dir,
      age: 0,
      life,
      engaged: false,
    };
    this.specials.push(sp);
    return sp;
  }

  /**
   * Everyone in an event WALKS IN from off screen at an ordinary pace; the ones who are meant to linger stop where they are going
   * (`goalX`) and stand for `holdFor` seconds, then carry on the way they were headed. Nobody appears out of thin air.
   */
  enter(side, { goalX = null, holdFor = 0, life, speedMult = 1, lane = null, offset = 0, tag = null, capBonus = 0 }) {
    if (!this.makeRoom(capBonus)) return null;
    this.spawnPed(false, 1);
    const p = this.peds[this.peds.length - 1];
    p.dir = side > 0 ? 1 : -1;
    p.x = side > 0 ? -0.05 - offset : 1.05 + offset;
    p.speed *= speedMult;
    if (lane !== null) p.lane = lane;
    p.opp = !!life;
    p.oppLeft = life ? life[0] + (life[1] - life[0]) * this.rng() : 0;
    p.done = false;
    p.tag = tag;
    p.goalX = goalX;
    p.arriving = true; // still off screen, on its way in: not cleaned up until it has been seen
    p.holdFor = holdFor;
    p.hold = false;
    return p;
  }

  /** A pack arrives together on one side (a bus), clusters near where they got in, stays a while, then walks on. */
  surge(count, life, capBonus = 0, { speedMult = 1, tag = null } = {}) {
    const dir = this.rng() < 0.5 ? 1 : -1;
    let n = 0;
    for (let i = 0; i < count; i++) {
      // nobody stops: the pack steps off together and walks through the street at an easy pace, open the whole way
      const p = this.enter(dir, { life, speedMult: speedMult * 0.7, lane: i % 3, offset: 0.05 * i, tag, capBonus });
      if (!p) break;
      n++;
    }
    return { count: n, side: dir > 0 ? 'left' : 'right' };
  }

  /** Room for one more person: when the street is full, someone who is not part of the moment moves along. */
  makeRoom(capBonus = 0) {
    const limit = this.balance.crowd.cap + capBonus + 2;
    if (this.peds.length < limit) return true;
    const i = this.peds.findIndex((p) => !p.opp && !p.friend && !p.tag);
    if (i < 0) return false;
    this.peds[i] = this.peds[this.peds.length - 1];
    this.peds.pop();
    return true;
  }

  /** One person walks in from an edge, open to a moment, and keeps walking. */
  arrive(side, life, capBonus = 0, { speedMult = 1, tag = null } = {}) {
    const p = this.enter(side, { life, speedMult, tag, capBonus });
    if (p) this.placeInRoomiestLane(p);
    return p;
  }

  /** People come in from both sides and spread across the street, each stopping at their own spot for a long, easy moment. */
  linger(count, life, spread, capBonus = 0, tag = null) {
    let n = 0;
    const first = this.rng() < 0.5 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? first : -first;
      // nobody stops: a few people drift in from both sides, unhurried, with a long open moment
      const p = this.enter(side, { life, speedMult: 0.55, lane: i % 3, offset: 0.1 * Math.floor(i / 2), tag, capBonus });
      if (!p) break;
      n++;
    }
    return { count: n, side: 'street' };
  }

  /** Friends walk along the far side of the street, stop to stand with you for a while, then move on. Not an opportunity. */
  friends(count, stay, tag = null) {
    let n = 0;
    for (let i = 0; i < count; i++) {
      const p = this.enter(1, { goalX: 0.72 + 0.055 * i, holdFor: stay + i * 0.4, offset: 0.05 * i, tag, capBonus: 0 });
      if (!p) break;
      p.friend = true;
      p.far = true;
      p.oppLeft = 0;
      n++;
    }
    return { count: n, side: 'far side' };
  }

  /**
   * Seconds until this person's open moment is gone: their marker running out, or them walking off screen, whichever comes first.
   * `oppDecay` / `speedScale` are the street's current rates (WORD being ready slows both).
   */
  pedTimeLeft(p, { oppDecay = 1, speedScale = 1 } = {}) {
    if (!p.opp || p.done) return 0;
    const hold = p.oppLeft > 50 ? Infinity : p.oppLeft / Math.max(0.05, oppDecay);
    const speed = p.standing ? 0 : p.speed * speedScale;
    const edge = speed > 0 ? (p.dir > 0 ? 0.97 - p.x : p.x - 0.03) / speed : Infinity;
    return Math.max(0, Math.min(hold, edge));
  }

  /** Pedestrians who are open to a moment and on screen: the people a street WORD reaches. */
  openPeds() {
    return this.peds.filter((p) => p.opp && !p.done && p.x > 0.03 && p.x < 0.97);
  }

  /** People on screen who are not open to a moment: they still hear a proclamation, at a reduced rate (once each). */
  bystanders() {
    return this.peds.filter((p) => !p.opp && !p.done && !p.heard && !p.far && p.x > 0.03 && p.x < 0.97);
  }

  /** Number of pedestrians currently carrying a tappable opportunity. */
  get opportunityCount() {
    let n = 0;
    for (const p of this.peds) if (p.opp && !p.done) n++;
    return n;
  }

  /**
   * ctx: gather (boss crowd), capBonus, speedScale, freeze, oppMult (Stand Firm / cadence), oppDecay (<1 while WORD is
   * ready: open moments linger so a fuller street can build), paused (conversation:
   * opportunity timers hold so street play resumes where it left off), markAll (boss attention window).
   */
  update(dt, { gather = false, capBonus = 0, speedScale = 1, freeze = false, oppMult = 1, oppDecay = 1, paused = false, markAll = false, lifeAdd = 0 } = {}) {
    this.lifeAdd = lifeAdd;
    const cfg = this.balance.crowd;
    const cap = cfg.cap + capBonus + (gather ? cfg.gatherCapBonus : 0);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.peds.length < cap) {
      this.spawnPed(false, oppMult);
      this.placeInRoomiestLane(this.peds[this.peds.length - 1]);
      this.spawnTimer = rangeFrom(this.rng, cfg.spawnInterval) / (gather ? 2 : 1);
    }
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      // the crowd that gathers for the lecture stands in open spots, shoulder to shoulder but not on top of each other
      // the audience: they stand in open spots (never on the lectern or the street team's side) and face the Professor
      if (gather && !p.standing && p.lane >= 1 && p.x > 0.38 && p.x < 0.96 && !(p.lane === 2 && Math.abs(p.x - 0.7) < 0.1) && p.id % 3 !== 0 && !this.peds.some((q) => q !== p && q.standing && q.lane === p.lane && Math.abs(q.x - p.x) < cfg.queueGap + 0.01)) {
        p.standing = true;
        p.dir0 = p.dir;
      }
      if (gather && p.standing) p.dir = p.x < 0.7 ? 1 : -1;
      if (!gather && p.standing) {
        p.standing = false;
        if (p.dir0 !== undefined) p.dir = p.dir0;
      }
      if (p.goalX != null && !p.hold && !paused && (p.goalX - p.x) * p.dir <= p.speed * speedScale * dt) {
        p.x = p.goalX;
        p.hold = true;
        // a gathering stands for a short beat, never for the whole moment: they drift on and the street keeps flowing
        p.holdLeft = p.holdFor >= 99 ? Math.min(cfg.maxHold, Math.max(2, p.oppLeft * 0.5)) : p.holdFor;
      }
      if (p.hold && !paused) {
        p.holdLeft -= dt;
        if (p.holdLeft <= 0) {
          p.hold = false;
          p.goalX = null;
          p.friend = false;
        }
      }
      if (p.laneF === undefined) p.laneF = p.lane;
      // glide between lanes instead of jumping
      if (p.laneF !== p.lane) p.laneF += Math.sign(p.lane - p.laneF) * Math.min(Math.abs(p.lane - p.laneF), dt * 4);
      if (!p.standing && !p.hold && !freeze && !p.far) this.sidestep(p);
      if (!p.standing && !p.hold && !freeze) {
        let v = p.speed;
        for (const q of this.peds) {
          if (q === p || q.lane !== p.lane || q.dir !== p.dir || q.hold || q.standing) continue;
          const ahead = (q.x - p.x) * p.dir;
          if (ahead > 0 && ahead < cfg.queueGap && q.speed < v) v = q.speed; // keep pace instead of overlapping
        }
        p.x += p.dir * v * speedScale * dt;
      }
      p.phase += dt * speedScale;
      if (p.react > 0) p.react = Math.max(0, p.react - dt);
      if (!paused && !p.done) {
        if (p.opp) {
          // people arriving for an event only start to run out of time once they are on screen
          if (!markAll && !(p.tag && (p.x < 0.02 || p.x > 0.98))) {
            p.oppLeft -= dt * oppDecay;
            if (p.oppLeft <= 0) p.opp = false;
          }
        } else if (!p.friend && oppMult > 1 && this.rng() < 0.5 * (oppMult - 1) * dt) {
          p.opp = true;
          p.oppLeft = rangeFrom(this.rng, cfg.opportunityLife) + this.lifeAdd;
        }
      }
      if (markAll && !p.done && p.x > 0.05 && p.x < 0.95) {
        p.opp = true;
        p.oppLeft = 99;
      }
      if (!markAll && p.opp && p.oppLeft > 50) p.oppLeft = 3;
      const offscreen = p.x < -0.12 || p.x > 1.12;
      if (p.arriving && p.x > 0.02 && p.x < 0.98) p.arriving = false;
      const entering = !!p.arriving || (p.goalX != null && ((p.x < 0.5 && p.dir > 0) || (p.x > 0.5 && p.dir < 0))); // still on its way in
      if ((offscreen && !entering) || (!entering && this.peds.length > cap && !p.standing && (p.x < 0.02 || p.x > 0.98))) {
        this.peds[i] = this.peds[this.peds.length - 1];
        this.peds.pop();
      }
    }
    for (let i = this.specials.length - 1; i >= 0; i--) {
      const s = this.specials[i];
      s.age += dt;
      s.x = s.x0 + s.dir * 0.76 * Math.min(1, s.age / s.life);
      if (s.age >= s.life || s.engaged) {
        if (!s.engaged) this.missed += 1;
        this.specials[i] = this.specials[this.specials.length - 1];
        this.specials.pop();
      }
    }
  }

  /** A walker who would run into someone standing still ahead of them steps into a free lane and keeps going. */
  sidestep(p) {
    const gap = this.balance.crowd.queueGap;
    // blocked by someone standing, or by a clearly slower walker just ahead in the same direction
    const blocked = (lane) => this.peds.some((q) => {
      if (q === p || q.lane !== lane || q.far) return false;
      const ahead = (q.x - p.x) * p.dir;
      if (q.hold || q.standing) return ahead > -0.02 && ahead < gap;
      return q.dir === p.dir && ahead > 0 && ahead < gap && q.speed < p.speed * 0.75;
    });
    if (!blocked(p.lane)) return;
    const clear = (lane) => !blocked(lane) && !this.peds.some((q) => q !== p && q.lane === lane && !q.far && Math.abs(q.x - p.x) < gap * 0.7);
    for (const lane of [p.lane - 1, p.lane + 1]) {
      if (lane >= 0 && lane <= 2 && clear(lane)) {
        p.lane = lane;
        return;
      }
    }
  }

  clearSpecials() {
    this.specials.length = 0;
  }
}
