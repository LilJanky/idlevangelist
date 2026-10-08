// UI controller: DOM HUD, panels, overlays, input, and the bridge between simulation events and feedback.
import { BALANCE } from '../config/balance.js';
import { formatNumber, formatCost, formatHave, formatRate, formatDuration } from '../core/format.js';
import {
  MINISTRIES, MINISTRY_ORDER, UPGRADE_TEXT, UPGRADE_TAG_LABEL, SCRIPTURES, SCRIPTURE_ORDER, DISCIPLES,
  TIMOTHY_TEXT, BOSS, CONVERSION_TEXT, HINTS, NEXT_GENERATION, GEN2_PREVIEW, PRESTIGE_TEXT, PRESTIGE_BRANCHES, BRAND,
  MILESTONE_TEXT, STAND_FIRM, ENCOUNTER_UI, CROWD_EVENTS, CONVERT_LINES, OFFLINE_FLAVOR, COACH,
} from '../data/content.js';
import { readinessLabel } from '../systems/bossAnalysis.js';
import { situationCount } from '../systems/encounter.js';
import { currentGoal } from '../core/goals.js';
import { computeModifiers } from '../core/economy.js';
import { drawPortrait } from '../render/portraits.js';
import { h, clear, icon, setText, setHidden } from './dom.js';
import { hudIcon } from './icons.js';
import {
  introModal, gospelModal, offlineModal, generationCompleteModal, confirmModal, settingsModal,
} from './modals.js';

const FLOATER_POOL = 24;
const MINISTRY_COLORS = { tracts: '#e6d9b0', bibles: '#c9a24a', streetTeam: '#e0913a', bibleStudy: '#6a8ac0', discipleship: '#7fd0bc' };

/** A big pixel-font number with its unit in small body text, so long labels never crowd the pixel font. */
function setRate(el, num, unit) {
  const key = `${num}|${unit}`;
  if (el.dataset.rate === key && el.firstChild?.tagName === 'B') return;
  el.dataset.rate = key;
  el.textContent = '';
  el.append(h('b', { text: num }), h('small', { text: ` ${unit}` }));
}

export class UI {
  constructor({ game, renderer, audio, hooks, debugFactory = null }) {
    this.game = game;
    this.renderer = renderer;
    this.audio = audio;
    this.hooks = hooks;
    this.debugFactory = debugFactory;
    this.state = game.state;
    this.tab = 'street';
    this.buyMode = 1;
    this.lastTap = { x: 0, y: 0, t: -10 };
    this.floaterIndex = 0;
    this.cdTotal = {};
    this.etaEls = [];
    this.toastQueue = [];
    this.ownedOpen = false;
    this.momentKey = null;
    this.infoMoment = null;
    this.montage = null;
    this.sigs = {};
    this.refreshTimer = 0;
    this.modalOpen = false;
    this.versionTaps = 0;
    this.trayButtons = {};
    this.wordBurstAt = 0;
    this.wordBurstIdx = 0;
    this.lastWordHint = 0;
    this.versePopTimer = null;
  }

  // ---------------------------------------------------------------- setup
  init() {
    const $ = (id) => document.getElementById(id);
    this.els = {
      scene: $('scene'), card: $('encounter-card'), name: $('enc-name'), label: $('enc-label'), statement: $('enc-statement'),
      portrait: $('enc-portrait'), portraitFrame: $('enc-portrait-frame'),
      resist: $('enc-resist'), resistGhost: $('enc-resist-ghost'), bossBanner: $('boss-banner'), resistNum: $('enc-resist-num'), timerWrap: $('enc-timer-wrap'), timer: $('enc-timer'),
      seedIcon: $('seed-icon'),
      hud: $('street-hud'), shStreak: $('sh-streak'), shMult: $('sh-mult'), shCount: $('sh-count'), shFuse: $('sh-fuse'), shPips: $('sh-pips'), shMomentum: $('sh-momentum'), shMomLabel: $('sh-mom-label'), shFill: $('sh-fill'), resistWrap: $('enc-resist-wrap'),
      wordSlam: $('word-slam'), versePop: $('verse-pop'), floaters: $('floaters'), toasts: $('toasts'), moment: $('moment'), tapHint: $('tap-hint'),
      seeds: $('v-seeds'), sps: $('v-sps'), funds: $('v-funds'), fps: $('v-fps'), statFunds: $('stat-funds'), statFaith: $('stat-faith'), faith: $('v-faith'),
      panel: $('panel'), overlay: $('overlay'), montage: $('montage'),
      btnWord: $('btn-word'), btnAnswer: $('btn-answer'), wordSub: $('word-sub'), answerSub: $('answer-sub'),
      wordCd: $('word-cd'), answerCd: $('answer-cd'), tray: $('word-tray'), bossRow: $('boss-row'),
      streetTop: $('street-top-row'), status: $('street-status'), strip: $('ministry-strip'), preview: $('preview-card'), actionRow: $('action-row'), choiceBox: $('choice-box'),
    };
    this.tabs = { street: $('tab-street'), ministry: $('tab-ministry'), upgrades: $('tab-upgrades'), legacy: $('tab-legacy') };
    this.navButtons = [...document.querySelectorAll('.nav-btn')];
    this.els.seedIcon.append(hudIcon('seed', 14));
    for (const ico of document.querySelectorAll('.nav-ico')) ico.append(icon(ico.dataset.ico, 24));
    for (let i = 0; i < FLOATER_POOL; i++) this.els.floaters.append(h('div', { class: 'floater', style: 'display:none' }));

    for (const btn of this.navButtons) btn.addEventListener('click', () => this.showTab(btn.dataset.tab));
    $('btn-settings').addEventListener('click', () => this.openSettings());
    this.bindActions();
    this.bindScene();
    this.bindGame();
    this.bindKeys();
    this.buildMinistryTab();
    document.getElementById('app').dataset.tab = 'street';
    this.applySettings();
    this.syncPhase();

    if (!this.state.introSeen && this.state.phase === 'gen1') this.showIntro();
    else if (this.state.phase === 'complete') this.showGenerationComplete();
    else if (this.state.phase === 'gen2preview') this.showTab('legacy');
  }

  bindActions() {
    const { btnWord, btnAnswer, tray } = this.els;
    btnWord.addEventListener('click', () => this.onWord());
    btnAnswer.addEventListener('click', () => this.doAnswer());
    document.addEventListener('pointerdown', (e) => {
      // in the Professor's exchange the passages stay up (they are the main controls); elsewhere a tap outside dismisses them
      if (this.wasPressing) return;
      if (!tray.classList.contains('hidden') && !tray.contains(e.target) && !btnWord.contains(e.target)) this.closeTray();
    });
  }

