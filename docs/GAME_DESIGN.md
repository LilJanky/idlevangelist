# IdleVangelist --- Generation 1 Game Design

## 1. Core Loop

**Engage → Proclaim → Plant Seeds → Invest in Ministry → Automate →
Improve Active Witness → Encounter Stronger Objections → Boss → Next
Generation**

The loop must work for: - Active players who frequently engage - Idle
players who prefer automation - Hybrid players who do both

Active play should accelerate the first generation noticeably, but an
idle-oriented player must remain viable.

## 2. Primary Screen

Portrait street scene: - Upper area: city/environment and moving crowd -
Middle: focused encounter space - Lower: protagonist and thumb-friendly
controls - Persistent top HUD: Seeds, Funds when unlocked, Seed/sec,
settings - Bottom navigation or compact panels: Street, Ministry,
Upgrades - Do not bury the main active action behind menus

Most crowd members are low-detail/lower-contrast. Focus characters
become clearer, more saturated, larger, and/or framed.

## 3. Currencies

### Seeds

Main Generation currency. - Earned from completed encounters - Earned
passively from ministries - Used for ministry and most Generation
upgrades - May scale into K/M/B notation - Seeds are not conversions

### Funds

Secondary mundane resource, introduced around minute 7--10. - Generated
slowly by stewardship/support-related systems - Used only for
physical/material upgrades - Keep Generation 1 Funds simple - Funds do
not buy Faithfulness or conversion chance

### Faithfulness

Prestige currency. - Hidden/locked early as `Faithfulness: ???` -
Revealed at Generation completion - Persists through Next Generation -
Spent on permanent prestige upgrades - Generation 1 target award:
approximately 10--15 Faithfulness, with 12 as the nominal balanced
result

## 4. Active Encounter System

### Standard Encounter

A highlighted passerby enters focus.

Encounter data: - Archetype - Short statement/objection - Resistance
maximum - Current resistance - Reward range - Relevant Scripture tags -
Hidden providence/outcome seed - Optional repeat-history identifier

Player actions: 1. **Proclaim** --- repeatable basic action 2. **Word**
--- Scripture ability, cooldown-based 3. **Answer** --- contextual
apologetic action unlocked later 4. Optional later passive modifiers; do
not add more buttons unless necessary

Numbers: - Actions generate visible `Truth`/`Witness` impact against
Resistance. - Use satisfying floating numbers, crits, and chain
feedback. - Never label this health/damage.

### Suggested Starting Values

-   Base Proclaim: 10 impact
-   Base crit chance: 8%
-   Base crit multiplier: 2.0×
-   Early Resistance: 35--80
-   Mid Resistance: 120--400
-   Late standard Resistance: 500--1,500
-   Encounter Seed reward should generally equal about 8--20 seconds of
    current passive production, adjusted for encounter difficulty.

### Encounter Chain

Completing encounters without long inactivity builds a modest
`Faithful Witness` chain: - x1.0 baseline - +0.05 per completed active
encounter - Soft cap around x1.5 in Generation 1 - Chain decays after
roughly 20 seconds without active encounter interaction - Chain affects
encounter Seed rewards and/or active impact, not conversion certainty

## 5. Crowd and Special Encounters

Standard encounters may be surfaced automatically at a comfortable
cadence.

Special characters: - Visually distinct - Appear in the moving crowd -
Have a generous invisible touch target - Remain available about 4
seconds initially - Missing one has no punishment - Active upgrades may
extend visibility - Reward active attention with larger Seeds, Funds,
narrative moments, Scripture unlock progress, or unique statistics

Generation 1 special archetypes (5): 1. Grieving parent 2. Confident
internet skeptic 3. Nominal Christian 4. Exhausted worker 5. Visiting
religious missionary/cult representative

Keep dialogue brief and humane.

## 6. Standard Encounter Archetypes

Use approximately 6: 1. Apathetic passerby --- "Not interested." 2.
Moral relativist --- "That may be true for you." 3. Naturalist ---
"There's no evidence for God." 4. Scripture skeptic --- "The Bible has
been changed too many times." 5. Pluralist --- "All religions basically
teach the same thing." 6. Autonomy objection --- "Why should anyone have
to submit to God?"

Arguments may have variants so repetition is less obvious.

## 7. Scripture Abilities

Use six Generation 1 Scripture abilities. Do not require memorization
quizzes.

Recommended set: 1. **Romans 1:20 --- Creation Bears Witness** - Strong
contextual bonus against naturalism/neutrality objections. 2. **Proverbs
30:5--6 --- Every Word Proves True** - Strong contextual bonus against
Scripture-corruption/added-authority objections. 3. **John 14:6 --- No
Other Way** - Strong contextual bonus against pluralism. 4. **Romans
3:23--24 --- Grace for the Guilty** - Strong gospel-focused effect;
useful broadly. 5. **Acts 17:30--31 --- God Commands Repentance** -
Strong late-encounter proclamation effect. 6. **1 Corinthians 3:6--7 ---
God Gives the Growth** - Unlock around first conversion; reinforces
theology and grants a ministry/discipleship-oriented buff rather than
conversion control.

