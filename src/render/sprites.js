// Original programmatic pixel sprites. Crowd and focus characters share the same 1px grid;
// the larger focus sprites spend their extra pixels on silhouette detail rather than 2x blocks.

import { buildHero, heroKind } from './hero.js';
import { buildCrowd } from './crowd_art.js';
import { buildChibi } from './chibi.js';
// Set to false to fall back to the earlier realistic-proportion figures.
const CHIBI_STYLE = true;


const colorCache = new Map();
const mixCache = new Map();
const rampCache = new Map();
const spriteCache = new Map();

export function parseHex(hex) {
  let c = colorCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    colorCache.set(hex, c);
  }
  return c;
}

export function mix(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const q = Math.round(t * 24);
  const key = `${a}${b}${q}`;
  let out = mixCache.get(key);
  if (!out) {
    const A = parseHex(a);
    const B = parseHex(b);
    const f = q / 24;
    const h = (i) => Math.round(A[i] + (B[i] - A[i]) * f).toString(16).padStart(2, '0');
    out = `#${h(0)}${h(1)}${h(2)}`;
    mixCache.set(key, out);
  }
  return out;
}

export function ramp(base) {
  let r = rampCache.get(base);
  if (!r) {
    r = {
      hi: mix(base, '#fff1d2', 0.26),
      base,
      lo: mix(base, '#1d1a3c', 0.34),
      dk: mix(base, '#120f24', 0.62),
    };
    rampCache.set(base, r);
  }
  return r;
}

export const SKINS = ['#f0c8a0', '#e0ac7e', '#c68a60', '#a0683f', '#7a4b2d', '#5a361f'];
export const HAIRS = ['#1d1612', '#3a2a1e', '#5a3a22', '#8a6a3a', '#b8a070', '#8f949f', '#d4d7df', '#6a2a1a'];
export const TOPS = ['#5d6b82', '#7a5a5a', '#5a7a68', '#8a7a52', '#6a5a82', '#4a6a7a', '#82625a', '#586070', '#7a4a52'];
export const BOTTOMS = ['#2c3040', '#3a3430', '#2a3a44', '#40384a', '#34343c'];

const HATS = ['#3c4657', '#7b413d', '#5a6b43', '#5b4a72', '#25455c'];
const BAGS = ['#6a5238', '#7a5d41', '#5c4936', '#665747'];
const SHOES = '#1a1820';
const PERSON_CACHE_LIMIT = 420;
export const PERSON_REFLECTION_STRENGTH = 0.24;

const SIZE_PRESETS = {
  1: { w: 18, h: 24, floor: 22, bodyX: 5, torsoW: 5, torsoH: 7, legH: 7, armH: 6, headW: 6, headH: 7 },
  2: { w: 26, h: 32, floor: 30, bodyX: 8, torsoW: 7, torsoH: 10, legH: 9, armH: 8, headW: 8, headH: 9 },
};

const VARIANT_FROM_KIT = {
  skeptic: 'skeptic',
  nominal: 'nominal',
  broken: 'broken',
  worker: 'worker',
  visitor: 'visitor',
  professor: 'professor',
};

const WALK_FRAMES = [
  { bob: 0, farLeg: { dx: -1, drop: 1, lift: 1, toe: -1 }, nearLeg: { dx: 1, drop: 0, lift: 0, toe: 1 }, farArm: 'front', nearArm: 'back' },
  { bob: 1, farLeg: { dx: 0, drop: 0, lift: 0, toe: 0 }, nearLeg: { dx: 0, drop: 1, lift: 1, toe: 0 }, farArm: 'back', nearArm: 'front' },
  { bob: 0, farLeg: { dx: 1, drop: 0, lift: 0, toe: 1 }, nearLeg: { dx: -1, drop: 1, lift: 1, toe: -1 }, farArm: 'back', nearArm: 'front' },
  { bob: 1, farLeg: { dx: 0, drop: 1, lift: 1, toe: 0 }, nearLeg: { dx: 0, drop: 0, lift: 0, toe: 0 }, farArm: 'front', nearArm: 'back' },
];

const CROWD_TEMPLATES = [
  { variant: 'casual-man', gender: 'm', build: 'broad', bodyStyle: 'hoodie', hairStyle: 'short', backAccessory: 'backpack', topChoices: ['#8a8f98', '#65778b'], bottomChoices: ['#43536d', '#2c3040'] },
  { variant: 'casual-woman', gender: 'f', build: 'slim', bodyStyle: 'jacket', hairStyle: 'long', backAccessory: 'bag', topChoices: ['#c96f74', '#b95f76'], bottomChoices: ['#47618b', '#3a4f72'] },
  { variant: 'man-cap', gender: 'm', build: 'average', bodyStyle: 'hoodie', hairStyle: 'short', headwear: 'cap', backAccessory: 'backpack', topChoices: ['#4b8d55', '#4b7a5a'], bottomChoices: ['#4f5d63', '#39424b'] },
  { variant: 'woman-ponytail', gender: 'f', build: 'slim', bodyStyle: 'cardigan', hairStyle: 'ponytail', backAccessory: 'bag', topChoices: ['#cf7890', '#c66f80'], bottomChoices: ['#47536c', '#3c485e'] },
  { variant: 'business-man', gender: 'm', build: 'average', bodyStyle: 'suit', hairStyle: 'short', handItem: 'briefcase', extras: ['tie'], topChoices: ['#48526a', '#3e4a61'], bottomChoices: ['#2b3345', '#243040'] },
  { variant: 'business-woman', gender: 'f', build: 'slim', bodyStyle: 'blazer', hairStyle: 'long', backAccessory: 'bag', topChoices: ['#9f7a55', '#a97c57'], bottomChoices: ['#3c485d', '#334151'] },
  { variant: 'young-man-phone', gender: 'm', build: 'slim', age: 'young', bodyStyle: 'hoodie', hairStyle: 'short', handItem: 'phone', backAccessory: 'backpack', extras: ['headphones'], topChoices: ['#7a8089', '#657180'], bottomChoices: ['#4d5b75', '#405068'] },
  { variant: 'young-woman-phone', gender: 'f', build: 'slim', age: 'young', bodyStyle: 'tee', hairStyle: 'ponytail', handItem: 'phone', topChoices: ['#f3f0ea', '#efe7da'], bottomChoices: ['#47618b', '#506887'] },
  { variant: 'man-beard', gender: 'm', build: 'broad', bodyStyle: 'jacket', hairStyle: 'short', beard: true, topChoices: ['#5f6d78', '#687680'], bottomChoices: ['#3c4956', '#31404e'] },
  { variant: 'woman-coffee', gender: 'f', build: 'slim', bodyStyle: 'cardigan', hairStyle: 'long', handItem: 'coffee', topChoices: ['#8e5f48', '#7f5a45'], bottomChoices: ['#496183', '#3e5778'] },
  { variant: 'older-man', gender: 'm', build: 'average', age: 'old', bodyStyle: 'coat', hairStyle: 'short', topChoices: ['#56637a', '#64707f'], bottomChoices: ['#334051', '#2b3547'] },
  { variant: 'older-woman', gender: 'f', build: 'slim', age: 'old', bodyStyle: 'cardigan', hairStyle: 'old-bob', backAccessory: 'bag', topChoices: ['#7e5b8d', '#8b6296'], bottomChoices: ['#4a5064', '#3d4457'] },
  { variant: 'teen-hoodie', gender: 'm', build: 'slim', age: 'teen', bodyStyle: 'hoodie', hairStyle: 'short', extras: ['headphones'], topChoices: ['#b6514d', '#b95b4f'], bottomChoices: ['#3f5473', '#35506d'] },
  { variant: 'teen-hat', gender: 'm', build: 'slim', age: 'teen', bodyStyle: 'tee', hairStyle: 'short', headwear: 'cap-back', backAccessory: 'backpack', topChoices: ['#4f844f', '#5b8a52'], bottomChoices: ['#4e6274', '#435b69'] },
];

