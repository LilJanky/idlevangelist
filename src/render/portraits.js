import { ENCOUNTERS, ENCOUNTER_ORDER } from '../data/content.js';
import { PROFESSOR, mix } from './sprites.js';
import { paintPortrait } from './portrait_art.js';

export const PORTRAIT_SIZE = 48;
export const PORTRAIT_MOODS = ['neutral', 'warm', 'guarded'];

const portraitCache = new Map();
const rampCache = new Map();
const paletteCache = new Map();

const HEAD_ROWS = [
  [5, 10], [4, 12], [3, 14], [2, 16], [1, 18], [1, 18], [0, 20], [0, 20], [0, 20], [0, 20],
  [0, 20], [0, 20], [1, 18], [1, 18], [2, 16], [3, 14], [4, 12], [5, 10],
];

const HOODIE_ROWS = [
  [12, 12], [10, 16], [8, 20], [6, 24], [4, 28], [2, 32], [1, 34], [0, 36], [0, 38],
  [1, 38], [2, 36], [4, 32], [6, 28], [9, 22], [12, 16], [15, 10],
];

const CARDIGAN_ROWS = [
  [14, 10], [10, 18], [7, 24], [5, 28], [3, 32], [2, 34], [1, 36], [0, 38], [0, 38],
  [1, 36], [2, 34], [4, 30], [6, 26], [10, 18], [13, 12], [16, 8],
];

const COAT_ROWS = [
  [13, 12], [10, 18], [8, 22], [6, 26], [4, 30], [2, 34], [1, 36], [0, 40], [0, 40],
  [0, 40], [1, 38], [2, 36], [4, 32], [7, 26], [10, 20], [14, 12],
];

const SHIRT_ROWS = [
  [14, 10], [11, 16], [8, 22], [6, 26], [4, 30], [2, 34], [1, 36], [0, 38], [0, 38],
  [1, 36], [2, 34], [4, 30], [6, 26], [9, 20], [13, 12], [16, 8],
];

const PORTRAIT_SPECS_RAW = {
  skeptic: {
    accent: '#506489',
    look: { ...ENCOUNTERS.skeptic.look, hairStyle: 0 },
    shirt: '#72889b',
    metal: '#7e8da4',
  },
  nominal: {
    accent: '#9d6848',
    look: { ...ENCOUNTERS.nominal.look, hairStyle: 2 },
    shirt: '#f1e7d8',
    cross: '#d7b45a',
  },
  broken: {
    accent: '#66584c',
    look: { ...ENCOUNTERS.broken.look, hairStyle: 0 },
    hat: '#475469',
    lining: '#8b7f70',
  },
  worker: {
    accent: '#4f7a7a',
    look: { ...ENCOUNTERS.worker.look, hairStyle: 1 },
    shirt: '#dde5e8',
    badge: '#d85252',
  },
  visitor: {
    accent: '#7f6d49',
    look: { ...ENCOUNTERS.visitor.look, hairStyle: 1 },
    shirt: '#f2f1eb',
    badge: '#d35858',
  },
  professor: {
    accent: '#7a5563',
    look: { ...PROFESSOR, hairStyle: 1 },
    shirt: '#f2ede4',
    scarf: '#7a3a3a',
    metal: '#a8b3c2',
  },
};

export const PORTRAIT_SPECS = Object.freeze(Object.fromEntries(
  Object.entries(PORTRAIT_SPECS_RAW).map(([id, spec]) => [id, Object.freeze({
    ...spec,
    id,
    look: Object.freeze({ ...spec.look }),
  })]),
));

export const PORTRAIT_IDS = Object.freeze([...ENCOUNTER_ORDER, 'professor']);

function normalizeMood(mood) {
  return PORTRAIT_MOODS.includes(mood) ? mood : 'neutral';
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
  if (canvas.style) canvas.style.imageRendering = 'pixelated';
  return canvas;
}

function ramp(base) {
  let cached = rampCache.get(base);
  if (!cached) {
    cached = {
      hi: mix(base, '#fff0cb', 0.28),
      base,
      lo: mix(base, '#1c1f33', 0.34),
      dk: mix(base, '#0d0f19', 0.62),
    };
    rampCache.set(base, cached);
  }
  return cached;
}

