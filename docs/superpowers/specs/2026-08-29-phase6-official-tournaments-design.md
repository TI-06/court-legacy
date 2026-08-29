# Court Legacy V2 Phase 6 — Official Tournaments Design

## 1. Purpose

Phase 6 adds the first complete official high-school tournament loop to Court Legacy V2.

The goal is to connect the systems already built in Phases 1–5 into a meaningful multi-year core loop:

`training → official tournament → school/player results → reputation → scouting quality → graduation/intake → next season`.

The game remains endless. Losing a tournament ends only that tournament run; it never ends the save.

Phase 6 uses the existing server-authoritative game action boundary. The browser may request an official match, but it does not choose the opponent, bracket result, random seed, rewards, title, or reputation outcome.

---

## 2. Existing constraints and design choices

The current world contains the user school plus 15 persistent rival schools, all generated in the user's region. Existing models already provide:

- `qualifier`, `prefectural-tournament`, and `national-tournament` calendar activity types;
- `HistoricalMatchSummary.tournamentId`;
- school history counters for official wins/losses, prefectural titles, national appearances, and national titles;
- player career appearances, sets, points, blocks, service aces, awards, and best tournament result;
- season reputation resolution based on official results;
- `confirmBeforeOfficialMatch` in user settings;
- server-side `operationId` + revision semantics for game actions.

Phase 6 must therefore extend the current architecture rather than create a parallel match engine.

### 2.1 Persistent prefectural field

The prefectural bracket uses the existing 16 world schools. Their current rosters, condition, fatigue, tactics, facilities, and coach values remain the source of truth.

### 2.2 National field without exploding the world size

The existing save does not contain other-region schools. Phase 6 will not expand every save to hundreds of permanent schools.

Instead, each national tournament contains:

- the persistent prefectural champion from the user's 16-school region;
- 15 deterministic guest regional representatives.

Guest representatives exist only for the current national tournament. Their public identity/strength seed is persisted in tournament state. A detailed guest roster is generated deterministically only when needed for a user match and is not added permanently to the world roster.

This preserves a credible national tournament while avoiding permanent save bloat.

---

## 3. Scope

Phase 6 contains:

1. two official tournament circuits per academic year;
2. deterministic 16-school prefectural brackets;
3. deterministic 16-school national brackets;
4. automatic resolution of NPC-only bracket matches;
5. user official matches using the existing `simulateMatch` engine;
6. mandatory official-match gating before week advancement;
7. tournament bracket and next-match UI;
8. school official records/titles/national appearances;
9. user-player career statistics from official matches;
10. canonical tournament history across unlimited seasons;
11. tournament effects on annual reputation/scouting quality through existing reputation rules;
12. schema migration for existing Phase 5 saves;
13. 30-year and 100-year tournament soak tests;
14. mobile E2E and regression coverage for PvP, scouting, shop, and normal matches.

Phase 6 excludes:

- real-world prefecture datasets or 47 fully persistent regions;
- live multiplayer tournaments;
- PvP brackets;
- transfer students;
- individual tournament awards such as MVP/best six;
- spectators, ticket revenue, sponsorship, or real-money rewards;
- user-editable brackets;
- manual simulation of NPC-vs-NPC rallies;
- a second match engine.

---

## 4. Annual tournament calendar

An academic year starts on April 1. Tournament scheduling uses academic-week offsets so it remains deterministic when the save year changes.

Phase 6 has two circuits.

### 4.1 Interhigh circuit

| Level | Round | Academic week |
| --- | --- | ---: |
| Prefectural | Round of 16 | 9 |
| Prefectural | Quarterfinal | 10 |
| Prefectural | Semifinal | 11 |
| Prefectural | Final | 12 |
| National | Round of 16 | 16 |
| National | Quarterfinal | 17 |
| National | Semifinal | 18 |
| National | Final | 19 |

### 4.2 Spring High circuit

