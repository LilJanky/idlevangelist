// Seeded, deterministic randomness. No Math.random anywhere in simulation code.

export function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seedString) {
  return mulberry32(hashString(String(seedString)));
}

/** Pure keyed roll in [0,1): same (seed, keys) always yields the same value, so reloads cannot reroll. */
export function hashUnit(seed, ...keys) {
  return mulberry32(hashString(`${seed}|${keys.join('|')}`))();
}

export function rangeFrom(rng, [min, max]) {
  return min + (max - min) * rng();
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

export function newSeedString() {
  const bytes = new Uint32Array(3);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 3; i++) bytes[i] = Math.floor(Math.random() * 4294967296);
  return Array.from(bytes, (b) => b.toString(36)).join('-');
}
