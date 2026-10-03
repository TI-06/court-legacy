# Phase57 Long-run Engagement Audit

Date: 2026-10-04

## Goal

Improve long-session engagement without adding another large subsystem or increasing save/network size.

Phase56 completed the team-identity loop. Phase57 starts by asking a different question:

> After several seasons, does each year feel meaningfully different, or does the player repeat the same optimized routine?

## Current strengths

The current game already has substantial breadth:

- weekly training and individual development
- practice matches and opponent recommendations
- official prefectural/national tournaments
- player concerns, injuries, relationships, traits, and special abilities
- annual scouting with visits/recommendation actions
- facilities up to level 50
- eight late-game special projects, with two purchases per year
- season goals and rankings
- rival history, school legacy, player career records, and awards
- team identity/mastery
- bounded long-run world/history persistence

The technical long-run base is also healthy. Existing tests cover 30-100 year progression, bounded rosters/history, save growth, and deterministic world evolution.

## Main engagement risk

The problem is not a lack of features. It is that many of those features reset into the same shape every year.

### 1. Annual goals repeat the same three dimensions

Season goals always resolve to:

- regional rank
- official wins
- tournament achievement

The ambition setting changes thresholds and rewards, but not the type of season the player is experiencing.

### 2. Weekly rhythm becomes optimizable

Normal events surface every three weeks, training persists, and Home already prioritizes tasks well.

Once the player has found a strong training setup and stable lineup, many weeks can become:

1. inspect Home
2. accept/skip optional content
3. advance week
4. repeat

This is good usability but weak long-run drama.

### 3. Scouting has decisions, but the annual pattern is fixed

The current recruiting year has meaningful limits:

- four school visits
- one recommendation slot
- up to seven commitments

Those constraints are good, but the strategic context around them changes less than the roster itself.

### 4. Late-game money has uses, but mature schools can repeat them

Facilities cap at level 50. Eight special projects provide strong late-game sinks, but after unlock the player can repeatedly choose from the same annual pool.

### 5. Events have breadth but limited season framing

The catalog is healthy enough to produce 10-18 root events per year and 30+ unique event IDs across the long-run simulation.

However, random events are not the same thing as a season arc. The player still needs a clear answer to:

> What makes this year different from last year?

## Phase57 direction

Do not solve this by adding more weekly buttons.

Instead, layer a small amount of season-level framing and a few meaningful turning points on top of the systems that already exist.

## PR57-1 — Season Story Foundation

Derive one compact season story from existing state.

Candidate stories:

- 王者防衛
- 黄金世代
- 集大成
- 再構築
- 全国上位挑戦
- 突破の年
- 土台づくり

Inputs are existing bounded state only:

- previous national result
- current roster grade balance
- exceptional player tiers
- season-start regional/national ranking
- school reputation

No new save field is required.

Home shows the story inside the existing season card, so Phase57 does not add vertical dashboard clutter.

## PR57-2 — Season Turning Points

Add at most two important decisions per season, not recurring weekly chores.

Examples:

- rebuild season: give first-years real match responsibility vs protect results
- senior window: push the third-year core vs rotate to preserve condition
- golden generation: build around the star vs keep a balanced system
- title defense: chase consecutive titles vs protect the next generation

Turning points should modify existing systems rather than create new meters.

Possible effects:

- training emphasis
- lineup expectations
- morale/trust
- scouting priority
- fatigue/recovery
- season reward multiplier

## PR57-3 — World Story Hooks

Connect the season arc to the rival world.

Surface only high-value developments:

- defending champion
- rising rival
- national star school
- revenge opponent
- surprise breakout school

Use existing world/rival/history data. Avoid storing a new unlimited news timeline.

## PR57-4 — Recruiting Context

Make scouting answer current roster needs.

Examples:

- graduating setter class
- weak libero pipeline
- oversized first-year class
- star-replacement search

The scouting search UI should explain why a candidate fits the current season/next season rather than merely showing raw talent.

## PR57-5 — Legacy-era Decisions

After facilities are mature, provide multi-year legacy choices rather than more facility levels.

Examples:

- elite youth pipeline
- alumni coaching network
- national analytics program
- scholarship/recruiting program
- medical-performance program

These should be expensive, mutually constrained, and bounded in persistence.

## Performance / save rules

Phase57 must preserve the recent save-stability work.

- no per-week narrative history
- no rally/event duplication
- no unbounded arrays
- prefer derived selectors over persisted state
- persist only player choices that must survive reload
- O(1) or bounded annual/weekly calculations
- keep Home task/news caps
- do not add another top-level mobile tab

## PR57-1 acceptance criteria

- season story is deterministic from current state
- prior national champion takes priority
- exceptional generations are recognizable
- senior-heavy and first-year-heavy rosters produce different framing
- season-start ranks are used so the story does not oscillate weekly
- Home remains compact
- no schema bump
- no additional save payload
- existing Home/mobile tests remain green
