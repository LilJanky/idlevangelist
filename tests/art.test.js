import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer } from '../src/render/renderer.js';

test('integer pixel scaling: every art pixel is the same whole number of screen pixels, on any phone width', () => {
  for (const width of [320, 360, 375, 390, 412, 414, 430]) {
    const r = Object.create(Renderer.prototype);
    r.W = 1;
    r.canvas = { getBoundingClientRect: () => ({ width, height: 700 }), width: 0, height: 0 };
    r.ctx = {};
    r.skylineCache = new Map();
    r.buildings = [];
    r.resize();
    const step = width / r.W;
    assert.ok(r.W >= 110 && r.W <= 165, `${width}: ${r.W} art pixels wide`);
    assert.ok(Math.abs(step - Math.round(step)) < 0.03 * Math.round(step), `${width}: each art pixel is ${step} screen pixels`);
    assert.equal(r.canvas.width, r.W);
    assert.ok(r.buildings.length > 4, 'the skyline is rebuilt for the new width');
  }
});

test('the pixel font ships with the game and numbers use it only at whole multiples of its 7px grid', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.ok(/@font-face\s*\{\s*font-family:\s*'IV Pixel'/.test(css), 'font is embedded, no network needed');
  const art = css.slice(css.indexOf('Art direction: the interface'));
  assert.ok(art.length > 500);
  const sizes = [...art.matchAll(/font-size:\s*(\d+)px/g)].map((m) => +m[1]);
  assert.ok(sizes.length > 10);
  for (const px of sizes) assert.equal(px % 7, 0, `${px}px is not a multiple of 7`);
});

test('the ministry\'s own people stand on the far side of the street, out of the way of the people you tap', () => {
  const r = Object.create(Renderer.prototype);
  r.W = 130;
  r.H = 180;
  const slots = r.helperSlots(6, 4, 5);
  const lanes = r.laneYs(r.groundTop);
  for (const s of [...slots.workers, ...slots.believers, ...slots.converts]) {
    assert.ok(s.y < lanes[0] - 6, `helper at ${s.y} is behind the nearest lane (${lanes[0]})`);
    assert.ok(s.x >= 40 && s.x <= r.W, `helper x ${s.x} is on the street`);
  }
  assert.ok(lanes[0] > r.groundTop + 20 && lanes[2] < r.feetY - 20, 'the tapping lanes keep clear of the shopfronts and of the player');
});
