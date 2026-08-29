# Court Legacy V2 Phase 6 — Official Tournaments Design

## 1. Purpose

Phase 6 adds the first complete official high-school tournament loop to Court Legacy V2.

The intended long-term loop is:

`training → official tournament → school/player results → reputation → scouting quality → graduation/intake → next season`.

Losing a tournament ends only that run. It never ends the save.

The browser may request an official match, but it never chooses the opponent, bracket result, seed, title, record increment, or reputation outcome.

---

## 2. Existing architecture to reuse

The existing code already provides:

- `qualifier`, `prefectural-tournament`, and `national-tournament` calendar activity types;
- `HistoricalMatchSummary.tournamentId`;
- school history counters for official wins/losses, prefectural titles, national appearances, and national titles;
- player career appearances, sets, points, blocks, service aces, awards, and `bestTournamentResultId`;
- annual reputation resolution from official results;
- `confirmBeforeOfficialMatch`;
- server-side `operationId` + revision semantics for game actions;
- the authoritative `simulateMatch` engine.

Phase 6 extends these boundaries instead of creating a parallel tournament service or second match engine.

---

## 3. World-size constraint

The current world contains the user school plus 15 persistent rival schools, all in the user's region.

### Prefectural stage

The prefectural bracket uses those existing 16 persistent schools and their live rosters.

### National stage

Phase 6 does not expand every save to hundreds of permanent schools.

Each national field contains:

- the persistent champion from the user's prefectural bracket;
- 15 deterministic guest regional representatives.

Guest representatives exist only inside the current national tournament. Their public identity and deterministic seed are persisted; their detailed roster is generated only when needed for a user match and is not permanently added to `state.schools` or `state.players`.

---

## 4. Scope

Phase 6 includes:

1. Interhigh and Spring High circuits every academic year;
2. 16-team prefectural brackets;
3. 16-team national brackets;
4. deterministic NPC-only bracket resolution;
5. user official matches through `simulateMatch`;
6. mandatory due-match gating before week advancement;
7. tournament bracket/next-match UI;
8. school official records and titles;
9. player official-match career statistics;
10. canonical multi-year tournament history;
11. existing reputation/scouting integration;
12. Phase 5 save migration to schema v3;
13. deterministic 30-year and 100-year verification;
14. mobile E2E plus existing PvP/scouting/shop regressions.

Out of scope:

- 47 fully persistent regions;
- PvP/live multiplayer tournaments;
- transfers;
- MVP/best-six individual awards;
- sponsorship/ticket revenue;
- tournament reward currency;
- user-editable brackets;
- real-money features.

---

## 5. Annual schedule

Scheduling uses academic-week offsets from April 1.

### Interhigh

| Level | Round | Week |
| --- | --- | ---: |
| Prefectural | Round of 16 | 9 |
| Prefectural | Quarterfinal | 10 |
| Prefectural | Semifinal | 11 |
| Prefectural | Final | 12 |
| National | Round of 16 | 16 |
| National | Quarterfinal | 17 |
| National | Semifinal | 18 |
| National | Final | 19 |

### Spring High

| Level | Round | Week |
| --- | --- | ---: |
| Prefectural | Round of 16 | 30 |
| Prefectural | Quarterfinal | 31 |
| Prefectural | Semifinal | 32 |
| Prefectural | Final | 33 |
| National | Round of 16 | 41 |
| National | Quarterfinal | 42 |
| National | Semifinal | 43 |
| National | Final | 44 |

Once the user is eliminated, future rounds of that stage no longer block week progression. NPC brackets continue automatically.

---

## 6. Domain model

Add focused modules under `src/domain/tournament/`.

Core types:

```ts
type TournamentCircuit = "interhigh" | "spring-high";
type TournamentLevel = "prefectural" | "national";
type TournamentRound = "round-of-16" | "quarterfinal" | "semifinal" | "final";

type TournamentEntrant =
  | {
      entrantId: string;
      source: "world-school";
      schoolId: SchoolId;
      displayName: string;
      shortName: string;
      seedStrength: number;
    }
  | {
      entrantId: string;
      source: "guest-representative";
      displayName: string;
      shortName: string;
      regionLabel: string;
      guestSeed: string;
      seedStrength: number;
    };

interface TournamentBracketMatch {
  id: string;
  round: TournamentRound;
  scheduledWeek: number;
  homeEntrantId: string | null;
  awayEntrantId: string | null;
  winnerEntrantId: string | null;
  homeSetsWon: number | null;
  awaySetsWon: number | null;
  status: "waiting" | "ready" | "user-required" | "completed";
}

interface TournamentStageState {
  tournamentId: string;
  circuit: TournamentCircuit;
  level: TournamentLevel;
  entrants: TournamentEntrant[];
  matches: TournamentBracketMatch[];
  championEntrantId: string | null;
  userEliminated: boolean;
  userBestRound: TournamentRound | null;
}

interface OfficialSeasonState {
  academicYear: number;
  interhigh: {
    prefectural: TournamentStageState;
    national: TournamentStageState | null;
  };
  springHigh: {
    prefectural: TournamentStageState;
    national: TournamentStageState | null;
  };
}
```

