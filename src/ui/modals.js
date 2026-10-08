// Modal content builders. Each returns a DOM node; the UI controller decides when to show them.
import { h } from './dom.js';
import { formatNumber, formatDuration } from '../core/format.js';
import { INTRO, GOSPEL, GEN_COMPLETE, ENCOUNTERS, personOutcome } from '../data/content.js';
import { BALANCE } from '../config/balance.js';

const verseBlock = (v) => h('div', { class: 'verse' }, `“${v.text.replace(/^“|”$/g, '')}”`, h('span', { text: `${v.ref} · ESV` }));

export function introModal({ onStart }) {
  return h(
    'div',
    { class: 'modal intro', role: 'dialog', 'aria-label': 'Welcome' },
    h('div', { class: 'emblem', 'aria-hidden': 'true' }),
    h('h2', { text: INTRO.title }),
    ...INTRO.lines.map((l) => h('p', { text: l })),
    verseBlock(INTRO.verse),
    h('p', { text: 'Tap people to proclaim the gospel. Plant seeds, grow the ministry, and be faithful. The results belong to God.' }),
    h('div', { class: 'btns' }, h('button', { class: 'btn gold', type: 'button', text: INTRO.start, on: { click: onStart } })),
  );
}

export function gospelModal({ onClose }) {
  return h(
    'div',
    { class: 'modal', role: 'dialog', 'aria-label': GOSPEL.title },
    h('h2', { text: GOSPEL.title }),
    ...GOSPEL.points.map((p) => h('p', { text: `• ${p}` })),
    h('div', { class: 'verse' }, '“For by grace you have been saved through faith. And this is not your own doing; it is the gift of God.”', h('span', { text: 'Ephesians 2:8 · ESV' })),
    h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', text: 'Close', 'data-escape': '', on: { click: onClose } })),
  );
}

export function offlineModal(gains, { onClose }) {
  return h(
    'div',
    { class: 'modal', role: 'dialog', 'aria-label': 'Welcome back' },
    h('h2', { text: 'Welcome back' }),
    h('p', { text: `While you were away (${formatDuration(gains.seconds)}), your ministry kept sowing quietly.` }),
    h(
      'dl',
      { class: 'stat-grid' },
      h('dt', { text: 'Seeds planted' }),
      h('dd', { text: `+${formatNumber(gains.seeds)}` }),
      gains.funds > 0 ? h('dt', { text: 'Provisions for supplies' }) : null,
      gains.funds > 0 ? h('dd', { text: `+${formatNumber(gains.funds)}` }) : null,
    ),
    gains.lines?.length ? h('ul', { class: 'flavor' }, ...gains.lines.map((l) => h('li', { text: l }))) : null,
    gains.wordReady ? h('p', { class: 'waiting', text: 'The Word is ready to proclaim.' }) : null,
    gains.waiting ? h('p', { class: 'waiting', text: 'Someone is waiting on the street to talk with you.' }) : null,
    h('p', { class: 'note', text: 'Conversations and special opportunities wait for you in person. God is working whether or not anyone is watching.' }),
    h('div', { class: 'btns' }, h('button', { class: 'btn gold', type: 'button', text: 'Continue', 'data-escape': '', on: { click: onClose } })),
  );
}

const PART_LABEL = {
  base: 'Generation completed',
  ministries: 'All five ministries established',
  disciples: 'Disciples trained to teach others',
  boss: 'Public exchange completed',
  active: 'Faithful, active witness',
  conversions: 'Visible fruit God granted along the way (capped bonus)',
};

export function statsList(stats) {
  const row = (k, v) => [h('dt', { text: k }), h('dd', { text: v })];
  return h(
    'dl',
    { class: 'stat-grid' },
    ...row('Seeds planted', formatNumber(stats.seedsPlanted)),
    ...row('Scriptures proclaimed', String(stats.scripturesProclaimed)),
    ...row('People engaged', String(stats.peopleEngaged)),
    ...row('Special opportunities', String(stats.specialOpportunities)),
    ...row('Disciples trained', String(stats.disciplesTrained)),
    ...row('Conversions witnessed', String(stats.conversionsWitnessed)),
    ...row('Ministries established', `${stats.ministriesEstablished} / 5`),
    ...row('Time on the street', formatDuration(stats.secondsPlayed)),
  );
}

