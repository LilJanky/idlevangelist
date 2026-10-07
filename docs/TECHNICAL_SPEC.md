# IdleVangelist --- Generation 1 Technical Specification

## 1. Technical Goal

Build a self-contained mobile-first web game that runs locally and in a
normal modern browser without a game engine or backend.

Preferred stack: - HTML - CSS - JavaScript or TypeScript if the existing
environment supports it cleanly - HTML5 Canvas for primary game
rendering - DOM overlays where they materially improve
accessibility/UI - Web Audio API for generated/simple audio -
LocalStorage or IndexedDB for save data

Favor minimal dependencies. If no project exists, prefer a
dependency-light solution that can be started with one obvious command.
Do not add a framework merely for fashion.

## 2. No External Runtime Dependencies

Do not require: - Unity - Godot - GameMaker - Phaser - Remote asset
hosting - CDNs - External image-generation services - External audio
services - Backend APIs - Authentication - Databases - Analytics

A lightweight local development/test dependency is acceptable only if it
materially improves testing/build reliability. The shipped game must not
depend on network access.

## 3. Architecture

Keep simulation/state separate from rendering.

Recommended modules: - `GameState` - `EconomySystem` -
`EncounterSystem` - `CrowdSystem` - `MinistrySystem` - `UpgradeSystem` -
`ScriptureSystem` - `ConversionSystem` - `BossSystem` -
`PrestigeSystem` - `OfflineProgressSystem` - `SaveSystem` -
`AudioSystem` - `Renderer` - `UIController` - `DebugTools`

Use deterministic pure functions where practical for economy, costs,
rewards, prestige, and offline calculations.

## 4. Game Loop

Use `requestAnimationFrame` for rendering.

Simulation: - Use delta time - Clamp large frame deltas - Passive
economy should not depend on frame rate - Avoid one timer per crowd
member - Pause/reduce unnecessary animation work when document is hidden

## 5. Mobile Viewport

Primary logical design target: approximately 390 × 844 portrait.

Requirements: - Responsive from \~320px width upward - No horizontal
scrolling - Respect safe-area insets - Primary controls in comfortable
lower-screen thumb region - Minimum practical touch target \~44 CSS px
for important controls - Crowd special-character hitboxes may exceed
sprite bounds - Desktop displays a centered portrait game frame with
non-distracting surrounding background

Test at minimum: - 320 × 568 - 375 × 667 - 390 × 844 - 430 × 932 -
Desktop 1440 × 900

## 6. Rendering and Pixel Art

-   Pixel-art-inspired rendering
-   Disable image smoothing for pixel sprites where applicable
-   Use integer-aligned sprite placement where practical
-   Generate original sprites locally/in code or create original project
    asset files
-   Reuse modular crowd parts/palettes to create variety
-   Keep animation frame counts low and intentional
-   No copyrighted game sprites or traced/recreated commercial assets

Suggested protagonist states: - idle - proclaim - react -
walk/transition

Crowd: - walking - idle/focus - react - special marker behavior

Conversion: - subtle wind/light effect - avoid literal possession
imagery

## 7. Performance

Target smooth play on a normal recent mobile device/browser.

Generation 1 performance goals: - 60 FPS target; remain playable at 30
FPS - Avoid unbounded particle accumulation - Pool/reuse transient
objects where helpful - Cap visible crowd density - Use spatially simple
hit testing - Avoid DOM nodes for every moving pedestrian if Canvas can
handle them more efficiently

## 8. Save Schema

Version all saves.

Suggested:

``` js
{
  version: 1,
  createdAt: number,
  lastSavedAt: number,
  generation: 1,
  currencies: {
    seeds: number,
    funds: number,
    faithfulness: number
  },
  ministries: {...},
  upgrades: {...},
  scripturesUnlocked: [...],
  disciples: [...],
  encounterStats: {...},
  conversionState: {...},
  bossState: {...},
  prestige: {...},
  settings: {...},
  rngSeed: string
}
```

Requirements: - Autosave after meaningful purchases/unlocks - Periodic
autosave, e.g. every 10--20 seconds - Save on visibility/page lifecycle
events when practical - Corrupt/missing save should fail safely -
Include explicit save version/migration hook - Reset progress requires
confirmation - Never allow reload to reroll a conversion outcome already
determined

## 9. Deterministic Hidden Randomness

Use seeded PRNG for encounter/conversion-related hidden outcomes where
practical.