`GameState` gains `officialSeason: OfficialSeasonState`.

Only the current academic year's detailed tournament state is retained.

---

## 7. Save migration

Increment `CURRENT_GAME_SCHEMA_VERSION` from `2` to `3` and add `migrateVersionTwo()`.

A Phase 5 save migration must:

- preserve all existing player/school/world/recruiting/shop state;
- create the current academic year's `officialSeason`;
- derive bracket seeds from save seed + academic year + circuit;
- never reroll existing players;
- avoid consuming unrelated global RNG.

Tournament generation uses named deterministic sub-seeds so adding Phase 6 does not change unrelated training/event/scouting randomness.

---

## 8. Prefectural bracket generation

The field is exactly the 16 persistent world schools.

Rules:

1. calculate deterministic seed strength from current team strength/reputation;
2. place the top four seeds into separate quadrants;
3. deterministic-shuffle the remaining entrants;
4. persist the bracket for the stage;
5. refresh/reload never rerolls it;
6. the user gets no artificial seed bonus.

The browser cannot submit an opponent ID.

---

## 9. National guest representatives

After a prefectural final, its persistent champion enters the national field.

Fifteen guests are generated from circuit, academic year, national tournament ID, and slot index.

Persisted guest fields are limited to identity, region label, `guestSeed`, and bounded seed strength.

When the user faces a guest, the Worker deterministically creates a temporary school/roster/selection from `guestSeed`, augments a temporary simulation state, runs normal `simulateMatch`, then discards the temporary roster.

Guest players never accumulate in the permanent save.

---

## 10. NPC-only resolution

NPC-vs-NPC bracket matches use a deterministic lightweight resolver rather than full rally simulation.

Rules:

- team strength influences but does not guarantee the result;
- win probability is bounded to allow upsets;
- the same tournament/match seed always produces the same result;
- public score is `2-0` or `2-1`;
- no fake player career stats are generated;
- persistent world schools still receive official win/loss/title counters where applicable.

This keeps 100-year simulation affordable.

---

## 11. Official match action

Extend the existing game action union with:

```ts
{ type: "official-match" }
```

The request contains no opponent, tournament, round, seed, score, or reward fields.

The Worker derives the current due match from authoritative `officialSeason` and academic week.

### Preconditions

A user official match is allowed only when:

- one unresolved `user-required` match is due this week;
- revision matches;
- current-week training is complete;
- current team selection is valid;
- that bracket match is not already completed.

Expected conflicts include:

- `official_match_not_due`;
- `official_match_training_required`;
- `official_match_already_completed`;
- `official_match_invalid_team`.

### Idempotency

Reuse the existing `/game/action` operation ledger.

The same `operationId` and same request returns the stored result and cannot double-count match history, career stats, titles, qualification, or bracket advancement.

A stale revision changes nothing.

---

## 12. Week progression

On a due official-match week:

1. complete normal training;
2. play the official match;
3. commit match/bracket/history/stats atomically;
4. then allow `advance-week`.

`advance-week` returns `official_match_required` while a due user match remains unresolved.

Practice matches stay optional and do not satisfy this gate.

Advancing a week runs `advanceOfficialTournamentsThroughWeek()` to resolve NPC-only matches scheduled up through the new week.

---

## 13. User match simulation

User official matches reuse `simulateMatch` with `bestOfSets = 3`.

- persistent opponent: live school + `autoSelectTeam()`;
- guest opponent: deterministic temporary guest school/roster/selection.

Tournament IDs encode year/circuit/level/round, for example:

`official:interhigh:1:prefectural:semifinal`.

For world-school vs world-school official matches, reuse the existing `recordMatchOutcome()` path.

For user vs guest national matches, use a new focused `recordOfficialTournamentOutcome()` wrapper. It must:

