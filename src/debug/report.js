// Session report (debug mode and the balance harness): the same event log and summary used to analyze playthroughs, so a
// human playtest produces the same measurements as a bot run. Nothing is sent anywhere; it only lives in the page.
const KEEP = new Set([
  'wordProclaimed', 'standFirm', 'specialSpawn', 'specialEngaged', 'specialMissed', 'resolved', 'automated', 'learned', 'purchase', 'ministryMilestone',
  'crowdEvent', 'scriptureUnlocked', 'conversion', 'bossAvailable', 'bossStart', 'bossVictory', 'bossPassed', 'bossAutoRespond',
  'streakTier', 'discipleTrained', 'ministryUnlocked', 'clusterUnlocked', 'wordReady', 'bossWindow', 'chapter',
]);
const SALIENT = new Set([
  'wordProclaimed', 'specialEngaged', 'ministryMilestone', 'scriptureUnlocked', 'ministryUnlocked', 'clusterUnlocked', 'discipleTrained',
  'crowdEvent', 'resolved', 'conversion', 'bossStart', 'chapter',
]);

export function attachLogger(game) {
  const log = [];
  game.on((type, d) => {
    if (!KEEP.has(type)) return;
    const o = { t: +game.time.toFixed(1), type };
    if (type === 'wordProclaimed') Object.assign(o, { n: d.count, total: d.total });
    else if (type === 'resolved' || type === 'automated') Object.assign(o, { q: +d.reward.quality.toFixed(2), seeds: d.reward.seeds, conv: !!d.converted, who: d.enc.person, kind: d.enc.archetypeId });
    else if (type === 'purchase') Object.assign(o, { kind: d.kind, id: d.id, n: d.n });
    else if (type === 'standFirm') o.active = !!d.active;
    else if (type === 'crowdEvent') o.kind = d.kind;
    else if (type === 'chapter') o.name = d.name;
    log.push(o);
  });
  return log;
}

/** @returns a plain object: when things first happened, per-5-minute counts, quiet stretches, and where the session ended. */
export function summarize(log, game) {
  const gen = game.state.gen;
  const first = {};
  for (const e of log) if (first[e.type] === undefined) first[e.type] = Math.round(e.t);
  const blocks = {};
  for (const e of log) {
    const b = Math.floor(e.t / 300);
    const c = (blocks[b] = blocks[b] || { word: 0, standFirm: 0, talk: 0, missed: 0, events: 0, milestones: 0, unlocks: 0, purchases: 0 });
    if (e.type === 'wordProclaimed') c.word++;
    else if (e.type === 'standFirm' && e.active) c.standFirm++;
    else if (e.type === 'resolved') c.talk++;
    else if (e.type === 'specialMissed') c.missed++;
    else if (e.type === 'crowdEvent') c.events++;
    else if (e.type === 'ministryMilestone') c.milestones++;
    else if (['scriptureUnlocked', 'ministryUnlocked', 'clusterUnlocked', 'discipleTrained'].includes(e.type)) c.unlocks++;
    else if (e.type === 'purchase') c.purchases++;
  }
  const times = log.filter((e) => SALIENT.has(e.type)).map((e) => e.t);
  const quiet = [];
  for (let i = 0; i < times.length - 1; i++) if (times[i + 1] - times[i] > 45) quiet.push({ from: Math.round(times[i]), seconds: Math.round(times[i + 1] - times[i]) });
  const now = game.time;
  if (times.length && now - times[times.length - 1] > 45) quiet.push({ from: Math.round(times[times.length - 1]), seconds: Math.round(now - times[times.length - 1]), open: true });
  const words = log.filter((e) => e.type === 'wordProclaimed');
  const talks = log.filter((e) => e.type === 'resolved');
  return {
    seconds: Math.round(now),
    phase: game.state.phase,
    first,
    blocks: Object.entries(blocks).map(([k, v]) => ({ minute: k * 5, ...v })),
    quiet,
    word: { uses: words.length, avgReach: words.length ? +(words.reduce((a, e) => a + e.n, 0) / words.length).toFixed(1) : 0, reachFiveOrMore: words.filter((e) => e.n >= 5).length },
    talks: { count: talks.length, automated: log.filter((e) => e.type === 'automated').length, learned: log.filter((e) => e.type === 'learned').length, avgQuality: talks.length ? +(talks.reduce((a, e) => a + e.q, 0) / talks.length).toFixed(2) : 0, conversions: log.filter((e) => (e.type === 'resolved' || e.type === 'automated') && e.conv).length, details: talks.map((e) => `${Math.round(e.t)}s ${e.kind} ${e.who} q=${e.q}${e.conv ? ' CONVERTED' : ''}`) },
    boss: { attempts: gen.bossState.attempts, status: gen.bossState.status, buzz: gen.bossState.buzz || 0, autoPicks: log.filter((e) => e.type === 'bossAutoRespond').length },
    seeds: Math.round(gen.totalSeeds),
  };
}

export function formatReport(sum) {
  const m = (s) => (s === undefined ? '-' : `${(s / 60).toFixed(1)}m`);
  const lines = [
    `SESSION REPORT  ${m(sum.seconds)} played  phase=${sum.phase}  Seeds planted ${sum.seeds}`,
    `first: WORD ready ${m(sum.first.wordReady)}, WORD used ${m(sum.first.wordProclaimed)}, Stand Firm ${m(sum.first.standFirm)}, person to talk ${m(sum.first.specialEngaged)}, boss ${m(sum.first.bossStart)}`,
    `WORD: ${sum.word.uses} uses, average reach ${sum.word.avgReach}, ${sum.word.reachFiveOrMore} reached 5+`,
    `Conversations: ${sum.talks.count}, average quality ${sum.talks.avgQuality}, learned ${sum.talks.learned}, carried by a disciple ${sum.talks.automated}, conversions ${sum.talks.conversions}`,
    `Professor: ${sum.boss.attempts} attempt(s), status ${sum.boss.status}, lecture buzz ${sum.boss.buzz}, auto-picked lines ${sum.boss.autoPicks}`,
    'Per 5 minutes (word / stand firm / talks / missed / events / milestones / unlocks):',
    ...sum.blocks.map((b) => `  ${String(b.minute).padStart(3)}m  ${b.word} / ${b.standFirm} / ${b.talk} / ${b.missed} / ${b.events} / ${b.milestones} / ${b.unlocks}`),
    sum.quiet.length ? `Quiet stretches (>45 s with nothing notable): ${sum.quiet.map((q) => `${m(q.from)} for ${q.seconds}s${q.open ? ' (now)' : ''}`).join(', ')}` : 'No quiet stretch longer than 45 s.',
  ];
  return lines.join('\n');
}