| Level | Round | Academic week |
| --- | --- | ---: |
| Prefectural | Round of 16 | 30 |
| Prefectural | Quarterfinal | 31 |
| Prefectural | Semifinal | 32 |
| Prefectural | Final | 33 |
| National | Round of 16 | 41 |
| National | Quarterfinal | 42 |
| National | Semifinal | 43 |
| National | Final | 44 |

The schedule intentionally leaves normal training/recruiting weeks between major competitions.

A user eliminated from a tournament is no longer blocked by that tournament's future rounds. NPC brackets continue automatically as weeks advance.

---

## 5. Tournament domain model

Phase 6 adds a dedicated domain model under `src/domain/tournament/`.

Recommended core types:

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
  roundIndex: number;
  slotIndex: number;
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

`GameState` gains:

```ts
officialSeason: OfficialSeasonState;
```

Tournament state is part of the authoritative game save. It is not a separate browser-owned store.

---

## 6. Game schema migration

Phase 6 increments `CURRENT_GAME_SCHEMA_VERSION` from `2` to `3`.

`gameStateCodec` adds `migrateVersionTwo()`.

For a Phase 5 save:

- preserve all existing world, player, school, scouting, PvP-independent, and shop effect state;
- create an `officialSeason` for the save's current academic year;
- derive bracket seeds from the save seed + academic year + circuit;
- never reroll players or existing world state;
- preserve current `randomCursor` unless tournament generation explicitly consumes a named deterministic sub-seed instead of the global cursor.

Tournament generation should use named deterministic sub-seeds and must not perturb unrelated event/training RNG streams.

---

## 7. Prefectural bracket generation

The prefectural field is exactly the 16 persistent world schools.

Bracket generation rules:

1. calculate a deterministic seed strength from current team strength/reputation;
2. place the top four seeds into separate bracket quadrants;
3. shuffle remaining entrants with a tournament-specific deterministic RNG;
4. bracket identity is stable for the entire stage;
5. refresh/reload must never reroll the bracket.

The user's school receives no special seeding beyond its actual current strength/reputation.

The browser cannot submit an opponent school ID.

---

## 8. National guest representatives

After the prefectural final is resolved, the champion becomes the persistent representative for the national field.

Fifteen guest regional representatives are generated from:

- tournament circuit;
- academic year;
- national tournament ID;
- guest slot index.

Each guest entrant stores only the data required to reproduce its team and present the bracket:

- public school name/short name;
- region label;
- deterministic `guestSeed`;
- bounded seed strength.

Guest strengths use a distribution centered above an average prefectural field so qualifying for nationals materially raises difficulty, while still allowing upsets.

When the user must play a guest school, the Worker builds a temporary detailed school/roster/selection from `guestSeed`, merges it into a temporary simulation state, runs the normal `simulateMatch`, and discards the guest roster after producing the authoritative result.

The persistent save does not accumulate guest players across seasons.

---

## 9. NPC-only match resolution

NPC-vs-NPC matches do not run the full rally simulator.

They use one deterministic bracket resolver based on entrant strength plus bounded tournament variance.

Rules:

- stronger teams are favored but never guaranteed;
- win probability is bounded so upsets remain possible;
- result is deterministic for the same tournament/match seed;
- public set result is either `2-0` or `2-1`;
- no player career stats are fabricated for NPC-only approximate matches;
- persistent world schools still receive official win/loss/title counters where applicable.

This keeps long-run 100-year simulation inexpensive while preserving meaningful bracket outcomes.

---

## 10. User official-match action

Phase 6 extends the existing game action union with:

```ts
{ type: "official-match" }
```

The request intentionally contains no:

- opponent ID;
- tournament ID;
- round;
- random seed;
- result;
- reward value.

The Worker derives all of those from authoritative `officialSeason` state and the current academic week.

### 10.1 Preconditions

An official match is allowed only when:

- an unresolved `user-required` tournament match exists for the current week;
- the user's current game revision matches;
- the current week's training is completed;
- the current team selection is valid;
- the user has not already completed that tournament match.

Otherwise return a specific rule conflict such as:

- `official_match_not_due`;
- `official_match_training_required`;
- `official_match_already_completed`;
- `official_match_invalid_team`.