function buildPalette(spec) {
  let cached = paletteCache.get(spec.id);
  if (!cached) {
    cached = {
      bgLight: mix(spec.accent, '#20283c', 0.5),
      bgDark: mix(spec.accent, '#090b12', 0.86),
      frameHi: mix(spec.accent, '#fff0c8', 0.18),
      frameLo: mix(spec.accent, '#05070b', 0.55),
      skin: ramp(spec.look.skin),
      hair: ramp(spec.look.hair),
      top: ramp(spec.look.top),
      bottom: ramp(spec.look.bottom),
      shirt: ramp(spec.shirt || mix(spec.look.skin, '#f3eee4', 0.74)),
      hat: ramp(spec.hat || mix(spec.look.hair, '#4e5f79', 0.55)),
      metal: ramp(spec.metal || '#8491a8'),
      scarf: ramp(spec.scarf || '#7a3a3a'),
      lining: ramp(spec.lining || mix(spec.look.top, '#d7c2a8', 0.58)),
      cross: ramp(spec.cross || '#d7b45a'),
      badge: ramp(spec.badge || '#d85a5a'),
      ink: '#11121a',
      blink: '#f6f3ea',
      mouth: '#5d2d30',
      steam: mix(spec.accent, '#efe9dc', 0.64),
    };
    paletteCache.set(spec.id, cached);
  }
  return cached;
}

export function getPortraitSpec(id) {
  return PORTRAIT_SPECS[id] || null;
}

export function getPortraitPalette(id) {
  const spec = getPortraitSpec(id);
  return spec ? buildPalette(spec) : null;
}

function rect(ctx, x, y, w, h, color) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function dot(ctx, x, y, color) {
  rect(ctx, x, y, 1, 1, color);
}

function rowShape(ctx, x, y, rows, color) {
  rows.forEach(([dx, w], i) => rect(ctx, x + dx, y + i, w, 1, color));
}

function innerRows(rows, inset) {
  return rows.map(([dx, w]) => [dx + inset, Math.max(0, w - inset * 2)]);
}

function edgeRows(rows, inset, width, side) {
  return rows.map(([dx, w]) => {
    const avail = Math.max(0, w - inset * 2);
    if (avail <= 0) return [0, 0];
    const strip = Math.min(width, avail);
    const sx = side === 'left' ? dx + inset : dx + w - inset - strip;
    return [sx, strip];
  });
}

function shadowRows(rows, start, depth = 1) {
  return rows.map(([dx, w], i) => {
    if (i < start || w <= 2) return [0, 0];
    return [dx + 1, Math.max(0, w - 2 * depth)];
  });
}

function frameBackground(ctx, pal) {
  rect(ctx, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE, '#06070c');
  for (let y = 1; y < PORTRAIT_SIZE - 1; y++) {
    const t = y / (PORTRAIT_SIZE - 2);
    rect(ctx, 1, y, PORTRAIT_SIZE - 2, 1, mix(pal.bgLight, pal.bgDark, t));
  }
  rect(ctx, 1, 1, PORTRAIT_SIZE - 2, 1, pal.frameHi);
  rect(ctx, 1, 1, 1, PORTRAIT_SIZE - 2, mix(pal.frameHi, '#ffffff', 0.18));
  rect(ctx, 1, PORTRAIT_SIZE - 2, PORTRAIT_SIZE - 2, 1, pal.frameLo);
  rect(ctx, PORTRAIT_SIZE - 2, 1, 1, PORTRAIT_SIZE - 2, pal.frameLo);
  rect(ctx, 2, 2, PORTRAIT_SIZE - 4, 1, mix(pal.bgLight, '#ffffff', 0.06));
  rect(ctx, 2, 2, 1, PORTRAIT_SIZE - 4, mix(pal.bgLight, '#ffffff', 0.04));
  dot(ctx, 5, 5, mix(pal.bgLight, '#ffffff', 0.12));
  dot(ctx, 39, 9, mix(pal.bgLight, '#ffffff', 0.08));
  dot(ctx, 42, 13, mix(pal.bgLight, '#ffffff', 0.08));
}