const CROWD_MAP = new Map(CROWD_TEMPLATES.map((t) => [t.variant, t]));

function hashValue(seed, salt) {
  let h = Math.imul((seed | 0) ^ (salt * 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function pick(seed, salt, arr) {
  return arr[hashValue(seed, salt) % arr.length];
}

function normalizeHairStyle(style, variant = '', kit = '') {
  if (typeof style === 'string') return style;
  if (variant === 'woman-ponytail' || variant === 'young-woman-phone') return 'ponytail';
  if (variant === 'older-woman') return 'old-bob';
  if (variant === 'man-cap') return 'short';
  if (kit === 'broken') return 'short';
  return ['short', 'long', 'ponytail', 'bun', 'crop'][Math.max(0, Math.min(4, style | 0))] || 'short';
}

function accessoryToFields(char, accessory) {
  switch (accessory) {
    case 'umbrella':
      char.handItem = 'umbrella';
      break;
    case 'bag':
      if (!char.backAccessory) char.backAccessory = char.gender === 'f' ? 'crossbody' : 'bag';
      break;
    case 'backpack':
      char.backAccessory = 'backpack';
      break;
    case 'book':
    case 'bible':
      char.handItem = 'book';
      break;
    case 'brochure':
      char.handItem = 'brochure';
      break;
    case 'phone':
      char.handItem = 'phone';
      break;
    case 'coffee':
      char.handItem = 'coffee';
      break;
    case 'briefcase':
      char.handItem = 'briefcase';
      break;
    case 'tote':
      char.backAccessory = 'tote';
      break;
    case 'hat':
      char.headwear = 'cap';
      break;
    case 'hat-back':
      char.headwear = 'cap-back';
      break;
    case 'beanie':
      char.headwear = 'beanie';
      break;
    case 'headphones':
      char.extras.add('headphones');
      break;
    case 'tie':
      char.extras.add('tie');
      break;
    case 'lanyard':
      char.extras.add('lanyard');
      break;
    default:
      break;
  }
}

export function lookFromInt(n) {
  n = Number.isFinite(n) ? n : 0;
  const template = CROWD_TEMPLATES[((n % CROWD_TEMPLATES.length) + CROWD_TEMPLATES.length) % CROWD_TEMPLATES.length];
  const seed = Math.floor(n / CROWD_TEMPLATES.length);
  return {
    variant: template.variant,
    gender: template.gender,
    build: template.build,
    age: template.age || 'adult',
    skin: pick(seed, 1, SKINS),
    hair: template.age === 'old' ? pick(seed, 2, HAIRS.slice(5)) : pick(seed, 2, HAIRS),
    top: pick(seed, 3, template.topChoices || TOPS),
    bottom: pick(seed, 4, template.bottomChoices || BOTTOMS),
    hairStyle: template.hairStyle || 0,
    accessory: template.handItem || template.backAccessory || 'none',
    headwear: template.headwear || '',
    hat: pick(seed, 5, HATS),
    bagColor: pick(seed, 6, BAGS),
    beard: !!template.beard,
  };
}

function makePixelCanvas(w, h) {
  const cv = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : typeof document !== 'undefined'
      ? document.createElement('canvas')
      : null;
  if (!cv) return null;
  cv.width = w;
  cv.height = h;
  return cv;
}

function normalizePose(pose, variant, kit) {
  if (pose === 'proclaim') return 'point';
  if (pose === 'hold-bible') return 'hold';
  if (pose === 'idle' && (variant === 'protagonist' || variant === 'protagonist-old' || variant === 'protagonist-young')) return 'hold';
  if (pose === 'idle' && kit === 'skeptic') return 'crossed';
  if (pose === 'idle' && variant === 'visitor') return 'talk';
  return pose || 'idle';
}

function resolveCharacter(look = {}, o = {}, tier = 1) {
  const variant = look.variant || VARIANT_FROM_KIT[look.kit] || 'generic';
  const tpl = CROWD_MAP.get(variant);
  const age = o.age || look.age || tpl?.age || 'adult';
  const baseTop = look.top || pick(1, 0, TOPS);
  const char = {
    variant,
    tier,
    skin: look.skin || SKINS[0],
    hair: age === 'old' ? (look.hair || '#cfd2db') : (look.hair || HAIRS[0]),
    top: baseTop,
    bottom: look.bottom || BOTTOMS[0],
    accent: look.accent || mix(baseTop, '#f0c676', 0.22),
    hat: look.hat || pick(1, 0, HATS),
    bagColor: look.bagColor || '#6a5238',
    gender: look.gender || tpl?.gender || 'm',
    build: look.build || tpl?.build || 'average',
    age,
    bodyStyle: tpl?.bodyStyle || 'jacket',
    hairStyle: normalizeHairStyle(look.hairStyle ?? tpl?.hairStyle ?? 0, variant, look.kit || ''),
    headwear: look.headwear || tpl?.headwear || '',
    handItem: tpl?.handItem || '',
    backAccessory: tpl?.backAccessory || '',
    pose: normalizePose(o.pose || 'idle', variant, look.kit || ''),
    glasses: !!o.glasses,
    beard: !!(o.beard || look.beard || tpl?.beard),
    scarf: o.scarf || look.scarf || '',
    dim: Math.round(Math.min(1, Math.max(0, o.dim || 0)) * 8) / 8,
    fog: o.fog || '#39414f',
    dir: o.dir < 0 ? -1 : 1,
    frame: ((o.frame || 0) % 4 + 4) % 4,
    idleFrame: (o.frame ?? Math.round(o.bob || 0)) & 1,
    eyes: o.eyes !== false,
    extras: new Set(),
    smallCross: false,
    badge: false,
    steam: false,
    smile: false,
    tired: false,
    slouch: 0,
  };

  switch (variant) {
    case 'casual-man':
      char.bodyStyle = 'hoodie';
      char.backAccessory = 'backpack';
      break;
    case 'casual-woman':
      char.bodyStyle = 'jacket';
      char.backAccessory = 'bag';
      char.gender = 'f';
      char.hairStyle = 'long';
      break;
    case 'man-cap':
      char.bodyStyle = 'hoodie';
      char.backAccessory = 'backpack';
      char.headwear = 'cap';
      break;
    case 'woman-ponytail':
      char.gender = 'f';
      char.bodyStyle = 'cardigan';
      char.backAccessory = 'crossbody';
      char.hairStyle = 'ponytail';
      break;
    case 'business-man':
      char.bodyStyle = 'suit';
      char.handItem = 'briefcase';
      char.extras.add('tie');
      break;
    case 'business-woman':
      char.gender = 'f';
      char.bodyStyle = 'blazer';
      char.backAccessory = 'bag';
      char.hairStyle = 'long';
      break;
    case 'young-man-phone':
      char.build = 'slim';
      char.bodyStyle = 'hoodie';
      char.handItem = 'phone';
      char.backAccessory = 'backpack';
      char.extras.add('headphones');
      break;
    case 'young-woman-phone':
      char.gender = 'f';
      char.build = 'slim';
      char.bodyStyle = 'tee';
      char.handItem = 'phone';
      char.hairStyle = 'ponytail';
      break;
    case 'man-beard':
      char.bodyStyle = 'jacket';
      char.build = 'broad';
      char.beard = true;
      break;
    case 'woman-coffee':
      char.gender = 'f';
      char.bodyStyle = 'cardigan';
      char.hairStyle = 'long';
      char.handItem = 'coffee';
      break;
    case 'older-man':
      char.age = 'old';
      char.bodyStyle = 'coat';
      break;
    case 'older-woman':
      char.gender = 'f';
      char.age = 'old';
      char.bodyStyle = 'cardigan';
      char.hairStyle = 'old-bob';
      char.backAccessory = 'bag';
      break;
    case 'teen-hoodie':
      char.age = 'teen';
      char.build = 'slim';
      char.bodyStyle = 'hoodie';
      char.extras.add('headphones');
      break;
    case 'teen-hat':
      char.age = 'teen';
      char.build = 'slim';
      char.bodyStyle = 'tee';
      char.headwear = 'cap-back';
      char.backAccessory = 'backpack';
      break;
    case 'skeptic':
      char.bodyStyle = 'hoodie';
      char.handItem = 'phone';
      char.extras.add('headphones');
      char.beard = true;
      char.build = 'broad';
      break;
    case 'nominal':
      char.gender = 'f';
      char.bodyStyle = 'cardigan';
      char.hairStyle = 'long';
      char.handItem = 'coffee';
      char.backAccessory = 'crossbody';
      char.smallCross = true;
      char.smile = true;
      break;
    case 'broken':
      char.bodyStyle = 'puffer';
      char.headwear = 'beanie';
      char.beard = true;
      char.slouch = 1;
      break;
    case 'worker':
      char.bodyStyle = 'shirt';
      char.handItem = 'coffee';
      char.backAccessory = 'briefcase';
      char.extras.add('tie');
      char.extras.add('lanyard');
      char.steam = true;
      char.tired = true;
      break;
    case 'visitor':
      char.bodyStyle = 'shirtTie';
      char.handItem = 'brochure';
      char.backAccessory = 'tote';
      char.badge = true;
      char.smile = true;
      break;
    case 'professor':
      char.bodyStyle = 'tweed';
      char.glasses = true;
      char.build = 'average';
      break;
    case 'protagonist':
    case 'protagonist-old':
    case 'protagonist-young':
      char.bodyStyle = 'hoodie';
      char.handItem = 'book';
      char.backAccessory = 'backpack';
      char.build = variant === 'protagonist-young' ? 'slim' : 'broad';
      char.beard = variant !== 'protagonist-young';
      if (variant === 'protagonist-old') char.age = 'old';
      if (variant === 'protagonist-young') char.age = 'young';
      break;
    default:
      if (char.gender === 'f' && char.hairStyle === 'short') char.hairStyle = 'long';
      if (char.age === 'old' && char.hairStyle === 'short') char.hairStyle = char.gender === 'f' ? 'old-bob' : 'short';
      break;
  }

  accessoryToFields(char, o.accessoryOverride || look.accessory || 'none');

  if (look.headwear) char.headwear = look.headwear;
  if (look.handItem) char.handItem = look.handItem;
  if (look.backAccessory) char.backAccessory = look.backAccessory;
  if (look.extras) for (const extra of look.extras) char.extras.add(extra);
  if (char.backAccessory === 'briefcase' && !char.handItem) {
    char.handItem = 'briefcase';
    char.backAccessory = '';
  }
  if (look.kit === 'professor') char.variant = 'professor';
  return char;
}

function spriteKey(s, o) {
  const l = o.look || {};
  return [
    s >= 2 ? 2 : 1,
    l.variant || '',
    l.kit || '',
    l.skin || '',
    l.hair || '',
    l.top || '',
    l.bottom || '',
    l.hairStyle ?? '',
    l.accessory || '',
    l.headwear || '',
    l.hat || '',
    l.bagColor || '',
    l.build || '',
    l.gender || '',
    l.age || '',
    o.accessoryOverride || '',
    o.pose || '',
    o.dir || 1,
    o.glasses ? 1 : 0,
    o.beard ? 1 : 0,
    o.scarf || '',
    o.eyes === false ? 0 : 1,
    Math.round(Math.min(1, Math.max(0, o.dim || 0)) * 8),
    o.fog || '',
    (o.pose === 'walk' || o.pose === 'idle' || o.pose === 'hold' || o.pose === 'talk' || o.pose === 'react') ? (o.frame || 0) : 0,
    Math.round(o.bob || 0),
  ].join('|');
}

function outlineSprite(ctx, cv) {
  const w = cv.width;
  const h = cv.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const out = new Uint8ClampedArray(d.length);
  out.set(d);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4;
      if (d[i + 3] > 30) continue;
      let j = -1;
      if (yy + 1 < h && d[((yy + 1) * w + xx) * 4 + 3] > 120) j = ((yy + 1) * w + xx) * 4;
      else if (xx + 1 < w && d[(yy * w + xx + 1) * 4 + 3] > 120) j = (yy * w + xx + 1) * 4;
      else if (xx > 0 && d[(yy * w + xx - 1) * 4 + 3] > 120) j = (yy * w + xx - 1) * 4;
      else if (yy > 0 && d[((yy - 1) * w + xx) * 4 + 3] > 120) j = ((yy - 1) * w + xx) * 4;
      if (j < 0) continue;
      out[i] = d[j] * 0.34;
      out[i + 1] = d[j + 1] * 0.31;
      out[i + 2] = d[j + 2] * 0.42 + 6;
      out[i + 3] = 255;
    }
  }
  img.data.set(out);
  ctx.putImageData(img, 0, 0);
}

function buildPerson(s, o) {
  const tier = s >= 2 ? 2 : 1;
  const preset = SIZE_PRESETS[tier];
  const PAD = 2;
  const cv = makePixelCanvas(preset.w + PAD * 2, preset.h + PAD * 2);
  if (!cv) return { cv: { width: 1, height: 1 }, ox: 0, oy: 0 };
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const char = resolveCharacter(o.look, o, tier);
  const tint = (col) => (char.dim > 0 ? mix(col, char.fog, char.dim) : col);
  const skin = { ...ramp(char.skin) };
  const hair = { ...ramp(char.age === 'old' ? mix(char.hair, '#d8dce5', 0.42) : char.hair) };
  const top = { ...ramp(char.top) };
  const bottom = { ...ramp(char.bottom) };
  const accent = { ...ramp(char.accent) };
  const bag = { ...ramp(char.bagColor) };
  const shoe = { ...ramp(SHOES) };
  const shirt = { ...ramp(char.variant === 'visitor' || char.bodyStyle === 'shirtTie' ? '#f0efe8' : mix(char.top, '#f0e8dc', 0.52)) };
  const dimAll = (group) => ({
    hi: tint(group.hi),
    base: tint(group.base),
    lo: tint(group.lo),
    dk: tint(group.dk),
  });
  const cSkin = dimAll(skin);
  const cHair = dimAll(hair);
  const cTop = dimAll(top);
  const cBottom = dimAll(bottom);
  const cAccent = dimAll(accent);
  const cBag = dimAll(bag);
  const cShoe = dimAll(shoe);
  const cShirt = dimAll(shirt);
  const deep = tint('#14121c');
  const presetShort = char.age === 'teen' ? 1 : 0;
  const old = char.age === 'old' ? 1 : 0;
  const young = char.age === 'young' ? 1 : 0;
  const wide = char.build === 'broad' ? 1 : char.build === 'slim' ? -1 : 0;
  const torsoW = Math.max(4, preset.torsoW + wide);
  const torsoH = Math.max(6, preset.torsoH - presetShort);
  const legH = Math.max(5, preset.legH - presetShort);
  const armH = Math.max(4, preset.armH - (presetShort ? 1 : 0));
  const headW = preset.headW + (tier === 2 && char.build === 'broad' ? 1 : 0);
  const headH = preset.headH;
  const walk = char.pose === 'walk';
  const frame = walk ? char.frame : char.idleFrame;
  const walkFrame = WALK_FRAMES[char.frame];
  const upperLift = walk ? walkFrame.bob : (char.pose === 'idle' || char.pose === 'hold' || char.pose === 'talk' || char.pose === 'react') ? (char.idleFrame ? 1 : 0) : 0;
  const floor = preset.floor;
  const legTop = floor - legH;
  const torsoTop = legTop - torsoH - upperLift + char.slouch;
  const bodyX = preset.bodyX + (char.gender === 'f' ? 1 : 0);
  const headTop = torsoTop - headH + 1 + char.slouch;
  const headX = bodyX + torsoW - Math.ceil(headW * 0.72);
  const RX = (x, w = 1) => (char.dir > 0 ? x : preset.w - x - w);
  const P = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(PAD + RX(x, w), PAD + y, w, h);
  };
  const D = (x, y, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(PAD + RX(x, 1), PAD + y, 1, 1);
  };
  const dots = (x, y, w, h, col, step = 2) => {
    ctx.fillStyle = col;
    for (let yy = 0; yy < h; yy++) for (let xx = (yy & 1); xx < w; xx += step) ctx.fillRect(PAD + RX(x + xx, 1), PAD + y + yy, 1, 1);
  };

  function drawBackAccessory() {
    if (char.handItem === 'umbrella') {
      const cano = dimAll(ramp(mix(char.top, '#294b7a', 0.48)));
      P(headX - 2, headTop - 6, headW + 3, 2, cano.base);
      P(headX - 1, headTop - 7, headW + 1, 1, cano.hi);
      P(headX - 2, headTop - 4, headW + 3, 1, cano.lo);
    }
    switch (char.backAccessory) {
      case 'backpack':
        P(bodyX - 2, torsoTop + 1, 3, torsoH - 1, cBag.lo);
        P(bodyX - 1, torsoTop + 2, 2, torsoH - 3, cBag.base);
        break;
      case 'bag':
        P(bodyX - 1, legTop - 1, 3, 4, cBag.base);
        P(bodyX, legTop - 1, 1, 4, cBag.hi);
        break;
      case 'crossbody':
        P(bodyX - 1, legTop - 1, 3, 4, cBag.base);
        P(bodyX, legTop - 1, 1, 4, cBag.hi);
        break;
      case 'tote':
        P(bodyX - 2, torsoTop + 3, 3, torsoH - 1, cBag.base);
        P(bodyX - 2, torsoTop + 3, 1, torsoH - 1, cBag.hi);
        D(bodyX - 1, torsoTop + 2, cBag.hi);
        D(bodyX, torsoTop + 2, cBag.hi);
        break;
      case 'briefcase':
        P(bodyX - 1, floor - 4, 4, 4, cBag.base);
        P(bodyX - 1, floor - 4, 4, 1, cBag.hi);
        P(bodyX, floor - 5, 2, 1, cBag.dk);
        break;
      default:
        break;
    }
  }

  function drawLeg(baseX, cfg, col, footCol, far = false) {
    const x = baseX + cfg.dx;
    const topY = legTop + cfg.drop;
    const h = legH - cfg.lift;
    P(x, topY, 2, h, col.base);
    P(x, topY, 1, Math.max(1, h - 1), col.hi);
    if (tier === 2) D(x + 1, topY + Math.max(1, h - 3), col.lo);
    const footY = floor - (cfg.lift ? 0 : 0);
    const toeX = x + (cfg.toe > 0 ? 1 : cfg.toe < 0 ? -1 : 0);
    P(toeX, footY, 3, 1, footCol.base);
    if (far) P(toeX + (cfg.toe < 0 ? 2 : 0), footY, 1, 1, footCol.lo);
    else P(toeX, footY, 1, 1, footCol.hi);
  }

  function drawTorsoBase() {
    let coatX = bodyX;
    let coatW = torsoW;
    let coatH = torsoH;
    if (char.bodyStyle === 'coat' || char.bodyStyle === 'puffer') {
      coatX -= 1;
      coatW += 1;
      coatH += 1;
    }
    P(coatX, torsoTop, coatW, coatH, cTop.base);
    P(coatX, torsoTop, 1, coatH - 1, cTop.hi);
    P(coatX + coatW - 1, torsoTop + 1, 1, coatH - 1, cTop.lo);
    P(coatX, torsoTop + coatH - 1, coatW, 1, cTop.lo);

    switch (char.bodyStyle) {
      case 'hoodie':
        P(bodyX - 1, torsoTop - 1, 3, 2, cTop.lo);
        P(bodyX + 1, torsoTop + 4, 3, 2, cTop.lo);
        break;
      case 'jacket':
        P(bodyX + 1, torsoTop, 1, torsoH, cTop.hi);
        P(bodyX + 2, torsoTop + 1, 1, torsoH - 2, cTop.dk);
        break;
      case 'cardigan':
        P(bodyX + 1, torsoTop, Math.max(2, torsoW - 2), torsoH - 1, cShirt.base);
        P(bodyX + 1, torsoTop, 1, torsoH - 1, cShirt.hi);
        D(bodyX + 2, torsoTop + 2, cAccent.base);
        D(bodyX + 2, torsoTop + 4, cAccent.base);
        break;
      case 'suit':
      case 'blazer':
        P(bodyX + 1, torsoTop, Math.max(2, torsoW - 2), torsoH - 1, cShirt.base);
        P(bodyX + 2, torsoTop + 1, 1, torsoH - 2, cAccent.base);
        if (char.extras.has('tie')) {
          P(bodyX + 2, torsoTop + 1, 1, torsoH - 2, tint('#b6484c'));
          D(bodyX + 1, torsoTop + 1, tint('#d45a5a'));
        }
        P(bodyX + torsoW - 2, torsoTop + 1, 1, torsoH - 3, cTop.dk);
        break;
      case 'shirt':
      case 'shirtTie':
        P(bodyX, torsoTop, torsoW, torsoH, cShirt.base);
        P(bodyX, torsoTop, torsoW, 1, cShirt.hi);
        P(bodyX + torsoW - 1, torsoTop + 1, 1, torsoH - 1, cShirt.lo);
        if (char.extras.has('tie') || char.bodyStyle === 'shirtTie') {
          P(bodyX + Math.floor(torsoW / 2), torsoTop + 1, 1, torsoH - 2, tint('#b6484c'));
          D(bodyX + Math.floor(torsoW / 2) - 1, torsoTop + 1, tint('#dc7266'));
        }
        break;
      case 'tweed':
        dots(bodyX, torsoTop, torsoW, torsoH - 1, cTop.lo);
        P(bodyX + 1, torsoTop + 1, Math.max(2, torsoW - 2), torsoH - 2, cShirt.base);
        break;
      case 'puffer':
        for (let yy = 1; yy < torsoH - 1; yy += 2) P(bodyX, torsoTop + yy, torsoW, 1, cTop.lo);
        dots(bodyX + 1, torsoTop + 1, torsoW - 2, torsoH - 2, cAccent.dk, 3);
        break;
      case 'tee':
      default:
        break;
    }

    if (char.extras.has('lanyard')) {
      P(bodyX + Math.floor(torsoW / 2), torsoTop + 1, 1, Math.max(3, torsoH - 3), tint('#5a89c4'));
      P(bodyX + Math.floor(torsoW / 2), torsoTop + 3, 2, 3, cShirt.base);
      D(bodyX + Math.floor(torsoW / 2), torsoTop + 4, tint('#d54f4f'));
    }
    if (char.smallCross) {
      P(bodyX + 2, torsoTop + 2, 1, 3, tint('#f0c862'));
      P(bodyX + 1, torsoTop + 3, 3, 1, tint('#f0c862'));
    }
    if (char.badge) {
      P(bodyX + torsoW - 2, torsoTop + 2, 2, 2, cShirt.base);
      D(bodyX + torsoW - 2, torsoTop + 2, tint('#d84a4a'));
    }
    if (char.backAccessory === 'crossbody' || char.backAccessory === 'bag' || char.backAccessory === 'tote' || char.backAccessory === 'backpack') {
      P(bodyX + 1, torsoTop, 1, torsoH, cBag.dk);
    }
    if (char.scarf) {
      const scarf = dimAll(ramp(char.scarf));
      P(bodyX - 1, torsoTop - 1, torsoW + 1, 2, scarf.base);
      P(bodyX + torsoW - 1, torsoTop + 1, 2, Math.max(3, torsoH - 5), scarf.lo);
    }
  }

  function drawHead() {
    const faceW = headW - 1;
    P(headX, headTop + 1, faceW, headH - 2, cSkin.base);
    P(headX, headTop, faceW - 1, 1, cSkin.hi);
    P(headX + faceW - 1, headTop + 2, 1, headH - 4, cSkin.lo);
    P(headX + faceW, headTop + 3, 1, Math.max(2, headH - 5), cSkin.lo);
    P(headX + 1, headTop + headH - 1, Math.max(2, faceW - 2), 1, cSkin.lo);
    D(headX, headTop + 4, cSkin.hi);
    if (tier === 2) {
      D(headX + faceW - 1, headTop + 1, cSkin.hi);
      D(headX + faceW - 2, headTop + headH - 2, cSkin.dk);
    }
  }

  function drawHairAndHeadwear() {
    const backX = headX - 1;
    switch (char.hairStyle) {
      case 'long':
        P(backX, headTop, headW - 1, 2, cHair.base);
        P(backX, headTop + 2, 2, headH - 1, cHair.base);
        P(backX + 1, headTop + 3, 2, Math.max(2, torsoTop - headTop + 4), cHair.lo);
        break;
      case 'ponytail':
        P(backX, headTop, headW - 1, 2, cHair.base);
        P(backX, headTop + 2, 2, headH - 2, cHair.base);
        P(backX - 1, headTop + 4, 2, 4, cHair.lo);
        break;
      case 'messy':
        P(backX, headTop, headW, 2, cHair.base);
        P(backX, headTop + 1, 2, 3, cHair.base);
        D(backX + 1, headTop - 1, cHair.base);
        D(backX + 3, headTop - 1, cHair.base);
        D(backX + 5, headTop, cHair.lo);
        break;
      case 'old-bob':
        P(backX, headTop, headW - 1, 2, cHair.base);
        P(backX, headTop + 2, 2, headH - 1, cHair.base);
        P(backX, headTop + 5, 3, 2, cHair.lo);
        break;
      case 'bun':
        P(backX, headTop, headW - 1, 2, cHair.base);
        P(backX + 1, headTop + 2, 2, headH - 2, cHair.base);
        P(backX - 1, headTop + 1, 2, 2, cHair.lo);
        break;
      case 'crop':
        P(headX, headTop, headW - 2, 2, cHair.base);
        break;
      case 'short':
      default:
        P(backX, headTop, headW, 2, cHair.base);
        P(backX, headTop + 1, 2, 3, cHair.base);
        D(headX + headW - 2, headTop + 1, cHair.lo);
        break;
    }
    if (char.variant === 'skeptic' || char.variant === 'protagonist' || char.variant === 'protagonist-young') {
      D(headX + 1, headTop - 1, cHair.base);
      D(headX + 3, headTop - 1, cHair.base);
    }
    if (char.headwear === 'cap' || char.headwear === 'cap-back') {
      const hat = dimAll(ramp(char.hat));
      P(headX - 1, headTop, headW, 2, hat.base);
      P(headX - 1, headTop, headW - 1, 1, hat.hi);
      if (char.headwear === 'cap') P(headX + headW - 1, headTop + 1, 2, 1, hat.lo);
      else P(headX - 2, headTop + 1, 2, 1, hat.lo);
    } else if (char.headwear === 'beanie') {
      const hat = dimAll(ramp(mix(char.top, '#2f3142', 0.4)));
      P(headX - 1, headTop, headW, 3, hat.base);
      P(headX - 1, headTop, headW - 1, 1, hat.hi);
      P(headX - 1, headTop + 2, headW, 1, hat.lo);
    }
  }

  function drawFace() {
    if (!char.eyes) return;
    const eyeX = headX + headW - 3;
    const eyeY = headTop + Math.max(3, tier === 2 ? 4 : 3);
    D(eyeX, eyeY, deep);
    if (tier === 2) {
      D(eyeX - 1, eyeY - 1, cHair.dk);
      D(eyeX + 1, eyeY, cSkin.dk);
    }
    const mouthY = headTop + headH - 3;
    if (char.variant === 'broken') {
      D(eyeX - 1, mouthY, cSkin.dk);
    } else if (char.smile) {
      P(eyeX - 1, mouthY, 2, 1, tint('#7c342b'));
    } else if (char.tired) {
      P(eyeX - 1, mouthY, 2, 1, cSkin.dk);
      D(eyeX - 1, eyeY + 1, cSkin.dk);
    } else {
      D(eyeX - 1, mouthY, tint('#7c342b'));
    }
    if (char.beard) {
      P(headX + 1, headTop + headH - 2, Math.max(3, headW - 3), 2, cHair.lo);
      D(headX + headW - 2, headTop + headH - 3, cHair.dk);
    }
    if (char.glasses) {
      P(eyeX - 2, eyeY - 1, 3, 2, tint('#262736'));
      P(eyeX - 2, eyeY - 1, 1, 2, tint('#8ba6bc'));
    }
    if (char.extras.has('headphones')) {
      D(headX, eyeY, tint('#2a2c36'));
      D(headX + 1, eyeY + 1, tint('#2a2c36'));
      D(headX - 1, eyeY, tint('#2a2c36'));
    }
  }

  function drawArm(mode, shoulderX, shoulderY, near = false, color = cTop) {
    switch (mode) {
      case 'cross':
        P(shoulderX - 1, shoulderY + 1, 4, 1, color.lo);
        P(shoulderX - 2, shoulderY + 3, 5, 1, color.base);
        break;
      case 'point':
        P(shoulderX, shoulderY, 2, 3, color.base);
        P(shoulderX + 1, shoulderY + 2, 4, 1, color.lo);
        P(shoulderX + 5, shoulderY + 2, 1, 1, cSkin.base);
        break;
      case 'talk':
        P(shoulderX, shoulderY, 1, 3, color.base);
        P(shoulderX + 1, shoulderY + 2, 2, 1, color.lo);
        P(shoulderX + 2, shoulderY + 1, 1, 1, cSkin.base);
        break;
      case 'hold':
        P(shoulderX, shoulderY, 1, 3, color.base);
        P(shoulderX + 1, shoulderY + 3, 2, 1, color.lo);
        break;
      case 'phone':
        P(shoulderX, shoulderY, 1, 3, color.base);
        P(shoulderX + 1, shoulderY + 1, 1, 2, cSkin.base);
        P(shoulderX + 2, shoulderY, 2, 3, tint('#9bcdf3'));
        P(shoulderX + 3, shoulderY + 1, 1, 1, tint('#eef8ff'));
        break;
      case 'carry':
        P(shoulderX, shoulderY, 1, 4, color.base);
        P(shoulderX + 1, shoulderY + 4, 1, 1, cSkin.base);
        break;
      case 'front':
        P(shoulderX, shoulderY, 1, 4, color.base);
        P(shoulderX + 1, shoulderY + 4, 1, 1, cSkin.base);
        break;
      case 'back':
        P(shoulderX, shoulderY + 1, 1, 4, color.lo);
        P(shoulderX, shoulderY + 5, 1, 1, cSkin.lo);
        break;
      case 'pocket':
        P(shoulderX, shoulderY + 1, 1, 2, color.lo);
        break;
      case 'react':
        P(shoulderX, shoulderY, 1, 2, color.base);
        P(shoulderX + 1, shoulderY - 1, 1, 2, cSkin.base);
        break;
      default:
        P(shoulderX, shoulderY, 1, armH - 2, color.base);
        P(shoulderX, shoulderY + armH - 2, 1, 1, cSkin.base);
        break;
    }
    if (near && char.handItem === 'umbrella' && (mode === 'carry' || mode === 'front' || mode === 'talk')) {
      P(shoulderX + 1, headTop + 2, 1, floor - headTop - 3, tint('#2a2a34'));
      P(shoulderX, floor - 2, 2, 1, tint('#2a2a34'));
    }
  }

  function drawHeldItem(mode, shoulderX, shoulderY) {
    switch (char.handItem) {
      case 'book':
        if (mode === 'hold' || char.pose === 'hold') {
          P(bodyX + 1, torsoTop + 3, 4, 4, tint('#6d4e2e'));
          P(bodyX + 2, torsoTop + 4, 2, 2, tint('#e7d59b'));
          P(bodyX + 1, torsoTop + 3, 1, 4, tint('#e7d59b'));
        } else {
          P(shoulderX + 1, shoulderY + 3, 3, 4, tint('#6d4e2e'));
          P(shoulderX + 2, shoulderY + 4, 1, 2, tint('#e7d59b'));
        }
        break;
      case 'coffee':
        P(shoulderX + 1, shoulderY + 3, 3, 4, cShirt.base);
        P(shoulderX + 1, shoulderY + 4, 3, 2, tint('#a97757'));
        P(shoulderX + 1, shoulderY + 2, 2, 1, tint('#2f3345'));
        if (char.steam && !o.noSteam) {
          const t = o.time ?? (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000);
          const baseX = PAD + RX(shoulderX + 2, 1);
          const baseY = PAD + shoulderY + 1;
          for (let i = 0; i < 3; i++) {
            const ph = (t * 0.8 + i * 0.32) % 1;
            ctx.globalAlpha = (1 - ph) * 0.72 * (1 - char.dim);
            ctx.fillStyle = '#e6eef6';
            ctx.fillRect(baseX + ((i & 1) ? 1 : 0), Math.round(baseY - ph * (tier === 2 ? 6 : 4)), 1, 1);
          }
          ctx.globalAlpha = 1;
        }
        break;
      case 'phone':
        if (char.pose === 'walk' || char.pose === 'idle' || char.pose === 'talk' || char.pose === 'crossed') {
          P(shoulderX + 2, shoulderY, 2, 3, tint('#9bcdf3'));
          P(shoulderX + 3, shoulderY + 1, 1, 1, tint('#eef8ff'));
        }
        break;
      case 'brochure':
        P(shoulderX + 1, shoulderY + 2, 3, 4, cShirt.base);
        D(shoulderX + 2, shoulderY + 3, tint('#d34e55'));
        D(shoulderX + 3, shoulderY + 4, tint('#5e8ec5'));
        break;
      case 'briefcase':
        P(shoulderX + 1, floor - 3, 4, 4, cBag.base);
        P(shoulderX + 1, floor - 3, 4, 1, cBag.hi);
        P(shoulderX + 2, floor - 4, 2, 1, cBag.dk);
        break;
      default:
        break;
    }
  }

  drawBackAccessory();

  if (walk) {
    drawLeg(bodyX + 1, walkFrame.farLeg, { ...cBottom, base: cBottom.lo, hi: cBottom.base }, { ...cShoe, base: cShoe.lo, hi: cShoe.base }, true);
  } else {
    drawLeg(bodyX + 1, { dx: 0, drop: 1, lift: 1, toe: 0 }, { ...cBottom, base: cBottom.lo, hi: cBottom.base }, { ...cShoe, base: cShoe.lo, hi: cShoe.base }, true);
  }

  const farShoulderX = bodyX;
  const nearShoulderX = bodyX + torsoW - 1;
  const shoulderY = torsoTop + 1;
  let farMode = 'back';
  let nearMode = 'carry';
  switch (char.pose) {
    case 'walk':
      farMode = walkFrame.farArm;
      nearMode = char.handItem === 'phone' ? 'phone' : char.handItem === 'book' && char.variant.startsWith('protagonist') ? 'hold' : char.handItem === 'coffee' ? 'carry' : walkFrame.nearArm;
      break;
    case 'crossed':
      farMode = 'cross';
      nearMode = 'cross';
      break;
    case 'point':
      farMode = 'back';
      nearMode = 'point';
      break;
    case 'talk':
      farMode = char.handItem === 'briefcase' ? 'back' : 'carry';
      nearMode = char.handItem === 'phone' ? 'phone' : 'talk';
      break;
    case 'react':
      farMode = 'react';
      nearMode = 'react';
      break;
    case 'hold':
      farMode = 'carry';
      nearMode = 'hold';
      break;
    default:
      farMode = char.variant === 'broken' ? 'pocket' : 'carry';
      nearMode = char.handItem === 'phone' ? 'phone' : char.handItem === 'book' && char.variant.startsWith('protagonist') ? 'hold' : char.handItem === 'briefcase' ? 'carry' : 'carry';
      break;
  }

  drawArm(farMode, farShoulderX, shoulderY + (walk && walkFrame.farArm === 'front' ? 1 : 0), false, char.bodyStyle === 'shirt' || char.bodyStyle === 'shirtTie' ? cShirt : cTop);
  drawTorsoBase();
  drawHead();
  drawHairAndHeadwear();
  drawFace();
  if (walk) drawLeg(bodyX + 3, walkFrame.nearLeg, cBottom, cShoe, false);
  else drawLeg(bodyX + 3, { dx: 0, drop: 0, lift: 0, toe: 0 }, cBottom, cShoe, false);
  drawArm(nearMode, nearShoulderX, shoulderY + (walk && walkFrame.nearArm === 'front' ? 1 : 0), true, char.bodyStyle === 'shirt' || char.bodyStyle === 'shirtTie' ? cShirt : cTop);
  drawHeldItem(nearMode, nearShoulderX, shoulderY);

  if (char.variant === 'visitor') {
    P(bodyX - 1, torsoTop + 3, 2, 3, cBag.base);
    D(bodyX, torsoTop + 4, tint('#d84a4a'));
    D(bodyX + 1, torsoTop + 4, tint('#5b8cc4'));
  }

  outlineSprite(ctx, cv);
  return { cv, ox: PAD + Math.floor(preset.w / 2), oy: PAD + preset.floor };
}

