# 学校運営・カレンダー・固定ナビ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 下部5タブを常時固定し、学校タブの設備・記録・OB機能と、右上ボタンから操作できる週間カレンダーを実装する。

**Architecture:** 設備強化はReactから独立した純粋ドメイン関数として実装し、学校画面とAppは結果を受け取って状態を置き換える。学校画面とカレンダーは既存の`BottomSheet`を再利用し、週送り処理はAppの既存`advanceWeek`コールバックへ一本化する。

**Tech Stack:** React 19、TypeScript、Vite 7、Vitest、Testing Library、Playwright、Cloudflare Workers

## Global Constraints

- 下部ナビは320px、360px、390px、480pxでビューポート下端へ常時固定する。
- 本文の最下部を固定ナビで隠さない。
- 設備レベルは0〜5、強化費用は`基本費用 × (現在レベル + 1)`とする。
- 設備強化は現在のメモリ上の`GameState`へ反映し、セーブ／ロードは追加しない。
- 学校内部表示は`設備 / 記録 / OB`のセグメントボタンとし、ドロップダウンを使用しない。
- カレンダーはページ遷移ではなく既存`BottomSheet`で表示する。
- ホームとカレンダーの週送りは同一のAppコールバックを使用する。
- 公式大会、年度更新、卒業、新入生、イベント、スカウト実行は追加しない。

---

### Task 1: 下部ナビをビューポートへ固定する

**Files:**

- Modify: `src/app.css`
- Modify: `src/mobile-layout.css`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`

**Interfaces:**

- Consumes: `.app-shell`, `.app-content`, `.bottom-navigation`
- Produces: 固定ナビのCSS契約と、全幅での位置・重なり回帰テスト

- [ ] **Step 1: 固定位置を検証するE2Eを追加する**

```ts
const nav = page.getByRole("navigation", { name: "主要メニュー" });
const box = await nav.boundingBox();
expect(box).not.toBeNull();
expect(
  Math.abs((box?.y ?? 0) + (box?.height ?? 0) - page.viewportSize()!.height),
).toBeLessThanOrEqual(1);
```

各幅`320 / 360 / 390 / 480`で、ページ最下部までスクロール後も同じ検査を行う。最後の操作要素について`elementBox.y + elementBox.height <= navBox.y`も検証する。

- [ ] **Step 2: E2Eを実行してREDを確認する**

Run: `npx playwright test tests/e2e/mobile-layout-audit.spec.ts --project=chromium`
Expected: `position: sticky`のため、コンテンツ量またはスクロール状態によってナビ下端がビューポート下端と一致せずFAIL。

- [ ] **Step 3: 固定ナビCSSを実装する**

```css
.app-shell {
  --bottom-nav-height: calc(70px + env(safe-area-inset-bottom));
  padding-bottom: var(--bottom-nav-height);
}

.app-content {
  padding-bottom: calc(24px + var(--bottom-nav-height));
}

.bottom-navigation {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  max-width: 480px;
  margin-inline: auto;
}

@media (min-width: 520px) {
  .bottom-navigation {
    bottom: 20px;
  }
}
```

既存の二重余白が発生しないよう、`.app-shell`と`.app-content`のどちらか一方だけにナビ高さを持たせる形へ最終調整する。`ui-sheet-layer`のz-indexが固定ナビより高いことも確認する。

- [ ] **Step 4: E2Eを再実行する**

Run: `npx playwright test tests/e2e/mobile-layout-audit.spec.ts --project=chromium`
Expected: PASS。全幅でナビ下端がビューポート下端、または520px以上では20px上に一致する。

- [ ] **Step 5: コミットする**

```bash
git add src/app.css src/mobile-layout.css tests/e2e/mobile-layout-audit.spec.ts
git commit -m "fix: 下部ナビを画面下へ固定"
```

### Task 2: 設備強化ドメインを実装する

**Files:**

- Create: `src/domain/school/facilityUpgrade.ts`
- Create: `tests/unit/domain/school/facilityUpgrade.test.ts`

**Interfaces:**

- Consumes: `GameState`, `SchoolId`, `SchoolFacilities`
- Produces:
  - `type FacilityKey = keyof SchoolFacilities`
  - `FACILITY_DEFINITIONS: readonly FacilityDefinition[]`
  - `calculateFacilityUpgradeCost(key: FacilityKey, currentLevel: number): number`
  - `evaluateFacilityUpgrade(state: GameState, schoolId: SchoolId, key: FacilityKey): FacilityUpgradeEvaluation`
  - `upgradeFacility(state: GameState, schoolId: SchoolId, key: FacilityKey): GameState`

- [ ] **Step 1: 設備定義と強化契約の失敗テストを書く**

```ts
it("トレーニング設備Lv0の費用は70", () => {
  expect(calculateFacilityUpgradeCost("trainingRoom", 0)).toBe(70);
});

