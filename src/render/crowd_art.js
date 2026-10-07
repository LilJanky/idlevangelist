// Crowd figures (about 24 px tall, side view). Same shaded-shape approach as hero.js, tuned for small sizes:
// legs are capsules that start INSIDE the torso (so the body is one connected figure), feet swing through a four-frame
// walk (contact, passing, contact, passing), arms swing against the legs, and everything is lit from the upper left.

const W = 24;
const H = 32;
const OX = 12;
const OY = 28; // the row the feet stand on

export function buildCrowd(char, h) {
  const dim = char.dim || 0;
  const fog = char.fog || '#39414f';
  const tint = (c) => (dim > 0 ? h.mix(c, fog, dim) : c);
  const R = (base) => {
    const r = h.ramp(base);
    return { hi: tint(r.hi), base: tint(r.base), lo: tint(r.lo), dk: tint(r.dk) };
  };
  const cv = h.makeCanvas(W, H);
  const ctx = cv.getContext('2d', { willReadFrequently: true });

  const skin = R(char.skin);
  const hairBase = char.age === 'old' ? '#c6cad2' : char.hair;
  const hair = R(hairBase);
  const top = R(char.top);
  const pants = R(char.bottom);
  const shoe = R('#2a2430');
  const walk = char.pose === 'walk';
  const frame = char.frame % 4;
  const bobUp = walk ? (frame === 1 || frame === 3 ? 1 : 0) : char.idleFrame;
  const slim = char.build === 'slim';
  const broad = char.build === 'broad';
  const small = char.age === 'teen' || char.age === 'young';
  const old = char.age === 'old';
  const sc = small ? 1 : 0; // teens and the young stand a little shorter

  const set = (x, y, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(OX + Math.round(x), OY + Math.round(y), 1, 1);
  };
  const rect = (x, y, w, hh, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(OX + Math.round(x), OY + Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(hh)));
  };
  const tone = (cols, L) => (L > 0.42 ? cols.hi : L < -0.62 ? cols.dk : L < -0.16 ? cols.lo : cols.base);
  const ell = (cx, cy, rx, ry, cols, test, fn = tone) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        if (test && !test(x, y, nx, ny)) continue;
        set(x, y, fn(cols, -(nx * 0.6 + ny * 0.8)));
      }
    }
  };
  const limb = (pts, r, cols) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let k = 0; k <= n; k++) ell(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, r, r, cols);
    }
  };

  const hipY = -10 + sc;
  const shoulderY = -18 + sc;
  const headY = -22 + sc * 1;
  const torsoW = broad ? 8 : slim ? 6 : 7;

  // ---- feet and legs ----------------------------------------------------------------------------------------------------------
  let nearFoot = [1.4, 0];
  let farFoot = [-1.4, 0];
  let nearKnee = [0.8, -5.4 + sc * 0.5];
  let farKnee = [-0.8, -5.4 + sc * 0.5];
  if (walk) {
    if (frame === 0) { nearFoot = [3.2, 0]; farFoot = [-3, 0]; nearKnee = [1.8, -5.6]; farKnee = [-1.6, -5.4]; }
    if (frame === 1) { nearFoot = [0.8, -2]; farFoot = [-0.4, 0]; nearKnee = [2.4, -6]; farKnee = [-0.2, -5.4]; }
    if (frame === 2) { nearFoot = [-3, 0]; farFoot = [3.2, 0]; nearKnee = [-1.6, -5.4]; farKnee = [1.8, -5.6]; }
    if (frame === 3) { nearFoot = [-0.4, 0]; farFoot = [0.8, -2]; nearKnee = [-0.2, -5.4]; farKnee = [2.4, -6]; }
  }
  const legR = slim ? 1.25 : 1.4;
  const farPants = { hi: pants.base, base: pants.lo, lo: pants.dk, dk: pants.dk };
  const farHipX = -0.8;
  const nearHipX = 0.6;
  limb([[farHipX, hipY - 1], farKnee, [farFoot[0], farFoot[1] - 1.2]], legR, farPants);
  ell(farFoot[0] + 1, farFoot[1] - 0.6, 2.2, 1.2, { hi: shoe.base, base: shoe.lo, lo: shoe.dk, dk: shoe.dk });
  limb([[nearHipX, hipY - 1], nearKnee, [nearFoot[0], nearFoot[1] - 1.2]], legR + 0.1, pants);
  ell(nearFoot[0] + 1, nearFoot[1] - 0.6, 2.4, 1.3, shoe);

  // ---- things behind the body -----------------------------------------------------------------------------------------------
  const lift = (y) => y - bobUp;
  const faceTone = (cols, L) => (L > 0.3 ? cols.hi : L < -0.8 ? cols.lo : cols.base);
  const hairTone = (cols, L) => (L > 0.7 ? cols.hi : L < -0.45 ? cols.dk : L < -0.05 ? cols.lo : cols.base);
  const hairToneBack = (cols, L) => (L > 0.7 ? cols.base : L < -0.2 ? cols.dk : cols.lo);
  if (char.backAccessory === 'backpack') {
    const pk = R(char.bagColor === '#6a5238' ? '#4a5a52' : char.bagColor);
    rect(-6, lift(shoulderY + 0.5), 4, 8, pk.base);
    rect(-6, lift(shoulderY + 0.5), 4, 1, pk.hi);
    rect(-6, lift(shoulderY + 0.5), 1, 8, pk.hi);
    rect(-3, lift(shoulderY + 1), 1, 7, pk.lo);
  }
  if (char.hairStyle === 'long' || char.hairStyle === 'old-bob') {
    ell(-1.6, lift(headY + 3.5), 1.9, char.hairStyle === 'long' ? 4.6 : 2.8, hair, null, hairToneBack);
  }
  if (char.hairStyle === 'ponytail') {
    limb([[-2.6, lift(headY + 1)], [-5, lift(headY + 3)], [-4.4, lift(headY + 6)]], 1.2, hair);
  }
  // far arm (behind the torso), swinging against the far leg
  const armR = 1.15;
  const sleeve = char.bodyStyle === 'tee' ? skin : char.bodyStyle === 'shirt' ? R('#d0d8dc') : top;
  const farSwing = walk ? [-2.2, -0.2, 2.2, 0.2][frame] : -0.5;
  const nearSwing = -farSwing;
  limb([[-0.4, lift(shoulderY + 1)], [farSwing * 0.5 - 0.2, lift(shoulderY + 4.5)], [farSwing, lift(hipY + 0.2)]], armR, { hi: sleeve.base, base: sleeve.lo, lo: sleeve.dk, dk: sleeve.dk });

  // ---- torso -----------------------------------------------------------------------------------------------------------------
  const longHem = char.bodyStyle === 'coat' || char.bodyStyle === 'puffer' || char.bodyStyle === 'blazer';
  const tY0 = lift(shoulderY);
  const tY1 = lift(hipY + (longHem ? 3 : 0.6));
  for (let y = tY0; y <= tY1; y++) {
    const t = (y - tY0) / Math.max(1, tY1 - tY0);
    let w = torsoW + (longHem ? t * 1.2 : -t * 0.6);
    if (y === tY0) w -= 2;
    const xl = 0.4 - w / 2;
    for (let x = Math.round(xl); x < Math.round(xl + w); x++) {
      const nx = (x + 0.5 - 0.4) / (w / 2);
      const ny = t * 1.1 - 0.5;
      set(x, y, tone(top, -(nx * 0.6 + ny * 0.8)));
    }
  }
  // clothing details
  const bs = char.bodyStyle;
  if (bs === 'hoodie') {
    ell(-1.2, tY0 - 0.2, 2.6, 1.6, top, (x, y) => y <= tY0 + 1);
    rect(-2, tY1 - 2, 4, 2, top.lo);
  } else if (bs === 'suit' || bs === 'blazer') {
    rect(0, tY0 + 1, 1, 6, top.dk);
    rect(2, tY0, 1, 5, top.hi);
    if (char.extras.has('tie')) { rect(1, tY0 + 1, 1, 5, tint('#c04a4a')); rect(1, tY0 + 1, 1, 1, tint('#e07070')); }
    else rect(1, tY0 + 1, 2, 3, tint(bs === 'blazer' ? '#f1ece4' : '#e6e6e6'));
  } else if (bs === 'cardigan') {
    const inner = R('#efe6d6');
    rect(1, tY0 + 1, 2, tY1 - tY0 - 1, inner.base);
    rect(1, tY0 + 1, 1, tY1 - tY0 - 1, inner.hi);
  } else if (bs === 'jacket') {
    rect(1, tY0 + 1, 1, tY1 - tY0 - 1, top.dk);
    rect(-2, tY1 - 2, 3, 1, top.lo);
  } else if (bs === 'coat') {
    rect(1, tY0 + 1, 1, tY1 - tY0, top.dk);
    rect(-2, tY0 + 5, 5, 1, top.lo);
  } else if (bs === 'shirt' || bs === 'shirtTie') {
    const shirt = R(bs === 'shirt' ? '#d0d8dc' : '#f2f0ea');
    rect(-2, tY0, 6, tY1 - tY0, shirt.base);
    rect(-2, tY0, 1, tY1 - tY0, shirt.hi);
    rect(1, tY0 + 1, 1, 6, tint(char.top));
    if (char.extras.has('lanyard')) rect(2, tY0 + 1, 1, 4, tint('#4a8ad8'));
  } else if (bs === 'tweed') {
    for (let y = tY0 + 1; y < tY1; y += 2) for (let x = -3; x < 4; x += 2) set(x + (y % 4 ? 0 : 1), y, top.lo);
  }
  if (char.smallCross) set(2, tY0 + 2, tint('#f0c860'));
  if (char.backAccessory === 'crossbody' || char.backAccessory === 'bag') {
    const bc = R(char.bagColor);
    for (let k = 0; k < 6; k++) set(-2 + k * 0.7, tY0 + 1 + k, bc.base);
    rect(-3, tY1 - 4, 3, 3, bc.base);
    rect(-3, tY1 - 4, 3, 1, bc.hi);
  }
  if (char.backAccessory === 'tote') {
    const tb = R('#e8dcc0');
    rect(-4, tY1 - 5, 3, 5, tb.base);
    rect(-4, tY1 - 5, 3, 1, tb.hi);
  }

  // ---- neck and head ----------------------------------------------------------------------------------------------------------
  const hY = lift(headY);
  const hx = char.age === 'old' ? 1.2 : 1;
  rect(hx - 1, hY + 3.6, 2, 2, skin.lo);
  ell(hx, hY, 2.9, 3.5, skin, (x, y) => !(y > hY + 2 && x < hx - 2), faceTone);
  // hair
  const style = char.hairStyle;
  const hairHit = (x, y) => y < hY - 1.4 + Math.max(0, (hx - x) * 0.45) || x < hx - 1.8;
  if (!char.headwear || char.headwear === 'cap' || char.headwear === 'cap-back') {
    if (style !== 'bald') ell(hx - 0.1, hY - 0.4, 3.3, 3.8, hair, hairHit, hairTone);
  }
  if (style === 'bun') ell(-1.5, hY - 4, 1.5, 1.4, hair);
  // headwear
  if (char.headwear === 'cap' || char.headwear === 'cap-back') {
    const cap = R(char.hat);
    ell(hx - 0.2, hY - 1.4, 3.8, 2.6, cap, (x, y) => y < hY - 1);
    if (char.headwear === 'cap') rect(hx + 2, hY - 1.2, 3, 1, cap.lo); else rect(hx - 6, hY - 1.2, 3, 1, cap.lo);
    rect(hx - 3, hY - 1.4, 7, 1, cap.dk);
  } else if (char.headwear === 'beanie') {
    const wool = R('#566478');
    ell(hx - 0.2, hY - 1.4, 3.9, 2.8, wool, (x, y) => y < hY);
    rect(hx - 3.5, hY - 0.4, 7, 1, R('#74849c').base);
  }
  if (char.beard) ell(hx + 0.3, hY + 2.4, 2.4, 1.6, hair, (x, y) => y > hY + 1.6 && x > hx - 1.6, hairTone);
  if (char.glasses) { rect(hx + 0.6, hY - 0.2, 3, 1, tint('#24222c')); }
  // face
  if (char.eyes) {
    const ey = hY + 0.2;
    set(hx + 1, ey, tint('#f4f0ee'));
    set(hx + 2, ey, tint('#1a1218'));
    if (char.tired) set(hx + 1, ey + 1, skin.dk);
    set(hx + 3, hY + 1.2, skin.hi); // nose
    set(hx + 2, hY + 2.3, tint(char.smile ? '#b05a4c' : '#9a5448')); // mouth
  }
  if (char.extras.has('headphones')) {
    const band = tint('#2a2c36');
    rect(hx - 3, hY - 4, 6, 1, band);
    rect(hx - 3.6, hY - 1, 2, 3, band);
    set(hx - 3.6, hY - 1, tint('#4a4c58'));
  }

  // ---- near arm and what it holds ---------------------------------------------------------------------------------------------
  const handX = nearSwing;
  const handY = lift(hipY + 0.2);
  const phoneUp = char.handItem === 'phone';
  const coffeeUp = char.handItem === 'coffee';
  let hx2 = handX;
  let hy2 = handY;
  if (phoneUp || coffeeUp) {
    limb([[0.6, lift(shoulderY + 1)], [1.6, lift(shoulderY + 5)], [3.4, lift(shoulderY + 5)]], armR, sleeve);
    hx2 = 3.8;
    hy2 = lift(shoulderY + 5);
  } else {
    limb([[0.6, lift(shoulderY + 1)], [nearSwing * 0.5 + 0.8, lift(shoulderY + 4.5)], [nearSwing + 0.8, lift(hipY + 0.2)]], armR, sleeve);
    hx2 = nearSwing + 0.8;
  }
  ell(hx2, hy2, 1, 1, skin);
  if (phoneUp) { rect(hx2 + 0.5, hy2 - 2, 2, 3, tint('#9ad0ff')); set(hx2 + 1, hy2 - 2, tint('#e6f6ff')); }
  if (coffeeUp) { rect(hx2 + 0.5, hy2 - 2, 2, 3, tint('#f4f0ea')); rect(hx2 + 0.5, hy2 - 1, 2, 1, tint('#b8825a')); }
  if (char.handItem === 'briefcase') {
    const bc = R('#6a4a34');
    rect(hx2 - 2, hy2 + 1, 5, 4, bc.base);
    rect(hx2 - 2, hy2 + 1, 5, 1, bc.hi);
    rect(hx2 - 2, hy2 + 4, 5, 1, bc.dk);
  }
  if (char.handItem === 'umbrella') {
    const cano = R('#46506a');
    rect(hx2 - 5, hy2 - 13, 12, 2, cano.base);
    rect(hx2 - 4, hy2 - 14, 10, 1, cano.hi);
    rect(hx2 - 5, hy2 - 11, 12, 1, cano.lo);
    rect(hx2, hy2 - 11, 1, 11, tint('#2a2a32'));
  }
  if (char.handItem === 'book') {
    const cover = R('#7a4c24');
    rect(hx2 - 1, hy2 - 3, 4, 5, cover.base);
    rect(hx2 - 1, hy2 - 3, 4, 1, cover.hi);
    set(hx2 + 1, hy2 - 1, tint('#e8c860'));
  }
  if (char.handItem === 'brochure') {
    rect(hx2, hy2 - 3, 3, 4, tint('#9fd0e8'));
  }

  // mirror for left-facing
  let out = cv;
  if (char.dir < 0) {
    out = h.makeCanvas(W, H);
    const c2 = out.getContext('2d', { willReadFrequently: true });
    c2.translate(W, 0);
    c2.scale(-1, 1);
    c2.drawImage(cv, 0, 0);
  }
  h.outline(out.getContext('2d', { willReadFrequently: true }), out);
  return { cv: out, ox: OX, oy: OY };
}