Implementation: - `Word` opens a fast, thumb-friendly choice when
multiple verses are unlocked. - Contextually relevant verses receive an
impact/cooldown/reward bonus. - Non-optimal Scripture remains useful. -
Keep the player in action; do not turn encounters into quizzes.

## 8. Conversion Event

A completed encounter may trigger a conversion event based on hidden
deterministic-per-save pseudo-random logic.

Design goals: - Rare enough to feel special - Not farmable through
reloads - Not directly purchasable - Not guaranteed by maximum active
DPS - Same save/encounter state should not allow save-scumming by reload

Suggested Generation 1 observed target: - Typical first run:
approximately 2--5 witnessed conversions - Zero should be possible but
uncommon enough not to make the feature invisible - More than 6 should
be unusual

Outcome logic may consider: - Encounter history - Number of faithful
contacts - Scripture exposure - Current generation milestone - A seeded
hidden providence value

Do **not** expose a conversion percentage to the player.

Presentation: - Brief slowdown - Crowd/audio recedes - Subtle wind/light
animation - "God Gives the Growth" - 1 Corinthians 3:7 - Character is
marked as a new brother/sister - Some converted characters may later
become disciple candidates

## 9. Passive Ministries

Five core ministry lines. Each has repeated purchases with geometric
scaling.

Recommended base design:

  Ministry                   Unlock   Base Cost (Seeds)   Base Production
  -------------- ------------------ ------------------- -----------------
  Tracts           Start/very early                  40        1 Seed/sec
  Bibles                    \~3 min                 160       4 Seeds/sec
  Street Team               \~7 min                 650      14 Seeds/sec
  Bible Study              \~13 min               2,600      45 Seeds/sec
  Discipleship             \~19 min              10,000     135 Seeds/sec

Cost formula: `nextCost = baseCost × 1.15^owned`, rounded cleanly.

Production:
`lineProduction = owned × baseProduction × lineMultipliers × globalMultipliers`

Milestones at owned 10 and 25 may provide 2× line production if balance
needs acceleration. Generation 1 may not reach 25 on every line.

Balance these values through simulation/playtesting rather than treating
them as immutable. Preserve the intended unlock timing and 25--35 minute
prestige target.

## 10. Disciples and Automation

Disciples replace the thematic role of managers.

-   First disciple/helper should become visible around minute 8--12.
-   Assignment can automate or boost a ministry.
-   Converted characters can occasionally become disciple candidates
    after a delay/milestone.
-   Do not imply every convert immediately becomes a ministry worker.
-   Use 2 Timothy 2:2 when discipleship/multiplication is introduced.

Generation 1 only needs a small number of named disciple characters
(2--4).

## 11. Funds

Introduce after the player understands Seeds.

Suggested Generation 1 material purchases: - Printed literature bundle -
Better Bible supply - Portable microphone - Transportation - Small
meeting-space support

Funds can be generated by a modest passive stewardship/support ticker
and special encounters/milestones.

Keep Funds subordinate to Seeds. If it creates pacing friction, reduce
it to milestone-gated purchases rather than a second grind.

## 12. Upgrade Architecture

Approximately 20 Generation upgrades, progressively disclosed.

Categories are not initially presented as classes.

### Active / Boldness examples

-   Clear Voice: +20% Proclaim impact
-   Persistence: +10% active encounter reward
-   Courage: +5% crit chance
-   Conviction: crit multiplier +0.5
-   Endurance: chain decay takes longer

### Scripture / Watchfulness examples

-   Ready Answer: Answer cooldown -15%
-   Sword of the Spirit: Word impact +25%
-   Watchful Eye: special encounters visible +1.5 sec
-   Prepared Mind: contextual Scripture bonus +20%
-   Every Thought: boss phase bonus after correct contextual response

### Ministry / Multiplication examples

-   Faithful Hands: all passive production +15%
-   Train Others: disciple-assigned ministry +30%
-   Good Stewardship: selected ministry costs -8%
-   Open Door: standard encounter cadence improves modestly
-   Entrust to Faithful Men: discipleship production +35%

Do not expose all upgrades at once. Unlock clusters around minutes 5,
12, and 18.

Avoid trap choices. Respec is unnecessary in Generation 1 because
upgrades are affordable enough to explore.

## 13. Pacing Targets

Use these as UX targets, not rigid timers.

### 0--2 minutes

-   Immediate street interaction
-   First Seeds
-   First Tracts purchase
-   Player understands Proclaim and Resistance

### 2--5

-   Passive production becomes visible
-   Bibles unlock
-   First Scripture ability
-   First stronger named/recognizable encounter

### 5--8

-   More encounter variety
-   Funds introduced
-   First special crowd encounter
-   Street Team unlocks

