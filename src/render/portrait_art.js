// Dialogue portraits in the game's chunky style (see chibi.js): a big round head filling the frame, flat colour with one base and one
// shade per material, a rim-light edge, tall dot eyes with a glint, a blush, a tiny mouth and NO nose. Who someone is comes from
// their hair, headwear and one prop at the shoulder. 48x48, original art, mood changes only the eyes/brows/mouth.

const S = 48;

const ARCH = {
  skeptic: { hair: 'swoop', beard: 'stubble', collar: 'hoodie', brow: 'raised', mouth: 'smirk', prop: 'headphones' },
  nominal: { hair: 'long', beard: 'none', collar: 'cardigan', brow: 'soft', mouth: 'smile', prop: 'cross' },
  broken: { hair: 'beanie', beard: 'full', collar: 'coat', brow: 'sad', mouth: 'flat', prop: 'none' },
  worker: { hair: 'messy', beard: 'none', collar: 'shirt', brow: 'tired', mouth: 'halfsmile', prop: 'lanyard' },
  visitor: { hair: 'sidepart', beard: 'none', collar: 'white', brow: 'soft', mouth: 'grin', prop: 'nametag' },
  professor: { hair: 'grey', beard: 'none', collar: 'tweed', brow: 'stern', mouth: 'flat', prop: 'bowtie', glasses: true },
};

