// Gameplay-loop audit: how often does something satisfying happen, and where are the dead zones?
// Idle-game rules of thumb checked here: a purchase every 10-40 s early, never a long silent wall, an income spike
// every few minutes, and a new decision/reveal roughly every 2 minutes.
// Usage: node tools/loop-audit.js [profile] [seed]
import { createBot } from './harness.js';
import { BALANCE } from '../src/config/balance.js';
import { computeModifiers } from '../src/core/economy.js';

const profile = process.argv[2] || 'hybrid';
const seed = process.argv[3] || 'audit-1';
const build = process.argv[4];
const bot = createBot(profile, seed, { profileOverride: build ? { build } : {} });
const { game } = bot;
const beats = [];
const note = (t, kind, detail) => beats.push({ t, kind, detail });
game.on((type, d) => {
  const t = game.time;
  if (type === 'purchase') note(t, d.kind === 'upgrade' ? 'upgrade' : d.kind === 'disciple' ? 'disciple' : 'ministry', d.id);
  else if (type === 'wordProclaimed') note(t, 'word', d.count);
  else if (type === 'resolved') note(t, 'talk');
  else if (type === 'standFirm') d.active && note(t, 'standFirm');
  else if (type === 'crowdEvent') note(t, 'event', d.kind);
  else if (type === 'ministryMilestone') note(t, 'milestone', d.id);
  else if (type === 'clusterUnlocked') note(t, 'cluster', d.cluster ?? d.n);
  else if (type === 'ministryUnlocked') note(t, 'unlock', d.id);
  else if (type === 'scriptureUnlocked') note(t, 'scripture', d.id);
  else if (type === 'streakTier') note(t, 'streak', d.mult);
});

// Wrap purchases so each upgrade is valued from the state it was bought in (before the effect is applied).
const valued = [];
const buyUpgrade = game.buyUpgrade.bind(game);
game.buyUpgrade = (id) => {
  const def = BALANCE.upgrades[id];
  const preview = game.upgradePreview(id);
  const sps = Math.max(1, game.baseSeedsPerSec);
  const st = game.state.gen.encounterStats;
  const moments = st.tapSeeds + st.wordSeeds + st.talkSeeds;
  const total = Math.max(1, game.state.gen.totalSeeds);
  const share = { moments: moments / total, tap: st.tapSeeds / total, word: st.wordSeeds / total, talk: st.talkSeeds / total, passive: Math.max(0, 1 - moments / total) };
  const ok = buyUpgrade(id);
  if (ok) valued.push({ id, t: game.time, def, preview, sps, share });
  return ok;
};

const perMin = [];
let lastSps = 0;
let t = 0;
let nextMin = 60;
for (; t < 60 * 60 && game.state.phase === 'gen1'; t += 0.1) {
  bot.step(t, 0.1);
  if (t >= nextMin) {
    nextMin += 60;
    const sps = game.seedsPerSec;
    perMin.push({ min: Math.round(t / 60), sps, growth: lastSps ? sps / lastSps : 0, seeds: game.state.gen.totalSeeds });
    lastSps = sps;
  }
}

