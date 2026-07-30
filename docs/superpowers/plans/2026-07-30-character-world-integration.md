# Character World Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 主要4校と看板選手を新規ゲームへ確実に生成し、ホーム・編成・イベントへ学校別のオリジナルキャラクター表現を統合する。

**Architecture:** 永続化モデルは変更せず、世界生成時のプロフィール上書きと、名前・学校から解決する表示専用カタログを追加する。キャラクターは外部画像に依存しないSVG描画とし、看板選手は専用定義、その他は `appearanceSeed` の決定論的定義へフォールバックする。

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, Testing Library, Playwright, SVG/CSS

## Global Constraints

- `Player`、`School`、`GameState` の永続化スキーマを変更しない。
- 主要校は青嵐高校、烏峰高校、紅耀高校、白凪高校とする。
- 看板選手は瀬戸 蒼真、黒羽 隼斗、火神 蓮、白間 湊とする。
- 特定の既存作品・学校・キャラクターを直接再現しない。
- 320px幅で横スクロールを発生させない。
- 外部画像・外部通信へ依存しない。

---

### Task 1: 主要校・看板選手の世界生成

**Files:**
- Create: `src/domain/generation/featuredWorldCatalog.ts`
- Modify: `src/app/createDemoGame.ts`
- Modify: `src/domain/generation/generateWorld.ts`
- Test: `tests/unit/domain/generation/generateWorld.test.ts`

**Interfaces:**
- Produces: `FEATURED_SCHOOL_SETUPS`, `applyFeaturedPlayerProfile(school, squad)`
- Consumes: `School`, `Player`, `UniformColors`, `Position`

- [ ] **Step 1: Write the failing world-generation test**

Add a test that creates the demo world and asserts:

```ts
const state = createDemoGame();
const featured = [
  ["青嵐高校", "瀬戸 蒼真", "S"],
  ["烏峰高校", "黒羽 隼斗", "OH"],
  ["紅耀高校", "火神 蓮", "OP"],
  ["白凪高校", "白間 湊", "L"],
] as const;

for (const [schoolName, playerName, position] of featured) {
  const school = Object.values(state.schools).find(
    (candidate) => candidate.name === schoolName,
  );
  expect(school).toBeDefined();
  const player = school?.playerIds
    .map((id) => state.players[id])
    .find((candidate) =>
      candidate
        ? `${candidate.lastName} ${candidate.firstName}` === playerName
        : false,
    );
  expect(player?.preferredPosition).toBe(position);
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/domain/generation/generateWorld.test.ts`

Expected: FAIL because the demo school is still 蒼波高校 and the fixed featured schools/players do not exist.

- [ ] **Step 3: Add the featured world catalog**

Create `featuredWorldCatalog.ts` with exact school setup and player override data:

```ts
export interface FeaturedPlayerProfile {
  fullName: string;
  reading: string;
  position: Position;
  heightCm: number;
  bodyType: BodyType;
  appearanceSeed: number;
  abilityMinimums: Partial<PlayerAbilities>;
}

export interface FeaturedSchoolSetup {
  name: string;
  shortName: string;
  coachName: string;
  uniform: UniformColors;
  featuredPlayer: FeaturedPlayerProfile;
}
```

Implement `applyFeaturedPlayerProfile` by selecting a squad member with the target position, falling back to the first player. Update name, reading, position, aptitude, dimensions, seed, and ability minimums while preserving IDs, career, grade, state, traits, and injury.

- [ ] **Step 4: Integrate featured schools into world generation**

Change the demo user school to 青嵐高校. Ensure the three featured rival schools are inserted first, then fill the remaining rival slots from the existing randomized catalog without duplicate names or short names. Call `applyFeaturedPlayerProfile` after squad generation and before storing players.

- [ ] **Step 5: Run world-generation tests and verify GREEN**

Run: `npx vitest run tests/unit/domain/generation/generateWorld.test.ts`

Expected: PASS with 16 unique schools, 192 players, and all four featured profiles.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/app/createDemoGame.ts src/domain/generation/featuredWorldCatalog.ts src/domain/generation/generateWorld.ts tests/unit/domain/generation/generateWorld.test.ts
git commit -m "feat: 主要校と看板選手を世界生成へ追加"
```

### Task 2: 学校テーマ・専用キャラクター解決

**Files:**
- Create: `src/domain/appearance/characterWorld.ts`
- Test: `tests/unit/domain/appearance/characterWorld.test.ts`

**Interfaces:**
- Produces:
  - `resolveFeaturedCharacter(player): FeaturedCharacterVisual | null`
  - `resolveSchoolVisualTheme(school): SchoolVisualTheme`
  - `resolveJerseyNumber(player): number`
  - `resolveCharacterVisual(player, school): CharacterVisual`

- [ ] **Step 1: Write failing resolver tests**

Cover exact featured IDs and fallback determinism:

```ts
expect(resolveCharacterVisual(seto, seiran)).toMatchObject({
  characterId: "seto-soma",
  jerseyNumber: 7,
  roleLabel: "司令塔",
  eyeColor: "#79c7e8",
});

