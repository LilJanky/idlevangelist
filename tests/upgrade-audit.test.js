import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { UPGRADE_TEXT } from '../src/data/content.js';
import { Renderer } from '../src/render/renderer.js';

const pct = (v) => `${Math.round(v * 100)}%`;

test('every upgrade has text, and the percentages it quotes are the percentages it gives', () => {
  const simple = ['passivePct', 'costDiscount', 'wordCharge', 'wordPct', 'cadencePct', 'talkPct', 'rewardPct', 'discipleLinePct', 'critChance', 'wordCrowd', 'proclaimPct', 'contextualPct', 'answerCdPct', 'windowBonus'];
  for (const [id, def] of Object.entries(BALANCE.upgrades)) {
    const text = UPGRADE_TEXT[id];
    assert.ok(text && text.name && text.desc, `${id} needs a name and description`);
    for (const key of simple) {
      const v = def.effects[key];
      if (v === undefined) continue;
      assert.ok(text.desc.includes(pct(v)), `${id}: "${text.desc}" should quote ${pct(v)} for ${key}`);
    }
    for (const [line, v] of Object.entries(def.effects.lineMult || {})) {
      assert.ok(text.desc.includes(pct(v)), `${id}: ${line} +${pct(v)} missing from "${text.desc}"`);
    }
    for (const syn of def.effects.synergy || []) {
      assert.ok(text.desc.includes(`${+(syn.per * 100).toFixed(1)}%`), `${id}: synergy ${syn.per} missing from "${text.desc}"`);
    }
  }
});

test('every Provisions purchase is a thing you can see on the street', () => {
  const r = Object.create(Renderer.prototype);
  r.H = 140;
  r.W = 130;
  for (const [id, def] of Object.entries(BALANCE.upgrades)) {
    if (def.currency !== 'funds') continue;
    const box = r.supplyBox(id);
    assert.ok(box && box.w > 0 && box.h > 0, `${id} has no place on the street`);
  }
});
