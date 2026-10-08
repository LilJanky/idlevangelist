# IdleVangelist — Build Notes (Generation 1 · Iteration 6: dialogue feedback and learned conversations)

This pass keeps the street redesign (tap people, streak, Momentum, Stand Firm, visible ministries, the Professor's
argument/window structure, save/offline/prestige) and adds one cohesive active loop:

**work the street → build Momentum → earn WORD → proclaim to a full street → meet someone who needs a real conversation →
choose a response and bring a passage → return to the street.** The player is responsible for faithful proclamation. God gives the growth.

## How to run

```bash
npm start            # static server on http://localhost:8080 (Node 18+, no dependencies)
npm test             # 233 node:test tests (~60 s)
npm run sim          # deterministic balance harness: idle / hybrid / casual-active / optimized-active bots
npm run smoke        # optional Playwright-core browser smoke test (needs local Chrome/Edge)
npm run playthrough  # optional ~10 min scripted human-like run through the real DOM to Next Generation (fails on any console error)
```

Open `http://localhost:8080` in a phone-sized viewport (the portrait frame is centered on desktop).
Developer tools: `http://localhost:8080/?debug=1` (separate save slot; `window.__idlevangelist` exposed only in this mode).

## Controls

| Input | Action |
|---|---|
| Tap a pedestrian showing a **bubble** | Engage them: "+N Seeds" at the person, builds streak, Momentum and WORD |
| `Space` | Engage the nearest open-moment pedestrian |
| **WORD** button / `W` (street) | When READY: proclaim Scripture to everyone currently open to a moment (gold book bubbles) |
| Tap a person who stops to talk (gold arrow, timer pips) | Begin a conversation (the street pauses). A teal bar means you have learned this conversation: tap before it runs out to talk yourself, or a disciple will |
| Conversation: tap a response (or `1` `2` `3`) | Choose how to respond |
| Conversation: tap one of three things to say next (or `1` `2` `3`) | Continue the conversation (some lines draw on Scripture) |
| Professor: tap a response, then **Press on** (`A`) and **WORD** (`W`, opens passages) | Choose a line, press it, apply passages |
| Professor window: tap people, or **WORD** | Work the crowd while it listens |
| `1` / `2` / `3` (no conversation open) | Street / Ministry / Upgrades |

## 1. WORD redesign

**Identity: WORD = proclaim Scripture.** One idea in both layers. On the street it addresses the crowd; in a conversation it addresses
the person; in the Professor's exchange it addresses the argument. Passages are *not* spells: on the street no particular passage does
anything different (one rotating unlocked passage is read aloud), and the 1 Corinthians 3:6–7 "growth buff" is gone.

**Readiness (a single shared meter, 0–100, earned only by active play; no timer, no decay):**

| Source | Readiness |
|---|---|
| Each street engagement | +2.6, plus +0.6 per Active Witness streak tier held |
| Stand Firm | ×1.5 while it lasts |
| Finishing a conversation | +14 |
| Meter already full | nothing banks: holding a full WORD costs the readiness you would have earned (the real cost of waiting) |

Tuning knobs are in `BALANCE.street.word`. There is no "mana", no purchase, and Funds cannot buy it. Idle play never needs it.

**Street behavior.** When READY, WORD reaches *exactly* the people currently open to a moment and on screen (closed, already-engaged and
off-screen people are untouched). Each reached person pays Seeds from their own position, then a large "WORD +N" total appears with a
Scripture toast ("Romans 1:20 — reached 6 people · crowd ×1.7"). Payout per person:
`max(floor, 0.75 s of passive) × upgrades × Sword of the Spirit × streak × Stand Firm (×1.5) × 2.4 × crowd multiplier`, where the crowd multiplier
ramps up a curve (see "Bigger streets, bigger WORD" below). A packed street therefore pays more per person *and* in total. The button shows
`READY · reaches N · ×M` and the people it will reach wear gold open-book bubbles with a ground ring.

**Interactions (simplest set that creates timing decisions, no extra meters):**
- *Streak*: proclaiming adds +2 and the streak window is ×1.5 longer while WORD is ready, so waiting for a crowd is forgiving. Tapping
  people while you wait keeps the streak alive but uses up the people WORD would have reached (the central tension).
- *Crowd density*: while WORD is ready, open moments linger (decay ×0.4) and people walk 30% slower, so a fuller street can build.
- *Momentum*: +6 plus 1.5 per person reached; it can complete Momentum and begin Stand Firm.
- *Stand Firm*: ×1.5 payout, more open moments (×1.8), faster readiness. Holding WORD for Stand Firm is a good play, never mandatory.
- *Professor window*: WORD reaches the whole attentive crowd and counts each person as attention (easier next argument); no extra payout from crowd size.

**Holding WORD vs. conversations.** The same readiness is used in a conversation or an argument: arriving with WORD ready makes the
applied passage carry ×1.25 weight and spends the readiness. A conversation can always be completed without it (no trap state), and it
can be completed without any passage at all.

## 2. Conversation redesign

**Retired:** the random named "passerby" conversations (six generic archetypes, Resistance bars, helper auto-conversations, Answer
cooldown spam). The street crowd *is* the ordinary people now. `makeStandardEncounter`, `ARCHETYPES`, the 14–30 s conversation timer and
`encounter.conversationGap` no longer exist. The Resistance concept remains only for the Professor's *arguments*.

**Three archetypes** (`ENCOUNTERS` in `content.js`; each has two variants, three plausible responses, reactions, and a most-direct passage):

| Archetype | Core issue | Example | Most direct passage |
|---|---|---|---|
| The Skeptic | Knowledge of God | "What actual evidence is there that He exists?" | Romans 1:20 |
| The Nominal Christian | False assurance | "I believe in God. I'm a pretty good person." | Acts 17:30–31 |
| The Broken Sinner | Guilt and hopelessness | "You don't know what I've done." | Romans 3:23–24 |

The first three people met are always the Skeptic, the Nominal Christian and the Broken Sinner in that order, then they recur by a
seeded hash. They walk in every ~32–52 s (once ~5½ min in and 5,000 Seeds), stay in view ~6 s, and missing them is free.

**Structure (≈15–30 s):** NPC statement → choose a response → NPC follow-up and teaching feedback → choose what to say next (three spoken lines, same A/B/C format as the responses, some drawing on Scripture) → the person replies →
summary (labels, Seeds, reaction) → back to the street. There is no health/Resistance bar and no wearing anyone down.

**Answer evaluation.** Each response is graded `strong | partial | weak`, shuffled deterministically so the best is not always "A":

| Grade | Labels used | Meaning |
|---|---|---|
| strong | FOUNDATION EXPOSED · BIBLICALLY GROUNDED · GRACE AND TRUTH | Addresses the real issue on Scripture's ground |
| partial | PARTIAL ANSWER | Plausible and kind, but leaves the issue standing |
| weak | GROUND SURRENDERED · ASSURANCE LEFT STANDING · GRACE OBSCURED | Concedes something false or hides grace |

Each choice carries a one- or two-sentence explanation of *why* ("teach, don't shout"). No joke answers.

**Scripture application (a gradient, never right/wrong):** DIRECT APPLICATION → CONTEXTUAL TRUTH → RELEVANT TRUTH → WORD PROCLAIMED.
The game never says wrong, bad, false or failed; all Scripture is true. Direct passages show a one-line "why it speaks to this".
Unlock cards show *what the passage is useful for* ("Useful when addressing knowledge of God…"), so toolkit growth is legible without memorizing references.

**Rewards.** Exchange quality = ½ response + ½ application (0 if no passage). Seeds ×0.6–1.4, Momentum +6…+24, streak +2, WORD +14.
A weak exchange is never worth nothing and never costs anything.

**Conversion stays sovereign.** The hidden deterministic roll is `hash(seed, "special", encounterIndex)` and uses *nothing* the player
chooses: not the response, the passage, WORD, Momentum or streak (tested). A perfect exchange converts no more often than a poor one.
People can walk away unconvinced; the summary text tracks the exchange only, never regeneration. 1 Corinthians 3:6–7 remains the governing line.

## 3. Professor (adapted, not rebuilt)

Same three arguments, 50 s timers, 12 s crowd-attention windows, concession and gentle debrief. Changes: each argument now starts
with the same "choose how to respond" step (strong/partial/weak, ×1.0/0.72/0.5 pressing weight; choosing also presses once), then **Press on**
repeats the line and **WORD** applies passages graded by the same direct/contextual/relevant/proclaimed scale (×1.8/1.4/1.15/1.0, the old
fit/non-fit values). Readiness-ready WORD adds ×1.25 to the first passage applied. The Preparation reading models a "messy" player at ×0.8
response quality. A prepared player still wins with partial responses and missed presses (tested).

## Fun-and-captivation pass (follow-up)

Implemented from the "what would make it more fun" review:

- **Conversation variety:** four variants per archetype (12 situations, 36 graded responses; new ones cover "science explains it", suffering as evidence,
  "spiritual not religious", "my family is Christian", "I can't forgive myself", "nobody would want me in church"). **People remember you**: meeting the same
  kind of person again opens with a callback line that depends on how the last exchange went (good ≥ 0.6 quality, else poor). Stored in `gen.memory`.