expect(resolveCharacterVisual(generic, school)).toEqual(
  resolveCharacterVisual({ ...generic }, school),
);
```

Also verify each school returns the expected motif: `wave`, `wing`, `fortress`, `mist`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/domain/appearance/characterWorld.test.ts`

Expected: FAIL because `characterWorld.ts` does not exist.

- [ ] **Step 3: Implement the visual resolver**

Define featured character data for the four names. Each definition includes:

```ts
interface FeaturedCharacterVisual {
  characterId: string;
  jerseyNumber: number;
  roleLabel: string;
  hairColor: string;
  hairAccent: string;
  eyeColor: string;
  skinShadow: string;
  uniformPattern: UniformPattern;
  signaturePose: CharacterPose;
}
```

`resolveSchoolVisualTheme` maps featured school names to motif and palette; unknown schools use their existing uniform and a seed-independent `shield` motif. `resolveJerseyNumber` uses the fixed featured number or `1 + appearanceSeed % 18`.

- [ ] **Step 4: Run resolver tests and verify GREEN**

Run: `npx vitest run tests/unit/domain/appearance/characterWorld.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/domain/appearance/characterWorld.ts tests/unit/domain/appearance/characterWorld.test.ts
git commit -m "feat: キャラクター世界観の表示定義を追加"
```

### Task 3: SVGキャラクターと学校エンブレム

**Files:**
- Create: `src/ui/SchoolEmblem.tsx`
- Modify: `src/ui/PlayerCharacter.tsx`
- Modify: `src/ui/PlayerTile.tsx`
- Modify: `src/ui/ui.css`
- Test: `tests/unit/ui/PlayerCharacter.test.tsx`

**Interfaces:**
- `PlayerCharacter` adds `school?: School` and `variant?: "chibi" | "portrait"`
- `PlayerTile` adds `school?: School` while retaining `uniform?` compatibility
- `SchoolEmblem` consumes `school` and optional `compact`

- [ ] **Step 1: Write failing UI tests**

Render the demo featured player and assert:

```ts
render(<PlayerCharacter player={player} school={school} variant="portrait" />);
expect(screen.getByTestId("player-character")).toHaveAttribute(
  "data-character-id",
  "seto-soma",
);
expect(screen.getByTestId("player-character-number")).toHaveTextContent("7");
expect(screen.getByTestId("player-character-iris")).toHaveAttribute(
  "fill",
  "#79c7e8",
);
expect(screen.getByTestId("school-emblem")).toHaveAttribute(
  "data-school-motif",
  "wave",
);
```

Keep the existing assertions for uniform colors and decorative SVG behavior.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/ui/PlayerCharacter.test.tsx`

Expected: FAIL because the new props, data attributes, number layer, iris layer, and emblem do not exist.

- [ ] **Step 3: Implement `SchoolEmblem`**

Use one inline SVG component with four motif paths and a shield fallback. Use `school.uniform.primary`, `secondary`, and `accent`; set `data-school-motif` and `data-testid="school-emblem"`.

- [ ] **Step 4: Enhance `PlayerCharacter`**

Integrate `resolveCharacterVisual` and add:

- featured hair and accent layers
- colored iris layer
- nose, cheek, neck, and uniform shadow layers
- V-neck and sleeve trim
- jersey number text with `data-testid="player-character-number"`
- chest emblem using `SchoolEmblem`
- `portrait` viewBox/cropping while preserving `chibi` default
- `data-character-id` and `data-school-motif`

Unknown players continue to use `assemblePlayerAppearance` and the same deterministic structure.

- [ ] **Step 5: Pass school context through `PlayerTile`**

When `school` is present, use `school.uniform` and pass `school` into `PlayerCharacter`. Show the deterministic jersey number beside the position badge without removing grade/position/height text.

- [ ] **Step 6: Update character CSS**

Add portrait sizing, layered character backgrounds, school-accent border, and mobile-safe dimensions. Avoid fixed minimum widths.

- [ ] **Step 7: Run UI tests and verify GREEN**

Run: `npx vitest run tests/unit/ui/PlayerCharacter.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add src/ui/SchoolEmblem.tsx src/ui/PlayerCharacter.tsx src/ui/PlayerTile.tsx src/ui/ui.css tests/unit/ui/PlayerCharacter.test.tsx
git commit -m "feat: 学校別アニメキャラクター描画を追加"
```

### Task 4: ホーム・編成・イベント統合

**Files:**
- Create: `src/ui/FeaturedPlayerHero.tsx`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/home.css`
- Modify: `src/features/home/EventDialog.tsx`
- Modify: `src/features/home/event-dialog.css`
- Modify: `src/features/team/TeamScreen.tsx`
- Modify: `src/features/training/TrainingScreen.tsx`
- Modify: `src/features/team/team-direct.css`
- Modify: `src/mobile-layout.css`
- Test: `tests/unit/features/home/HomeScreen.test.tsx`
- Test: `tests/unit/features/home/EventDialog.test.tsx`

