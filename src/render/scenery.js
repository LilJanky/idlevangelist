import { mix } from './sprites.js';

const SHOP_TYPES = ['bakery', 'pawn', 'laundromat', 'phone', 'pharmacy', 'noodles', 'books', 'market'];
const ACCENTS = ['#4b6f7f', '#6d4652', '#8b7148', '#8f6676', '#54706c', '#7a5668'];
// bakery warm tan, pawn deep red, laundromat sky blue, phone repair teal, pharmacy green, noodles orange, books plum, market olive
const SHOP_COLOR = { bakery: '#a07a48', pawn: '#8a3a40', laundromat: '#4a82a8', phone: '#3a8a8c', pharmacy: '#4a8a5c', noodles: '#b8683a', books: '#7a4a78', market: '#7c8a40' };
// the storefront row: brick red, slate teal, ochre, plum, deep blue; each building is a clearly different colour
const NEAR_BASES = ['#6a3a42', '#2f5560', '#7a6038', '#563a62', '#34466e'];
const NEAR_WARMS = ['#8f846f', '#a09783', '#b3a489', '#978776'];
const MID_BASES = ['#3a3a6a', '#344a72', '#4a3a70'];
const FAR_BASES = ['#3e3470', '#463a78', '#38407a'];

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const sceneX = (w, t) => Math.round(w * t);
const sceneSpan = (w, t, min = 1) => Math.max(min, Math.round(w * t));

