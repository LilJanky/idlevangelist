// Dialogue portraits, painted rather than stamped: every form (skull, jaw, hair, shoulders, clothing) is a shaded ellipse or band lit
// from the upper left with a four-step ramp, so faces have volume. Three-quarter view, 48x48, original art.

const S = 48;

const ARCH = {
  skeptic: { hair: 'swoop', beard: 'stubble', top: 'hoodie', glasses: false, extra: 'headphones', brow: 'raised', mouth: 'smirk' },
  nominal: { hair: 'long', beard: 'none', top: 'cardigan', extra: 'cross', brow: 'soft', mouth: 'smile' },
  broken: { hair: 'beanie', beard: 'full', top: 'coat', extra: 'collar', brow: 'sad', mouth: 'flat' },
  worker: { hair: 'messy', beard: 'none', top: 'shirttie', extra: 'lanyard', brow: 'tired', mouth: 'halfsmile' },
  visitor: { hair: 'sidepart', beard: 'none', top: 'whiteshirt', extra: 'nametag', brow: 'soft', mouth: 'grin' },
  professor: { hair: 'grey', beard: 'none', top: 'tweed', glasses: true, extra: 'bowtie', brow: 'stern', mouth: 'flat' },
};

export function paintPortrait(ctx, id, mood, h) {
  const a = ARCH[id];
  if (!a) return;
  const look = h.look;
  const R = h.ramp;
  const mixc = h.mix;
  const skin = R(look.skin);
  const hairBase = a.hair === 'grey' ? '#a4a8b4' : look.hair;
  const hair = R(hairBase);
  const top = R(look.top);
  const white = '#f6f3ee';
  const ink = '#14111a';

  const px = (x, y, c) => {
    if (x < 2 || y < 2 || x >= S - 2 || y >= S - 2) return;
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const rc = (x, y, w, hh, c) => {
    for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < w; xx++) px(x + xx, y + yy, c);
  };
  const tone = (cols, L) => (L > 0.42 ? cols.hi : L < -0.72 ? cols.dk : L < -0.22 ? cols.lo : cols.base);
  const faceTone = (cols, L) => (L > 0.3 ? cols.hi : L < -0.78 ? cols.lo : cols.base);
  const hairTone = (cols, L) => (L > 0.66 ? cols.hi : L < -0.5 ? cols.dk : L < -0.08 ? cols.lo : cols.base);
  const ell = (cx, cy, rx, ry, cols, test, fn = tone) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        if (test && !test(x, y, nx, ny)) continue;
        px(x, y, fn(cols, -(nx * 0.62 + ny * 0.78)));
      }
    }
  };

  const cx = 23.5;
  const cy = 20;
  const tired = a.brow === 'tired' || a.brow === 'sad';

  // ---- shoulders and clothing -----------------------------------------------------------------------------------------------
  const sy = 36;
  const shoulders = (cols, fn) => ell(cx, sy + 11, 21, 12.5, cols, (x, y) => y >= sy - 1, fn);
  if (a.top === 'whiteshirt' || a.top === 'shirttie') {
    const shirt = R(a.top === 'whiteshirt' ? '#f2f0ea' : '#d3dadd');
    shoulders(shirt);
    ell(cx, sy + 9, 6, 8, R(look.top), (x, y) => y >= sy + 1 && Math.abs(x + 0.5 - (cx + 1)) < 2 + (y - sy) * 0.15, (c, L) => (L > 0.4 ? c.hi : c.base));
    // collar wings
    for (let k = 0; k < 6; k++) {
      px(cx - 4 - k * 0.4, sy - 1 + k, shirt.hi);
      px(cx + 6 + k * 0.4, sy - 1 + k, shirt.lo);
    }
    rc(Math.round(cx - 1), sy - 1, 5, 2, a.top === 'whiteshirt' ? '#2a2c38' : look.top);
  } else if (a.top === 'tweed') {
    shoulders(top);
    for (let y = sy; y < S; y += 2) for (let x = 6 + ((y / 2) % 2); x < 42; x += 2) px(x, y, top.lo);
    const shirt = R('#f0ece4');
    ell(cx, sy + 8, 5, 8, shirt, (x, y) => y >= sy + 1);
    rc(Math.round(cx - 3), sy, 8, 2, '#8a2a2e');
    rc(Math.round(cx), sy + 1, 2, 3, '#5a1a1e');
  } else if (a.top === 'cardigan') {
    shoulders(top);
    const inner = R('#efe4d0');
    ell(cx + 1, sy + 8, 7, 9, inner, (x, y) => y >= sy);
    for (let k = 0; k < 3; k++) px(cx - 6, sy + 4 + k * 4, top.dk);
    // cross pendant
    px(cx + 1, sy + 3, '#e8c860'); px(cx + 1, sy + 4, '#e8c860'); px(cx + 1, sy + 5, '#e8c860'); px(cx, sy + 4, '#e8c860'); px(cx + 2, sy + 4, '#e8c860');
    px(cx + 1, sy + 1, '#a8864a'); px(cx + 1, sy + 2, '#a8864a');
  } else if (a.top === 'coat') {
    shoulders(top);
    const plaid = R('#c9a060');
    for (let y = sy + 1; y < S; y += 4) rc(8, y, 32, 1, top.lo);
    for (let x = 9; x < 40; x += 5) rc(x, sy, 1, 12, plaid.lo);
    ell(cx, sy + 1, 11, 4, R(mixc(look.top, '#d8c8a8', 0.2)), (x, y) => y >= sy - 1 && y <= sy + 4);
  } else {
    shoulders(top);
  }
  if (a.top === 'hoodie') {
    // the hood bunched around the neck and two drawstrings
    ell(cx, sy, 13, 5, top, (x, y) => y <= sy + 3, (c, L) => (L > 0.3 ? c.base : c.lo));
    rc(Math.round(cx - 3), sy + 3, 1, 7, '#e8e6ee');
    rc(Math.round(cx + 5), sy + 3, 1, 7, '#e8e6ee');
    rc(Math.round(cx - 3), sy + 10, 1, 1, '#9aa0ae');
    rc(Math.round(cx + 5), sy + 10, 1, 1, '#9aa0ae');
  }
  if (a.extra === 'lanyard') {
    for (let k = 0; k < 7; k++) { px(cx + 8 - k, sy + 1 + k, '#4a8ad8'); px(cx + 7 - k, sy + 1 + k, '#3a6ab8'); }
    rc(Math.round(cx - 1), sy + 8, 6, 5, '#f6f6f0');
    rc(Math.round(cx), sy + 9, 3, 1, '#4a8ad8');
  }
  if (a.extra === 'nametag') {
    rc(Math.round(cx + 6), sy + 6, 8, 5, '#ffffff');
    rc(Math.round(cx + 6), sy + 6, 8, 1, '#d84a4a');
    rc(Math.round(cx + 7), sy + 8, 5, 1, '#9aa0ae');
  }
  if (a.extra === 'headphones') {
    // around the neck
    ell(cx, sy - 2, 11, 3.2, R('#2a2c36'), (x, y) => y > sy - 3 && (Math.abs(x + 0.5 - cx) > 6));
    ell(cx - 9, sy + 3, 3.4, 4.2, R('#3a3c48'));
    ell(cx + 9, sy + 3, 3.4, 4.2, R('#2a2c36'));
  }

  // ---- neck -------------------------------------------------------------------------------------------------------------------
  ell(cx + 0.5, 33, 5.2, 5, skin, (x, y) => y >= 29, (c, L) => (L > 0.3 ? c.base : c.lo));
  rc(Math.round(cx - 3), 30, 8, 1, skin.lo);

  // ---- hair behind the head ---------------------------------------------------------------------------------------------------
  if (a.hair === 'long') {
    ell(cx - 1, cy + 6, 13, 17, hair, (x, y) => y >= cy - 4 && (x < cx - 8 || x > cx + 8), hairTone);
  }

  // ---- head ------------------------------------------------------------------------------------------------------------------
  // ear (far side hidden, near side on the left in a three-quarter view)
  ell(cx - 10.2, cy + 1.5, 1.8, 3, { ...skin, base: skin.lo, hi: skin.base }, null, faceTone);
  ell(cx + 0.5, cy, 9.8, 12, skin, (x, y) => !(y > cy + 7 && Math.abs(x + 0.5 - (cx + 0.5)) > 9.8 - (y - cy - 7) * 1.1), faceTone);
  // cheek and brow-ridge shading
  ell(cx + 6, cy + 3, 3.4, 2.4, { hi: skin.base, base: skin.base, lo: skin.base, dk: skin.base }, null, () => mixc(look.skin, '#e8786a', 0.14));
  rc(Math.round(cx - 7), cy - 5, 15, 1, skin.lo);

  // ---- hair on top -----------------------------------------------------------------------------------------------------------
  const top2 = cy - 7;
  if (a.hair === 'beanie') {
    const wool = R('#5a6a82');
    ell(cx + 0.5, cy - 6, 11.4, 8.6, wool, (x, y) => y < cy - 4);
    rc(Math.round(cx - 11), cy - 6, 23, 4, R('#7a8aa4').base);
    rc(Math.round(cx - 11), cy - 6, 23, 1, R('#9aaac4').base);
    for (let x = Math.round(cx - 9); x < cx + 11; x += 3) rc(x, cy - 13, 1, 6, wool.lo);
  } else if (a.hair === 'grey' || a.hair === 'messy' || a.hair === 'swoop' || a.hair === 'sidepart') {
    ell(cx + 0.5, cy - 3, 11, 11.4, hair, (x, y, nx, ny) => y < cy - 6 + Math.max(0, (cx - x) * 0.45) + (a.hair === 'sidepart' ? 0 : -0.5) || x < cx - 8.5, hairTone);
    if (a.hair === 'swoop') {
      ell(cx + 2, cy - 8, 9, 4, hair, (x, y) => y > cy - 9 && y < cy - 5 && x > cx - 4, hairTone);
      rc(Math.round(cx - 6), cy - 6, 8, 2, hair.base);
    }
    if (a.hair === 'messy') {
      for (const [dx, dy] of [[-6, -14], [-2, -15], [3, -14], [7, -12], [-9, -11]]) { px(cx + dx, cy + dy, hair.base); px(cx + dx + 1, cy + dy, hair.lo); }
      rc(Math.round(cx - 8), cy - 6, 9, 3, hair.lo);
    }
    if (a.hair === 'sidepart') {
      for (let k = 0; k < 9; k++) px(cx - 3 + k * 0.5, cy - 12 + k * 0.5, hair.dk);
      rc(Math.round(cx - 9), cy - 7, 8, 2, hair.lo);
    }
    if (a.hair === 'grey') {
      // thinning hair brushed back, fuller above the ears
      rc(Math.round(cx - 10), cy - 4, 3, 7, hair.base);
      rc(Math.round(cx + 8), cy - 3, 2, 5, hair.lo);
    }
  } else if (a.hair === 'long') {
    ell(cx + 0.5, cy - 3, 11.4, 11.6, hair, (x, y) => y < cy - 5 + Math.max(0, (cx - x) * 0.4) || x < cx - 9, hairTone);
    // side part and a lock falling over the near shoulder
    for (let k = 0; k < 8; k++) px(cx - 1 + k * 0.4, cy - 13 + k * 0.4, hair.dk);
  }

  // ---- beard -----------------------------------------------------------------------------------------------------------------
  if (a.beard === 'full') {
    const beard = R(look.hair);
    ell(cx + 0.5, cy + 6, 9.8, 7.4, beard, (x, y, nx, ny) => y > cy + 3.4 - Math.abs(nx) * -2 && !(Math.abs(nx) < 0.34 && y > cy + 4 && y < cy + 7), hairTone);
    // mouth gap
    rc(Math.round(cx + 1), cy + 6, 5, 1, mixc(look.skin, '#7a3a34', 0.4));
    rc(Math.round(cx + 1), cy + 7, 5, 1, skin.lo);
    rc(Math.round(cx - 6), cy + 2, 12, 1, beard.lo);
  } else if (a.beard === 'stubble') {
    ell(cx + 0.5, cy + 6.5, 9, 6, { hi: skin.lo, base: skin.lo, lo: skin.lo, dk: skin.lo }, (x, y, nx, ny) => y > cy + 3.8 && ny > 0.2 && (x + y) % 3 !== 0);
  }

  // ---- face ------------------------------------------------------------------------------------------------------------------
  const eyeY = cy - 1.6;
  const exL = cx - 4.2;
  const exR = cx + 3.8;
  const eye = (x, big) => {
    rc(Math.round(x), Math.round(eyeY), big ? 4 : 3, 2, white);
    rc(Math.round(x + (big ? 1.5 : 1)), Math.round(eyeY), 2, 2, ink);
    px(x + (big ? 2 : 1.5), eyeY, '#8fa6c8');
    px(x + (big ? 1.5 : 1), eyeY - 1, skin.dk);
    if (tired) rc(Math.round(x), Math.round(eyeY + 2), big ? 4 : 3, 1, skin.dk);
  };
  eye(exL, true);
  eye(exR, false);
  // brows
  const browC = a.hair === 'grey' ? hair.lo : hair.dk;
  const bY = eyeY - 3;
  if (a.brow === 'raised') {
    rc(Math.round(exL - 0.5), bY, 5, 1, browC);
    rc(Math.round(exR + 0.5), bY - 2, 4, 1, browC);
    px(exR + 4.5, bY - 1, browC);
  } else if (a.brow === 'stern') {
    rc(Math.round(exL), bY + 1, 5, 1, browC);
    rc(Math.round(exR), bY, 4, 1, browC);
    px(exL + 5, bY + 2, browC);
  } else if (a.brow === 'sad') {
    rc(Math.round(exL), bY, 3, 1, browC);
    rc(Math.round(exL + 3), bY + 1, 2, 1, browC);
    rc(Math.round(exR), bY + 1, 2, 1, browC);
    rc(Math.round(exR + 2), bY, 2, 1, browC);
  } else if (a.brow === 'tired') {
    rc(Math.round(exL), bY + 1, 5, 1, browC);
    rc(Math.round(exR), bY + 1, 4, 1, browC);
  } else {
    rc(Math.round(exL), bY, 5, 1, browC);
    rc(Math.round(exR), bY, 4, 1, browC);
  }
  // nose: a lit ridge, a shaded side and the tip
  for (let y = Math.round(cy - 1); y < cy + 4; y++) px(cx + 1.2, y, skin.lo);
  px(cx + 2.5, cy + 4, skin.dk);
  px(cx, cy + 4.4, skin.lo);
  px(cx + 1.5, cy + 3, skin.hi);
  px(cx + 2.5, cy + 3, skin.hi);
  // mouth
  const lip = mixc(look.skin, '#9a3a3a', 0.55);
  const my = cy + 7;
  const m = (mm) => {
    if (mm === 'grin') {
      rc(Math.round(cx - 2), my, 8, 3, '#8a2e32');
      rc(Math.round(cx - 1), my, 6, 1, white);
      rc(Math.round(cx - 3), my - 1, 1, 1, lip);
      rc(Math.round(cx + 6), my - 1, 1, 1, lip);
      rc(Math.round(cx - 1), my + 3, 6, 1, lip);
    } else if (mm === 'smile') {
      rc(Math.round(cx - 1), my, 6, 1, lip);
      rc(Math.round(cx - 2), my - 1, 1, 1, lip);
      rc(Math.round(cx + 5), my - 1, 1, 1, lip);
      rc(Math.round(cx), my + 1, 4, 1, mixc(look.skin, '#c8605a', 0.4));
    } else if (mm === 'smirk') {
      rc(Math.round(cx - 1), my + 1, 5, 1, lip);
      rc(Math.round(cx + 4), my, 2, 1, lip);
      px(cx + 6, my - 1, lip);
    } else if (mm === 'halfsmile') {
      rc(Math.round(cx - 1), my, 6, 1, lip);
      px(cx + 5, my - 1, lip);
    } else {
      rc(Math.round(cx - 1), my, 6, 1, lip);
    }
  };
  let mouth = a.mouth;
  if (mood === 'warm') mouth = a.mouth === 'grin' ? 'grin' : 'smile';
  if (mood === 'guarded') mouth = 'flat';
  m(mouth);
  if (mood === 'warm') { px(exR + 1, bY - 1, browC); }
  if (a.glasses) {
    const rim = '#24222c';
    for (const [x, w] of [[exL - 1.5, 7], [exR - 1.5, 6.5]]) {
      rc(Math.round(x), Math.round(eyeY - 1.5), Math.round(w), 1, rim);
      rc(Math.round(x), Math.round(eyeY + 2.5), Math.round(w), 1, rim);
      rc(Math.round(x), Math.round(eyeY - 1.5), 1, 5, rim);
      rc(Math.round(x + w - 1), Math.round(eyeY - 1.5), 1, 5, rim);
      px(x + 1.5, eyeY - 0.5, 'rgba(230,240,255,0.0)');
      px(x + 2, eyeY - 0.5, '#dcecff');
    }
    rc(Math.round(exL + 5.5), Math.round(eyeY), 3, 1, rim);
  }
  if (a.extra === 'bowtie') {
    // drawn over the collar
  }
  if (a.hair === 'messy') {
    // a day's worth of tired
    rc(Math.round(exL), Math.round(eyeY + 3), 4, 1, skin.lo);
  }
}
