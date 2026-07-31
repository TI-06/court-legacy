# Full Game UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 承認済みの濃紺・白・橙のゲームUIと主要4名のWebPキャラクター素材を全主要画面へ統合し、既存選手SVGを表示せずに既存ゲーム機能を維持する。

**Architecture:** 既存の `GameState`、ドメイン処理、画面遷移は維持し、表示層だけをテーマ、アプリシェル、キャラクター画像、画面別コンポーネントへ分割する。主要4名だけを静的WebPマニフェストから解決し、未登録または読込失敗時は画像要素を表示しない。

**Tech Stack:** React 19、TypeScript 5.9、Vite 7、Vitest 4、Testing Library、Playwright、Cloudflare Workers。

## Global Constraints

- `Player`、`School`、`GameState`、保存スキーマは変更しない。
- 育成、試合、年度更新、イベント効果、設備強化の計算は変更しない。
- 画像はリポジトリ同梱WebPのみ。外部URL、PNG、選手SVG、汎用シルエットへフォールバックしない。
- 画像未登録または読込失敗時も氏名、学校、背番号、状態、能力、操作を残す。
- 学校エンブレムとUIアイコンのSVGは継続利用できる。
- 下部ナビは「ホーム / 選手 / 育成 / 試合 / 学校」。
- 320px、360px、390px、430px、480pxで横スクロールを発生させない。
- 各タスクは失敗テスト、失敗確認、最小実装、成功確認、コミットの順で進める。

---

### Task 1: 主要4名のWebP素材マニフェスト

**Files:**
- Create: `src/assets/characters/featured/{kuroba-hayato,seto-soma,higami-ren,shiroma-minato}/*.webp`
- Create: `src/domain/appearance/featuredCharacterArt.ts`
- Test: `tests/unit/domain/appearance/featuredCharacterArt.test.ts`

**Interfaces:**
- Produces: `FeaturedArtVariant`、`FeaturedCharacterArtSet`、`resolveFeaturedCharacterArt()`、`resolveFeaturedArtUrl()`。

- [ ] **Step 1: 失敗テストを書く**

```ts
const art = resolveFeaturedCharacterArt(featuredPlayer, school);
expect(art).not.toBeNull();
expect(Object.values(art!).every((url) => url.endsWith(".webp"))).toBe(true);
expect(resolveFeaturedCharacterArt(normalPlayer, school)).toBeNull();
```

- [ ] **Step 2: テストを実行してモジュール未作成で失敗することを確認する**

Run: `npm run test -- tests/unit/domain/appearance/featuredCharacterArt.test.ts`

- [ ] **Step 3: 各選手へ次の7素材を配置する**

```text
bust-neutral.webp            1024x1365 透明背景
full-neutral.webp            1024x2048 透明背景
chibi-neutral.webp            768x768  透明背景
expression-neutral.webp       512x512  透明背景
expression-focused.webp       512x512  透明背景
expression-happy.webp         512x512  透明背景
expression-frustrated.webp    512x512  透明背景
```

髪色、瞳色、ユニフォーム、背番号は `characterWorld.ts` の4名定義と一致させる。画像へ日本語文字を焼き込まない。

- [ ] **Step 4: 静的importのマニフェストを実装する**

```ts
export type FeaturedArtVariant =
  | "bust"
  | "full"
  | "chibi"
  | "expression-neutral"
  | "expression-focused"
  | "expression-happy"
  | "expression-frustrated";

export interface FeaturedCharacterArtSet {
  bust: string;
  full: string;
  chibi: string;
  expressionNeutral: string;
  expressionFocused: string;
  expressionHappy: string;
  expressionFrustrated: string;
}

export function resolveFeaturedCharacterArt(
  player: Player,
  school?: School | null,
): FeaturedCharacterArtSet | null {
  const featured = resolveFeaturedCharacter(player, school);
  return featured ? FEATURED_ART[featured.characterId] ?? null : null;
}
```

4名×7素材をすべて静的importし、実行時パス生成は行わない。

- [ ] **Step 5: テストとビルドを実行する**

Run: `npm run test -- tests/unit/domain/appearance/featuredCharacterArt.test.ts && npm run build`

- [ ] **Step 6: コミットする**

Commit: `feat: add featured player WebP art manifest`

---

### Task 2: 読込失敗時に非表示となる `FeaturedPlayerArt`

**Files:**
- Create: `src/ui/FeaturedPlayerArt.tsx`
- Create: `src/ui/featured-player-art.css`
- Test: `tests/unit/ui/FeaturedPlayerArt.test.tsx`

