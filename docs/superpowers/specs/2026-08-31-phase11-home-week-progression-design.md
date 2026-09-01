# Phase 11: Home-driven week progression and training result readability

## Summary

Phase 11 makes Home's `次の週へ進む` the single entry point for normal PvE game progression. Training and scheduled PvE matches are resolved from this flow. The Training and Match tabs become preparation / planning / reference surfaces rather than execution surfaces.

The same phase also redesigns the training-result BottomSheet because the current notification styles use dark-theme text tokens on the light `#f6f9fa` BottomSheet surface, producing very low contrast in production.

PvP remains explicitly user-triggered from the Match tab and is not part of weekly auto progression.

## Goals

1. Make `次の週へ進む` on Home the only normal PvE progression button.
2. Resolve the configured weekly training automatically when progression begins.
3. If a PvE match must be played, simulate and persist it from the progression action, then open match playback immediately.
4. After the user finishes viewing the match result, continue the same weekly progression. If another official match is due in the same week, show that match next. Otherwise advance the date and return Home.
5. Keep Training focused on training setup and scouting.
6. Keep Match focused on schedules, tournament brackets, practice-match requests/offers, and PvP.
7. Redesign the training-result sheet for high readability on 320–480 px screens.

## Non-goals

- PvP does not move into Home progression.
- Match simulation rules are unchanged.
- Tournament generation / qualification rules are unchanged.
- Training formulas and notification payload structure are unchanged unless a test proves a missing presentation field is required.
- No new persistence schema version is required unless implementation reveals a persisted state field is necessary.

## Current-state findings

### Weekly progression

`advance-week` currently performs training, appends the training notification, and then blocks if an official match is due. It does not execute a scheduled practice match before advancing.

Practice and official matches are separate actions (`practice-match`, `official-match`) and are started from Match-related UI.

### Match presentation

`MatchScreen` already supports a completed `SimulateMatchResult`. Therefore Home progression can simulate the match first and open the existing playback/result UI without presenting the old pre-match `試合開始` screen.

### Training result contrast defect

`BottomSheet` is a light surface (`#f6f9fa`). `training-result-notification.css` currently uses `var(--game-text)` / `var(--game-text-muted)` and translucent white backgrounds intended for dark game panels. This produces the washed-out result shown in production.

## UX architecture

### Home is the progression controller

Home retains one primary CTA: `次の週へ進む`.

Pressing it invokes one server-owned progression step. A step can have one of two outcomes:

1. **Match presentation required** — the current game date does not advance. The match is already simulated and persisted. The app opens match playback immediately.
2. **Week advanced** — the game date advances seven days and the app returns to Home.

The user never needs to visit Training or Match to execute normal weekly PvE activity.

### Progression order

For each `advance-week` request:

1. If training is incomplete, resolve the saved training plan and append the persistent training-result notification.
2. If an official match is due, resolve exactly one official match and return its simulation as `pendingMatchPresentation`. Do not advance the date.
3. Otherwise, if a practice match is scheduled and incomplete, and no official match has already been played on this game date, resolve the practice match and return it as `pendingMatchPresentation`. Do not advance the date.
4. Otherwise advance the week normally.

Official competition has priority over practice matches. If one or more official matches are played on the current game date, a scheduled practice match is not auto-played during that same weekly progression. This avoids a practice match being forced after a tournament round.

### Multiple official matches in one week

After match playback reaches the result screen, the primary CTA becomes `結果を確認して次へ`.

That CTA calls `advance-week` again:

- another official match due -> resolve one match and show the next playback;
- no further official match -> advance the week;
- no duplicate training occurs because weekly training is already marked complete.

This makes tournament chains deterministic while keeping one user-facing progression gesture.

### Reload / interruption behavior

The match itself is persisted before playback. If the user reloads during or after playback, the save remains valid. The user can continue from Home with `次の週へ進む`; already completed training / matches are not repeated.

No client-only state is authoritative for progression.

## Server / domain design

### Extend `advance-week`; do not create a second progression action

`advance-week` becomes the weekly progression state machine. Existing standalone `practice-match` and `official-match` actions may remain for backward compatibility/tests, but normal UI no longer invokes them directly.

The server action must remain idempotent through the existing operationId / revision persistence mechanism.

### Proposed outcome contract

`AdvanceWeekOutcome` becomes conceptually:

```ts
interface AdvanceWeekOutcome {
  trainingResult?: TrainingResult;
  pendingMatchPresentation?: {
    kind: "practice" | "official";
    simulation: SimulateMatchResult;
    official?: {
      tournamentId: string;
      circuit: TournamentCircuit;
      level: TournamentLevel;
      round: number;
      opponentDisplayName: string;
    };
  };
  weekAdvanced: boolean;
  academicYearTransition: AcademicYearTransitionSummary | null;
  recoveredPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
}
```

Exact naming may follow existing conventions, but these semantics are required.

### Reuse existing match functions

`applyAdvanceWeek` should compose existing authoritative helpers rather than duplicate simulation logic:

