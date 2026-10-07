import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../src/systems/game.js';
import { createInitialState } from '../src/core/state.js';

// The UI is DOM code the unit tests do not execute, so a deleted helper would only show up in a browser. Check statically.
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('every method the UI calls on itself is defined', () => {
  const src = read('../src/ui/ui.js');
  const defs = new Set([...src.matchAll(/^ {2}(?:async )?(?:get |set )?(\w+)\(/gm)].map((m) => m[1]));
  const props = new Set([...src.matchAll(/this\.(\w+)\s*=/g)].map((m) => m[1]));
  const calls = new Set([...src.matchAll(/this\.(\w+)\(/g)].map((m) => m[1]));
  const missing = [...calls].filter((c) => !defs.has(c) && !props.has(c));
  assert.deepEqual(missing, []);
});

test('every method the UI calls on the game exists', () => {
  const game = new Game({ state: createInitialState(0, 'static') });
  const missing = new Set();
  for (const file of ['../src/ui/ui.js', '../src/main.js', '../src/debug/debug.js']) {
    for (const m of read(file).matchAll(/\bgame\.(\w+)\(/g)) if (typeof game[m[1]] !== 'function') missing.add(`${file}: game.${m[1]}()`);
  }
  assert.deepEqual([...missing], []);
});
