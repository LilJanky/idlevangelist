# IdleVangelist --- Agent Constitution

## Mission

Build a complete, polished, playable Generation 1 vertical slice of
**IdleVangelist**, a mobile-first Christian incremental/idle game. A
first-time player should naturally reach the first prestige, **Next
Generation**, in approximately 25--35 minutes.

Read every file in `/docs` before changing code. These documents are
authoritative together.

## Priority Order

When instructions conflict, use this order: 1. `THEOLOGY_GUARDRAILS.md`
2. `PRODUCT_SPEC.md` 3. `GAME_DESIGN.md` 4. `TECHNICAL_SPEC.md` 5.
`ACCEPTANCE_TESTS.md` 6. Reasonable implementation judgment

Do not silently violate a higher-priority specification. If a genuine
contradiction makes implementation impossible, choose the interpretation
that preserves theology, player experience, and Generation 1 scope, then
document the decision.

## Autonomous Work Rules

-   Do not stop at scaffolding, wireframes, placeholders, or a proof of
    concept.
-   Implement, run, test, inspect, debug, rebalance, and polish until
    the acceptance criteria are satisfied.
-   Make reasonable implementation decisions without asking the user
    unless an actual blocking contradiction exists.
-   Prefer a smaller polished implementation over adding unspecified
    systems.
-   Do not expand beyond Generation 1. Generation 2 may have a
    locked/preview state only.
-   Do not add external game engines, asset packs, CDNs, remote APIs,
    analytics, accounts, servers, or required network services.
-   Keep the game runnable locally with minimal setup.
-   Generate all visual assets and audio locally/in-project.
    Programmatic pixel art, Canvas drawing, generated sprite sheets,
    CSS, and Web Audio are acceptable.
-   Never copy protected characters, art, music, maps, dialogue, or
    other expressive content from referenced games. References describe
    genre/complexity only.
-   Maintain a debug/developer mode so major states can be tested
    without replaying 30 minutes.
-   Maintain automated tests for deterministic systems.
-   Preserve save compatibility when practical during the build.

## Definition of Done

Do not declare completion until: - The game is playable from a fresh
save through the first Next Generation prestige. - First prestige is
reasonably targeted at 25--35 minutes for a first-time engaged player. -
Idle, active, and hybrid play are all viable. - The game clearly
communicates that the player practices faithful witness while God gives
spiritual growth. - The mobile experience is the primary, polished
experience. - Save/reload and offline progression work. - The boss can
be attempted, failed, and retried without punitive loss. - The prestige
sequence works and Faithfulness persists. - All automated tests pass. -
`docs/ACCEPTANCE_TESTS.md` has been evaluated and any intentional
deviations are recorded in `BUILD_NOTES.md`.

## Completion Report

At the end, create `BUILD_NOTES.md` containing: - How to run the game -
Controls - Implemented systems - Test command and result - Balance
observations - Any deviations from spec - Known issues - Recommended
next steps, without implementing Generation 2