### 8--12

-   First disciple/helper
-   Automation becomes visually obvious
-   First conversion likely within this broad region, but never
    guaranteed at an exact time
-   First meaningful upgrade divergence

### 12--16

-   Bible Study
-   Scripture choice matters more
-   Active/idle/hybrid preferences emerge
-   Numbers accelerate

### 16--20

-   More special encounters
-   Discipleship unlock
-   Ministry visually expands
-   Boss foreshadowing begins

### 20--24

-   Strong upgrades
-   Boss becomes challengeable
-   Player understands that Faithfulness/Generation transition is
    approaching

### 24--30

-   Major boss attempts
-   Generation completion
-   Next Generation sequence
-   Faithfulness award and first prestige purchases

Allow slower players up to \~35 minutes without feeling stuck.

## 14. Boss --- "The Professor"

A confident, articulate public intellectual. Not a villain caricature.

Boss is foreshadowed by crowd chatter/visual arrival.

Three phases: 1. **Naturalism:** "There is no evidence God exists." 2.
**Authority:** "You can't use the Bible to prove the Bible." 3.
**Autonomy:** "Even if God exists, why should I submit to Him?"

Mechanics: - High Resistance - Short dialogue transitions -
Scripture/Answer choices can produce strong contextual bonuses -
Proclaim always remains useful - Crowd visually gathers - Boss
music/ambience changes - Player may challenge before mathematically
guaranteed victory - Failure = "The opportunity passes" / crowd
disperses - No lost Seeds, Funds, upgrades, or punitive reset -
Cooldown/reappearance period should be short enough to avoid frustration

Victory: - Means the public exchange was faithfully answered/completed -
Does not require Professor conversion - Large Seed reward - Triggers or
completes the final Generation milestone

## 15. Generation Completion

Show a summary such as: - Seeds Planted - Scriptures Proclaimed - People
Engaged - Special Opportunities - Disciples Trained - Conversions
Witnessed - Ministries Established

Do not show a moral grade based on conversions.

### Faithfulness Formula

Use milestone-heavy scoring. Suggested: - Base for completing
Generation: 6 - Establish all five ministries: +2 - Train/assign at
least 2 disciples: +1 - Complete boss: +2 - Complete a meaningful
active-witness milestone: +1 - Conversion count: at most +1 bonus total,
and not required for nominal 12

Target normal result: 10--13; nominal 12.

## 16. Next Generation Prestige

Sequence: 1. Generation Complete summary 2. Faithfulness
revealed/awarded 3. Player confirms `Begin Next Generation` 4.
Time-passing visual montage 5. Original evangelist ages/steps back 6.
Existing believers/ministry remain visible 7. Psalm 145:4 displayed:
"One generation shall commend your works to another, and shall declare
your mighty acts." 8. City returns visibly improved 9. New/younger
evangelist enters 10. `NEXT GENERATION`

Generation 2 gameplay is not required. Allow the player to see/spend
Faithfulness first.

## 17. Prestige Tree

Three permanent branches, revealed only after Generation 1:

### WORD

Active/Scripture improvements. Example first node: `Steadfast Witness`
--- +10% permanent active impact.

### WORK

Passive ministry/automation. Example first node: `Established Labor` ---
+10% permanent passive production.

### GENERATIONS

Legacy/meta progression. Example first node: `Faithful Inheritance` ---
start future generations with a small Seed/ministry head start.

Costs should allow the first run's \~12 Faithfulness to purchase 2--4
meaningful nodes.

## 18. Offline Progression

Required. - Save timestamp on unload/periodic save - On return calculate
elapsed time - Generation 1 target: 100% passive production for first 8
hours, then reduced/capped if needed - No conversions generated while
offline - No special encounters resolved offline - Passive Seeds and
eligible Funds accrue - Return modal summarizes gains - Clamp absurd
clock changes and negative elapsed time

## 19. Visual Progression

Generation 1 starts: - Muted palette - Rain/overcast or similar
atmospheric pressure - Advertising/noise - Worn infrastructure - Sparse
signs of community

During Generation 1, ministry becomes visible: - Literature table -
Helpers - Small gathering - Bible study indicator - More people stopping

After Next Generation: - Some repaired environment - More warmth/light -
Visible church/ministry sign in distance - Families/community details -
Older familiar characters - City is not utopia; it is visibly less bleak

The environment functions as a long-term progression display.

## 20. UX Principles

-   One-thumb friendly
-   Large tap targets
-   No precision required for core actions
-   Special sprites may use larger invisible hitboxes
-   Abbreviate large numbers: 1.2K, 4.8M, 2.1B
-   Provide Buy 1 / Buy 10 / Max when useful
-   Avoid modal spam
-   Dialogue should be skippable/fast
-   Settings always reachable
-   Music/SFX/mute controls
-   Desktop centers the mobile game; do not build a separate desktop
    layout