function spriteFor(s, o) {
  const key = spriteKey(s, o);
  let spr = spriteCache.get(key);
  if (!spr) {
    if (spriteCache.size > PERSON_CACHE_LIMIT) spriteCache.clear();
    // the people in focus are painted by hero.js; everyone else uses the crowd builder
    spr = CHIBI_STYLE ? buildChibi(resolveCharacter(o.look || {}, o, s >= 2 ? 2 : 1), s >= 2 ? 2 : 1, { mix, ramp, makeCanvas: makePixelCanvas, outline: outlineSprite }) : s >= 2 && heroKind(o.look) ? buildHero(o.look, o, { mix, ramp, makeCanvas: makePixelCanvas, outline: outlineSprite }) : s >= 2 ? buildPerson(s, o) : buildCrowd(resolveCharacter(o.look || {}, o, 1), { mix, ramp, makeCanvas: makePixelCanvas, outline: outlineSprite });
    spriteCache.set(key, spr);
  }
  return spr;
}

/**
 * Draw a person with feet at (x, y). Crowd sprites are 16x24-ish; focus sprites are 24x32-ish.
 * o: { look, dir, frame, dim, fog, pose, age, accessoryOverride, glasses, beard, scarf, bob, eyes, time }
 */
export function drawPerson(ctx, x, y, s, o) {
  const spr = spriteFor(s, o);
  const fx = Math.round(x);
  const fy = Math.round(y);
  ctx.drawImage(spr.cv, fx - spr.ox, fy - spr.oy);
}