**Interfaces:**
- Consumes: `resolveFeaturedArtUrl()`。
- Produces: `FeaturedPlayerArt({ player, school, variant, testId, loading })`。

- [ ] **Step 1: 未登録と読込失敗のテストを書く**

```tsx
render(<FeaturedPlayerArt player={featured} school={school} testId="art" variant="full" />);
fireEvent.error(screen.getByTestId("art"));
expect(screen.queryByTestId("art")).not.toBeInTheDocument();
expect(document.querySelector("[data-testid='player-character']")).toBeNull();

const { container } = render(
  <FeaturedPlayerArt player={normalPlayer} school={school} variant="chibi" />,
);
expect(container).toBeEmptyDOMElement();
```

- [ ] **Step 2: テスト失敗を確認する**

Run: `npm run test -- tests/unit/ui/FeaturedPlayerArt.test.tsx`

- [ ] **Step 3: 最小実装を書く**

```tsx
export function FeaturedPlayerArt(props: FeaturedPlayerArtProps) {
  const src = resolveFeaturedArtUrl(props.player, props.school, props.variant);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;

  return (
    <img
      alt=""
      aria-hidden="true"
      data-testid={props.testId}
      decoding="async"
      loading={props.loading ?? "lazy"}
      onError={() => setFailedSrc(src)}
      src={src}
    />
  );
}
```

CSSは `display:block`、`max-width:100%`、`object-fit:contain` のみを基本とし、背景画像や疑似要素で人物を補わない。

- [ ] **Step 4: テストを実行する**

Run: `npm run test -- tests/unit/ui/FeaturedPlayerArt.test.tsx`

- [ ] **Step 5: コミットする**

Commit: `feat: hide failed character art without fallback`

---

### Task 3: ゲームテーマとアプリシェル

**Files:**
- Create: `src/ui/theme/game-theme.css`
- Create: `src/ui/theme/GamePanel.tsx`
- Create: `src/ui/theme/GameIcon.tsx`
- Create: `src/ui/theme/StatBar.tsx`
- Create: `src/ui/shell/appNavigation.ts`
- Create: `src/ui/shell/GameHeader.tsx`
- Create: `src/ui/shell/BottomGameNav.tsx`
- Create: `src/ui/shell/GamePageFrame.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/app/app-shell.css`
- Modify: `src/mobile-layout.css`
- Test: `tests/unit/ui/theme/StatBar.test.tsx`
- Test: `tests/unit/ui/shell/BottomGameNav.test.tsx`

**Interfaces:**
- `StatBar({ label, value, valueLabel, tone })` は値を0〜100へ丸める。
- `BottomGameNav({ activeTab, onChange })` は既存 `AppTab` を利用する。

- [ ] **Step 1: `StatBar` とナビの失敗テストを書く**

```tsx
render(<StatBar label="攻撃" value={150} />);
expect(screen.getByTestId("stat-bar-fill")).toHaveStyle({ width: "100%" });

render(<BottomGameNav activeTab="home" onChange={onChange} />);
expect(screen.getByRole("button", { name: "ホーム" })).toHaveAttribute("aria-current", "page");
expect(screen.getByRole("button", { name: "選手" })).toBeVisible();
```

- [ ] **Step 2: テスト失敗を確認する**

Run: `npm run test -- tests/unit/ui/theme/StatBar.test.tsx tests/unit/ui/shell/BottomGameNav.test.tsx`

- [ ] **Step 3: テーマトークンを実装する**

```css
:root {
  --game-bg: #050b14;
  --game-panel: #0b1a2d;
  --game-panel-strong: #102945;
  --game-accent: #f47a18;
  --game-accent-blue: #2e8bd8;
  --game-text: #f4f7fb;
  --game-text-muted: #a9b8ca;
  --game-radius-lg: 18px;
  --game-radius-md: 12px;
  --game-nav-height: 68px;
}
```

- [ ] **Step 4: `App.tsx` 内のIcon、ナビ配列、header、navを新コンポーネントへ移す**

```ts
export const APP_NAVIGATION = [
  { id: "home", label: "ホーム", icon: "home" },
  { id: "team", label: "選手", icon: "team" },
  { id: "training", label: "育成", icon: "training" },
  { id: "match", label: "試合", icon: "match" },
  { id: "school", label: "学校", icon: "school" },
] as const;
```

`GamePageFrame` は最大幅480px、下部nav分のpadding、safe-areaを管理する。既存シートとイベントは同じReactルート内に維持する。

- [ ] **Step 5: テスト、型検査、既存E2Eを実行する**

Run: `npm run test -- tests/unit/ui/theme/StatBar.test.tsx tests/unit/ui/shell/BottomGameNav.test.tsx && npm run typecheck && npm run test:e2e -- tests/e2e/app-shell.spec.ts`