### 10.2 Idempotency

Official matches reuse the existing `/game/action` operation ledger.

The same `operationId` + same request returns the stored response and cannot:

- play the same official match twice;
- double-count school wins/losses;
- double-count player statistics;
- grant two titles;
- advance the bracket twice.

A stale revision produces the existing revision conflict and does not mutate the bracket.

---

## 11. Week progression and mandatory match gate

Training remains the normal weekly prerequisite.

On a week with a user official match:

1. user completes normal training;
2. official match becomes executable;
3. user plays the official match;
4. the result/bracket/history/statistics are committed atomically;
5. only then may the user advance to the next week.

`advance-week` must reject advancement with `official_match_required` while the current week's user-required official match remains unresolved.

Practice matches remain optional and cannot satisfy or replace an official match.

Advancing a week also runs `advanceOfficialTournamentsThroughWeek()` so NPC-only matches scheduled up to the new week are resolved automatically.

---

## 12. Official match simulation

User official matches use the existing `simulateMatch` implementation and the current user `TeamSelection`.

Persistent-world opponents use `autoSelectTeam()` against their live roster.

National guest opponents use the temporary deterministic guest roster described above.

All Phase 6 official matches use `bestOfSets = 3` for MVP consistency.

The resulting match summary uses a tournament ID that encodes circuit, level, year, and round, for example:

`official:interhigh:1:prefectural:semifinal`.

This allows the existing `recordMatchOutcome()` path to update rivalry and official win/loss counters without creating a parallel history path.

---

## 13. School history and tournament achievements

`recordMatchOutcome()` remains the canonical match-history insertion and official win/loss counter path.

Phase 6 adds explicit stage-completion updates:

### Prefectural title

When a persistent world school wins a prefectural final:

- `school.history.prefecturalTitles += 1`.

### National appearance

When a persistent world school enters a national bracket:

- `school.history.nationalAppearances += 1` exactly once for that tournament.

### National title

When a persistent world school wins a national final:

- `school.history.nationalTitles += 1`.

Guest representatives do not create persistent `School` records.

These counters flow into the existing annual reputation resolver, so tournament success naturally changes future reputation/scouting outcomes.

---

## 14. Canonical tournament history

The current `nationalChampionSchoolIdsByYear` map cannot represent two national tournaments in one academic year. Phase 6 therefore adds a canonical history collection:

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

The collection is append-only with a bounded retention policy large enough for long careers.

For backwards compatibility, `nationalChampionSchoolIdsByYear` remains present but becomes a legacy mirror of the season-ending Spring High national champion when that champion is a persistent world school. New UI/history features use `officialTournaments` as canonical data.

---

## 15. Player career statistics

Official user matches update career statistics for persistent players only.

For each user official match:

- `appearances += 1` for starting rotation players and libero;
- `setsPlayed += completed set count` for those players;
- `points +=` authoritative point events credited to that player;
- `blocks +=` `point.block` events credited to that player;
- `serviceAces +=` `point.serve-ace` events credited to that player.

If substitution support later becomes active in the simulator, any incoming substitute who actually enters is also counted as an appearance. Phase 6 must structure the stat collector so this can be added without changing tournament logic.

`bestTournamentResultId` is updated only when the new result outranks the player's prior result using one explicit precedence table:

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

Phase 6 does not introduce individual MVP/best-six awards.

---

## 16. Tournament UI

### 16.1 Home

Home adds a compact `次の公式戦` card when the user remains active in an upcoming tournament.

Example:

- `インターハイ県予選 準々決勝`;
- `vs 白峰学園`;
- `あと2週` or `今週`;
- training/match readiness state.

When no user tournament match remains, show the next circuit start rather than an empty card.

### 16.2 Match tab

The normal match area gains an official-tournament entry above practice/PvP when relevant.

Tournament screen contains:

- tournament name;
- level (`県予選` / `全国大会`);
- current round;
- 16-team bracket;
- user's path highlighted;
- completed set scores;
- next opponent;
- status (`準備中`, `今週`, `敗退`, `優勝`);
- official-match start button when due.