function drawHeadBase(ctx, pal, x = 14, y = 9) {
  rowShape(ctx, x, y, HEAD_ROWS, pal.skin.dk);
  rowShape(ctx, x, y, innerRows(HEAD_ROWS, 1), pal.skin.base);
  rowShape(ctx, x, y, edgeRows(HEAD_ROWS, 2, 3, 'left'), pal.skin.hi);
  rowShape(ctx, x, y, edgeRows(HEAD_ROWS, 2, 3, 'right'), pal.skin.lo);
  rowShape(ctx, x, y + 9, shadowRows(innerRows(HEAD_ROWS, 1), 0, 2), mix(pal.skin.lo, pal.skin.dk, 0.38));
  rect(ctx, x - 1, y + 7, 1, 5, pal.skin.lo);
  rect(ctx, x + 20, y + 7, 1, 5, pal.skin.lo);
  rect(ctx, x + 8, y + 18, 4, 2, mix(pal.skin.lo, pal.skin.dk, 0.2));
}

function drawNeck(ctx, pal, x = 21, y = 26) {
  rect(ctx, x, y, 6, 4, pal.skin.dk);
  rect(ctx, x + 1, y, 4, 4, pal.skin.base);
  rect(ctx, x + 1, y, 1, 3, pal.skin.hi);
  rect(ctx, x + 4, y, 1, 4, pal.skin.lo);
}

function drawBust(ctx, pal, rows, x, y, mainRamp, options = {}) {
  rowShape(ctx, x, y, rows, options.outline || mainRamp.dk);
  rowShape(ctx, x, y, innerRows(rows, 1), mainRamp.base);
  rowShape(ctx, x, y, edgeRows(rows, 2, options.highlightWidth || 4, 'left'), mainRamp.hi);
  rowShape(ctx, x, y, edgeRows(rows, 2, options.shadowWidth || 5, 'right'), options.shadow || mainRamp.lo);
  if (options.hemY !== undefined) rect(ctx, x + 7, y + options.hemY, 24, 1, options.hem || mainRamp.lo);
}

function drawHairCap(ctx, x, y, rows, ramp, hiWidth = 4) {
  rowShape(ctx, x, y, rows, ramp.dk);
  rowShape(ctx, x, y, innerRows(rows, 1), ramp.base);
  rowShape(ctx, x, y, edgeRows(rows, 2, hiWidth, 'left'), ramp.hi);
  rowShape(ctx, x, y, edgeRows(rows, 1, 3, 'right'), ramp.lo);
}

function drawEyesAndBrows(ctx, pal, id, mood) {
  const warm = mood === 'warm';
  const guarded = mood === 'guarded';
  const lx = 20;
  const rx = 28;
  const brow = pal.hair.dk;
  const eye = pal.ink;
  const shine = pal.blink;
  let browY = 17;
  let eyeY = 20;
  if (id === 'broken') eyeY = 21;
  if (id === 'professor') browY = 18;

  const browLine = (x, y, slant = 0, raised = 0, w = 4) => {
    for (let i = 0; i < w; i++) dot(ctx, x + i, y + Math.floor((i + slant) / 3) - raised, brow);
  };

  if (id === 'skeptic') {
    browLine(18, browY, guarded ? 2 : 1, warm ? 0 : 1, 5);
    browLine(27, browY + (warm ? 1 : 0), guarded ? -2 : -1, 0, 5);
  } else if (id === 'broken') {
    browLine(18, browY + 1, 0, 0, 4);
    browLine(27, browY + 1, 0, 0, 4);
  } else if (id === 'visitor') {
    browLine(19, browY, 0, warm ? 0 : 1, 4);
    browLine(27, browY, 0, warm ? 0 : 1, 4);
  } else if (id === 'professor') {
    browLine(18, browY, guarded ? 1 : 0, 0, 4);
    browLine(27, browY, guarded ? -1 : 0, 0, 4);
  } else {
    browLine(18, browY, guarded ? 1 : 0, warm ? 0 : 1, 4);
    browLine(27, browY, guarded ? -1 : 0, warm ? 0 : 1, 4);
  }

  const eyeWidth = id === 'broken' ? 2 : 3;
  rect(ctx, lx, eyeY, eyeWidth, 1, eye);
  rect(ctx, rx, eyeY, eyeWidth, 1, eye);
  if (!guarded) {
    dot(ctx, lx + (id === 'skeptic' ? 1 : 0), eyeY - 1, shine);
    dot(ctx, rx + 1, eyeY - 1, shine);
  }
  if (id === 'broken' || guarded) {
    rect(ctx, lx, eyeY + 1, eyeWidth, 1, mix(pal.skin.lo, pal.skin.dk, 0.4));
    rect(ctx, rx, eyeY + 1, eyeWidth, 1, mix(pal.skin.lo, pal.skin.dk, 0.4));
  }
  if (id === 'worker') {
    rect(ctx, lx, eyeY + 1, eyeWidth, 1, mix(pal.skin.lo, pal.skin.dk, 0.3));
    rect(ctx, rx, eyeY + 1, eyeWidth, 1, mix(pal.skin.lo, pal.skin.dk, 0.3));
  }
}

