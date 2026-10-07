// The people in focus (the protagonist, the Professor and the five conversation characters) are painted here as 32-pixel figures:
// smooth, shaded shapes (rounded head, jaw, torso, capsule limbs) lit from the upper left with a four-step ramp, then given a 1px
// selective outline. They share the crowd's pixel grid; the extra size buys faces, hands, clothing and props.
// Everything faces right and is mirrored for left.

const W = 34;
const H = 44;
const OX = 17;
const OY = 40; // the row the feet stand on

const SPECS = {
  protagonist: { hair: 'messy', beard: 'full', top: 'hoodie', arms: 'hold', props: ['backpack', 'bible'], mood: 'warm', boots: '#5a4030' },
  skeptic: { hair: 'short', beard: 'stubble', top: 'hoodie', arms: 'crossed', props: ['headphones'], mood: 'smirk', glasses: true, boots: '#2a2a32' },
  nominal: { hair: 'long', beard: 'none', top: 'cardigan', arms: 'cup', props: ['cup', 'crossbody', 'cross'], mood: 'warm', boots: '#6a4a38' },
  broken: { hair: 'beanie', beard: 'full', top: 'plaid', arms: 'pockets', props: [], mood: 'sad', hunch: 1, boots: '#3a2a22' },
  worker: { hair: 'messy', beard: 'none', top: 'shirttie', arms: 'brief', props: ['briefcase', 'lanyard', 'cup'], mood: 'tired', boots: '#2a2430' },
  visitor: { hair: 'sidepart', beard: 'none', top: 'whiteshirt', arms: 'brochure', props: ['tote', 'nametag'], mood: 'grin', boots: '#25232c' },
  professor: { hair: 'grey', beard: 'none', top: 'tweed', arms: 'book', props: ['book', 'bowtie'], mood: 'stern', glasses: true, boots: '#3a2c26' },
};

export function heroKind(look) {
  const v = look?.variant || '';
  const k = look?.kit || '';
  if (v.startsWith('protagonist')) return 'protagonist';
  if (v === 'professor' || k === 'professor') return 'professor';
  if (SPECS[k]) return k;
  if (SPECS[v]) return v;
  return null;
}