- **Crowd events:** every ~55–85 s (first at 90 s) a bus, lunch break, or lifted rain brings 5–7 people who linger ~9–12 s, all open to a moment.
  This is when a held WORD pays most (optimized bots now reach ~5 people per WORD, casual ~2–2.5). Never during a conversation or the Professor.
- **WORD feel:** a dedicated rising-arpeggio sound that grows with the number reached, and a screen shake when 5 or more are reached (off with reduced motion).
- **Stand Firm is rarer** (Momentum per tap 2.2→1.6, per streak tier 1→0.8): ~every 60 s for the hybrid bot (was ~50 s); expect roughly half that pace for human tapping.
- **Goal ladder:** the street panel now shows one clear goal with a progress bar (buy Tracts → own 3 → first WORD → Bibles → first conversation → then the
  nearest of: next ministry milestone, a disciple, a locked ministry, the Professor). Completing a goal pops a short "Goal reached" note.
- **Characters:** people who came to Christ appear on the street (up to five) and now and then hand out a tract or invite a neighbor. Display only: no Seeds, no production.
- **Reading load:** conversation lines appear quickly as if spoken (instant with reduced motion); feedback labels are larger and tinted by grade.
- **Professor:** the crowd reacts to how you answered each argument ("The crowd murmurs: he had no ready answer" / "…unsure who has the better of it").
- **Welcome back:** the offline summary adds a few honest flavor lines for the ministries you own (no invented counts).

Not done (deliberately, for scope): a second follow-up exchange inside a conversation, a mid-argument second choice in the Professor, and dedicated bus/lunch
sprites (events are announced by a note and sound and shown by the people who arrive).

## Playthrough-driven pass

- **The Professor can't stall.** If no line is chosen within 8 s, the argument presses on with a measured (partial) answer, says so, and the debrief names it ("Choose your line early…").
  After a second failed attempt the debrief adds a plain tip.
- **The wait for the lecture is gameplay now.** From the first foreshadowing, every person you reach (taps and WORD) counts toward a "word gets around" buzz (target 80).
  The goal bar shows "Spread the word about the lecture (n/80)", gatherings are +2 people bigger, and the buzz gives the first argument up to a 15% head start (announced when it starts).
- **Chapters:** Morning rush, Midday (7 min), Afternoon (14 min), Evening (21 min, the lecture hour). Each is announced, tints the street slightly warmer, and changes which gatherings
  happen (bus, lunch break, school letting out, rain easing). New situations for each person start with the second and third chapters.
- **Regulars and the end-of-generation recap.** The same named person (Dana, Omar…) keeps coming back for each kind of conversation until they come to Christ; then someone new takes their
  place. The conversion is that person's, by name. The Generation Complete screen has a **People you met** list (converted first) with gentle outcomes
  ("Listened closely and kept thinking." / "Walked on unconvinced. God is not finished with them.").
- **Coming back after being away:** after 5+ minutes away, someone is waiting on the street to talk for about three times the usual time (never resolved for you).
- **Cleaner start:** the streak and Momentum meters appear at your first tap.
- **Session report (debug mode):** Menu → *Session report* shows first-times, per-5-minute counts (WORD / Stand Firm / talks / missed / events / milestones / unlocks), WORD reach, conversation
  quality, Professor attempts and quiet stretches (>45 s with nothing notable); *Copy report JSON* copies the summary and full event log. The same module (`src/debug/report.js`) works on bot runs.

Not done: a trust branch (a person you spoke with well opening a deeper conversation) and a follow-up round inside a conversation.

## Playthrough findings (scripted human-like run, 390×844, real DOM controls, 70 game minutes) and what was changed

A bot that taps ~0.9 people/s, proclaims WORD when 4+ are open, answers 60% strong, and shops every 15 s was driven through the real UI with event logging and
screenshots. (It is a scripted proxy, not me feeling the game; real human feel is still the open question.) Per 5 minutes, first 35 minutes:
~6 WORDs (avg reach 4.5; 20 of 42 reached five or more), 4–7 Stand Firms, 3–6 conversations, 3–4 crowd events. No dead stretch longer than 40 s in that period.

**Satisfying:** the packed-street WORD burst (reach 4.5 with events), a steady cadence of small rewards, early visible ministry growth (5–6 milestones/unlocks in the first 10 minutes),
conversations arriving at a regular rhythm, and the goal bar always showing one next step.

**Growth areas found, and what I did:**
1. *Novelty dries up after minute ~20* (milestones/unlocks fell from 5–6 per block to 0–1 while taps, WORDs and talks just repeated). → Newer situations now join the mix over time
   (third variant per person after 10 min, fourth after 18), with callback lines for people you've met.
2. *Everything front-loaded at ~45 s* (first Stand Firm, first WORD, Scripture unlock all at once). → Stand Firm can't start in the first 150 s; the first one now arrives at ~2.5–3.5 min.
3. *The first conversation arrived at ~6.4 min.* → People who want to talk now appear from ~3 min (2,500 Seeds and 180 s); first conversation ~3.3 min.
4. *Redundant text:* the Stand Firm verse and the hint repeated each other; several ministry floaters piled up. → Hint shortened; ministry-tick floaters show one at a time.
5. *Hidden risk found in testing the bot:* if a player never picks a response in the Professor's exchange, nothing presses the argument (only helpers work). The choice panel is the whole
   bottom area so this is unlikely, but a stuck player could fail repeatedly (the bot did, 21 times: a bot bug, not a pacing issue). Worth watching in human play.

Pacing at the end of the WORD pass (4 seeds): hybrid 27.1–27.9 min, casual active ~22.8, optimized active ~22.7, idle ~60 (see the upgrade pass for current numbers).

## Other changes

- **Scripture is dialogue, and the dialogue is written for the situation.** The second step, "What do you say next?", offers three spoken lines *written for what that
  particular person just raised* (12 situations × 3 lines; there is no shared pool, so nothing is a non sequitur). One line **answers what they raised and draws on Scripture**
  in plain words ("Science describes how the world works. It can't say why there's order to describe. Scripture says creation points to its Maker."), one is **honest and human**
  (listening, or your own story), and one **recites a true passage that isn't aimed at the question** (the awkward-but-true move people really make). Each line has its own in-character
  reply ("Why there's order at all… that's philosophy, not physics. Hm."). Buttons show only the words you would say; the reference appears quietly in the summary ("DIRECT APPLICATION —
  Romans 1:20"). The three are shuffled deterministically, so the best line is not always the same letter. Lines do not depend on what Scripture you have unlocked (unlocks still power
  street WORD verses and the Professor); a line that draws on Scripture can spend a ready WORD for ×1.25, a human line never does.
- **The verse appears on screen whenever WORD is used**: a gold-bordered pop-up with the passage text and reference on every street WORD and every
  Professor passage; in a conversation the passage text appears in the exchange summary.