it("資金を減らして対象設備だけ1上げる", () => {
  const before = createDemoGame();
  const after = upgradeFacility(before, before.userSchoolId, "trainingRoom");
  expect(after.schools[before.userSchoolId]!.facilities.trainingRoom).toBe(1);
  expect(after.schools[before.userSchoolId]!.funds).toBe(230);
  expect(before.schools[before.userSchoolId]!.facilities.trainingRoom).toBe(0);
});

it("資金不足またはLv5では入力状態を返す", () => {
  const state = withFacilityAndFunds(createDemoGame(), "gym", 5, 9999);
  expect(upgradeFacility(state, state.userSchoolId, "gym")).toBe(state);
});
```

未知の学校ID、不正レベル、全8設備の基本費用、入力不変性も検証する。

- [ ] **Step 2: 単体テストを実行してREDを確認する**

Run: `npx vitest run tests/unit/domain/school/facilityUpgrade.test.ts`
Expected: モジュール未実装でFAIL。

- [ ] **Step 3: 最小実装を書く**

```ts
export interface FacilityDefinition {
  key: FacilityKey;
  name: string;
  baseCost: number;
  description: string;
}

export interface FacilityUpgradeEvaluation {
  allowed: boolean;
  reason: "available" | "insufficient-funds" | "max-level" | "invalid-level";
  currentLevel: number;
  nextLevel: number;
  cost: number;
  fundsAfter: number;
}
```

`upgradeFacility`は`evaluateFacilityUpgrade(...).allowed === false`なら同一参照を返し、許可時だけ自校School、facilities、GameStateを浅くコピーする。未知の学校IDと未知の設備キーは例外にする。

- [ ] **Step 4: 単体テストを再実行する**

Run: `npx vitest run tests/unit/domain/school/facilityUpgrade.test.ts`
Expected: PASS。

- [ ] **Step 5: コミットする**

```bash
git add src/domain/school/facilityUpgrade.ts tests/unit/domain/school/facilityUpgrade.test.ts
git commit -m "feat: 設備強化ドメインを追加"
```

### Task 3: 学校運営画面を実装する

**Files:**

- Create: `src/features/school/SchoolScreen.tsx`
- Create: `src/features/school/school-screen.css`
- Create: `tests/unit/features/school/SchoolScreen.test.tsx`

**Interfaces:**

- Consumes: `GameState`, `FacilityKey`, `FACILITY_DEFINITIONS`, `evaluateFacilityUpgrade`
- Produces: `SchoolScreen({ state, onUpgradeFacility })`

```ts
interface SchoolScreenProps {
  state: GameState;
  onUpgradeFacility: (key: FacilityKey) => void;
}
```

- [ ] **Step 1: 学校画面の失敗テストを書く**

```tsx
render(<SchoolScreen state={state} onUpgradeFacility={onUpgradeFacility} />);
expect(
  screen.getByRole("heading", {
    name: state.schools[state.userSchoolId]!.name,
  }),
).toBeVisible();
expect(screen.getByText("無名校")).toBeVisible();
expect(
  screen.getByRole("button", { name: "トレーニング設備を強化" }),
).toBeVisible();