- preserve a readable opponent snapshot (`displayName`, `shortName`) in the historical match record;
- increment the persistent user's official win/loss exactly once even though the guest is not in `state.schools`;
- append the canonical historical match exactly once;
- avoid creating rivalry state for a non-persistent guest;
- avoid permanently inserting the guest school or players.

`HistoricalMatchSummary` therefore gains optional immutable participant display snapshots for history rendering when a referenced school is transient.

This avoids dangling guest school IDs after the tournament ends.

---

## 14. School achievements

Existing `recordMatchOutcome()` remains canonical for persistent-world official matches.

Stage completion additionally applies:

- prefectural champion: `prefecturalTitles += 1`;
- persistent entrant reaching nationals: `nationalAppearances += 1` exactly once per national tournament;
- persistent national champion: `nationalTitles += 1`.

Guest representatives never create persistent `School` records.

These counters feed the existing annual `resolveSeasonReputation()` logic. Phase 6 adds no second reputation formula or tournament currency.

---

## 15. Canonical tournament history

`nationalChampionSchoolIdsByYear` cannot represent two national tournaments in one academic year.

Add:

```ts
interface OfficialTournamentSummary {
  tournamentId: string;
  academicYear: number;
  circuit: TournamentCircuit;
  level: TournamentLevel;
  champion: {
    entrantId: string;
    schoolId: SchoolId | null;
    displayName: string;
  };
  userResult: {
    qualified: boolean;
    bestRound: TournamentRound | null;
    champion: boolean;
  };
}

GameHistory.officialTournaments: OfficialTournamentSummary[];
```

This is the canonical history for new UI/features.

`nationalChampionSchoolIdsByYear` remains as a legacy mirror of the season-ending Spring High national champion only when that champion is a persistent world school.

Tournament summary retention is explicitly bounded for at least 100 academic years.

---

## 16. Player career stats

For user official matches, persistent players receive:

- `appearances += 1` for starting rotation and libero;
- `setsPlayed += completed set count` for those participants;
- `points` from authoritative point events;
- `blocks` from `point.block`;
- `serviceAces` from `point.serve-ace`.

The stat collector is isolated so future real substitutions can add incoming players without changing tournament progression.

`bestTournamentResultId` only improves according to one precedence table:

1. Spring High national champion;
2. Interhigh national champion;
3. national finalist;
4. national semifinalist;
5. national quarterfinalist;
6. national participant;
7. prefectural champion;
8. prefectural finalist;
9. prefectural semifinalist;
10. prefectural quarterfinalist;
11. prefectural participant.

No individual MVP/best-six awards are added in Phase 6.

---

## 17. UI

### Home

Add a compact `次の公式戦` card showing:

- tournament/round;
- opponent;
- `あとN週` or `今週`;
- training/match readiness.

If the user is eliminated, show the next circuit start rather than a blank card.

### Match tab

Add an official-tournament entry above practice/PvP when relevant.

The tournament screen shows:

- tournament name;
- `県予選` / `全国大会`;
- current round;
- 16-team bracket;
- highlighted user path;
- completed set scores;
- next opponent;
- `準備中` / `今週` / `敗退` / `優勝` status;
- official-match button when due.

The bracket must remain page-width safe on 320/360/390/480px. Horizontal movement, if needed inside the bracket itself, must be contained inside a labeled bracket region and must not cause body-level horizontal overflow.

### Confirmation and async states

If `confirmBeforeOfficialMatch` is true, use a confirmation step showing tournament, round, opponent, and current lineup.

Required visible async/recovery states include:

- `大会情報を読み込んでいます…`;
- `公式戦を開始しています…`;
- `試合結果を確定しています…`;
- `大会結果を保存しています…`;
- revision recovery message;
- unknown-result retry using the exact same `operationId`.

No blank or unlabeled frozen screen is allowed.

---

## 18. Calendar projection

Tournament state is authoritative. Calendar activities are presentation projections only.

Use:

- prefectural rounds → `prefectural-tournament`;
- national rounds → `national-tournament`.

Current due user matches are `mandatory: true` and carry circuit/level/round/tournament metadata.

Elimination removes future user-mandatory activities for that stage.

---

## 19. Security and authority

Never client-authoritative:

- bracket order;
- opponent assignment;
- guest generation strength/roster rules;
- NPC result;
- official-match seed/result;
- school/player record increments;
- title/qualification;
- reputation outcome.

The browser sends only the generic authenticated `official-match` action.