- Scripture unlocks: Romans 1:20 now at 3 Tracts (so WORD works from the first minute), Romans 3:23–24 at 8,000 Seeds or Street Team 1, Acts 17:30–31 at Bible Study 1.
- Upgrade text updated (Sword of the Spirit = WORD strength; Prepared Mind = direct/contextual application; Ready Answer = press sooner in the Professor's exchange).
- Debug tools: *Fill WORD*, *Crowd: open everyone*, *Spawn person*, *Talk: skeptic / nominal / broken*, plus existing boss/prestige/offline tools.
- Fixed during testing: a street-WORD payout double-counted the streak bonus; found by a preview-equals-payout test.

## Upgrade design pass (idle-game theory)

**Method.** `node tools/upgrade-analysis.js [profile] [seeds] [minutes]` removes each upgrade in turn (A/B via `profileOverride.banned`) and reports Seeds at minutes 15 and 20,
the finish time, and a build comparison (active vs passive fork). It found: the first four upgrades were instant, dominant buys (compounding early); many mid/late upgrades were
duds or never bought (cost outran income, or bot ministry-spending starved them); and the passive fork was ~35% stronger than the active fork.

**Redesign** (all numbers in `src/config/balance.js`; 34 upgrades: cluster 1 ×6, 2 ×9, 3 ×8, 4 ×4, Funds ×7):

- **Cost curve by cluster** (c1 2.5–20K, c2 40–120K, c3 220–520K, c4 0.9–1.8M Seeds). You cannot buy everything before the Professor, so order matters. Cluster 4 unlocks at 6M Seeds / ~20 min.
- **Forks** (`exclusiveWith`): three "Choose one path — the other closes" pairs (Street Preacher vs Faithful Routine, Hospitality vs Multiplication, Deep Roots vs Broad Reach). Each path is real:
  active/WORD/conversation power vs passive power vs the Professor's window. Forks are per generation and saved.
- **Synergies** (`effects.synergy`): e.g. Hands-On Team: Street Team +0.5% per Tract owned. **`requires`**: some upgrades appear only once you own the ministry they improve.
- **New modifiers**: WORD charge/crowd bonus, conversation pay, gathering size/life, opportunity life, Professor window length/head start, held-streak bonus.
- **Ministry milestones** now double at 25, 50 **and 100** owned (×8 total) so the late ministries stay worth buying.
- **Upgrades tab**: every card states what it does in numbers: "+76 Seeds/s (+15%) · pays for itself in 45s", a "Best value" chip, fork groups, teasers for upgrades gated behind a ministry, and Professor
  readiness before/after for Professor upgrades. Previews are computed from the same economy functions as the purchase (a test asserts preview = result).
- **Theology guardrails kept**: no upgrade buys conversion or Faithfulness (tested); Funds upgrades are mundane supplies only.
- **Boss resistances retuned** to 28.5K / 36.5K / 45K to match the new power curve. Cheap Professor-kit upgrades were re-priced because they pulled the finish too early.

**Results (4 seeds, minutes):** hybrid 27.7–29.6, casual active 22.5–22.8, optimized active 22.4–22.7 (gate-limited by the 21-min boss time gate), idle 64–72. A hybrid bot owns roughly 14–28 of 34 upgrades at the Professor.
WORD readiness cadence tuned (`word.perEngage` 2.3). Test bands: hybrid 22–36, idle ≤ 80, cluster 4 unlock minute 18–22.5.

**Not verified:** fork balance was checked with bots (hybrid mainly); human perception of "pays for itself" times and the choice weight of forks needs playtesting. Idle is now ~65 min (accepted; offline progress still applies).

## Iteration 5: upgrade and gameplay-loop audit

**Tools.** `node tools/loop-audit.js [profile] [seed] [active|passive]` prints, per minute, income growth, purchases, WORD uses, conversations, Stand Firms, gatherings and unlocks; the longest stretches with
nothing new; and an **upgrade value table**: for every upgrade, an estimate of what share of total income it was worth *at the moment it was bought*, its payback, and its Professor-readiness change. Unlike
the A/B tool (`tools/upgrade-analysis.js`), it is deterministic, so it is not drowned by bot noise (A/B differences of ±10–20% were noise). A scripted browser playthrough through the real DOM
(390×844, fake clock, a bot that shops from the Ministry and Upgrades tabs) reached Next Generation at 27.8 min with no console errors.

**A real bug the playthrough found, and the guard against it.** `UI.setCd` had been deleted when the Upgrades tab was rebuilt. The Professor's "press on" step called it every frame, which threw inside the
animation loop and would have frozen the fight in a real browser. The unit tests and the old smoke test never held that step open (the smoke test settled each argument instantly).
Fixed, plus `tests/ui-static.test.js` (every `this.x()` the UI calls must exist; every `game.x()` must exist on `Game`), and the smoke test now presses on and opens the passage tray in a live argument.

**What the audit found (hybrid bot, per minute):** a beat every 20–30 s from minute 1 (taps, WORD, a gathering, a conversation or Stand Firm nearly every minute), purchases every 5–15 s, and no stretch longer than
about 45 s with nothing new. Income grows 1.3–1.9×/min with two flat minutes (around 13 and 17–18) while the bot saves for cluster 2/3 upgrades: acceptable, and the goal bar now explains them. Acted on:

- **Fork parity.** The active path was worth ~3× the passive path (Street Preacher ≈14% of income vs Faithful Routine ≈5%). Faithful Routine is now **+35%** passive and Multiplication adds **+20% passive** to its disciple and
  cost effects; at purchase the value table reads Street Preacher 11% / Faithful Routine 10%, Hospitality 9% / Multiplication 7%.
- **No dead purchases.** *Entrust to Faithful Men* could be bought with zero Discipleship (a 520K Seeds upgrade doing nothing). It now requires owning Discipleship, and a test asserts that any Seeds upgrade that only
  boosts one ministry requires it.
- **Chunkier late upgrades.** Full Barns +15% → **+25%**, Entrust +35% → **+50%**, and the synergy upgrades (Hands-On Team 0.8% per Tract, Study Library 1% per Bible, Mentorship 1.2% per Bible Study) read as growth, not 1–2% nudges.
- **The goal bar knows about upgrades.** Before the first set unlocks it says "Plant 12K Seeds to unlock Upgrades"; afterwards it points at the nearest one ("Upgrade: Faithful Hands (3.5K Seeds)"), and a fork reads as one
  decision ("Choose a path: Faithful Routine or Street Preacher").
- **Honest payback.** Street moments, WORD and conversations pay in *seconds of production*, so a passive upgrade lifts them too. "Pays for itself in about …" now divides by the player's own moments share (capped at 4×)
  instead of showing the pessimistic passive-only figure.
- **The Professor readiness line** now appears on every upgrade that changes how you answer him (crit, WORD strength, Clear Voice, Ready Answer…), not only the ones tagged for him.
- **"Affordable in ~1m 20s"** appears under any upgrade you cannot buy yet (Seeds or Funds) and updates live.
- **Irreversible forks need two taps.** The first tap on "Choose" turns the button gold ("Confirm?") for 3.5 s, so a mis-tap while scrolling can no longer lock a path for the generation.
- **The Owned list collapses** (Owned (9) ▸) once it is longer than six, so the buy list stays near the top.
- **Boss retune** (resistances 28.5K/36.5K/45K → 29K/37.5K/46K) to keep the hybrid in its band after the stronger passive path. +5% moves the hybrid finish by about 2 minutes: the fight is a readiness cliff.

**Results (4 seeds, minutes; supersede the Upgrade design pass numbers below):** hybrid 26.3–28.0 · casual 22.5–22.7 · optimized active 22.3–22.8 (gate-limited by the 21-minute boss time) · idle 65–67.
The casual bot reaches 90% readiness at about 19.5 min, so the 21-minute gate costs it about 1.5 minutes of waiting.

**Not changed, on purpose:** WORD charge upgrades (the casual WORD gap is already ~21 s; more would remove the "hold for a fuller street" decision); the cluster 1 timing (the docs say about minute 5, and active players get it at
~3.5 min by progress); idle's 65 minutes (an engaged player earns about a third of Seeds passively, so a passive-only run is a long road by design; offline progress covers the "away" case).

**Still unverified:** all of this is bot- and screenshot-verified. How the fork choices, the Confirm tap and the goal-bar wording feel to a first-time human is untested.

## Iteration 6: dialogue that shows its shortcomings, and learned conversations that a disciple carries

**Feedback in the dialogue.** A conversation's replies already differed by grade; now the whole exchange reads back to you:
- The closing reaction follows the *whole* exchange. Only a fully fitting one (strongest response + a line aimed at what was raised, quality ≥ 0.95) earns the warmest reaction; a fine but unfinished exchange gets the middle one
  (`BALANCE.specials.reactionBands`). The "you again…" memory next time is also stricter (quality ≥ 0.75, so a true-but-unaimed passage is remembered as a poor exchange).
- The outcome card has a short coaching block: **"Your response:"** (the situation-specific note for the response you chose, e.g. "it treats his reasoning as a neutral judge") and **"What you said:"** (the line was honest but left the question
  unanswered / true but not aimed at what was asked). The card stays up 2.4 s longer when something was missed. Nothing in this touches conversion.

**Learned conversations.** Answering a situation (12 of them: 3 people × 4) with the strongest response *and* the line aimed at what was raised **learns** it. The card says so ("Learned. You know how to talk with someone about this now.") and the
Ministry tab shows "Conversations you have learned: n of 12" with the rules. Once you have a trained disciple:
- When a person of a learned kind walks up, a **teal bar** above them counts down (3.5 s). Tap them first and you have the conversation yourself, at full reward, adding streak, Momentum and WORD readiness.
- If the bar runs out, the disciple talks with them: "Ruth talked with Mei, the way you would have. +4.3K Seeds". It pays **60%** of a perfect exchange and no streak, Momentum or WORD readiness, shows no outcome card, and is not counted as a missed person.
- **Guardrails** (docs: "Offline time does not automatically resolve special encounters"): never offline, never for the person who waited while you were away, never during the Professor. Conversion still runs through the same hidden, deterministic
  roll as a conversation you have yourself (a test compares 160 manual vs carried conversations and requires identical outcomes). If a carried conversation ends in someone coming to Christ, the street pauses for the usual conversion moment.
- Debug: **Learn all conversations**. The session report counts conversations learned and carried.

**Balance.** The bots tap before the 3.5 s mark and answer the strongest path only ~20% of the time, so they rarely trigger it: hybrid 26.6–26.9 min, casual 22.7, optimized 22.5, idle 65–67 (unchanged). A human who masters several situations
will see the benefit as quiet income during stretches away from the street. Measured only by tests and screenshots, not by a human.

**Not done on purpose:** nothing is carried for you before you have learned it yourself, and learning is per generation (it resets with Next Generation; Generation 2 is out of scope).

## Bigger streets, bigger WORD

The more people a street WORD reaches, the larger the multiplier **every one of them** is paid at, so the total grows faster than the crowd (total = people × multiplier).
`BALANCE.street.word.crowdCurve` (ramps linearly between points; flat past the last):

| People | 1 | 3 | 5 | 7 | 10 | 14+ |
|---|---|---|---|---|---|---|
| Per-person multiplier | ×1.0 | ×1.25 | ×1.6 | ×2.0 | ×2.8 | ×3.4 |
| Named step | | A small gathering | A crowd | A full street | A throng | |

Ten people are worth about 3.5× what five are. The old curve was a straight line capped at ×2.2, so the top end barely mattered. (The top steps were trimmed in the later rebalance; the table is current.)
`wordCrowd` upgrades (Street Preacher, Broad Reach) still add per person (limited to 9 people).

**Felt before, shown at the moment.** The WORD button never shows the multiplier while you wait (`READY · reaches 6`): it lights up in four steps and pulses with a rising figure when the street reaches a new step, so players find the pattern. The numbers arrive when WORD lands; see "Big numbers" below.
- The WORD button reads `READY · reaches 6`. It lights up in four steps (a stronger glow and more gold as the street fills), and reaching a new step while you are holding WORD pulses the button and plays a rising figure, one note higher per step.
- On proclaiming: a larger total ("WORD +8.31K"), a toast that names the step as flavor ("A FULL STREET — Romans 1:20 · reached 9 people"), and a light burst with more waves and a longer ring the higher the step.
- In the Professor's attention window everyone is already open, so there is no crowd multiplier there (unchanged).

**Balance (12 seeds, optimized "hold" bot vs casual "soon" vs never):** Seeds at minute 15 for holding vs using it as soon as ready is about ×1.4 (was ×1.4; the extra reward is mostly in big gatherings: buses, lunch rushes, Stand Firm), holding vs never about ×1.9
(was ×1.7). Finish times are unchanged (hybrid 26.3–28.2, casual and optimized 22.6, idle 65–67). Test limits were widened to match (hold/soon ≤ 1.7, hold/none ≤ 2.25; hybrid owns up to 30 of 34 upgrades at the Professor).
Seeds at minute 15 from these bots are noisy (±10%), so these are trends, not tuned figures.

## Smaller refinements (after the WORD curve)

- **Toasts no longer bury the street.** At most two messages show at once; others queue (gold ones win when the queue is long), duplicates are dropped, and anything that waits longer than 6 s lapses. Before, three or more could stack over the people you were tapping.
- **A missed person does not repeat themselves.** The situation a person brings is now chosen from the unlocked ones excluding the one they last brought, and it varies after a miss (it used to be a function of the encounter index alone, so a missed Skeptic returned with the same question).
  `gen.lastVariant` is saved; learned conversations still recur because there are 3–4 situations per person.
- **`npm run playthrough`** (`tools/playthrough.mjs`) is the scripted human-like run that found the Professor-fight freeze, now in the repo: fake clock, real buttons, fails on any console error or if Next Generation is not reached within 45 game minutes.

## The Professor, re-examined

**What the audit found (bots, 7 fights).** All the bots won on the first attempt at readiness ≥ 0.9, with arguments cleared in 13–46 s of 50. The fight itself was one choice followed by tapping: after you picked a response he said nothing back, and the other 20–40 s
was Press on plus a rotation of passages. The dialogue, the heart of the game, stopped at the first click, and a weak first answer cost you only a multiplier you never saw.

**Changes**
- **He answers every response.** Each of the nine first-round choices now has his reply, typed into the card ("Faith. So you admit there is no evidence. Thank you."), so the shortcoming of a weak answer is visible in what he says, not only in a toast.
- **He answers back halfway through every argument** (new second round, `BALANCE.boss.rebuttal`). When his argument is half answered he raises a rebuttal ("Then the order of the universe is simply a brute fact. Why add a God to explain it?") and you reply with one of three lines
  (strong / partial / weak), each with its own feedback and his reply. A **strong** reply cuts 35% of what remains of his argument; a middling one changes nothing; a **weak** one lets him regain 8% of its full weight. The clock and your helpers keep going while you decide,
  pressing the point and casting passages pause during the choice, and if you do not reply within 10 s you press on with the middling answer. It happens once per argument and never if you answer the argument outright first.
- **Readiness knows about it.** The readiness estimate now models the reply (a skilled player shortens the argument, a careless one lengthens it) and the debrief after a failed attempt says "When he answers back, the reply matters as much as the first one…" if most of your replies were not strong.
- **Content:** 9 first-round replies and 9 rebuttal lines (3 per argument, graded) in `BOSS.phases`, written to keep the same ground (the standard of evidence, ultimate authority, grace) and never to treat a person as an enemy.
- Pacing is unchanged (hybrid 26.7–28.0, casual and optimized 22.4–22.7, idle 64.7–70.3). The strong-answer bonus makes skilled fights short (arguments clear in 13–24 s, mostly reading and choosing), which is the payoff for the 21 minutes before it; weaker play takes the full time, and an idle bot with a weak reply failed once and won the retry.

**Left as is on purpose:** resistances (29K / 37.5K / 46K), the 50 s limit, the attention windows and the 21-minute gate. The fight is still a readiness check with a conversation on top; making it risk-free for skilled players was preferred over scaling him to the player.

## Learned conversations: checked in a real browser

Real timings, real taps and clicks (no stepping the simulation): learning a conversation through the UI; training a disciple and bringing that situation back; doing nothing: the teal bar counted down 3.5 s, then "Ruth talked with Hana, the way you would have. +6.76K Seeds", no outcome card, no pause,
not counted as missed; and tapping in time instead gave the full conversation with no helper. A carried conversation that ended in someone coming to Christ paused the street and showed the conversion moment (with a line saying who had been talking with them).

## Big numbers, a WORD that charges while you wait, and a chain

- **WORD lands with big numbers.** When you proclaim, the street gets a slam at the top of the scene: the step's name ("A THRONG"), the multiplier (×3.2) and the total (+12K) which counts up over about 0.65 s, flashing, with a low hit and a shimmer. Both sizes and glow grow with the step
  (×1.1 for a thin street is modest; ×3.2 is huge), each person's own payout floats up bigger at the top steps, and the verse card moves down so nothing covers the numbers. Reduced-motion players get the final number without the flash.
- **WORD charges by itself, slowly** (`word.passivePerSecond`: full in 5 minutes, helped by Open Hands/Iron Sharpens, not by Stand Firm, held during conversations and the Professor, and only once there is a passage to proclaim). It is also credited while you are away
  ("WORD is ready to proclaim." in the welcome-back screen), but it is never proclaimed for you. While WORD is ready the street's open moments linger, so a returning player usually finds a gathered street. Working the street still fills it in about 20 s, so this barely changes active play;
  it exists so a semi-idle player has a reason to come back every few minutes. A new **semi-idle** bot (checks in every 3 minutes, proclaims WORD) finishes in 43–46 min, between idle (63–68) and hybrid (25–28), averaging 5–7 people per proclamation.
- **A chain on successive taps.** The Active Witness streak already counts successive taps and multiplies them (×1.2 at 4, ×1.5 at 8, ×2.0 at 14). It now shows its count next to the multiplier (`×1.5 · 12`), and **every fifth successive tap pays a small chain bonus**
  (`BALANCE.street.chain`: 25% of that tap, growing to 50% by a chain of 10) with a "CHAIN 10 +109" number, a rising sound, and a bigger flourish from 25. It adds roughly 10% to tap income; not applied in the Professor's window.
- **Balance:** see "Risk, reward and a rebalance" below (the numbers there supersede this line).

## Risk, reward and a rebalance

**Holding WORD is now a readable gamble** (a bigger street pays more per person; waiting costs people).
- **A fuse on each marker.** While WORD is ready, every open moment that is about to pass (its marker running out, or the person about to walk off screen) shows a short bar over its bubble that turns amber in the last 2.5 s. (`crowd.pedTimeLeft`, rates adjusted for WORD being ready.)
- **The button says it:** (superseded: the button now reads just READY and glows brighter at the street's high point; the people it will reach wear the open-book bubbles).
- **Proclaiming at the crest pays +20% per person** (`crestBonus`): a crowd of at least 5 that is as large as it has been during this hold *and* has begun to thin (at least one person leaving). The slam adds "AT ITS FULLEST". The preview equals the payout (tested). Too early (still building) or too late (it was fuller a moment ago) misses it.
  About a quarter of an optimizing bot's proclamations land on the crest; it is a flourish worth about 4% of income, not a requirement.
- **Hints** appear once for the fuse, the crest and the chain. **A reason to come back:** while the tab is in the background its title becomes "● WORD ready — IdleVangelist" once WORD has finished preparing.
- WORD timing at minute 15 (12 seeds): holding vs proclaiming as soon as it is ready ×1.46, ready vs never ×1.33, holding vs never ×1.94.

**Rebalance.** The WORD curve, chain, passive charge and crest together made active play too rich: casual and optimized runs owned all 31 upgrades by minute 17 and unlocked cluster 4 at ~15, and hybrid was ~2 minutes quick. Changes:
street WORD payout ×2.1 (was 2.4), tap payout seconds [0.45, 0.9] (was [0.5, 1.0]), chain 20% (was 25%), crest +20%, the top of the crowd curve ×2.0/×2.8/×3.4 at 7/10/14 people; cluster 3 and 4 costs +25% and +30%, cluster 3 unlocks at 3.5M Seeds and cluster 4 at 12M;
Open Hands +20% WORD charge, Endurance +0.25× held-streak bonus, Mentorship +2% per Bible Study (the weakest upgrades by value). Results (bots): hybrid 25.1–26.9 min, upgrades at the Professor 27–30 of 31; casual 22.6, optimized 22.5; semi-idle 44.8–48.5; idle 66.8–73.4 (it was ~65; the dearer late upgrades fall hardest on someone who only checks in).
Skilled players still buy every upgrade a few minutes before the Professor's 21-minute gate: with a fixed amount of content, that is the cost of being fast.

## Proclaim the Word, a growing streak, and conversations you can simply gather

**Renamed.** The ability is now **Proclaim the Word** (the button, goals, hints, upgrade text and the tab title "● The Word is ready"). "WORD" as a label is gone from player-facing text; internal names are unchanged.

**It reaches everyone on screen.** People who are open to a moment hear it in full (the crowd step, crest and chain logic all still use only them). Everyone else on screen who is not open hears it too, **once each, at 20% of an open person's payout**
(`word.bystanderMult`), paid with small dim numbers and counted in the slam ("4 MORE HEARD IN PASSING"). (The button no longer shows these numbers: see 'Streak drops and impact' below.) With only passers-by on screen it still proclaims. Not in the Professor's window (everyone is already open). Stats: `wordBystanders`.

**The streak visibly builds.** The Active Witness chip now reads `×1.5 · 12` with the multiplier growing continuously with the run (size, glow and colour from small green through gold to large orange, scaled to a run of 40), and each tap's number swells the same way. Layout holds at 320 px.

**Situations you know are seeds, not conversations.**
- **Learned** (the best response and a line aimed at what was raised): the next time that situation comes round, a **seed with a green shoot floats over the person** instead of the gold arrow. Tapping them *gathers* it: no conversation, no pause, paid as the best path paid (it still builds the street's run and half the usual WORD readiness, and the hidden conversion roll is unchanged: a test compares 120 talked vs gathered).
- **Familiar** (two tries at the same situation that fell short of the best path, `specials.familiarAfter`): the same seed appears, and tapping **the seed** gathers it **at the best quality you reached** (never more); tapping **the person** still talks it through, so the best path can still be found (and then it becomes learned). The second try that falls short says so in its card.
- A new situation is always a conversation. A trained disciple still gathers a learned or familiar one if you do not, after the teal bar, for 60%.
- `gen.practice` records tries and the best quality per situation (saved; old saves load).

**Balance.** Bystanders added about 4% to hybrid income, so I trimmed `bystanderMult` to 0.2 and WORD readiness per tap to 2.15 (casual WORD gap stays ≥ 20 s), and moved cluster 2 to 650K and cluster 3 to 4.8M Seeds (hybrid: c1 ~4.3, c2 ~12, c3 ~17, c4 ~20 min). Hybrid finishes in 23.7–26.8 min, casual and optimized ~22.5.

## Streak drops and impact

**The button is just `READY`.** Reach, bystander, leaving and "at its fullest" text were removed from Proclaim the Word. The crowd is the readout (open-book bubbles, fuse bars), and the button only gains a stronger glow (`crest`) at the street's best moment.

**When does Active Witness drop?** The run exists to reward *continuous* attention, so it now has real stakes (`balance.street`):
- **A shrinking window (pace).** Without a tap, the run holds for `streakWindow` (2.4 s base, +Endurance, ×1.5 while WORD is ready, ×1.6 in Stand Firm) but the window shrinks by up to 50% as the run grows (`streakWindowHeat`, full at a run of 80). The hotter the run, the less slack.
- **Proportional drain.** After the window the run drains at `max(1.5, 12% of the run)` per second, so a long run falls through its tiers in seconds while a short one fades gently.
- **A miss costs a slice.** Tapping the street where nobody is open costs `max(2, 20%)` of a run of 4+ (`missPenalty`). Runs under 4 are safe, a 0.3 s debounce makes a double tap one miss, and nothing is lost while a conversation or the Professor holds the street.
- **Unchanged:** the run is never lost to a conversation or while the Professor's exchange is open, and WORD/Stand Firm extend the window.

**A constant reminder.** The Active Witness chip carries a draining bar (green, then amber under 40% of the window, then red and pulsing under 18%), the multiplier keeps growing with the run, and when the run slips the chip shakes, a `▼ ACTIVE WITNESS ×1.5` floater and a low sound play. A miss shows `MISS −5`.

**Every big hit is felt.** `renderer.impact(level, x, y)` adds sparks, a gold screen flash and a shake, scaled by level:

| Level | Moments | Feel |
|---|---|---|
| 0 | Normal tap; each hearer of Proclaim (small crowd) | a few sparks |
| 1 | Each hearer when the street is large (crowd step 2+), harvest | small burst, green on harvest |
| 2 | Crit, chain (every 5th tap), streak tier up, Stand Firm | local sparks and a popping, glowing number (no shake, no flash; see below) |
| 3 | Crit in Stand Firm, long chain (25+), Stand Firm start, strong Professor rebuttal, Proclaim at crowd step 2 | larger burst, stronger flash |
| 4 | Proclaim at the top crowd step, Professor defeated | the screen lights up |

Reduced-motion players get fewer sparks and no flash or shake.

**Balance.** The old "streak never drops" bots hit runs of 100+. Runs now peak at 29–48 (hybrid) and 61–102 (casual), hybrid finishes in 26.4–30.7 min (avg ~27.7), casual and optimized ~22.5. Tests: `streak criteria` (window shrink, drain event, miss amount/threshold/debounce, no miss while paused) in `tests/street.test.js`; balance now expects a hybrid best streak of 20+.
## Price display audit

**Bug found:** ormatNumber stripped trailing zeros from whole numbers, so 250K read as 25K, 100K as 1K, 650K as 65K (any price or balance of 100+ in a suffix tier ending in 0). Prices looked far cheaper than they were. Fixed (zeros are only trimmed after a decimal point).

**Also fixed:** shortened numbers now round in the honest direction. Prices use ormatCost (rounds up), the Seeds/Funds balance uses ormatHave (rounds down), so a balance that reads as much as a price always covers it (1.996M no longer reads 2M against a 2M price). Applied to ministries, disciples, upgrades, goal text and the cluster teaser. Ministry single-buy cost and bulk cost now agree to the last Seed. Tests: 	ests/prices.test.js (zeros, honest rounding property test, every upgrade price boundary).

## Provisions, quieter impact, and an upgrade audit

**Funds are now Provisions** (player-facing text only; `funds` stays the internal name, so saves are unaffected). Not "Fruit": the theology guardrails keep money purely mundane and "fruit" already means the fruit of the Spirit / Faithfulness. This is a recorded deviation from the docs' word "Funds"; their rules (supplies only, never spiritual power, never buys Faithfulness) are unchanged.

**Shake and flash were noise.** Crits and chains happen every few seconds, so a screen shake or flash on each was fatiguing and pulled the eye from the thing that matters, the number. Now: crits, chains, tier-ups and Stand Firm get **no shake and no flash**; the number carries it (a crit pops in at 1.5x, shimmers gold, glows, and grows with the run) plus a few local sparks. The screen flash is reserved for rare big moments (strong Professor rebuttal, top-step Proclaim, victory) and the single short shake for the top-step Proclaim and victory only. Reduced motion removes all of it.

**Upgrade audit.**
- Found a description that lied (Open Hands said 25%, gave 20%) and added `tests/upgrade-audit.test.js`: every percentage quoted in an upgrade's text must equal its config.
- Upgrades that moved nothing noticeable were strengthened: Open Hands 20% to 30% Word charge, Sword of the Spirit +30% to +45% Proclaim pay, Watchful Eye +2.5 to +4 s for people who want to talk, Good Stewardship 10% to 15% off.
- Provisions pacing: Meeting-Space Support (a large effect on Bible Study) was last at 2600 and arrived at minute ~23; it now costs 1300. Rain Gear 800, Transportation 1700.
- **Supplies are things.** Each Provisions purchase now appears on the street: tract boxes, a Bible crate, a striped awning over the table, a ministry van parked behind the crowd, a microphone (it flashes when you proclaim), folding tables with a chair, and an easel for the meeting space. A purchase sparkles and lights the item, and every upgrade purchase says what changed in a toast.
- Balance after: hybrid finishes 24.8-30.9 min (avg ~26.9), casual and optimized ~22.4, semi-idle 43-46, idle 59-66.
## Street events: five kinds that each ask something different

Gatherings used to be one event with a different toast. Each kind now has its own shape, who comes, and what it asks of you (`balance.crowdEvents.shapes`, `startCrowdEvent` in `game.js`, `crowd.js`). Nothing here touches conversion (still hidden and independent), and events still wait during a conversation and never happen in the Professor's exchange.

| Event | Shape | What it asks of you |
|---|---|---|
| **Bus** | A pack of 6-8 steps off together on one side and lingers (10-13 s) | Hold the Word for it: the biggest Proclaim moment |
| **Lunch rush** | A stream of 9-11, one after another from both sides, each open only 5-6.5 s | Tap them; your Active Witness window is x1.5 for the rush, so a run is easy to build and keep |
| **School lets out** | Two fast waves (people hurry at x1.8), one from each side, windows of 4-5 s | Quick fingers; stay on one side then swing to the other |
| **Rain eases** | 4-5 people spread across the street with 16-20 s moments, and someone who wants to talk follows within about 5 s | A calm moment for semi-idle play, and a conversation to catch |
| **Church friends** | Three friends stand beside you for 14 s. Nothing to tap | A gift: Momentum +40 (a step from Stand Firm) and the Word 15% closer |

People wear what suits the event (backpacks, hats, umbrellas, a Bible for the church friends, who also have a small gold glint). Each chapter of the day draws from different kinds (morning: bus, rain; midday: lunch, bus, church; afternoon: school, rain, lunch; evening: rain, bus, church, school). Debug menu: `Event: bus / lunch / school / rain / church`. Tests: `tests/events.test.js`.

Balance: streams and rushes give extra taps, so Word readiness per tap was trimmed from 2.15 to 2.0 (casual Word gap stays at least 20 s). Hybrid now finishes 24-26 min, casual and optimized about 22.4, semi-idle 41-45, idle 61-63. Hybrid is at the early edge of the 25-35 minute target; the Professor's minute-21 gate bounds how late fast players can finish.
## SNES-era art pass and five recognizable archetypes

**People.** `drawPerson` in `src/render/sprites.js` now builds each figure once into a small cached sprite: a four-step colour ramp per material (highlight, base, shadow, outline) lit from the upper left with shadows pushed cool and lights warm, rounded shoulders, a dithered shadow edge, selective one-pixel outlining (a darkened copy of the neighbouring colour), eyes on everyone, walking arm swing, and a three-row stepped ground shadow. Crowd members are 1x; the people in focus (protagonist, Professor, the person talking to you) are 2x with a face (eyes with a highlight, mouth, brows) and more props. Background figures keep lower contrast through the fog tint.

**Environment** (`renderer.js`, pre-rendered and cached): banded and dithered sky with layered 3-tone clouds; shaded skyline with cornices, rooftop props, framed windows and curtains; wet pavement with curb bevel, tile seams, crosswalks, drains, puddles that reflect lamps and ripple in the rain; shaded lamp posts with dithered light pools; two rain layers with splashes. Reduced-motion keeps it static.

**Five archetypes you can tell apart at a glance** (`look.kit` in `content.js`; the specification's five special archetypes, minus the grieving parent for now). Each has its own silhouette, palette, props and expression, and its own voice and humor:
- **The Skeptic**: hoodie, headphones, glasses, glowing phone, one raised eyebrow ("I watched a twelve-minute video").
- **The Nominal Christian**: cardigan, small gold cross, WWJD wristband, a Bible under the arm ("I even have the bumper sticker").
- **The Broken Sinner**: hood up, hunched, hands in pockets. Tender; humor only as gentle self-deprecation.
- **The Exhausted Worker** (new): rumpled shirt and loosened tie, lanyard badge, briefcase, a steaming coffee, bags under the eyes ("four coffees deep"). Variants: calm-down-first, one more to-do item, work as identity, "after this quarter".
- **The Visiting Representative** (new): crisp white shirt and tie, name tag, tote of literature, laminated brochure, a big smile. An unnamed visitor with another authority, earned salvation, or all-paths; kind, sincere and wrong in specific ways.
All still follow the guardrails: nobody is stupid or mocked, every objection is one a real person makes, and conversion stays hidden and independent. The Professor now wears tweed with a bow tie. 20 situations in all; tests assert distinct kits, palettes, and unique lines.
## Art direction: retro on purpose

The first art pass proved the look; this one asks what each visual choice is *for*, the way strong idle games do (Cookie Clicker's grandma rows, Egg Inc's growing farm, Adventure Capitalist's readable tiers): the picture is the scoreboard, the thing you can act on is the clearest thing on screen, and the interface speaks the same language as the world. Seven principles, and what each changed:

1. **One pixel grid.** The focus figures were drawn as 2x blocks next to 1x crowd pixels (two grid sizes in one image). They keep their larger size but spend it on 1-pixel detail (rounded skull, ears, nose, brows, belt, tapered shoes) so every pixel on screen is the same size. The canvas now scales by whole numbers only: the scene is 120-160 art pixels wide depending on the phone instead of stretching a fixed 130 (2.46 screen px per art px at 320 wide shimmered).
2. **Background calm, foreground crisp.** Crosswalk bars, checker puddles, drains, and bright windows are gone or dimmed; skyline value range is compressed with stronger fog between layers. Only people who are open to a moment and your own station are crisp and bright.
3. **Cool world, warm meaning.** The Generation 1 city is slate and teal; gold is reserved for what matters: people open to a moment now stand in a small pool of gold light (readable at a glance, without relying on the bubble), the tap/Word UI, and the station.
4. **The world is the scoreboard.** Ministry growth becomes light: a warm pool grows from your station and warms the nearest windows and lamps first, spreading rightward as ministries grow (`warmth` now climbs to about 0.6 by ~150 ministry levels), so the left of the street is visibly lit late in Generation 1 while the far right is still cold. The restoration montage finishes the job.
5. **Income you can see.** Each ministry report lifts a few pixel seeds off its station and floats them up toward the Seeds counter (the seed is this game's coin). Off with reduced motion.
6. **Chrome matches the world.** Square SNES-style windows with a double border and hard two-tone bevels, flat colour instead of gradients, and pressed buttons that sink two pixels.
7. **Numbers in a pixel font.** Numbers are the heart of an idle game, so Seeds, Provisions, the Active Witness multiplier, floating damage-style numbers, and the Proclaim slam use an original 5x7 bitmap font generated by `tools/make-pixel-font.py` (embedded in `styles.css`; no downloads). It is used only at multiples of 7 px so every font pixel is a whole screen pixel; digits are fixed width so a ticking counter does not jitter. Long text stays monospace for readability.
Tests: `tests/art.test.js` (integer scaling at 320-430 wide; pixel font sizes).
## Art direction, round two: composition and colour

The first round tuned details on a composition that was the real problem: tiny distant skyscraper slivers, a flat slate pavement filling half the screen, the crowd bunched near the horizon and the player alone at the bottom, and almost no hue. Round two fixed the picture itself:
- **Composition.** `groundTop` (`this.groundTop`, 42% of the scene height) is the one place the street starts; the crowd now uses the whole pavement in three depth lanes from just in front of the shopfronts to just behind the player, so the street is full of people instead of empty tarmac.
- **Human-scale storefronts** behind the sidewalk (doors, display windows, awnings, signs, roll-down shutters on closed shops) in front of hazier tower layers, under a violet-to-peach dusk sky; the pavement gains curb, gutter, wet sheen, puddles, reflections and street furniture. The restored world is the same street, warm and open.
- **Light spreads** now warms shop windows, lamps and pavement from the player's side outward as ministries grow.
- Static scenery is cached offscreen (`src/render/scenery.js`); only flicker, steam, ripples, lamps and rain are drawn per frame.
- Faces: removed the nose marks that read as a moustache and softened the jaw shade.
Remaining ideas: more street furniture variety, animated pigeons and passing traffic, and rim light on the people.
## Street pacing and a clear tapping zone

- **Nobody appears out of thin air.** Event people used to materialise on screen and drift at 0.08-0.4x speed. Now every kind of gathering walks in from off screen at an ordinary pace (`Crowd.enter`), and the ones meant to linger (bus pack, rain, church friends) stop at their own spot (`goalX`) and stand, then walk on in the direction they were heading. Their moment only starts to run down once they are on screen. The bus now arrives in about 5 s and stays 12-15 s.
- **The ministry's people live on the far side of the street.** Street-team workers, disciples, converts and the church friends stand in a row in front of the shopfronts (`helperSlots`), and the Bible study and gathering groups moved to the same far side, so the near pavement is clear for tapping. The three crowd lanes now start at `groundTop + 28`. Church friends walk the far side and are not people to tap or pay.
- Tests: `walk in` for every event kind, bus clusters and walks on, church friends stay far and leave, helper slots stay behind the tapping lanes. The Stand Firm cadence bound was relaxed from 8 to 6 in 15 minutes (events now take a few seconds to arrive); hybrid finish is now 26-28 min.
## Art direction, round three: the reference mock-ups

The user supplied two mock-ups (a rainy night street with side-view walkers, and a sprite/tile sheet). Four tracks followed them:
- **People** (`sprites.js`): side-view profile figures, 24 px crowd and 32 px focus characters on the same pixel grid, a 4-frame walk cycle with cadence tied to walking speed (so feet do not skate), idle/talk/point/hold/react poses, 14 crowd templates (casual, cap, ponytail, business, phone, beard, coffee, older, teen), and distinct silhouettes for the five archetypes, the protagonist and the Professor. Each person mirrors faintly in the wet street (`drawPersonReflection`, built once per sprite on its own canvas; an earlier version composited on the scene canvas and blanked the whole scene).
- **Environment** (`scenery.js`, `renderer.js`): warm lamps and lit shop windows against a cool indigo rainy night, wet reflective pavement, storefront row with shutters, bus stop, bench, trash can, hydrant, shrubs, a parked car silhouette; lamp halos are stepped translucent glows instead of dither.
- **UI**: gold-outlined person-icon tap bubbles (open book when Proclaim is ready), seed icon on the Seeds counter, Goal and Proclaim side by side, compact ministry strip, chunkier nav.
- **Portraits** (`portraits.js`): 48x48 code-drawn portraits for the five archetypes and the Professor with neutral/warm/guarded moods, shown in the conversation card.
Known rough edges: the street is still busier than the mock-up (fence and shutter texture), the people are smaller and less detailed than the mock-up's, and there is no Word tab.
## Art direction, round four: the main character and the special characters

The crowd (small side-view walkers) was fine; the hero figures were not. They had been assembled from the same rectangle-and-ramp builder as the crowd, so they read as blocky and stiff. They are now painted separately in `src/render/hero.js` (32 px, same pixel grid as the crowd): smooth shaded forms (egg-shaped skull and jaw, capsule limbs, tapered torso, rounded shoulders) lit from the upper left with a 4-step ramp and a 1 px selective outline, with a lifted torso for longer legs, a lit face (only the jaw underside and far edge shade), brows and mouths that carry each character's mood, and proper props: the protagonist's backpack and gold-cross Bible, the skeptic's crossed arms and headphones, the nominal Christian's coffee and crossbody bag, the broken sinner's knitted beanie and plaid coat, the worker's briefcase, lanyard and coffee, the visitor's tote and brochure, the Professor's tweed and bow tie.

The dialogue portraits were redone the same way (`src/render/portrait_art.js`): painted three-quarter busts with volume, real hair shapes, distinct skin tones, and moods. The old stamped-row portrait code remains in `portraits.js` but is no longer used for drawing.

## Art direction, round five: walking, the hero's palette, and the shops

- **Crowd walking** (`src/render/crowd_art.js`): the crowd had thin legs under a wide torso with a gap between them, and frames that barely differed. Crowd figures are now built from shaded capsule legs that start *inside* the torso (one connected body), a four-frame cycle (contact, passing, contact, passing) with the arms swinging against the legs and a one-pixel bob on the passing frames, and a head/face that stays inside the body outline (an earlier try made the nose stick out like a beak).
- **Protagonist palette and face**: the old grey-on-grey made him a blob. He now wears a teal hoodie over navy trousers with a mustard backpack, a brown Bible and dark hair against warm skin. The head is rounder (an egg, not a muzzle), the beard hugs the jaw, and the mouth and nose sit inside the face outline, so he no longer reads as an animal.
- **Buildings**: three shops were hospitals because the pharmacy sign was a plus-cross picked at random (and it repeated). Shop types now cycle in order along the street so a type does not repeat in a row, the pharmacy sign is a capsule, and every kind of shop has its own awning and sign colour (bakery tan, pawn red, laundromat blue, phone repair teal, pharmacy green, noodles orange, books plum, market olive).

## Our own style: chunky figures (`src/render/chibi.js`)

After the experiments with authored sheets (a hosted image generator gave blurry, inconsistent, watermarked output and was dropped; the Nominal Christian sheet was removed), the people are drawn in a style that plays to what hand-placed pixels do well: ~3 heads tall, big head and small body, flat colour with one base and one shade per material (no gradients), a rim-light line on the lit edge, tall dot eyes with a glint, a blush, a tiny mouth and **no nose**, and a dark coloured outline. Who someone is comes from their silhouette and **one oversized prop** (a huge coffee cup, Bible, briefcase, beanie, backpack). The crowd is 24 px and the people in focus are the same design drawn bigger (34 px) on the same pixel grid. `CHIBI_STYLE` in `sprites.js` switches back to the earlier realistic-proportion figures (`hero.js`, `crowd_art.js`). Portraits (`portrait_art.js`) are drawn in the same style: a big round head, flat colour, tall dot eyes, no nose, and a hair/headwear/prop silhouette per character, with the warm/guarded moods changing only the eyes, brows and mouth.

**Flat pass.** Feedback said the outlined chunky figures looked creepy. People are now plain flat shapes: no outline, no rim light, one shade per material, small dot eyes with no whites (two clear pixels apart), no mouth on crowd figures, a sleeve-coloured hand on walkers (a skin dot on the torso read as a stain), and no bag-strap dots. Far-lane fog and rain reflections were lightened so people look solid. `FLAT` at the top of `chibi.js` switches the outline back on.

**Backdrop pass 2.** The skyline and shop row were redrawn flat and readable: tower and upper-floor windows are tone-on-tone with a scattering of warm lit ones (no black holes), shop windows glow amber with a shelf silhouette, awnings are striped, each shop has a bright sign board with one cream icon, and the road is a calmer indigo with warm lane dashes and a lighter sidewalk. The dark scrap rectangles at the bottom of the street were removed.

**Interface pass 2.** Ministry and Upgrades cards now have a coloured left stripe (the ministry's own colour, or one colour per upgrade category: Boldness gold, Watchfulness blue, Multiplication green, Supplies teal, The Professor rose), coloured category chips, a brighter frame on cards you can afford, and a bevelled frame on the passive-production panel. Rates are a big pixel-font number plus a small unit ("400" / SEEDS/SEC) so the pixel font never wraps over itself.

**Warm lamplit interface.** The cool navy-grey panels were shifted to a warm plum-brown (every dark blue-grey in the stylesheet was recoloured, so the gold and teal accents stand out against the coral-and-violet dusk scene). Reading text (dialogue, answer choices, card names and descriptions, scripture, intro copy) is now in a book serif (`--serif`: Palatino/Book Antiqua/Georgia); numbers, labels and buttons stay in the small mono face, and big numbers in the pixel font.

**Paper and leather interface.** The lower half is now a worn leather satchel (stitched edges, brown nav bar and HUD) with tract-paper cards pinned in it: upgrade, ministry, conversation-choice, goal and passive-production cards and the person's speech card are cream paper with dark-brown ink and a coloured left edge; the active tab is a paper tab with a red bookmark ribbon; the intro modal is a printed tract. It lives in the "Paper and leather" block at the end of `styles.css`, driven by `--paper*`/`--leather*` variables.

**Accessibility audit and fixes.** `npm run a11y` (`tools/a11y.mjs`, needs the game served on :8080) measures the WCAG contrast of every visible text node against its real background on the intro, street, Ministry, Upgrades, a conversation, Settings and the Generation Complete screen at 390x844 and 320x568, and flags unlabeled controls and touch targets under 44px; it currently passes. Fixed: disabled/locked buttons (Buy, Locked, Proclaim) had grey on dark-brown text at about 2:1 and now read clearly while still looking inactive; secondary paper text, category chips, gold numbers, the tap hint, the Faithfulness panel and Legacy cards are all 4.5:1 or better; touch targets (buy-mode, settings toggles, ministry strip, boss button, sliders) are at least 44px; focus rings are visible (gold on dark, blue on paper); dialogs now have `role=dialog`, `aria-modal`, a label, move focus to their first button, trap Tab, restore focus on close and close on Escape where closing is harmless (Settings, Good News, Close/Cancel/Continue; never the intro or the prestige choice). Not covered: screen-reader narration of the canvas street (it is decorative; every action is also reachable through the buttons and the keyboard shortcuts).

**The Professor, second pass (feel, not numbers).** The balance is unchanged (the readiness and clear-time tests still pass); what changed is how it reads. Every Word or Press-on that lands now: shows a bold pixel-font damage number on him (bigger for crits and big chunks), a DIRECT or FITTING tag for passages that speak to his argument, throws sparks and a light flash from where he stands (strongest for direct and crits), makes him rock back, flinches his portrait, and flashes the Resistance bar with a pale ghost that drains behind it. Each argument opens with a title card (ARGUMENT I - NATURALISM); answering one slams ARGUMENT ANSWERED - THE CROWD IS LISTENING; and the victory is a held ~3s moment: a green FAITHFULLY ANSWERED banner over THE EXCHANGE IS COMPLETE, two flashes, gold sparks rising across the whole plaza, and only then the dialog with the Seeds awarded shown large and Continue. Controls: the passages now open by themselves when it is your turn and stay open (they sit in the panel under the scene instead of covering the fight; WORD only ever opens them, and the goal and ministry strip step aside), each passage button remembers how it fitted last time (Direct, Fits, Tried) so trying passages teaches, and the verse caption is a slim two-line strip. Fix: the passage tray was positioned off-screen when it opened itself, and in the argument the stand-in crowd person was drawn instead of the Professor at his lectern.

**Victory flare.** Answering the third argument is now a ~4.6s celebration (`boss.victorySeconds`; a tap skips to the Seeds): a white flash and a synthesized fanfare (timpani, a rising horn call, a held chord, a crowd cheer swell; the music ducks and shifts to the hopeful theme), fireworks launching over the skyline and bursting into rings and sprays with a pop each, confetti, light rays, a warm wash, the whole crowd turning toward the Professor and jumping with arms up, the hero raising the Bible, the Professor stepping back, a title that slams in and shines, and then the dialog with the Seeds counting up with ticks and landing with a flash. Reduced motion drops the fireworks, confetti, jumping and shaking and keeps the banner and sounds.

## Crowd density

Measured in a 22-minute hybrid run (pairs of walkers in the same lane within 0.07 of the width, i.e. overlapping sprites): the worst case was 12 and came from the Professor's gathering, where everyone who joined the standing crowd stopped at the same spot (about 0.39) and stacked up. Fixes in `crowd.js`: gathering walkers only stop in an open spot; new walkers and event arrivals enter in the lane with the most room (`placeInRoomiestLane`); a bus pack fans out over the three lanes; and a walker queues behind a slower walker ahead of them in the same lane (`balance.crowd.queueGap`) instead of walking through them. Result: average overlaps 1.6 down to 1.4 and the worst case 12 down to 9 (an event moment), with the lane split an even 34/33/33. Balance is unchanged (hybrid 25-28 min). Tests: `tests/crowd-density.test.js`. The street is still full by design (up to ~20 on screen); lowering `crowd.cap` (14) is the next lever if it should feel emptier.

## Background and interface evolution

**Backdrop** (`scenery.js`, `renderer.js`), restyled to match the chunky figures: a saturated dusk sky (violet to a warm coral band at the horizon, three big clouds instead of six small ones), far towers in hazy purple and blue, and a storefront row in clearly different building colours (brick red, slate teal, ochre, plum, deep blue) with a dark outline on each mass. The scatter that made the street noisy is gone: rain ripples and splashes are flat dashes (they were plus shapes), the bollards, bike rack, scooter and shrub strip were removed, the fence is one thin rail with a few posts, and the sidewalk uses large paving slabs.

**Interface**: the scene is framed with a vignette and a dark base line; stat tiles have a coloured edge (gold for Seeds, teal for Provisions); the goal reads in two lines with a sprout icon and a segmented gold bar; Proclaim the Word charges as a dark gauge that fills with gold segments and shows a small book beside its status; the active tab has a gold notch; and the title screen has a glowing cross-and-sprout emblem, a larger title, a lighter veil so the city shows behind it, and a pulsing Begin button.

## Implemented systems (overview)

Config (`src/config/balance.js`) · pure economy · simulation (`systems/game.js` WORD/conversations/boss, `street.js` streak/Momentum/Stand Firm/WORD
readiness, `crowd.js`, `encounter.js`, `scripture.js`, `conversion.js`, `bossAnalysis.js`, `prestige.js`, `offline.js`, `save.js`) · Canvas renderer · DOM UI · generated Web Audio ·
debug tools · harness/bots. Save version is unchanged (new fields merge safely into older saves).

## Tests

- `npm test`: **233 passed, 0 failed** (~60 s; includes `tests/upgrades.test.js`, `tests/ui-static.test.js`, `tests/automation.test.js`, `tests/professor.test.js`, `tests/satisfaction.test.js` and `tests/harvest.test.js`): 52 new/reworked tests in the WORD pass, including `tests/word.test.js` (readiness, exact targeting, preview = payout,
  crowd/streak/Stand Firm interplay, holding, conversation advantage, retired encounters, archetype completion, graded answers, application gradient,
  conversion independence, save/offline) and new balance tests (optimized vs casual WORD, casual viability, idle without WORD, Professor with imperfect responses).
- `npm run smoke`: passes at 320×568, 390×844 and 1440×900: WORD readiness/READY/reach, conversation choices and Scripture options on screen, the Professor end to end, prestige and reload, no console errors.
- Clicks-only UI playthrough with a fake clock (hybrid-style bot that taps people, proclaims WORD when READY, answers conversations with 55% strong
  responses, applies the most direct passage 55% of the time, and works the Professor through the real DOM controls): reached Next Generation at
  **32.5 min** (the previous pass's less efficient bot took 37.2), 27 conversations, 3 conversions witnessed, 75 passages proclaimed, 13 Faithfulness, no console errors.

## Balance observations (`npm run sim`, 4 seeds; minutes)

| Profile | First prestige | Conversations | Conversions | WORDs (avg reach) | Stand Firms |
|---|---|---|---|---|---|
| Idle (no WORD, no conversations) | 63.6–71.8 | 0 | 0 | 0 | 3–4 |
| Hybrid (uses WORD soon) | 27.7–29.6 | 13–21 | 1–2 | 36–41 (3.1–3.8) | 23–26 |
| Casual active (full tap skill, WORD soon) | 22.5–22.8 | 22–24 | 2–3 | 56–61 (2.6–2.8) | 37–38 |
| Optimized active (WORD held for a fuller street) | 22.4–22.7 | 23–24 | 2–3 | 36–44 (5.3–5.8) | 35–37 |

The boss time gate (21 min) bounds active play. WORD-timing isolated (identical bot otherwise, 10 seeds, Seeds at minute 15):
never proclaim 3.85M · proclaim soon 4.10M (+6%) · hold for a fuller street 4.80M (+25% vs. never, +17% vs. soon).
So casual use is helpful and never wrong; optimizing is meaningfully, not absurdly, better. WORD is ready about every 30–50 s of active play.

Idle moved from ~48–55 min to ~59–64 min: the retired standard conversations used to pay helper-only rewards to idle players. That slowdown
is accepted (the brief says not to accelerate idle to fit the target); hybrid and active pacing are unchanged from the previous pass.

## Deviations from the brief

- The first Scripture now unlocks at 3 Tracts instead of 1 Bible so WORD is usable in the first minute; the street WORD requires at least one unlocked passage.
- WORD in the Professor's exchange keeps the per-passage cooldown (shared gap) rather than requiring readiness, so the boss tuning stays valid; WORD readiness there is an
  optional ×1.25 on the first passage. WORD in the attention window is a street WORD (the whole attentive crowd, no crowd-size payout bonus).
- A conversation's "follow-up" is shown with the response feedback; the final summary shows the exchange labels, Seeds and reaction.
- The old Answer button is repurposed as **Press on** and appears only in the Professor's exchange.
- Faithfulness gains nothing from exchange quality in this pass (left out to avoid any "optimize conversions" incentive).
- **Acceptance checklist (`docs/ACCEPTANCE_TESTS.md`) items intentionally superseded by this brief:** "Standard encounter can enter focus, receive
  Proclaim actions" (standard encounters are retired; ordinary people are the street crowd), "At least five special archetypes exist" (three
  prototype archetypes by design until playtested), "Proclaim remains usable" (street tapping and WORD are the proclamation), and "Debug can spawn
  standard/special encounters" (debug now spawns the three archetypes). All other checklist items were re-verified by the automated suite and smoke test.

## Known issues

- Human feel is unverified: WORD frequency, packed-street payoff, response difficulty and the Professor's readiness reading are tuned with bots only.
- Bots tap randomly and faster than people, so they open less crowd than a human might when holding WORD; a human's average WORD reach may be higher.
- Audio is synthesized and not auditioned by a human; no dedicated visual polish pass was done.
- Idle completes in about an hour (~65 min after the upgrade pass); offline progress still applies.
- Converts on the street and crowd events were verified by tests and the smoke test for errors, but not tuned by eye on all screen sizes.
- Statements, responses and reactions are a small, hand-written set (two variants per archetype) and will repeat in a long run.

## Human-playtest questions

1. Does waiting for a larger crowd before using WORD feel satisfying?
2. Is WORD ready often enough to matter without becoming spam?
3. Is it visually obvious who will be affected by WORD?
4. Does a large WORD use feel substantially better than a weak one?
5. Does holding WORD create interesting decisions or merely frustration?
6. Do special encounters feel meaningfully different from ordinary street interaction?
7. Do the three archetypes feel distinct from one another?
8. Does ANSWER feel like a decision rather than a disguised attack?
9. Does choosing Scripture feel like applying Scripture rather than choosing elemental damage?
10. Are weaker response options plausible rather than obviously fake?
11. Does returning from a deliberate encounter to fast street play feel good?
12. Does the Professor now feel like mastery of learned mechanics?
13. Does active play create enough depth for someone who wants to optimize?
14. Can a casual player still make progress without understanding all optimization layers?

## Recommended next steps (not Generation 2)

Playtest-driven tuning of readiness rate, crowd bonus and conversation cadence; a distinct WORD sound and light touch on the gold markers;
more variants per archetype (not more archetypes) once the structure is validated; consider whether a very light passive trickle of
readiness is needed for players who never tap. Generation 2 remains a locked preview only.