export function drawPersonReflection(ctx, x, y, s, o, strength = PERSON_REFLECTION_STRENGTH) {
  if (strength <= 0) return;
  const spr = spriteFor(s, o);
  if (!spr.refl) {
    // the faded, flipped copy is built once per sprite on its own canvas (never composite 'destination-in' on the scene itself)
    const w = spr.cv.width;
    const h = spr.cv.height;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, -1, 0, h);
    c.drawImage(spr.cv, 0, 0);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    spr.refl = cv;
  }
  const fx = Math.round(x);
  const fy = Math.round(y);
  const offset = s >= 2 ? 2 : 1;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = Math.max(0, Math.min(1, strength));
  ctx.drawImage(spr.refl, fx - spr.ox, fy + 2 * offset + spr.oy - spr.cv.height);
  ctx.globalAlpha = prev;
}

export function drawShadow(ctx, x, y, w, alpha = 0.25) {
  const cx = Math.round(x);
  const fy = Math.round(y);
  const half = Math.round(w / 2);
  ctx.fillStyle = `rgba(6,6,16,${alpha * 0.55})`;
  ctx.fillRect(cx - half, fy - 1, half * 2, 2);
  ctx.fillStyle = `rgba(6,6,16,${alpha * 0.6})`;
  ctx.fillRect(cx - half + 2, fy - 2, Math.max(2, half * 2 - 4), 1);
  ctx.fillStyle = `rgba(6,6,16,${alpha * 0.9})`;
  ctx.fillRect(cx - half + 3, fy - 1, Math.max(2, half * 2 - 6), 1);
}