**Interfaces:**
- `FeaturedPlayerHero` consumes `player`, `school`, and optional `onOpenTeam`
- Home selects a named featured player, otherwise captain, otherwise first player

- [ ] **Step 1: Write failing home hero test**

Render `HomeScreen` using `createDemoGame()` and assert the region labelled `チームフェイス` contains `瀬戸 蒼真`, `司令塔`, `青嵐高校`, and a portrait `PlayerCharacter`.

- [ ] **Step 2: Write failing event-theme test**

Build a pending event with an actor from a featured rival school. Assert the actor card contains that school name, role label, and a `PlayerCharacter` with the rival character ID.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
npx vitest run tests/unit/features/home/HomeScreen.test.tsx tests/unit/features/home/EventDialog.test.tsx
```

Expected: FAIL because the hero and actor school-aware metadata are absent.

- [ ] **Step 4: Implement `FeaturedPlayerHero` and integrate HomeScreen**

The component displays portrait, school emblem, role, player name, grade/height, three position-relevant abilities, condition/fatigue, and a team-navigation button. Keep existing metrics and actions below it.

- [ ] **Step 5: Integrate school context into team and training tiles**

Replace `uniform={school.uniform}` with `school={school}` where the school object is available. Retain fallback uniform support for isolated tests and unknown contexts.

- [ ] **Step 6: Use actor ownership in EventDialog**

For each actor, resolve `state.schools[player.career.schoolId]`, pass that school to `PlayerCharacter`, and display school short name plus role label. Do not use the user school uniform for rival actors.

- [ ] **Step 7: Add responsive styles**

Add hero two-column desktop layout and stacked mobile layout. Cap portrait height, let actor cards wrap, and ensure 320px viewport remains free of horizontal overflow.

- [ ] **Step 8: Run focused UI tests and verify GREEN**

Run:

```bash
npx vitest run tests/unit/features/home/HomeScreen.test.tsx tests/unit/features/home/EventDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

```bash
git add src/ui/FeaturedPlayerHero.tsx src/features/home/HomeScreen.tsx src/features/home/home.css src/features/home/EventDialog.tsx src/features/home/event-dialog.css src/features/team/TeamScreen.tsx src/features/training/TrainingScreen.tsx src/features/team/team-direct.css src/mobile-layout.css tests/unit/features/home/HomeScreen.test.tsx tests/unit/features/home/EventDialog.test.tsx
git commit -m "feat: キャラクター世界観を主要画面へ統合"
```

### Task 5: 全体検証・レビュー・PR

**Files:**
- Modify only files required by verification findings
- Review: all branch changes against `docs/superpowers/specs/2026-07-30-character-world-integration-design.md`

- [ ] **Step 1: Run full verification**

Run: `npm run verify`

Expected: formatting, ESLint, typecheck, Vitest, and production build all exit successfully.

- [ ] **Step 2: Run mobile E2E**

Run: `npm run test:e2e`

Expected: all Playwright mobile scenarios pass with no horizontal-overflow assertion failures.

- [ ] **Step 3: Review the complete diff**

Check:

- no persistence model changes
- no direct copyrighted names/assets
- exactly 16 schools and 12 players per school remain
- featured profiles preserve player IDs and career ownership
- rival event actors use their own school theme
- generic players remain deterministic
- no temporary scripts or workflow files

- [ ] **Step 4: Fix review findings and repeat verification**

Repeat `npm run verify` and `npm run test:e2e` after every production-code correction.

- [ ] **Step 5: Open PR**

Create a PR from `feature/m5-character-world-integration` into `main` with implementation summary, test evidence, compatibility notes, and screenshots/visual notes where available.

- [ ] **Step 6: Merge only after latest CI succeeds**

Use the expected head SHA when merging. Confirm both `quality` and `mobile-e2e` jobs succeeded on that exact SHA.
