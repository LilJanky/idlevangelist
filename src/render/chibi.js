// IdleVangelist's own character style: chunky "big head, small body" figures built from flat, two-tone shapes.
//
// Why this style: hand-placed pixels cannot do realistic proportions or soft shading well, but they do bold silhouettes, flat colour
// and charm very well. So every person is ~3 heads tall, has dot eyes and no nose (nothing to go wrong), uses one base and one
// shade per material (no gradients), a single warm rim-light pixel line on the lamp side, and a dark coloured outline. Who they
// are is carried by their SILHOUETTE and one oversized prop (big coffee cup, big Bible, big briefcase, giant beanie).
// Crowd (tier 1) is ~24 px tall; the people in focus (tier 2) are the same design drawn bigger (~34 px) so the pixels match.
// Faces right; mirrored for left.

export function buildChibi(char, tier, h) {
  const big = tier >= 2;
  const k = big ? 1.4 : 1; // everything is laid out for the small size and scaled
  const W = big ? 40 : 28;
  const H = big ? 48 : 34;
  const OX = Math.floor(W / 2);
  const OY = H - 3;
  const dim = char.dim || 0;
  const fog = char.fog || '#39414f';
  const tint = (c) => (dim > 0 ? h.mix(c, fog, dim) : c);
  const mat = (base, shadeAmt = 0.3) => ({
    base: tint(base),
    sh: tint(h.mix(base, '#1c1840', shadeAmt)),
    hi: tint(h.mix(base, '#fff2d6', 0.34)),
  });
  const cv = h.makeCanvas(W, H);
  const ctx = cv.getContext('2d', { willReadFrequently: true });

  const skin = mat(char.skin, 0.22);
  const hairBase = char.age === 'old' ? '#c9ccd4' : char.hair;
  const hair = mat(hairBase, 0.36);
  const top = mat(char.top, 0.3);
  const pants = mat(char.bottom, 0.32);
  const shoe = mat('#2a2230', 0.3);
  const ink = tint('#17121c');
  const white = tint('#f6f2ee');

  const walk = char.pose === 'walk';
  const frame = char.frame % 4;
  const slim = char.build === 'slim';
  const broad = char.build === 'broad';
  const kid = char.age === 'teen' || char.age === 'young';
  const bob = walk ? (frame === 1 || frame === 3 ? 1 : 0) : char.idleFrame;

  const px = (x, y, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(OX + Math.round(x * k), OY + Math.round(y * k) - (big ? bob * 1 : bob), 1, 1);
  };
  const box = (x, y, w, hh, c) => {
    const x0 = Math.round(x * k);
    const y0 = Math.round(y * k);
    const x1 = Math.round((x + w) * k);
    const y1 = Math.round((y + hh) * k);
    ctx.fillStyle = c;
    ctx.fillRect(OX + x0, OY + y0 - bob, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  };
  // flat ellipse: base colour, shade on the lower-right, a rim of highlight on the upper-left edge
  const blob = (cx, cy, rx, ry, m, opts = {}) => {
    const { test, rim = true, shade = true } = opts;
    for (let y = Math.floor((cy - ry) * k); y <= Math.ceil((cy + ry) * k); y++) {
      for (let x = Math.floor((cx - rx) * k); x <= Math.ceil((cx + rx) * k); x++) {
        const nx = (x + 0.5 - cx * k) / (rx * k);
        const ny = (y + 0.5 - cy * k) / (ry * k);
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        if (test && !test(x / k, y / k, nx, ny)) continue;
        let c = m.base;
        if (shade && nx * 0.55 + ny * 0.85 > 0.38) c = m.sh;
        else if (rim && d > 0.62 && nx * 0.6 + ny * 0.8 < -0.5) c = m.hi;
        ctx.fillStyle = c;
        ctx.fillRect(OX + x, OY + y - bob, 1, 1);
      }
    }
  };
  const slab = (x0, y0, x1, y1, m, taper = 0) => {
    // a flat-sided block with a shaded right edge and a lit top-left corner
    for (let y = Math.round(y0 * k); y < Math.round(y1 * k); y++) {
      const t = (y - y0 * k) / Math.max(1, (y1 - y0) * k);
      const inset = Math.round(taper * t * k);
      for (let x = Math.round(x0 * k) + inset; x < Math.round(x1 * k) - inset; x++) {
        const right = x >= Math.round(x1 * k) - inset - Math.max(1, Math.round(1.3 * k));
        const lit = y === Math.round(y0 * k) || x === Math.round(x0 * k) + inset;
        ctx.fillStyle = right ? m.sh : lit ? m.hi : m.base;
        ctx.fillRect(OX + x, OY + y - bob, 1, 1);
      }
    }
  };

  // ---- proportions (small-size units; feet at y = 0) ----------------------------------------------------------------------------
  const legH = kid ? 5 : 6;
  const bodyH = slim ? 9 : 10;
  const bodyW = broad ? 8 : slim ? 5.6 : 7;
  const headR = kid ? 4.4 : 4.1;
  const hipY = -legH;
  const shoulderY = hipY - bodyH;
  const headCY = shoulderY - headR + 1.2;
  const bx = 0; // body centre

  // ---- back layer: bags, long hair, far arm ------------------------------------------------------------------------------------
  const bag = mat(char.bagColor || '#6a5238', 0.3);
  if (char.backAccessory === 'backpack') slab(bx - bodyW / 2 - 3, shoulderY + 1, bx - bodyW / 2 + 1, hipY + 1, mat(char.id === 'hero' ? '#c8963c' : char.bagColor || '#4a5a52', 0.3), 0);
  if (char.hairStyle === 'long') blob(bx - 2.4, headCY + 3.4, 2.6, 5.2, hair, { rim: false });
  if (char.hairStyle === 'old-bob') blob(bx - 2.2, headCY + 2.2, 2.4, 3.4, hair, { rim: false });
  if (char.hairStyle === 'ponytail') {
    blob(bx - 5.2, headCY + 0.6, 1.5, 3, hair, { rim: false });
  }
  const swing = walk ? [-1.6, 0, 1.6, 0][frame] : 0;
  const sleeveM = char.bodyStyle === 'tee' ? skin : char.bodyStyle === 'shirt' ? mat('#d4dce0', 0.3) : top;
  // far arm hangs behind
  slab(bx - 0.6 - swing * 0.6, shoulderY + 1.5, bx + 1.4 - swing * 0.6, shoulderY + 6.5, { ...sleeveM, base: sleeveM.sh, hi: sleeveM.sh }, 0);

  // ---- legs: two short thick legs, feet toes forward ----------------------------------------------------------------------------
  let nearX = 1.4;
  let farX = -1.4;
  let nearLift = 0;
  let farLift = 0;
  if (walk) {
    const s = [2.4, 0.4, -2.4, -0.4][frame];
    nearX = 1.2 + s;
    farX = -1.2 - s;
    if (frame === 1) nearLift = 1.4;
    if (frame === 3) farLift = 1.4;
  }
  const longHem = char.bodyStyle === 'coat' || char.bodyStyle === 'puffer' || char.bodyStyle === 'blazer';
  const legM = { base: pants.base, sh: pants.sh, hi: pants.base };
  const leg = (x, lift, far) => {
    const m = far ? { base: pants.sh, sh: pants.sh, hi: pants.sh } : legM;
    slab(x - 1.6, hipY - 0.5, x + 1.4, -lift - 0.5, m, 0);
    box(x - 1.6, -lift - 1.6, 4.6, 1.6 + 0.4, far ? shoe.sh : shoe.base);
    if (!far) box(x - 1.6, -lift - 1.6, 4.6, 0.7, shoe.hi);
  };
  leg(farX, farLift, true);
  leg(nearX, nearLift, false);

  // ---- body -----------------------------------------------------------------------------------------------------------------------
  const style = char.bodyStyle;
  const bodyBottom = hipY + (longHem ? 2.4 : 0.8);
  slab(bx - bodyW / 2, shoulderY, bx + bodyW / 2, bodyBottom, top, longHem ? -0.6 : 0.5);
  // rounded shoulders
  px(bx - bodyW / 2, shoulderY, 'rgba(0,0,0,0)');
  if (style === 'hoodie') {
    blob(bx - 1.6, shoulderY, 3.2, 1.8, top, { test: (x, y) => y <= shoulderY + 0.8 });
    box(bx - 2, hipY - 2.6, 4, 1.8, top.sh);
    box(bx + 1.2, shoulderY + 1, 0.8, 3, mat('#e8e6ee', 0.2).base);
  } else if (style === 'suit' || style === 'blazer' || style === 'tweed') {
    box(bx + 0.4, shoulderY + 0.6, 1.4, bodyH - 1.6, top.sh);
    box(bx - 0.8, shoulderY + 0.4, 1.6, 3.4, mat('#f2eee6', 0.2).base);
    if (char.extras.has('tie') || style === 'tweed') box(bx - 0.4, shoulderY + 1, 1, bodyH - 3, mat(style === 'tweed' ? '#8a2a2e' : '#c04a4a', 0.3).base);
  } else if (style === 'cardigan') {
    box(bx - 0.6, shoulderY + 0.6, 2.8, bodyH - 1.4, mat('#efe6d6', 0.15).base);
    box(bx - 0.6, shoulderY + 0.6, 0.8, bodyH - 1.4, mat('#efe6d6', 0.15).hi);
  } else if (style === 'shirt' || style === 'shirtTie') {
    const sh = mat(style === 'shirt' ? '#d4dce0' : '#f4f2ec', 0.2);
    slab(bx - bodyW / 2, shoulderY, bx + bodyW / 2, bodyBottom, sh, 0);
    box(bx + 0.4, shoulderY + 0.6, 1.2, bodyH - 2, mat(char.top, 0.3).base);
    if (char.extras.has('lanyard')) box(bx + 2, shoulderY + 0.6, 0.8, 3, tint('#4a8ad8'));
  } else if (style === 'puffer') {
    for (let y = shoulderY + 2; y < bodyBottom - 1; y += 2.4) box(bx - bodyW / 2 + 0.6, y, bodyW - 1.2, 0.7, top.sh);
  } else if (style === 'jacket' || style === 'coat') {
    box(bx + 0.6, shoulderY + 0.6, 0.9, bodyH - 1, top.sh);
  }
  if (char.smallCross) box(bx + 2, shoulderY + 1.6, 0.9, 2, tint('#f0c860'));
  if (char.backAccessory === 'crossbody' || char.backAccessory === 'bag') {
    box(bx - 3.6, hipY - 3.2, 3.4, 3, bag.base);
    box(bx - 3.6, hipY - 3.2, 3.4, 0.8, bag.hi);
  }
  if (char.backAccessory === 'tote') {
    const t2 = mat('#e8dcc0', 0.2);
    slab(bx - bodyW / 2 - 2.4, hipY - 4.4, bx - bodyW / 2 + 0.6, hipY + 0.4, t2, 0);
  }

  // ---- head ------------------------------------------------------------------------------------------------------------------------
  const hx = 1.2;
  // neck is hidden: the head sits right on the shoulders (that is part of the look)
  blob(hx, headCY, headR, headR - 0.2, skin, { test: (x, y, nx, ny) => !(ny > 0.55 && nx < -0.5) });
  // ear
  box(hx - headR + 0.2, headCY + 0.2, 1.4, 1.6, skin.sh);
  // hair / headwear
  const style2 = char.hairStyle;
  // hair covers the crown and the back of the head; the face (forward and below the brow line) stays skin
  const capTest = (x, y, nx, ny) => ny < -0.38 || (nx < -0.2 && ny < 0.45) || (nx < -0.62 && ny < 0.8);
  if (char.headwear === 'beanie') {
    const wool = mat('#566478', 0.3);
    blob(hx - 0.2, headCY - 1.2, headR + 0.6, headR - 0.6, wool, { test: (x, y, nx, ny) => ny < 0.15 });
    box(hx - headR - 0.2, headCY - 1.4, headR * 2 + 0.8, 1.8, mat('#7a8ca6', 0.2).base);
    box(hx - 0.8, headCY - headR - 1.4, 1.8, 1.6, wool.base);
  } else {
    if (style2 !== 'bald') blob(hx - 0.1, headCY - 0.5, headR + 0.5, headR + 0.1, hair, { test: capTest });
    if (style2 === 'bun') blob(hx - 3.4, headCY - headR, 1.6, 1.5, hair);
    if (char.headwear === 'cap' || char.headwear === 'cap-back') {
      const cap = mat(char.hat || '#3c4657', 0.3);
      blob(hx - 0.1, headCY - 1.2, headR + 0.7, headR - 0.8, cap, { test: (x, y, nx, ny) => ny < 0.05 });
      box(char.headwear === 'cap' ? hx + headR - 1 : hx - headR - 2.6, headCY - 1.4, 3.6, 1, cap.sh);
    }
  }
  // beard: a flat band that follows the jaw
  if (char.beard) blob(hx + 0.4, headCY + 2.4, headR - 0.5, headR - 2.4, hair, { test: (x, y, nx, ny) => ny > 0.15, rim: false });
  // face: two small dark dot eyes (no whites: they read as staring at this size), soft blush, a tiny mouth only on the big figures.
  if (char.eyes) {
    const ey = headCY - 0.2;
    const eye = tint(h.mix('#2a1c24', char.skin, 0.1));
    const ew = big ? 0.6 : 1;
    box(hx + 1.8, ey, ew, 1.8, eye);
    box(hx + 3.8, ey, ew, 1.8, eye);
    if (char.tired) { box(hx + 1.6, ey - 0.8, 1.6, 0.6, skin.sh); box(hx + 3.6, ey - 0.8, 1.6, 0.6, skin.sh); }
    box(hx + 0.8, ey + 2.2, 1.4, 0.9, tint(h.mix(char.skin, '#e8706a', 0.35)));
    if (big) {
      const mouth = tint(h.mix(char.skin, '#8a3c3c', 0.55));
      if (char.smile) box(hx + 2.4, ey + 3.4, 2, 0.7, mouth);
      else box(hx + 2.8, ey + 3.4, 1.2, 0.6, mouth);
    }
  }
  if (char.glasses) {
    const rim = tint('#262230');
    box(hx + 0.9, headCY - 0.2, 2.4, 0.5, rim);
    box(hx + 3.0, headCY - 0.2, 2.4, 0.5, rim);
    box(hx + 0.9, headCY + 2.0, 2.4, 0.4, rim);
    box(hx + 3.0, headCY + 2.0, 2.4, 0.4, rim);
  }
  if (char.extras.has('headphones')) {
    const band = mat('#2a2c36', 0.3);
    box(hx - headR, headCY - headR + 0.4, headR * 2, 1, band.base);
    blob(hx - headR + 0.8, headCY + 0.8, 1.6, 2.2, band, { rim: false });
  }
  if (char.scarf) box(bx - bodyW / 2 + 0.4, shoulderY - 0.4, bodyW - 0.8, 1.8, mat(char.scarf, 0.3).base);

  // ---- near arm, held items and gestures ---------------------------------------------------------------------------------------
  const pose = char.pose;
  const ay = shoulderY + 1.2;
  let handX = bx + 1.6 + swing * 0.6;
  let handY = ay + 5.2;
  const arm = (x1, y1) => {
    // a thick flat arm from the shoulder to the hand
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = bx + 0.6 + (x1 - bx - 0.6) * t;
      const y = ay + (y1 - ay) * t;
      blob(x, y, 1.5, 1.5, sleeveM, { rim: i === 0 });
    }
    blob(x1, y1, 1.35, 1.3, skin, { rim: false });
  };
  if (pose === 'point') { handX = bx + 8; handY = ay - 4; arm(handX, handY); }
  else if (pose === 'talk') { handX = bx + 6.4; handY = ay + 2; arm(handX, handY); }
  else if (pose === 'react') { handX = bx + 5.4; handY = ay - 1.2; arm(handX, handY); }
  else if (pose === 'crossed') {
    blob(bx + 0.4, ay + 4, 4.2, 1.6, sleeveM, { rim: false });
    blob(bx + 3.8, ay + 3.6, 1.35, 1.2, skin, { rim: false });
    handX = bx + 3.8; handY = ay + 3.6;
  } else if (pose === 'hold' || char.handItem === 'book') { handX = bx + 3.6; handY = ay + 4.2; arm(handX, handY); }
  else if (char.handItem === 'phone' || char.handItem === 'coffee') { handX = bx + 3.8; handY = ay + 3.8; arm(handX, handY); }
  else arm(handX, handY);

  // props: deliberately oversized so the silhouette says who this is
  const hi = handX;
  const hv = handY;
  if (char.handItem === 'coffee') {
    box(hi - 0.4, hv - 4, 3.4, 4.6, tint('#f6f2ee'));
    box(hi - 0.4, hv - 2.6, 3.4, 1.6, tint('#b8825a'));
    box(hi - 0.8, hv - 4.6, 4.2, 0.9, tint('#3a3a44'));
    if (char.steam) { px(hi + 1, hv - 6.2, 'rgba(230,236,246,0.8)'); px(hi + 0.4, hv - 7.4, 'rgba(230,236,246,0.6)'); }
  } else if (char.handItem === 'phone') {
    box(hi - 0.2, hv - 3.4, 2.4, 4, tint('#9ad0ff'));
    box(hi - 0.2, hv - 3.4, 2.4, 0.8, tint('#e6f6ff'));
  } else if (char.handItem === 'briefcase') {
    slab(hi - 3, hv + 0.6, hi + 3, hv + 6, mat('#6a4a34', 0.3), 0);
    box(hi - 1, hv - 0.6, 2, 1.2, tint('#2a1e16'));
  } else if (char.handItem === 'umbrella') {
    const cano = mat('#46506a', 0.3);
    blob(hi + 0.6, hv - 9, 7, 2.6, cano, { test: (x, y, nx, ny) => ny < 0.3 });
    box(hi + 0.2, hv - 9, 0.9, 9.4, tint('#2a2a32'));
  } else if (char.handItem === 'brochure') {
    box(hi - 0.4, hv - 4.4, 3.6, 5, tint('#9fd0e8'));
    box(hi + 0.2, hv - 3, 2.4, 0.6, tint('#5a9ac0'));
    box(hi + 0.2, hv - 1.6, 2.4, 0.6, tint('#5a9ac0'));
  } else if (char.handItem === 'book') {
    const cover = mat('#7a4c24', 0.3);
    slab(hi - 1.4, hv - 5.2, hi + 3.6, hv + 0.4, cover, 0);
    box(hi + 0.6, hv - 3.8, 0.9, 2.8, tint('#e8c860'));
    box(hi - 0.4, hv - 2.8, 2.9, 0.9, tint('#e8c860'));
  }

  // mirror for left, then a dark coloured outline
  let out = cv;
  if (char.dir < 0) {
    out = h.makeCanvas(W, H);
    const c2 = out.getContext('2d', { willReadFrequently: true });
    c2.translate(W, 0);
    c2.scale(-1, 1);
    c2.drawImage(cv, 0, 0);
  }
  h.outline(out.getContext('2d', { willReadFrequently: true }), out);
  return { cv: out, ox: OX + (char.dir < 0 ? 0 : 0), oy: OY };
}