- [ ] **Step 6: コミットする**

Commit: `refactor: introduce premium game app shell`

---

### Task 4: SVGなしの選手カード、一覧、詳細、編成

**Files:**
- Create: `src/domain/selectors/playerPresentation.ts`
- Create: `src/features/team/PlayerRosterCard.tsx`
- Create: `src/features/team/PlayerDetailView.tsx`
- Create: `src/features/team/TeamLineupEditor.tsx`
- Create: `src/features/team/team-roster.css`
- Modify: `src/ui/PlayerTile.tsx`
- Modify: `src/ui/ui.css`
- Modify: `src/features/team/TeamScreen.tsx`
- Modify: `src/features/team/team.css`
- Test: `tests/unit/domain/selectors/playerPresentation.test.ts`
- Test: `tests/unit/features/team/PlayerDetailView.test.tsx`
- Test: `tests/unit/features/team/TeamScreen.test.tsx`

**Interfaces:**
- `calculatePlayerDisplayPower(player)` は10能力平均×100を返す。
- `summarizePlayerAbilities(player)` は `attack / defense / jump / stamina / mental` を返す。
- `TeamLineupEditor` は現行の自動編成、直接交代、先発固定、安全調整を保持する。

- [ ] **Step 1: 集計と画像なし詳細の失敗テストを書く**

```ts
expect(calculatePlayerDisplayPower(playerWithAll80)).toBe(8000);
expect(summarizePlayerAbilities(player)).toEqual({
  attack: 80,
  defense: 70,
  jump: 75,
  stamina: 85,
  mental: 80,
});
```

```tsx
render(<PlayerDetailView onBack={onBack} player={normalPlayer} school={school} />);
expect(screen.queryByRole("img")).not.toBeInTheDocument();
expect(screen.getByText("総合力")).toBeVisible();
```

- [ ] **Step 2: テスト失敗を確認する**

Run: `npm run test -- tests/unit/domain/selectors/playerPresentation.test.ts tests/unit/features/team/PlayerDetailView.test.tsx`

- [ ] **Step 3: 表示集計を実装する**

```ts
export function calculatePlayerDisplayPower(player: Player): number {
  const values = ABILITY_KEYS.map((key) => player.abilities[key]);
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) * 100;
}
```

attackはspikeとserve、defenseはreceiveとblock、mentalはdecisionとmentalの平均とする。

- [ ] **Step 4: `PlayerTile` から `PlayerCharacter` を除去する**

主要4名だけ `FeaturedPlayerArt variant="chibi"` を表示し、その他は画像wrapperを生成しない。背番号、状態pill、クリック名、既存test idは維持する。

- [ ] **Step 5: 現行編成ロジックを `TeamLineupEditor` へ移動する**

`cloneSelection`、交代、リベロ変更、先発固定、自動編成、安全調整、選手pickerを挙動変更なしで移す。

- [ ] **Step 6: `TeamScreen` を一覧と編成の2モードへ変更する**

```tsx
const [mode, setMode] = useState<"roster" | "lineup">("roster");
const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(null);
```

一覧にはポジションフィルターを置く。主要4名だけSD画像、一般選手は学校章と背番号を表示する。詳細は主要4名だけbustと4表情を表示し、一般選手では画像領域を作らない。

- [ ] **Step 7: 一覧、詳細、編成のテストを実行する**

Run: `npm run test -- tests/unit/domain/selectors/playerPresentation.test.ts tests/unit/features/team`

- [ ] **Step 8: コミットする**

Commit: `feat: add player roster and detail game screens`

---

### Task 5: ホームとイベントを承認デザインへ変更