  bindScene() {
    const scene = this.els.scene;
    scene.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#moment')) return;
      this.audio.unlock();
      const rect = scene.getBoundingClientRect();
      this.lastTap = { x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() };
      const seedId = this.renderer.hitSeed(e.clientX, e.clientY);
      const id = seedId !== null ? seedId : this.renderer.hitSpecial(e.clientX, e.clientY, BALANCE.specials.hitRadiusPx);
      if (id !== null) {
        if (this.game.tapSpecial(id, { seed: seedId !== null })) {
          this.audio.sfx('special');
          this.closeTray();
        }
        return;
      }
      this.onStreetTap(e);
    });
    this.els.moment.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      this.skipMoment();
    });
  }

  bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalOpen) {
        // only dismiss dialogs that have a harmless way out (Settings, the Good News); the intro and results need a choice
        const back = this.els.overlay.querySelector('[data-escape]');
        if (back) back.click();
        return;
      }
      if (this.modalOpen || e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      const talking = !this.els.choiceBox.classList.contains('hidden');
      if (talking && /^[1-9]$/.test(e.key)) {
        this.pickByNumber(Number(e.key) - 1);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.doEngageNearest();
      } else if (e.key === 'w' || e.key === 'W') this.onWord();
      else if (e.key === 'a' || e.key === 'A') this.doAnswer();
      else if (e.key === '1') this.showTab('street');
      else if (e.key === '2') this.showTab('ministry');
      else if (e.key === '3') this.showTab('upgrades');
    });
  }

  navHidden(tab) {
    return this.navButtons.find((b) => b.dataset.tab === tab)?.classList.contains('hidden');
  }

  // ---------------------------------------------------------------- settings
  applySettings() {
    const s = this.state.settings;
    this.audio.setSettings({ music: s.music, sfx: s.sfx, musicVolume: s.musicVolume, sfxVolume: s.sfxVolume, muted: s.muted });
    const reduce = s.reducedMotion === 'on' || (s.reducedMotion === 'auto' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    document.body.classList.toggle('reduce-motion', !!reduce);
    this.renderer.reducedMotion = !!reduce;
    this.hooks.saveSoon();
  }

  openSettings() {
    this.audio.unlock();
    const debug = this.debugFactory ? { node: this.debugFactory(this) } : null;
    this.openModal(
      settingsModal({
        state: this.state,
        apply: () => this.applySettings(),
        saveNow: () => {
          this.hooks.saveNow();
          this.toast('Progress saved.');
        },
        showGospel: () => this.openModal(gospelModal({ onClose: () => this.openSettings() })),
        reset: () => this.confirmReset(),
        close: () => this.closeModal(),
        versionTap: () => {
          this.versionTaps += 1;
          if (this.versionTaps >= 7 && !this.debugFactory) window.location.search = '?debug=1';
        },
        debug,
      }),
    );
  }

  confirmReset() {
    this.openModal(
      confirmModal({
        title: 'Reset all progress?',
        text: 'This permanently erases your ministry, upgrades, and Faithfulness on this device. This cannot be undone.',
        confirmLabel: 'Erase everything',
        onCancel: () => this.openSettings(),
        onConfirm: () => this.hooks.reset(),
      }),
    );
  }

  // ---------------------------------------------------------------- modals
  openModal(node) {
    if (!this.modalOpen) this.lastFocus = document.activeElement;
    clear(this.els.overlay);
    if (!node.getAttribute('role')) node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    const title = node.querySelector('h2');
    if (title) {
      title.id = 'modal-title';
      node.setAttribute('aria-labelledby', 'modal-title');
    }
    this.els.overlay.append(node);
    setHidden(this.els.overlay, false);
    this.modalOpen = true;
    // keyboard users land on the first action, and Tab stays inside the dialog
    (node.querySelector('.btn.gold, .btn, button') || node).focus?.({ preventScroll: true });
    node.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...node.querySelectorAll('button:not(:disabled), input, a[href]')].filter((x) => x.offsetParent);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  closeModal() {
    setHidden(this.els.overlay, true);
    clear(this.els.overlay);
    this.modalOpen = false;
    if (this.lastFocus?.isConnected) this.lastFocus.focus?.({ preventScroll: true });
    this.lastFocus = null;
  }

  showIntro() {
    this.openModal(
      introModal({
        onStart: () => {
          this.audio.unlock();
          this.state.introSeen = true;
          this.closeModal();
          this.hooks.saveSoon();
        },
      }),
    );
  }

  showOffline(gains) {
    const own = this.state.gen.ministries;
    const lines = Object.keys(OFFLINE_FLAVOR).filter((id) => own[id]?.owned > 0).slice(-3).map((id) => OFFLINE_FLAVOR[id]);
    for (const c of this.state.gen.conversionState.converts.slice(0, 1)) lines.push(`${c.name} kept sharing what God had done.`);
    this.openModal(offlineModal({ ...gains, lines }, { onClose: () => this.closeModal() }));
  }

  showGenerationComplete() {
    const summary = this.state.prestige.summary;
    if (!summary) return;
    this.openModal(generationCompleteModal(summary, { onBegin: () => this.beginNextGeneration() }));
  }

  reviewGenerationOne() {
    const summary = this.state.prestige.summary;
    if (!summary) return;
    this.openModal(
      generationCompleteModal(summary, { reviewOnly: true, awarded: this.state.prestige.awardedFor['1'] ?? summary.breakdown.total, onClose: () => this.closeModal() }),
    );
  }

  // ---------------------------------------------------------------- tabs
  showTab(name) {
    if (this.navHidden(name)) return;
    this.tab = name;
    document.getElementById('app').dataset.tab = name;
    for (const [key, node] of Object.entries(this.tabs)) setHidden(node, key !== name);
    for (const btn of this.navButtons) btn.classList.toggle('active', btn.dataset.tab === name);
    this.els.panel.scrollTop = 0;
    this.closeTray();
    this.sigs = {};
    this.refreshPanels(true);
  }

  syncPhase() {
    const phase = this.state.phase;
    const preview = phase === 'gen2preview';
    const set = (tab, hidden) => setHidden(this.navButtons.find((b) => b.dataset.tab === tab), hidden);
    set('ministry', preview);
    set('upgrades', preview);
    set('legacy', phase === 'gen1');
    if (preview && (this.tab === 'ministry' || this.tab === 'upgrades')) this.showTab('legacy');
    setHidden(this.els.streetTop, preview);
    setHidden(this.els.actionRow, preview);
    setHidden(this.els.status, preview);
    if (preview) setHidden(this.els.strip, true);
    setHidden(this.els.preview, !preview);
    this.lastPhase = phase;
  }

  // ---------------------------------------------------------------- input actions
  /** A tap on the street: engage the nearest person with an open moment. Nothing is lost by tapping elsewhere. */
  onStreetTap(e) {
    if (this.modalOpen || this.montage) return;
    const game = this.game;
    if (game.streetPaused && !game.inBoss) {
      if (game.enc && !this.pausedHintShown) {
        this.pausedHintShown = true;
        this.toast('Finish the conversation first \u2014 the street will be here when you are done.', '', 3200);
      }
      return;
    }
    const id = this.renderer.hitPed(e.clientX, e.clientY, BALANCE.street.hitRadiusPx);
    if (id === null) {
      game.missTap();
      return;
    }
    game.engageCrowd(id);
  }

  doEngageNearest() {
    this.audio.unlock();
    if (this.modalOpen || this.montage) return;
    this.game.engageNearest();
  }

  /** Conversation lines appear quickly, as if spoken (instantly with reduced motion). */
  typeText(el, text) {
    const reduce = document.body.classList.contains('reduce-motion');
    this.typing = reduce ? null : { el, text, start: performance.now() };
    setText(el, reduce ? text : '');
  }

  stepTyping(now) {
    const t = this.typing;
    if (!t) return;
    const n = Math.min(t.text.length, Math.floor(((now - t.start) / 1000) * 80));
    if (t.el.textContent.length !== n) t.el.textContent = t.text.slice(0, n);
    if (n >= t.text.length) this.typing = null;
  }

  /** The Scripture itself appears on screen whenever it is proclaimed or applied. */
  showVerse(id, ms = 3600) {
    const v = SCRIPTURES[id];
    if (!v) return;
    const pop = this.els.versePop;
    pop.querySelector('.vp-text').textContent = `\u201c${v.text.replace(/^\u201c|\u201d$/g, '')}\u201d`;
    pop.querySelector('.vp-ref').textContent = `${v.ref} \u00b7 ${v.name}`;
    pop.classList.remove('hidden');
    pop.style.animation = 'none';
    void pop.offsetWidth;
    pop.style.animation = '';
    clearTimeout(this.versePopTimer);
    this.versePopTimer = setTimeout(() => pop.classList.add('hidden'), ms);
  }

  hideVerse() {
    clearTimeout(this.versePopTimer);
    this.els.versePop.classList.add('hidden');
  }

  pulse(el, cls = 'pulse') {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  /**
   * WORD means proclaim Scripture. On the street it reaches everyone currently open to a moment; in the Professor's
   * exchange it opens the passages to apply. (In a conversation, passages are chosen in the conversation panel.)
   */
  onWord() {
    this.audio.unlock();
    if (this.modalOpen || this.montage) return;
    const game = this.game;
    const unlocked = this.state.gen.scripturesUnlocked;
    if (unlocked.length === 0) return;
    const enc = game.activeEncounter;
    if (enc?.kind === 'boss') {
      if (enc.step !== 'press') return;
      if (unlocked.length === 1) {
        this.castVerse(unlocked[0]);
        return;
      }
      // the passages are the main controls here: WORD always brings them up (it never hides them)
      setHidden(this.els.tray, false);
      this.sigs.tray = null;
      this.positionTray();
      this.refreshTray();
      return;
    }
    if (!game.streetOpen) return;
    if (!game.wordReady) {
      const now = performance.now();
      if (now - this.lastWordHint > 5000) {
        this.lastWordHint = now;
        this.toast(HINTS.word, '', 3600);
      }
      this.pulse(this.els.btnWord, 'pulse');
      return;
    }
    game.proclaimStreet();
  }

  castVerse(id) {
    const r = this.game.castWord(id);
    if (r) {
      this.cdTotal[id] = this.game.cool.words[id];
      this.renderer.onProclaim(false);
      this.audio.sfx('word');
    }
  }

  /** The Professor's exchange: press the line you chose. */
  doAnswer() {
    this.audio.unlock();
    const r = this.game.castAnswer();
    if (r) {
      this.cdTotal.answer = this.game.cool.answer;
      this.renderer.onProclaim(false);
      this.audio.sfx('word');
    }
  }

  chooseResponse(id) {
    this.audio.unlock();
    this.game.respond(id);
  }

  chooseVerse(id) {
    this.audio.unlock();
    this.game.sayLine(id);
  }

  chooseRebuttal(id) {
    this.audio.unlock();
    this.game.rebut(id);
  }

  pickByNumber(i) {
    const enc = this.game.activeEncounter;
    if (!enc) return;
    if (enc.step === 'respond') {
      const c = enc.choices[i];
      if (c) this.chooseResponse(c.id);
    } else if (enc.step === 'rebut') {
      const c = enc.rebuttalChoices?.[i];
      if (c) this.chooseRebuttal(c.id);
    } else if (enc.step === 'apply') {
      const line = enc.lines?.[i];
      if (line) this.chooseVerse(line.id);
    }
  }

  positionTray() {
    const app = document.getElementById('app').getBoundingClientRect();
    const row = this.els.actionRow.getBoundingClientRect();
    this.els.tray.style.bottom = `${Math.max(4, app.bottom - row.top + 6)}px`;
  }

  closeTray() {
    setHidden(this.els.tray, true);
  }

  // ---------------------------------------------------------------- feedback helpers
  /** Messages over the street: at most two at a time (they cover the people you are tapping), the rest wait their turn or lapse. */
  toast(text, cls = '', ms = 4200) {
    if (this.toastQueue.some((t) => t.text === text) || [...this.els.toasts.children].some((c) => c.textContent === text)) return;
    this.toastQueue.push({ text, cls, ms, at: performance.now() });
    // a backlog never grows stale: keep the most recent few, preferring the gold ones
    while (this.toastQueue.length > 3) {
      const drop = this.toastQueue.findIndex((t) => !t.cls.includes('gold'));
      this.toastQueue.splice(drop >= 0 ? drop : 0, 1);
    }
    this.pumpToasts();
  }

  pumpToasts() {
    const box = this.els.toasts;
    while (box.children.length < 2 && this.toastQueue.length) {
      const t = this.toastQueue.shift();
      if (performance.now() - t.at > 6000) continue; // it has lapsed
      const el = h('div', { class: `toast ${t.cls}`, text: t.text });
      box.append(el);
      setTimeout(() => {
        el.remove();
        this.pumpToasts();
      }, t.ms);
    }
  }

  clearToasts() {
    this.toastQueue = [];
    clear(this.els.toasts);
  }

  /** The big number: when WORD lands, the multiplier and the total slam onto the street and count up. */
  showWordSlam(d) {
    const el = this.els.wordSlam;
    if (!el) return;
    const mult = d.crowdMult > 1.04 ? `\u00d7${d.crowdMult.toFixed(1)}` : '';
    el.className = `t${d.tier}${mult ? ' has-mult' : ''}`;
    el.style.opacity = '1';
    this.els.scene.classList.add('has-slam');
    setText(el.querySelector('.ws-tier'), d.tierName ? d.tierName : '');
    setText(el.querySelector('.ws-mult'), mult);
    setText(el.querySelector('.ws-crest'), d.crest ? 'AT ITS FULLEST' : '');
    setText(el.querySelector('.ws-sub'), d.bystanders > 0 ? `${d.bystanders} more heard in passing` : '');
    const totalEl = el.querySelector('.ws-total');
    // restart the entrance
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    const reduce = document.body.classList.contains('reduce-motion');
    const dur = reduce ? 0 : 650;
    const start = performance.now();
    const token = (this.slamToken = (this.slamToken || 0) + 1);
    const step = (now) => {
      if (token !== this.slamToken) return;
      const k = dur ? Math.min(1, (now - start) / dur) : 1;
      const eased = 1 - (1 - k) * (1 - k);
      setText(totalEl, `+${formatNumber(Math.round(d.total * eased))}`);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setHidden(el, false);
    clearTimeout(this.slamTimer);
    this.slamTimer = setTimeout(() => {
      el.style.opacity = '0';
      this.slamTimer = setTimeout(() => {
        setHidden(el, true);
        this.els.scene.classList.remove('has-slam');
      }, 450);
    }, 2000 + d.tier * 350);
  }

  /** A title card over the street for the big beats of the Professor's exchange. */
  showBossBanner(kicker, title, cls = '', ms = 2200) {
    const el = this.els.bossBanner;
    if (!el) return;
    el.className = cls;
    setText(el.querySelector('.bb-kicker'), kicker);
    setText(el.querySelector('.bb-title'), title);
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setHidden(el, false);
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => setHidden(el, true), ms);
  }

  /** A passage or point lands on the Professor: the number scales with how much of his argument it carried, and the whole scene answers. */
  bossHitFeedback(d) {
    const enc = this.game.boss?.enc;
    if (!enc) return;
    const frac = d.amount / Math.max(1, enc.resistanceMax);
    const size = d.crit || frac >= 0.04 ? 28 : frac >= 0.02 ? 21 : 14;
    const pos = this.floaterPos(d.source);
    const label = d.grade === 'direct' ? 'DIRECT' : d.grade === 'contextual' ? 'FITTING' : '';
    this.floater(`−${formatNumber(d.amount)}${d.crit ? '!' : ''}`, `bosshit ${d.crit ? 'crit' : ''} g-${d.grade || 'x'}`, pos.x, pos.y, `${size}px`);
    if (label) this.floater(label, 'bosshit-tag', pos.x, pos.y - 30);
    const level = d.crit ? 4 : d.grade === 'direct' ? 3 : d.grade === 'contextual' ? 2 : 1;
    this.renderer.bossHit(level, d.grade === 'direct' ? '#fff4c8' : '#ffd98a');
    this.pulse(this.els.resistWrap, 'hit');
    this.pulse(this.els.portraitFrame, 'flinch');
    this.audio.sfx(level >= 3 ? 'unlock' : 'word');
  }

  floater(text, cls, x, y, size = '') {
    const pool = this.els.floaters.children;
    const el = pool[this.floaterIndex++ % pool.length];
    el.style.display = 'block';
    el.className = `floater ${cls}`;
    // the pixel font only looks right at whole multiples of its 7px grid, and wide numbers must fit narrow phones
    const cap = (this.renderer.cssW || 390) < 360 ? 21 : 28;
    el.style.fontSize = size ? `${Math.min(cap, Math.max(14, Math.round(parseFloat(size) / 7) * 7))}px` : '';
    el.textContent = text;
    const half = Math.max(52, el.offsetWidth / 2 + 6);
    el.style.left = `${Math.max(half, Math.min((this.renderer.cssW || 390) - half, x))}px`;
    el.style.top = `${y}px`;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    return el;
  }

  floaterPos(source) {
    const anchor = this.renderer.focusAnchor();
    const jitter = (this.floaterIndex % 5 - 2) * 9;
    if (source === 'proclaim' && performance.now() - this.lastTap.t < 160) return { x: this.lastTap.x + jitter * 0.4, y: this.lastTap.y - 18 };
    if (source === 'word' || source === 'answer') return { x: anchor.x, y: anchor.y - 12 };
    return { x: anchor.x + jitter, y: anchor.y + 6 + (this.floaterIndex % 3) * 8 };
  }

  showInfoMoment(moment, ms = 6000) {
    this.infoMoment = { ...moment, until: performance.now() + ms };
  }

  skipMoment() {
    const game = this.game;
    const key = this.momentKey || '';
    if (key.startsWith('boss-intro')) game.boss.t = Math.max(game.boss.t, BALANCE.boss.introSeconds);
    else if (key.startsWith('boss-trans')) game.boss.t = Math.max(game.boss.t, BALANCE.boss.transitionSeconds);
    else if (key.startsWith('conv') || key.startsWith('special')) game.skipPresentation();
    else if (key.startsWith('boss-passed')) game.endBossSession();
    else if (key.startsWith('info')) this.infoMoment = null;
  }

  // ---------------------------------------------------------------- game events
  bindGame() {
    const g = this.game;
    g.on((type, d) => {
      switch (type) {
        case 'impact': {
          // The Professor's exchange: argument weight answered.
          if (this.game.boss?.enc && (d.source === 'word' || d.source === 'answer')) {
            this.bossHitFeedback(d);
            if (d.crit && !this.critSeen) {
              this.critSeen = true;
              this.toast('Critical Proclamation!', 'gold', 2000);
            }
            break;
          }
          const pos = this.floaterPos(d.source);
          this.floater(d.crit ? `${formatNumber(d.amount)}!` : formatNumber(d.amount), `${d.crit ? 'crit' : ''} ${d.source === 'word' || d.source === 'answer' ? 'word' : ''}`, pos.x, pos.y);
          if (d.crit && !this.critSeen) {
            this.critSeen = true;
            this.toast('Critical Proclamation!', 'gold', 2000);
          }
          break;
        }
        case 'engage': {
          const a = this.renderer.pedAnchor(d.pedId) || this.renderer.focusAnchor();
          if (d.word) {
            // WORD reaches many people at once: payouts rise from each of them, just slightly staggered.
            const now = performance.now();
            if (now - this.wordBurstAt > 400) this.wordBurstIdx = 0;
            this.wordBurstAt = now;
            const delay = Math.min(450, this.wordBurstIdx++ * 40);
            const text = `+${formatNumber(d.seeds)}`;
            setTimeout(() => {
              this.floater(text, d.bystander ? 'engage wordhit bystander' : `engage wordhit${d.crowdTier >= 3 ? ' big' : ''}`, a.x, a.y);
              if (!d.bystander) this.renderer.impactAtCss(d.crowdTier >= 2 ? 1 : 0, a.x, a.y - 8, '#ffe9a8');
            }, delay);
            break;
          }
          // successive taps grow: the numbers swell as the run builds
          const size = `${(d.crit ? 24 : 14) + (d.crit ? 8 : 9) * Math.min(1, d.streak / 40)}px`;
          this.floater(d.crit ? `CRIT  +${formatNumber(d.seeds)}` : `+${formatNumber(d.seeds)}`, `engage ${d.crit ? 'crit' : ''}`, a.x, a.y, size);
          if (d.crit) {
            this.renderer.impactAtCss(2, a.x, a.y - 10, '#ffd98a');
            this.pulse(this.els.shStreak, 'bump');
          } else this.renderer.impactAtCss(0, a.x, a.y - 6, '#fff4c8');
          this.pulse(this.els.seeds);
          this.pulse(this.els.btnWord, 'tick');
          this.renderer.onProclaim(d.crit);
          this.audio.sfx(d.crit ? 'crit' : 'proclaim', Math.min(1, d.streak / 14));
          if (d.chain) break;
          if (d.window) this.audio.sfx('reward');
          break;
        }
        case 'chain': {
          // Every few successive taps: the run builds, and the number says so.
          const a = this.renderer.pedAnchor(d.pedId) || this.renderer.focusAnchor();
          this.floater(`CHAIN ${d.count}  +${formatNumber(d.bonus)}`, `chain${d.count >= 25 ? ' big' : ''}`, a.x, a.y - 22);
          this.pulse(this.els.shStreak, 'bump');
          this.audio.sfx('chain', d.count / 5);
          this.renderer.impactAtCss(2, a.x, a.y - 20, '#9fe3ff');
          break;
        }
        case 'wordProclaimed': {
          const v = SCRIPTURES[d.verseId];
          this.renderer.onWord(d.count, d.tier);
          if (d.tier >= 2) this.renderer.impactCenter(Math.min(4, d.tier + 1), '#ffe9a8');
          this.pulse(this.els.seeds);
          this.audio.sfx('wordBurst', d.count);
          this.audio.sfx('slam', d.tier);
          this.showWordSlam(d);
          const lead = d.tierName ? `${d.tierName.toUpperCase()} \u2014 ` : '';
          this.toast(`${lead}${v.ref} \u00b7 reached ${d.count} ${d.count === 1 ? 'person' : 'people'}${d.bystanders ? ` (+${d.bystanders} nearby)` : ''}`, 'gold', 3600);
          this.showVerse(d.verseId);
          break;
        }
        case 'chapter':
          this.audio.sfx('event');
          this.toast(`${d.name.toUpperCase()} \u2014 ${d.line}`, 'gold', 4200);
          break;
        case 'bossAutoRespond':
          this.toast('No line chosen. You press on with a measured answer.', '', 3600);
          break;
        case 'streakDown':
          this.pulse(this.els.shStreak, 'drop');
          this.audio.sfx('drop');
          this.floater(`\u25bc ACTIVE WITNESS \u00d7${d.mult.toFixed(1)}`, 'streakdown', 90, 40);
          break;
        case 'miss':
          this.floater(`MISS \u2212${d.lost}`, 'miss', this.lastTap.x, this.lastTap.y - 14);
          this.audio.sfx('miss');
          this.els.shStreak.classList.remove('drop');
          void this.els.shStreak.offsetWidth;
          this.els.shStreak.classList.add('drop');
          break;
        case 'bossRebuttal':
          this.audio.sfx('special');
          break;
        case 'bossRebutted': {
          const a = this.renderer.focusAnchor();
          const moved = Math.round(d.before - d.after);
          if (moved > 0) this.floater(`\u2212${formatNumber(moved)}`, 'timely', a.x, a.y - 12);
          else if (moved < 0) this.floater(`+${formatNumber(-moved)}`, '', a.x, a.y - 12);
          this.audio.sfx(d.choice.grade === 'strong' ? 'reward' : 'word');
          if (d.choice.grade === 'strong') this.renderer.impactCenter(3, '#ffe9a8');
          this.toast(`${d.choice.label} \u2014 ${d.choice.feedback}`, '', 5200);
          break;
        }
        case 'bossPhase':
          this.showBossBanner(`ARGUMENT ${['I', 'II', 'III'][d.index] || d.index + 1}`, BOSS.phases[d.index].title.toUpperCase(), 'argument', 2000);
          this.renderer.impactCenter(2, '#ffd98a');
          this.verseTried = {};
          if (d.index === 0 && d.bonus > 0) this.toast(`The word got around: a crowd came for the lecture (\u2212${Math.round(d.bonus * 100)}% on the first argument).`, 'gold', 5200);
          break;
        case 'convertTick': {
          const a = this.renderer.convertAnchor(d.index);
          if (a && this.state.phase === 'gen1' && !this.game.streetPaused) this.floater(CONVERT_LINES[d.line](d.name), 'convert', a.x, a.y);
          break;
        }
        case 'crowdEvent':
          this.audio.sfx(d.kind === 'church' ? 'unlock' : 'event');
          this.toast(CROWD_EVENTS[d.kind], 'gold', 3800);
          if (d.kind === 'church') this.renderer.impactCenter(1, '#ffe9a8');
          break;
        case 'wordReady':
          this.audio.sfx('special');
          this.pulse(this.els.btnWord, 'pulse');
          break;
        case 'wordNoTarget': {
          const now = performance.now();
          if (now - this.lastWordHint > 4000) {
            this.lastWordHint = now;
            this.toast(HINTS.wordHold, '', 3200);
          }
          break;
        }
        case 'encounterStart':
          this.showTab('street');
          this.closeTray();
          this.clearToasts();
          this.hideVerse();
          break;
        case 'responded':
          if (d.enc.kind === 'boss') this.toast(`${d.choice.label} \u2014 ${d.choice.feedback}`, '', 5200);
          this.audio.sfx(d.choice.grade === 'strong' ? 'reward' : 'word');
          this.renderer.onProclaim(false);
          break;
        case 'applied':
          this.audio.sfx(d.grade === 'direct' ? 'unlock' : 'word');
          this.renderer.onProclaim(false);
          break;
        case 'streakTier':
          this.pulse(this.els.shStreak, 'bump');
          this.toast(`ACTIVE WITNESS ×${d.mult.toFixed(1)}`, 'gold', 1600);
          this.renderer.impactCenter(2, '#cfe8b0');
          this.audio.sfx('reward');
          break;
        case 'standFirm':
          if (d.active) {
            this.toast(`${STAND_FIRM.name}! ${STAND_FIRM.verse.text}`, 'gold', 4200);
            this.renderer.impactCenter(2, '#ffe9a8');
            this.audio.sfx('unlock');
          }
          break;
        case 'ministryTick': {
          const a = this.renderer.ministryAnchor(d.id);
          if (a && this.state.phase === 'gen1' && !this.game.streetPaused) this.renderer.seedsFromMinistry(a.x / this.renderer.scale, a.y / this.renderer.scale - 6, d.amount);
          if (a && this.state.phase === 'gen1' && performance.now() - (this.lastTickFloater || 0) > 450) {
            this.lastTickFloater = performance.now();
            this.floater(`${MINISTRIES[d.id].name} +${formatNumber(d.amount)}`, 'minitick', a.x, a.y);
          }
          this.pulse(this.els.seeds);
          this.flashRow(d.id, d.amount);
          break;
        }
        case 'ministryMilestone': {
          const lines = MILESTONE_TEXT[d.id];
          this.toast(`MINISTRY MILESTONE — ${lines[Math.min(lines.length - 1, d.tier - 1)].toUpperCase()}`, 'gold', 4200);
          this.renderer.flashMinistry(d.id);
          this.audio.sfx('unlock');
          break;
        }
        case 'productionChange':
          this.rateChange = { text: `${formatRate(d.before)} → ${formatRate(d.after)}/s`, until: performance.now() + 3200, up: d.after > d.before };
          this.pulse(this.els.sps, 'pulse');
          break;
        case 'bossWindow':
          this.audio.sfx('bossWin');
          this.showBossBanner('ARGUMENT ANSWERED', 'THE CROWD IS LISTENING', 'answered', 2400);
          this.renderer.impactCenter(3, '#fff4c8');
          this.closeTray();
          break;
        case 'bossWindowEnd':
          this.toast(BOSS.window.end(d.attention, d.bonus), '', 4200);
          break;
        case 'bossConcession':
          this.toast(BOSS.concession, '', 3200);
          break;
        case 'word': {
          // The Professor's exchange: a passage applied to the argument. Its fit is remembered on its button, so trying passages teaches.
          (this.verseTried ||= {})[d.id] = d.grade;
          this.sigs.tray = null;
          this.showVerse(d.id, 2400);
          break;
        }
        case 'answer':
          break;
        case 'resolved': {
          const a = this.renderer.focusAnchor();
          this.floater(`+${formatNumber(d.reward.seeds)} Seeds`, 'reward', a.x, a.y - 8);
          if (d.reward.funds) this.floater(`+${formatNumber(d.reward.funds)} Provisions`, 'funds', a.x, a.y + 14);
          if (!d.converted) this.audio.sfx('reward');
          break;
        }
        case 'conversion':
          this.audio.sfx('conversion');
          break;
        case 'learned':
          this.audio.sfx('unlock');
          break;
        case 'familiar':
          this.audio.sfx('word');
          break;
        case 'harvested': {
          const a = this.renderer.specialAnchorAt(d.enc.spX ?? 0.5);
          this.floater(`+${formatNumber(d.reward.seeds)}`, 'harvest', a.x, a.y);
          this.renderer.impactAtCss(1, a.x, a.y, '#b6f0a0');
          this.pulse(this.els.seeds);
          if (!d.converted) this.audio.sfx('reward');
          break;
        }
        case 'automated': {
          const name = DISCIPLES[d.helper]?.name || 'A disciple';
          this.toast(COACH.automated(name, d.enc.person, formatNumber(d.reward.seeds)), 'gold', 3800);
          if (!d.converted) this.audio.sfx('reward');
          break;
        }
        case 'specialSpawn':
          this.audio.sfx('special');
          break;
        case 'specialMissed':
          if ((this.state.gen.encounterStats.specialsMissed || 0) <= 2) this.toast('They moved on. Another opportunity will come.', '', 3000);
          break;
        case 'scriptureUnlocked':
          this.audio.sfx('unlock');
          this.toast(`New Scripture: ${SCRIPTURES[d.id].ref} — ${SCRIPTURES[d.id].name}. ${SCRIPTURES[d.id].useful}`, 'gold', 6200);
          this.sigs.tray = null;
          break;
        case 'ministryUnlocked':
          this.audio.sfx('unlock');
          this.toast(`New ministry: ${MINISTRIES[d.id].name}`, 'gold');
          break;
        case 'clusterUnlocked':
          this.audio.sfx('unlock');
          this.toast('New upgrades are available.', 'gold');
          break;
        case 'fundsUnlocked':
          this.audio.sfx('unlock');
          this.toast('Provisions: supplies for the work (literature, equipment, space).', 'gold', 5200);
          break;
        case 'discipleCandidate':
          this.audio.sfx('unlock');
          this.toast(`${DISCIPLES[d.id].name} would like to help — see Ministry.`, 'gold');
          break;
        case 'discipleTrained':
          this.audio.sfx('purchase');
          if (d.first) this.showInfoMoment({ title: 'Multiplication', body: TIMOTHY_TEXT.text, ref: TIMOTHY_TEXT.ref }, 8000);
          break;
        case 'purchase':
          if (d.kind === 'upgrade' && BALANCE.upgrades[d.id].exclusiveWith) {
            this.toast(`You chose ${UPGRADE_TEXT[d.id].name}. ${UPGRADE_TEXT[BALANCE.upgrades[d.id].exclusiveWith].name} is closed for this generation.`, 'gold', 4200);
          }
          if (d.kind !== 'disciple') this.audio.sfx('purchase');
          if (d.kind === 'upgrade') {
            const def = BALANCE.upgrades[d.id];
            const text = UPGRADE_TEXT[d.id];
            // Say what just changed, and for supplies, that it is now out on the street.
            if (!def.exclusiveWith) this.toast(`${text.name.toUpperCase()}: ${text.desc.replace(/ \((Provisions|The Professor)\)$/, '')}`, def.currency === 'funds' ? '' : 'gold', 4200);
            if (def.currency === 'funds') this.renderer.supplyAppeared(d.id);
          }
          this.sigs.upgrades = null;
          this.sigs.disciples = null;
          this.sigs.legacy = null;
          break;
        case 'bossForeshadow':
          this.toast(BOSS.foreshadow[Math.min(BOSS.foreshadow.length - 1, d.stage - 1)], '', 6000);
          break;
        case 'bossAvailable':
          this.audio.sfx('unlock');
          this.toast(d.retry ? 'The crowd is gathering again.' : BOSS.available, 'gold', 5200);
          break;
        case 'bossStart':
          this.audio.sfx('boss');
          this.verseTried = {};
          this.closeTray();
          this.clearToasts();
          break;
        case 'bossVictory':
          this.bossReward = d.seeds;
          this.closeTray();
          this.showBossBanner('FAITHFULLY ANSWERED', 'THE EXCHANGE IS COMPLETE', 'victory', 3200);
          this.renderer.impactCenter(4, '#fff4c8');
          this.audio.sfx('bossWin');
          setTimeout(() => { this.renderer.impactCenter(4, '#ffe9a8'); this.audio.sfx('reward'); }, 700);
          break;
        case 'bossPassed':
          this.audio.sfx('passed');
          break;
        case 'generationComplete':
          this.closeTray();
          this.showGenerationComplete();
          break;
        case 'hint':
          if (HINTS[d.id]) this.toast(HINTS[d.id], '', 5600);
          break;
        case 'save':
          if (d.now) this.hooks.saveNow();
          break;
        default:
          break;
      }
    });
  }

  // ---------------------------------------------------------------- per-frame
  frame(nowMs, dt) {
    this.stepTyping(nowMs);
    this.syncHud();
    this.syncEncounter();
    this.syncMoment(nowMs);
    this.syncActions();
    this.syncChoices();
    this.syncMontage(nowMs);
    this.refreshTimer -= dt;
    if (this.refreshTimer <= 0) {
      this.refreshTimer = 0.25;
      this.refreshPanels(false);
      this.syncAudioMood();
    }
    if (this.lastPhase !== this.state.phase) this.syncPhase();
  }

  syncHud() {
    const { game, els } = this;
    const gen = this.state.gen;
    const gameplay = this.state.phase === 'gen1';
    setText(els.seeds, formatHave(gen.seeds));
    const rc = this.rateChange && performance.now() < this.rateChange.until ? this.rateChange : null;
    setText(els.sps, rc ? rc.text : gameplay ? `${formatRate(game.seedsPerSec)}/s` : 'Gen I complete');
    els.sps.classList.toggle('changing', !!rc);
    setHidden(els.statFunds, !(gen.fundsUnlocked && gameplay));
    if (gen.fundsUnlocked) {
      setText(els.funds, formatHave(gen.funds));
      setText(els.fps, `${formatRate(game.fundsPerSec)}/s`);
    }
    const showFaith = this.state.phase === 'gen2preview';
    setHidden(els.statFaith, !showFaith);
    if (showFaith) setText(els.faith, String(this.state.currencies.faithfulness));
    if (this.state.debugUsed && !this.debugBadge) {
      this.debugBadge = h('span', { class: 'stat-rate', text: 'DEBUG SAVE', style: 'color:#e8a08a' });
      els.seeds.parentElement.append(this.debugBadge);
    }
  }

  portraitMood(enc, boss) {
    const mood = boss
      ? boss.reaction || boss.enc?.rebuttalAnswer?.grade || boss.enc?.answer?.grade || 'neutral'
      : enc?.scripture?.grade || enc?.answer?.grade || enc?.reaction || 'neutral';
    return ['strong', 'direct', 'contextual', 'high'].includes(mood) ? 'warm' : ['weak', 'proclaimed', 'low'].includes(mood) ? 'guarded' : 'neutral';
  }

  syncPortrait(id, mood = 'neutral', boss = false) {
    const sig = `${id}|${mood}|${boss ? 1 : 0}`;
    if (this.sigs.portrait === sig) return;
    this.sigs.portrait = sig;
    this.els.portraitFrame.classList.toggle('boss', !!boss);
    drawPortrait(this.els.portrait, id, { mood });
  }

  syncEncounter() {
    const { game, els } = this;
    const boss = game.boss;
    const gen = this.state.gen;
    const gameplay = this.state.phase === 'gen1' && !this.montage;
    this.syncStreetHud(gameplay);
    const window = boss?.stage === 'window';
    let enc = game.activeEncounter;
    if (boss && boss.stage !== 'argument') enc = null;
    const show = ((!!enc && enc.state !== 'focusExit') || window) && !this.momentKey;
    setHidden(els.card, !show);
    if (gen.encounterStats.engagements > 0) gen.seenHints.tapped = true;
    const openMoments = game.crowd.opportunityCount > 0;
    setHidden(els.tapHint, !(gameplay && !gen.seenHints.tapped && !boss && !game.streetPaused && !game.wordReady && openMoments));
    if (!show) {
      this.cardKey = null;
      this.sigs.portrait = null;
      return;
    }
    if (window) {
      const key = `window-${boss.phaseIndex}`;
      els.card.classList.remove('special');
      els.card.classList.add('boss');
      this.syncPortrait('professor', this.portraitMood(null, boss), true);
      if (key !== this.cardKey) {
        this.cardKey = key;
        setText(els.name, BOSS.name);
        setText(els.label, BOSS.window.title);
        setText(els.statement, `${BOSS.window.reactions[boss.reaction] || ''} ${BOSS.window.body}`.trim());
      }
      setHidden(els.resistWrap, true);
      setHidden(els.timerWrap, false);
      els.timer.style.width = `${Math.max(0, (1 - boss.t / game.windowSeconds) * 100)}%`;
      setText(els.label, `${BOSS.window.title} \u00b7 ${boss.attention} engaged`);
      return;
    }
    const isBoss = enc.kind === 'boss';
    setHidden(els.resistWrap, !isBoss);
    els.card.classList.toggle('special', enc.kind === 'special');
    els.card.classList.toggle('boss', isBoss);
    this.syncPortrait(isBoss ? 'professor' : enc.specialId, this.portraitMood(enc, null), isBoss);
    const key = `${enc.kind}-${enc.index}-${enc.state}-${enc.step}`;
    if (key !== this.cardKey) {
      this.cardKey = key;
      setText(els.name, enc.person ? `${enc.person} \u00b7 ${enc.name}` : enc.name);
      if (isBoss) {
        setText(els.label, enc.label);
        // He speaks back: his reply to your response, then (halfway through) his rebuttal, then his reply to that.
        if (enc.step === 'rebut') this.typeText(els.statement, enc.rebuttal.statement);
        else if (enc.step === 'press' && (enc.rebuttalAnswer || enc.answer)) this.typeText(els.statement, (enc.rebuttalAnswer || enc.answer).reply);
        else setText(els.statement, enc.statement);
      } else if (enc.step === 'apply' && enc.answer) {
        setText(els.label, enc.label);
        this.typeText(els.statement, enc.answer.reply);
      } else {
        setText(els.label, enc.label);
        this.typeText(els.statement, `${enc.returnLine ? `${enc.returnLine} ` : ''}\u201c${enc.statement}\u201d`);
      }
    }
    if (isBoss) {
      const pct = Math.max(0, Math.min(100, (enc.resistance / enc.resistanceMax) * 100));
      els.resist.style.width = `${pct}%`;
      if (els.resistGhost) els.resistGhost.style.width = `${pct}%`;
      setText(els.resistNum, enc.resolved ? '0' : formatNumber(Math.ceil(enc.resistance)));
      setHidden(els.timerWrap, false);
      els.timer.style.width = `${Math.max(0, (enc.timeLeft / enc.timeLimit) * 100)}%`;
    } else setHidden(els.timerWrap, true);
  }

  /** Active Witness streak and Momentum / Stand Firm: why the numbers on the street are what they are. */
  syncStreetHud(gameplay) {
    const { game, els } = this;
    setHidden(els.hud, !gameplay);
    if (!gameplay) return;
    const street = game.street;
    const st = this.state.gen.street;
    const tier = street.tier;
    const tiers = BALANCE.street.streakTiers;
    setText(els.shMult, `\u00d7${street.multiplier.toFixed(1)}`);
    setText(els.shCount, street.streakCount >= 3 ? `\u00b7 ${street.streakCount}` : '');
    // The longer the run, the bigger and warmer it reads (continuous, not just at the tiers): a positive loop you can watch building.
    els.shStreak.style.setProperty('--k', Math.min(1, street.streakCount / 40).toFixed(3));
    // The constant reminder: a bar that drains as the run's time runs out (warmer as it gets low), and the whole chip shakes when the run slips.
    const live = street.streakCount >= 3;
    const left = street.streakTimeLeft;
    const win = Math.max(0.1, street.streakWindowNow);
    els.shStreak.classList.toggle('has-run', live);
    els.shStreak.classList.toggle('low', live && left / win < 0.4);
    els.shStreak.classList.toggle('urgent', live && left / win < 0.18);
    els.shStreak.style.setProperty('--f', live ? Math.min(1, left / win).toFixed(3) : '0');
    if (live) this.game.hint('streakBar');
    for (let i = 0; i < tiers.length; i++) els.shStreak.classList.toggle(`t${i}`, i === tier);
    if (els.shPips.childElementCount !== tiers.length - 1) {
      clear(els.shPips);
      for (let i = 1; i < tiers.length; i++) els.shPips.append(h('i'));
    }
    [...els.shPips.children].forEach((pip, i) => pip.classList.toggle('on', tier >= i + 1));
    const firm = street.standFirm;
    els.shMomentum.classList.toggle('firm', firm);
    setText(els.shMomLabel, firm ? `${STAND_FIRM.name} ${Math.ceil(st.standFirmLeft)}s` : 'Momentum');
    els.shFill.style.width = `${Math.min(100, st.momentum)}%`;
  }

  desiredMoment(nowMs) {
    const game = this.game;
    const boss = game.boss;
    const enc = game.enc;
    if (this.montage) return null;
    if (boss) {
      if (boss.stage === 'intro') return { key: 'boss-intro', cls: 'boss-dialog' };
      if (boss.stage === 'transition') return { key: `boss-trans-${boss.phaseIndex}`, cls: 'boss-dialog' };
      if (boss.stage === 'victory') return boss.t < 3.3 ? null : { key: 'boss-victory', cls: 'boss-dialog' };
      if (boss.stage === 'passed') return { key: 'boss-passed', cls: 'boss-dialog' };
      return null;
    }
    if (enc?.state === 'conversion') return { key: `conv-${enc.index}`, cls: '' };
    if (enc?.kind === 'special' && enc.state === 'outcome') return { key: `special-${enc.index}`, cls: '' };
    if (this.infoMoment && nowMs < this.infoMoment.until) return { key: 'info', cls: '' };
    return null;
  }

  syncMoment(nowMs) {
    const want = this.desiredMoment(nowMs);
    const el = this.els.moment;
    this.els.scene.classList.toggle('has-moment', !!want);
    if (!want) {
      if (this.momentKey) {
        this.momentKey = null;
        setHidden(el, true);
        clear(el);
      }
      return;
    }
    if (want.key === this.momentKey) return;
    this.momentKey = want.key;
    clear(el);
    el.className = want.cls;
    const game = this.game;
    const enc = game.enc;
    const boss = game.boss;
    if (want.key === 'boss-intro') {
      for (const line of BOSS.intro) el.append(h('p', { text: line.who === 'Narrator' ? line.text : `${line.who}: ${line.text}` }));
      el.append(h('div', { class: 'small', text: 'Tap to continue' }));
    } else if (want.key.startsWith('boss-trans')) {
      el.append(h('h3', { text: BOSS.name }), h('p', { text: BOSS.phases[boss.phaseIndex].transition }));
    } else if (want.key === 'boss-victory') {
      el.append(
        h('h3', { text: 'The exchange is complete' }),
        ...BOSS.victory.map((l) => h('p', { text: l })),
        this.bossReward ? h('div', { class: 'reward', text: `+${formatNumber(this.bossReward)} Seeds` }) : null,
        h('div', { class: 'quote', text: BOSS.verseVictory.text }),
        h('span', { class: 'ref', text: BOSS.verseVictory.ref }),
        h('div', { class: 'row-btns' }, h('button', { class: 'btn gold', type: 'button', text: 'Continue', on: { click: () => game.finishBossVictory() } })),
      );
    } else if (want.key === 'boss-passed') {
      const debrief = this.state.gen.bossState.lastDebrief;
      el.append(
        h('h3', { text: 'The opportunity passes' }),
        h('p', { text: BOSS.passed }),
        debrief ? h('div', { class: 'quote', text: `Preparation: ${debrief.label}. You reached argument ${debrief.phase} of 3.` }) : null,
        ...(debrief ? debrief.tips.map((k) => h('div', { class: 'small', text: `• ${BOSS.debrief[k]}` })) : []),
        this.state.gen.bossState.attempts >= 2 ? h('div', { class: 'quote', text: BOSS.debrief.twice }) : null,
      );
    } else if (want.key.startsWith('conv')) {
      const name = enc.convert?.name || 'Someone';
      const helperName = enc.auto ? DISCIPLES[enc.helper]?.name : null;
      el.append(
        h('h3', { text: CONVERSION_TEXT.title }),
        helperName ? h('p', { class: 'small', text: `${helperName} had been talking with ${name}.` }) : null,
        h('p', { text: CONVERSION_TEXT.line(name) }),
        h('div', { class: 'quote', text: `“${CONVERSION_TEXT.verse.text}”` }),
        h('span', { class: 'ref', text: CONVERSION_TEXT.verse.ref }),
        h('div', { class: 'small', text: 'Tap to continue' }),
      );
    } else if (want.key.startsWith('special')) {
      const answer = enc.answer;
      const scripture = enc.scripture;
      const reward = enc.reward || { seeds: 0, funds: 0 };
      el.append(
        h('h3', { text: enc.person ? `${enc.person} \u00b7 ${enc.name}` : enc.name }),
        scripture?.reply ? h('p', { class: 'speech', text: `\u201c${scripture.reply}\u201d` }) : null,
        h('p', { class: 'action-line', text: enc.reaction || '' }),
        h('div', { class: 'outcome-lines' },
          answer ? h('div', {}, h('b', { text: answer.label }), ' \u2014 your response') : null,
          scripture ? h('div', {}, h('b', { text: scripture.label }), scripture.ref ? ` \u2014 ${scripture.ref}${enc.wordCharged ? ' \u00b7 Word ready' : ''}` : ' \u2014 what you said next') : null),
        this.coachNotes(enc),
        h('div', { class: 'reward', text: `+${formatNumber(reward.seeds)} Seeds${reward.funds ? ` \u00b7 +${formatNumber(reward.funds)} Provisions` : ''}` }),
        h('div', { class: 'small', text: `${ENCOUNTER_UI.outcomeNote} Tap to continue` }),
      );
    } else if (want.key === 'info') {
      el.append(h('h3', { text: this.infoMoment.title }), h('p', { text: `“${this.infoMoment.body.replace(/^“|”$/g, '')}”` }), h('span', { class: 'ref', text: this.infoMoment.ref }));
    }
    setHidden(el, false);
  }

  /** After a conversation: where it fell short, or that it is now learned (and who can carry it). Nothing here touches conversion. */
  coachNotes(enc) {
    const missed = enc.missed || [];
    if (!missed.length && !enc.newlyLearned && !enc.newlyFamiliar) return null;
    const notes = [];
    if (missed.includes('response') && enc.answer) notes.push(h('div', { class: 'miss' }, h('b', { text: `${COACH.response}: ` }), enc.answer.feedback));
    if (missed.includes('line')) notes.push(h('div', { class: 'miss' }, h('b', { text: `${COACH.said}: ` }), COACH.line[enc.scripture?.grade] || COACH.line.skipped));
    if (enc.newlyLearned) {
      const helper = this.game.automationHelper();
      notes.push(h('div', { class: 'learned' }, h('b', { text: `${COACH.learned} ` }), helper ? COACH.learnedHelper(DISCIPLES[helper].name) : COACH.learnedNoHelper));
    }
    if (enc.newlyFamiliar) notes.push(h('div', { class: 'learned' }, COACH.familiar));
    return h('div', { class: 'coach' }, ...notes);
  }

  syncActions() {
    const { game, els } = this;
    const gen = this.state.gen;
    const enc = game.activeEncounter;
    const unlocked = gen.scripturesUnlocked;
    const gameplay = this.state.phase === 'gen1';
    const pressing = enc?.kind === 'boss' && enc.state === 'active' && enc.step === 'press' && !enc.resolved;
    const word = els.btnWord;
    els.scene.classList.toggle('boss-fight', !!game.boss);
    document.getElementById('app').classList.toggle('boss-press', pressing);
    els.streetTop.classList.toggle('has-answer', pressing);
    els.actionRow.classList.toggle('has-answer', pressing);
    setHidden(els.btnAnswer, !pressing);
    // the passages appear by themselves when it is time to bring one, so nobody has to guess that WORD opens them
    if (pressing && !this.wasPressing && unlocked.length > 1 && this.tab === 'street') {
      setHidden(els.tray, false);
      this.sigs.tray = null;
      this.positionTray();
    }
    this.wasPressing = pressing;
    if (pressing) {
      word.classList.remove('ready', 'charging');
      word.disabled = !gameplay || unlocked.length === 0;
      setText(els.wordSub, unlocked.length === 0 ? 'Locked' : game.wordReady ? 'Bring a passage \u00b7 full weight' : 'Bring a passage');
      this.setCd(els.wordCd, 0, 1);
      const cd = game.cool.answer;
      els.btnAnswer.disabled = cd > 0.05;
      setText(els.answerSub, cd > 0.05 ? `${cd.toFixed(0)}s` : 'Press your point');
      this.setCd(els.answerCd, cd, this.cdTotal.answer);
    } else {
      const ready = game.wordReady;
      const frac = game.wordFraction;
      word.disabled = !gameplay || unlocked.length === 0 || !game.streetOpen;
      word.classList.toggle('ready', ready && !word.disabled);
      word.classList.toggle('charging', !ready && unlocked.length > 0);
      let crowdTier = 0;
      if (unlocked.length === 0) setText(els.wordSub, 'Locked');
      else if (ready) {
        const n = game.crowd.openPeds().length;
        let crest = false;
        if (n > 0) {
          const nearby = game.crowd.bystanders().length;
          const pay = game.wordPayout(n, nearby);
          crowdTier = pay.tier.index;
          crest = pay.crest;
          const out = game.crowdOutlook;
          if (out.leaving > 0 && out.open >= 3) game.hint('leaving');
          if (pay.crest) game.hint('crest');
          if (pay.crest && !this.wordCrestOn) {
            this.pulse(word, 'pulse');
            this.audio.sfx('chain', 3);
          }
          this.wordCrestOn = pay.crest;
        }
        setText(els.wordSub, 'READY');
        word.classList.toggle('crest', crest);
      } else setText(els.wordSub, `Preparing ${Math.floor(frac * 100)}%`);
      // A bigger street lights the button up in steps (no numbers: players find the pattern); a new step while holding WORD is felt.
      for (let i = 1; i <= 4; i++) word.classList.toggle(`crowd-t${i}`, crowdTier === i);
      if (crowdTier > (this.wordTier || 0) && this.wordTier !== undefined && ready) {
        this.pulse(word, 'pulse');
        this.audio.sfx('crowdTier', crowdTier);
      }
      this.wordTier = ready ? crowdTier : 0;
      if (!ready) {
        this.wordCrestOn = false;
        word.classList.remove('crest');
      }
      els.wordCd.style.width = unlocked.length ? `${Math.min(100, frac * 100)}%` : '0';
    }
    if (!els.tray.classList.contains('hidden')) {
      this.positionTray();
      this.refreshTray();
    }
  }

  /**
   * The conversation panel: choose how to respond, then bring a passage (the Skeptic, the Nominal Christian, the
   * Broken Sinner), and the Professor's response choice. It replaces the street controls while someone is talking.
   */
  syncChoices() {
    const { game, els } = this;
    const enc = game.activeEncounter;
    const active = this.state.phase === 'gen1' && !this.montage && !!enc && !enc.resolved && (enc.state === 'active' || enc.state === 'focusEnter');
    const mode = active ? (enc.step === 'respond' ? 'respond' : enc.step === 'apply' ? 'apply' : enc.kind === 'boss' && enc.step === 'rebut' ? 'rebut' : null) : null;
    const talking = !!enc && enc.kind === 'special' && enc.state !== 'focusExit' && this.state.phase === 'gen1';
    const choosing = mode === 'respond' || mode === 'rebut';
    this.tabs.street.classList.toggle('in-talk', talking || choosing);
    document.getElementById('app').classList.toggle('in-talk', talking || choosing);
    const show = !!mode && this.tab === 'street';
    setHidden(els.choiceBox, !show);
    if (!mode) {
      this.sigs.choices = null;
      return;
    }
    const unlocked = this.state.gen.scripturesUnlocked;
    const sig = `${mode}|${enc.kind}|${enc.index}|${enc.answer?.id || ''}|${(enc.lines || []).map((l) => l.id).join(',')}|${game.wordReady ? 1 : 0}`;
    if (this.sigs.choices === sig) return;
    this.sigs.choices = sig;
    const box = els.choiceBox;
    clear(box);
    if (mode === 'respond') {
      box.append(h('div', { class: 'cb-head' }, h('span', { text: enc.kind === 'boss' ? ENCOUNTER_UI.respondBoss : ENCOUNTER_UI.respond })));
      enc.choices.forEach((c, i) => {
        box.append(h('button', { class: 'choice', type: 'button', on: { click: () => this.chooseResponse(c.id) } },
          h('span', { class: 'ch-key', text: 'ABC'[i] }), h('span', { class: 'ch-text', text: c.text })));
      });
      return;
    }
    if (mode === 'rebut') {
      box.append(h('div', { class: 'cb-head' }, h('span', { text: ENCOUNTER_UI.rebut })));
      enc.rebuttalChoices.forEach((c, i) => {
        box.append(h('button', { class: 'choice', type: 'button', on: { click: () => this.chooseRebuttal(c.id) } },
          h('span', { class: 'ch-key', text: 'ABC'[i] }), h('span', { class: 'ch-text', text: c.text })));
      });
      return;
    }
    const a = enc.answer;
    box.append(
      h('div', { class: `cb-feedback grade-${a.grade}` }, h('b', { text: a.label }), h('span', { text: a.feedback })),
      h('div', { class: 'cb-head' }, h('span', { text: enc.askScripture }), game.wordReady ? h('span', { class: 'cb-ready', text: ENCOUNTER_UI.wordReady }) : null),
    );
    (enc.lines || []).forEach((line, i) => {
      box.append(h('button', { class: 'choice passage', type: 'button', on: { click: () => this.chooseVerse(line.id) } },
        h('span', { class: 'ch-key', text: 'ABC'[i] }),
        h('span', { class: 'ch-text', text: line.say })));
    });
  }

  /** A thin cooldown bar: full width right after use, empty when ready. */
  setCd(el, left, total) {
    el.style.width = left > 0.05 && total > 0 ? `${Math.min(100, (left / total) * 100)}%` : '0';
  }

  /** The Professor's exchange: the passages that can be brought to the argument. */
  refreshTray() {
    const { game, els } = this;
    const unlocked = this.state.gen.scripturesUnlocked;
    const enc = game.activeEncounter;
    const pressing = enc?.kind === 'boss' && enc.state === 'active' && enc.step === 'press' && !enc.resolved;
    if (!pressing && !els.tray.classList.contains('hidden')) this.closeTray();
    const tried = this.verseTried || {};
    const sig = `${unlocked.join(',')}|${Object.entries(tried).join(',')}`;
    if (this.sigs.tray !== sig) {
      this.sigs.tray = sig;
      clear(els.tray);
      this.trayButtons = {};
      for (const id of SCRIPTURE_ORDER) {
        if (!unlocked.includes(id)) continue;
        const v = SCRIPTURES[id];
        const cd = h('i', { class: 'cd' });
        const grade = tried[id];
        const fitText = grade === 'direct' ? 'Direct' : grade === 'contextual' ? 'Fits' : grade ? 'Tried' : '';
        const btn = h('button', { class: `verse-btn${grade === 'direct' || grade === 'contextual' ? ' fits' : ''}`, type: 'button', title: v.useful, 'aria-label': `${v.ref}: ${v.name}. ${v.useful}${fitText ? ` Last time: ${fitText}.` : ''}`, on: { click: () => this.castVerse(id) } },
          h('span', { class: 'v-ref', text: v.ref }), h('span', { class: 'v-short', text: v.short }), fitText ? h('span', { class: 'v-fit', text: fitText }) : null, cd);
        this.trayButtons[id] = { btn, cd };
        els.tray.append(btn);
      }
    }
    for (const [id, ref] of Object.entries(this.trayButtons)) {
      const def = BALANCE.scripture.verses[id];
      const cd = game.cool.words[id] || 0;
      ref.btn.disabled = cd > 0.05 || game.cool.shared > 0.05 || !pressing;
      this.setCd(ref.cd, cd, this.cdTotal[id] || def.cooldown);
    }
  }

  // ---------------------------------------------------------------- audio mood
  syncAudioMood() {
    const game = this.game;
    const restored = this.state.phase === 'gen2preview' || this.montage;
    this.audio.setMood(game.inBoss ? 'boss' : restored ? 'hope' : 'street');
    const quiet = game.enc?.state === 'conversion';
    this.audio.setAmbience({ rain: restored ? 0.15 : 1, crowd: game.inBoss ? 1.2 : quiet ? 0.2 : 0.5 });
  }

  // ---------------------------------------------------------------- panels
  refreshPanels(force) {
    const gameplay = this.state.phase === 'gen1';
    this.updateBadges();
    if (this.tab === 'street') this.refreshStreet();
    else if (this.tab === 'ministry' && gameplay) this.updateMinistryTab(force);
    else if (this.tab === 'upgrades' && gameplay) this.refreshUpgradesTab();
    else if (this.tab === 'legacy') this.refreshLegacyTab();
  }

  updateBadges() {
    const game = this.game;
    const gen = this.state.gen;
    const bMin = this.navButtons[1].querySelector('.badge');
    const bUp = this.navButtons[2].querySelector('.badge');
    if (this.state.phase !== 'gen1') {
      bMin.classList.add('hidden');
      bUp.classList.add('hidden');
      return;
    }
    let min = false;
    for (const id of MINISTRY_ORDER) {
      const i = game.ministryInfo(id);
      if (i.unlocked && i.cost1 <= gen.seeds) min = true;
    }
    for (const d of gen.disciples) {
      if (d.status === 'candidate' && gen.seeds >= game.discipleDef(d.id).cost) min = true;
    }
    let up = false;
    for (const id of Object.keys(BALANCE.upgrades)) if (!gen.upgrades[id] && game.isUpgradeVisible(id) && game.canAffordUpgrade(id)) up = true;
    bMin.classList.toggle('hidden', !min || this.tab === 'ministry');
    bUp.classList.toggle('hidden', !up || this.tab === 'upgrades');
  }

  refreshStreet() {
    const { els } = this;
    const state = this.state;
    const gen = state.gen;
    if (state.phase === 'gen2preview') {
      this.renderPreviewCard();
      return;
    }
    const goal = currentGoal(this.game);
    const step = Math.round(goal.progress * 20);
    const sig = `${goal.id}|${goal.text}|${step}`;
    if (this.sigs.status !== sig) {
      this.sigs.status = sig;
      if (this.lastGoal && this.lastGoal.id !== goal.id && this.lastGoal.progress >= 0.9) {
        this.toast(`Goal reached: ${this.lastGoal.text}`, 'gold', 2600);
        this.audio.sfx('unlock');
      }
      this.lastGoal = goal;
      clear(els.status);
      els.status.append(
        h('div', { class: 'goal-row' }, h('span', { class: 'goal-label', text: 'Goal' }), h('span', { class: 'goal-text', text: goal.text })),
        h('div', { class: 'goal-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(goal.progress * 100)) }, h('i', { style: `width:${Math.round(goal.progress * 100)}%` })),
      );
    }
    this.refreshStrip();
    this.refreshBossRow();
  }

  refreshStrip() {
    const { game } = this;
    const gen = this.state.gen;
    const ids = MINISTRY_ORDER.filter((id) => game.isMinistryUnlocked(id));
    const info = ids.map((id) => game.ministryInfo(id));
    const sig = info.map((i) => `${i.id}${i.owned}:${Math.round(i.production * 10)}`).join('|');
    if (this.sigs.strip === sig) return;
    this.sigs.strip = sig;
    const strip = this.els.strip;
    clear(strip);
    setHidden(strip, gen.ministries.tracts.owned === 0);
    for (const i of info) {
      strip.append(
        h('button', { type: 'button', class: i.owned > 0 ? 'on' : '', 'aria-label': `${MINISTRIES[i.id].name}: ${i.owned} owned, ${formatRate(i.production)} Seeds per second. Open Ministry`, on: { click: () => this.showTab('ministry') } },
          icon(MINISTRIES[i.id].icon, 20),
          h('span', { class: 'sc' }, h('b', { text: `\u00d7${i.owned}` }), h('i', { text: `${formatRate(i.production)}/s` }))),
      );
    }
  }

  refreshBossRow() {
    const { game, els } = this;
    const gen = this.state.gen;
    const b = gen.bossState;
    const row = els.bossRow;
    let mode = null;
    if (game.inBoss || this.montage || this.momentKey || this.state.phase !== 'gen1') mode = null;
    else if (b.status === 'available') mode = 'available';
    else if (b.status === 'cooldown') mode = 'cooldown';
    setHidden(row, !mode);
    els.scene.classList.toggle('has-boss', !!mode);
    if (!mode) {
      this.sigs.boss = null;
      return;
    }
    if (mode === 'cooldown') {
      const left = Math.max(0, Math.ceil(b.cooldownUntil - gen.genSeconds));
      const sig = `cd${left}`;
      if (this.sigs.boss !== sig) {
        this.sigs.boss = sig;
        clear(row);
        row.className = '';
        row.append(
          h('div', { class: 'b-text' }, h('b', { text: BOSS.name }), h('div', { text: `The crowd is gathering again… ${left}s` })),
          h('button', { class: 'btn rose small', type: 'button', disabled: true, text: 'Wait' }),
        );
      }
      return;
    }
    const ratio = game.bossPreparation();
    const prep = Math.min(1, ratio / 1.5);
    const label = readinessLabel(ratio);
    const sig = `av${label}${b.attempts}`;
    if (this.sigs.boss !== sig) {
      this.sigs.boss = sig;
      clear(row);
      row.className = 'available';
      row.append(
        h('div', { class: 'b-text' },
          h('b', { text: `${BOSS.name} — a public exchange` }),
          h('div', { class: 'b-prep' }, h('span', { text: `Preparation: ${label}` }), h('div', { class: 'meter-track' }, h('div', { class: 'meter-fill', style: `width:${Math.round(prep * 100)}%` })))),
        h('button', { class: 'btn rose', type: 'button', text: b.attempts > 0 ? 'Try again' : 'Meet', 'aria-label': 'Meet the Professor for a public exchange', on: { click: () => { this.audio.unlock(); game.challengeBoss(); } } }),
      );
    }
  }
  renderPreviewCard() {
    const state = this.state;
    const sig = `pv${state.currencies.faithfulness}`;
    if (this.sigs.preview === sig) return;
    this.sigs.preview = sig;
    const card = this.els.preview;
    clear(card);
    card.append(
      h('div', { class: 'preview-card' },
        h('h3', { text: GEN2_PREVIEW.title }),
        h('div', { text: GEN2_PREVIEW.body }),
        h('div', { class: 'note', style: 'margin-top:8px', text: GEN2_PREVIEW.locked }),
        h('div', { style: 'display:flex;gap:8px;margin-top:8px' },
          h('button', { class: 'btn gold', type: 'button', text: 'Open Legacy', on: { click: () => this.showTab('legacy') } }),
          h('button', { class: 'btn ghost', type: 'button', text: 'Generation I', on: { click: () => this.reviewGenerationOne() } }))),
    );
  }

  // ---- Ministry tab: what is producing, how much, how often, and what the next purchase changes
  buildMinistryTab() {
    const tab = this.tabs.ministry;
    clear(tab);
    this.mRows = {};
    this.psTotal = h('div', { class: 'ps-total', text: '0 Seeds/sec' });
    this.psBar = h('div', { class: 'ps-bar' });
    this.psLegend = h('div', { class: 'ps-legend' });
    tab.append(
      h('div', { class: 'passive-summary' },
        h('div', { class: 'ps-top' }, h('span', { class: 'ps-label', text: 'Passive production' }), this.psTotal),
        this.psBar,
        this.psLegend),
    );
    const modes = h('div', { class: 'buy-modes' });
    this.modeBtns = [];
    for (const [val, label] of [[1, '\u00d71'], [10, '\u00d710'], ['max', 'Max']]) {
      const b = h('button', { type: 'button', text: label, class: this.buyMode === val ? 'on' : '', 'aria-label': `Buy ${label}`, on: { click: () => { this.buyMode = val; this.modeBtns.forEach((m) => m.btn.classList.toggle('on', m.val === val)); this.updateMinistryTab(true); } } });
      this.modeBtns.push({ btn: b, val });
      modes.append(b);
    }
    tab.append(h('div', { class: 'section-title' }, h('span', { text: 'Ministries' }), modes));
    this.mList = h('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    tab.append(this.mList);
    for (const id of MINISTRY_ORDER) {
      const def = MINISTRIES[id];
      const nameEl = h('span', { text: def.name });
      const ownedEl = h('small', { text: '' });
      const tickEl = h('span', { class: 'tickflash', text: '' });
      const prodEl = h('div', { class: 'prod' });
      const desc = h('div', { class: 'desc', text: def.blurb });
      const perf = h('div', { class: 'desc' });
      const next = h('div', { class: 'nextprod' });
      const label = h('span', {});
      const cost = h('small', {});
      const buy = h('button', { class: 'buy', type: 'button', 'aria-label': `Buy ${def.name}`, on: { click: () => this.buyMinistry(id) } }, label, cost);
      const root = h('div', { class: 'row min-row', style: `--c:${MINISTRY_COLORS[id]}` }, h('div', { class: 'ico' }, icon(def.icon, 26)), h('div', { class: 'info' }, h('div', { class: 'name' }, nameEl, ownedEl, tickEl), prodEl, perf, next, desc), buy);
      this.mRows[id] = { root, nameEl, ownedEl, tickEl, prodEl, desc, perf, next, buy, label, cost };
      this.mList.append(root);
    }
    this.discBox = h('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    tab.append(this.discBox);
    tab.append(h('div', { class: 'note', text: 'Faithfulness: ???  \u2014 revealed when this generation is complete. It is a gift of grace, never bought with Seeds or Provisions.' }));
  }

  /** A ministry just reported a production cycle: show it on its row (the number matches what accrued). */
  flashRow(id, amount) {
    const row = this.mRows?.[id];
    if (!row || this.tab !== 'ministry') return;
    this.pulse(row.root);
    row.tickEl.textContent = `+${formatNumber(amount)}`;
    clearTimeout(row.tickTimer);
    row.tickTimer = setTimeout(() => { row.tickEl.textContent = ''; }, 1400);
  }

  buyMinistry(id) {
    const qty = this.buyMode;
    if (!this.game.buyMinistry(id, qty) && qty !== 1) this.game.buyMinistry(id, 1);
  }

  updateMinistryTab(force) {
    const game = this.game;
    const gen = this.state.gen;
    let lockedShown = false;
    const total = game.baseSeedsPerSec;
    setRate(this.psTotal, formatRate(total), 'Seeds/sec');
    const sumSig = MINISTRY_ORDER.map((id) => Math.round(game.ministryInfo(id).production * 10)).join(',');
    if (force || this.sigs.sum !== sumSig) {
      this.sigs.sum = sumSig;
      clear(this.psBar);
      clear(this.psLegend);
      for (const id of MINISTRY_ORDER) {
        const prod = game.ministryInfo(id).production;
        if (prod <= 0) continue;
        this.psBar.append(h('i', { style: `width:${(prod / Math.max(1e-9, total)) * 100}%;background:${MINISTRY_COLORS[id]}` }));
        this.psLegend.append(h('span', { style: `--c:${MINISTRY_COLORS[id]}`, text: `${MINISTRIES[id].name} ${formatRate(prod)}/s` }));
      }
    }
    for (const id of MINISTRY_ORDER) {
      const row = this.mRows[id];
      const info = game.ministryInfo(id);
      if (!info.unlocked) {
        const show = !lockedShown;
        lockedShown = true;
        setHidden(row.root, !show);
        row.root.classList.add('locked');
        setText(row.nameEl, '???');
        setText(row.ownedEl, '');
        setText(row.prodEl, '');
        setText(row.desc, 'Unlocks as your ministry grows.');
        setText(row.perf, '');
        setText(row.next, '');
        row.buy.disabled = true;
        setText(row.label, 'Locked');
        setText(row.cost, '');
        continue;
      }
      setHidden(row.root, false);
      row.root.classList.remove('locked');
      setText(row.nameEl, MINISTRIES[id].name);
      setText(row.ownedEl, `\u00d7${info.owned}`);
      if (info.owned > 0) setRate(row.prodEl, formatRate(info.production), 'Seeds/sec');
      else setText(row.prodEl, 'Not started yet');
      setText(row.desc, info.owned > 0 ? '' : MINISTRIES[id].blurb);
      const nextMs = BALANCE.ministryMilestones.find((m) => info.owned < m.owned);
      const visual = BALANCE.visualMilestones.find((m) => info.owned < m);
      setText(row.perf, info.owned > 0
        ? `${formatRate(info.perUnit)}/s each \u00b7 +${formatNumber(info.tickAmount)} every ${info.cycle}s${nextMs ? ` \u00b7 \u00d7${nextMs.mult} at ${nextMs.owned}` : ''}`
        : `${formatRate(info.perUnit)}/s each, reported every ${info.cycle}s`);
      let n = 1;
      let cost = info.cost1;
      let after = info.after1;
      if (this.buyMode === 10) {
        n = 10;
        cost = info.cost10;
        after = info.after10;
      } else if (this.buyMode === 'max') {
        n = Math.max(1, info.maxN);
        cost = info.maxN > 0 ? info.costMax : info.cost1;
        after = info.maxN > 0 ? info.afterMax : info.after1;
      }
      setText(row.next, `Buy \u00d7${n}: ${formatRate(info.production)} \u2192 ${formatRate(after)}/s (+${formatRate(after - info.production)})${visual ? ` \u00b7 street grows at ${visual}` : ''}`);
      setText(row.label, n === 1 ? 'Buy' : `Buy \u00d7${n}`);
      setText(row.cost, `${formatCost(cost)} Seeds`);
      row.buy.disabled = gen.seeds < cost;
    }
    this.refreshDisciples(force);
  }

  refreshDisciples(force) {
    const game = this.game;
    const gen = this.state.gen;
    const visible = gen.disciples.filter((d) => d.status !== 'hidden');
    const unlockedLines = MINISTRY_ORDER.filter((id) => game.isMinistryUnlocked(id));
    const sig = visible.map((d) => `${d.id}:${d.status}:${d.assigned}:${gen.seeds >= game.discipleDef(d.id).cost ? 1 : 0}`).join('|') + unlockedLines.join(',') + (gen.milestones.timothySeen ? 't' : '') + `L${game.learnedCount}`;
    if (!force && sig === this.sigs.disciples) return;
    this.sigs.disciples = sig;
    clear(this.discBox);
    if (visible.length === 0) return;
    this.discBox.append(h('div', { class: 'section-title' }, h('span', { text: 'Disciples' }), h('span', { text: `${gen.disciples.filter((d) => d.status === 'trained').length} trained` })));
    if (gen.milestones.timothySeen) {
      this.discBox.append(h('div', { class: 'note verse', text: `“${TIMOTHY_TEXT.text.replace(/^“|”$/g, '')}” — ${TIMOTHY_TEXT.ref}` }));
    }
    if (game.learnedCount > 0 || game.automationHelper()) {
      this.discBox.append(h('div', { class: 'note' },
        h('b', { text: COACH.summary(game.learnedCount, situationCount()) }), ' ',
        game.learnedCount > 0 ? COACH.summaryHelp : COACH.summaryHow));
    }
    for (const d of visible) {
      const def = DISCIPLES[d.id];
      const cfg = game.discipleDef(d.id);
      const convert = gen.conversionState.converts[d.id === 'hannah' ? 0 : d.id === 'elias' ? 1 : -1];
      const convertNote = convert ? ` ${convert.name}, who turned to Christ on your street, has asked to learn alongside.` : '';
      const info = h('div', { class: 'info' }, h('div', { class: 'name', text: def.name }), h('div', { class: 'desc', text: d.status === 'candidate' ? `${def.role}. ${def.intro}${convertNote}` : def.role }));
      let right = null;
      if (d.status === 'candidate') {
        right = h('button', { class: 'buy', type: 'button', disabled: gen.seeds < cfg.cost, 'aria-label': `Train ${def.name}`, on: { click: () => game.trainDisciple(d.id) } }, h('span', { text: 'Train' }), h('small', { text: `${formatCost(cfg.cost)} Seeds` }));
      } else {
        const chips = h('div', { class: 'assign' });
        for (const lineId of unlockedLines) {
          chips.append(h('button', { type: 'button', class: d.assigned === lineId ? 'on' : '', 'aria-pressed': String(d.assigned === lineId), text: MINISTRIES[lineId].name, on: { click: () => { game.assignDisciple(d.id, lineId); this.sigs.disciples = null; } } }));
        }
        info.append(h('div', { class: 'desc', text: `Strengthens ${MINISTRIES[d.assigned]?.name || 'a ministry'} and helps carry conversations.` }), chips);
      }
      this.discBox.append(h('div', { class: 'row' }, h('div', { class: 'ico' }, icon('disciple', 24)), info, right));
    }
  }

  // ---- Upgrades tab
  /** One upgrade card: what it does in numbers, what it costs, and how long it takes to pay for itself. */
  upgradeRow(id, preview, { best = false, fork = false } = {}) {
    const game = this.game;
    const def = BALANCE.upgrades[id];
    const text = UPGRADE_TEXT[id];
    const funds = def.currency === 'funds';
    const afford = game.canAffordUpgrade(id);
    const effect = [];
    if (preview.delta > 0.005) {
      const pct = preview.before > 0 ? ` (+${Math.round((preview.delta / preview.before) * 100)}%)` : '';
      effect.push(`+${formatRate(preview.delta)} Seeds/s${pct}`);
      if (preview.paybackSeconds) effect.push(`pays for itself in about ${formatDuration(preview.paybackSeconds)}`);
    }
    if (preview.readiness && preview.readiness.after > preview.readiness.before * 1.005) {
      effect.push(`Professor readiness ${preview.readiness.before.toFixed(2)} \u2192 ${preview.readiness.after.toFixed(2)}`);
    }
    let eta = null;
    if (!afford) {
      eta = h('div', { class: 'eta' });
      this.etaEls.push({ el: eta, id });
    }
    return h('div', { class: `row up-row tag-${def.tag}${afford ? ' can' : ''}${fork ? ' in-fork' : ''}` },
      h('div', { class: 'info' },
        h('div', { class: 'name' }, text.name, ' ',
          h('span', { class: `chip ${funds ? 'funds' : ''}`, text: UPGRADE_TAG_LABEL[def.tag] }),
          best ? h('span', { class: 'chip best', text: 'Best value' }) : null),
        h('div', { class: 'desc', text: text.desc }),
        effect.length ? h('div', { class: 'effect', text: effect.join(' \u00b7 ') }) : null,
        eta),
      h('button', { class: `buy ${funds ? 'funds' : ''}`, type: 'button', disabled: !afford, 'aria-label': `${fork ? 'Choose' : 'Buy'} ${text.name}`, on: { click: (e) => (fork ? this.armFork(e.currentTarget, id) : game.buyUpgrade(id)) } },
        h('span', { text: fork ? 'Choose' : 'Buy' }), h('small', { text: `${formatCost(def.cost)} ${funds ? 'Provisions' : 'Seeds'}` })));
  }

  /** A path closes the other one for the whole generation, so the first tap arms the button and the second confirms. */
  armFork(btn, id) {
    if (btn.classList.contains('armed')) {
      this.game.buyUpgrade(id);
      return;
    }
    const label = btn.querySelector('span');
    btn.classList.add('armed');
    label.textContent = 'Confirm?';
    setTimeout(() => {
      btn.classList.remove('armed');
      label.textContent = 'Choose';
    }, 3500);
  }

  refreshUpgradesTab() {
    const game = this.game;
    const gen = this.state.gen;
    const ids = Object.keys(BALANCE.upgrades);
    const visible = ids.filter((id) => game.isUpgradeVisible(id));
    const open = visible.filter((id) => !gen.upgrades[id] && !game.isUpgradeForgone(id));
    const sig = visible.map((id) => `${id}${gen.upgrades[id] ? 'o' : game.isUpgradeForgone(id) ? 'x' : game.canAffordUpgrade(id) ? 'y' : 'n'}`).join('') + gen.clustersUnlocked.length + (gen.fundsUnlocked ? 'f' : '');
    if (sig === this.sigs.upgrades) {
      this.updateEtas();
      return;
    }
    this.sigs.upgrades = sig;
    this.etaEls = [];
    const tab = this.tabs.upgrades;
    clear(tab);
    const total = ids.length - ids.filter((id) => BALANCE.upgrades[id].exclusiveWith).length / 2;
    tab.append(h('div', { class: 'section-title' }, h('span', { text: 'Upgrades' }), h('span', { text: `${Object.keys(gen.upgrades).length} / ${total}` })));
    const previews = Object.fromEntries(open.map((id) => [id, game.upgradePreview(id)]));
    const passive = open.filter((id) => previews[id].paybackSeconds);
    const bestId = passive.length > 1 ? passive.reduce((a, c) => (previews[c].paybackSeconds < previews[a].paybackSeconds ? c : a)) : null;
    open.sort((a, b) => {
      const A = BALANCE.upgrades[a];
      const B = BALANCE.upgrades[b];
      if (A.currency !== B.currency) return A.currency === 'seeds' ? -1 : 1;
      return A.cost - B.cost;
    });
    if (open.length === 0) tab.append(h('div', { class: 'note', text: visible.length ? 'Everything available is owned. More will appear as your ministry grows.' : 'Nothing to buy yet. Keep planting.' }));
    const done = new Set();
    for (const id of open) {
      if (done.has(id)) continue;
      const def = BALANCE.upgrades[id];
      if (def.exclusiveWith && open.includes(def.exclusiveWith)) {
        // A fork: two paths, one choice. Active and passive builds both stay viable.
        const other = def.exclusiveWith;
        done.add(id);
        done.add(other);
        tab.append(h('div', { class: 'fork' },
          h('div', { class: 'fork-title', text: 'Choose one path \u2014 the other closes' }),
          this.upgradeRow(id, previews[id], { fork: true }),
          this.upgradeRow(other, previews[other], { fork: true })));
        continue;
      }
      done.add(id);
      tab.append(this.upgradeRow(id, previews[id], { best: id === bestId }));
    }
    // What is coming: the next set of upgrades and when it arrives.
    const nextCluster = [1, 2, 3, 4].find((n) => !gen.clustersUnlocked.includes(n));
    if (nextCluster) {
      const c = BALANCE.clusters[nextCluster];
      const count = ids.filter((id) => BALANCE.upgrades[id].cluster === nextCluster).length;
      tab.append(h('div', { class: 'note teaser', text: `Coming: ${count} more upgrades at ${formatCost(c.totalSeeds)} Seeds planted (or minute ${Math.round(c.genSeconds / 60)}).` }));
    }
    const hiddenReq = ids.filter((id) => BALANCE.upgrades[id].requires && !game.isUpgradeVisible(id) && gen.clustersUnlocked.includes(BALANCE.upgrades[id].cluster));
    for (const id of hiddenReq) {
      const r = BALANCE.upgrades[id].requires;
      tab.append(h('div', { class: 'note teaser', text: `${UPGRADE_TEXT[id].name}: needs ${r.owned} ${MINISTRIES[r.ministry].name}.` }));
    }
    if (!gen.fundsUnlocked) tab.append(h('div', { class: 'note', text: 'Supplies bought with Provisions will appear here once Provisions are introduced.' }));
    const owned = visible.filter((id) => gen.upgrades[id]);
    if (owned.length) {
      const rows = owned.map((id) => h('div', { class: 'row' }, h('div', { class: 'info' }, h('div', { class: 'name' }, UPGRADE_TEXT[id].name, h('small', { text: '\u2713' })), h('div', { class: 'desc', text: UPGRADE_TEXT[id].desc }))));
      if (owned.length > 6) {
        // A long list of what you already have stays out of the way unless you want it.
        const details = h('details', { class: 'owned', open: this.ownedOpen }, h('summary', { text: `Owned (${owned.length})` }), ...rows);
        details.addEventListener('toggle', () => { this.ownedOpen = details.open; });
        tab.append(details);
      } else {
        tab.append(h('div', { class: 'section-title', text: 'Owned' }), ...rows);
      }
    }
    this.updateEtas();
  }

  /** "Affordable in ~1m 20s" under upgrades you cannot buy yet, from what your ministries are earning right now. */
  updateEtas() {
    const gen = this.state.gen;
    for (const { el, id } of this.etaEls) {
      const def = BALANCE.upgrades[id];
      const funds = def.currency === 'funds';
      const need = def.cost - (funds ? gen.funds : gen.seeds);
      const rate = funds ? this.game.fundsPerSec : this.game.seedsPerSec;
      setText(el, need > 0 && rate > 0.01 ? `Affordable in ~${formatDuration(need / rate)}` : '');
    }
  }

  // ---- Legacy tab
  refreshLegacyTab() {
    const state = this.state;
    const game = this.game;
    const sig = `lg${state.phase}${state.currencies.faithfulness}${Object.keys(state.prestige.nodes).join(',')}`;
    if (sig === this.sigs.legacy) return;
    this.sigs.legacy = sig;
    const tab = this.tabs.legacy;
    clear(tab);
    if (state.phase === 'gen1') return;
    const fa = state.currencies.faithfulness;
    tab.append(
      h('div', { class: 'faith-reveal' }, h('div', { class: 'stat-label', text: 'Faithfulness' }), h('div', { class: 'big', text: String(fa) }), h('div', { class: 'desc', style: 'margin-top:4px', text: 'Enduring fruit carried into the next generation. Spent on permanent legacy upgrades below.' })),
    );
    for (const [branchId, branch] of Object.entries(PRESTIGE_BRANCHES)) {
      const box = h('div', { class: `branch ${branchId}` }, h('h4', { text: `${branch.name} · ${branch.blurb}` }));
      for (const [id, def] of Object.entries(BALANCE.prestige.nodes)) {
        if (def.branch !== branchId) continue;
        const text = PRESTIGE_TEXT[id];
        const owned = !!state.prestige.nodes[id];
        const locked = def.requires && !state.prestige.nodes[def.requires];
        const can = state.phase === 'gen2preview' && !owned && !locked && fa >= def.cost;
        const right = owned
          ? h('div', { class: 'buy', style: 'background:#2a2f3b;box-shadow:none;color:#9ad07a' }, h('span', { text: '✓ Owned' }))
          : h('button', { class: 'buy', type: 'button', disabled: !can, 'aria-label': `Spend ${def.cost} Faithfulness on ${text.name}`, on: { click: () => game.buyPrestigeNode(id) } }, h('span', { text: locked ? 'Locked' : 'Take' }), h('small', { text: `${def.cost} Faithfulness` }));
        box.append(h('div', { class: `row ${locked ? 'locked' : ''}` }, h('div', { class: 'info' }, h('div', { class: 'name', text: text.name }), h('div', { class: 'desc', text: text.desc + (locked ? ` Requires ${PRESTIGE_TEXT[def.requires].name}.` : '') })), right));
      }
      tab.append(box);
    }
    const mods = computeModifiers(state);
    const bonus = [];
    if (mods.proclaimPct) bonus.push(`+${Math.round(mods.proclaimPct * 100)}% weight in exchanges`);
    if (mods.passivePct) bonus.push(`+${Math.round(mods.passivePct * 100)}% passive ministry`);
    if (mods.startSeeds) bonus.push(`begin with ${formatNumber(mods.startSeeds)} Seeds`);
    const startMin = Object.entries(mods.startMinistry).map(([k, v]) => `${v} ${MINISTRIES[k].name}`);
    if (startMin.length) bonus.push(`${startMin.join(' and ')} already established`);
    if (mods.wordPct) bonus.push(`+${Math.round(mods.wordPct * 100)}% Word strength`);
    if (mods.discipleLinePct) bonus.push(`+${Math.round(mods.discipleLinePct * 100)}% from disciples`);
    tab.append(
      h('div', { class: 'preview-card' },
        h('h3', { text: `${GEN2_PREVIEW.title} — preview` }),
        h('div', { text: bonus.length ? `Your legacy will begin with: ${bonus.join('; ')}.` : 'Spend Faithfulness above to shape how the next generation begins. A second generation starts faster — with believers already on the street.' }),
        h('div', { class: 'note', style: 'margin-top:8px', text: GEN2_PREVIEW.locked }),
        h('div', { style: 'margin-top:8px' }, h('button', { class: 'btn ghost small', type: 'button', text: 'Review Generation I', on: { click: () => this.reviewGenerationOne() } }))),
    );
    tab.append(h('div', { class: 'version', text: BRAND.subtitle }));
  }

  // ---------------------------------------------------------------- prestige sequence
  beginNextGeneration() {
    const result = this.game.beginNextGeneration();
    if (!result.ok) return;
    this.closeModal();
    this.audio.unlock();
    this.audio.sfx('prestige');
    this.sigs = {};
    this.startMontage();
  }

  startMontage(duration = NEXT_GENERATION.duration) {
    this.montage = { start: performance.now(), duration, beatIndex: -1, titleShown: false };
    this.renderer.startMontage(duration);
    this.els.montage.className = '';
    clear(this.els.montage);
    this.beatBox = h('div', { class: 'beat' });
    this.els.montage.append(
      h('button', { class: 'btn ghost small skip', type: 'button', text: 'Skip', on: { click: () => this.endMontage() } }),
      this.beatBox,
      h('div', { class: 'psalm' }, NEXT_GENERATION.psalm.text, h('span', { text: `${NEXT_GENERATION.psalm.ref} · ESV` })),
    );
    this.syncPhase();
  }

  syncMontage(nowMs) {
    const m = this.montage;
    if (!m) return;
    const t = (nowMs - m.start) / 1000;
    if (t >= m.duration) {
      this.endMontage();
      return;
    }
    let idx = -1;
    NEXT_GENERATION.beats.forEach((b, i) => {
      if (t >= b.at) idx = i;
    });
    if (idx !== m.beatIndex && idx >= 0) {
      m.beatIndex = idx;
      clear(this.beatBox);
      this.beatBox.append(h('div', { text: NEXT_GENERATION.beats[idx].text }));
    }
    if (!m.titleShown && t >= m.duration - 3.2) {
      m.titleShown = true;
      clear(this.beatBox);
      this.beatBox.append(h('div', { class: 'title', text: NEXT_GENERATION.title }));
    }
  }

  endMontage() {
    if (!this.montage) return;
    this.montage = null;
    this.renderer.endMontage();
    setHidden(this.els.montage, true);
    clear(this.els.montage);
    this.syncPhase();
    this.showTab('legacy');
    this.hooks.saveNow();
  }
}
