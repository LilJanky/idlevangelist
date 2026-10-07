# IdleVangelist --- Generation 1 Acceptance Tests

The build is not complete until these are evaluated.

Use automated tests where deterministic. Use manual/browser verification
for experience and visuals.

## A. Boot and Basic UX

-   [ ] Fresh install/save loads without console-breaking errors.
-   [ ] Player can understand how to perform the first active
    interaction without reading external instructions.
-   [ ] First Seeds are earned immediately.
-   [ ] First meaningful ministry purchase is normally reachable within
    \~30--90 seconds.
-   [ ] Core gameplay fits at 390 × 844 with no horizontal overflow.
-   [ ] Important controls remain usable at 320 × 568.
-   [ ] Desktop centers the portrait experience cleanly.

## B. Economy

-   [ ] Seeds increase from both active encounters and passive ministry.
-   [ ] Ministry costs follow the configured geometric scaling.
-   [ ] Buy 1 / Buy 10 / Max calculations are correct where implemented.
-   [ ] Production remains frame-rate independent.
-   [ ] Large-number formatting is readable and consistent.
-   [ ] Funds unlock after the player already understands Seeds.
-   [ ] Funds only purchase mundane/material benefits.
-   [ ] Faithfulness cannot be purchased with Seeds or Funds.

## C. Active Encounters

-   [ ] Standard encounter can enter focus, receive Proclaim actions,
    resolve, reward, and exit.
-   [ ] Resistance is never labeled health.
-   [ ] Active impact uses satisfying number feedback.
-   [ ] Crits work.
-   [ ] Encounter chain works and decays as designed.
-   [ ] At least six standard archetypes exist.
-   [ ] Dialogue is short/skippable enough not to block incremental
    pacing.

## D. Scripture

-   [ ] Six Scripture abilities/references are implemented.
-   [ ] Scripture is mechanically useful.
-   [ ] Contextual relevance can provide bonuses.
-   [ ] Non-contextual Scripture remains truthful/useful rather than
    being treated as a false answer.
-   [ ] Scripture interaction does not become a mandatory quiz gate.
-   [ ] Scripture presentation is readable on mobile.

## E. Special Crowd Encounters

-   [ ] Special character is visually distinguishable from background
    crowd.
-   [ ] Special character can be tapped before leaving.
-   [ ] Touch target is forgiving.
-   [ ] Missing a special encounter does not punish or block
    progression.
-   [ ] Watchfulness-style upgrade can extend opportunity window.
-   [ ] At least five special archetypes exist.

## F. Conversion

-   [ ] Conversion is not guaranteed by encounter completion.
-   [ ] Conversion chance/outcome is not shown as a player-facing
    percentage.
-   [ ] Reloading cannot reroll an already-determined outcome.
-   [ ] Conversion presentation clearly distinguishes God's action from
    player "damage."
-   [ ] 1 Corinthians 3:6--7 / "God Gives the Growth" theology is
    represented.
-   [ ] Conversion does not award a "Souls" currency.
-   [ ] A boss/encounter can be successfully answered without
    conversion.
-   [ ] Debug mode can force the presentation for testing without
    redefining normal outcome logic.

## G. Passive Ministry and Disciples

-   [ ] Five ministry lines exist.
-   [ ] Their unlock order roughly follows the design pacing.
-   [ ] Passive production visibly changes the experience.
-   [ ] At least one disciple/helper appears before the late game.
-   [ ] Disciples automate or materially improve ministry.
-   [ ] 2 Timothy 2:2 is used appropriately when multiplication is
    introduced.
-   [ ] Game does not imply every convert instantly becomes a worker.

## H. Upgrades and Playstyles

-   [ ] Approximately 20 upgrades exist.
-   [ ] Upgrades are progressively disclosed.
-   [ ] Active-oriented upgrades are meaningful.
-   [ ] Scripture/special-encounter upgrades are meaningful.
-   [ ] Passive/automation upgrades are meaningful.
-   [ ] No class-selection screen is required at game start.
-   [ ] Hybrid play remains viable.
-   [ ] No obvious mandatory trap choice blocks progress.

## I. Offline Progress

-   [ ] Save timestamp is stored.
-   [ ] Closing and returning produces appropriate passive gains.
-   [ ] Return summary explains gains.
-   [ ] Offline time does not automatically resolve special encounters.
-   [ ] Offline time does not manufacture conversions.
-   [ ] Negative clock deltas do not grant/erase progress.
-   [ ] Extreme clock deltas are capped/handled safely.

