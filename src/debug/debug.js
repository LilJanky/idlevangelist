// Developer tools, available only with ?debug=1 (separate save slot; the save is marked as debug).
import { h } from '../ui/dom.js';
import { makeSpecialEncounter, masteryKey } from '../systems/encounter.js';
import { ENCOUNTER_ORDER, ENCOUNTERS } from '../data/content.js';
import { completeGeneration } from '../systems/prestige.js';
import { conversionChance, rollConversion } from '../systems/conversion.js';
import { tierIndex } from '../core/economy.js';
import { BALANCE } from '../config/balance.js';
import { attachLogger, summarize, formatReport } from './report.js';

export function createDebugTools(game, hooks) {
  const state = game.state;
  const gen = () => state.gen;
  const tools = [];
  const sessionLog = attachLogger(game);
  const add = (label, fn) => tools.push({ label, fn });

  add('+1K Seeds', () => game.addSeeds(1000));
  add('+10K Seeds', () => game.addSeeds(10000));
  add('+1M Seeds', () => game.addSeeds(1e6));
  add('+1K Provisions', () => {
    gen().fundsUnlocked = true;
    game.addFunds(1000);
  });
  add('Passive ×10 (cycle)', (ui) => {
    game.debugMult = game.debugMult >= 100 ? 1 : game.debugMult * 10;
    ui.toast(`Passive multiplier ×${game.debugMult}`);
  });
  add('Time warp +10 min (gates)', () => {
    gen().genSeconds += 600;
    game.checkUnlocks();
  });
  add('Fill the Word', () => {
    if (!gen().scripturesUnlocked.length) gen().scripturesUnlocked.push('romans1_20');
    gen().street.word = BALANCE.street.word.max;
  });
  add('Crowd: open everyone', () => {
    for (const p of game.crowd.peds) {
      if (!p.done) {
        p.opp = true;
        p.oppLeft = 8;
      }
    }
  });
  for (const kind of BALANCE.crowdEvents.kinds) {
    add(`Event: ${kind}`, () => {
      if (state.phase === 'gen1' && !game.boss) game.startCrowdEvent(kind);
    });
  }
  add('Spawn person (walks in)', () => {
    if (state.phase !== 'gen1' || game.boss || game.enc) return;
    game.spawnSpecial(BALANCE.specials.lifetime + game.mods.specialWindow);
  });
  add('Learn all conversations', () => {
    if (!gen().mastery) gen().mastery = {};
    for (const id of ENCOUNTER_ORDER) ENCOUNTERS[id].variants.forEach((v, i) => { gen().mastery[masteryKey(id, i)] = true; });
  });
  for (const id of ENCOUNTER_ORDER) {
    add(`Talk: ${id}`, () => {
      if (state.phase !== 'gen1' || game.boss || game.enc) return;
      if (!gen().scripturesUnlocked.length) gen().scripturesUnlocked.push('romans1_20');
      game.enc = makeSpecialEncounter(state, id, game.balance);
      game.emit('encounterStart', { enc: game.enc });
    });
  }
  add('Force conversion visual', () => {
    if (state.phase !== 'gen1' || game.boss) return;
    // Presentation only: no outcome logic, counters, or conversion state are touched.
    const enc = makeSpecialEncounter(state, 'broken', game.balance);
    enc.resolved = true;
    enc.rewarded = true;
    enc.state = 'conversion';
    enc.step = 'done';
    enc.t = 0;
    enc.convert = { name: 'Debug Visitor' };
    enc.reward = { seeds: 0, funds: 0, quality: 1 };
    game.enc = enc;
    game.emit('conversion', { name: enc.convert.name, enc, debug: true });
  });
  add('Unlock boss', () => {
    const b = gen().bossState;
    b.status = 'available';
    b.foreshadowStage = 3;
  });
  const phase = (n) => () => {
    if (state.phase !== 'gen1') return;
    if (!game.boss) {
      gen().bossState.status = 'available';
      game.challengeBoss();
    }
    game.startBossPhase(n);
  };
  add('Boss phase 1', phase(0));
  add('Boss phase 2', phase(1));
  add('Boss phase 3', phase(2));
  add('Complete boss', () => {
    if (state.phase !== 'gen1') return;
    if (!game.boss) {
      gen().bossState.status = 'available';
      game.challengeBoss();
    }
    game.bossVictory();
  });
  add('Fail boss', () => game.boss && game.failBoss());
  add('+12 Faithfulness', () => {
    state.currencies.faithfulness += 12;
  });
  add('Trigger Gen Complete', () => {
    if (completeGeneration(state, game.balance)) game.emit('generationComplete', { summary: state.prestige.summary });
  });
  add('Trigger Next Generation', (ui) => {
    if (state.phase === 'gen1') completeGeneration(state, game.balance);
    if (state.phase === 'complete') {
      ui.closeModal();
      ui.beginNextGeneration();
    }
  });
  add('Offline +1h', (ui) => ui.showOffline(game.creditOffline(3600)));
  add('Offline +8h', (ui) => ui.showOffline(game.creditOffline(8 * 3600)));
  add('Sim +60s', () => game.advance(60, 0.25));
  add('Clear / reset save', (ui) => ui.confirmReset());
  add('Inspect state / RNG', null);
  add('Session report', null);
  add('Copy report JSON', null);

  return function build(ui) {
    const out = h('div', { class: 'debug-out' });
    const grid = h('div', { class: 'debug-grid' });
    for (const t of tools) {
      const btn = h('button', { class: 'btn small', type: 'button', text: t.label });
      btn.addEventListener('click', () => {
        state.debugUsed = true;
        if (t.label === 'Session report') {
          out.textContent = formatReport(summarize(sessionLog, game));
          return;
        }
        if (t.label === 'Copy report JSON') {
          const json = JSON.stringify({ summary: summarize(sessionLog, game), log: sessionLog });
          if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).then(() => (out.textContent = 'Report JSON copied to the clipboard.'), () => (out.textContent = json));
          else out.textContent = json;
          return;
        }
        if (!t.fn) {
          out.textContent = inspect(game);
          return;
        }
        t.fn(ui);
        hooks.saveNow();
        out.textContent = `Ran: ${t.label}`;
      });
      grid.append(btn);
    }
    return h('div', {}, grid, out);
  };
}

