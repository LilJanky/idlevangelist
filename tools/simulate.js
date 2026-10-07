// Usage: node tools/simulate.js [profile|all] [seedCount]
import { runSimulation, PROFILES } from './harness.js';

const arg = process.argv[2] || 'all';
const seeds = Number(process.argv[3]) || 3;
const names = arg === 'all' ? Object.keys(PROFILES) : [arg];
const fmt = (n) => (n === undefined ? '    -' : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M`.padStart(6) : `${Math.round(n / 1e3)}K`.padStart(6));
const pct = (r, k) => `${Math.round((100 * r.shares[k]) / Math.max(1, r.totalSeeds))}%`.padStart(5);
const mins = (s) => (s === undefined ? '  -  ' : (s / 60).toFixed(1).padStart(5));

for (const name of names) {
  console.log(`\n=== ${PROFILES[name].name} (${name}) ===`);
  console.log('seed       done  bibl  team  study disc  funds clus1 clus2 clus3 1stWord 1stSF 1stTalk 1stConv boss1st att  talk conv  taps  SFs  WORDs avgReach best streak faith  s@10   s@15   s@20  %word %tap %talk');
  for (let i = 1; i <= seeds; i++) {
    const r = runSimulation(name, `balance-${i}`);
    const m = r.marks;
    console.log(
      `${String(r.seed).padEnd(10)}${String(r.completeMinutes ?? 'DNF').padStart(5)} ${mins(m.own_bibles)} ${mins(m.own_streetTeam)} ${mins(m.own_bibleStudy)} ${mins(m.own_discipleship)} ${mins(m.funds)} ${mins(m.cluster1)} ${mins(m.cluster2)} ${mins(m.cluster3)}  ${mins(m.firstWord)} ${mins(m.firstStandFirm)}  ${mins(m.firstSpecial)}  ${mins(m.firstConversion)} ${mins(m.bossFirstAttempt)} ${String(r.bossAttempts).padStart(3)} ${String(r.conversations).padStart(4)} ${String(r.conversions).padStart(4)} ${String(r.engagements).padStart(5)} ${String(r.standFirms).padStart(4)} ${String(r.wordUses).padStart(5)} ${String(r.avgWordTargets).padStart(6)} ${String(r.wordBest).padStart(4)} ${String(r.bestStreak).padStart(5)}  ${String(r.faithfulness ?? '-').padEnd(5)} ${fmt(r.seedsAt[10])} ${fmt(r.seedsAt[15])} ${fmt(r.seedsAt[20])} ${pct(r, 'word')} ${pct(r, 'taps')} ${pct(r, 'talk')}`,
    );
  }
}
console.log('\nColumns show minutes at which each milestone was first reached; taps = street engagements (including people reached by WORD),');
console.log('SFs = Stand Firm triggers, talk = conversations completed, WORDs = street WORD uses, avgReach = average people reached per WORD.');