## J. Boss

-   [ ] The Professor is foreshadowed before appearing.
-   [ ] Boss has three distinct phases.
-   [ ] Phases correspond broadly to naturalism, authority, and
    autonomy.
-   [ ] Scripture/Answer choices can create contextual advantages.
-   [ ] Proclaim remains usable.
-   [ ] Player may attempt before guaranteed victory.
-   [ ] Failure does not remove currencies/upgrades.
-   [ ] Failure message frames the opportunity passing, not player
    death.
-   [ ] Boss becomes retryable without an excessive wait.
-   [ ] Victory rewards only once.
-   [ ] Victory does not require Professor conversion.

## K. Generation Completion

-   [ ] Generation summary includes meaningful statistics.
-   [ ] No moral grade is based on conversion count.
-   [ ] Faithfulness is awarded by milestone-heavy formula.
-   [ ] Typical successful run earns roughly 10--13 Faithfulness.
-   [ ] Conversion count contributes little or nothing to required
    Faithfulness.
-   [ ] `Begin Next Generation` is a deliberate action.

## L. Next Generation

-   [ ] Prestige sequence includes generational passage of time.
-   [ ] Psalm 145:4 accompanies the transition.
-   [ ] World visibly retains/improves consequences of Generation 1.
-   [ ] Original ministry is not portrayed as simply erased.
-   [ ] New/younger evangelist appears.
-   [ ] Faithfulness persists.
-   [ ] Prestige tree appears only after the player understands the base
    game.
-   [ ] Player can purchase at least 2 meaningful prestige nodes with a
    normal first-run award.
-   [ ] Generation 2 may stop at a preview/coming-future-build state.

## M. Save and Persistence

-   [ ] Meaningful purchases autosave.
-   [ ] Reload preserves currencies, ministries, upgrades, disciples,
    boss state, and settings.
-   [ ] Save is versioned.
-   [ ] Corrupt/missing save fails safely.
-   [ ] Reset requires confirmation.
-   [ ] Faithfulness cannot be lost on ordinary reload/prestige.

## N. Audio and Settings

-   [ ] Audio begins only after allowed user interaction.
-   [ ] Music can be toggled/adjusted.
-   [ ] SFX can be toggled/adjusted.
-   [ ] Mute works.
-   [ ] Game remains fully understandable muted.
-   [ ] Reduced-motion preference is respected reasonably.

## O. Performance

-   [ ] Crowd does not create unbounded objects.
-   [ ] Particles/effects are capped.
-   [ ] Passive calculations are independent of render FPS.
-   [ ] Game remains responsive with late-Generation 1 crowd/ministry
    activity.
-   [ ] No severe memory leak appears during an extended session.

## P. Debug and Testability

-   [ ] Debug mode is inaccessible/hidden in ordinary play.
-   [ ] Debug can add Seeds/Funds.
-   [ ] Debug can spawn standard/special encounters.
-   [ ] Debug can show conversion presentation.
-   [ ] Debug can unlock/spawn/complete boss.
-   [ ] Debug can trigger Generation Complete/Next Generation.
-   [ ] Debug can simulate offline time.
-   [ ] Automated test suite passes.
-   [ ] Balance simulation/harness runs.

## Q. Balance/Timing

Verify with simulation plus at least one manual accelerated/normal-ish
playthrough: - \[ \] Engaged hybrid player targets first prestige in
25--35 minutes. - \[ \] First automation appears early enough to
demonstrate idle identity. - \[ \] Active attention provides a
noticeable advantage. - \[ \] Idle-oriented play remains viable. - \[ \]
Boss is not a trivial guaranteed animation when first available. - \[ \]
No multi-minute dead zone exists where the player has nothing meaningful
to do or anticipate.

## R. Theology Review

-   [ ] Player is never said to cause regeneration.
-   [ ] Money does not buy spiritual power or conversion.
-   [ ] Humans are not killed/damaged.
-   [ ] No Souls currency.
-   [ ] Scripture is authoritative, not magic.
-   [ ] Gospel content centers on Christ rather than self-improvement.
-   [ ] Apologetic responses are Scripture-driven and do not assume
    neutral autonomous reason.
-   [ ] Unbelievers are represented as human beings, not universal
    caricatures.
-   [ ] Generational progression communicates durable kingdom advance
    without requiring utopia.
