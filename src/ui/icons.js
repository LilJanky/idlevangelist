function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.className = 'ui-icon';
  return canvas;
}

function fill(ctx, scale, ox, oy, color, pixels) {
  ctx.fillStyle = color;
  for (const [x, y, w = 1, h = 1] of pixels) ctx.fillRect(ox + x * scale, oy + y * scale, w * scale, h * scale);
}

export function hudIcon(kind, size = 14) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const art = 7;
  const scale = Math.max(1, Math.floor(size / art));
  const ox = Math.floor((size - art * scale) / 2);
  const oy = Math.floor((size - art * scale) / 2);
  ctx.imageSmoothingEnabled = false;

  if (kind === 'seed') {
    fill(ctx, scale, ox, oy, '#0a0c12', [
      [1, 1, 2, 2], [3, 0, 2, 2], [0, 3, 3, 2], [3, 2, 3, 3], [2, 5, 2, 1],
    ]);
    fill(ctx, scale, ox, oy, '#a8e07a', [
      [2, 0, 1, 1], [1, 1, 2, 2], [0, 3, 1, 1], [3, 0, 2, 2], [5, 2, 1, 1], [4, 1, 1, 1],
    ]);
    fill(ctx, scale, ox, oy, '#6e8d43', [
      [1, 5, 3, 1], [2, 4, 2, 1], [3, 3, 1, 1],
    ]);
    fill(ctx, scale, ox, oy, '#f1d27a', [
      [4, 4, 2, 2], [3, 5, 1, 1], [5, 3, 1, 1],
    ]);
    fill(ctx, scale, ox, oy, '#c89b43', [
      [4, 5, 2, 1], [5, 4, 1, 1],
    ]);
  }

  return canvas;
}