function drawMouth(ctx, pal, id, mood) {
  const warm = mood === 'warm';
  const guarded = mood === 'guarded';
  const mouth = pal.mouth;
  const y = id === 'professor' ? 28 : 27;
  if (id === 'skeptic') {
    rect(ctx, 22, y, 4, 1, guarded ? mix(mouth, '#2a1214', 0.2) : mouth);
    if (!guarded) dot(ctx, 26, y - 1, mouth);
    if (warm) dot(ctx, 21, y - 1, mouth);
  } else if (id === 'broken') {
    rect(ctx, 22, y + 1, 4, 1, warm ? mouth : pal.skin.dk);
    if (warm) dot(ctx, 21, y, mouth);
  } else if (id === 'visitor') {
    rect(ctx, 21, y, 6, 1, mouth);
    dot(ctx, 20, y - 1, mouth);
    dot(ctx, 27, y - 1, mouth);
    dot(ctx, 22, y - 1, mix(mouth, '#f4d8d2', 0.08));
    dot(ctx, 25, y - 1, mix(mouth, '#f4d8d2', 0.08));
    if (warm) rect(ctx, 22, y - 1, 4, 1, mix(mouth, '#f6d7d1', 0.12));
  } else if (id === 'professor') {
    rect(ctx, 22, y, 4, 1, mouth);
    if (warm) dot(ctx, 26, y - 1, mouth);
    if (guarded) dot(ctx, 21, y, pal.skin.dk);
  } else {
    rect(ctx, 22, y, 4, 1, mouth);
    if (warm) {
      dot(ctx, 21, y - 1, mouth);
      dot(ctx, 26, y - 1, mouth);
    }
    if (guarded) {
      dot(ctx, 21, y, pal.skin.dk);
      dot(ctx, 26, y, pal.skin.dk);
    }
  }
}

function drawNose(ctx, pal) {
  rect(ctx, 25, 22, 1, 4, pal.skin.lo);
  dot(ctx, 24, 25, mix(pal.skin.lo, pal.skin.dk, 0.28));
}

function drawSkeptic(ctx, pal, mood) {
  drawBust(ctx, pal, HOODIE_ROWS, 4, 31, pal.top, { hemY: 11 });
  rect(ctx, 12, 30, 24, 7, pal.top.lo);
  rect(ctx, 17, 32, 14, 4, pal.top.dk);
  rect(ctx, 16, 37, 16, 5, pal.top.lo);
  rect(ctx, 16, 37, 3, 5, pal.top.hi);
  rect(ctx, 29, 37, 2, 5, pal.top.dk);
  rect(ctx, 18, 34, 2, 6, mix('#e7ebf3', pal.top.hi, 0.4));
  rect(ctx, 28, 34, 2, 6, mix('#e7ebf3', pal.top.hi, 0.4));
  rect(ctx, 13, 34, 5, 3, pal.metal.dk);
  rect(ctx, 30, 34, 5, 3, pal.metal.dk);
  rect(ctx, 14, 35, 3, 2, pal.metal.base);
  rect(ctx, 31, 35, 3, 2, pal.metal.base);
  rect(ctx, 18, 32, 12, 2, mix(pal.metal.base, '#95b6d6', 0.24));
  drawNeck(ctx, pal);
  drawHeadBase(ctx, pal);
  drawHairCap(ctx, 11, 7, [
    [7, 8], [5, 12], [4, 14], [2, 18], [1, 20], [1, 20], [0, 22], [0, 22], [1, 21], [2, 20], [3, 18], [5, 14], [8, 8],
  ], pal.hair, 5);
  rect(ctx, 12, 15, 4, 8, pal.hair.base);
  rect(ctx, 30, 15, 3, 7, pal.hair.lo);
  dot(ctx, 12, 8, pal.hair.hi);
  dot(ctx, 16, 6, pal.hair.hi);
  dot(ctx, 21, 5, pal.hair.base);
  dot(ctx, 28, 6, pal.hair.lo);
  dot(ctx, 31, 8, pal.hair.lo);
  drawNose(ctx, pal);
  drawEyesAndBrows(ctx, pal, 'skeptic', mood);
  rect(ctx, 17, 24, 14, 6, mix(pal.hair.base, pal.skin.lo, 0.34));
  rect(ctx, 18, 29, 12, 2, mix(pal.hair.lo, pal.skin.dk, 0.22));
  rect(ctx, 16, 26, 2, 3, mix(pal.hair.base, pal.skin.lo, 0.28));
  rect(ctx, 30, 26, 2, 3, mix(pal.hair.base, pal.skin.lo, 0.28));
  dot(ctx, 19, 24, pal.hair.lo);
  dot(ctx, 30, 24, pal.hair.lo);
  drawMouth(ctx, pal, 'skeptic', mood);
}

