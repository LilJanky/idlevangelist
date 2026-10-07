// Unlock conditions shared by Scripture, disciples, upgrade clusters, etc.

export function conditionMet(cond, state) {
  const gen = state.gen;
  if (cond.totalSeeds !== undefined) return gen.totalSeeds >= cond.totalSeeds;
  if (cond.ministry) return (gen.ministries[cond.ministry]?.owned || 0) >= cond.owned;
  if (cond.specials !== undefined) return gen.encounterStats.specialsCompleted >= cond.specials;
  if (cond.conversions !== undefined) return gen.conversionState.converts.length >= cond.conversions;
  if (cond.genSeconds !== undefined) return gen.genSeconds >= cond.genSeconds;
  return false;
}

export function unlockMet(unlock, state) {
  if (!unlock) return true;
  if (unlock.any) return unlock.any.some((c) => conditionMet(c, state));
  if (unlock.all) return unlock.all.every((c) => conditionMet(c, state));
  return conditionMet(unlock, state);
}