Existing practice match and PvP remain separate modes.

### 16.3 Match confirmation

If `settings.confirmBeforeOfficialMatch` is true, starting an official match requires the existing confirmation pattern.

The confirmation shows tournament/round/opponent and current lineup status, but cannot alter the server-derived opponent.

### 16.4 Visible async states

Required labels include:

- `大会情報を読み込んでいます…`;
- `公式戦を開始しています…`;
- `試合結果を確定しています…`;
- `大会結果を保存しています…`;
- `最新のゲーム状態を読み込みました。もう一度お試しください`;
- `公式戦の結果を確認できませんでした [再試行]` for an unknown network result.

No blank screen or unlabelled frozen state is allowed.

Unknown-result retry must reuse the exact same operation request/`operationId`.

---

## 17. Calendar integration

Tournament helpers add/update `ScheduledActivity` entries for the user's relevant official rounds.

Mapping:

- prefectural qualification rounds → `prefectural-tournament`;
- national rounds → `national-tournament`.

Each activity includes metadata for circuit, level, round, and tournament ID. User-required current matches are `mandatory: true`.

Elimination removes future user-mandatory activities for that stage. NPC tournament progression does not require browser calendar actions.

The tournament state remains authoritative; calendar activities are presentation/scheduling projections and must not be used as the sole bracket source of truth.

---

## 18. Reputation and scouting integration

Phase 6 does not add a second reputation formula.

Official wins/losses, prefectural titles, national appearances, and national titles feed the existing `resolveSeasonReputation()` calculation at the next academic-year rollover.

Because scouting quality already depends on school reputation/recent season performance, tournament success then improves future recruiting through the existing Phase 2 model.

This is the intended long-term loop and avoids one-off tournament reward currencies.

---

## 19. Security and authority boundaries

The following values are never client-authoritative:

- bracket seed/order;
- opponent assignment;
- guest representative strength/roster generation rules;
- NPC result;
- user official-match random seed;
- match winner/set scores;
- school history increments;
- player career-stat increments;
- tournament title;
- national qualification;
- reputation result.

The browser may send only the generic `official-match` game action through the existing authenticated game endpoint.

No browser direct Supabase write is introduced.

Phase 6 does not alter PvP DTO privacy. Guest tournament data must not be added to published PvP snapshots. `shopEffects` remain excluded from ranked PvP as established in Phase 5.

---

## 20. Atomicity and failure behavior

One successful official-match game operation atomically persists:

- GameState revision;
- active match/result;
- tournament bracket result;
- school official records/rivalry history;
- player career stats;
- stage title/qualification changes;
- newly derived next-round state.

If persistence fails, none of those changes are considered committed.

A retry with the same operation ID returns the prior committed response.

A new operation with a stale revision is rejected before simulation is committed.

---

## 21. Determinism

Phase 6 introduces named deterministic tournament seeds instead of consuming unrelated global RNG during bracket creation.

Seed families include:

- `tournament:<academicYear>:<circuit>:prefectural:bracket`;
- `tournament:<academicYear>:<circuit>:national:field`;
- `tournament:<tournamentId>:npc:<matchId>`;
- `tournament:<tournamentId>:guest:<slotIndex>`;
- `tournament:<tournamentId>:user:<matchId>`.

The same save state + operation produces the same bracket and authoritative simulation input.

Tournament implementation must not change unrelated event/scouting/training randomness merely because Phase 6 exists.

---

## 22. Long-run bounds

Unlimited play must not cause unbounded transient tournament state.

Rules:

- only the current academic year's detailed `officialSeason` is retained;
- completed historical tournaments are reduced to `OfficialTournamentSummary`;
- guest rosters are never appended permanently to `state.players`;
- full match history continues to use the existing bounded match-history policy;
- tournament summary history receives its own explicit maximum retention count sufficient for at least 100 academic years × 4 stage summaries if all four stage summaries are retained.

A 100-year soak must remain bounded and deterministic.

---

## 23. Testing strategy

