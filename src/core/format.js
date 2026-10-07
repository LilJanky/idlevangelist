// Central number/time formatting.

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

/**
 * `round` picks the direction a shortened number is rounded: 'down' for what you have, 'up' for what something costs.
 * A balance that reads at least the shown price then always really covers it ("1.99M" never shows as "2M" against a 2M price).
 */
const ROUNDERS = { nearest: (x) => Math.round(x), down: (x) => Math.floor(x + 1e-6), up: (x) => Math.ceil(x - 1e-6) };

export function formatNumber(value, { decimals, round = 'nearest' } = {}) {
  if (!Number.isFinite(value)) return '0';
  const sign = value < 0 ? '-' : '';
  const n = Math.abs(value);
  const fix = ROUNDERS[round] || ROUNDERS.nearest;
  const places = (s) => (s < 10 ? 2 : s < 100 ? 1 : 0);
  const shorten = (s) => {
    const f = Math.pow(10, places(s));
    return fix(s * f) / f;
  };
  if (n < 1000) {
    const d = decimals ?? (n < 10 && n !== Math.floor(n) ? 1 : 0);
    if (round === 'nearest') return sign + (d > 0 ? n.toFixed(d).replace(/\.0+$/, '') : String(Math.floor(n + 1e-9)));
    const f = Math.pow(10, d);
    const r = fix(n * f) / f;
    if (r < 1000) return sign + (d > 0 ? r.toFixed(d).replace(/\.0+$/, '') : String(r));
  }
  let tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(Math.max(1, n)) / 3));
  let scaled = n / Math.pow(1000, tier);
  // 999.95K must not render as "1000K"
  if (shorten(scaled) >= 1000 && tier < SUFFIXES.length - 1) {
    tier += 1;
    scaled = n / Math.pow(1000, tier);
  }
  const f = Math.pow(10, places(scaled));
  const shown = round === 'nearest' ? Number(scaled.toFixed(places(scaled))) : fix(scaled * f) / f;
  const text = shown.toFixed(places(scaled));
  return sign + (text.includes('.') ? text.replace(/\.?0+$/, '') : text) + SUFFIXES[tier];
}

/** What something costs: never rounded below its real price. */
export const formatCost = (value) => formatNumber(value, { round: 'up' });
/** What you hold: never rounded above what you really have. */
export const formatHave = (value) => formatNumber(value, { round: 'down' });
export function formatRate(value) {
  if (value < 10) return value.toFixed(1).replace(/\.0$/, '');
  return formatNumber(value);
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
