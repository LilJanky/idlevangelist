import test from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS, ENCOUNTER_ORDER } from '../src/data/content.js';
import { PROFESSOR } from '../src/render/sprites.js';
import {
  PORTRAIT_IDS, PORTRAIT_MOODS, PORTRAIT_SIZE, getPortraitPalette, getPortraitSpec, makePortraitCanvas,
} from '../src/render/portraits.js';

test('portrait definitions cover every encounter archetype plus the professor', () => {
  assert.deepEqual(PORTRAIT_IDS, [...ENCOUNTER_ORDER, 'professor']);
  for (const id of ENCOUNTER_ORDER) {
    const spec = getPortraitSpec(id);
    assert.ok(spec, `${id} portrait exists`);
    assert.equal(spec.look.kit, ENCOUNTERS[id].look.kit);
    assert.equal(spec.look.skin, ENCOUNTERS[id].look.skin);
    assert.equal(spec.look.hair, ENCOUNTERS[id].look.hair);
    assert.equal(spec.look.top, ENCOUNTERS[id].look.top);
  }
  const professor = getPortraitSpec('professor');
  assert.ok(professor, 'professor portrait exists');
  assert.equal(professor.look.kit, PROFESSOR.kit);
  assert.equal(professor.look.hair, PROFESSOR.hair);
});

test('portrait palettes are distinct and use four-step ramps', () => {
  const signatures = new Set();
  for (const id of PORTRAIT_IDS) {
    const pal = getPortraitPalette(id);
    assert.ok(pal, `${id} palette exists`);
    for (const key of ['skin', 'hair', 'top', 'bottom']) {
      assert.ok(pal[key].hi && pal[key].base && pal[key].lo && pal[key].dk, `${id} ${key} uses a full ramp`);
      assert.notEqual(pal[key].hi, pal[key].dk, `${id} ${key} highlight and outline differ`);
    }
    signatures.add(`${pal.hair.base}|${pal.top.base}|${pal.bottom.base}|${pal.bgLight}`);
  }
  assert.equal(signatures.size, PORTRAIT_IDS.length, 'each portrait has a distinct palette signature');
});

test('portrait helper is safe when no canvas implementation is available', () => {
  const canvas = makePortraitCanvas('skeptic', { mood: 'warm' });
  if (typeof OffscreenCanvas === 'undefined' && typeof document === 'undefined') {
    assert.equal(canvas, null);
  } else {
    assert.ok(canvas);
    assert.equal(canvas.width, PORTRAIT_SIZE);
    assert.equal(canvas.height, PORTRAIT_SIZE);
  }
});

test('portrait helper accepts every supported mood keyword', () => {
  for (const mood of PORTRAIT_MOODS) {
    const canvas = makePortraitCanvas('visitor', { mood });
    if (canvas) {
      assert.equal(canvas.width, PORTRAIT_SIZE);
      assert.equal(canvas.height, PORTRAIT_SIZE);
    }
  }
});