export function generationCompleteModal(summary, { onBegin, reviewOnly = false, onClose, awarded = null }) {
  const total = summary.breakdown.total;
  const parts = summary.breakdown.parts.filter((p) => p.earned || p.id !== 'conversions');
  return h(
    'div',
    { class: 'modal', role: 'dialog', 'aria-label': GEN_COMPLETE.title },
    h('h2', { text: GEN_COMPLETE.title }),
    h('p', { text: GEN_COMPLETE.blurb }),
    h('div', { class: 'verse' }, GEN_COMPLETE.verse.text, h('span', { text: `${GEN_COMPLETE.verse.ref} · ESV` })),
    h('h3', { text: 'This generation' }),
    statsList(summary.stats),
    summary.people?.length
      ? h('div', { class: 'people' },
        h('h3', { text: 'People you met' }),
        ...summary.people.map((p) => h('div', { class: `person${p.converted ? ' converted' : ''}` },
          h('b', { text: p.name }), ` \u00b7 ${ENCOUNTERS[p.archetype].name}`, h('span', { text: personOutcome(p) }))))
      : null,
    h(
      'div',
      { class: 'faith-reveal' },
      h('div', { class: 'stat-label', text: 'Faithfulness' }),
      h('div', { class: 'big', text: reviewOnly && awarded !== null ? String(awarded) : String(total) }),
      h(
        'div',
        { class: 'breakdown' },
        ...parts.flatMap((p) => [
          h('span', { class: p.earned ? '' : 'off', text: `${p.earned ? '✓' : '·'} ${PART_LABEL[p.id]}` }),
          h('span', { class: p.earned ? '' : 'off', text: p.earned ? `+${p.value}` : '—' }),
        ]),
      ),
    ),
    h('p', { class: 'note', text: GEN_COMPLETE.faithfulnessNote }),
    reviewOnly
      ? h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', text: 'Close', 'data-escape': '', on: { click: onClose } }))
      : h('div', { class: 'btns' }, h('button', { class: 'btn gold', type: 'button', text: 'Begin Next Generation', on: { click: onBegin } })),
  );
}

export function confirmModal({ title, text, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  return h(
    'div',
    { class: 'modal', role: 'alertdialog', 'aria-label': title },
    h('h2', { text: title }),
    h('p', { text }),
    h(
      'div',
      { class: 'btns' },
      h('button', { class: 'btn ghost', type: 'button', text: 'Cancel', 'data-escape': '', on: { click: onCancel } }),
      h('button', { class: 'btn rose', type: 'button', text: confirmLabel, on: { click: onConfirm } }),
    ),
  );
}

export function settingsModal(ctx) {
  const s = ctx.state.settings;
  const toggle = (label, key) => {
    const btn = h('button', { class: `toggle ${s[key] ? 'on' : ''}`, type: 'button', 'aria-pressed': String(!!s[key]), text: s[key] ? 'On' : 'Off' });
    btn.addEventListener('click', () => {
      s[key] = !s[key];
      btn.classList.toggle('on', s[key]);
      btn.textContent = s[key] ? 'On' : 'Off';
      btn.setAttribute('aria-pressed', String(!!s[key]));
      ctx.apply();
    });
    return h('div', { class: 'setting' }, h('span', { text: label }), btn);
  };
  const slider = (label, key) => {
    const input = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s[key]), 'aria-label': label });
    input.addEventListener('input', () => {
      s[key] = Number(input.value);
      ctx.apply();
    });
    return h('div', { class: 'setting' }, h('span', { text: label }), input);
  };
  const motion = h('div', { class: 'setting' }, h('span', { text: 'Reduced motion' }));
  for (const [val, label] of [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']]) {
    const b = h('button', { class: `toggle ${s.reducedMotion === val ? 'on' : ''}`, type: 'button', text: label });
    b.addEventListener('click', () => {
      s.reducedMotion = val;
      for (const sib of motion.querySelectorAll('button')) sib.classList.remove('on');
      b.classList.add('on');
      ctx.apply();
    });
    motion.append(b);
  }
  const nodes = [
    h('h2', { text: 'Settings' }),
    toggle('Mute all', 'muted'),
    toggle('Music & ambience', 'music'),
    slider('Music volume', 'musicVolume'),
    toggle('Sound effects', 'sfx'),
    slider('SFX volume', 'sfxVolume'),
    motion,
    toggle('Gentle hints', 'hints'),
    h(
      'div',
      { class: 'btns' },
      h('button', { class: 'btn', type: 'button', text: 'Save now', on: { click: ctx.saveNow } }),
      h('button', { class: 'btn ghost', type: 'button', text: 'The Good News', on: { click: ctx.showGospel } }),
    ),
    h('div', { class: 'btns' }, h('button', { class: 'btn rose', type: 'button', text: 'Reset all progress…', on: { click: ctx.reset } })),
  ];
  if (ctx.debug) {
    nodes.push(
      h('div', { class: 'debug-box' }, h('h3', { text: 'Debug tools (this save is marked as debug)' }), ctx.debug.node),
    );
  }
  nodes.push(
    h('div', { class: 'version', text: `IdleVangelist · Generation I build · save v${BALANCE.saveVersion}`, on: { click: ctx.versionTap } }),
    h('div', { class: 'btns' }, h('button', { class: 'btn gold', type: 'button', text: 'Close', 'data-escape': '', on: { click: ctx.close } })),
  );
  return h('div', { class: 'modal', role: 'dialog', 'aria-label': 'Settings' }, ...nodes);
}
