// How much of each ministry the street scene shows. Pure functions so rendering, notices and tests agree.
import { BALANCE } from '../config/balance.js';

/** 0 = nothing owned; 1..n = how many visual milestones (default 1 / 5 / 10 / 25 owned) have been reached. */
export function visualTier(owned, milestones = BALANCE.visualMilestones) {
  let tier = 0;
  milestones.forEach((m, i) => {
    if (owned >= m) tier = i + 1;
  });
  return tier;
}

/** The highest visual milestone newly crossed by going from `before` to `after` owned, or null. */
export function crossedMilestone(before, after, milestones = BALANCE.visualMilestones) {
  const a = visualTier(before, milestones);
  const b = visualTier(after, milestones);
  if (b <= a) return null;
  return { tier: b, threshold: milestones[b - 1] };
}

const BY_TIER = {
  tractStacks: [0, 1, 2, 3, 4], // table piles -> rack -> second table
  bibleStacks: [0, 1, 2, 3, 4], // single stack -> more stacks -> crates -> distribution display
  tables: [0, 1, 2, 3, 4], // street-team tables set up across the street (each investment tier adds one)
  studyAttendees: [0, 2, 3, 4, 6], // seated at the Bible-study bench
  gatherers: [0, 2, 3, 5, 7], // the discipleship gathering
};

export function visualCounts(owned, milestones = BALANCE.visualMilestones) {
  const tier = visualTier(owned, milestones);
  const out = { tier };
  for (const [key, arr] of Object.entries(BY_TIER)) out[key] = arr[Math.min(tier, arr.length - 1)];
  return out;
}