No browser direct Supabase write is introduced.

Phase 6 does not alter PvP privacy. Tournament guest data and current tournament state must not enter published PvP DTOs. Phase 5 `shopEffects` remain excluded from ranked PvP.

---

## 20. Atomicity

One committed official-match operation persists together:

- game revision;
- authoritative match result;
- bracket result/next round;
- school official records;
- historical match record;
- user player career stats;
- title/qualification changes.

Persistence failure means none of those changes are committed.

Same-op replay returns the stored response; stale revision mutates nothing.

---

## 21. Determinism

Use named tournament sub-seeds such as:

- `tournament:<academicYear>:<circuit>:prefectural:bracket`;
- `tournament:<academicYear>:<circuit>:national:field`;
- `tournament:<tournamentId>:npc:<matchId>`;
- `tournament:<tournamentId>:guest:<slotIndex>`;
- `tournament:<tournamentId>:user:<matchId>`.

Tournament setup must not perturb unrelated global RNG streams.

---

## 22. Long-run bounds

- detailed state: current academic year only;
- historical tournaments: bounded summaries;
- guest rosters: never permanent;
- generic match history: existing bounded policy;
- no stale user-required tournament match may survive past its stage/year.

A deterministic 100-year soak must remain bounded.

---

## 23. Testing

### Domain

- stable bracket generation;
- top-four quadrant separation;
- guest field determinism;
- NPC result determinism/upsets;
- qualification/elimination transitions;
- both circuits every year;
- title/appearance counters exactly once;
- transient guest history snapshots remain readable;
- player event-log stat extraction;
- `bestTournamentResultId` precedence;
- v2 → v3 migration.

### Worker/game action

- official match before training rejected;
- no due match rejected;
- stale revision preserves everything;
- duplicate operation replay does not double mutate;
- request cannot select opponent;
- world opponent and guest opponent both commit correctly;
- due official match blocks week progression;
- week progression resolves NPC-only matches.

### Long-run

- deterministic 30-year official-season progression;
- deterministic bounded 100-year soak;
- both circuits conclude each academic year;
- no permanently stuck stage;
- school title/appearance counters remain internally consistent.

### UI/E2E

1. reach Interhigh prefectural match;
2. training required first;
3. visible pending official-match state;
4. bracket advances after result;
5. reload preserves result;
6. unknown-result retry applies once;
7. stale revision does not double stats;
8. elimination allows future week progression;
9. prefectural championship creates national qualification;
10. national guest opponent result/history remains readable;
11. 320/360/390/480px body has no horizontal overflow;
12. existing practice match, scouting, PvP, and shop E2E remain green.

---

## 24. Implementation boundaries

Expected focused modules:

- `src/domain/tournament/tournamentModel.ts`;
- `src/domain/tournament/tournamentSchedule.ts`;
- `src/domain/tournament/generateTournamentBracket.ts`;
- `src/domain/tournament/resolveNpcTournamentMatch.ts`;
- `src/domain/tournament/tournamentProgression.ts`;
- `src/domain/tournament/officialMatchStats.ts`;
- `src/domain/tournament/guestRepresentative.ts`;
- `src/features/tournament/OfficialTournamentScreen.tsx`;
- `src/features/tournament/tournament.css`.

Touch existing `GameState`, codec, world/year progression, Worker game action, GameApp/Home/Match, and history presentation only at required integration points.

Do not put the tournament engine inside `GameApp.tsx` or `applyGameAction.ts`.

---

## 25. Stacked development

Branch:

`feature/court-legacy-v2-phase6-official-tournaments`

Base:

`feature/court-legacy-v2-phase5-shop-mvp`

The final Phase 6 PR remains Draft and unmerged until explicit integration authorization. Phase 4/5 remain unmerged during Phase 6 work.

---

## 26. Definition of done

Phase 6 is complete only when:

- both circuits progress from prefectural Round of 16 through national final;
- user matches use real `simulateMatch`;
- NPC progression is deterministic and bounded;
- losing never ends the save;
- official results feed existing annual reputation/scouting;
- player career stats survive into graduation summaries;
- transient national guests leave readable history without save bloat;
- Phase 5 saves migrate safely to schema v3;
- stale/duplicate operations cannot double-apply results;
- no new browser authority or PvP leakage exists;
- `npm run verify` is green;
- full Playwright E2E is green;
- 30-year and 100-year tournament tests are green;
- a Draft stacked PR exists and remains unmerged.