### 23.1 Domain tests

Cover:

- stable bracket generation;
- top-four seed quadrant separation;
- deterministic guest field generation;
- deterministic NPC results;
- user qualification/elimination transitions;
- two circuits per academic year;
- no future mandatory matches after elimination;
- stage title counters exactly once;
- national appearance/title counters exactly once;
- canonical tournament-history summaries;
- player stat extraction from match event logs;
- tournament result precedence for `bestTournamentResultId`;
- schema v2 → v3 migration.

### 23.2 Worker/game action tests

TDD cases include:

- official match before training is rejected;
- no due match is rejected;
- stale revision leaves bracket/history/stats unchanged;
- duplicate operation ID replays without double mutation;
- user cannot submit/select opponent;
- official match commits bracket + history + stats together;
- week advancement is blocked by due official match;
- week advancement auto-resolves NPC-only matches.

### 23.3 Long-run tests

Add deterministic:

- 30-year tournament progression test;
- 100-year bounded world/tournament soak;
- assertion that each academic year produces both circuit conclusions;
- assertion that no tournament is permanently stuck in an unresolved state;
- assertion that title/appearance counts remain internally consistent.

### 23.4 UI tests

Cover:

- Home next official match card;
- tournament bracket rendering;
- current user path highlighting;
- training-required state;
- official-match confirmation setting;
- visible pending/result/error states;
- elimination and championship states;
- narrow-width bracket presentation without page-level horizontal overflow.

### 23.5 E2E

Required mobile flows:

1. reach an Interhigh prefectural user match;
2. training is required first;
3. start official match and see visible pending state;
4. result appears and bracket advances;
5. reload preserves result without replay;
6. duplicate/unknown result retry grants one result only;
7. stale revision is recoverable without double stats;
8. elimination permits future week progression;
9. prefectural championship creates national qualification;
10. supported 320/360/390/480px widths remain usable;
11. existing scouting/PvP/shop E2E remains green.

---

## 24. Implementation boundaries

Expected new focused modules:

- `src/domain/tournament/tournamentModel.ts`;
- `src/domain/tournament/tournamentSchedule.ts`;
- `src/domain/tournament/generateTournamentBracket.ts`;
- `src/domain/tournament/resolveNpcTournamentMatch.ts`;
- `src/domain/tournament/tournamentProgression.ts`;
- `src/domain/tournament/officialMatchStats.ts`;
- `src/domain/tournament/guestRepresentative.ts`;
- `src/features/tournament/OfficialTournamentScreen.tsx`;
- `src/features/tournament/tournament.css`.

Existing files should be changed only where the feature boundary requires it:

- `GameState` / persistence codec for schema v3 and history;
- `generateWorld` / academic-year progression for season creation;
- `weekProgression` / Worker game action for due-match gates/progression;
- `GameApp` / Home / Match UI for navigation and execution;
- existing match/world helpers for reusable result recording.

Do not fold all tournament logic into `GameApp.tsx` or `applyGameAction.ts`.

---

## 25. Rollout and stacked PR

Development branch:

`feature/court-legacy-v2-phase6-official-tournaments`

Base branch:

`feature/court-legacy-v2-phase5-shop-mvp`

Phase 6 is a stacked change on Phase 5. The final PR remains Draft and unmerged until explicit integration authorization.

Phase 6 should not retarget or merge Phase 4/5 during implementation.

---

## 26. Definition of done

Phase 6 is complete only when:

- both official circuits progress from prefectural Round of 16 through national final;
- user official matches use the real match simulator;
- NPC-only tournament progression is deterministic and bounded;
- losing never ends the save;
- tournament results feed existing reputation/scouting progression;
- player official-match career stats persist into graduation summaries;
- old Phase 5 saves migrate safely to schema v3;
- duplicate/stale operations cannot double-apply results;
- no new browser authority or PvP data leakage exists;
- full `npm run verify` is green;
- full Playwright E2E is green;
- 30-year and 100-year tournament simulations are green;
- a Draft stacked PR exists and remains unmerged.