function inspect(game) {
  const s = game.state;
  const gen = s.gen;
  const rolls = [];
  for (let i = 0; i < 6; i++) {
    const ctx = { kind: 'special', index: gen.encounterIndex + i, tier: tierIndex(gen.totalSeeds) };
    const r = rollConversion(s, ctx);
    rolls.push(`#${ctx.index}: p=${conversionChance(s, ctx).toFixed(4)} roll=${r.roll?.toFixed(4) ?? '-'} ${r.converted ? 'CONVERT' : ''}`);
  }
  return [
    `seed: ${s.rngSeed}`,
    `phase: ${s.phase}  gen: ${s.generation}  tier: ${tierIndex(gen.totalSeeds)}`,
    `encounterIndex: ${gen.encounterIndex}  specialIndex: ${gen.specialIndex}`,
    `converts: ${gen.conversionState.converts.map((c) => c.name).join(', ') || 'none'}  contacts: ${gen.conversionState.contacts}`,
    `genSeconds: ${gen.genSeconds.toFixed(1)}  seeds/s: ${game.seedsPerSec.toFixed(2)}`,
    `word: ${gen.street.word.toFixed(0)}/${BALANCE.street.word.max} uses=${gen.encounterStats.wordUses}`,
    `boss: ${gen.bossState.status} attempts=${gen.bossState.attempts} prep=${game.bossPreparation().toFixed(2)}`,
    'next providence rolls:',
    ...rolls,
  ].join('\n');
}
