# Court Legacy Mobile UI Foundation Design

## Goal

Replace form-heavy smartphone interactions with direct, card-based controls that are understandable at a glance and operable with one thumb.

The first delivery applies the shared foundation to the Training and Team screens. Home and Match screens follow using the same components.

## Interaction principles

1. Do not use a native select for primary gameplay actions.
2. Show the available choices before the user taps.
3. Use one large primary action fixed near the bottom of the screen.
4. Open player replacement and detailed choices in a bottom sheet.
5. Keep touch targets at least 44px high.
6. Use short labels, status icons, and numeric summaries instead of long explanatory forms.
7. Preserve keyboard and screen-reader operation.
8. Keep all existing game-domain logic independent from React components.

## Shared UI components

### ChoiceCard

Used for team practice and other high-value choices.

- Displays title, short description, important effects, and selected state.
- Supports horizontal card scrolling on narrow screens.
- Uses `aria-pressed` for selection state.

### ChoiceChip

Used for short options such as individual instructions and filters.

- Selected state remains visible without reopening a control.
- Supports wrapping into multiple rows.

### PlayerTile

Used wherever the user directly chooses a player.

- Displays name, grade, position, condition, fatigue, and injury state.
- Shows selection, starter lock, and active/bench state.
- Does not expose all abilities at once.

### BottomSheet

Used to replace a court player, choose an individual instruction target, or open secondary details.

- Opens from the bottom of the viewport.
- Keeps the current context visible behind it.
- Traps focus while open.
- Closes by explicit button or Escape.

### StickyActionBar

Used for `練習を実行`, `編成を確定`, and later `試合開始`.

- Fixed above the bottom navigation.
- Shows validation state and the next action.
- Never covers the final content row.

### StatusPill

Used for fatigue, injury, selected role, and validation state.

## Training screen redesign

### Team practice

- Replace the team-practice select with horizontally scrollable ChoiceCards.
- All 12 menus remain accessible.
- Selected practice shows growth, fatigue, and injury risk immediately.

### Individual assignments

- Show two assignment slots.
- Tapping a slot opens a BottomSheet containing all player tiles.
- After selecting a player, show six instruction chips directly under the slot.
- The second slot automatically disables the player selected in the first slot.
- The primary action is placed in StickyActionBar.

### Training result

- Keep the current explainable results.
- Collapse unchanged players by default after the first implementation pass.

## Team screen redesign

### Court

- Display six rotation positions in a volleyball-court grid.
- Tapping a court tile opens a BottomSheet with eligible replacements.
- Do not expose twelve-player selects on every court position.

### Libero and bench

- Display the libero as a dedicated tile below the court.
- Display bench players in a horizontal rail.
- Tapping a bench player can open replacement actions.

### Starter lock and safety

- Starter lock is a pin-style toggle on active player tiles.
- Safety options are compact switches in a separate settings sheet.
- Auto selection remains a visible secondary action.

## Home screen follow-up

- Replace static report cards with actionable cards.
- Show the current mandatory task first.
- Use the StickyActionBar for `次の週へ進む` when calendar progression exists.

## Match screen follow-up

- Create a matchup card, fixed scoreboard, event timeline, speed controls, and result analysis.
- Use the existing deterministic match engine.

## Acceptance criteria for the first UI PR

- Training and Team gameplay screens contain no native `select` elements.
- All 12 training menus are directly reachable.
- All 12 user-school players are reachable from player pickers.
- Duplicate individual-training assignments are impossible.
- Six rotation players and one libero can be replaced without a dropdown.
- Starter lock and safety settings remain functional.
- 360x800 and 390x844 have no horizontal page overflow.
- Existing training, team-selection, and domain tests remain green after test migration.
- Mobile Playwright flow covers direct-card selection and bottom-sheet replacement.

## Current incomplete gameplay backlog

The UI redesign does not imply that the following gameplay systems are complete:

- Match screen and match playback UI.
- School-management screen.
- Weekly calendar advancement.
- Tournament scheduling and progression.
- Event selection, event choices, cooldowns, and event chains.
- Graduation and annual intake transition.
- Rival-school yearly development and decline.
- IndexedDB save slots, backups, import/export, and migrations.
- New-game setup instead of the fixed demo game.
- Records, alumni, and historical archive screens.
- Character-part generation and PixiJS match presentation.
- PWA/offline release hardening.

## Delivery order

1. Shared UI primitives.
2. Training screen migration.
3. Team screen migration.
4. Mobile E2E and accessibility review.
5. Home screen migration.
6. Match screen implementation.
