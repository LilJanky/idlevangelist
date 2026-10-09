// Generated retro audio (Web Audio). Nothing starts until `unlock()` is called from a user gesture.
// Audio is never required to understand the game; every cue has a visual counterpart.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

const MOODS = {
  street: { root: 57, scale: [0, 3, 5, 7, 10], bpm: 62, wave: 'triangle', pad: [0, 7], pattern: [0, 2, 4, 2, 3, 1, 2, 0], gain: 0.5 },
  boss: { root: 52, scale: [0, 1, 4, 5, 7, 8], bpm: 108, wave: 'square', pad: [0, 7], pattern: [0, 0, 3, 0, 2, 0, 4, 3], gain: 0.34 },
  hope: { root: 60, scale: [0, 2, 4, 7, 9], bpm: 70, wave: 'triangle', pad: [0, 7, 12], pattern: [0, 2, 4, 3, 2, 4, 1, 3], gain: 0.5 },
};

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.settings = { music: true, sfx: true, musicVolume: 0.5, sfxVolume: 0.7, muted: false };
    this.mood = 'street';
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.ambience = null;
    this.duck = 1;
  }

  get ready() {
    return !!this.ctx;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.master.connect(ctx.destination);
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.noise = this.makeNoise();
    this.startAmbience();
    this.apply();
    this.nextTime = ctx.currentTime + 0.2;
    this.timer = setInterval(() => this.schedule(), 120);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else if (!this.settings.muted) this.ctx.resume();
    });
  }

  setSettings(s) {
    Object.assign(this.settings, s);
    this.apply();
  }

  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.settings;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music ? s.musicVolume * 0.5 * this.duck : 0, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(s.sfx ? s.sfxVolume * 0.8 : 0, t, 0.05);
  }

  makeNoise() {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
    return buffer;
  }

  startAmbience() {
    const ctx = this.ctx;
    const mk = (type, freq, gain) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(this.musicBus);
      src.start();
      return { src, g, f };
    };
    this.ambience = { rain: mk('highpass', 3200, 0.06), crowd: mk('lowpass', 420, 0.09) };
  }

  /** Ambient mix follows the scene: rain fades as the city is restored; crowd swells for a public exchange. */
  setAmbience({ rain = 1, crowd = 0.5 } = {}) {
    if (!this.ambience) return;
    const t = this.ctx.currentTime;
    this.ambience.rain.g.gain.setTargetAtTime(0.06 * rain, t, 0.6);
    this.ambience.crowd.g.gain.setTargetAtTime(0.09 * crowd, t, 0.6);
  }

  setMood(mood) {
    if (MOODS[mood]) this.mood = mood;
  }

  duckMusic(seconds) {
    if (!this.ctx) return;
    this.duck = 0.25;
    this.apply();
    setTimeout(() => {
      this.duck = 1;
      this.apply();
    }, seconds * 1000);
  }

  schedule() {
    if (!this.ctx || !this.settings.music || this.settings.muted || this.ctx.state !== 'running') return;
    const mood = MOODS[this.mood];
    const stepLen = 60 / mood.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.4) {
      const i = this.step % mood.pattern.length;
      const deg = mood.scale[mood.pattern[i] % mood.scale.length];
      const oct = mood.pattern[i] > 3 ? 12 : 0;
      this.tone(NOTE(mood.root + 12 + deg + oct), this.nextTime, stepLen * 1.6, mood.wave, 0.07 * mood.gain, this.musicBus);
      if (this.step % 8 === 0) {
        for (const p of mood.pad) this.tone(NOTE(mood.root + p), this.nextTime, stepLen * 7.5, 'sine', 0.05 * mood.gain, this.musicBus, 0.6);
      }
      if (this.mood === 'boss' && this.step % 2 === 0) this.tone(NOTE(mood.root - 12), this.nextTime, stepLen * 0.9, 'square', 0.06, this.musicBus);
      this.nextTime += stepLen;
      this.step++;
    }
  }

  tone(freq, when, dur, wave = 'square', vol = 0.1, bus = this.sfxBus, attack = 0.01, slideTo = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(bus);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  noiseBurst(when, dur, freq, vol, type = 'bandpass') {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  /** A crowd cheering: band-limited noise that swells in and fades out. */
  cheer(when, dur) {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    for (const [freq, vol] of [[900, 0.1], [1900, 0.07]]) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(vol, when + 0.5);
      g.gain.linearRampToValueAtTime(vol * 0.7, when + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      src.connect(f).connect(g).connect(this.sfxBus);
      src.start(when);
      src.stop(when + dur + 0.05);
    }
  }

  sfx(name, arg = 0) {
    if (!this.ctx || !this.settings.sfx || this.settings.muted || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'proclaim':
        this.tone(NOTE(72 + Math.min(7, Math.round(arg * 8))), t, 0.07, 'square', 0.05);
        break;
      case 'crit':
        // a crit: a low thump under a bright rising ring and a shimmer
        this.tone(NOTE(43), t, 0.28, 'sine', 0.12, this.sfxBus, 0.005);
        this.tone(NOTE(79), t, 0.08, 'square', 0.08);
        this.tone(NOTE(84), t + 0.06, 0.1, 'square', 0.08);
        this.tone(NOTE(91), t + 0.12, 0.2, 'square', 0.08);
        this.noiseBurst(t, 0.3, 3200, 0.04, 'highpass');
        break;
      case 'drop':
        // the run slips: two falling notes
        this.tone(NOTE(67), t, 0.1, 'triangle', 0.07);
        this.tone(NOTE(60), t + 0.09, 0.2, 'triangle', 0.07);
        break;
      case 'word':
        this.tone(NOTE(76), t, 0.4, 'sine', 0.1, this.sfxBus, 0.01);
        this.tone(NOTE(83), t + 0.06, 0.5, 'sine', 0.07);
        break;
      case 'wordBurst': {
        // a rising arpeggio with a shimmer; more people reached = more notes and a fuller sound
        const reach = Math.max(1, Math.round(arg));
        const notes = [72, 76, 79, 84, 88, 91, 96, 100];
        const n = Math.min(notes.length, 2 + Math.floor(reach * 0.8));
        this.tone(NOTE(48), t, 0.9, 'sine', 0.08, this.sfxBus, 0.05);
        for (let i = 0; i < n; i++) this.tone(NOTE(notes[i]), t + i * 0.055, 0.45 + i * 0.03, i % 2 ? 'triangle' : 'sine', 0.07);
        if (reach >= 4) this.noiseBurst(t, 0.7, 2600, 0.03, 'highpass');
        break;
      }
      case 'chain': {
        // a bright run up, longer the longer the chain
        const k = Math.max(1, Math.min(6, Math.round(arg)));
        for (let i = 0; i < 2 + Math.min(4, k); i++) this.tone(NOTE(79 + i * 2 + k), t + i * 0.04, 0.12, 'square', 0.045);
        break;
      }
      case 'slam': {
        // WORD lands: a low hit and a rising shimmer, bigger with the step
        const k = Math.max(0, Math.min(4, Math.round(arg)));
        this.tone(NOTE(36 + k), t, 0.5, 'sine', 0.12, this.sfxBus, 0.01);
        this.noiseBurst(t, 0.35 + 0.08 * k, 900, 0.05 + 0.01 * k, 'lowpass');
        break;
      }
      case 'crowdTier': {
        // reaching a bigger step while holding WORD: a short rising figure, one note higher per step
        const k = Math.max(1, Math.min(4, Math.round(arg)));
        for (let i = 0; i < 2 + k; i++) this.tone(NOTE(76 + i * 3 + k), t + i * 0.05, 0.2, 'triangle', 0.045);
        break;
      }
      case 'event':
        this.tone(NOTE(79), t, 0.14, 'triangle', 0.07);
        this.tone(NOTE(74), t + 0.14, 0.2, 'triangle', 0.07);
        break;
      case 'purchase':
        this.tone(NOTE(76), t, 0.07, 'square', 0.06);
        this.tone(NOTE(81), t + 0.07, 0.1, 'square', 0.06);
        this.tone(NOTE(88), t + 0.14, 0.16, 'square', 0.06);
        break;
      case 'reward':
        this.tone(NOTE(84), t, 0.06, 'triangle', 0.07);
        this.tone(NOTE(91), t + 0.06, 0.1, 'triangle', 0.06);
        break;
      case 'special':
        this.tone(NOTE(88), t, 0.12, 'sine', 0.09);
        this.tone(NOTE(93), t + 0.1, 0.25, 'sine', 0.08);
        break;
      case 'unlock':
        this.tone(NOTE(72), t, 0.15, 'triangle', 0.08);
        this.tone(NOTE(79), t + 0.12, 0.15, 'triangle', 0.08);
        this.tone(NOTE(84), t + 0.24, 0.3, 'triangle', 0.08);
        break;
      case 'conversion':
        this.duckMusic(5);
        this.noiseBurst(t, 3.5, 900, 0.05, 'bandpass');
        [60, 67, 72, 76].forEach((n, i) => this.tone(NOTE(n), t + 0.3 + i * 0.35, 3.2, 'sine', 0.08, this.sfxBus, 0.5));
        break;
      case 'boss':
        this.tone(NOTE(45), t, 0.6, 'sawtooth', 0.08, this.sfxBus, 0.02, NOTE(40));
        this.tone(NOTE(52), t + 0.1, 0.5, 'square', 0.05);
        break;
      case 'bossWin':
        [64, 67, 72, 76, 79].forEach((n, i) => this.tone(NOTE(n), t + i * 0.12, 0.5, 'triangle', 0.09));
        break;
      case 'fanfare': {
        // timpani, a rising call in horns, a held chord, and a swell of cheering
        this.tone(NOTE(36), t, 0.7, 'sine', 0.2, this.sfxBus, 0.005, NOTE(28));
        this.noiseBurst(t, 0.25, 220, 0.12, 'lowpass');
        [[60, 0], [64, 0.16], [67, 0.32], [72, 0.5]].forEach(([n, d]) => {
          this.tone(NOTE(n), t + d, 0.5, 'sawtooth', 0.045, this.sfxBus, 0.02);
          this.tone(NOTE(n + 12), t + d, 0.5, 'square', 0.025, this.sfxBus, 0.02);
        });
        [60, 64, 67, 72, 76].forEach((n) => {
          this.tone(NOTE(n), t + 0.8, 2.6, 'sawtooth', 0.04, this.sfxBus, 0.06);
          this.tone(NOTE(n), t + 0.8, 3.2, 'sine', 0.05, this.sfxBus, 0.2);
        });
        [84, 88, 91, 96].forEach((n, i) => this.tone(NOTE(n), t + 0.9 + i * 0.09, 0.7, 'triangle', 0.05));
        this.cheer(t + 0.5, 3.4);
        this.duckMusic(3.5);
        break;
      }
      case 'pop':
        this.noiseBurst(t, 0.18, 1800 + Math.random() * 1200, 0.07, 'highpass');
        this.tone(NOTE(84 + Math.floor(Math.random() * 12)), t + 0.02, 0.35, 'sine', 0.035, this.sfxBus, 0.005);
        break;
      case 'tick':
        this.tone(NOTE(88 + Math.min(8, Math.round(arg * 8))), t, 0.04, 'square', 0.03);
        break;
      case 'passed':
        this.tone(NOTE(67), t, 0.3, 'sine', 0.08, this.sfxBus, 0.01, NOTE(60));
        break;
      case 'prestige':
        [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), t + i * 0.4, 1.6, 'sine', 0.09, this.sfxBus, 0.1));
        break;
      case 'click':
        this.tone(NOTE(70), t, 0.04, 'square', 0.04);
        break;
      default:
        break;
    }
  }
}