function drawNominal(ctx, pal, mood) {
  for (let i = 0; i < 4; i++) dot(ctx, 38 + (i & 1), 9 + i * 3, pal.steam);
  drawBust(ctx, pal, CARDIGAN_ROWS, 5, 31, pal.top, { hemY: 10 });
  drawBust(ctx, pal, [[16, 8], [14, 12], [12, 16], [10, 20], [9, 22], [8, 24], [8, 24], [9, 22], [10, 20], [12, 16], [14, 12], [16, 8]], 8, 32, pal.shirt, { highlightWidth: 5, shadowWidth: 3, hemY: 6, hem: pal.shirt.lo });
  rect(ctx, 23, 39, 3, 4, pal.cross.base);
  rect(ctx, 24, 38, 1, 6, pal.cross.hi);
  rect(ctx, 22, 40, 5, 1, pal.cross.base);
  drawNeck(ctx, pal);
  drawHeadBase(ctx, pal, 14, 10);
  drawHairCap(ctx, 10, 7, [
    [5, 10], [3, 14], [2, 16], [1, 18], [0, 20], [0, 20], [0, 20], [0, 20], [1, 20], [2, 19], [3, 18], [4, 16], [6, 13],
  ], pal.hair, 5);
  rect(ctx, 11, 12, 5, 18, pal.hair.base);
  rect(ctx, 12, 13, 2, 15, pal.hair.hi);
  rect(ctx, 31, 12, 5, 17, pal.hair.lo);
  rect(ctx, 10, 27, 7, 5, pal.hair.base);
  rect(ctx, 31, 26, 7, 5, pal.hair.lo);
  rect(ctx, 18, 8, 10, 2, mix(pal.hair.hi, '#fff4e4', 0.14));
  dot(ctx, 35, 27, pal.hair.lo);
  dot(ctx, 13, 28, pal.hair.base);
  drawNose(ctx, pal);
  drawEyesAndBrows(ctx, pal, 'nominal', mood);
  rect(ctx, 22, 27, 4, 1, pal.mouth);
  dot(ctx, 21, 26, pal.mouth);
  dot(ctx, 26, 26, pal.mouth);
  if (mood !== 'guarded') rect(ctx, 22, 26, 4, 1, mix(pal.mouth, '#f3c7bf', 0.08));
  if (mood === 'warm') {
    dot(ctx, 20, 25, pal.mouth);
    dot(ctx, 27, 25, pal.mouth);
  }
}

function drawBroken(ctx, pal, mood) {
  drawBust(ctx, pal, COAT_ROWS, 4, 30, pal.top, { hemY: 12 });
  rect(ctx, 10, 32, 28, 5, mix(pal.top.base, '#6e593d', 0.18));
  for (let y = 33; y < 43; y += 3) {
    rect(ctx, 11, y, 26, 1, pal.top.lo);
    dot(ctx, 13, y - 1, pal.top.hi);
    dot(ctx, 34, y, pal.top.dk);
  }
  rect(ctx, 13, 31, 22, 6, pal.lining.lo);
  rect(ctx, 16, 33, 16, 4, pal.lining.base);
  drawNeck(ctx, pal, 21, 25);
  drawHeadBase(ctx, pal, 14, 10);
  drawHairCap(ctx, 12, 8, [
    [6, 8], [4, 12], [3, 14], [2, 16], [1, 18], [1, 18], [1, 18], [2, 17], [3, 16], [4, 14], [6, 10],
  ], pal.hat, 4);
  rect(ctx, 12, 11, 4, 12, pal.hat.lo);
  rect(ctx, 32, 11, 4, 12, pal.hat.lo);
  rect(ctx, 14, 18, 20, 2, pal.hat.dk);
  drawNose(ctx, pal);
  drawEyesAndBrows(ctx, pal, 'broken', mood);
  rect(ctx, 17, 24, 14, 8, pal.hair.dk);
  rect(ctx, 18, 25, 12, 7, pal.hair.base);
  rect(ctx, 18, 25, 2, 7, pal.hair.lo);
  rect(ctx, 28, 25, 2, 7, pal.hair.lo);
  rect(ctx, 16, 29, 16, 2, pal.hair.dk);
  rect(ctx, 21, 22, 8, 4, mix(pal.hair.base, pal.skin.lo, 0.35));
  drawMouth(ctx, pal, 'broken', mood);
}