const spend = beats.filter((b) => ['ministry', 'upgrade', 'disciple'].includes(b.kind));
const gaps = [];
for (let i = 1; i < spend.length; i++) gaps.push({ at: spend[i - 1].t, gap: spend[i].t - spend[i - 1].t });
gaps.sort((a, b) => b.gap - a.gap);
const meaningful = beats.filter((b) => !['streak', 'ministry'].includes(b.kind) || b.kind === 'ministry');
const fmt = (x) => (x / 60).toFixed(1);
console.log(`Profile ${profile}, seed ${seed}, finished at ${fmt(t)} min`);
console.log('\nmin  sps       growth  purch  upg  WORD  talk  SF  evt  milestones/unlocks');
for (let m = 1; m <= Math.ceil(t / 60); m++) {
  const inMin = (k) => beats.filter((b) => b.t >= (m - 1) * 60 && b.t < m * 60 && (Array.isArray(k) ? k.includes(b.kind) : b.kind === k)).length;
  const row = perMin.find((p) => p.min === m);
  console.log(
    `${String(m).padStart(3)}  ${row ? row.sps.toFixed(0).padStart(8) : '       -'}  ${row ? row.growth.toFixed(2).padStart(5) : '    -'}  ${String(inMin(['ministry', 'disciple'])).padStart(5)}  ${String(inMin('upgrade')).padStart(3)}  ${String(inMin('word')).padStart(4)}  ${String(inMin('talk')).padStart(4)}  ${String(inMin('standFirm')).padStart(2)}  ${String(inMin('event')).padStart(3)}  ${inMin(['milestone', 'cluster', 'unlock', 'scripture'])}`,
  );
}
console.log('\nLongest gaps between purchases (start min, seconds):');
for (const g of gaps.slice(0, 8)) console.log(`  min ${fmt(g.at)}  ${g.gap.toFixed(0)}s`);
const median = gaps.length ? gaps.map((g) => g.gap).sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0;
console.log(`Purchases: ${spend.length}, median gap ${median.toFixed(0)}s`);
// Beat gaps: any satisfying thing (purchase, WORD, talk, event, milestone, unlock)
const all = meaningful.concat(beats.filter((b) => b.kind === 'word' || b.kind === 'talk' || b.kind === 'event' || b.kind === 'milestone')).sort((a, b) => a.t - b.t);
let worst = { gap: 0, at: 0 };
for (let i = 1; i < all.length; i++) if (all[i].t - all[i - 1].t > worst.gap) worst = { gap: all[i].t - all[i - 1].t, at: all[i - 1].t };
console.log(`Longest stretch with no beat at all: ${worst.gap.toFixed(0)}s at min ${fmt(worst.at)}`);
const ups = beats.filter((b) => b.kind === 'upgrade');
console.log('\nUpgrade timeline: ' + ups.map((u) => `${fmt(u.t)}:${u.detail}`).join('  '));

// Estimated worth of each upgrade as a share of total income, using how the run actually earned its Seeds.
const worth = (v) => {
  const e = v.def.effects;
  const sh = v.share;
  let pct = (v.preview.delta / v.sps) * sh.passive;
  pct += (e.rewardPct || 0) * sh.moments + (e.wordPct || 0) * sh.word + (e.talkPct || 0) * sh.talk;
  pct += (e.wordCrowd || 0) * 3 * sh.word + (e.wordCharge || 0) * 0.7 * sh.word + (e.cadencePct || 0) * sh.tap + (e.streakBonus || 0) * 0.2 * sh.tap;
  pct += (e.eventSize || 0) * 0.02 * sh.tap + (e.eventLife || 0) * 0.01 * sh.tap + (e.oppLifeAdd || 0) * 0.04 * sh.tap;
  return pct;
};
console.log('\nUpgrade value at purchase (estimate of % of total income; payback = cost / (value x income)); readiness = Professor readiness ratio before -> after');
console.log('min   upgrade                cost      value   payback   readiness');
for (const v of valued) {
  const val = worth(v);
  const pay = val > 0.002 ? v.def.cost / (val * (game.state.gen.totalSeeds / Math.max(1, v.t))) : null;
  const incomeNow = v.sps / Math.max(0.01, v.share.passive || 1);
  const payback = val > 0.002 && v.def.currency === 'seeds' ? v.def.cost / (val * incomeNow) : null;
  const r = v.preview.readiness ? `${v.preview.readiness.before.toFixed(2)} -> ${v.preview.readiness.after.toFixed(2)}` : '';
  console.log(`${fmt(v.t).padStart(4)}  ${v.id.padEnd(22)} ${String(v.def.cost).padStart(8)}${v.def.currency === 'funds' ? 'F' : ' '}  ${(val * 100).toFixed(1).padStart(5)}%  ${payback ? (payback.toFixed(0) + 's').padStart(7) : '      -'}   ${r}`);
}
