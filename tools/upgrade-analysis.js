// Upgrade analysis: how much does each upgrade actually matter in real (bot) play?
// For every upgrade: run the same seeds with and without it and compare Seeds planted at minutes 10, 15, 20, and the
// time of the first Next Generation. Also reports when each is bought, and what it costs relative to income then.
// Usage: node tools/upgrade-analysis.js [profile] [seeds] [minutes]
import { runSimulation } from './harness.js';
import { BALANCE } from '../src/config/balance.js';
import { Game } from '../src/systems/game.js';
import { createBot } from './harness.js';

const profile = process.argv[2] || 'hybrid';
const seedCount = Number(process.argv[3]) || 3;
const minutes = Number(process.argv[4]) || 27;
const seeds = Array.from({ length: seedCount }, (_, i) => `balance-${i + 1}`);

// When does the baseline bot buy each upgrade, and how does that compare to its income?
const timing = {};
for (const s of seeds) {
  const bot = createBot(profile, s);
  const bought = {};
  bot.game.on((type, d) => {
    if (type === 'purchase' && d.kind === 'upgrade' && !bought[d.id]) {
      const g = bot.game;
      bought[d.id] = { t: g.time, sps: g.baseSeedsPerSec, cost: BALANCE.upgrades[d.id].cost, currency: BALANCE.upgrades[d.id].currency };
    }
  });
  for (let t = 0; t < minutes * 60; t += 0.1) bot.step(t, 0.1);
  for (const [id, v] of Object.entries(bought)) (timing[id] = timing[id] || []).push(v);
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const base = seeds.map((s) => runSimulation(profile, s, { maxMinutes: minutes }));
const baseAt = (m) => mean(base.map((r) => r.seedsAt[m] || r.totalSeeds));
console.log(`profile=${profile} seeds=${seedCount} horizon=${minutes}m   baseline Seeds@10=${(baseAt(10) / 1e3).toFixed(0)}K @15=${(baseAt(15) / 1e6).toFixed(2)}M @20=${(baseAt(20) / 1e6).toFixed(2)}M  finish=${mean(base.map((r) => r.completeMinutes || minutes)).toFixed(1)}m`);
console.log('upgrade                 cluster  cost        bought@  cost(s of income)  value when removed: Seeds@15 / @20 / finish');
for (const id of Object.keys(BALANCE.upgrades)) {
  const def = BALANCE.upgrades[id];
  const t = timing[id];
  const runs = seeds.map((s) => runSimulation(profile, s, { maxMinutes: minutes, profileOverride: { banned: [id] } }));
  const at = (m) => mean(runs.map((r) => r.seedsAt[m] || r.totalSeeds));
  const d15 = (baseAt(15) - at(15)) / Math.max(1, at(15));
  const d20 = (baseAt(20) - at(20)) / Math.max(1, at(20));
  const when = t ? `${(mean(t.map((x) => x.t)) / 60).toFixed(1)}m`.padStart(6) : '  never';
  const payback = t && def.currency === 'seeds' ? Math.round(mean(t.map((x) => x.cost / Math.max(1, x.sps)))) : '-';
  const fin = mean(runs.map((r) => r.completeMinutes || minutes)) - mean(base.map((r) => r.completeMinutes || minutes));
  console.log(`${id.padEnd(22)}  c${def.cluster}  ${String(def.cost).padStart(9)} ${def.currency === 'funds' ? 'F' : 'S'}  ${when}   ${String(payback).padStart(9)}s   ${(d15 * 100).toFixed(1).padStart(6)}%  ${(d20 * 100).toFixed(1).padStart(6)}%  ${fin >= 0 ? '+' : ''}${fin.toFixed(1)}m${def.exclusiveWith ? '   (fork)' : ''}`);
}

// Fork balance: the same player walking the active path or the passive path (and the boss gate keeps finish times honest).
console.log('\nBuilds (same bot, different fork choices):');
for (const build of ['active', 'passive']) {
  const runs = seeds.map((sd) => runSimulation(profile, sd, { maxMinutes: minutes + 10, profileOverride: { build } }));
  const at = (m) => mean(runs.map((r) => r.seedsAt[m] || r.totalSeeds));
  console.log(`  ${build.padEnd(8)} Seeds@15=${(at(15) / 1e6).toFixed(2)}M  @20=${(at(20) / 1e6).toFixed(2)}M  finish=${mean(runs.map((r) => r.completeMinutes || minutes + 10)).toFixed(1)}m  talks=${mean(runs.map((r) => r.conversations)).toFixed(0)}  WORDs=${mean(runs.map((r) => r.wordUses)).toFixed(0)}`);
}