function hash2(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

function stationWarmAt(x, warmth, w) {
  if (warmth <= 0) return 0;
  const edge = w * (0.2 + warmth * 0.54);
  const fade = w * 0.24;
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

function fillVerticalBands(ctx, w, stops, colors) {
  for (let i = 0; i < colors.length; i++) {
    const y0 = stops[i];
    const y1 = stops[i + 1];
    ctx.fillStyle = colors[i];
    ctx.fillRect(0, y0, w, y1 - y0 + 1);
    if (i < colors.length - 1) ditherRect(ctx, 0, Math.max(0, y1 - 2), w, 3, colors[i + 1], i);
  }
}

function drawCloud(ctx, x, y, palette, seed) {
  const width = 20 + Math.floor(hash2(seed, 60) * 18);
  const body = [
    { dx: 0, dy: 5, w: width - 3, h: 4, c: palette.shadow },
    { dx: 2, dy: 3, w: width - 7, h: 3, c: palette.mid },
    { dx: 6, dy: 1, w: width - 13, h: 3, c: palette.light },
    { dx: Math.floor(width * 0.18), dy: 0, w: Math.max(6, Math.floor(width * 0.28)), h: 2, c: palette.light },
    { dx: Math.floor(width * 0.52), dy: 0, w: Math.max(5, Math.floor(width * 0.24)), h: 2, c: palette.light },
    { dx: 4, dy: 8, w: width - 10, h: 1, c: palette.under },
  ];
  for (const p of body) {
    ctx.fillStyle = p.c;
    ctx.fillRect(x + p.dx, y + p.dy, p.w, p.h);
  }
}

function drawTowerWindows(ctx, b, y, fogT, localWarm, litBoost, body) {
  const cols = Math.max(2, Math.floor((b.w - 4) / 5));
  const step = cols > 2 ? 5 : 4;
  const dark = mix(body, '#16123c', 0.34);
  const lit = mix(mix('#ffd37a', '#ffe9b0', localWarm * 0.5), body, fogT * 0.4);
  for (let wy = y + 4; wy < b.baseY - 6; wy += 5) {
    for (let col = 0; col < cols; col++) {
      const wx = b.x + 2 + col * step;
      if (wx > b.x + b.w - 4) continue;
      ctx.fillStyle = hash2(b.seed * 17 + wx, wy) < litBoost + 0.2 ? lit : dark;
      ctx.fillRect(wx, wy, 2, 2);
    }
  }
}

function drawUpperFloorWindows(ctx, b, topY, localWarm, restored, body) {
  const cols = b.upperCols;
  const step = Math.max(5, Math.floor((b.w - 4) / cols));
  const warmBias = Math.max(localWarm, 0.3 + restored * 0.1);
  const litColor = mix('#ffd27a', '#ffe8b8', warmBias * 0.5);
  const dark = mix(body, '#100c28', 0.55);
  const frame = mix(body, '#100c28', 0.25);
  for (let row = 0, wy = topY + 5; wy < b.baseY - b.groundH - 2; row++, wy += 6) {
    for (let col = 0; col < cols; col++) {
      const wx = b.x + 2 + col * step;
      if (wx > b.x + b.w - 5) continue;
      const litChance = 0.3 + localWarm * 0.15 + restored * 0.2;
      const lit = hash2(b.seed * 13 + col, row + 91) < litChance;
      ctx.fillStyle = frame;
      ctx.fillRect(wx - 1, wy - 1, 5, 4);
      ctx.fillStyle = lit ? litColor : dark;
      ctx.fillRect(wx, wy, 3, 2);
    }
  }
}

function drawSignIcon(ctx, x, y, type, color) {
  ctx.fillStyle = color;
  switch (type) {
    case 'bakery':
      // a loaf with scored top
      ctx.fillRect(x, y + 2, 7, 2);
      ctx.fillRect(x + 1, y + 1, 5, 1);
      ctx.fillRect(x + 2, y, 3, 1);
      break;
    case 'pawn':
      ctx.fillRect(x + 2, y - 1, 3, 5);
      ctx.fillRect(x + 1, y, 5, 3);
      ctx.fillRect(x, y + 3, 7, 1);
      break;
    case 'laundromat':
      ctx.fillRect(x, y, 7, 5);
      ctx.fillRect(x + 2, y + 1, 3, 3);
      break;
    case 'phone':
      // a handset with a cracked-screen corner
      ctx.fillRect(x + 2, y - 1, 3, 6);
      ctx.fillRect(x + 3, y + 4, 1, 1);
      break;
    case 'pharmacy':
      // a capsule with a split colour and a small mortar bowl underneath: a pharmacy, not a hospital cross
      ctx.fillRect(x + 1, y, 5, 2);
      ctx.fillRect(x + 3, y, 1, 2);
      ctx.fillRect(x + 1, y + 3, 5, 1);
      ctx.fillRect(x + 2, y + 4, 3, 1);
      break;
    case 'noodles':
      ctx.fillRect(x + 1, y + 2, 5, 2);
      ctx.fillRect(x, y + 1, 1, 1);
      ctx.fillRect(x + 6, y + 1, 1, 1);
      ctx.fillRect(x + 2, y - 1, 1, 3);
      ctx.fillRect(x + 4, y - 1, 1, 3);
      break;
    case 'books':
      ctx.fillRect(x, y, 2, 5);
      ctx.fillRect(x + 2, y + 1, 2, 4);
      ctx.fillRect(x + 4, y, 2, 5);
      break;
    default:
      ctx.fillRect(x, y + 1, 7, 3);
      ctx.fillRect(x + 1, y, 5, 1);
      ctx.fillRect(x + 2, y + 4, 3, 1);
      break;
  }
}

function drawAwning(ctx, b, y, localWarm, restored) {
  const awningY = b.baseY - b.groundH - 4;
  const accent = mix(SHOP_COLOR[b.shopType] || ACCENTS[b.accent], '#d6b48d', restored * 0.3);
  const cream = mix('#e8e2d4', '#f6ecd6', restored * 0.4);
  ctx.fillStyle = mix(accent, '#100c28', 0.25);
  ctx.fillRect(b.x + 1, awningY + 3, b.w - 2, 1);
  for (let x = b.x + 1, i = 0; x < b.x + b.w - 1; x += 3, i++) {
    ctx.fillStyle = i % 2 ? cream : accent;
    ctx.fillRect(x, awningY, Math.min(3, b.x + b.w - 1 - x), 3);
  }
}

function drawStorefront(ctx, b, y, localWarm, restored) {
  const storefrontY = b.baseY - b.groundH;
  const accent = mix(SHOP_COLOR[b.shopType] || ACCENTS[b.accent], '#d2b793', restored * 0.4);
  const wall = mix('#202734', '#8f826e', restored * 0.52);
  ctx.fillStyle = wall;
  ctx.fillRect(b.x + 1, storefrontY, b.w - 2, b.groundH);
  ctx.fillStyle = mix('#0f1321', '#50463d', restored * 0.32);
  ctx.fillRect(b.x + 1, storefrontY, b.w - 2, 1);

  const warmBias = Math.max(localWarm, 0.34 + restored * 0.14);
  const glass = mix('#e2a24e', '#ffd88a', warmBias * 0.5);
  const glassTop = mix(glass, '#fff0c0', 0.45);
  const shelf = mix(glass, '#5a2a1c', 0.5);
  const frameC = mix('#100c28', accent, 0.25);
  const shutter = mix('#4a5570', '#9c8e7b', restored * 0.35);

  const doorW = 4;
  const doorX = b.doorSide === 'left' ? b.x + 2 : b.x + b.w - 6;
  const leftWindowX = b.x + 2;
  const rightWindowX = b.x + 7;
  const windowW = Math.max(5, Math.floor((b.w - 11) / 2));

  if (b.closed && restored < 0.82) {
    ctx.fillStyle = shutter;
    ctx.fillRect(b.x + 2, storefrontY + 2, b.w - 4, b.groundH - 3);
    ctx.fillStyle = mix(shutter, '#10102a', 0.3);
    for (let sy = storefrontY + 4; sy < storefrontY + b.groundH - 1; sy += 3) ctx.fillRect(b.x + 2, sy, b.w - 4, 1);
  } else {
    for (const wx of [leftWindowX, rightWindowX + windowW - 1]) {
      ctx.fillStyle = frameC;
      ctx.fillRect(wx, storefrontY + 3, windowW + 1, b.groundH - 5);
      ctx.fillStyle = glass;
      ctx.fillRect(wx + 1, storefrontY + 4, windowW - 1, b.groundH - 7);
      ctx.fillStyle = glassTop;
      ctx.fillRect(wx + 1, storefrontY + 4, windowW - 1, 1);
      ctx.fillStyle = shelf;
      ctx.fillRect(wx + 1, storefrontY + b.groundH - 6, windowW - 1, 2);
      ctx.fillRect(wx + 2, storefrontY + b.groundH - 9, Math.max(2, windowW - 3), 3);
    }
  }

  ctx.fillStyle = frameC;
  ctx.fillRect(doorX, storefrontY + 2, doorW, b.groundH - 2);
  ctx.fillStyle = mix('#4a6a8a', '#d7b68f', localWarm * 0.5 + restored * 0.22);
  ctx.fillRect(doorX + 1, storefrontY + 3, doorW - 2, b.groundH - 5);
  ctx.fillStyle = mix('#a8c8e0', '#ffe2a8', warmBias * 0.6);
  ctx.fillRect(doorX + 1, storefrontY + 3, doorW - 2, 2);

  drawAwning(ctx, b, y, localWarm, restored);

  // sign board: a clear bright panel with one cream icon, one board colour per shop type
  const signY = storefrontY + 1;
  const board = mix(accent, '#ffffff', 0.12);
  ctx.fillStyle = mix(board, '#100c28', 0.45);
  ctx.fillRect(b.x + 2, signY - 8, b.w - 4, 8);
  ctx.fillStyle = board;
  ctx.fillRect(b.x + 3, signY - 7, b.w - 6, 6);
  drawSignIcon(ctx, b.x + Math.max(3, Math.floor((b.w - 7) / 2)), signY - 6, b.shopType, mix('#f6f2e4', '#fff6dc', restored * 0.3));
}

function drawRoofDetail(ctx, b, y, restored) {
  const roof = mix('#161a24', '#7f6e59', restored * 0.28);
  ctx.fillStyle = roof;
  switch (b.roofKind) {
    case 0:
      ctx.fillRect(b.x + 2, y - 5, 1, 5);
      ctx.fillRect(b.x + 1, y - 4, 3, 1);
      break;
    case 1:
      ctx.fillRect(b.x + b.w - 6, y - 4, 4, 3);
      ctx.fillRect(b.x + b.w - 5, y - 5, 2, 1);
      break;
    case 2:
      ctx.fillRect(b.x + 2, y - 3, 5, 3);
      ctx.fillRect(b.x + 3, y - 5, 3, 2);
      break;
    case 3:
      ctx.fillRect(b.x + b.w - 8, y - 5, 6, 5);
      ctx.fillStyle = mix('#293445', '#bda889', restored * 0.25);
      ctx.fillRect(b.x + b.w - 7, y - 4, 4, 1);
      break;
    default:
      ctx.fillRect(b.x + 2, y - 6, 1, 6);
      ctx.fillRect(b.x + 6, y - 4, 1, 4);
      ctx.fillRect(b.x + 2, y - 4, 5, 1);
      break;
  }
}

function drawNearBuilding(ctx, b, groundTop, wp, W) {
  const y = b.baseY - b.h;
  const restored = wp.restoration;
  const localWarm = Math.max(restored * 0.92, stationWarmAt(b.x + b.w / 2, wp.warmth, W));
  const coolBase = NEAR_BASES[b.tone % NEAR_BASES.length];
  const warmBase = NEAR_WARMS[b.tone % NEAR_WARMS.length];
  const body = mix(coolBase, warmBase, restored * 0.74);
  const left = mix(mix(body, '#b8cce0', 0.22), '#f4e5ca', localWarm * 0.18);
  const right = mix(body, '#12102a', 0.42);
  const brick = mix('#273548', '#a5947d', restored * 0.5);

  ctx.fillStyle = mix('#0e0b1e', '#4a4038', restored * 0.5);
  ctx.fillRect(b.x - 1, y - 1, b.w + 2, b.h + 1);
  ctx.fillStyle = body;
  ctx.fillRect(b.x, y, b.w, b.h);
  ctx.fillStyle = left;
  ctx.fillRect(b.x, y, 1, b.h);
  ctx.fillStyle = right;
  ctx.fillRect(b.x + b.w - 1, y, 1, b.h);
  ctx.fillStyle = mix('#1a2130', '#7e6f5b', restored * 0.42);
  ctx.fillRect(b.x - 1, y, b.w + 2, b.cornice);
  for (let bx = b.x + 2; bx < b.x + b.w - 2; bx += 5) {
    ctx.fillStyle = brick;
    ctx.fillRect(bx, y + 2 + ((bx + b.seed) % 2), 2, 1);
  }

  drawUpperFloorWindows(ctx, b, y, localWarm, restored, body);
  if (b.escape) {
    ctx.fillStyle = mix('#161b25', '#746756', restored * 0.26);
    for (let fy = y + 8; fy < b.baseY - b.groundH - 4; fy += 8) ctx.fillRect(b.x - 1, fy, 4, 1);
    ctx.fillRect(b.x + 1, y + 7, 1, Math.max(1, b.h - b.groundH - 10));
  }
  if (b.pipe) {
    ctx.fillStyle = mix('#131826', '#796e63', restored * 0.22);
    ctx.fillRect(b.x + b.w - 3, y + 4, 1, b.h - 8);
    ctx.fillRect(b.x + b.w - 4, y + 7, 3, 1);
  }

  drawStorefront(ctx, b, y, localWarm, restored);
  drawRoofDetail(ctx, b, y, restored);
}

function drawFarTower(ctx, b, wp, fogT) {
  const y = b.baseY - b.h;
  const localWarm = Math.max(wp.restoration * 0.7, stationWarmAt(b.x + b.w / 2, wp.warmth, b.sceneW) * 0.2);
  const base = b.layer === 0 ? FAR_BASES[b.tone % FAR_BASES.length] : MID_BASES[b.tone % MID_BASES.length];
  const warm = b.layer === 0 ? '#7d7265' : '#897b67';
  const body = mix(base, warm, wp.restoration * 0.46);
  const mid = mix(body, '#8a7ab0', fogT * (b.layer === 0 ? 1.0 : 0.7));
  ctx.fillStyle = mid;
  ctx.fillRect(b.x, y, b.w, b.h);
  ctx.fillStyle = mix(mid, '#b8cce0', 0.1);
  ctx.fillRect(b.x, y, 1, b.h);
  ctx.fillStyle = mix(mid, '#12102a', 0.34);
  ctx.fillRect(b.x + b.w - 1, y, 1, b.h);
  ctx.fillStyle = mix('#151726', '#5e554b', wp.restoration * 0.22);
  ctx.fillRect(b.x - 1, y, b.w + 2, 1);
  drawTowerWindows(ctx, b, y, fogT, localWarm, 0.04 + wp.night * 0.05 + wp.restoration * 0.08, mid);
  if (hash2(b.seed, 88) > 0.8) {
    ctx.fillStyle = mix('#1a1d2b', '#7e7265', wp.restoration * 0.18);
    ctx.fillRect(b.x + 2, y - 5, 1, 5);
    ctx.fillRect(b.x + 1, y - 4, 3, 1);
  }
}

function drawBusStop(ctx, W, groundTop, restored) {
  const x = sceneX(W, 0.67);
  const y = groundTop + 2;
  ctx.fillStyle = mix('#161a25', '#7f745f', restored * 0.28);
  ctx.fillRect(x, y - 18, 1, 19);
  ctx.fillRect(x + 14, y - 18, 1, 19);
  ctx.fillRect(x, y - 18, 15, 2);
  ctx.fillRect(x + 2, y - 16, 12, 1);
  ctx.fillStyle = mix('#24374e', '#c29a73', restored * 0.22);
  ctx.fillRect(x + 1, y - 15, 5, 11);
  ctx.fillStyle = mix('#b7c9dc', '#f7c595', restored * 0.18);
  ctx.fillRect(x + 2, y - 14, 3, 9);
  ctx.fillStyle = mix('#4f4051', '#d6b38d', restored * 0.24);
  ctx.fillRect(x + 7, y - 15, 6, 11);
  ctx.fillStyle = mix('#7aa0c3', '#efc28e', restored * 0.12);
  ctx.fillRect(x + 8, y - 14, 4, 1);
}

function drawStreetFurniture(ctx, W, groundTop, restored) {
  const leftPlanterX = sceneX(W, 0.05);
  const rightPlanterX = sceneX(W, 0.9);
  ctx.fillStyle = mix('#6d5847', '#a4795b', restored * 0.42);
  ctx.fillRect(leftPlanterX, groundTop + 6, 7, 4);
  ctx.fillRect(rightPlanterX, groundTop + 5, 8, 4);
  ctx.fillStyle = mix('#365847', '#5ea16f', restored * 0.55);
  ctx.fillRect(leftPlanterX + 1, groundTop + 2, 5, 4);
  ctx.fillRect(rightPlanterX + 1, groundTop + 1, 6, 4);

  const boxX = sceneX(W, 0.02);
  ctx.fillStyle = mix('#4a6055', '#a7825c', restored * 0.24);
  ctx.fillRect(boxX, groundTop + 12, 4, 7);
  ctx.fillStyle = mix('#d6c48c', '#e9d7a7', restored * 0.24);
  ctx.fillRect(boxX + 1, groundTop + 13, 2, 1);
  ctx.fillRect(boxX + 1, groundTop + 15, 2, 1);
  ctx.fillStyle = mix('#424a56', '#8d8b83', restored * 0.25);
  ctx.fillRect(boxX + 6, groundTop + 12, 4, 6);
  ctx.fillRect(boxX + 7, groundTop + 11, 2, 1);

  const benchX = sceneX(W, 0.83);
  ctx.fillStyle = mix('#5e4a3d', '#9f7d5b', restored * 0.3);
  ctx.fillRect(benchX, groundTop + 11, 9, 2);
  ctx.fillRect(benchX, groundTop + 14, 9, 1);
  ctx.fillRect(benchX + 1, groundTop + 13, 1, 4);
  ctx.fillRect(benchX + 7, groundTop + 13, 1, 4);

  const hydrantX = sceneX(W, 0.73);
  ctx.fillStyle = mix('#6c3b42', '#c96b59', restored * 0.34);
  ctx.fillRect(hydrantX, groundTop + 15, 3, 5);
  ctx.fillRect(hydrantX - 1, groundTop + 17, 5, 1);
  ctx.fillRect(hydrantX + 1, groundTop + 14, 1, 1);

}

function drawPuddlesStatic(ctx, W, groundTop, H, wp) {
  const puddles = [
    { x: 0.12, y: 25, w: 0.08, h: 3 },
    { x: 0.33, y: 36, w: 0.07, h: 3 },
    { x: 0.58, y: 31, w: 0.1, h: 4 },
    { x: 0.81, y: 20, w: 0.07, h: 3 },
  ];
  for (const p of puddles) {
    const px = sceneX(W, p.x);
    const py = groundTop + p.y;
    const pw = sceneSpan(W, p.w, 7);
    const warm = Math.max(wp.restoration * 0.75, stationWarmAt(px + pw / 2, wp.warmth, W));
    ctx.fillStyle = mix('#1a2233', '#68625d', wp.restoration * 0.18);
    ctx.fillRect(px, py, pw, p.h);
    ctx.fillStyle = mix('#2a4560', '#cf9a69', warm * 0.42);
    ctx.fillRect(px + Math.floor(pw * 0.4), py, 1, p.h);
    ctx.fillStyle = mix('#93aec7', '#efc391', warm * 0.48);
    ctx.fillRect(px + Math.floor(pw * 0.46), py + 1, 1, Math.max(1, p.h - 1));
    ctx.fillStyle = 'rgba(180,210,235,0.12)';
    ctx.fillRect(px + 1, py, Math.max(2, pw - 3), 1);
  }
  void H;
}

export function createSceneryBuildings(W) {
  const near = [];
  let x = -4;
  let i = 0;
  while (x < W + 6) {
    const w = 14 + Math.floor(hash2(i, 1) * 13);
    const groundH = 14 + Math.floor(hash2(i, 2) * 6);
    const upperH = 13 + Math.floor(hash2(i, 3) * 13);
    near.push({
      x,
      w,
      h: groundH + upperH,
      groundH,
      upperCols: Math.max(2, Math.floor((w - 6) / 7)),
      seed: i,
      tone: Math.floor(hash2(i, 4) * NEAR_BASES.length),
      accent: 0,
      shopType: SHOP_TYPES[(i + Math.floor(hash2(0, 6) * SHOP_TYPES.length)) % SHOP_TYPES.length],
      closed: hash2(i, 7) > 0.82,
      doorSide: hash2(i, 8) > 0.5 ? 'left' : 'right',
      roofKind: Math.floor(hash2(i, 9) * 5),
      cornice: 1 + Math.floor(hash2(i, 10) * 2),
      escape: hash2(i, 11) > 0.74,
      pipe: hash2(i, 12) > 0.64,
      baseY: 0,
    });
    x += w - 1;
    i++;
  }

  const mid = [];
  x = -3;
  i = 0;
  while (x < W + 8) {
    const w = 8 + Math.floor(hash2(i, 21) * 12);
    mid.push({
      x,
      w,
      h: 30 + Math.floor(hash2(i, 22) * 24),
      seed: 200 + i,
      tone: Math.floor(hash2(i, 23) * MID_BASES.length),
      layer: 1,
      baseY: 0,
    });
    x += Math.max(5, w - 2);
    i++;
  }

  const far = [];
  x = -4;
  i = 0;
  while (x < W + 10) {
    const w = 9 + Math.floor(hash2(i, 31) * 10);
    far.push({
      x,
      w,
      h: 45 + Math.floor(hash2(i, 32) * 28),
      seed: 400 + i,
      tone: Math.floor(hash2(i, 33) * FAR_BASES.length),
      layer: 0,
      baseY: 0,
      sceneW: W,
    });
    x += Math.max(6, w - 1);
    i++;
  }

  return { near, mid, far, length: near.length + mid.length + far.length };
}

function drawSkyStatic(ctx, W, H, groundTop, wp) {
  const night = wp.night;
  const R = wp.restoration;
  const stops = [0, Math.round(groundTop * 0.12), Math.round(groundTop * 0.28), Math.round(groundTop * 0.48), Math.round(groundTop * 0.68), Math.round(groundTop * 0.84), groundTop];
  const base = [
    mix('#120f34', '#82a7cf', R),
    mix('#1c1648', '#8eb3da', R),
    mix('#2e2160', '#7a97bf', R),
    mix('#4a2f78', '#6883a8', R),
    mix('#7a4a88', '#d9cdb8', R),
    mix('#c0687a', '#efc797', R),
  ].map((c, i) => mix(c, '#090916', night * (0.75 - i * 0.08)));
  fillVerticalBands(ctx, W, stops, base);
  const glow = mix('#e0905c', '#f5dfae', R);
  ctx.fillStyle = glow;
  ctx.fillRect(0, groundTop - 9, W, 9);
  ctx.fillStyle = mix('#e0b090', '#fff1c4', R * 0.6);
  ctx.fillRect(0, groundTop - 3, W, 1);
  ditherRect(ctx, 0, groundTop - 12, W, 5, mix(glow, base[4], 0.52), 1);

  for (let i = 0; i < 3; i++) {
    const x = Math.round(((i * 52) + 8) % (W + 10) - 14);
    const y = 8 + i * 11;
    const tone = i;
    const cloudBase = mix(['#4d5773', '#616a81', '#788290'][tone], '#ede5dc', R * 0.5);
    const palette = {
      shadow: mix(cloudBase, '#151735', night * 0.45),
      mid: mix(mix(cloudBase, '#b9c7d2', 0.16), '#1b2040', night * 0.35),
      light: mix(mix(cloudBase, '#dbe5ec', 0.32), '#23284a', night * 0.28),
      under: mix('#88718c', '#e6c5a0', R * 0.26),
    };
    drawCloud(ctx, x, y, palette, i);
  }
  void H;
}

function drawSkylineStatic(ctx, W, groundTop, wp, buildings) {
  for (const b of buildings.far) {
    b.baseY = groundTop;
    drawFarTower(ctx, b, wp, 0.58);
  }
  for (const b of buildings.mid) {
    b.baseY = groundTop;
    drawFarTower(ctx, b, wp, 0.34);
  }
  for (const b of buildings.near) {
    b.baseY = groundTop;
    drawNearBuilding(ctx, b, groundTop, wp, W);
  }
  ctx.fillStyle = mix('#1a2435', '#746a5f', wp.restoration * 0.18);
  ctx.fillRect(sceneX(W, 0.06), groundTop + 6, sceneSpan(W, 0.88, 96), 1);
  for (let x = sceneX(W, 0.1); x < sceneX(W, 0.92); x += sceneSpan(W, 0.3, 30)) ctx.fillRect(x, groundTop + 4, 1, 4);
  ctx.fillStyle = mix('#253345', '#496b4e', wp.restoration * 0.3);
  ctx.fillRect(sceneX(W, 0.96), groundTop - 30, sceneSpan(W, 0.05, 6), 24);
  ctx.fillRect(sceneX(W, 0.94), groundTop - 38, sceneSpan(W, 0.1, 12), 10);
  ctx.fillRect(sceneX(W, 0.92), groundTop - 33, sceneSpan(W, 0.09, 11), 8);
}

function drawGroundStatic(ctx, W, H, groundTop, feetY, wp, buildings) {
  const R = wp.restoration;
  const curbY = groundTop + 11;
  const gutterY = curbY + 2;
  const roadTop = gutterY + 1;
  ctx.fillStyle = mix('#5a6482', '#d1c6b2', R);
  ctx.fillRect(0, groundTop, W, curbY - groundTop);
  ctx.fillStyle = mix('#8a98b8', '#f1dec1', R);
  ctx.fillRect(0, curbY - 1, W, 1);
  ctx.fillStyle = mix('#a9b7d2', '#fff0d0', R * 0.45);
  ctx.fillRect(0, curbY - 2, W, 1);
  ctx.fillStyle = mix('#222a46', '#8f8677', R);
  ctx.fillRect(0, curbY, W, 2);
  ctx.fillStyle = mix('#323948', '#a39782', R);
  ctx.fillRect(0, gutterY, W, 1);

  for (let row = 0, y = groundTop + 5; y < curbY - 1; row++, y += 5) {
    ctx.fillStyle = mix('#4e5a78', '#d9cbb1', R * 0.72);
    ctx.fillRect(0, y, W, 1);
    const start = row % 2 ? 9 : 0;
    ctx.fillStyle = mix('#515d7c', '#c1b298', R * 0.55);
    for (let x = start; x < W; x += 18) ctx.fillRect(x, y - 4, 1, 4);
  }

  ctx.fillStyle = mix('#2a3052', '#8f8779', R);
  ctx.fillRect(0, roadTop, W, H - roadTop);
  ctx.fillStyle = mix('#313860', '#948a79', R * 0.55);
  ctx.fillRect(0, roadTop + 2, W, 10);
  ctx.fillStyle = mix('#353d62', '#9d9280', R * 0.45);
  ctx.fillRect(0, feetY - 24, W, 7);
  ctx.fillStyle = mix('#242c3a', '#786f63', R * 0.38);
  ctx.fillRect(0, feetY + 10, W, H - feetY - 10);

  ctx.fillStyle = mix('#3c4657', '#8f8473', R * 0.22);
  ctx.fillRect(0, roadTop + 18, W, 1);
  ctx.fillRect(0, feetY - 6, W, 1);

  const laneY = Math.round((roadTop + feetY) / 2);
  const dashW = sceneSpan(W, 0.12, 12);
  const gap = sceneSpan(W, 0.09, 9);
  ctx.fillStyle = mix('#8c7e58', '#d9c490', R * 0.4);
  for (let x = sceneX(W, 0.08); x < W - dashW; x += dashW + gap) ctx.fillRect(x, laneY, dashW, 1);

  const sheenYs = [roadTop + 7, laneY + 5, feetY - 18];
  ctx.fillStyle = 'rgba(150,176,205,0.07)';
  for (const y of sheenYs) ctx.fillRect(0, y, W, 4);

  const reflectionXs = [0.04, 0.65, 0.93];
  for (const rx of reflectionXs) {
    const x = sceneX(W, rx);
    const warm = Math.max(wp.restoration * 0.74, stationWarmAt(x, wp.warmth, W));
    const color = warm > 0.2 ? '255,198,120' : '170,200,228';
    ctx.fillStyle = `rgba(${color},${0.025 + warm * 0.03})`;
    ctx.fillRect(x, roadTop + 8, 1, 6);
    ctx.fillRect(x, laneY + 5, 1, 5);
  }

  drawStreetFurniture(ctx, W, groundTop, R);
  drawPuddlesStatic(ctx, W, groundTop, H, wp);

  if (R > 0.45) {
    ctx.globalAlpha = Math.min(1, (R - 0.45) / 0.4);
    ctx.fillStyle = '#d88368';
    for (let x = sceneX(W, 0.18); x < sceneX(W, 0.88); x += sceneSpan(W, 0.12, 14)) ctx.fillRect(x, groundTop + 4, 2, 2);
    ctx.fillStyle = '#f2da7a';
    for (let x = sceneX(W, 0.24); x < sceneX(W, 0.86); x += sceneSpan(W, 0.17, 18)) ctx.fillRect(x, groundTop + 5, 2, 2);
    ctx.fillStyle = '#c96759';
    for (let x = sceneX(W, 0.42); x < sceneX(W, 0.76); x += sceneSpan(W, 0.08, 9)) ctx.fillRect(x, groundTop - 2, 2, 1);
    ctx.globalAlpha = 1;
  }
}

export function buildSceneryLayers({ W, H, groundTop, feetY, wp, buildings }) {
  const sky = makePixelCanvas(W, H);
  const skyline = makePixelCanvas(W, H);
  const ground = makePixelCanvas(W, H);
  if (!sky || !skyline || !ground) return null;

  const skyCtx = sky.getContext('2d');
  const skylineCtx = skyline.getContext('2d');
  const groundCtx = ground.getContext('2d');
  skyCtx.imageSmoothingEnabled = false;
  skylineCtx.imageSmoothingEnabled = false;
  groundCtx.imageSmoothingEnabled = false;

  drawSkyStatic(skyCtx, W, H, groundTop, wp);
  drawSkylineStatic(skylineCtx, W, groundTop, wp, buildings);
  drawGroundStatic(groundCtx, W, H, groundTop, feetY, wp, buildings);
  return { sky, skyline, ground };
}
