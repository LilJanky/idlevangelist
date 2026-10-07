// Entry point: boot, persistence wiring, offline return, and the render/simulation loop.
import { BALANCE } from './config/balance.js';
import { createInitialState } from './core/state.js';
import { Game } from './systems/game.js';
import { loadState, saveState, clearSave, createMemoryStorage, SAVE_KEY, DEBUG_SAVE_KEY } from './systems/save.js';
import { clampOfflineSeconds } from './systems/offline.js';
import { Renderer } from './render/renderer.js';
import { AudioSystem } from './audio/audio.js';
import { UI } from './ui/ui.js';
import { createDebugTools } from './debug/debug.js';

const params = new URLSearchParams(window.location.search);
const debugMode = params.get('debug') === '1';
const saveKey = debugMode ? DEBUG_SAVE_KEY : SAVE_KEY;

let storage;
let storageOk = true;
try {
  storage = window.localStorage;
  storage.setItem('idlevangelist.probe', '1');
  storage.removeItem('idlevangelist.probe');
} catch {
  storage = createMemoryStorage();
  storageOk = false;
}

const now = Date.now();
const loaded = loadState(storage, saveKey);
const state = loaded.state || createInitialState(now);
const game = new Game({ state, debug: debugMode });
const offlineGains = loaded.state ? game.creditOfflineSinceSave(now) : null;

let saveFailedNotified = false;
let resetting = false;
let ui;
function saveNow() {
  if (resetting) return;
  const ok = saveState(storage, saveKey, game.state, Date.now());
  if (!ok && !saveFailedNotified && ui) {
    saveFailedNotified = true;
    ui.toast('Progress could not be saved in this browser.', '', 6000);
  }
}
let saveQueued = false;
function saveSoon() {
  if (saveQueued) return;
  saveQueued = true;
  setTimeout(() => {
    saveQueued = false;
    saveNow();
  }, 400);
}

const canvas = document.getElementById('world');
const renderer = new Renderer(canvas, game);
const audio = new AudioSystem();
ui = new UI({
  game,
  renderer,
  audio,
  hooks: {
    saveNow,
    saveSoon,
    reset() {
      resetting = true;
      clearSave(storage, saveKey);
      window.location.href = window.location.pathname + (debugMode ? '?debug=1' : '');
    },
  },
  debugFactory: debugMode ? createDebugTools(game, { saveNow }) : null,
});
ui.init();
renderer.resize();
new ResizeObserver(() => renderer.resize()).observe(canvas);
window.addEventListener('resize', () => renderer.resize());

if (!storageOk) ui.toast('Saving is unavailable here; progress lasts for this session only.', '', 6000);
if (loaded.status === 'corrupt') ui.toast('A damaged save was set aside. Starting fresh.', '', 6000);
if (debugMode) ui.toast('Debug mode: separate save slot. Open Menu for tools.', 'gold', 5000);
if (offlineGains && offlineGains.seconds >= BALANCE.offline.minSecondsForSummary && game.state.phase === 'gen1' && (offlineGains.seeds > 0 || offlineGains.funds > 0)) {
  if (state.introSeen) ui.showOffline(offlineGains);
}

// Persistence hooks: periodic autosave plus lifecycle events.
setInterval(saveNow, BALANCE.autosaveSeconds * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveNow();
});
// A reason to come back: while the tab is in the background the page title announces when WORD has finished preparing.
const baseTitle = document.title;
let awayCheck = null;
document.addEventListener('visibilitychange', () => {
  clearInterval(awayCheck);
  document.title = baseTitle;
  if (!document.hidden) return;
  const from = { at: Date.now(), word: game.state.gen.street.word };
  awayCheck = setInterval(() => {
    const w = BALANCE.street.word;
    if (game.state.phase !== 'gen1' || !game.state.gen.scripturesUnlocked.length) return;
    const predicted = from.word + ((Date.now() - from.at) / 1000) * w.passivePerSecond * (1 + game.mods.wordCharge);
    if (predicted >= w.max) document.title = `\u25cf The Word is ready \u2014 ${baseTitle}`;
  }, 5000);
});
window.addEventListener('pagehide', saveNow);
window.addEventListener('beforeunload', saveNow);

// Main loop. Large gaps (backgrounded tab) are credited as offline time rather than simulated frame by frame.
let last = performance.now();
let lastWall = Date.now();
function loop(t) {
  const wall = Date.now();
  let dt = (t - last) / 1000;
  last = t;
  const wallGap = (wall - lastWall) / 1000;
  lastWall = wall;
  if (wallGap > 5) {
    const seconds = clampOfflineSeconds(wall - wallGap * 1000, wall);
    const gains = game.creditOffline(seconds);
    if (gains.seconds >= BALANCE.offline.minSecondsForSummary && (gains.seeds > 0 || gains.funds > 0) && !ui.modalOpen) ui.showOffline(gains);
    dt = 0;
  }
  if (dt > 0) {
    dt = Math.min(dt, BALANCE.sim.maxCatchUpSeconds);
    let left = dt;
    while (left > 1e-6) {
      const step = Math.min(BALANCE.sim.maxFrameDt, left);
      game.tick(step);
      left -= step;
    }
  }
  if (!document.hidden) {
    // A rendering/UI fault must never stop the simulation or the loop: log it once and keep playing.
    try {
      renderer.draw(t);
      ui.frame(t, dt);
    } catch (err) {
      if (err?.message !== lastFrameError) {
        lastFrameError = err?.message;
        console.error('Frame error (the game keeps running):', err);
      }
    }
  }
  requestAnimationFrame(loop);
}
let lastFrameError = null;
requestAnimationFrame(loop);

if (debugMode) window.__idlevangelist = { game, ui, renderer, audio };