function drawWorker(ctx, pal, mood) {
  drawBust(ctx, pal, SHIRT_ROWS, 5, 31, pal.shirt, { hemY: 10, highlightWidth: 5, shadowWidth: 4 });
  rect(ctx, 18, 31, 2, 11, pal.badge.base);
  rect(ctx, 19, 33, 1, 8, pal.badge.hi);
  rect(ctx, 22, 31, 4, 12, pal.bottom.base);
  rect(ctx, 23, 31, 2, 10, pal.bottom.hi);
  rect(ctx, 21, 42, 6, 2, pal.bottom.lo);
  rect(ctx, 17, 36, 6, 5, '#f4f2eb');
  rect(ctx, 17, 36, 6, 1, '#ffffff');
  dot(ctx, 18, 38, '#4a8fd4');
  rect(ctx, 25, 36, 6, 5, '#f4f2eb');
  rect(ctx, 25, 36, 6, 1, '#ffffff');
  dot(ctx, 26, 38, '#4a8fd4');
  drawNeck(ctx, pal);
  drawHeadBase(ctx, pal);
  drawHairCap(ctx, 12, 8, [
    [7, 8], [5, 12], [3, 16], [2, 18], [1, 20], [0, 21], [0, 22], [0, 22], [1, 21], [3, 19], [5, 16], [7, 12], [9, 8],
  ], pal.hair, 4);
  dot(ctx, 14, 7, pal.hair.hi);
  dot(ctx, 18, 6, pal.hair.base);
  dot(ctx, 24, 5, pal.hair.base);
  dot(ctx, 31, 7, pal.hair.lo);
  dot(ctx, 27, 6, pal.hair.base);
  rect(ctx, 12, 14, 3, 7, pal.hair.base);
  rect(ctx, 30, 14, 2, 6, pal.hair.lo);
  drawNose(ctx, pal);
  drawEyesAndBrows(ctx, pal, 'worker', mood);
  rect(ctx, 18, 23, 3, 1, mix(pal.skin.lo, pal.skin.dk, 0.4));
  rect(ctx, 28, 23, 3, 1, mix(pal.skin.lo, pal.skin.dk, 0.4));
  drawMouth(ctx, pal, 'worker', mood);
}

function drawVisitor(ctx, pal, mood) {
  drawBust(ctx, pal, SHIRT_ROWS, 5, 31, pal.shirt, { hemY: 10, highlightWidth: 6, shadowWidth: 3 });
  rect(ctx, 21, 31, 5, 13, pal.bottom.base);
  rect(ctx, 22, 31, 2, 11, pal.bottom.hi);
  rect(ctx, 17, 35, 7, 5, '#ffffff');
  rect(ctx, 17, 35, 7, 1, '#ffffff');
  rect(ctx, 24, 35, 7, 5, '#ffffff');
  rect(ctx, 31, 35, 1, 5, pal.shirt.lo);
  rect(ctx, 28, 37, 8, 5, pal.badge.base);
  rect(ctx, 29, 38, 6, 1, '#ffffff');
  dot(ctx, 31, 40, '#3a78c0');
  drawNeck(ctx, pal);
  drawHeadBase(ctx, pal, 14, 10);
  drawHairCap(ctx, 12, 8, [
    [6, 10], [4, 14], [3, 16], [2, 18], [1, 20], [1, 20], [1, 20], [1, 20], [2, 19], [3, 18], [5, 14], [7, 10],
  ], pal.hair, 4);
  rect(ctx, 31, 10, 4, 10, pal.hair.lo);
  rect(ctx, 15, 10, 9, 2, pal.hair.hi);
  rect(ctx, 24, 10, 8, 3, pal.hair.base);
  rect(ctx, 28, 12, 6, 2, pal.hair.lo);
  dot(ctx, 28, 12, pal.hair.lo);
  drawNose(ctx, pal);
  drawEyesAndBrows(ctx, pal, 'visitor', mood);
  drawMouth(ctx, pal, 'visitor', mood);
}

