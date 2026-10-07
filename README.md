# IdleVangelist

A mobile-first Christian incremental/idle game. You are a street evangelist practicing faithful witness while
**God gives the growth** (1 Corinthians 3:6–7). This build is the complete **Generation 1** vertical slice, from the
first tract to the first **Next Generation** prestige (about 25–35 minutes for an engaged first run).

No engine, no build step, no network services: plain HTML/CSS/JavaScript (ES modules), Canvas pixel art generated in
code, and Web Audio generated sound.

## Run it

Requires Node 18+ (used only for the tiny static server, the tests and the balance harness; there are no runtime dependencies —
`playwright-core` is a devDependency used only by the optional `npm run smoke` browser test).

```bash
npm start            # serves http://localhost:8080
npm test             # unit + balance tests (node:test)
npm run sim          # balance simulation report (idle / hybrid / active)
npm run smoke        # optional browser smoke test (needs a local Chrome/Edge)
```

How it plays: work the street (tap people with a bubble) to earn Seeds, build an Active Witness streak and Momentum, and fill
**WORD** (Scripture proclaimed to everyone currently open to a moment). Now and then someone stops to talk (a Skeptic, a Nominal
Christian, a Broken Sinner): choose how to respond, then bring a passage. Spend Seeds on ministries, and meet the Professor.

Open `http://localhost:8080` on a phone-sized viewport (or any desktop browser; the portrait frame is centered).
Debug tools: `http://localhost:8080/?debug=1` (separate save slot; see `BUILD_NOTES.md`).
Any static file server also works (`python -m http.server`), because the game uses only relative URLs.

## Project layout

```
index.html, styles.css      Mobile-first shell and styling
server.js                   Zero-dependency static server (npm start)
src/config/balance.js       ALL tunable economy / pacing values
src/data/content.js         Dialogue, Scripture, archetypes, upgrade text, boss text
src/core/                   Pure functions: state, economy (costs/production), format, seeded RNG
src/systems/                Simulation (no DOM): game, street, crowd, encounters, scripture, conversion, boss analysis, prestige, offline, save
src/render/                 Canvas renderer and procedural sprites
src/ui/                     DOM HUD, panels, modals
src/audio/                  Generated Web Audio
src/debug/                  Developer tools (only with ?debug=1)
tests/                      node:test suites (economy, saves/offline, conversations, street/ministry, WORD, boss/prestige, balance)
tools/                      Balance harness (bot-driven runs of the real simulation) and CLI report
docs/                       The authoritative specification documents
```

See [BUILD_NOTES.md](BUILD_NOTES.md) for controls, implemented systems, balance observations, deviations, and known issues.