export function buildHero(look, o, h) {
  const kind = heroKind(look);
  const spec = SPECS[kind];
  const dir = o.dir || 1;
  const pose = o.pose || 'idle';
  const frame = o.frame || 0;
  const dim = Math.round(Math.min(1, Math.max(0, o.dim || 0)) * 8) / 8;
  const fog = o.fog || '#3a4252';
  const bobPx = Math.round(o.bob || 0);
  const tint = (c) => (dim > 0 ? h.mix(c, fog, dim) : c);
  const R = (base) => {
    const r = h.ramp(base);
    return { hi: tint(r.hi), base: tint(r.base), lo: tint(r.lo), dk: tint(r.dk) };
  };
  const cv = h.makeCanvas(W, H);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const walk = pose === 'walk';
  const bob = (walk && (frame === 1 || frame === 3) ? 1 : 0) + bobPx;
  const hunch = spec.hunch || 0;

  const skin = R(look.skin || '#d8a177');
  const hairBase = look.age === 'old' ? '#c8ccd4' : look.hair || '#3a2a1e';
  const hair = R(hairBase);
  const topCol = R(look.top || '#6d747c');
  const pants = R(look.bottom || '#34536f');
  const boots = R(spec.boots || '#2a2430');
  const inkEye = tint('#1a1218');
  const white = tint('#f4f0ee');

  let lift = 3; // the upper body stands this much higher than it was laid out: longer legs, more natural proportions
  const set = (x, y, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(OX + Math.round(x), OY + Math.round(y) - bob - lift, 1, 1);
  };
  const rect = (x, y, w, hh, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(OX + Math.round(x), OY + Math.round(y) - bob - lift, Math.max(1, Math.round(w)), Math.max(1, Math.round(hh)));
  };
  const tone = (cols, L) => (L > 0.42 ? cols.hi : L < -0.66 ? cols.dk : L < -0.2 ? cols.lo : cols.base);
  // faces stay light: a lit forehead and cheek, and only the underside of the jaw and the far edge fall into shadow
  const faceTone = (cols, L) => (L > 0.3 ? cols.hi : L < -0.8 ? cols.lo : cols.base);
  const hairTone = (cols, L) => (L > 0.7 ? cols.hi : L < -0.5 ? cols.dk : L < -0.1 ? cols.lo : cols.base);
  const ell = (cx, cy, rx, ry, cols, test, toneFn) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        if (test && !test(x, y, nx, ny)) continue;
        set(x, y, (toneFn || tone)(cols, -(nx * 0.62 + ny * 0.78)));
      }
    }
  };
  const limb = (pts, r, cols) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let k = 0; k <= n; k++) {
        const cx = x0 + ((x1 - x0) * k) / n;
        const cy = y0 + ((y1 - y0) * k) / n;
        ell(cx, cy, r, r, cols);
      }
    }
  };
  // a torso: rows from y0 to y1, narrowing from wTop to wBot around cx, shoulders rounded
  const torso = (cx, y0, y1, wTop, wBot, cols) => {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      let w = wTop + (wBot - wTop) * t;
      if (y === y0) w -= 2;
      const xl = cx - w / 2;
      for (let x = Math.round(xl); x < Math.round(xl + w); x++) {
        const nx = (x + 0.5 - cx) / (w / 2);
        const ny = t * 1.2 - 0.6;
        set(x, y, tone(cols, -(nx * 0.62 + ny * 0.78)));
      }
    }
  };

  // ---- stance --------------------------------------------------------------------------------------------------------------
  const cx = 0;
  const hipY = -10.5;
  const shoulderY = -19.5 + hunch * 0.6;
  const hx = 0.8 + hunch * 2;
  const hy = -26.4 + hunch * 1.2;
  let farFoot = [-1.5, 0];
  let nearFoot = [2, 0];
  let farKnee = [-1.5, -6.4];
  let nearKnee = [2, -6.4];
  if (walk) {
    const sw = [3.4, 0.6, -3.4, -0.6][frame % 4];
    nearFoot = [2 + sw, 0];
    farFoot = [-1.5 - sw, 0];
    nearKnee = [2 + sw * 0.5, -6.4];
    farKnee = [-1.5 - sw * 0.5, -6.4];
    if (frame === 1) farFoot = [-1.5 - sw, -1.6];
    if (frame === 3) nearFoot = [2 + sw, -1.6];
  }

  // ---- things behind the body ---------------------------------------------------------------------------------------------------
  if (spec.props.includes('backpack')) {
    const pk = R(look.bagColor || '#4a5a52');
    rect(-9, -20 + hunch, 6, 11, pk.base);
    rect(-9, -20 + hunch, 6, 1, pk.hi);
    rect(-9, -20 + hunch, 1, 11, pk.hi);
    rect(-4, -19 + hunch, 1, 10, pk.lo);
    rect(-8, -13, 4, 3, pk.lo);
    rect(-8, -13, 4, 1, pk.dk);
    rect(-7, -22 + hunch, 3, 2, pk.base);
  }
  if (spec.hair === 'long') {
    limb([[hx - 3.8, hy - 1], [hx - 4.4, hy + 8]], 2.4, hair);
  }
  // far arm (hangs behind the torso)
  limb([[cx - 4.5, shoulderY + 1.5], [cx - 5.5, shoulderY + 6.5], [cx - 5, shoulderY + 10]], 1.7, R(spec.top === 'whiteshirt' ? '#d8d6d0' : spec.top === 'shirttie' ? '#c4ccd2' : look.top));

  // ---- legs (drawn on the ground line, not lifted) -----------------------------------------------------------------------------
  lift = 0;
  const legCols = (c) => c;
  limb([[cx - 1.5, hipY - 2.5], farKnee, farFoot], 2.2, legCols({ ...pants, base: pants.lo, hi: pants.base, lo: pants.dk }));
  ell(farFoot[0] + 1.2, farFoot[1] - 1.2, 2.6, 1.6, { ...boots, base: boots.lo, hi: boots.base });
  limb([[cx + 1.8, hipY - 2.5], nearKnee, nearFoot], 2.4, pants);
  ell(nearFoot[0] + 1.6, nearFoot[1] - 1.4, 3, 1.9, boots);
  rect(nearFoot[0] - 0.5, nearFoot[1] - 3, 3, 1, boots.dk);

  lift = 3;
  // ---- torso ---------------------------------------------------------------------------------------------------------------
  const bodyTop = shoulderY;
  torso(cx, Math.round(bodyTop), -10, 10.5, 9.5, topCol);
  const style = spec.top;
  if (style === 'hoodie') {
    // bunched hood behind the neck, drawstrings, a front pocket
    ell(hx - 3, bodyTop - 0.5, 4.6, 2.6, topCol, (x, y) => y >= bodyTop - 2);
    rect(cx + 0.5, bodyTop + 1, 1, 4, topCol.hi);
    rect(cx + 2.5, bodyTop + 1, 1, 4, topCol.hi);
    rect(cx - 3, -14.5, 7, 3, topCol.lo);
    rect(cx - 3, -14.5, 7, 1, topCol.dk);
  } else if (style === 'cardigan') {
    const inner = R('#efe4d0');
    rect(cx + 0.5, bodyTop, 4, 9, inner.base);
    rect(cx + 0.5, bodyTop, 1, 9, inner.hi);
    rect(cx + 4, bodyTop, 1, 9, inner.lo);
    for (let k = 0; k < 3; k++) set(cx - 0.5, bodyTop + 2 + k * 3, topCol.dk);
  } else if (style === 'plaid') {
    const stripe = R('#d0a060');
    for (let y = Math.round(bodyTop); y < -10; y += 3) rect(cx - 5, y, 11, 1, topCol.lo);
    for (let x = cx - 4; x < cx + 6; x += 3) rect(x, bodyTop + 1, 1, 9, stripe.lo);
    rect(cx - 5, bodyTop + 1, 11, 1, topCol.hi);
    rect(cx + 1, bodyTop, 2, 4, topCol.dk);
  } else if (style === 'shirttie') {
    const shirt = R('#d0d8dc');
    rect(cx - 5, bodyTop, 11, 9.5, shirt.base);
    rect(cx - 5, bodyTop, 1, 9, shirt.hi);
    rect(cx + 5, bodyTop, 1, 9, shirt.lo);
    rect(cx + 0.5, bodyTop - 0.5, 3, 2, shirt.hi);
    rect(cx + 1, bodyTop + 2, 2, 7, topCol.base);
    rect(cx + 1, bodyTop + 2, 1, 7, topCol.hi);
    rect(cx + 0.5, bodyTop + 1, 3, 2, topCol.dk);
    set(cx - 4, bodyTop + 5, shirt.lo);
    set(cx - 2, bodyTop + 7, shirt.lo);
  } else if (style === 'whiteshirt') {
    const shirt = R('#f4f2ec');
    rect(cx - 5, bodyTop, 11, 9.5, shirt.base);
    rect(cx - 5, bodyTop, 1, 9, shirt.hi);
    rect(cx + 5, bodyTop, 1, 9, shirt.lo);
    rect(cx + 1, bodyTop - 0.5, 3, 2, shirt.hi);
    rect(cx + 1.5, bodyTop + 1, 2, 8, tint('#242632'));
    rect(cx + 1.5, bodyTop + 1, 1, 8, tint('#3a3f50'));
  } else if (style === 'tweed') {
    for (let y = Math.round(bodyTop) + 1; y < -10; y += 2) for (let x = cx - 5 + (y % 4 ? 1 : 0); x < cx + 6; x += 2) set(x, y, topCol.lo);
    const shirt = R('#f0ece4');
    rect(cx + 0.5, bodyTop, 3, 5, shirt.base);
    rect(cx - 0.5, bodyTop, 1, 6, topCol.dk);
    rect(cx + 3.5, bodyTop, 1, 6, topCol.dk);
  }

  // ---- near arm and what it holds ------------------------------------------------------------------------------------------
  const sleeveCols = style === 'shirttie' ? R('#c4ccd2') : style === 'whiteshirt' ? R('#e8e6e0') : topCol;
  const sx = cx + 1;
  const sy = shoulderY + 1.5;
  const swing = walk ? [2, 0, -2, 0][frame % 4] : 0;
  const arms = spec.arms;
  let handX = sx + 1;
  let handY = sy + 9;
  if (pose === 'proclaim' || pose === 'point') {
    limb([[sx, sy], [sx + 3, sy + 2], [sx + 8, sy - 0.5]], 1.9, sleeveCols);
    handX = sx + 9;
    handY = sy - 0.5;
    ell(handX, handY, 1.4, 1.2, skin);
    set(handX + 1.5, handY - 0.5, skin.hi);
  } else if (pose === 'talk' || pose === 'react') {
    const k = Math.sin((o.frame || 0) * 1.7) > 0 ? 0 : 2;
    limb([[sx, sy], [sx + 2.5, sy + 5], [sx + 7, sy + 2 - k]], 1.9, sleeveCols);
    handX = sx + 7.5;
    handY = sy + 2 - k;
    ell(handX, handY, 1.5, 1.4, skin);
  } else if (arms === 'crossed') {
    limb([[sx - 1, sy], [sx - 2.5, sy + 4.5], [sx + 4.5, sy + 4]], 1.9, sleeveCols);
    limb([[sx - 2.5, sy + 4.5], [sx + 5, sy + 4.4]], 1.7, sleeveCols);
    ell(sx + 5.5, sy + 3.2, 1.3, 1.2, skin);
  } else if (arms === 'pockets') {
    limb([[sx, sy], [sx + 0.5, sy + 5], [sx + 1.2, sy + 8.5]], 1.9, sleeveCols);
    rect(cx - 2, -13.5, 6, 1, topCol.dk);
  } else if (arms === 'hold' || arms === 'cup' || arms === 'brochure' || arms === 'book') {
    limb([[sx, sy], [sx - 0.8, sy + 5.5], [sx + 4, sy + 6]], 1.9, sleeveCols);
    handX = sx + 5;
    handY = sy + 5.6;
    ell(handX, handY, 1.5, 1.4, skin);
  } else if (arms === 'brief') {
    const sway = swing * 0.4;
    limb([[sx, sy], [sx + 0.5 + sway, sy + 5], [sx + 1.2 + sway, sy + 9]], 1.9, sleeveCols);
    handX = sx + 1.5 + sway;
    handY = sy + 9.5;
    ell(handX, handY, 1.4, 1.3, skin);
  } else {
    limb([[sx, sy], [sx + 0.6 + swing * 0.5, sy + 5], [sx + 1 + swing, sy + 9]], 1.9, sleeveCols);
    ell(sx + 1 + swing, sy + 9.5, 1.4, 1.3, skin);
  }

  // held things
  if (spec.props.includes('bible') && (pose === 'idle' || pose === 'hold' || pose === 'walk' || pose === 'talk' || pose === 'react')) {
    const cover = R('#7a4c24');
    const bx = pose === 'talk' || pose === 'react' ? sx + 3 : handX - 2;
    const by = pose === 'talk' || pose === 'react' ? handY - 6 : handY - 8;
    rect(bx, by, 7, 9, cover.base);
    rect(bx, by, 7, 1, cover.hi);
    rect(bx, by, 1, 9, cover.hi);
    rect(bx + 6, by, 1, 9, cover.dk);
    rect(bx + 1, by + 8, 5, 1, tint('#e8d29a'));
    rect(bx + 3, by + 2, 1, 4, tint('#e8c860'));
    rect(bx + 2, by + 3, 3, 1, tint('#e8c860'));
    ell(handX + 0.5, handY, 1.6, 1.4, skin);
  }
  if (spec.props.includes('book')) {
    const cover = R('#5a3a2a');
    rect(handX - 2, handY - 7, 6, 8, cover.base);
    rect(handX - 2, handY - 7, 6, 1, cover.hi);
    rect(handX + 3, handY - 7, 1, 8, cover.dk);
    rect(handX - 1, handY, 4, 1, tint('#e8e0c8'));
    ell(handX + 0.5, handY, 1.6, 1.4, skin);
  }
  if (spec.props.includes('cup')) {
    const cx2 = handX - 1;
    rect(cx2, handY - 6, 4, 5, tint('#f6f4f0'));
    rect(cx2, handY - 6, 1, 5, tint('#ffffff'));
    rect(cx2 + 3, handY - 6, 1, 5, tint('#c8c6c2'));
    rect(cx2, handY - 4, 4, 2, tint('#b8825a'));
    rect(cx2 - 0.5, handY - 7, 5, 1, tint('#3a3a44'));
    ell(handX + 0.5, handY, 1.6, 1.4, skin);
  }
  if (spec.props.includes('briefcase')) {
    const bc = R('#6a4a34');
    rect(handX - 3, handY + 1, 8, 6, bc.base);
    rect(handX - 3, handY + 1, 8, 1, bc.hi);
    rect(handX - 3, handY + 6, 8, 1, bc.dk);
    rect(handX - 1, handY - 1, 4, 1, bc.dk);
    rect(handX, handY + 3, 2, 1, tint('#d6b45a'));
    ell(handX, handY, 1.4, 1.3, skin);
  }
  if (arms === 'brochure') {
    const br = R('#9fd0e8');
    rect(handX - 1, handY - 7, 5, 7, br.base);
    rect(handX - 1, handY - 7, 1, 7, br.hi);
    rect(handX + 3, handY - 7, 1, 7, br.lo);
    rect(handX, handY - 5, 3, 1, tint('#5a9ac0'));
    rect(handX, handY - 3, 3, 1, tint('#5a9ac0'));
    set(handX + 3, handY - 7, tint('#ffffff'));
  }
  if (spec.props.includes('tote')) {
    const tb = R('#e8dcc0');
    rect(cx - 8, -17, 6, 7, tb.base);
    rect(cx - 8, -17, 6, 1, tb.hi);
    rect(cx - 3, -17, 1, 7, tb.lo);
    rect(cx - 7, -19, 1, 2, tb.lo);
    rect(cx - 4, -19, 1, 2, tb.lo);
    set(cx - 7, -18, tint('#d85a5a'));
    set(cx - 5, -18, tint('#5a8ad8'));
    set(cx - 6, -19, tint('#e8c850'));
  }
  if (spec.props.includes('crossbody')) {
    const sb = R('#7a5a3c');
    for (let k = 0; k < 8; k++) set(cx - 4 + k, bodyTop + 1 + k, sb.base);
    rect(cx - 6, -13, 5, 4, sb.base);
    rect(cx - 6, -13, 5, 1, sb.hi);
  }
  if (spec.props.includes('lanyard')) {
    for (let k = 0; k < 4; k++) set(cx + 3 - k * 0.5, bodyTop + 0.5 + k, tint('#4a8ad8'));
    rect(cx + 1, bodyTop + 4, 3, 3, tint('#f6f6f0'));
    set(cx + 2, bodyTop + 5, tint('#4a8ad8'));
  }
  if (spec.props.includes('nametag')) {
    rect(cx - 3, bodyTop + 3, 3, 2, tint('#ffffff'));
    set(cx - 2, bodyTop + 3, tint('#d84a4a'));
  }
  if (spec.props.includes('cross')) {
    set(cx + 3, bodyTop + 3, tint('#f0c860'));
    set(cx + 3, bodyTop + 4, tint('#f0c860'));
    set(cx + 2, bodyTop + 3.5, tint('#f0c860'));
    set(cx + 4, bodyTop + 3.5, tint('#f0c860'));
  }

  // ---- neck and head -------------------------------------------------------------------------------------------------------
  rect(hx - 1.5, hy + 4.5, 4, 3.5 - hunch, skin.lo);
  rect(hx - 1.5, hy + 4.5, 4, 1, skin.dk);
  const headRx = 5;
  const headRy = 4.9;
  const hood = style === 'hoodie';
  // skull and jaw: an egg that narrows toward the chin
  ell(hx, hy, headRx, headRy, skin, (x, y) => !(y > hy + 2.6 && Math.abs(x + 0.5 - (hx + 0.2)) > headRx - (y - hy - 2.6) * 1.8), faceTone);
  // ear
  ell(hx - 3.4, hy + 0.8, 1.2, 1.6, { ...skin, base: skin.lo, hi: skin.base });
  // hair
  const cap = (x, y) => y < hy - 2.3 + Math.max(0, (hx - x) * 0.4) || x < hx - 3 + (y < hy ? 0 : -0.6);
  const hairMask = (x, y) => cap(x, y) && !(x > hx + 3.2 && y > hy - 3);
  if (spec.hair === 'beanie') {
    const wool = R('#566478');
    const cuff = R('#74849c');
    ell(hx - 0.3, hy - 2.4, headRx + 0.9, headRy - 0.4, wool, (x, y) => y < hy - 2.9 + (x < hx - 1 ? 1.2 : 0));
    rect(hx - 5.2, hy - 4.1, 10.6, 2, cuff.base);
    rect(hx - 5.2, hy - 4.1, 10.6, 1, cuff.hi);
    for (let k = 0; k < 5; k++) set(hx - 4 + k * 2, hy - 3, cuff.lo);
    for (let k = 0; k < 4; k++) rect(hx - 3 + k * 2.2, hy - 8, 1, 3, wool.lo);
    set(hx - 0.5, hy - 9.5, wool.base);
    set(hx + 0.5, hy - 9.5, wool.hi);
  } else if (spec.hair !== 'bald') {
    ell(hx, hy, headRx + 0.3, headRy + 0.3, hair, hairMask, hairTone);
    if (spec.hair === 'messy' || spec.hair === 'short' || spec.hair === 'sidepart' || spec.hair === 'grey') {
      for (const [dx, dy] of spec.hair === 'messy' ? [[-1, -6.4], [1, -6.8], [3, -6], [-3, -5.6]] : [[0, -6.2]]) set(hx + dx, hy + dy, hair.base);
    }
    if (spec.hair === 'sidepart') {
      for (let k = 0; k < 4; k++) set(hx + 0.5 + k * 0.5, hy - 5.4 + k * 0.4, hair.dk);
    }
  }
  if (hood && look.hoodUp) {
    ell(hx, hy - 0.5, headRx + 1.6, headRy + 1.2, topCol, (x, y, nx, ny) => nx < 0.5 || y < hy - 3);
  }
  // beard
  const beardCols = R(look.age === 'old' ? '#a8acb4' : spec.hair === 'grey' ? '#8a8e98' : hairBase);
  if (spec.beard === 'full') {
    // sideburn, then a band along the jaw and chin; the front of the face stays skin so the head keeps a rounded profile
    ell(hx - 0.4, hy + 2.2, headRx - 0.6, headRy - 0.9, beardCols, (x, y, nx, ny) => y > hy + 2.2 && x < hx + 4 && ny > 0.25 && !(x > hx + 2 && y < hy + 3.6), hairTone);
    rect(hx - 4, hy - 1, 1.5, 4, beardCols.lo);
    rect(hx + 0.5, hy + 3.8, 3, 1, beardCols.base);
  } else if (spec.beard === 'stubble') {
    ell(hx + 0.5, hy + 2.2, headRx - 0.2, headRy - 1.3, { hi: skin.lo, base: skin.lo, lo: skin.lo, dk: skin.lo }, (x, y, nx, ny) => y > hy + 2.4 && x > hx - 2 && ny > 0.3);
  }
  // face: the eye nearest us, the far eye at the edge, brows, nose and mouth
  const eyeY = hy - 0.6;
  const tired = spec.mood === 'tired' || spec.mood === 'sad';
  if (o.eyes !== false) {
    set(hx + 0.6, eyeY, white);
    set(hx + 1.6, eyeY, inkEye);
    set(hx + 1.6, eyeY + 1, inkEye);
    set(hx + 3.6, eyeY, inkEye);
    if (tired) {
      rect(hx + 0.6, eyeY - 1, 3, 1, skin.lo);
      set(hx + 1, eyeY + 1.4, skin.dk);
      set(hx + 2, eyeY + 1.4, skin.dk);
    }
    const browY = eyeY - 2;
    const browCol = spec.hair === 'grey' ? hair.lo : hair.dk;
    if (spec.mood === 'smirk') {
      rect(hx + 0.6, browY - 0.6, 3, 1, browCol);
      rect(hx + 4, browY + 0.4, 1, 1, browCol);
    } else if (spec.mood === 'stern') {
      rect(hx + 0.6, browY + 0.4, 3, 1, browCol);
      rect(hx + 3.6, browY, 2, 1, browCol);
    } else if (spec.mood === 'sad') {
      rect(hx + 0.6, browY, 2, 1, browCol);
      rect(hx + 2.4, browY + 0.6, 1, 1, browCol);
      rect(hx + 3.6, browY + 0.6, 1, 1, browCol);
    } else {
      rect(hx + 0.6, browY, 3, 1, browCol);
      rect(hx + 3.8, browY + 0.4, 1, 1, browCol);
    }
    // nose
    set(hx + 4.6, hy + 0.8, skin.hi);
    set(hx + 4.2, hy + 1.6, skin.lo);
    // mouth
    const my = hy + 3.3;
    const mouth = tint('#9a5448');
    if (spec.mood === 'grin') {
      rect(hx + 1, my - 0.2, 3, 1, white);
      set(hx + 0.5, my - 1, mouth);
      set(hx + 4, my - 1, mouth);
      rect(hx + 1, my + 0.8, 3, 1, mouth);
    } else if (spec.mood === 'warm') {
      rect(hx + 1.4, my, 2, 1, mouth);
      set(hx + 0.8, my - 0.8, mouth);
      set(hx + 3.4, my - 0.8, mouth);
    } else if (spec.mood === 'smirk') {
      rect(hx + 1.4, my, 2, 1, mouth);
      set(hx + 3.4, my - 1, mouth);
    } else if (spec.mood === 'sad') {
      rect(hx + 1.4, my + 0.4, 2, 1, mouth);
      set(hx + 0.8, my + 1, mouth);
      set(hx + 3.4, my + 1, mouth);
    } else {
      rect(hx + 1.4, my, 2, 1, mouth);
    }
    if (spec.mood === 'warm' && spec.beard === 'none') {
      set(hx + 3, hy + 2, tint('#e8a090'));
    }
  }
  if (spec.glasses) {
    const rim = tint('#2a2630');
    rect(hx + 0.2, eyeY - 1.2, 3.4, 3, rim);
    rect(hx + 0.8, eyeY - 0.6, 2.2, 1.8, skin.base);
    set(hx + 1, eyeY, white);
    set(hx + 2, eyeY, inkEye);
    rect(hx + 3.6, eyeY - 0.4, 1.4, 1, rim);
    set(hx + 1, eyeY - 0.8, tint('#cfe0ff'));
  }
  if (spec.props.includes('headphones')) {
    const band = tint('#2a2c36');
    for (let a = 0; a < 10; a++) set(hx - 4 + a * 0.9, hy - 6.2 + Math.sin((a / 9) * Math.PI) * -1.2 + 1.6, band);
    rect(hx - 4.6, hy - 1, 2.4, 4, band);
    rect(hx - 4.6, hy - 1, 1, 4, tint('#4a4c58'));
  }
  if (spec.props.includes('bowtie')) {
    rect(hx - 1, hy + 6.5, 4, 2, tint('#b83a3a'));
    set(hx + 0.5, hy + 7, tint('#7a2020'));
  }
  if (style === 'tweed') {
    rect(cx - 5, bodyTop + 5, 2, 3, R('#a8825a').base);
  }

  // mirror for left-facing, then outline
  let out = cv;
  if (dir < 0) {
    out = h.makeCanvas(W, H);
    const c2 = out.getContext('2d', { willReadFrequently: true });
    c2.translate(W, 0);
    c2.scale(-1, 1);
    c2.drawImage(cv, 0, 0);
  }
  h.outline(out.getContext('2d', { willReadFrequently: true }), out);
  return { cv: out, ox: OX, oy: OY };
}