await user.click(
  screen.getByRole("button", { name: "トレーニング設備を強化" }),
);
expect(screen.getByRole("dialog", { name: "設備を強化" })).toBeVisible();
expect(screen.getByText("Lv.0 → Lv.1")).toBeVisible();
await user.click(screen.getByRole("button", { name: "70を使って強化" }));
expect(onUpgradeFacility).toHaveBeenCalledWith("trainingRoom");
```

セグメント切替、直近5試合の新しい順、対戦校名、OB空状態、卒業生表示、資金不足・Lv5ボタン無効化もテストする。

- [ ] **Step 2: 単体テストを実行してREDを確認する**

Run: `npx vitest run tests/unit/features/school/SchoolScreen.test.tsx`
Expected: コンポーネント未実装でFAIL。

- [ ] **Step 3: 学校画面を実装する**

- `useState<"facilities" | "records" | "alumni">("facilities")`で内部表示を管理する。
- 評判は`Record<SchoolReputation, string>`で日本語化する。
- 設備カードはレベル、用途、次費用、強化ボタンを表示する。
- 確認には既存`BottomSheet`を使用する。
- 強化確定後は`onUpgradeFacility(selectedKey)`を呼び、シートを閉じる。
- 記録は自校が関係する`history.matches`を日付降順にして5件表示する。
- OBは`history.graduates.filter(item => item.schoolId === state.userSchoolId)`を表示する。
- 自校が見つからない場合は`role="alert"`でエラーを表示する。

- [ ] **Step 4: 学校画面テストを再実行する**

Run: `npx vitest run tests/unit/features/school/SchoolScreen.test.tsx`
Expected: PASS。

- [ ] **Step 5: コミットする**

```bash
git add src/features/school tests/unit/features/school
git commit -m "feat: 学校運営画面を追加"
```

### Task 4: 週間カレンダーシートを実装する

**Files:**

- Create: `src/features/calendar/CalendarSheet.tsx`
- Create: `src/features/calendar/calendar-sheet.css`
- Create: `tests/unit/features/calendar/CalendarSheet.test.tsx`

**Interfaces:**

- Consumes: `GameState`, `BottomSheet`
- Produces:

```ts
interface CalendarSheetProps {
  open: boolean;
  state: GameState;
  trainingCompleted: boolean;
  practiceMatchCompleted: boolean;
  onAdvanceWeek: () => void;
  onClose: () => void;
}
```

- [ ] **Step 1: カレンダー表示と週送りの失敗テストを書く**

```tsx
render(
  <CalendarSheet
    open
    state={state}
    trainingCompleted={false}
    practiceMatchCompleted={true}
    onAdvanceWeek={onAdvanceWeek}
    onClose={onClose}
  />,
);
expect(screen.getByRole("dialog", { name: "週間カレンダー" })).toBeVisible();
expect(screen.getByText("2026年4月1日")).toBeVisible();
expect(screen.getByText("練習 未実施")).toBeVisible();
expect(screen.getByRole("button", { name: "次の週へ進む" })).toBeDisabled();
```

練習完了時の週送り、予定の未来日付順最大8件、予定種別の日本語化、予定空状態、4週間ガイド、閉じる処理をテストする。

- [ ] **Step 2: 単体テストを実行してREDを確認する**

Run: `npx vitest run tests/unit/features/calendar/CalendarSheet.test.tsx`
Expected: コンポーネント未実装でFAIL。

- [ ] **Step 3: カレンダーシートを実装する**

- 既存`BottomSheet`を`title="週間カレンダー"`で使用する。
- 日付は`Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "UTC" })`で表示する。
- `state.calendar.activities`から`date >= state.date`だけを日付昇順にして8件表示する。
- ActivityTypeは設計書の日本語ラベルへ変換する。
- 4週間ガイドは現在日付へ0、7、14、21日をUTC加算して表示する。
- 練習未完了時は週送りボタンを無効化し、「練習を完了すると進めます」を表示する。
- 週送りボタンは`onAdvanceWeek()`だけを呼び、状態計算を持たない。

- [ ] **Step 4: カレンダーテストを再実行する**

Run: `npx vitest run tests/unit/features/calendar/CalendarSheet.test.tsx`
Expected: PASS。

- [ ] **Step 5: コミットする**

```bash
git add src/features/calendar tests/unit/features/calendar
git commit -m "feat: 週間カレンダーシートを追加"
```

### Task 5: Appへ学校運営とカレンダーを接続する

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Modify: `tests/unit/features/home/HomeScreen.test.tsx`
- Create: `tests/unit/features/school/AppSchoolCalendarFlow.test.tsx`

**Interfaces:**

- Consumes: `SchoolScreen`, `CalendarSheet`, `upgradeFacility`, 既存`advanceWeek`
- Produces: 右上カレンダー、学校タブ、設備状態更新、共通週送りの統合フロー

- [ ] **Step 1: App統合の失敗テストを書く**

```tsx
render(<App />);
await user.click(screen.getByRole("button", { name: "学校" }));
expect(screen.getByRole("heading", { name: "蒼波高校" })).toBeVisible();

await user.click(
  screen.getByRole("button", { name: "トレーニング設備を強化" }),
);
await user.click(screen.getByRole("button", { name: "70を使って強化" }));
expect(screen.getByText("Lv.1")).toBeVisible();
expect(screen.getByText("資金 230")).toBeVisible();

