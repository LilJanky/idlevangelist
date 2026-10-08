// Canvas renderer. Reads (never mutates) the simulation and draws a pixel-art street scene at a fixed
// logical width (art pixels), scaled with image-rendering: pixelated. All art is generated in code.
import { mix, drawPerson, drawPersonReflection, drawShadow, lookFromInt, PROTAGONIST, PROFESSOR } from './sprites.js';
import { buildSceneryLayers, createSceneryBuildings } from './scenery.js';
import { DISCIPLES, ENCOUNTERS } from '../data/content.js';
import { visualCounts } from '../core/ministryVisuals.js';

export const ART_W = 130;
// What the people of each kind of gathering carry, so you can tell them apart on the street.
const EVENT_ACCESSORY = { school: 'bag', rain: 'umbrella', lunch: 'hat', church: 'book' };
const FOG = '#39414f';
const LAMP_STOPS = [0.04, 0.31, 0.65, 0.93];
const PUDDLES = [
  { x: 0.08, y: 24, w: 0.12, h: 3, seed: 1 },
  { x: 0.26, y: 33, w: 0.1, h: 3, seed: 2 },
  { x: 0.53, y: 28, w: 0.14, h: 4, seed: 3 },
  { x: 0.76, y: 21, w: 0.1, h: 3, seed: 4 },
];
const SKYLINE_SIGNS = [
  { x: 0.1, y: -39, w: 0.13, h: 9, c1: '#4a3146', c2: '#294457', restored: '#c9784a' },
  { x: 0.59, y: -44, w: 0.16, h: 8, c1: '#645238', c2: '#56323b', restored: '#5c8a62' },
];

const smooth = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const quantizeScene = (t, step = 0.125) => Math.round(clamp01(t) / step) * step;
const sceneX = (w, t) => Math.round(w * t);
const sceneSpan = (w, t, min = 1) => Math.max(min, Math.round(w * t));
const lampXs = (w) => LAMP_STOPS.map((t) => sceneX(w, t));

function stationWarmAt(x, warmth, w) {
  if (warmth <= 0) return 0;
  const edge = w * (0.18 + warmth * 0.52);
  const fade = w * 0.22;
  return warmth * clamp01((edge - x) / fade);
}

function makePixelCanvas(w, h) {
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : typeof document !== 'undefined'
      ? document.createElement('canvas')
      : null;
  if (!canvas) return null;
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function ditherRect(ctx, x, y, w, h, color, offset = 0) {
  ctx.fillStyle = color;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = (yy + offset) & 1; xx < w; xx += 2) ctx.fillRect(x + xx, y + yy, 1, 1);
  }
}

function drawCloudCluster(ctx, x, y, palette) {
  const parts = [
    { dx: 0, dy: 4, w: 13, h: 4, color: palette.shadow },
    { dx: 11, dy: 2, w: 15, h: 5, color: palette.shadow },
    { dx: 23, dy: 4, w: 11, h: 4, color: palette.shadow },
    { dx: 3, dy: 2, w: 11, h: 4, color: palette.mid },
    { dx: 12, dy: 0, w: 12, h: 5, color: palette.mid },
    { dx: 21, dy: 2, w: 10, h: 4, color: palette.mid },
    { dx: 6, dy: 1, w: 7, h: 2, color: palette.light },
    { dx: 16, dy: 1, w: 6, h: 2, color: palette.light },
    { dx: 8, dy: 7, w: 17, h: 1, color: palette.underside },
  ];
  for (const part of parts) {
    ctx.fillStyle = part.color;
    ctx.fillRect(x + part.dx, y + part.dy, part.w, part.h);
  }
}

function drawRipple(ctx, x, y, phase, color) {
  // a flat widening oval: two thin lines, never a plus
  const r = 1 + Math.floor(phase * 3);
  ctx.fillStyle = color;
  ctx.fillRect(x - r, y, r * 2 + 1, 1);
  if (r > 1) ctx.fillRect(x - r + 1, y + 1, r * 2 - 1, 1);
}