**Files:**
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/home.css`
- Modify: `src/ui/FeaturedPlayerHero.tsx`
- Modify: `src/ui/featured-player-hero.css`
- Modify: `src/features/home/EventDialog.tsx`
- Modify: `src/features/home/event-dialog.css`
- Modify: `src/ui/BottomSheet.tsx`
- Modify: `src/ui/ui.css`
- Modify: `src/App.tsx`
- Modify: `tests/unit/features/home/HomeScreen.test.tsx`
- Modify: `tests/unit/features/home/EventDialog.test.tsx`

**Interfaces:**
- `HomeScreenProps` に `onOpenCalendar` を追加する。
- `BottomSheetProps` に `variant?: "sheet" | "fullscreen"` を追加する。
- イベント選択callbackは既存 `onChoose(choiceId)` を維持する。

- [ ] **Step 1: ホームとイベントの失敗テストを書く**

```tsx
expect(screen.getByText("NEXT MATCH")).toBeVisible();
expect(screen.getByTestId("home-featured-art")).toHaveAttribute("src", expect.stringContaining(".webp"));
expect(screen.queryByTestId("player-character")).not.toBeInTheDocument();
```

```tsx
expect(screen.getByRole("dialog")).toHaveClass("ui-bottom-sheet--fullscreen");
expect(document.querySelector("[data-testid='player-character']")).toBeNull();
```

- [ ] **Step 2: テスト失敗を確認する**

Run: `npm run test -- tests/unit/features/home/HomeScreen.test.tsx tests/unit/features/home/EventDialog.test.tsx`

- [ ] **Step 3: ホームを次の順へ再配置する**

1. シーズン、月、日付、評判
2. 学校章、主要選手bust、総合戦力
3. `NEXT MATCH`
4. 育成、選手、試合、予定の4操作
5. 今週進捗と次週ボタン
6. 直近試合、怪我、疲労

`FeaturedPlayerHero` は `PlayerCharacter` を削除し、`FeaturedPlayerArt variant="bust"` だけを使用する。主要4名が自校にいない場合は学校章と戦力だけのカードにする。

- [ ] **Step 4: イベントをfullscreen variantへ変更する**

`BottomSheet` のフォーカストラップ、body scroll lock、フォーカス復帰は維持する。actorが主要4名の場合だけ `FeaturedPlayerArt variant="full"` を表示し、一般選手では立ち絵containerを作らない。

- [ ] **Step 5: テストと型検査を実行する**

Run: `npm run test -- tests/unit/features/home && npm run typecheck`

- [ ] **Step 6: コミットする**

Commit: `feat: refresh home and full-screen story events`

---

### Task 6: 育成、試合、学校、共通シートを統一

**Files:**
- Modify: `src/features/training/TrainingScreen.tsx`
- Modify: `src/features/training/training.css`
- Modify: `src/features/training/training-direct.css`
- Modify: `src/features/match/MatchScreen.tsx`
- Modify: `src/features/match/match.css`
- Modify: `src/features/school/SchoolScreen.tsx`
- Modify: `src/features/school/school-screen.css`
- Modify: `src/ui/ChoiceCard.tsx`
- Modify: `src/ui/ChoiceChip.tsx`
- Modify: `src/ui/StickyActionBar.tsx`
- Modify: `src/features/calendar/CalendarSheet.tsx`
- Modify: `src/features/save/SaveSheet.tsx`
- Modify: `src/features/home/YearTransitionDialog.tsx`
- Modify: `src/ui/ui.css`

**Interfaces:**
- 各画面propsと既存callbackは変更しない。
- `PlayerTile` の主要4名のみWebP、一般選手は画像なしという規則を全画面で共通利用する。

- [ ] **Step 1: 現行の育成、試合、学校テストを単独実行する**

Run: `npm run test -- tests/unit/features/training tests/unit/features/match tests/unit/features/school`

- [ ] **Step 2: 育成を戦術ボード型へ変更する**

週間練習、重点選手、個人指示、疲労・怪我リスク、固定実行ボタン、結果サマリーの順で表示する。週間1回制限と既存accessible nameは維持する。

- [ ] **Step 3: 試合をスコアボード型へ変更する**

学校章、学校名、戦力、セットスコア、イベント再生、速度、結果を濃紺UIへ統一する。活躍選手が主要4名の場合だけbustを表示する。試合計算は変更しない。

- [ ] **Step 4: 学校を管理ダッシュボード型へ変更する**

学校章、評判、資金、戦績、宿命校をトップカードへ集約する。設備、記録、OBのview stateと設備強化callbackは維持する。

- [ ] **Step 5: 共通カードとシートをテーマへ統一する**

通常BottomSheet、ChoiceCard、ChoiceChip、StickyActionBar、Calendar、Save、YearTransitionを同じ色、角丸、safe-areaへ揃える。

- [ ] **Step 6: 回帰テストとE2Eを実行する**

Run: `npm run test -- tests/unit/features && npm run test:e2e -- tests/e2e/app-shell.spec.ts`

- [ ] **Step 7: コミットする**

Commit: `feat: unify training match school and shared sheets`

---

### Task 7: 旧選手SVG実装を除去

**Files:**
- Modify: `src/domain/appearance/characterWorld.ts`
- Modify: `src/main.tsx`
- Modify: `src/ui/ui.css`
- Modify: `src/ui/theme/game-theme.css`
- Modify: `docs/character-world.md`
- Delete: `src/ui/PlayerCharacter.tsx`
- Delete: `src/ui/character-world.css`
- Delete: `tests/unit/ui/PlayerCharacter.test.tsx`

**Interfaces:**
- 維持: `resolveFeaturedCharacter`、`resolveSchoolVisualTheme`、`resolveJerseyNumber`。
- 削除: `resolveCharacterVisual`、`CharacterVisual`、選手SVG専用型参照。

- [ ] **Step 1: `PlayerCharacter` と `resolveCharacterVisual` の参照が旧実装だけに残っていることを確認する**

Check: `src` と `tests` の文字列検索結果を記録し、刷新画面に参照があれば `FeaturedPlayerArt` または画像なし表示へ置換する。

- [ ] **Step 2: 選手SVGコンポーネント、専用CSS、専用テストを削除する**

学校エンブレムのCSSは `game-theme.css` へ移し、`main.tsx` の `character-world.css` importを削除する。

- [ ] **Step 3: `characterWorld.ts` を表示メタデータ専用へ縮小する**

4名の `characterId`、背番号、roleLabel、学校テーマは維持し、SVG描画用appearance組立てを削除する。

- [ ] **Step 4: ドキュメントを更新する**

`docs/character-world.md` に次を明記する。

```text
主要4名のみローカルWebPを表示する。
画像未登録選手は学校章、背番号、氏名、能力値で表現する。
画像読込失敗時は画像を非表示にし、代替キャラクターは表示しない。
```

- [ ] **Step 5: 全単体テスト、型検査、ビルドを実行する**

Run: `npm run test && npm run typecheck && npm run build`

- [ ] **Step 6: コミットする**

Commit: `refactor: remove legacy player SVG rendering`

---

### Task 8: モバイルE2Eと最終品質ゲート

**Files:**
- Create: `tests/e2e/game-ui-refresh.spec.ts`
- Modify: `tests/e2e/app-shell.spec.ts`
- Modify: UI/CSS files only when a failing assertion identifies a defect

**Interfaces:**
- E2E用にGameStateスキーマや本番コードの専用フラグを追加しない。

- [ ] **Step 1: 5幅の横スクロール検証を書く**

```ts
for (const width of [320, 360, 390, 430, 480]) {
  test(`no horizontal overflow at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const label of ["ホーム", "選手", "育成", "試合", "学校"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      const scrollWidth = await page.locator("html").evaluate((node) => node.scrollWidth);
      const clientWidth = await page.locator("html").evaluate((node) => node.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    }
  });
}
```

- [ ] **Step 2: 選手SVGが存在しない検証を書く**

```ts
await page.goto("/");
expect(await page.locator("[data-testid='player-character']").count()).toBe(0);
await page.getByRole("button", { name: "選手", exact: true }).click();
expect(await page.locator("[data-testid='player-character']").count()).toBe(0);
expect(await page.locator("img[src*='.webp']").count()).toBeGreaterThan(0);
```

- [ ] **Step 3: WebP通信失敗時の検証を書く**

```ts
await page.route("**/*.webp", (route) => route.abort());
await page.goto("/");
await expect(page.locator("img[src*='.webp']")).toHaveCount(0);
await expect(page.locator("[data-testid='player-character']")).toHaveCount(0);
await expect(page.getByRole("heading", { name: "監督ホーム" })).toBeVisible();
```

- [ ] **Step 4: 選手詳細、育成、試合、イベント、設備、保存の操作E2Eを追加する**

主要4名の詳細ではWebPと4表情を確認する。一般選手詳細では画像なしでも能力と戻る操作を確認する。イベントはfullscreen dialogとchoice解決を確認する。

- [ ] **Step 5: 全品質ゲートを実行する**

Run:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run verify
```

Expected: すべて終了コード0。`PlayerCharacter`、`player-character`、選手SVG用CSSの参照は0件。

- [ ] **Step 6: 最終コミットする**

Commit: `test: verify full mobile game UI refresh`

---

## Plan Self-Review Results

- **Spec coverage:** テーマ、シェル、主要4名WebP、一般選手画像なし、画像失敗時非表示、ホーム、選手、育成、試合、イベント、学校、SVG除去、レスポンシブ、品質ゲートをTask 1〜8で網羅した。
- **Placeholder scan:** 実装判断が未確定になる `TBD`、`TODO`、任意フォールバックは含めていない。
- **Type consistency:** `FeaturedArtVariant`、`FeaturedCharacterArtSet`、`resolveFeaturedCharacterArt`、`resolveFeaturedArtUrl`、`FeaturedPlayerArt` の名称を全タスクで統一した。
- **Critical acceptance:** 画像未登録と読込失敗の両方で選手SVGやシルエットを出さないことを単体テストとE2Eで検証する。