- `applyTraining`
- `applyPracticeMatch`
- `applyOfficialMatch`
- `advanceGameWeek`

When composing a nested action result, conflicts remain server-side rule conflicts and no partial week advance occurs.

### Detect official activity on the current game date

After all due official matches are gone, weekly progression must know whether an official match was played on the current date so it can skip an otherwise scheduled practice match. Prefer a small domain helper based on persisted official match history/tournament outcome data rather than client state.

Do not add a single `official-match completed` weekly flag because multiple official rounds may legitimately occur on the same game date.

## Client design

### `GameApp`

`advanceWeek()` becomes the only normal PvE execution path.

After `runAction({ type: "advance-week" })`:

- if `pendingMatchPresentation` exists:
  - set `activeMatchResult` to the returned simulation;
  - set match presentation metadata;
  - navigate to Match playback;
  - do not treat the week as completed yet;
- if `weekAdvanced`:
  - clear transient match presentation state;
  - show year transition when applicable;
  - return Home.

After the match result is fully revealed, `MatchScreen` invokes a continuation callback that calls `advanceWeek()` again.

### Match tab

Normal Match-tab content remains available for:

- upcoming official schedule / tournament bracket;
- practice-match requests and incoming offers;
- current scheduled practice opponent;
- PvP entry, publication, challenge, ranking and history.

Remove normal PvE execution affordances:

- no practice `試合開始` CTA from the planning tab;
- no official `試合開始` CTA from the tournament bracket.

Scheduled practice copy should clearly say that the match is executed by Home's `次の週へ進む`.

PvP remains directly executable in the Match tab.

### Training tab

Training remains setup-only:

- team training selection;
- individual training assignments;
- scouting entry / candidate acquisition.

Copy should continue to make it clear that saved training is executed when the user advances the week from Home.

## Training-result BottomSheet redesign

### Visual hierarchy

The sheet keeps the existing BottomSheet primitive but its content uses light-surface-specific colors instead of dark-panel tokens.

Layout:

1. Sticky sheet header: title + week/date + close action.
2. `チーム練習` summary card.
3. Compact overall metrics row: `能力成長`, `疲労`, `怪我`.
4. `選手別` section.
5. One clear card per player.

### Player card

Each player card contains:

- first row: player name (strong, dark) + `学年・ポジション`;
- ability-growth chips using orange accent;
- lower status row for fatigue, condition and trust;
- `怪我あり` uses a distinct red danger chip;
- `怪我なし` uses a quiet neutral/positive label.

Avoid the current washed-out white/translucent styling. All readable text on the light sheet must meet strong visual contrast, especially the player name, section labels and values.

### Mobile constraints

- minimum readable text: 12 px;
- player names: approximately 15–16 px / bold;
- section headings: approximately 14–15 px / bold;
- touch targets: minimum 44 px where interactive;
- no horizontal scrolling at 320, 360, 390, 414 or 480 px;
- sheet body scrolls vertically while header/close affordance remains obvious.

## Error handling

- Invalid team selection remains a server conflict; Home shows the existing operation error and does not advance.
- A scheduled practice match with a missing opponent remains a conflict; no silent week skip.
- Network/revision conflicts use existing `useGameSession` recovery behavior.
- A failed match progression never advances the date.
- Repeated operationId returns the exact persisted response and never resolves training or a match twice.

## Testing strategy

### Unit / domain

Add RED-first tests for `applyAdvanceWeek`:

1. training-only week -> training notification + week advances;
2. scheduled practice week -> training + practice simulation persisted, date unchanged;
3. continuing after practice result -> week advances without repeating training/match;
4. official match due -> training + one official simulation persisted, date unchanged;
5. multiple same-week official rounds -> one result per continuation;
6. official played on current date -> scheduled practice is skipped when official chain finishes;
7. duplicate operation replay -> exact response, no duplicate match/history/notification.

### UI tests

- Home next-week CTA opens match playback when progression returns a match.
- Practice planning and tournament screens contain no normal PvE `試合開始` action.
- PvP actions remain available.
- Match result continuation calls weekly progression instead of merely returning Home.
- Training-result sheet exposes strong semantic sections and all player status details.

### E2E

At minimum:

1. configure training -> schedule practice match -> Home -> `次の週へ進む` -> match playback -> result -> continue -> next week Home;
2. official-match week -> Home -> progression -> official playback -> result -> next progression;
3. training notification remains available/readable after the flow;
4. 320 / 360 / 390 / 414 / 480 px layout audit for the redesigned result sheet and match continuation CTA;
5. PvP flow remains manually initiated from Match.

## Acceptance criteria

Phase 11 is complete only when:

- Home is the only normal PvE execution entry point;
- scheduled practice and official matches can be reached without pressing a Match-tab start button;
- match playback still appears before the week advances;
- multiple official rounds can chain safely;
- PvP remains manual;
- Training and Match tabs function as setup/reference areas;
- the training result sheet is clearly readable on the provided production-style light BottomSheet;
- full Quality CI and mobile E2E are GREEN before merge;
- the post-merge `main` CI is GREEN.