function hash2(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

function getCachedScenery(renderer, groundTop, wp) {
  const qR = quantizeScene(wp.restoration, 0.125);
  const qN = quantizeScene(wp.night, 0.125);
  const qW = quantizeScene(wp.warmth, 0.0625);
  const key = `scene:${renderer.W}x${renderer.H}:${groundTop}:${qR}:${qN}:${qW}:rm${renderer.reducedMotion ? 1 : 0}`;
  let cached = renderer.skylineCache.get(key);
  if (!cached) {
    cached = buildSceneryLayers({
      W: renderer.W,
      H: renderer.H,
      groundTop,
      feetY: renderer.feetY,
      wp: { restoration: qR, night: qN, warmth: qW },
      buildings: renderer.buildings,
      reducedMotion: renderer.reducedMotion,
    });
    if (cached) {
      renderer.skylineCache.set(key, cached);
      if (renderer.skylineCache.size > 10) renderer.skylineCache.delete(renderer.skylineCache.keys().next().value);
    }
  }
  return cached;
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.game = game;
    this.W = ART_W;
    this.H = 130;
    this.reducedMotion = false;
    this.kick = { proclaim: -10, react: -10, shake: -10, crit: -10, word: -10, bossHit: -10 };
    this.lastCheer = 0;
    this.sparks = [];
    this.seedFlow = [];
    this.screenFlash = { t: -10, a: 0, color: '#fff' };
    this.shakeFx = { amp: 1, dur: 0.12 };
    this.lastSparkT = 0;
    this.montage = null;
    this.items = [];
    this.focusX = 1.2 * ART_W;
    this.focusKey = null;
    this.skylineCache = new Map();
    this.buildings = this.makeBuildings();
    this.convFlash = -10;
  }

  makeBuildings() {
    return createSceneryBuildings(this.W);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.cssW = rect.width;
    this.cssH = rect.height;
    // Integer pixel scaling: every art pixel is the same whole number of screen pixels, so the grid never shimmers.
    // The scene gets as wide as the screen allows (about 120 to 160 art pixels) instead of stretching a fixed 130.
    const step = Math.max(2, Math.ceil(rect.width / 160));
    const W = Math.max(110, Math.round(rect.width / step));
    if (W !== this.W) {
      this.W = W;
      this.buildings = this.makeBuildings();
      this.skylineCache.clear();
    }
    this.scale = rect.width / this.W;
    this.H = Math.max(96, Math.round(rect.height / this.scale));
    if (this.canvas.width !== this.W || this.canvas.height !== this.H) {
      this.canvas.width = this.W;
      this.canvas.height = this.H;
    }
    this.ctx.imageSmoothingEnabled = false;
  }

  // ---- hooks called by the UI controller ----
  onProclaim(crit) {
    this.kick.proclaim = this.now;
    this.kick.react = this.now;
    if (crit) this.kick.crit = this.now;
  }

  // ---- impact: every big hit is felt as well as shown (sparks, a flash of light, a shake), scaled by how big it is ----
  /** Sparks flying out from a point in art pixels. */
  burst(x, y, { n = 10, color = '#ffd98a', speed = 40, life = 0.55, gravity = 70, size = 2 } = {}) {
    const count = this.reducedMotion ? Math.ceil(n / 3) : n;
    for (let i = 0; i < count && this.sparks.length < 400; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4, age: 0, life: life * (0.7 + Math.random() * 0.6), color, size, gravity });
    }
  }

  /**
   * Frequent moments (taps, crits, chains) are carried by the numbers and a few local sparks only: a shake or flash
   * every few seconds is noise. level 0 a tap. 1 a small win. 2 a crit or chain. 3 a big moment (a strong reply):
   * a soft flash. 4 a throng or a victory: the screen lights up and gives one short shake.
   */
  impact(level, x, y, color = '#ffd98a') {
    const n = [5, 10, 22, 40, 70][level];
    this.burst(x, y, { n, color, speed: 28 + level * 14, size: level >= 3 ? 3 : 2 });
    if (level >= 3 && !this.reducedMotion) this.screenFlash = { t: this.now, a: [0, 0, 0, 0.16, 0.3][level], color: '#fff4c8' };
    if (level >= 4 && !this.reducedMotion) {
      this.kick.shake = this.now;
      this.shakeFx = { amp: 2, dur: 0.18 };
    }
  }

  /** Same, from a CSS-pixel point (where the DOM numbers rise from). */
  impactAtCss(level, x, y, color) {
    if (!this.scale) return;
    this.impact(level, x / this.scale, y / this.scale, color);
  }

  /** The Professor takes a point: he rocks back, light and sparks fly from where he stands, scaled by how well the passage fit. */
  bossHit(level, color = '#ffe9a8') {
    this.kick.bossHit = this.now;
    this.kick.react = this.now;
    this.impact(level, this.focusX, this.feetY - 28, color);
  }

  /** Victory: the plaza erupts. Gold and green sparks rise from all over the street for a few seconds. */
  celebrate(t) {
    if (this.reducedMotion || t - this.lastCheer < 0.16) return;
    this.lastCheer = t;
    const x = this.W * (0.08 + Math.random() * 0.84);
    const y = this.groundTop + 10 + Math.random() * (this.feetY - this.groundTop - 18);
    const colors = ['#ffe9a8', '#fff4c8', '#9ada6a', '#f2c860'];
    this.burst(x, y, { n: 9, color: colors[Math.floor(Math.random() * colors.length)], speed: 34, life: 0.8, gravity: 38, size: 2 });
  }

  impactCenter(level, color) {
    this.impact(level, this.W / 2, this.H * 0.52, color);
  }

  updateSparks(t) {
    const dt = Math.min(0.05, Math.max(0, t - this.lastSparkT));
    this.lastSparkT = t;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.age += dt;
      if (sp.age >= sp.life) {
        this.sparks[i] = this.sparks[this.sparks.length - 1];
        this.sparks.pop();
        continue;
      }
      sp.vy += sp.gravity * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
    }
  }

  /**
   * Income you can see: when a ministry reports, a few seeds lift off it and drift up toward the Seeds counter. Idle games live on
   * watching the number get fed, and the seed is this game's coin.
   */
  seedsFromMinistry(x, y, amount) {
    if (this.reducedMotion || this.seedFlow.length > 24) return;
    const n = Math.max(1, Math.min(4, Math.floor(Math.log10(Math.max(10, amount)))));
    for (let i = 0; i < n; i++) {
      this.seedFlow.push({
        sx: x + (i - n / 2) * 3, sy: y, tx: 8 + Math.random() * 6, ty: -4, t0: this.now + i * 0.09,
        dur: 0.9 + Math.random() * 0.25, bulge: (Math.random() - 0.3) * 18,
      });
    }
  }

  drawSeedFlow(ctx, t) {
    const list = this.seedFlow;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      const k = (t - s.t0) / s.dur;
      if (k >= 1) {
        list.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      const e = k * k * (3 - 2 * k);
      const x = Math.round(s.sx + (s.tx - s.sx) * e + Math.sin(e * Math.PI) * s.bulge);
      const y = Math.round(s.sy + (s.ty - s.sy) * e - Math.sin(e * Math.PI) * 6);
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.2);
      ctx.fillStyle = 'rgba(8,10,16,0.7)';
      ctx.fillRect(x + 1, y + 1, 2, 2);
      ctx.fillStyle = '#e8c070';
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = '#fff0b8';
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = '#7fd27a';
      ctx.fillRect(x + 1, y - 2, 1, 1);
      ctx.globalAlpha = 1;
    }
  }

  drawSparks(ctx) {
    for (const sp of this.sparks) {
      const k = 1 - sp.age / sp.life;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = sp.color;
      const z = k > 0.5 ? sp.size : Math.max(1, sp.size - 1);
      ctx.fillRect(Math.round(sp.x), Math.round(sp.y), z, z);
    }
    ctx.globalAlpha = 1;
  }

  drawScreenFlash(ctx, t) {
    const f = this.screenFlash;
    const age = t - f.t;
    if (age < 0 || age > 0.35 || this.reducedMotion) return;
    ctx.globalAlpha = f.a * (1 - age / 0.35);
    ctx.fillStyle = f.color;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalAlpha = 1;
  }

  /** A street WORD: Scripture proclaimed across the whole street. */
  onWord(count = 1, tier = 0) {
    this.kick.word = this.now;
    this.kick.wordTier = tier;
    this.kick.proclaim = this.now;
  }

  startMontage(duration) {
    this.montage = { start: this.now, duration };
  }

  endMontage() {
    this.montage = null;
  }

  // ---- geometry helpers for DOM overlays and input ----
  get feetY() {
    return this.H - 12;
  }

  /** Where the buildings meet the pavement. Above is sky and storefronts; below is the whole walkable street. */
  get groundTop() {
    return Math.round(this.H * 0.42);
  }

  focusAnchor() {
    return { x: this.focusX * this.scale, y: (this.feetY - 38) * this.scale };
  }

  protagonistAnchor() {
    return { x: 0.3 * this.W * this.scale, y: (this.feetY - 40) * this.scale };
  }

  hitSpecial(clientX, clientY, radiusPx) {
    if (!this.scale) return null;
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    let best = null;
    let bestD = radiusPx;
    for (const sp of this.game.crowd.specials) {
      if (sp.engaged) continue;
      const cx = sp.x * this.W * this.scale;
      const cy = (this.specialFeet() - 18) * this.scale;
      const d = Math.hypot(px - cx, py - cy);
      if (d <= bestD) {
        best = sp.id;
        bestD = d;
      }
    }
    return best;
  }

  specialFeet() {
    return this.feetY - 24;
  }

  idleFrame(t, phase = 0, rate = 1.35) {
    return this.reducedMotion ? 0 : Math.floor((t + phase) * rate) % 2;
  }

  walkCadence(speed01, stridePx = 1.9) {
    const artPerSecond = Math.max(6, speed01 * this.W);
    return Math.max(4, Math.min(16, artPerSecond / stridePx));
  }

  walkFrame(phase, speed01, stridePx = 1.9) {
    return Math.floor(phase * this.walkCadence(speed01, stridePx)) % 4;
  }

  drawStreetReflection(ctx, x, y, s, o, wp, strength = 1) {
    if (wp.restoration > 0.5 || strength <= 0) return;
    drawPersonReflection(ctx, x, y, s, { ...o, noSteam: true }, 0.24 * strength);
  }

  focusPose(enc, walking = false) {
    if (walking) return 'walk';
    const kit = enc.look?.kit;
    if (kit === 'skeptic') return 'idle';
    if (kit === 'broken') return 'react';
    if (kit === 'worker' || kit === 'visitor') return 'talk';
    if (kit === 'nominal') return 'hold';
    return 'idle';
  }

  /** The seed floating over someone whose situation you know: its tap area, so tapping the seed gathers and tapping them talks. */
  hitSeed(clientX, clientY, radiusPx = 26) {
    if (!this.scale) return null;
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    let best = null;
    let bestD = radiusPx;
    for (const sp of this.game.crowd.specials) {
      if (sp.engaged || !sp.treatment) continue;
      const d = Math.hypot(px - sp.x * this.W * this.scale, py - (this.specialFeet() - 44) * this.scale);
      if (d <= bestD) {
        best = sp.id;
        bestD = d;
      }
    }
    return best;
  }

  /** CSS-pixel position above someone at a horizontal fraction of the street (for numbers that rise from where a conversation was). */
  specialAnchorAt(x01) {
    return { x: x01 * this.W * this.scale, y: (this.specialFeet() - 40) * this.scale };
  }

  // ---- world parameters ----
  worldParams(t) {
    const game = this.game;
    const state = game.state;
    const gen = state.gen;
    const preview = state.phase === 'gen2preview';
    let restoration = preview ? 1 : 0;
    let night = 0;
    let age = 'adult';
    let protagX = 0.3;
    let youngX = null;
    if (this.montage) {
      const m = this.montage;
      const p = (t - m.start) / m.duration;
      restoration = smooth((p - 0.1) / 0.7);
      night = Math.max(0, 0.5 - 0.5 * Math.cos(p * Math.PI * 6)) * 0.75 * (1 - smooth((p - 0.72) / 0.2));
      const sec = t - m.start;
      if (sec < 2.2) age = 'adult';
      else age = 'old';
      protagX = sec < 2.2 ? 0.3 : 0.3 - 0.2 * smooth((sec - 2.2) / 2.6);
      if (sec > 6.4) youngX = -0.1 + 0.4 * smooth((sec - 6.4) / 2.4);
    } else if (preview) {
      age = 'old';
      protagX = 0.1;
      youngX = 0.3;
    }
    const levels = Object.values(gen.ministries).reduce((n, m) => n + m.owned, 0);
    const warmth = preview || this.montage ? 1 : Math.min(0.65, 0.65 * smooth(levels / 175));
    return { restoration, night, age, protagX, youngX, warmth, preview };
  }

  // ---- main draw ----
  draw(nowMs) {
    if (!this.scale) {
      this.resize();
      if (!this.scale) return;
    }
    const t = nowMs / 1000;
    this.now = t;
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const game = this.game;
    const state = game.state;
    const wp = this.worldParams(t);
    const R = wp.restoration;
    const groundTop = this.groundTop;

    ctx.save();
    if (!this.reducedMotion && t - this.kick.shake < this.shakeFx.dur) {
      ctx.translate(Math.round(Math.sin(t * 90) * this.shakeFx.amp), Math.round(Math.cos(t * 70) * this.shakeFx.amp));
    }

    this.drawSky(ctx, groundTop, wp, t);
    this.drawSkyline(ctx, groundTop, wp, t);
    this.drawBossBackdrop(ctx, groundTop, wp, t);
    this.drawGround(ctx, groundTop, wp, t);
    this.drawLamps(ctx, groundTop, wp, t);
    this.drawPeopleAndProps(ctx, groundTop, wp, t);
    if (game.boss?.stage === 'victory') this.celebrate(t);
    this.updateSparks(t);
    this.drawSparks(ctx);
    this.drawSeedFlow(ctx, t);
    if (R < 0.95) this.drawRain(ctx, wp, t);
    this.drawConversionEffects(ctx, t);
    this.drawVignette(ctx, wp);
    ctx.restore();
    this.drawScreenFlash(ctx, t);
    void state;
    void W;
  }

  drawSky(ctx, groundTop, wp, t) {
    const cached = getCachedScenery(this, groundTop, wp);
    if (cached) ctx.drawImage(cached.sky, 0, 0);
    void t;
  }

  drawSkyline(ctx, groundTop, wp, t) {
    const cached = getCachedScenery(this, groundTop, wp);
    if (cached) ctx.drawImage(cached.skyline, 0, 0);

    for (const b of this.buildings.near) {
      const localWarm = Math.max(wp.restoration * 0.9, stationWarmAt(b.x + b.w / 2, wp.warmth, this.W));
      if (wp.restoration < 0.85 && hash2(b.seed, 210) > 0.42) {
        const on = this.reducedMotion ? 1 : Math.sin(t * (2.8 + hash2(b.seed, 211) * 2) + b.seed) > -0.15;
        const signX = b.x + 2;
        const signY = groundTop - b.groundH - 5;
        const signW = b.w - 4;
        const glow = mix('#7096bc', '#ffb97a', Math.max(localWarm, 0.26));
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = on ? glow : mix(glow, '#293446', 0.7);
        ctx.globalAlpha = on ? 0.22 : 0.08;
        ctx.fillRect(signX - 1, signY - 1, signW + 2, 7);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      if (hash2(b.seed, 230) > 0.78) {
        const py = groundTop - b.h - 1 - (this.reducedMotion ? 0 : (Math.sin(t * 1.8 + b.seed) > 0.6 ? 1 : 0));
        const px = b.x + 3 + Math.floor(hash2(b.seed, 231) * Math.max(3, b.w - 8));
        ctx.fillStyle = '#c5ccd4';
        ctx.fillRect(px, py, 2, 1);
        ctx.fillRect(px + 1, py - 1, 1, 1);
        ctx.fillStyle = '#4b5260';
        ctx.fillRect(px - 1, py + 1, 3, 1);
      }
    }
  }

  drawBossBackdrop(ctx, groundTop) {
    const game = this.game;
    const gen = game.state.gen;
    if (game.state.phase !== 'gen1') return;
    const stage = game.inBoss ? 3 : gen.bossState.status === 'victory' ? 0 : gen.bossState.foreshadowStage;
    if (stage >= 1) {
      const x = sceneX(this.W, 0.5);
      const w = sceneSpan(this.W, 0.24, 30);
      const y = groundTop - 31;
      ctx.fillStyle = '#171a26';
      ctx.fillRect(x - 5, y + 1, 1, 18);
      ctx.fillRect(x + w + 4, y + 1, 1, 18);
      ctx.fillStyle = '#2d3345';
      ctx.fillRect(x - 4, y + 2, w + 8, 1);
      ctx.fillStyle = '#0e1118';
      ctx.fillRect(x - 1, y - 1, w + 2, 10);
      ctx.fillStyle = '#dfd5bf';
      ctx.fillRect(x, y, w, 8);
      ctx.fillStyle = '#f7ead3';
      ctx.fillRect(x + 1, y + 1, w - 2, 1);
      ctx.fillStyle = '#7c5349';
      ctx.fillRect(x, y + 7, w, 1);
      ctx.fillStyle = '#4a5061';
      ctx.fillRect(x + 3, y + 2, Math.max(8, w - 8), 1);
      ctx.fillRect(x + 6, y + 5, Math.max(6, w - 14), 1);
      ditherRect(ctx, x + 2, y + 3, Math.max(10, w - 4), 3, '#cabfa8', 1);
    }
    if (stage >= 2) {
      const px = sceneX(this.W, 0.73);
      ctx.fillStyle = '#4a3f33';
      ctx.fillRect(px - 1, groundTop + 1, 9, 2);
      ctx.fillStyle = '#6a5846';
      ctx.fillRect(px, groundTop + 3, 7, 5);
      ctx.fillStyle = '#201f26';
      ctx.fillRect(px + 2, groundTop - 6, 3, 9);
      ctx.fillStyle = '#e4bd96';
      ctx.fillRect(px + 2, groundTop - 9, 3, 3);
      ctx.fillStyle = '#c8d0dc';
      ctx.fillRect(px + 1, groundTop - 2, 1, 3);
      ctx.fillRect(px + 5, groundTop - 1, 1, 2);
    }
  }

  drawGround(ctx, groundTop, wp, t) {
    const cached = getCachedScenery(this, groundTop, wp);
    if (cached) ctx.drawImage(cached.ground, 0, 0);
    const W = this.W;
    const stationWarm = Math.max(wp.warmth, wp.restoration * 0.86);
    if (stationWarm > 0.04) {
      const pulse = this.reducedMotion ? 0.7 : 0.65 + 0.35 * Math.sin(t * 2.4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow1 = sceneSpan(W, 0.2 + stationWarm * 0.34, 20);
      const glow2 = sceneSpan(W, 0.13 + stationWarm * 0.22, 14);
      ctx.fillStyle = `rgba(233,182,112,${0.035 + stationWarm * 0.055 * pulse})`;
      ctx.fillRect(0, groundTop + 8, glow1, 26);
      ctx.fillRect(0, this.feetY - 26, glow2, 18);
      ditherRect(ctx, 0, this.feetY - 8, glow1, 6, `rgba(255,216,150,${0.06 + stationWarm * 0.08})`, 1);
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const lx of lampXs(W).slice(1, 4)) {
      const warm = Math.max(0.3, stationWarmAt(lx, wp.warmth, W));
      const glow = '255,190,112';
      ctx.fillStyle = `rgba(${glow},${0.025 + warm * 0.03})`;
      ctx.fillRect(lx, groundTop + 18, 1, 10);
      ctx.fillStyle = `rgba(${glow},${0.015 + warm * 0.02})`;
      ctx.fillRect(lx, groundTop + 28, 1, 6);
    }
    ctx.restore();
    for (const puddle of PUDDLES) {
      const px = sceneX(W, puddle.x);
      const py = groundTop + puddle.y;
      const pw = sceneSpan(W, puddle.w, 8);
      const phase = this.reducedMotion ? 0.25 : (t * (0.36 + puddle.seed * 0.04) + puddle.seed * 0.21) % 1;
      drawRipple(ctx, px + Math.min(pw - 3, 2 + (puddle.seed % Math.max(4, pw - 3))), py + 1, phase, 'rgba(202,224,246,0.22)');
    }
    if (!this.reducedMotion) {
      const steamX = sceneX(W, 0.58);
      const steamY = groundTop + 16;
      for (let i = 0; i < 4; i++) {
        const sway = Math.round(Math.sin(t * 1.6 + i * 0.9) * (1 + i * 0.3));
        const lift = Math.round((t * 8 + i * 4) % 12);
        ctx.fillStyle = `rgba(184,200,220,${0.06 - i * 0.01})`;
        ctx.fillRect(steamX + sway - i, steamY - lift - i * 2, 3, 1);
        ctx.fillRect(steamX + sway + 2, steamY - lift - i * 2 - 2, 2, 1);
      }
    }
  }

  drawLamps(ctx, groundTop, wp, t) {
    for (const lx of lampXs(this.W)) {
      const localWarm = Math.max(wp.restoration * 0.88, stationWarmAt(lx, wp.warmth, this.W));
      const glowOn = wp.restoration > 0.35 || wp.night > 0.2 || localWarm > 0.04 || hash2(lx, 91) > 0.38;
      const flicker = glowOn && !this.reducedMotion && wp.restoration < 0.7
        ? 0.9 + (Math.sin(t * (6.4 + hash2(lx, 2) * 2.2) + lx) > 0.2 ? 0.08 : 0)
        : 1;
      const headX = lx;
      const headY = groundTop - 18;
      ctx.fillStyle = '#0f1320';
      ctx.fillRect(headX, headY, 2, 28);
      ctx.fillStyle = '#4c5968';
      ctx.fillRect(headX, headY, 1, 27);
      ctx.fillStyle = '#101621';
      ctx.fillRect(headX + 1, headY, 1, 28);
      ctx.fillStyle = '#151b26';
      ctx.fillRect(headX, headY - 1, 6, 1);
      ctx.fillRect(headX + 5, headY - 1, 1, 5);
      ctx.fillRect(headX + 4, headY + 2, 4, 2);
      ctx.fillRect(headX - 1, groundTop + 8, 4, 2);
      if (!glowOn) continue;
      const warm = Math.max(localWarm, wp.restoration * 0.5, 0.3);
      const glow = '255,214,142';
      const halo = Math.min(0.34, (0.09 + warm * 0.15 + wp.night * 0.08) * flicker);
      ctx.fillStyle = '#6a4b2f';
      ctx.fillRect(headX + 5, headY + 1, 3, 4);
      ctx.fillStyle = '#ffd69a';
      ctx.fillRect(headX + 6, headY + 2, 2, 2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${glow},${halo * 0.6})`;
      ctx.fillRect(headX + 3, headY + 2, 7, 7);
      ctx.fillStyle = `rgba(${glow},${halo * 0.24})`;
      ctx.fillRect(headX - 1, headY + 1, 12, 8);
      ctx.fillStyle = `rgba(${glow},${halo * 0.14})`;
      ctx.fillRect(headX - 3, headY, 16, 10);
      const poolW = 12 + Math.round(warm * 16);
      const poolX = headX - 5;
      const poolY = groundTop + 8;
      ctx.fillStyle = `rgba(${glow},${halo * 0.24})`;
      ctx.fillRect(poolX, poolY, poolW, 4);
      ctx.fillStyle = `rgba(${glow},${halo * 0.12})`;
      ctx.fillRect(poolX - 2, poolY + 3, poolW + 4, 5);
      ctx.restore();
      ctx.fillStyle = '#ffe0ab';
      ctx.fillRect(headX + 6, headY + 1, 2, 1);
      ctx.fillStyle = '#fff3d3';
      ctx.fillRect(headX + 6, headY + 2, 2, 1);
    }
  }

  // ---- people ----
  queue(y, kind, ref, extra) {
    let item = this.items[this.itemCount];
    if (!item) {
      item = {};
      this.items[this.itemCount] = item;
    }
    item.y = y;
    item.kind = kind;
    item.ref = ref;
    item.extra = extra;
    this.itemCount++;
  }

  /** The crowd uses the whole pavement, from just in front of the shopfronts to just behind the player, in three depth lanes. */
  laneYs(groundTop) {
    const near = groundTop + 28;
    const far = this.feetY - 28;
    return [near, Math.round((near + far) / 2), Math.max(near + 8, far)];
  }

  pedFeet(p) {
    // friends of the work walk the far side of the street, out of the way of the people you tap
    if (p.far) return this.groundTop + 17 + (p.id % 2) * 3;
    return this.laneYs(this.groundTop)[p.lane] + (p.id % 3);
  }

  /** CSS-pixel position just above a pedestrian's head (for "+Seeds" feedback that says where it came from). */
  pedAnchor(id) {
    const p = this.game.crowd.peds.find((q) => q.id === id);
    if (!p || !this.scale) return null;
    return { x: p.x * this.W * this.scale, y: (this.pedFeet(p) - 24) * this.scale };
  }

  /** Nearest pedestrian with an open moment within radiusPx of the pointer (generous on touch screens). */
  hitPed(clientX, clientY, radiusPx) {
    if (!this.scale) return null;
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    let best = null;
    let bestD = radiusPx;
    for (const p of this.game.crowd.peds) {
      if (!p.opp || p.done || p.x < 0.02 || p.x > 0.98) continue;
      const cx = p.x * this.W * this.scale;
      const cy = (this.pedFeet(p) - 12) * this.scale;
      const d = Math.hypot(px - cx, py - cy);
      if (d <= bestD) {
        best = p.id;
        bestD = d;
      }
    }
    return best;
  }

  /** Where each ministry "lives" in the scene, in art pixels. */
  ministryArt(id, own) {
    const feet = this.feetY;
    const gt = this.groundTop;
    const workers = visualCounts(own.streetTeam || 0).workers;
    switch (id) {
      case 'tracts': return { x: 11, y: feet - 16 };
      case 'bibles': return { x: 22, y: feet - 17 };
      case 'streetTeam': return { x: 54 + Math.max(0, workers - 1) * 4.5, y: gt - 6 };
      case 'bibleStudy': return { x: 23, y: gt - 10 };
      case 'discipleship': return { x: this.W - 44, y: gt - 22 };
      default: return { x: 30, y: feet - 20 };
    }
  }

  /** CSS-pixel anchor of a ministry for tick numbers ("STREET TEAM +42"). */
  ministryAnchor(id) {
    if (!this.scale) return null;
    const state = this.game.state;
    const own = state.phase === 'gen2preview' ? state.prestige.legacy.ministries || {} : Object.fromEntries(Object.entries(state.gen.ministries).map(([k, v]) => [k, v.owned]));
    const a = this.ministryArt(id, own);
    return { x: a.x * this.scale, y: a.y * this.scale };
  }

  flashMinistry(id) {
    this.flash = { id, at: this.now };
  }

  drawPeopleAndProps(ctx, groundTop, wp, t) {
    const game = this.game;
    const state = game.state;
    const gen = state.gen;
    const feet = this.feetY;
    const R = wp.restoration;
    this.itemCount = 0;
    this.markersOn = state.phase === 'gen1' && !game.streetPaused && !this.montage;

    // crowd, three depth lanes
    const laneY = this.laneYs(groundTop);
    const conv = game.enc?.state === 'conversion' ? Math.sin(Math.PI * Math.min(1, game.enc.t / 5.2)) : 0;
    for (const p of game.crowd.peds) this.queue(this.pedFeet(p), 'ped', p, conv);

    this.queue(feet - 4, 'protagonist', wp);
    if (wp.preview || this.montage) {
      if (wp.youngX !== null) this.queue(feet - 3, 'young', wp);
    }

    // ministry made visible: every major ministry has a presence that grows at visual milestones
    const own = wp.preview ? state.prestige.legacy.ministries || {} : Object.fromEntries(Object.entries(gen.ministries).map(([k, v]) => [k, v.owned]));
    const believers = wp.preview || this.montage ? state.prestige.legacy.disciples || [] : gen.disciples.filter((d) => d.status === 'trained').map((d) => d.id);
    this.queue(feet + 20, 'props', own, wp);
    if (state.phase === 'gen1') {
      this.queue(feet + 21, 'supplies', gen.upgrades, 'front');
      this.queue(groundTop - 2, 'supplies', gen.upgrades, 'back'); // the van is parked behind the crowd
    }
    // The ministry's people live on the FAR side of the street, in front of the shopfronts, so the near pavement stays clear for tapping.
    const workers = visualCounts(own.streetTeam || 0).workers;
    const converts = state.phase === 'gen1' ? gen.conversionState.converts.slice(0, 5) : [];
    const slots = this.helperSlots(workers, believers.length, converts.length);
    this.slots = slots;
    slots.workers.forEach((sl, i) => this.queue(sl.y + 0.1 * i, 'worker', i, sl));
    believers.forEach((id, i) => this.queue(slots.believers[i].y + 0.1 * i, 'believer', id, slots.believers[i]));
    converts.forEach((c, i) => this.queue(slots.converts[i].y + 0.1 * i, 'convert', c.name, { slot: slots.converts[i], wp }));
    const study = visualCounts(own.bibleStudy || 0);
    if (study.studyAttendees) this.queue(groundTop + 11, 'study', study, wp);
    const gather = visualCounts(own.discipleship || 0);
    if (gather.gatherers) this.queue(groundTop + 12, 'gathering', gather, wp);
    if (R > 0.6) this.queue(groundTop + 18, 'families', 3, wp);

    // focus character
    const enc = game.activeEncounter;
    if (enc) this.queue(feet, 'focus', enc, wp);
    if (game.boss && (game.boss.stage === 'intro' || game.boss.stage === 'transition' || game.boss.stage === 'window' || game.boss.stage === 'victory' || game.boss.stage === 'passed')) {
      this.queue(feet, 'professor', game.boss, wp);
    }
    for (const sp of game.crowd.specials) this.queue(this.specialFeet(), 'special', sp, wp);

    const ordered = this.items.slice(0, this.itemCount).sort((a, b) => a.y - b.y);
    for (const it of ordered) {
      switch (it.kind) {
        case 'ped': this.drawPed(ctx, it.ref, wp, it.extra, laneY, t); break;
        case 'protagonist': this.drawProtagonist(ctx, wp, t, feet); break;
        case 'young': this.drawYoung(ctx, wp, t, feet); break;
        case 'props': this.drawProps(ctx, it.ref, wp, feet, t); break;
        case 'supplies': this.drawSupplies(ctx, it.ref, t, it.extra); break;
        case 'worker': this.drawWorker(ctx, it.ref, it.extra, wp, t); break;
        case 'believer': this.drawBeliever(ctx, it.ref, it.extra, wp, t); break;
        case 'convert': this.drawConvert(ctx, it.ref, it.extra.slot, it.extra.wp, t); break;
        case 'study': this.drawStudy(ctx, it.ref, wp, t, groundTop); break;
        case 'gathering': this.drawGathering(ctx, it.ref, wp, t, groundTop); break;
        case 'families': this.drawFamilies(ctx, wp, t, groundTop); break;
        case 'focus': this.drawFocus(ctx, it.ref, wp, t, feet); break;
        case 'professor': this.drawProfessor(ctx, it.ref, wp, t, feet); break;
        case 'special': this.drawSpecial(ctx, it.ref, it.extra, t); break;
        default: break;
      }
    }
    this.itemCount = 0;
    this.drawFlash(ctx, own, t);
    this.drawStandFirm(ctx, wp, t, feet);
    this.drawWordBurst(ctx, wp, t, feet);
    this.drawChapterTint(ctx);
  }

  drawMarker(ctx, x, y, t, p) {
    // A small speech bubble over someone who is open to a brief moment. WORD-ready markers switch to an open book and
    // gain a ring / crest so readiness still reads even without colour.
    if (p.oppLeft < 1.1 && p.oppLeft < 50 && Math.floor(t * 8) % 2 === 0) return;
    const word = this.game.wordReady;
    const pay = word ? this.game.wordPayout() : null;
    const tier = pay?.tier?.index || 0;
    const crest = !!pay?.crest;
    const bob = this.reducedMotion ? 0 : Math.round(Math.sin(t * 4.4 + p.id) * 1);
    const bx = x - 6;
    const by = y - 31 + bob;
    const fill = word ? '#e6c35e' : '#161b22';
    const edge = word ? '#fff3c2' : '#e6c35e';
    const ink = word ? '#17120a' : '#fff8e3';
    if (tier >= 2) {
      ctx.fillStyle = word ? 'rgba(255,224,140,0.24)' : 'rgba(255,224,140,0.14)';
      ctx.fillRect(bx - 2, by + 2, 17, 6);
      ctx.fillRect(bx, by - 1, 13, 12);
      ctx.fillRect(x - 4, by + 10, 9, 2);
    }
    if (tier >= 3) {
      ctx.fillStyle = 'rgba(255,244,205,0.42)';
      ctx.fillRect(bx - 2, by + 3, 1, 4);
      ctx.fillRect(bx + 14, by + 3, 1, 4);
      ctx.fillRect(bx + 1, by - 2, 3, 1);
      ctx.fillRect(bx + 9, by - 2, 3, 1);
    }
    ctx.fillStyle = word ? 'rgba(255,224,130,0.4)' : 'rgba(255,224,130,0.2)';
    ctx.fillRect(x - 5, y - 1, 10, 2);
    ctx.fillRect(x - 3, y - 3, 6, 2);
    if (word) {
      ctx.fillRect(x - 8, y - 1, 16, 1);
      ctx.fillRect(x - 1, by - 1, 3, 1);
      ctx.fillRect(x - 6, by, 1, 1);
      ctx.fillRect(x + 6, by, 1, 1);
    }
    if (word) {
      // The cost of holding WORD, made readable: a short fuse over each person whose moment is about to pass.
      const left = this.game.pedTimeLeft(p);
      const limit = this.game.balance.street.word.leavingSeconds * 2;
      if (left < limit) {
        const k = Math.max(0.08, left / limit);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(bx, by - 6, 13, 4);
        ctx.fillStyle = left < this.game.balance.street.word.leavingSeconds ? '#ff9a4a' : '#ffd98a';
        ctx.fillRect(bx + 1, by - 5, Math.max(1, Math.round(11 * k)), 2);
      }
    }
    if (word && crest) {
      ctx.fillStyle = '#fff7d0';
      ctx.fillRect(x - 3, by - 4, 7, 1);
      ctx.fillRect(x - 2, by - 5, 2, 1);
      ctx.fillRect(x + 1, by - 5, 2, 1);
      ctx.fillRect(x, by - 6, 1, 1);
    }
    ctx.fillStyle = edge;
    ctx.fillRect(bx + 1, by, 11, 10);
    ctx.fillRect(bx, by + 1, 13, 8);
    ctx.fillRect(x - 1, by + 9, 3, 2);
    ctx.fillRect(x, by + 11, 1, 1);
    ctx.fillStyle = fill;
    ctx.fillRect(bx + 2, by + 1, 9, 8);
    ctx.fillRect(bx + 1, by + 2, 11, 6);
    ctx.fillRect(x, by + 9, 1, 2);
    ctx.fillStyle = word ? '#f3d27a' : '#232934';
    ctx.fillRect(bx + 2, by + 1, 9, 1);
    ctx.fillStyle = ink;
    if (word) {
      ctx.fillRect(x - 4, by + 3, 3, 4);
      ctx.fillRect(x + 1, by + 3, 3, 4);
      ctx.fillRect(x, by + 2, 1, 6);
      ctx.fillRect(x - 3, by + 4, 2, 1);
      ctx.fillRect(x - 3, by + 6, 2, 1);
      ctx.fillRect(x + 2, by + 4, 2, 1);
      ctx.fillRect(x + 2, by + 6, 2, 1);
    } else {
      // a person: a round head, a gap, and shoulders
      ctx.fillRect(x - 1, by + 2, 3, 3);
      ctx.fillRect(x - 2, by + 3, 5, 1);
      ctx.fillRect(x - 2, by + 6, 5, 1);
      ctx.fillRect(x - 3, by + 7, 7, 1);
    }
  }

  drawPed(ctx, p, wp, conv, laneY, t) {
    const R = wp.restoration;
    const base = [0.2, 0.12, 0.06][p.lane];
    const lit = this.markersOn && p.opp && !p.done;
    let dim = Math.max(0.05, base * (1 - R * 0.8)) + conv * 0.3;
    if (this.game.inBoss) dim *= 0.8;
    if (lit) dim = Math.min(dim, 0.06);
    if (p.done) dim = Math.max(dim, 0.4);
    const look = lookFromInt(p.look);
    if (p.friend) look.accessory = 'book';
    else if (p.tag && EVENT_ACCESSORY[p.tag]) look.accessory = EVENT_ACCESSORY[p.tag];
    if (R > 0.5 && look.accessory === 'umbrella') look.accessory = 'none';
    const x = p.x * this.W;
    const y = this.pedFeet(p);
    const still = p.standing || p.hold;
    const frame = still ? this.idleFrame(t, p.id * 0.19) : this.walkFrame(p.phase, p.speed, 2.05);
    const protagX = wp.protagX * this.W;
    const dir = p.react > 0 ? (x > protagX ? -1 : 1) : p.dir;
    drawShadow(ctx, x, y, 8, 0.18);
    if (lit) {
      // warm = meaning: someone open to a moment stands in a small pool of gold light
      const pulse = this.reducedMotion ? 0.26 : 0.22 + 0.06 * Math.sin(t * 4 + p.id);
      ctx.fillStyle = `rgba(255,214,120,${pulse})`;
      ctx.fillRect(Math.round(x) - 7, Math.round(y) - 1, 14, 2);
      ctx.fillRect(Math.round(x) - 5, Math.round(y) - 3, 10, 2);
      ctx.fillStyle = `rgba(255,236,170,${pulse * 0.9})`;
      ctx.fillRect(Math.round(x) - 3, Math.round(y) - 1, 6, 1);
    }
    this.drawStreetReflection(ctx, x, y, 1, {
      look, dir, frame, dim: Math.min(0.8, dim), fog: FOG, pose: p.react > 0 ? 'react' : still ? 'idle' : 'walk',
      bob: still ? frame : frame & 1, time: t,
    }, wp, 0.5 - p.lane * 0.1);
    drawPerson(ctx, x, y, 1, {
      look, dir, frame, dim: Math.min(0.8, dim), fog: FOG, pose: p.react > 0 ? 'react' : still ? 'idle' : 'walk',
      bob: still ? frame : frame & 1, time: t,
    });
    if (p.done) {
      ctx.fillStyle = '#f4eed8';
      ctx.fillRect(Math.round(x + (dir > 0 ? 3 : -5)), y - 9, 3, 4);
    }
    if (p.friend) {
      ctx.fillStyle = '#e0c070';
      ctx.fillRect(Math.round(x - 1), y - 25 - (this.reducedMotion ? 0 : Math.round(Math.sin(t * 3 + p.id))), 2, 2);
    }
    if (lit) this.drawMarker(ctx, x, y, t, p);
  }

  protagLook(wp) {
    return wp.age === 'old' ? PROTAGONIST.old : PROTAGONIST.adult;
  }

  drawProtagonist(ctx, wp, t, feet) {
    const x = wp.protagX * this.W;
    let pose = this.game.activeEncounter || (this.game.boss && this.game.inBoss) ? 'talk' : 'hold';
    const firm = this.game.street.standFirm && !this.montage;
    if (t - this.kick.proclaim < 0.22) pose = 'proclaim';
    else if (firm && Math.floor(t * 3) % 2 === 0) pose = 'proclaim';
    const walking = this.montage && wp.age === 'old' && x > 0.12 * this.W + 1;
    const frame = walking ? this.walkFrame(t, 0.11, 1.7) : this.idleFrame(t, 0.12);
    if (firm) {
      ctx.fillStyle = `rgba(255,214,120,${0.12 + (this.reducedMotion ? 0 : 0.05 * Math.sin(t * 6))})`;
      ctx.fillRect(Math.round(x - 14), feet - 42, 28, 44);
    }
    drawShadow(ctx, x, feet, 18, 0.3);
    this.drawStreetReflection(ctx, x, feet, 2, {
      look: this.protagLook(wp), dir: 1, pose: walking ? 'walk' : pose, frame, bob: frame & 1, age: wp.age, eyes: true, beard: wp.age === 'old', time: t,
    }, wp, 1);
    drawPerson(ctx, x, feet, 2, {
      look: this.protagLook(wp), dir: 1, pose: walking ? 'walk' : pose, frame, bob: walking ? frame & 1 : frame, age: wp.age,
      eyes: true, beard: wp.age === 'old', time: t,
    });
    if (wp.age === 'old') {
      ctx.fillStyle = '#6a4a30';
      ctx.fillRect(Math.round(x + 9), feet - 22, 2, 22);
    }
  }

  drawYoung(ctx, wp, t, feet) {
    const x = wp.youngX * this.W;
    const arriving = this.montage && x < 0.3 * this.W - 1;
    const frame = arriving ? this.walkFrame(t, 0.11, 1.7) : this.idleFrame(t, 0.34);
    drawShadow(ctx, x, feet, 18, 0.3);
    this.drawStreetReflection(ctx, x, feet, 2, {
      look: PROTAGONIST.young, dir: 1, pose: arriving ? 'walk' : 'hold', frame, eyes: true, bob: frame & 1, time: t,
    }, wp, 0.96);
    drawPerson(ctx, x, feet, 2, {
      look: PROTAGONIST.young, dir: 1, pose: arriving ? 'walk' : 'hold', frame, eyes: true,
      bob: arriving ? frame & 1 : frame, time: t,
    });
  }

  /**
   * The literature table and its growth. Tracts: piles -> more piles -> a rack -> a second table.
   * Bibles: a stack -> more stacks -> crates -> a distribution display. (Milestones from config.visualMilestones.)
   */
  drawProps(ctx, own, wp, feet, t) {
    const R = wp.restoration;
    const vt = visualCounts(wp.preview ? Math.max(own.tracts || 0, 1) : own.tracts || 0);
    const vb = visualCounts(own.bibles || 0);
    const y = feet;
    ctx.fillStyle = mix('#5a4636', '#8a6a46', R);
    ctx.fillRect(3, y - 9, 24, 3);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(5, y - 6, 1, 6);
    ctx.fillRect(24, y - 6, 1, 6);
    const paper = ['#f4eed8', '#e8e0c8', '#e6d9b0'];
    for (let k = 0; k < Math.min(3, vt.tractStacks); k++) {
      const h = 2 + Math.min(vt.tier, 3);
      ctx.fillStyle = paper[k % 3];
      ctx.fillRect(10 + k * 4, y - 9 - h, 3, h);
    }
    if (vt.tractStacks >= 3) {
      // literature rack at the end of the table
      ctx.fillStyle = '#3a2c20';
      ctx.fillRect(3, y - 20, 6, 11);
      const rows = ['#c9784a', '#5c8a62', '#6a8ac0', '#e6d9b0'];
      for (let r = 0; r < 4; r++) {
        ctx.fillStyle = rows[r];
        ctx.fillRect(4, y - 19 + r * 2.5, 4, 2);
      }
    }
    if (vt.tractStacks >= 4) {
      // second table in front, loaded with tracts
      ctx.fillStyle = mix('#5a4636', '#8a6a46', R);
      ctx.fillRect(2, y - 2, 20, 2);
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(4, y, 1, 3);
      ctx.fillRect(19, y, 1, 3);
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = paper[k % 3];
        ctx.fillRect(4 + k * 3, y - 5, 2, 3);
      }
    }
    for (let k = 0; k < Math.min(3, vb.bibleStacks); k++) {
      const h = 2 + k;
      ctx.fillStyle = '#4a3226';
      ctx.fillRect(17 + k * 3, y - 9 - h * 1, 3, h);
      ctx.fillStyle = '#d6b45a';
      ctx.fillRect(18 + k * 3, y - 9 - h, 1, 1);
    }
    if (vb.bibleStacks >= 3) {
      // crates of Bibles beside the table
      ctx.fillStyle = '#6a5238';
      ctx.fillRect(27, y - 5, 5, 5);
      ctx.fillStyle = '#d6b45a';
      ctx.fillRect(28, y - 4, 3, 1);
      if (vb.bibleStacks >= 4) {
        ctx.fillStyle = '#6a5238';
        ctx.fillRect(27, y - 10, 5, 5);
        ctx.fillStyle = '#d6b45a';
        ctx.fillRect(28, y - 9, 3, 1);
      }
    }
    if ((own.tracts || 0) > 0 || wp.preview) {
      // sign with a cross
      const sx = 10;
      ctx.fillStyle = '#12151b';
      ctx.fillRect(sx + 6, y - 31, 1, 22);
      ctx.fillStyle = mix('#cfc7ae', '#f2ead0', R);
      ctx.fillRect(sx, y - 34, 14, 9);
      ctx.fillStyle = '#7a5a30';
      ctx.fillRect(sx + 6, y - 32, 2, 6);
      ctx.fillRect(sx + 4, y - 30, 6, 2);
    }
    void t;
  }

  // ---- supplies: what Provisions buy shows up on the street ----
  /** Where each supply sits in the scene (art pixels), also where its purchase sparkles. */
  supplyBox(id) {
    const y = this.feetY;
    const gt = this.groundTop;
    switch (id) {
      case 'literatureBundle': return { x: 5, y: y - 6, w: 16, h: 6 };
      case 'betterBibleSupply': return { x: 34, y: y - 6, w: 6, h: 6 };
      case 'rainGear': return { x: 0, y: y - 43, w: 34, h: 7 };
      case 'transportation': return { x: this.W - 36, y: gt + 8, w: 26, h: 14 };
      case 'portableMicrophone': return { x: 44, y: y - 19, w: 9, h: 19 };
      case 'foldingTables': return { x: this.W - 32, y: y - 10, w: 26, h: 13 };
      case 'meetingSpace': return { x: 76, y: y - 22, w: 14, h: 22 };
      default: return null;
    }
  }

  /** A new supply was just set out: sparkle on it, and light it up for a moment. */
  supplyAppeared(id) {
    const b = this.supplyBox(id);
    if (!b) return;
    this.supplyGlow = { id, at: this.now };
    this.burst(b.x + b.w / 2, b.y + b.h / 2, { n: 26, color: '#ffe9a8', speed: 36, life: 0.7, gravity: 40 });
  }

  drawSupplies(ctx, up, t, layer) {
    for (const id of ['rainGear', 'transportation', 'foldingTables', 'meetingSpace', 'portableMicrophone', 'literatureBundle', 'betterBibleSupply']) {
      if (!up[id] || (id === 'transportation') !== (layer === 'back')) continue;
      const b = this.supplyBox(id);
      const { x, y, w } = b;
      switch (id) {
        case 'literatureBundle':
          ctx.fillStyle = '#b98a52';
          ctx.fillRect(x, y + 1, 8, 5);
          ctx.fillStyle = '#e8d29a';
          ctx.fillRect(x + 3, y + 1, 2, 5);
          ctx.fillStyle = '#a67a46';
          ctx.fillRect(x + 9, y + 2, 7, 4);
          ctx.fillStyle = '#f4eed8';
          ctx.fillRect(x + 10, y, 5, 2);
          break;
        case 'betterBibleSupply':
          ctx.fillStyle = '#6a5238';
          ctx.fillRect(x, y, 6, 6);
          ctx.fillStyle = '#4a3a28';
          ctx.fillRect(x, y + 3, 6, 1);
          ctx.fillStyle = '#d6b45a';
          ctx.fillRect(x + 2, y + 1, 1, 4);
          ctx.fillRect(x + 1, y + 2, 3, 1);
          break;
        case 'rainGear':
          ctx.fillStyle = '#2a2018';
          ctx.fillRect(x + 1, y + 5, 1, 29);
          ctx.fillRect(x + w - 2, y + 5, 1, 29);
          for (let i = 0; i < w; i += 4) {
            ctx.fillStyle = (i / 4) % 2 === 0 ? '#c9503f' : '#efe6d0';
            ctx.fillRect(x + i, y, Math.min(4, w - i), 4);
            ctx.fillRect(x + i + 1, y + 4, 2, 1);
          }
          break;
        case 'transportation':
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#d9d4c4';
          ctx.fillRect(x, y, 18, 11);
          ctx.fillStyle = '#c9c4b2';
          ctx.fillRect(x + 18, y + 4, 8, 7);
          ctx.fillStyle = '#6a8aa8';
          ctx.fillRect(x + 21, y + 5, 4, 3);
          ctx.fillStyle = '#5c8a62';
          ctx.fillRect(x, y + 8, 26, 2);
          ctx.fillStyle = '#7a5a30';
          ctx.fillRect(x + 8, y + 2, 2, 5);
          ctx.fillRect(x + 6, y + 3, 6, 2);
          ctx.fillStyle = '#14161a';
          ctx.fillRect(x + 3, y + 10, 5, 4);
          ctx.fillRect(x + 18, y + 10, 5, 4);
          ctx.globalAlpha = 1;
          break;
        case 'portableMicrophone':
          ctx.fillStyle = '#1a1c22';
          ctx.fillRect(x + 1, y + 17, 6, 2);
          ctx.fillStyle = '#8c93a3';
          ctx.fillRect(x + 4, y + 4, 1, 13);
          ctx.fillStyle = '#2a2d36';
          ctx.fillRect(x + 3, y + 1, 3, 4);
          ctx.fillStyle = '#aab2c4';
          ctx.fillRect(x + 4, y + 2, 1, 2);
          if (t - this.kick.proclaim < 0.3) {
            ctx.fillStyle = '#fff4c8';
            ctx.fillRect(x + 7, y + 2, 1, 3);
            ctx.fillRect(x + 9, y + 1, 1, 5);
          }
          break;
        case 'foldingTables':
          ctx.fillStyle = '#7a6a54';
          ctx.fillRect(x, y + 4, 18, 2);
          ctx.fillStyle = '#2a2018';
          ctx.fillRect(x + 2, y + 6, 1, 6);
          ctx.fillRect(x + 15, y + 6, 1, 6);
          ctx.fillStyle = '#f4eed8';
          ctx.fillRect(x + 4, y + 2, 3, 2);
          ctx.fillStyle = '#d6b45a';
          ctx.fillRect(x + 9, y + 2, 2, 2);
          ctx.fillStyle = '#4a5a7a';
          ctx.fillRect(x + 21, y + 5, 4, 2);
          ctx.fillRect(x + 21, y, 1, 5);
          ctx.fillStyle = '#2a2018';
          ctx.fillRect(x + 21, y + 7, 1, 5);
          ctx.fillRect(x + 24, y + 7, 1, 5);
          break;
        case 'meetingSpace':
          ctx.fillStyle = '#5a4636';
          ctx.fillRect(x + 2, y + 12, 1, 10);
          ctx.fillRect(x + 6, y + 12, 1, 10);
          ctx.fillRect(x + 11, y + 12, 1, 10);
          ctx.fillStyle = '#e8e0c8';
          ctx.fillRect(x, y, 14, 13);
          ctx.fillStyle = '#7a5a30';
          ctx.fillRect(x + 2, y + 1, 6, 1);
          ctx.fillStyle = '#7a8aa0';
          ctx.fillRect(x + 2, y + 4, 10, 1);
          ctx.fillRect(x + 2, y + 7, 7, 1);
          ctx.fillRect(x + 2, y + 10, 9, 1);
          break;
        default: break;
      }
    }
    const g = this.supplyGlow;
    if (g && (g.id === 'transportation') === (layer === 'back') && !this.reducedMotion && t - g.at < 1.4) {
      const b = this.supplyBox(g.id);
      ctx.globalAlpha = 0.45 * (1 - (t - g.at) / 1.4);
      ctx.fillStyle = '#fff4c8';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
    }
  }

  /** Where the ministry's own people stand: a row along the far side of the street, shared out across the width. */
  helperSlots(nw, nb, nc) {
    const start = 54;
    const end = this.W - 8;
    const gap = Math.min(9, (end - start) / Math.max(1, nw + nb + nc));
    const y = this.groundTop + 16;
    let k = 0;
    const take = (n) => Array.from({ length: n }, (_, i) => ({ x: Math.round(start + gap * k++), y: y + (i % 2) * 2, i }));
    return { workers: take(nw), believers: take(nb), converts: take(nc) };
  }

  /** A street-team worker: stands on the far side of the street and periodically hands out a tract. */
  drawWorker(ctx, i, slot, wp, t) {
    const x = slot.x;
    const y = slot.y;
    const look = lookFromInt(9000 + i * 7919);
    look.accessory = 'none';
    look.top = '#c9822f';
    const cycle = this.reducedMotion ? 9 : (t * 0.7 + i * 1.9) % 4.2;
    const giving = cycle < 0.7;
    drawShadow(ctx, x, y, 8, 0.2);
    this.drawStreetReflection(ctx, x, y, 1, { look, dir: 1, dim: Math.max(0, 0.06 - wp.restoration * 0.06), fog: FOG, pose: giving ? 'proclaim' : 'idle', frame: this.idleFrame(t, i * 0.29), bob: !giving && Math.sin(t * 1.5 + i) > 0.8 ? 1 : 0, time: t }, wp, 0.66);
    drawPerson(ctx, x, y, 1, { look, dir: 1, dim: Math.max(0, 0.06 - wp.restoration * 0.06), fog: FOG, pose: giving ? 'proclaim' : 'idle', frame: this.idleFrame(t, i * 0.29), bob: !giving && Math.sin(t * 1.5 + i) > 0.8 ? 1 : 0, time: t });
    if (giving) {
      ctx.fillStyle = '#f4eed8';
      ctx.fillRect(Math.round(x + 5 + (cycle / 0.7) * 9), y - 12, 3, 2);
    } else {
      ctx.fillStyle = '#f4eed8';
      ctx.fillRect(x + 4, y - 9, 2, 3);
    }
  }

  drawBeliever(ctx, id, slot, wp, t) {
    const def = DISCIPLES[id];
    if (!def) return;
    const i = slot.i;
    const x = slot.x;
    const y = slot.y;
    const look = { ...def.look, hairStyle: i % 3, accessory: 'book' };
    const cycle = this.reducedMotion ? 9 : (t * 0.5 + i * 2.3) % 5;
    const teaching = cycle < 1;
    drawShadow(ctx, x, y, 8, 0.2);
    this.drawStreetReflection(ctx, x, y, 1, { look, dir: 1, bob: !teaching && Math.sin(t * 1.2 + i * 2) > 0.8 ? 1 : 0, pose: teaching ? 'proclaim' : 'idle', eyes: false, frame: this.idleFrame(t, i * 0.21), time: t }, wp, 0.62);
    drawPerson(ctx, x, y, 1, { look, dir: 1, bob: !teaching && Math.sin(t * 1.2 + i * 2) > 0.8 ? 1 : 0, pose: teaching ? 'proclaim' : 'idle', eyes: false, frame: this.idleFrame(t, i * 0.21), time: t });
    ctx.fillStyle = '#e0c070';
    ctx.fillRect(x - 1, y - 23, 2, 2);
  }

  /** Someone who came to Christ, back on the street handing out tracts. Look is derived from the name so it is stable. */
  drawConvert(ctx, name, slot, wp, t) {
    const i = slot.i;
    const x = slot.x;
    const y = slot.y;
    let h = 0;
    for (let k = 0; k < name.length; k++) h = (h * 31 + name.charCodeAt(k)) % 1000003;
    const look = { ...lookFromInt(h % 1000000), accessory: 'bag' };
    const cycle = this.reducedMotion ? 9 : (t * 0.45 + i * 1.7) % 5;
    const giving = cycle < 1;
    drawShadow(ctx, x, y, 8, 0.2);
    this.drawStreetReflection(ctx, x, y, 1, { look, dir: -1, pose: giving ? 'proclaim' : 'idle', bob: !giving && Math.sin(t * 1.1 + i * 2) > 0.85 ? 1 : 0, eyes: true, frame: this.idleFrame(t, i * 0.37), time: t }, wp, 0.62);
    drawPerson(ctx, x, y, 1, { look, dir: -1, pose: giving ? 'proclaim' : 'idle', bob: !giving && Math.sin(t * 1.1 + i * 2) > 0.85 ? 1 : 0, eyes: true, frame: this.idleFrame(t, i * 0.37), time: t });
    ctx.fillStyle = '#e8d9a0';
    ctx.fillRect(x - 1, y - 25, 3, 2);
  }

  convertAnchor(i) {
    if (!this.scale) return null;
    const slot = this.slots?.converts[i];
    if (!slot) return null;
    return { x: slot.x * this.scale, y: (slot.y - 26) * this.scale };
  }

  drawStudy(ctx, v, wp, t, groundTop) {
    const x0 = 6;
    const y = groundTop + 11;
    const count = v.studyAttendees;
    const width = 14 + count * 5;
    // a warm lamp and bench: the Bible study indicator; it becomes more established at milestones
    ctx.fillStyle = 'rgba(255,214,130,0.16)';
    ctx.fillRect(x0 - 2, y - 24, width + 6, 24);
    ctx.fillStyle = '#5a4636';
    ctx.fillRect(x0, y - 4, width, 3);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(x0 + 2, y - 1, 1, 3);
    ctx.fillRect(x0 + width - 3, y - 1, 1, 3);
    if (v.tier >= 3) {
      ctx.fillStyle = '#7a4a3a';
      ctx.fillRect(x0 - 1, y - 27, width + 2, 3);
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(x0, y - 24, 1, 20);
      ctx.fillRect(x0 + width - 1, y - 24, 1, 20);
    }
    for (let i = 0; i < count; i++) {
      const look = lookFromInt(5500 + i * 3571);
      look.accessory = 'none';
      const x = x0 + 5 + i * 5.5;
      this.drawStreetReflection(ctx, Math.round(x), y - 3, 1, { look, dir: i % 2 ? -1 : 1, dim: 0.04, fog: FOG, pose: 'idle', frame: this.idleFrame(t, i * 0.41), bob: !this.reducedMotion && Math.sin(t * 0.8 + i * 2) > 0.92 ? 1 : 0, time: t }, wp, 0.54);
      drawPerson(ctx, Math.round(x), y - 3, 1, { look, dir: i % 2 ? -1 : 1, dim: 0.04, fog: FOG, pose: 'idle', frame: this.idleFrame(t, i * 0.41), bob: !this.reducedMotion && Math.sin(t * 0.8 + i * 2) > 0.92 ? 1 : 0, time: t });
      ctx.fillStyle = '#f2ead0';
      ctx.fillRect(Math.round(x) - 1, y - 9, 3, 2);
    }
    const flick = this.reducedMotion ? 0 : Math.sin(t * 5) > 0 ? 1 : 0;
    ctx.fillStyle = flick ? '#ffe9a0' : '#ffd070';
    ctx.fillRect(x0 + Math.round(width / 2), y - 22, 3, 3);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(x0 + Math.round(width / 2) + 1, y - 19, 1, 15);
    void wp;
  }

  drawGathering(ctx, v, wp, t, groundTop) {
    const x0 = this.W - 58;
    const y = groundTop + 12;
    const count = v.gatherers;
    // banner with a cross over a growing gathering of believers
    ctx.fillStyle = '#12151b';
    ctx.fillRect(x0 + 12, y - 36, 1, 36);
    ctx.fillStyle = '#e7dcc0';
    ctx.fillRect(x0 + 4, y - 38, 18, 10);
    ctx.fillStyle = '#7a3a2a';
    ctx.fillRect(x0 + 12, y - 36, 2, 7);
    ctx.fillRect(x0 + 9, y - 34, 8, 2);
    if (v.tier >= 3) {
      ctx.fillStyle = '#12151b';
      ctx.fillRect(x0 + 30, y - 28, 1, 28);
      ctx.fillStyle = '#c9b48a';
      ctx.fillRect(x0 + 25, y - 30, 11, 7);
      ctx.fillStyle = '#7a3a2a';
      ctx.fillRect(x0 + 30, y - 29, 2, 5);
      ctx.fillRect(x0 + 28, y - 27, 6, 2);
    }
    if (v.tier >= 4) {
      ctx.fillStyle = '#5c8a62';
      ctx.fillRect(x0 + 1, y - 22, 36, 3);
    }
    for (let i = 0; i < count; i++) {
      const look = lookFromInt(7700 + i * 2113);
      look.accessory = 'none';
      const x = x0 + 4 + i * 5;
      const bob = this.reducedMotion ? 0 : Math.sin(t + i * 1.7) > 0.85 ? 1 : 0;
      this.drawStreetReflection(ctx, x, y - (i % 2) * 2, 1, { look, dir: i < count / 2 ? 1 : -1, dim: 0.06, fog: FOG, bob, frame: this.idleFrame(t, i * 0.31), time: t }, wp, 0.56);
      drawPerson(ctx, x, y - (i % 2) * 2, 1, { look, dir: i < count / 2 ? 1 : -1, dim: 0.06, fog: FOG, bob, frame: this.idleFrame(t, i * 0.31), time: t });
    }
    void wp;
  }

  /** Expanding ring where a ministry just reached a milestone. */
  drawFlash(ctx, own, t) {
    const f = this.flash;
    if (!f) return;
    const age = t - f.at;
    if (age > 1.2 || this.reducedMotion) {
      if (age > 1.2) this.flash = null;
      return;
    }
    const a = this.ministryArt(f.id, own);
    const r = 4 + age * 16;
    ctx.fillStyle = `rgba(255,224,130,${0.5 * (1 - age / 1.2)})`;
    ctx.fillRect(Math.round(a.x - r), Math.round(a.y - 1), Math.round(r * 2), 2);
    ctx.fillRect(Math.round(a.x - 1), Math.round(a.y - r), 2, Math.round(r * 2));
    ctx.fillRect(Math.round(a.x - r * 0.7), Math.round(a.y - r * 0.7), 2, 2);
    ctx.fillRect(Math.round(a.x + r * 0.7), Math.round(a.y - r * 0.7), 2, 2);
    ctx.fillRect(Math.round(a.x - r * 0.7), Math.round(a.y + r * 0.7), 2, 2);
    ctx.fillRect(Math.round(a.x + r * 0.7), Math.round(a.y + r * 0.7), 2, 2);
  }

  /** Warm light and rays while the Stand Firm power state is active. */
  drawStandFirm(ctx, wp, t, feet) {
    if (!this.game.street.standFirm || this.montage) return;
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(255,205,110,${0.05 + 0.03 * pulse})`;
    ctx.fillRect(0, 0, this.W, this.H);
    const px = wp.protagX * this.W;
    ctx.fillStyle = `rgba(255,226,150,${0.07 + 0.04 * pulse})`;
    for (let k = -3; k <= 3; k++) ctx.fillRect(Math.round(px + k * 7 - 1), 0, 3, feet);
  }

  /** The day moves on: a light wash that warms toward evening. Subtle on purpose. */
  drawChapterTint(ctx) {
    if (this.montage || this.game.state.phase !== 'gen1') return;
    const tint = [null, 'rgba(255,238,190,0.05)', 'rgba(255,184,100,0.07)', 'rgba(255,140,90,0.09)'][this.game.chapterIndex];
    if (!tint) return;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  /** A band of light sweeping outward across the street when WORD is proclaimed. Brief and translucent. */
  drawWordBurst(ctx, wp, t, feet) {
    const tier = this.kick.wordTier || 0;
    const dur = 0.9 + 0.2 * tier; // a bigger street rings out longer and with more waves
    const age = t - this.kick.word;
    if (age < 0 || age > dur || this.montage) return;
    const px = Math.round(wp.protagX * this.W);
    const waves = this.reducedMotion ? 1 : 1 + Math.min(3, tier);
    for (let w = 0; w < waves; w++) {
      const k = (age - w * 0.14) / dur;
      if (k < 0 || k > 1) continue;
      const r = Math.round(k * this.W * 0.95);
      const a = (1 - k) * (this.reducedMotion ? 0.14 : 0.3 + 0.04 * tier);
      if (w === 0) {
        ctx.fillStyle = `rgba(255,226,150,${a * 0.35})`;
        ctx.fillRect(0, 0, this.W, feet + 2);
      }
      ctx.fillStyle = `rgba(255,232,160,${a})`;
      ctx.fillRect(px + r - 3, 0, 6, feet + 2);
      ctx.fillRect(px - r - 3, 0, 6, feet + 2);
    }
  }

  drawFamilies(ctx, wp, t, groundTop) {
    const y = groundTop + 22;
    const sets = [[84, 1], [92, 1], [88, 0]];
    sets.forEach(([x, kid], i) => {
      const look = lookFromInt(3300 + i * 1777);
      look.accessory = 'none';
      const bob = this.reducedMotion ? 0 : Math.sin(t * 2 + i) > 0.9 ? 1 : 0;
      this.drawStreetReflection(ctx, x, y + (kid ? 3 : 0), 1, { look, dir: -1, bob, dim: 0, frame: this.idleFrame(t, i * 0.27), time: t }, wp, 0.58);
      drawPerson(ctx, x, y + (kid ? 3 : 0), 1, { look, dir: -1, bob, dim: 0, frame: this.idleFrame(t, i * 0.27), time: t });
      if (kid) {
        ctx.fillStyle = '#e66a5a';
        ctx.fillRect(x + 3, y - 14, 2, 3);
      }
    });
  }

  focusLook(enc) {
    if (enc.kind === 'special') return { ...enc.look, hairStyle: enc.look.hairStyle ?? 1 };
    return lookFromInt(enc.look);
  }

  drawFocus(ctx, enc, wp, t, feet) {
    const W = this.W;
    const cfg = this.game.balance.encounter;
    const homeX = 0.7 * W;
    let x = homeX;
    let alpha = 1;
    if (enc.kind === 'boss') {
      x = homeX;
    } else if (enc.state === 'focusEnter') {
      x = homeX + (1 - smooth(enc.t / cfg.focusEnter)) * (W * 0.5);
    } else if (enc.state === 'focusExit') {
      const k = smooth(enc.t / cfg.focusExit);
      x = homeX + k * W * 0.5;
      alpha = 1 - k * 0.6;
    }
    this.focusX = x;
    ctx.globalAlpha = alpha;
    const isBoss = enc.kind === 'boss';
    const bossHurt = isBoss && t - this.kick.bossHit < 0.5;
    const hit = (t - this.kick.react < 0.14 && enc.state === 'active') || (bossHurt && !this.reducedMotion);
    const recoil = bossHurt && !this.reducedMotion ? Math.round(Math.sin((t - this.kick.bossHit) * 40) * 2 * (1 - (t - this.kick.bossHit) / 0.5)) : 0;
    const walking = enc.state === 'focusEnter' || enc.state === 'focusExit';
    // spotlight: focused people are clearer, larger, and framed
    ctx.fillStyle = 'rgba(255,240,200,0.12)';
    ctx.fillRect(Math.round(x - 14), feet - 44, 28, 46);
    ctx.fillStyle = 'rgba(255,240,200,0.12)';
    ctx.fillRect(Math.round(x - 11), feet - 47, 22, 3);
    drawShadow(ctx, x, feet, 18, 0.32);
    const frame = walking
      ? this.walkFrame(t, 0.5 / (enc.state === 'focusEnter' ? cfg.focusEnter : cfg.focusExit), 1.8)
      : this.idleFrame(t, enc.variantIndex || 0.23, 1.15);
    // in the argument it is the Professor himself at the lectern, not a stand-in
    const pose = isBoss ? (bossHurt ? 'react' : 'talk') : this.focusPose(enc, walking);
    const look = isBoss ? PROFESSOR : this.focusLook(enc);
    const extra = isBoss ? { glasses: true, scarf: '#7a3a3a' } : {};
    const px = x + (hit ? 1 : 0) + recoil;
    this.drawStreetReflection(ctx, px, feet, 2, {
      look, dir: -1, pose, frame, eyes: true, bob: walking ? frame & 1 : frame, time: t, ...extra,
    }, wp, 1);
    drawPerson(ctx, px, feet, 2, {
      look, dir: -1, pose, frame,
      eyes: true, bob: walking ? frame & 1 : frame, time: t, ...extra,
    });
    ctx.globalAlpha = 1;
    if (enc.state === 'active' || enc.state === 'outcome' || enc.state === 'conversion') {
      // corner brackets: a non-colour cue that this person is in focus
      ctx.fillStyle = enc.kind === 'special' ? '#ffd98a' : '#e8e0c4';
      const bx = Math.round(x - 14);
      const by = feet - 46;
      ctx.fillRect(bx, by, 4, 1);
      ctx.fillRect(bx, by, 1, 4);
      ctx.fillRect(bx + 24, by, 4, 1);
      ctx.fillRect(bx + 27, by, 1, 4);
      ctx.fillRect(bx, feet + 1, 4, 1);
      ctx.fillRect(bx, feet - 2, 1, 4);
      ctx.fillRect(bx + 24, feet + 1, 4, 1);
      ctx.fillRect(bx + 27, feet - 2, 1, 4);
    }
    if (enc.kind === 'boss') this.drawLectern(ctx, x, feet);
  }

  drawLectern(ctx, x, feet) {
    ctx.fillStyle = '#4a3a2c';
    ctx.fillRect(Math.round(x - 8), feet - 12, 16, 12);
    ctx.fillStyle = '#6a5640';
    ctx.fillRect(Math.round(x - 9), feet - 14, 18, 3);
  }

  drawProfessor(ctx, boss, wp, t, feet) {
    const x = 0.7 * this.W;
    this.focusX = x;
    drawShadow(ctx, x, feet, 18, 0.32);
    const frame = this.idleFrame(t, 0.31, 1.1);
    const pose = boss.stage === 'transition' ? 'react' : 'talk';
    this.drawStreetReflection(ctx, x, feet, 2, { look: PROFESSOR, dir: -1, eyes: true, glasses: true, scarf: '#7a3a3a', pose, frame, bob: frame, time: t }, wp, 1);
    drawPerson(ctx, x, feet, 2, { look: PROFESSOR, dir: -1, eyes: true, glasses: true, scarf: '#7a3a3a', pose, frame, bob: frame, time: t });
    this.drawLectern(ctx, x, feet);
    void t;
    void wp;
  }

  drawSpecial(ctx, sp, wp, t) {
    const x = Math.round(sp.x * this.W);
    const y = this.specialFeet();
    const def = ENCOUNTERS[sp.specialId];
    const bounce = this.reducedMotion ? 0 : Math.round(Math.sin(t * 6) * 1);
    const remaining = 1 - sp.age / sp.life;
    // pulsing ring on the ground and a lighter, saturated figure
    ctx.fillStyle = `rgba(255,217,138,${0.18 + 0.12 * Math.sin(t * 5)})`;
    ctx.fillRect(x - 12, y - 2, 24, 3);
    ctx.fillRect(x - 9, y - 4, 18, 2);
    drawShadow(ctx, x, y, 16, 0.3);
    const frame = this.walkFrame(sp.age, 0.76 / Math.max(0.1, sp.life), 1.85);
    this.drawStreetReflection(ctx, x, y, 2, {
      look: { ...def.look, hairStyle: def.look.hairStyle ?? 1 }, dir: sp.dir, pose: 'walk', frame, eyes: true, bob: frame & 1, time: t,
    }, wp, 0.92);
    drawPerson(ctx, x, y, 2, {
      look: { ...def.look, hairStyle: def.look.hairStyle ?? 1 }, dir: sp.dir, pose: 'walk', frame, eyes: true, bob: frame & 1, time: t,
    });
    if (sp.treatment) {
      // Someone you know: a seed with a green shoot floats over them. Tap it to gather what the conversation is worth.
      const bright = sp.treatment === 'learned';
      ctx.fillStyle = bright ? 'rgba(255,232,150,0.28)' : 'rgba(255,232,150,0.14)';
      ctx.fillRect(x - 8, y - 52 + bounce, 17, 15);
      ctx.fillStyle = '#12151b';
      ctx.fillRect(x - 4, y - 42 + bounce, 9, 7);
      ctx.fillStyle = bright ? '#e8c070' : '#cdb98a';
      ctx.fillRect(x - 3, y - 41 + bounce, 7, 5);
      ctx.fillStyle = bright ? '#fff0b8' : '#e6d9b4';
      ctx.fillRect(x - 2, y - 40 + bounce, 3, 2);
      ctx.fillStyle = bright ? '#7fd27a' : '#bfe0b8';
      ctx.fillRect(x, y - 47 + bounce, 1, 5);
      ctx.fillRect(x - 3, y - 48 + bounce, 3, 2);
      ctx.fillRect(x + 1, y - 49 + bounce, 3, 2);
    } else {
      // marker above the head: an arrow and a timer pip row, readable without colour
      ctx.fillStyle = '#ffd98a';
      ctx.fillRect(x - 1, y - 48 + bounce, 3, 5);
      ctx.fillRect(x - 3, y - 44 + bounce, 7, 1);
      ctx.fillRect(x - 2, y - 43 + bounce, 5, 1);
      ctx.fillRect(x - 1, y - 42 + bounce, 3, 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 8, y - 52, 17, 2);
    ctx.fillStyle = '#ffd98a';
    ctx.fillRect(x - 8, y - 52, Math.max(1, Math.round(17 * remaining)), 2);
    // a learned conversation: a second, teal bar counts down to the helper stepping in (tap them first to talk yourself)
    if (sp.autoAt !== undefined && sp.age < sp.autoAt) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - 8, y - 56, 17, 2);
      ctx.fillStyle = '#7fd4c0';
      ctx.fillRect(x - 8, y - 56, Math.max(1, Math.round(17 * (1 - sp.age / sp.autoAt))), 2);
    }
  }

  drawRain(ctx, wp, t) {
    const strength = clamp01(1 - wp.restoration * 0.92);
    const wind = 1;
    const farCount = this.reducedMotion ? 10 : 18;
    const nearCount = this.reducedMotion ? 12 : 22;
    ctx.fillStyle = `rgba(146,166,192,${0.12 + strength * 0.12})`;
    for (let i = 0; i < farCount; i++) {
      const x = Math.round(((i * 17 + t * -10) % (this.W + 6)) - 3);
      const y = Math.round((i * 23 + t * (34 + strength * 18)) % this.H);
      ctx.fillRect(x < 0 ? x + this.W : x, y, 1, 2);
      if (!this.reducedMotion) ctx.fillRect((x + wind) < 0 ? x + wind + this.W : x + wind, y + 1, 1, 1);
    }
    ctx.fillStyle = `rgba(180,196,216,${0.13 + strength * 0.15})`;
    for (let i = 0; i < nearCount; i++) {
      const x = Math.round(((i * 11 + t * -18) % (this.W + 8)) - 4);
      const y = Math.round((i * 19 + t * (58 + strength * 38)) % this.H);
      const px = x < 0 ? x + this.W : x;
      ctx.fillRect(px, y, 1, 3);
      ctx.fillRect(px + wind, y + 1, 1, 2);
    }
    const splashCount = this.reducedMotion ? 3 : 6;
    for (let i = 0; i < splashCount; i++) {
      const sx = 5 + Math.floor(hash2(i, 44) * (this.W - 10));
      const sy = this.groundTop + 18 + Math.floor(hash2(i, 51) * (this.H - this.groundTop - 24));
      const phase = this.reducedMotion ? 0.2 : (t * (0.9 + hash2(i, 62)) + hash2(i, 70) * 2) % 1;
      if (phase > 0.62) continue;
      ctx.fillStyle = `rgba(198,212,232,${0.08 + strength * 0.12})`;
      ctx.fillRect(sx - 1, sy, 3, 1);
      if (!this.reducedMotion && phase > 0.25) ctx.fillRect(sx - 2, sy + 1, 5, 1);
    }
  }

  drawConversionEffects(ctx, t) {
    const enc = this.game.enc;
    if (!enc || enc.state !== 'conversion') return;
    const k = Math.min(1, enc.t / 5.2);
    const strength = Math.sin(Math.PI * k);
    const x = this.focusX;
    // soft light from above, gentle wind: restraint, not spectacle
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(255,236,170,${0.05 * strength})`;
      ctx.fillRect(Math.round(x - 16 + i * 3), 0, 20 - i * 3, this.feetY + 2);
    }
    const n = this.reducedMotion ? 4 : 12;
    ctx.fillStyle = `rgba(240,244,230,${0.5 * strength})`;
    for (let i = 0; i < n; i++) {
      const wx = ((i * 37 + t * 40) % (this.W + 20)) - 10;
      const wy = 20 + ((i * 23) % (this.H - 50));
      ctx.fillRect(Math.round(wx), wy + Math.round(Math.sin(t * 2 + i) * 2), 5 + (i % 3) * 2, 1);
    }
  }

  drawVignette(ctx, wp) {
    const a = 0.16 * (1 - wp.restoration * 0.72);
    for (let i = 0; i < 3; i++) {
      const alpha = a * (1 - i * 0.24);
      ctx.fillStyle = `rgba(6,8,14,${alpha})`;
      ctx.fillRect(i, i, this.W - i * 2, 1);
      ctx.fillRect(i, this.H - 1 - i, this.W - i * 2, 1);
      ctx.fillRect(i, i, 1, this.H - i * 2);
      ctx.fillRect(this.W - 1 - i, i, 1, this.H - i * 2);
    }
    ditherRect(ctx, 1, 1, this.W - 2, 2, 'rgba(8,10,18,0.12)', 0);
    ditherRect(ctx, 0, this.H - 3, this.W, 2, 'rgba(8,10,18,0.12)', 1);
    if (wp.night > 0.05) {
      ctx.fillStyle = `rgba(8,10,26,${0.05 + wp.night * 0.18})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }
}