export function paintPortrait(ctx, id, mood, h) {
  const a = ARCH[id];
  if (!a) return;
  const L = h.look;
  const mixc = h.mix;
  const mat = (base, amt = 0.3) => ({ base, sh: mixc(base, '#1c1840', amt), hi: mixc(base, '#fff2d6', 0.34) });
  const skin = mat(L.skin, 0.2);
  const hairBase = a.hair === 'grey' ? '#aeb2be' : L.hair;
  const hair = mat(hairBase, 0.36);
  const top = mat(L.top, 0.3);
  const ink = '#17121c';
  const white = '#f6f2ee';

  const px = (x, y, c) => {
    if (x < 2 || y < 2 || x >= S - 2 || y >= S - 2) return;
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const box = (x, y, w, hh, c) => { for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < w; xx++) px(x + xx, y + yy, c); };
  // a flat ellipse: base colour, shade on the lower right, a lit rim on the upper left
  const blob = (cx, cy, rx, ry, m, o = {}) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        if (o.test && !o.test(x, y, nx, ny)) continue;
        let c = m.base;
        if (o.shade !== false && nx * 0.5 + ny * 0.85 > (o.shadeAt ?? 0.42)) c = m.sh;
        else if (o.rim !== false && d > 0.7 && nx * 0.6 + ny * 0.8 < -0.5) c = m.hi;
        px(x, y, c);
      }
    }
  };

  const cx = 23.5;
  const cy = 21;
  const R = 13.2;

  // ---- shoulders and collar ---------------------------------------------------------------------------------------------------
  const sy = 37;
  const shoulders = (m) => blob(cx, sy + 12, 22, 13, m, { test: (x, y) => y >= sy });
  if (a.collar === 'white' || a.collar === 'shirt') {
    const sh = mat(a.collar === 'white' ? '#f2f0ea' : '#d4dce0', 0.2);
    shoulders(sh);
    box(Math.round(cx - 1), sy, 3, 11, a.collar === 'white' ? '#2a2c38' : L.top);
    box(Math.round(cx - 4), sy, 2, 3, sh.hi);
    box(Math.round(cx + 3), sy, 2, 3, sh.sh);
  } else if (a.collar === 'tweed') {
    shoulders(top);
    for (let y = sy + 1; y < S; y += 3) for (let x = 7 + (y % 2); x < 42; x += 3) px(x, y, top.sh);
    box(Math.round(cx - 3), sy, 7, 11, '#f0ece4');
  } else if (a.collar === 'cardigan') {
    shoulders(top);
    box(Math.round(cx - 3), sy, 7, 11, '#efe6d6');
  } else if (a.collar === 'coat') {
    shoulders(top);
    for (let y = sy + 2; y < S; y += 4) box(8, y, 32, 1, top.sh);
    for (let x = 10; x < 40; x += 6) box(x, sy, 1, 11, mixc(L.top, '#d8b070', 0.5));
  } else {
    shoulders(top);
  }
  if (a.collar === 'hoodie') {
    blob(cx, sy + 1, 14, 5, top, { test: (x, y) => y <= sy + 3 });
    box(Math.round(cx - 4), sy + 3, 1, 8, '#e8e6ee');
    box(Math.round(cx + 4), sy + 3, 1, 8, '#e8e6ee');
  }
  if (a.prop === 'headphones') {
    blob(cx - 11, sy + 4, 4, 5, mat('#2a2c36', 0.3), { rim: false });
    blob(cx + 11, sy + 4, 4, 5, mat('#2a2c36', 0.3), { rim: false });
    box(Math.round(cx - 11), sy - 1, 23, 2, '#2a2c36');
  }
  if (a.prop === 'lanyard') {
    for (let k = 0; k < 8; k++) { px(cx + 9 - k, sy + k, '#4a8ad8'); px(cx + 8 - k, sy + k, '#3a6ab8'); }
    box(Math.round(cx - 1), sy + 8, 7, 5, '#f6f6f0');
    box(Math.round(cx), sy + 9, 4, 1, '#4a8ad8');
  }
  if (a.prop === 'nametag') { box(Math.round(cx + 7), sy + 6, 9, 6, '#ffffff'); box(Math.round(cx + 7), sy + 6, 9, 1, '#d84a4a'); box(Math.round(cx + 8), sy + 9, 6, 1, '#9aa0ae'); }
  if (a.prop === 'cross') { box(Math.round(cx), sy + 2, 1, 6, '#f0c860'); box(Math.round(cx - 2), sy + 4, 5, 1, '#f0c860'); }
  if (a.prop === 'bowtie') { box(Math.round(cx - 5), sy - 1, 11, 4, '#b83a3a'); box(Math.round(cx - 1), sy, 3, 2, '#7a2020'); }

  // ---- hair behind the head -----------------------------------------------------------------------------------------------------
  if (a.hair === 'long') blob(cx - 1, cy + 6, R + 1.5, 17, hair, { rim: false, test: (x, y, nx) => Math.abs(nx) > 0.78 && y < sy + 4 });

  // ---- head -------------------------------------------------------------------------------------------------------------------------
  blob(cx + 0.5, cy, R, R - 0.6, skin, { shadeAt: 0.7 });
  box(Math.round(cx - R + 1), Math.round(cy + 1), 3, 5, skin.sh); // ear

  // ---- hair / headwear on top -----------------------------------------------------------------------------------------------------
  const cap = (x, y, nx, ny) => ny < -0.36 || (nx < -0.25 && ny < 0.5) || (nx < -0.66 && ny < 0.82);
  if (a.hair === 'beanie') {
    const wool = mat('#566478', 0.3);
    blob(cx, cy - 4.5, R + 1.4, R - 1.6, wool, { test: (x, y, nx, ny) => ny < 0.3 });
    box(Math.round(cx - R - 1), Math.round(cy - 8), Math.round(R * 2 + 3), 4, '#7a8ca6');
    box(Math.round(cx - R - 1), Math.round(cy - 8), Math.round(R * 2 + 3), 1, '#9aaac4');
    box(Math.round(cx - 2), Math.round(cy - R - 3), 4, 4, wool.base);
  } else {
    blob(cx + 0.3, cy - 1.5, R + 1.2, R + 0.4, hair, { test: cap });
    if (a.hair === 'swoop') blob(cx + 4, cy - R + 1, 8, 3.5, hair, { test: (x, y) => y < cy - 7 });
    if (a.hair === 'messy') for (const [dx, dy] of [[-8, -13], [-3, -15], [3, -14], [8, -11]]) box(Math.round(cx + dx), Math.round(cy + dy), 3, 3, hair.base);
    if (a.hair === 'sidepart') for (let k = 0; k < 10; k++) px(cx - 3 + k * 0.6, cy - R + 1 + k * 0.5, hair.sh);
  }

  // ---- beard -----------------------------------------------------------------------------------------------------------------------
  if (a.beard === 'full') blob(cx + 1, cy + 8.5, R - 1, R - 8.8, hair, { rim: false, test: (x, y, nx, ny) => ny > 0.1 });
  else if (a.beard === 'stubble') blob(cx + 1, cy + 9, R - 2, R - 9, mat(L.skin, 0.4), { rim: false, shade: false, test: (x, y, nx, ny) => ny > 0.45 && (x + y) % 2 === 0 });

  // ---- face ------------------------------------------------------------------------------------------------------------------------
  const guarded = mood === 'guarded';
  const warm = mood === 'warm';
  const ey = cy - 1.5;
  const eyeH = guarded || a.brow === 'tired' ? 5 : 7;
  const eyeY = Math.round(ey + (7 - eyeH));
  for (const ex of [cx - 4.5, cx + 4.5]) {
    box(Math.round(ex), eyeY, 3, eyeH, ink);
    box(Math.round(ex), eyeY, 2, 2, white);
  }
  const browC = hair.sh;
  const by = ey - 3;
  if (a.brow === 'raised') { box(Math.round(cx - 5), by, 5, 1, browC); box(Math.round(cx + 4), by - 3, 5, 1, browC); }
  else if (a.brow === 'stern') { box(Math.round(cx - 5), by + 1, 5, 1, browC); box(Math.round(cx + 4), by, 5, 1, browC); box(Math.round(cx - 1), by + 2, 1, 1, browC); }
  else if (a.brow === 'sad') { box(Math.round(cx - 5), by, 3, 1, browC); box(Math.round(cx - 2), by + 1, 2, 1, browC); box(Math.round(cx + 4), by + 1, 2, 1, browC); box(Math.round(cx + 6), by, 3, 1, browC); }
  else if (a.brow === 'tired') {
    box(Math.round(cx - 5), by + 1, 5, 1, browC);
    box(Math.round(cx + 4), by + 1, 5, 1, browC);
    box(Math.round(cx - 5), eyeY + eyeH, 4, 1, skin.sh);
    box(Math.round(cx + 4), eyeY + eyeH, 4, 1, skin.sh);
  } else { box(Math.round(cx - 5), by, 5, 1, browC); box(Math.round(cx + 4), by, 5, 1, browC); }
  if (a.glasses) {
    const rim = '#24222c';
    for (const x0 of [cx - 7, cx + 2]) {
      box(Math.round(x0), eyeY - 2, 9, 1, rim);
      box(Math.round(x0), eyeY + eyeH + 1, 9, 1, rim);
      box(Math.round(x0), eyeY - 2, 1, eyeH + 4, rim);
      box(Math.round(x0 + 8), eyeY - 2, 1, eyeH + 4, rim);
    }
    box(Math.round(cx + 1), eyeY, 2, 1, rim);
  }
  // blush and mouth
  const blush = mixc(L.skin, '#e8706a', 0.5);
  box(Math.round(cx - 8), eyeY + eyeH + 1, 3, 2, blush);
  box(Math.round(cx + 8), eyeY + eyeH + 1, 3, 2, blush);
  const lip = mixc(L.skin, '#7a2c2c', 0.65);
  const my = eyeY + eyeH + 3;
  let mouth = a.mouth;
  if (warm) mouth = a.mouth === 'grin' ? 'grin' : 'smile';
  if (guarded) mouth = 'flat';
  if (mouth === 'grin') { box(Math.round(cx - 3), my, 8, 4, '#8a2e32'); box(Math.round(cx - 3), my, 8, 1, white); }
  else if (mouth === 'smile') { box(Math.round(cx - 2), my + 1, 6, 1, lip); box(Math.round(cx - 3), my, 1, 1, lip); box(Math.round(cx + 4), my, 1, 1, lip); }
  else if (mouth === 'smirk') { box(Math.round(cx - 2), my + 1, 5, 1, lip); box(Math.round(cx + 3), my, 2, 1, lip); }
  else if (mouth === 'halfsmile') { box(Math.round(cx - 2), my + 1, 6, 1, lip); box(Math.round(cx + 4), my, 1, 1, lip); }
  else box(Math.round(cx - 2), my + 1, 5, 1, lip);
}