function drawProfessor(ctx, pal, mood) {
  drawBust(ctx, pal, CARDIGAN_ROWS, 5, 31, pal.top, { hemY: 10 });
  for (let y = 33; y <= 42; y += 2) {
    for (let x = 12 + ((y / 2) & 1); x < 36; x += 4) dot(ctx, x, y, mix(pal.top.lo, pal.top.dk, 0.16));
  }
  rect(ctx, 17, 33, 14, 8, pal.shirt.base);
  rect(ctx, 18, 33, 2, 7, pal.shirt.hi);
  rect(ctx, 29, 33, 1, 8, pal.shirt.lo);
  rect(ctx, 16, 32, 16, 4, pal.scarf.base);
  rect(ctx, 17, 33, 14, 1, pal.scarf.hi);
  rect(ctx, 23, 34, 3, 10, pal.scarf.lo);
  drawNeck(ctx, pal);
  drawHeadBase(ctx, pal, 14, 10);
  drawHairCap(ctx, 11, 8, [
    [6, 10], [4, 14], [3, 16], [2, 18], [1, 20], [1, 20], [1, 20], [2, 20], [3, 18], [4, 17], [6, 14], [8, 10],
  ], pal.hair, 5);
  rect(ctx, 11, 13, 4, 7, pal.hair.base);
  rect(ctx, 32, 13, 4, 7, pal.hair.lo);
  rect(ctx, 13, 30, 24, 2, pal.top.dk);
  drawNose(ctx, pal);
  drawEyesAndBrows(ctx, pal, 'professor', mood);
  rect(ctx, 17, 19, 7, 4, pal.metal.dk);
  rect(ctx, 18, 20, 5, 2, mix(pal.metal.base, '#dde7f2', 0.2));
  rect(ctx, 25, 19, 7, 4, pal.metal.dk);
  rect(ctx, 26, 20, 5, 2, mix(pal.metal.base, '#dde7f2', 0.2));
  rect(ctx, 24, 20, 1, 1, pal.metal.base);
  dot(ctx, 19, 20, '#f7fbff');
  dot(ctx, 27, 20, '#f7fbff');
  drawMouth(ctx, pal, 'professor', mood);
}

function renderPortrait(ctx, spec, mood) {
  const pal = buildPalette(spec);
  ctx.clearRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
  ctx.imageSmoothingEnabled = false;
  frameBackground(ctx, pal);
  paintPortrait(ctx, spec.id, mood, { look: spec.look, ramp, mix });
}

export function makePortraitCanvas(id, opts = {}) {
  const spec = getPortraitSpec(id);
  if (!spec) return null;
  const mood = normalizeMood(opts.mood);
  const key = `${spec.id}|${mood}`;
  if (portraitCache.has(key)) return portraitCache.get(key);
  const canvas = makePixelCanvas(PORTRAIT_SIZE, PORTRAIT_SIZE);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  renderPortrait(ctx, spec, mood);
  portraitCache.set(key, canvas);
  return canvas;
}

export function drawPortrait(target, id, opts = {}) {
  const source = makePortraitCanvas(id, opts);
  if (!source || !target) return false;
  const canvas = typeof target.getContext === 'function' ? target : target.canvas;
  const ctx = typeof target.getContext === 'function' ? target.getContext('2d', { willReadFrequently: true }) : target;
  if (!ctx) return false;
  if (canvas && !opts.keepSize && typeof target.getContext === 'function') {
    canvas.width = opts.width || PORTRAIT_SIZE;
    canvas.height = opts.height || PORTRAIT_SIZE;
    if (canvas.style) canvas.style.imageRendering = 'pixelated';
  }
  ctx.imageSmoothingEnabled = false;
  const x = opts.x || 0;
  const y = opts.y || 0;
  const width = opts.width || PORTRAIT_SIZE * (opts.scale || 1);
  const height = opts.height || PORTRAIT_SIZE * (opts.scale || 1);
  if (canvas && x === 0 && y === 0 && width === canvas.width && height === canvas.height) ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, x, y, width, height);
  return true;
}

export function clearPortraitCache() {
  portraitCache.clear();
}