await user.click(screen.getByRole("button", { name: "予定を確認" }));
expect(screen.getByRole("dialog", { name: "週間カレンダー" })).toBeVisible();
```

ホームで練習完了後、カレンダーから次週へ進み、日付が7日進み、シートが閉じ、ホームになることもテストする。

- [ ] **Step 2: 統合テストを実行してREDを確認する**

Run: `npx vitest run tests/unit/features/school/AppSchoolCalendarFlow.test.tsx`
Expected: 学校プレースホルダーと無反応カレンダーボタンのためFAIL。

- [ ] **Step 3: App統合を実装する**

```ts
const [calendarOpen, setCalendarOpen] = useState(false);

const upgradeSchoolFacility = (key: FacilityKey) => {
  setAppState((current) => ({
    ...current,
    gameState: upgradeFacility(
      current.gameState,
      current.gameState.userSchoolId,
      key,
    ),
  }));
};
```

- `SchoolPlaceholder`を削除し、学校タブで`SchoolScreen`を描画する。
- 右上ボタンに`onClick={() => setCalendarOpen(true)}`を設定する。
- `CalendarSheet`をナビの後ではなくApp直下へ描画し、シートレイヤーを前面に保つ。
- `advanceWeek`の先頭で練習完了を確認し、実行後に`setCalendarOpen(false)`も行う。
- `main.tsx`で学校・カレンダーCSSを読み込むか、各コンポーネントから局所importする。

- [ ] **Step 4: 統合テストと既存関連テストを実行する**

Run: `npx vitest run tests/unit/features/school/AppSchoolCalendarFlow.test.tsx tests/unit/features/home/HomeScreen.test.tsx tests/unit/features/match/AppMatchFlow.test.tsx tests/unit/features/training/TrainingFlow.test.tsx`
Expected: PASS。

- [ ] **Step 5: コミットする**

```bash
git add src/App.tsx src/main.tsx tests/unit/features
git commit -m "feat: 学校運営とカレンダーをアプリへ接続"
```

### Task 6: 全幅E2E・回帰検証・レビューを完了する

**Files:**

- Modify: `tests/e2e/app-shell.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`
- Review: 全変更ファイル

**Interfaces:**

- Consumes: Tasks 1〜5の完成機能
- Produces: 公開可能なPRと検証証跡

- [ ] **Step 1: E2Eへ実操作フローを追加する**

各幅`320 / 360 / 390 / 480`で次を実施する。

```ts
await page.getByRole("button", { name: "学校", exact: true }).click();
await page.getByRole("button", { name: "トレーニング設備を強化" }).click();
await expect(page.getByRole("dialog", { name: "設備を強化" })).toBeVisible();
await page.getByRole("button", { name: "閉じる" }).last().click();
await page.getByRole("button", { name: "予定を確認" }).click();
await expect(
  page.getByRole("dialog", { name: "週間カレンダー" }),
).toBeVisible();
```

全タブで固定ナビ位置、最下部コンテンツとの非重複、画面外DOM、内部横スクロール、文字切れを検査する。

- [ ] **Step 2: 全品質ゲートを実行する**

Run: `npm run verify`
Expected: Formatting、ESLint、TypeScript、全単体テスト、本番ビルドがPASS。

Run: `npm run test:e2e`
Expected: 320px、360px、390px、480pxのMobile E2EがPASS。

- [ ] **Step 3: 差分レビューを行う**

確認項目:

- 設備強化で他校・選手・入力状態を変更していない。
- 資金不足、最大レベル、不正値で強化されない。
- カレンダーとホームが同一週送り処理を使う。
- 固定ナビがボトムシートより前面へ出ない。
- 学校・カレンダーに英語の内部値が露出しない。
- 未実装機能を実装済みと誤認させる表示がない。

- [ ] **Step 4: PRを作成してCIを確認する**

```bash
git push -u origin feature/m1-school-calendar-fixed-nav
gh pr create --base main --head feature/m1-school-calendar-fixed-nav --title "feat: 学校運営・カレンダー・固定ナビを追加"
```

GitHub Actionsで`quality`と`mobile-e2e`の両方が成功することを確認する。

- [ ] **Step 5: レビュー結果を記録しSquashマージする**

```bash
gh pr merge --squash --delete-branch
```

Expected: PRが`merged: true`となり、`main`へ1つのSquashコミットとして統合される。
