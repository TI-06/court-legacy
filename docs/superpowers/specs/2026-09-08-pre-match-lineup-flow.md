# Pre-Match Lineup Flow Specification

## Goal

All playable matches must have a clear pre-match preparation step before simulation. The player can adjust the starting lineup for that match without overwriting the saved long-term lineup.

## Match flow

1. Opponent is selected or becomes due.
2. Open pre-match preparation.
3. Show opponent identity and available strength/comparison information.
4. Allow temporary lineup edits.
5. Allow one-tap lineup presets.
6. Start the match with the temporary lineup.
7. Only then simulate and show the digest/result.

The same interaction model applies to practice matches, due official matches, and PvP challenges. Opponent data may be more limited for guest official entrants and asynchronous PvP snapshots; the pre-match screen must still show lineup editing and the known opponent summary.

## Temporary lineup rules

- The saved `CloudGameSnapshot.teamSelection` is the baseline.
- A pre-match draft is local UI state until the user presses `この編成で試合開始`.
- The draft is sent as match input and validated server-side.
- The server uses the draft only for that simulation.
- The persisted long-term `teamSelection` remains unchanged.
- Cancel/reset returns to the saved lineup.

## Presets

The pre-match screen provides these buttons:

- `ベスト`: current automatic best lineup.
- `1年中心`: maximize healthy first-year starters while preserving a valid volleyball lineup.
- `2年中心`: same for second-year players.
- `3年中心`: same for third-year players.
- `調子優先`: prioritize healthy players in better current condition while preserving position suitability.
- `元に戻す`: restore the saved baseline selection.

Grade presets are preferences, not hard constraints. Missing positions are filled by the best healthy available player.

## Individual editing

- Show six rotation starters plus libero in a compact mobile-first editor.
- Tapping a starter opens a bottom sheet of eligible roster players.
- Replacing a player updates bench membership and serving order consistently.
- Invalid selections cannot start a match.
- Long-press drag is not required on the pre-match screen; tap replacement is the primary mobile interaction.

## Practice / official weekly resolution

`advance-week` accepts an optional `matchSelection`.

- If a due official match or scheduled practice match exists, the client opens pre-match before calling `advance-week`.
- `advance-week` uses `matchSelection ?? saved teamSelection` for that match simulation.
- Weekly training/progression remains server-authoritative and atomic.
- The returned persisted `teamSelection` is always the saved long-term selection, not `matchSelection`.

## PvP

`PvpChallengeRequest` accepts an optional `selection` for backward compatibility.

- The client always sends the pre-match draft.
- The Worker validates it against the authoritative challenger state.
- Simulation uses a temporary challenger snapshot with the supplied selection.
- Published/saved team selection is not overwritten.
- The response remains sanitized and does not expose private roster data.

## Match presentation

- Pre-match screen is shown before digest.
- Main CTA is sticky above the bottom navigation and safe-area inset.
- Known strength/comparison data updates immediately when the draft changes.
- For opponents without a visible roster, show public team power/name and omit unavailable radar details rather than inventing values.
- Digest starts automatically after `試合開始` unless reduced-motion mode disables autoplay.

## Mobile acceptance criteria

- Layout works at 320, 360, 390 and 480 px widths.
- Primary touch targets are at least 44 px high where practical.
- No horizontal page overflow.
- One dominant primary CTA per state.
- Preset buttons may horizontally scroll on narrow screens.

## Verification

Required coverage:

- preset generation and valid fallback behavior;
- temporary lineup is used for practice/official simulation but not persisted;
- pre-match UI appears before `advance-week` match simulation;
- individual player replacement updates the temporary lineup;
- PvP challenge request uses the temporary lineup and Worker validates it;
- existing result/digest and PvP response sanitization regressions remain green.