export const PROTAGONIST = {
  young: {
    variant: 'protagonist-young',
    skin: '#d8a177',
    hair: '#3b2c20',
    top: '#6d747c',
    bottom: '#355072',
    hairStyle: 'messy',
    accessory: 'book',
    bagColor: '#41596b',
  },
  adult: {
    variant: 'protagonist',
    skin: '#e0a878',
    hair: '#2a1a12',
    top: '#2f8a92',
    bottom: '#27365a',
    hairStyle: 'messy',
    accessory: 'book',
    bagColor: '#c8963c',
  },
  old: {
    variant: 'protagonist-old',
    age: 'old',
    skin: '#d49a6c',
    hair: '#d0d3da',
    top: '#737a84',
    bottom: '#34536f',
    hairStyle: 'messy',
    accessory: 'book',
    bagColor: '#4a5d67',
  },
};

export const PROFESSOR = {
  variant: 'professor',
  kit: 'professor',
  skin: '#ddb48d',
  hair: '#9a9eab',
  top: '#6f624c',
  bottom: '#313442',
  hairStyle: 'short',
  scarf: '#7a3a3a',
};

export function iconCanvas(kind, size = 20) {
  const cv = document.createElement('canvas');
  cv.width = 12;
  cv.height = 12;
  cv.style.width = `${size}px`;
  cv.style.height = `${size}px`;
  cv.style.imageRendering = 'pixelated';
  const ctx = cv.getContext('2d');
  const p = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  switch (kind) {
    case 'tract':
      p(3, 1, 6, 10, '#f2ead0');
      p(4, 3, 4, 1, '#8a7a5a');
      p(4, 5, 4, 1, '#8a7a5a');
      p(4, 7, 3, 1, '#8a7a5a');
      break;
    case 'bible':
      p(2, 1, 8, 10, '#5a3a2a');
      p(3, 2, 6, 8, '#7a5238');
      p(5, 3, 2, 6, '#e0c070');
      p(4, 5, 4, 2, '#e0c070');
      break;
    case 'team':
      p(1, 3, 3, 3, '#e0ac7e');
      p(1, 6, 3, 5, '#5f7189');
      p(5, 2, 3, 3, '#c68a60');
      p(5, 5, 3, 6, '#7a5a5a');
      p(9, 4, 2, 2, '#a0683f');
      p(9, 6, 2, 5, '#5a7a68');
      break;
    case 'study':
      p(1, 6, 10, 4, '#7a5238');
      p(2, 2, 3, 4, '#f2ead0');
      p(7, 2, 3, 4, '#f2ead0');
      p(5, 1, 2, 6, '#e0c070');
      break;
    case 'disciple':
      p(5, 1, 2, 10, '#e0c070');
      p(3, 3, 6, 2, '#e0c070');
      p(1, 8, 3, 3, '#5a7a68');
      p(8, 8, 3, 3, '#5f7189');
      break;
    case 'funds':
      p(2, 3, 8, 6, '#6a8a5a');
      p(3, 4, 6, 4, '#8aaa7a');
      p(5, 5, 2, 2, '#e8f0d8');
      break;
    case 'seed':
      p(5, 6, 2, 5, '#6a9a4a');
      p(3, 3, 3, 3, '#8aba5a');
      p(6, 2, 3, 3, '#9ada6a');
      break;
    case 'gear':
      p(4, 1, 4, 10, '#c8ccd8');
      p(1, 4, 10, 4, '#c8ccd8');
      p(3, 3, 6, 6, '#c8ccd8');
      p(5, 5, 2, 2, '#2a2e3c');
      break;
    default:
      p(2, 2, 8, 8, '#c8ccd8');
  }
  return cv;
}