Goals: - Prevent save-scumming - Make tests deterministic - Preserve
unpredictability to player - Do not expose providence seed or conversion
probability in normal UI

Debug mode may inspect these values.

## 10. Economy Precision

Use safe numeric handling for Generation 1. JavaScript Number is
sufficient at this scope if values remain far below overflow.

Centralize: - number formatting - cost formulas - passive production -
active rewards - multipliers - prestige calculations

Do not scatter magic numbers throughout UI code. Put tunable balance
values in a clearly documented config module/object.

## 11. Balance Configuration

Create a central balance/config file containing: - base Proclaim
impact - crit rate/multiplier - encounter ranges - ministry base costs -
ministry cost multiplier - production rates - unlock thresholds - boss
values - offline cap/rate - Faithfulness formula - upgrade
costs/effects - special encounter timing

This is required so later balancing does not require hunting through
code.

## 12. Balance Simulation

Create a lightweight simulation or test harness capable of estimating: -
passive-only-ish progression - active-engaged progression - hybrid
progression - time to ministry unlocks - approximate time to boss
readiness - approximate time to prestige

It does not need to perfectly model human behavior. It must help detect
obviously broken curves.

Target: - Engaged hybrid first run: \~25--35 minutes - Highly active
optimized run may be faster but should not trivialize to a few minutes -
Mostly idle first run may be slower but should remain viable

## 13. Encounter State Machine

Suggested states:
`crowd -> focusEnter -> activeEncounter -> resolved -> outcome -> focusExit -> crowd`

Boss:
`locked -> available -> intro -> phase1 -> transition -> phase2 -> transition -> phase3 -> victory|opportunityPassed -> cooldown|generationComplete`

Prevent double resolution and duplicate rewards.

## 14. Accessibility

-   Text contrast must remain readable over pixel backgrounds
-   Important information cannot rely on color alone
-   Buttons need accessible labels
-   Respect `prefers-reduced-motion` by reducing screen
    shake/particles/transitions
-   Audio is never required to understand gameplay
-   Provide mute/music/SFX settings
-   Dialogue text should be readable at mobile sizes

## 15. Audio

Use original/generated simple retro audio and ambience. Required
categories: - ambient city/rain/crowd - Proclaim feedback - purchase -
special encounter cue - crit - conversion - boss - prestige

Audio must not autoplay in violation of browser interaction policies.
Initialize/unlock audio after user gesture.

## 16. Debug Mode

Required and hidden from normal players.

Provide a query parameter, keyboard shortcut, or settings gesture such
as `?debug=1`.

Tools: - Add 1K Seeds - Add 10K Seeds - Add Funds - Set passive
production multiplier - Spawn standard encounter - Spawn special
encounter - Force conversion presentation for visual testing -
Spawn/unlock boss - Set boss phase - Complete boss - Award
Faithfulness - Trigger Generation Complete - Trigger Next Generation -
Advance simulated offline time - Clear/reset save - Inspect state/RNG
values

Debug tools must not contaminate normal saves unnoticed. Mark
save/session as debug if necessary.

## 17. Testing

Use an appropriate lightweight test runner.

Unit tests should cover: - ministry cost formula - production
calculations - upgrade multipliers - number formatting - encounter
reward boundaries - seeded RNG determinism - conversion non-reroll
behavior - save serialization/version - offline progression -
negative/huge clock handling - Faithfulness calculation - prestige
persistence - boss failure does not remove progress - boss victory
cannot reward twice

Add browser-level smoke tests if feasible without bloating the project.

## 18. Content Data

Keep dialogue, verses, encounter archetypes, ministry definitions,
upgrades, and boss phases data-driven where reasonable.

This enables later expansion without rewriting systems.

Use ESV verse wording only if included manually and keep quotations
brief. If exact copyrighted translation licensing becomes a concern for
distribution, structure content so translation text can be swapped
easily. References are mandatory; full verse text can be configurable.

## 19. Security/Robustness

-   No `eval`
-   No remote code
-   Sanitize any dynamically inserted text even though content is local
-   Handle storage quota/failure gracefully
-   Do not collect user data
-   Do not transmit anything

## 20. Repository Quality

Expected: - Clear README - Simple run command - Logical source
organization - No dead experimental files in final tree - Comments for
non-obvious systems, not line-by-line narration - Central config -
Tests - `BUILD_NOTES.md` on completion
