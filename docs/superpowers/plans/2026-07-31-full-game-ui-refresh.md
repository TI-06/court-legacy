# 全面UI・選手アート刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 濃紺・白・橙のゲームUIへ全主要画面を刷新し、主要4名は専用WebP、その他の全選手は `appearanceSeed` による透過WebPパーツ合成で同一世界観の画像を表示する。

**Architecture:** `Player`、`GameState`、年度更新、試合、育成、保存スキーマは維持する。既存 `playerAppearance.ts` の決定論的な外見レシピを再利用し、選手描画だけを `PlayerCharacter` のSVGから `PlayerArt` ファサードへ置き換える。`PlayerArt` は主要4名を専用画像へ、一般選手をWebPレイヤー合成へ振り分け、必須素材が1枚でも失敗した場合は選手画像全体を非表示にする。

**Tech Stack:** React 19、TypeScript 5.9、Vite 7、Vitest 4、Testing Library、Playwright、CSS mask、透過WebP、Cloudflare Workers。

## Global Constraints

- `Player`、`School`、`GameState`、保存スキーマへ必須フィールドを追加しない。
- 既存 `appearanceSeed` を一般選手の外見再現キーとして使用する。
- 育成、試合、年度更新、イベント効果、設備強化、セーブの計算を変更しない。
- 主要4名は専用WebP、その他の選手はWebPパーツ合成で表示する。
- 選手キャラクターにSVGを使用しない。
- 学校エンブレム、UIアイコン、装飾線のSVGは継続利用できる。
- 外部画像URL、実行時AI生成、外部API通信を使用しない。
- 必須画像が読み込めない場合は画像全体を非表示にし、SVG、代替人物、汎用シルエットへフォールバックしない。
- 画像非表示時も氏名、学校、背番号、状態、能力、操作を残す。
- 一般選手用パーツは `768x1024`、透明背景WebP、同一アンカーで作成する。
- 1選手あたりの必須レイヤーは最大10枚とする。
- 下部ナビは「ホーム / 選手 / 育成 / 試合 / 学校」。
- 320px、360px、390px、430px、480pxで横スクロールを発生させない。
- 各タスクは失敗テスト、失敗確認、最小実装、成功確認、コミットの順で進める。

---

### Task 1: 決定論的な選手アートレシピ

**Files:**
- Create: `src/domain/appearance/playerArtRecipe.ts`
- Modify: `src/domain/appearance/playerAppearance.ts`
- Test: `tests/unit/domain/appearance/playerArtRecipe.test.ts`
- Test: `tests/unit/domain/appearance/playerAppearance.test.ts`

**Interfaces:**
- Consumes: `assemblePlayerAppearance(player)`、`resolveSchoolVisualTheme(school)`、`resolveJerseyNumber(player)`。
- Produces: `PlayerArtVariant`、`PlayerArtRecipe`、`createPlayerArtRecipe()`、`playerArtIdentitySignature()`、`seedAppearanceSignature()`。

- [ ] **Step 1: 外見レシピの失敗テストを書く**

```ts
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  createPlayerArtRecipe,
  playerArtIdentitySignature,
} from "../../../../src/domain/appearance/playerArtRecipe";

it("creates the same recipe for the same saved player", () => {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const player = state.players[school.playerIds[0]!]!;

  expect(createPlayerArtRecipe(player, school)).toEqual(
    createPlayerArtRecipe({ ...player }, school),
  );
});

it("keeps identity stable while condition changes the expression", () => {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const player = state.players[school.playerIds[0]!]!;
  const healthy = createPlayerArtRecipe({ ...player, fatigue: 0 }, school);
  const tired = createPlayerArtRecipe({ ...player, fatigue: 90 }, school);

  expect(playerArtIdentitySignature(healthy)).toBe(
    playerArtIdentitySignature(tired),
  );
  expect(healthy.expression).not.toBe(tired.expression);
});
```

- [ ] **Step 2: テストを実行してモジュール未作成で失敗することを確認する**

Run: `npm run test -- tests/unit/domain/appearance/playerArtRecipe.test.ts`

Expected: FAIL with module resolution error for `playerArtRecipe`.

- [ ] **Step 3: 純粋なレシピ型を実装する**

```ts
export type PlayerArtVariant = "card" | "portrait" | "full";

export interface PlayerArtRecipe {
  catalogVersion: 1;
  appearanceSeed: number;
  jerseyNumber: number;
  heightBand: HeightBand;
  bodyType: BodyType;
  faceShape: FaceShape;
  eyeStyle: EyeStyle;
  browStyle: BrowStyle;
  mouthStyle: MouthStyle;
  hairStyle: HairStyle;
  hairColor: HairColor;
  skinTone: SkinTone;
  accessory: AccessoryStyle;
  uniformPattern: UniformPattern;
  pose: CharacterPose;
  expression: CharacterExpression;
  tier: PlayerTier;
  schoolTheme: SchoolVisualTheme;
}

export function createPlayerArtRecipe(
  player: Player,
  school?: School | null,
): PlayerArtRecipe {
  const appearance = assemblePlayerAppearance(player);
  return {
    catalogVersion: 1,
    appearanceSeed: player.appearanceSeed,
    jerseyNumber: resolveJerseyNumber(player),
    ...appearance,
    schoolTheme: resolveSchoolVisualTheme(school),
  };
}
```

`playerArtIdentitySignature()` は `expression` と学校色を除外し、本人固有の顔、髪、体格、装飾、ポーズだけを連結する。

- [ ] **Step 4: seedだけで比較できるシグネチャを追加する**

`playerAppearance.ts` の既存 `mixedValue()` と各カタログを再利用し、次の関数を追加する。

```ts
export function seedAppearanceSignature(seed: number): string {
  return [
    pick(seed, 1, FACE_SHAPES),
    pick(seed, 3, EYE_STYLES),
    pick(seed, 5, BROW_STYLES),
    pick(seed, 7, MOUTH_STYLES),
    pick(seed, 11, HAIR_STYLES),
    pick(seed, 13, HAIR_COLORS),
    pick(seed, 17, SKIN_TONES),
    pick(seed, 19, ACCESSORIES),
    pick(seed, 23, UNIFORM_PATTERNS),
  ].join("|");
}
```

既存配列の順序を変更しない。

- [ ] **Step 5: 単体テストを実行する**

Run: `npm run test -- tests/unit/domain/appearance/playerArtRecipe.test.ts tests/unit/domain/appearance/playerAppearance.test.ts`

Expected: PASS.

- [ ] **Step 6: コミットする**

```bash
git add src/domain/appearance/playerArtRecipe.ts src/domain/appearance/playerAppearance.ts tests/unit/domain/appearance/playerArtRecipe.test.ts tests/unit/domain/appearance/playerAppearance.test.ts
git commit -m "feat: add deterministic player art recipes"
```

---

### Task 2: WebPパーツカタログと静的マニフェスト

**Files:**
- Create: `src/assets/player-parts/v1/body/*.webp`
- Create: `src/assets/player-parts/v1/face/*.webp`
- Create: `src/assets/player-parts/v1/hair-back/*.webp`
- Create: `src/assets/player-parts/v1/hair-front/*.webp`
- Create: `src/assets/player-parts/v1/eyes/*.webp`
- Create: `src/assets/player-parts/v1/brows/*.webp`
- Create: `src/assets/player-parts/v1/mouths/*.webp`
- Create: `src/assets/player-parts/v1/uniforms/*.webp`
- Create: `src/assets/player-parts/v1/accessories/*.webp`
- Create: `src/assets/player-parts/v1/effects/*.webp`
- Create: `src/ui/player-art/generatedArtManifest.ts`
- Test: `tests/unit/ui/player-art/generatedArtManifest.test.ts`

**Interfaces:**
- Consumes: `PlayerArtRecipe`。
- Produces: `GeneratedArtLayer`、`GeneratedArtLayerSet`、`resolveGeneratedArtLayers(recipe)`。

- [ ] **Step 1: カタログ完全性の失敗テストを書く**

```ts
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { createPlayerArtRecipe } from "../../../../src/domain/appearance/playerArtRecipe";
import { resolveGeneratedArtLayers } from "../../../../src/ui/player-art/generatedArtManifest";

it("resolves a complete ordered WebP layer set", () => {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const player = state.players[school.playerIds[1]!]!;
  const layers = resolveGeneratedArtLayers(createPlayerArtRecipe(player, school));

  expect(layers.length).toBeGreaterThanOrEqual(8);
  expect(layers.length).toBeLessThanOrEqual(10);
  expect(layers.every((layer) => layer.url.endsWith(".webp"))).toBe(true);
  expect(layers.map((layer) => layer.slot)).toEqual([
    "hair-back",
    "body",
    "uniform",
    "face",
    "eyes",
    "brows",
    "mouth",
    "hair-front",
    "accessory",
  ]);
});
```

アクセサリなしの場合だけ `accessory` を省略するよう期待値を分岐する。

- [ ] **Step 2: テスト失敗を確認する**

Run: `npm run test -- tests/unit/ui/player-art/generatedArtManifest.test.ts`

Expected: FAIL because manifest does not exist.

- [ ] **Step 3: 768x1024の透明WebPパーツを作成する**

次の固定セットを作成する。

```text
body:        4 body types × 4 poses = 16
face:        4 face shapes = 4
hair-back:   8 hair styles = 8
hair-front:  8 hair styles = 8
eyes:        4 eye styles = 4
brows:       4 brow styles = 4
mouths:      4 mouth styles = 4
uniforms:    4 patterns × base/shadow = 8
accessories: headband, sports-glasses, ear-tape, wristband = 4
effects:     prospect, generational = 2
```

全素材で次を守る。

- 主要4名と同じ線幅、陰影、頭身、髪のハイライト
- 同一アンカー位置
- 日本語文字を含めない
- 透明余白を切り詰めない
- 1枚100KB以下を目標
- 塗り替え対象は白いマスク形状、陰影と線は通常カラー画像

- [ ] **Step 4: 静的importのマニフェストを実装する**

```ts
export type GeneratedArtLayerSlot =
  | "hair-back"
  | "body"
  | "uniform"
  | "face"
  | "eyes"
  | "brows"
  | "mouth"
  | "hair-front"
  | "accessory"
  | "effect";

export interface GeneratedArtLayer {
  slot: GeneratedArtLayerSlot;
  url: string;
  color?: string;
  mode: "image" | "mask";
}
```

各URLはViteの静的importで定義し、文字列連結による実行時パス生成を行わない。

- [ ] **Step 5: 学校色と状態をレイヤーへ割り当てる**

- 髪マスク: `hairColor` の固定色
- 肌マスク: `skinTone` の固定色
- 瞳マスク: 学校テーマ `glow`
- ユニフォームマスク: `schoolTheme.primary / secondary / accent`
- `tier === "prospect"`: prospect effect
- `tier === "generational"`: generational effect

- [ ] **Step 6: テストと本番ビルドを実行する**

Run: `npm run test -- tests/unit/ui/player-art/generatedArtManifest.test.ts && npm run build`

Expected: PASS and Vite emits all referenced WebP assets.

- [ ] **Step 7: コミットする**

```bash
git add src/assets/player-parts/v1 src/ui/player-art/generatedArtManifest.ts tests/unit/ui/player-art/generatedArtManifest.test.ts
git commit -m "feat: add versioned WebP player part catalog"
```

---

### Task 3: アセットロードキャッシュと `GeneratedPlayerArt`

**Files:**
- Create: `src/ui/player-art/assetLoadCache.ts`
- Create: `src/ui/player-art/useAssetBatchStatus.ts`
- Create: `src/ui/player-art/GeneratedPlayerArt.tsx`
- Create: `src/ui/player-art/player-art.css`
- Test: `tests/unit/ui/player-art/assetLoadCache.test.ts`
- Test: `tests/unit/ui/player-art/GeneratedPlayerArt.test.tsx`

**Interfaces:**
- Consumes: `createPlayerArtRecipe()`、`resolveGeneratedArtLayers()`。
- Produces: `loadAsset(url)`、`useAssetBatchStatus(urls)`、`GeneratedPlayerArt(props)`。

- [ ] **Step 1: キャッシュの失敗テストを書く**

```ts
it("shares one Image request for the same URL", async () => {
  const first = loadAsset("/part.webp");
  const second = loadAsset("/part.webp");

  expect(first).toBe(second);
  succeedImage("/part.webp");
  await expect(first).resolves.toBe("loaded");
});

it("remembers failures without retrying in a loop", async () => {
  const first = loadAsset("/missing.webp");
  failImage("/missing.webp");
  await expect(first).resolves.toBe("failed");
  await expect(loadAsset("/missing.webp")).resolves.toBe("failed");
  expect(createdImageCount("/missing.webp")).toBe(1);
});
```

- [ ] **Step 2: `GeneratedPlayerArt` の失敗テストを書く**

```tsx
render(
  <GeneratedPlayerArt
    player={player}
    school={school}
    testId="generated-art"
    variant="card"
  />,
);

expect(screen.queryByTestId("generated-art")).not.toBeInTheDocument();
succeedAllPendingImages();
expect(await screen.findByTestId("generated-art")).toBeVisible();
expect(screen.getAllByTestId("player-art-layer").length).toBeLessThanOrEqual(10);
```

```tsx
render(
  <GeneratedPlayerArt
    player={player}
    school={school}
    testId="generated-art"
    variant="full"
  />,
);
failOnePendingImage();
await waitFor(() =>
  expect(screen.queryByTestId("generated-art")).not.toBeInTheDocument(),
);
expect(document.querySelector("svg[data-testid='player-character']")).toBeNull();
```

- [ ] **Step 3: テスト失敗を確認する**

Run: `npm run test -- tests/unit/ui/player-art/assetLoadCache.test.ts tests/unit/ui/player-art/GeneratedPlayerArt.test.tsx`

Expected: FAIL because loader and component do not exist.

- [ ] **Step 4: モジュール単位のロードキャッシュを実装する**

```ts
type AssetStatus = "loaded" | "failed";
const cache = new Map<string, Promise<AssetStatus>>();

export function loadAsset(url: string): Promise<AssetStatus> {
  const existing = cache.get(url);
  if (existing) return existing;

  const request = new Promise<AssetStatus>((resolve) => {
    const image = new Image();
    image.onload = () => resolve("loaded");
    image.onerror = () => resolve("failed");
    image.src = url;
  });
  cache.set(url, request);
  return request;
}
```

テスト専用に `resetAssetLoadCacheForTests()` をexportし、本番コードから呼ばない。

- [ ] **Step 5: 全成功後だけ表示するコンポーネントを実装する**

```tsx
export function GeneratedPlayerArt({
  player,
  school,
  variant,
  expressionOverride,
  className,
  testId,
}: GeneratedPlayerArtProps) {
  const recipe = createPlayerArtRecipe(player, school);
  const effectiveRecipe = expressionOverride
    ? { ...recipe, expression: expressionOverride }
    : recipe;
  const layers = resolveGeneratedArtLayers(effectiveRecipe);
  const status = useAssetBatchStatus(layers.map((layer) => layer.url));

  if (!supportsRasterMasks() || status !== "loaded") return null;

  return (
    <span
      aria-hidden="true"
      className={["player-art", `player-art--${variant}`, className]
        .filter(Boolean)
        .join(" ")}
      data-art-signature={playerArtIdentitySignature(effectiveRecipe)}
      data-expression={effectiveRecipe.expression}
      data-testid={testId}
    >
      {layers.map((layer) => (
        <span
          className={`player-art__layer player-art__layer--${layer.slot}`}
          data-testid="player-art-layer"
          key={`${layer.slot}:${layer.url}`}
          style={layerStyle(layer)}
        />
      ))}
      <span className="player-art__number">{effectiveRecipe.jerseyNumber}</span>
    </span>
  );
}
```

`supportsRasterMasks()` は `CSS.supports("mask-image", "url(data:image/webp;base64,UklGRg==)")` または `-webkit-mask-image` を確認する。非対応時は `null` を返す。

- [ ] **Step 6: 表情CSSを実装する**

`data-expression` に応じて目、眉、口レイヤーへ小さな移動、回転、縦縮小を適用する。本人固有レイヤーURLは変えない。

- [ ] **Step 7: テストを実行する**

Run: `npm run test -- tests/unit/ui/player-art/assetLoadCache.test.ts tests/unit/ui/player-art/GeneratedPlayerArt.test.tsx`

Expected: PASS.

- [ ] **Step 8: コミットする**

```bash
git add src/ui/player-art tests/unit/ui/player-art/assetLoadCache.test.ts tests/unit/ui/player-art/GeneratedPlayerArt.test.tsx
git commit -m "feat: render generated players from cached WebP layers"
```

---

### Task 4: 主要4名の専用アート

**Files:**
- Create: `src/assets/characters/featured/kuroba-hayato/*.webp`
- Create: `src/assets/characters/featured/seto-soma/*.webp`
- Create: `src/assets/characters/featured/higami-ren/*.webp`
- Create: `src/assets/characters/featured/shiroma-minato/*.webp`
- Create: `src/ui/player-art/featuredArtManifest.ts`
- Create: `src/ui/player-art/FeaturedPlayerArt.tsx`
- Test: `tests/unit/ui/player-art/featuredArtManifest.test.ts`
- Test: `tests/unit/ui/player-art/FeaturedPlayerArt.test.tsx`

**Interfaces:**
- Consumes: `resolveFeaturedCharacter(player, school)`。
- Produces: `FeaturedArtVariant`、`resolveFeaturedArtUrl()`、`FeaturedPlayerArt(props)`。

- [ ] **Step 1: マニフェストと失敗時非表示のテストを書く**

```ts
const art = resolveFeaturedArtUrl(featuredPlayer, school, "full");
expect(art).toMatch(/\.webp$/);
expect(resolveFeaturedArtUrl(normalPlayer, school, "full")).toBeNull();
```

```tsx
render(
  <FeaturedPlayerArt
    player={featuredPlayer}
    school={school}
    testId="featured-art"
    variant="full"
  />,
);
fireEvent.error(screen.getByTestId("featured-art"));
expect(screen.queryByTestId("featured-art")).not.toBeInTheDocument();
expect(document.querySelector("[data-testid='generated-player-art']")).toBeNull();
```

- [ ] **Step 2: テスト失敗を確認する**

Run: `npm run test -- tests/unit/ui/player-art/featuredArtManifest.test.ts tests/unit/ui/player-art/FeaturedPlayerArt.test.tsx`

- [ ] **Step 3: 4名×7枚の透過WebPを配置する**

```text
bust-neutral.webp
full-neutral.webp
chibi-neutral.webp
expression-neutral.webp
expression-focused.webp
expression-happy.webp
expression-frustrated.webp
```

髪、瞳、ユニフォーム、背番号、学校色は `characterWorld.ts` の定義と一致させる。日本語文字は画像へ焼き込まない。

- [ ] **Step 4: 静的マニフェストを実装する**

`characterId` をキーに全URLを静的importする。実行時パス生成を行わない。

- [ ] **Step 5: `FeaturedPlayerArt` を実装する**

`<img>` の `onError` で失敗URLを記録し、同じURLでは `null` を返す。一般選手パーツへ切り替えない。

- [ ] **Step 6: テストとビルドを実行する**

Run: `npm run test -- tests/unit/ui/player-art/featuredArtManifest.test.ts tests/unit/ui/player-art/FeaturedPlayerArt.test.tsx && npm run build`

- [ ] **Step 7: コミットする**

```bash
git add src/assets/characters/featured src/ui/player-art/featuredArtManifest.ts src/ui/player-art/FeaturedPlayerArt.tsx tests/unit/ui/player-art/featuredArtManifest.test.ts tests/unit/ui/player-art/FeaturedPlayerArt.test.tsx
git commit -m "feat: add dedicated art for four featured players"
```

---

### Task 5: 共通 `PlayerArt` と旧選手SVGの置換

**Files:**
- Create: `src/ui/player-art/PlayerArt.tsx`
- Modify: `src/ui/PlayerTile.tsx`
- Modify: `src/ui/FeaturedPlayerHero.tsx`
- Modify: `src/features/home/EventDialog.tsx`
- Modify: `src/features/training/TrainingScreen.tsx`
- Modify: `src/features/team/TeamScreen.tsx`
- Modify: `src/main.tsx`
- Delete: `src/ui/PlayerCharacter.tsx`
- Delete: `src/ui/character-world.css`
- Delete: `tests/unit/ui/PlayerCharacter.test.tsx`
- Test: `tests/unit/ui/player-art/PlayerArt.test.tsx`
- Test: `tests/unit/ui/PlayerTile.test.tsx`
- Test: `tests/unit/features/home/EventDialog.test.tsx`

**Interfaces:**
- Consumes: `FeaturedPlayerArt`、`GeneratedPlayerArt`。
- Produces: `PlayerArt(props)` as the only player image API used by feature screens.

- [ ] **Step 1: 振り分けテストを書く**

```tsx
render(
  <PlayerArt player={featuredPlayer} school={featuredSchool} variant="card" />,
);
expect(screen.getByTestId("featured-player-art")).toBeVisible();
expect(screen.queryByTestId("generated-player-art")).not.toBeInTheDocument();
```

```tsx
render(<PlayerArt player={normalPlayer} school={school} variant="card" />);
succeedAllPendingImages();
expect(await screen.findByTestId("generated-player-art")).toBeVisible();
expect(screen.queryByTestId("featured-player-art")).not.toBeInTheDocument();
```

- [ ] **Step 2: テスト失敗を確認する**

Run: `npm run test -- tests/unit/ui/player-art/PlayerArt.test.tsx`

- [ ] **Step 3: 共通ファサードを実装する**

```tsx
export function PlayerArt(props: PlayerArtProps) {
  return resolveFeaturedCharacter(props.player, props.school) ? (
    <FeaturedPlayerArt {...props} />
  ) : (
    <GeneratedPlayerArt {...props} />
  );
}
```

`variant="card"` は固定4名の `chibi` へ、`portrait` は `bust` へ、`full` は `full` へ変換する。

- [ ] **Step 4: 既存利用箇所を順番に置き換える**

- `PlayerTile`: `variant="card"`
- `FeaturedPlayerHero`: `variant="portrait"`, `loading="eager"`
- `EventDialog`: `variant="full"`
- `TrainingScreen`: 選手選択と結果へ `variant="card"`
- `TeamScreen`: `PlayerTile` 経由に統一

`PlayerTile` の氏名、学年、ポジション、状態、背番号、既存test idを維持する。

- [ ] **Step 5: 旧SVGを削除する**

`PlayerCharacter.tsx`、`PlayerCharacter.test.tsx`、`character-world.css` を削除し、`main.tsx` のCSS importを除去する。`SchoolEmblem` と `GameIcon` のSVGは削除しない。

- [ ] **Step 6: 参照残りを検査する**

Run: `git grep -n "PlayerCharacter\|player-character" -- src tests`

Expected: 旧SVGの不在を検査する否定テスト以外は0件。

Run: `git grep -n "<svg" -- src/ui src/features`

Expected: 学校章、UIアイコン、装飾用途だけが残る。

- [ ] **Step 7: 関連テストを実行する**

Run: `npm run test -- tests/unit/ui/player-art/PlayerArt.test.tsx tests/unit/ui/PlayerTile.test.tsx tests/unit/features/home/EventDialog.test.tsx`

- [ ] **Step 8: コミットする**

```bash
git add src tests
git commit -m "refactor: replace player SVGs with unified raster art"
```

---

### Task 6: ゲームテーマとアプリシェル

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
- `StatBar({ label, value, valueLabel, tone })` clamps value to 0–100.
- `BottomGameNav({ activeTab, onChange })` uses existing `AppTab` values.

- [ ] **Step 1: `StatBar` とナビの失敗テストを書く**

```tsx
render(<StatBar label="攻撃" value={150} />);
expect(screen.getByTestId("stat-bar-fill")).toHaveStyle({ width: "100%" });

render(<BottomGameNav activeTab="home" onChange={onChange} />);
expect(screen.getByRole("button", { name: "ホーム" })).toHaveAttribute(
  "aria-current",
  "page",
);
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

- [ ] **Step 4: `App.tsx` の表示責務を分離する**

```ts
export const APP_NAVIGATION = [
  { id: "home", label: "ホーム", icon: "home" },
  { id: "team", label: "選手", icon: "team" },
  { id: "training", label: "育成", icon: "training" },
  { id: "match", label: "試合", icon: "match" },
  { id: "school", label: "学校", icon: "school" },
] as const;
```

`GamePageFrame` は最大幅480px、safe-area、下部nav分のpaddingを管理する。`App` の `GameState`、`teamSelection`、イベント、セーブ処理は移動しない。

- [ ] **Step 5: テスト、型検査、既存E2Eを実行する**

Run: `npm run test -- tests/unit/ui/theme/StatBar.test.tsx tests/unit/ui/shell/BottomGameNav.test.tsx && npm run typecheck && npm run test:e2e -- tests/e2e/app-shell.spec.ts`

- [ ] **Step 6: コミットする**

```bash
git add src/ui/theme src/ui/shell src/main.tsx src/App.tsx src/app/app-shell.css src/mobile-layout.css tests/unit/ui/theme tests/unit/ui/shell
git commit -m "refactor: introduce premium game app shell"
```

---

### Task 7: 選手一覧、詳細、編成の再構成

**Files:**
- Create: `src/domain/selectors/playerPresentation.ts`
- Create: `src/features/team/PlayerRosterCard.tsx`
- Create: `src/features/team/PlayerDetailView.tsx`
- Create: `src/features/team/TeamLineupEditor.tsx`
- Create: `src/features/team/team-roster.css`
- Modify: `src/features/team/TeamScreen.tsx`
- Modify: `src/features/team/team.css`
- Modify: `src/features/team/team-direct.css`
- Modify: `src/ui/PlayerTile.tsx`
- Test: `tests/unit/domain/selectors/playerPresentation.test.ts`
- Test: `tests/unit/features/team/PlayerDetailView.test.tsx`
- Test: `tests/unit/features/team/TeamScreen.test.tsx`

**Interfaces:**
- Produces: `calculatePlayerDisplayPower()`、`summarizePlayerAbilities()`。
- `TeamLineupEditor` preserves existing direct replacement, libero, starter lock, automatic selection, and safety policy callbacks.

- [ ] **Step 1: 表示集計と全選手画像の失敗テストを書く**

```ts
expect(calculatePlayerDisplayPower(playerWithAll80)).toBe(8000);
expect(summarizePlayerAbilities(player)).toEqual({
  attack: expect.any(Number),
  defense: expect.any(Number),
  jump: player.abilities.jump,
  stamina: player.abilities.stamina,
  mental: expect.any(Number),
});
```

```tsx
render(<PlayerDetailView onBack={onBack} player={normalPlayer} school={school} />);
succeedAllPendingImages();
expect(await screen.findByTestId("generated-player-art")).toBeVisible();
expect(screen.getByText("総合力")).toBeVisible();
```

- [ ] **Step 2: テスト失敗を確認する**

Run: `npm run test -- tests/unit/domain/selectors/playerPresentation.test.ts tests/unit/features/team/PlayerDetailView.test.tsx tests/unit/features/team/TeamScreen.test.tsx`

- [ ] **Step 3: 集計関数を実装する**

```ts
export function calculatePlayerDisplayPower(player: Player): number {
  const values = ABILITY_KEYS.map((key) => player.abilities[key]);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(average) * 100;
}
```

- [ ] **Step 4: 現行編成ロジックを `TeamLineupEditor` へ移す**

`cloneSelection`、交代、リベロ変更、先発固定、自動編成、安全調整、選手pickerを挙動変更なしで移す。移動前後で既存編成テストを通す。

- [ ] **Step 5: `TeamScreen` を一覧と編成の2モードへ変更する**

```tsx
const [mode, setMode] = useState<"roster" | "lineup">("roster");
const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(null);
```

一覧カードは全選手へ `PlayerArt variant="card"`、詳細は `variant="portrait"` を表示する。

- [ ] **Step 6: 画像失敗時レイアウトをテストする**

必須パーツを1枚失敗させ、詳細画面の `.player-detail__content` が `player-detail__content--without-art` になり、氏名と操作が残ることを検証する。

- [ ] **Step 7: テストとモバイルE2Eを実行する**

Run: `npm run test -- tests/unit/domain/selectors/playerPresentation.test.ts tests/unit/features/team/PlayerDetailView.test.tsx tests/unit/features/team/TeamScreen.test.tsx && npm run test:e2e -- tests/e2e/app-shell.spec.ts`

- [ ] **Step 8: コミットする**

```bash
git add src/domain/selectors/playerPresentation.ts src/features/team src/ui/PlayerTile.tsx tests/unit/domain/selectors/playerPresentation.test.ts tests/unit/features/team
git commit -m "feat: add illustrated roster and player details"
```

---

### Task 8: ホーム画面刷新

**Files:**
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/home.css`
- Modify: `src/ui/FeaturedPlayerHero.tsx`
- Modify: `src/ui/featured-player-hero.css`
- Test: `tests/unit/features/home/HomeScreen.test.tsx`
- Test: `tests/e2e/app-shell.spec.ts`

**Interfaces:**
- Consumes: `PlayerArt`、existing home callbacks and match strength values.

- [ ] **Step 1: 一般選手もチームフェイスになるテストを書く**

```tsx
renderHomeWithNoFeaturedPlayer();
succeedAllPendingImages();
expect(await screen.findByTestId("generated-player-art")).toBeVisible();
expect(screen.getByRole("button", { name: "選手を見る" })).toBeVisible();
```

- [ ] **Step 2: モックアップの主要領域テストを書く**

日付、チームランク、次戦、戦力、育成、選手、試合、週送りが1画面の正しい見出し下へ存在することを確認する。

- [ ] **Step 3: テスト失敗を確認する**

Run: `npm run test -- tests/unit/features/home/HomeScreen.test.tsx`

- [ ] **Step 4: ホームを承認済み構成へ変更する**

- シーズンカード
- チームフェイス
- NEXT MATCH
- 育成 / 選手 / 試合 / カレンダーのクイック操作
- 今週の必須行動
- 次週進行
- 怪我、疲労、直近試合の小型レポート

既存コールバックと週送り条件は変更しない。

- [ ] **Step 5: 画像失敗時の詰め替えを実装する**

`PlayerArt` の表示完了通知を受け、アートがない場合はヒーロー情報を全幅へ切り替える。空の画像枠を残さない。

- [ ] **Step 6: テストとE2Eを実行する**

Run: `npm run test -- tests/unit/features/home/HomeScreen.test.tsx && npm run test:e2e -- tests/e2e/app-shell.spec.ts`

- [ ] **Step 7: コミットする**

```bash
git add src/features/home/HomeScreen.tsx src/features/home/home.css src/ui/FeaturedPlayerHero.tsx src/ui/featured-player-hero.css tests/unit/features/home/HomeScreen.test.tsx tests/e2e/app-shell.spec.ts
git commit -m "feat: redesign the coach home dashboard"
```

---

### Task 9: 全画面イベントと年度更新アート

**Files:**
- Modify: `src/features/home/EventDialog.tsx`
- Modify: `src/features/home/event-dialog.css`
- Modify: `src/features/home/YearTransitionDialog.tsx`
- Modify: `src/features/home/year-transition-dialog.css`
- Test: `tests/unit/features/home/EventDialog.test.tsx`
- Test: `tests/unit/features/home/YearTransitionDialog.test.tsx`
- Test: `tests/e2e/event-flow.spec.ts`

**Interfaces:**
- Consumes: `PlayerArt variant="full"`、existing `resolveEventChoice()` callback and year transition summary.

- [ ] **Step 1: 一般選手がイベントへ登場する失敗テストを書く**

```tsx
renderEventFor(normalPlayer);
succeedAllPendingImages();
expect(await screen.findByTestId("generated-player-art")).toBeVisible();
expect(screen.getByRole("button", { name: event.choices[0]!.label })).toBeVisible();
```

- [ ] **Step 2: 新入生サマリーの失敗テストを書く**

```tsx
render(<YearTransitionDialog state={nextState} summary={summary} onClose={onClose} />);
succeedAllPendingImages();
expect(await screen.findAllByTestId("generated-player-art")).not.toHaveLength(0);
```

- [ ] **Step 3: テスト失敗を確認する**

Run: `npm run test -- tests/unit/features/home/EventDialog.test.tsx tests/unit/features/home/YearTransitionDialog.test.tsx`

- [ ] **Step 4: `EventDialog` を全画面ストーリーへ変更する**

- CSS背景
- 章、カテゴリ、タイトル
- 当事者の全身アート
- 話者名、本文
- 選択肢
- 最近の出来事は折りたたみログへ移動

`dismissible={false}` とイベント解決前に閉じられない仕様を維持する。

- [ ] **Step 5: 状況に応じた表情を渡す**

主要4名にはイベントカテゴリから `focused / happy / frustrated / neutral` を選択する。一般選手は `expressionOverride` を `PlayerArt` へ渡し、既存パーツのCSS表情を変更する。

- [ ] **Step 6: 年度更新へ新入生アートを追加する**

卒業生、新入生、新主将、世代級選手のカードへ `PlayerArt variant="card"` を表示する。世代級選手はeffectレイヤーを表示する。

- [ ] **Step 7: テストとE2Eを実行する**

Run: `npm run test -- tests/unit/features/home/EventDialog.test.tsx tests/unit/features/home/YearTransitionDialog.test.tsx && npm run test:e2e -- tests/e2e/event-flow.spec.ts`

- [ ] **Step 8: コミットする**

```bash
git add src/features/home/EventDialog.tsx src/features/home/event-dialog.css src/features/home/YearTransitionDialog.tsx src/features/home/year-transition-dialog.css tests/unit/features/home/EventDialog.test.tsx tests/unit/features/home/YearTransitionDialog.test.tsx tests/e2e/event-flow.spec.ts
git commit -m "feat: add full-screen illustrated story events"
```

---

### Task 10: 育成、試合、学校画面の統一

**Files:**
- Modify: `src/features/training/TrainingScreen.tsx`
- Modify: `src/features/training/training.css`
- Modify: `src/features/match/MatchScreen.tsx`
- Modify: `src/features/match/match.css`
- Modify: `src/features/school/SchoolScreen.tsx`
- Modify: `src/features/school/school.css`
- Modify: `src/ui/BottomSheet.tsx`
- Modify: `src/ui/ui.css`
- Test: `tests/unit/features/training/TrainingScreen.test.tsx`
- Test: `tests/unit/features/match/MatchScreen.test.tsx`
- Test: `tests/unit/features/school/AppSchoolCalendarFlow.test.tsx`

**Interfaces:**
- Consumes: `GamePanel`、`StatBar`、`PlayerArt`。
- Existing domain callbacks remain unchanged.

- [ ] **Step 1: 各画面の失敗テストを書く**

- 育成選手選択に一般選手の生成画像が表示される
- 試合の注目選手または活躍選手に生成画像が表示される
- 学校画面の設備、記録、OBセグメントが維持される
- 画像失敗時も実行ボタンが操作可能

- [ ] **Step 2: テスト失敗を確認する**

Run: `npm run test -- tests/unit/features/training/TrainingScreen.test.tsx tests/unit/features/match/MatchScreen.test.tsx tests/unit/features/school/AppSchoolCalendarFlow.test.tsx`

- [ ] **Step 3: 育成画面を戦術ボード風UIへ変更する**

練習選択、重点選手、個人指示、確認、結果を新テーマへ統一する。週1回制限と `resolveWeeklyTraining()` を変更しない。

- [ ] **Step 4: 試合画面をスコアボードUIへ変更する**

対戦校、戦力、セットスコア、再生操作、勝因、改善提案を再配置する。勝敗計算は `simulateMatch()` だけを使用する。

- [ ] **Step 5: 学校画面と共通シートを変更する**

学校章、評判、資金、監督、宿命校を上部へ集約し、設備、記録、OBを新テーマへ統一する。`BottomSheet` は新しいパネル色、safe-area、フォーカストラップを維持する。

- [ ] **Step 6: テストを実行する**

Run: `npm run test -- tests/unit/features/training/TrainingScreen.test.tsx tests/unit/features/match/MatchScreen.test.tsx tests/unit/features/school/AppSchoolCalendarFlow.test.tsx`

- [ ] **Step 7: コミットする**

```bash
git add src/features/training src/features/match src/features/school src/ui/BottomSheet.tsx src/ui/ui.css tests/unit/features/training tests/unit/features/match tests/unit/features/school
git commit -m "feat: unify training match and school game UI"
```

---

### Task 11: 新入生の外見重複抑制と長期進行テスト

**Files:**
- Modify: `src/domain/generation/generatePlayer.ts`
- Modify: `src/domain/appearance/playerAppearance.ts`
- Test: `tests/unit/domain/generation/generatePlayer.test.ts`
- Test: `tests/unit/domain/calendar/academicYearProgression.test.ts`
- Test: `tests/unit/domain/appearance/playerAppearance.test.ts`

**Interfaces:**
- Consumes: `seedAppearanceSignature(seed)`。
- Produces: same `generatePlayer()`、`generateInitialSquad()`、`generateIntake()` signatures as before.

- [ ] **Step 1: 同一学校の完全一致を拒否する失敗テストを書く**

乱数スタブへ同じ外見シグネチャになる2つのseedを順に返させ、2人目が次のseedを使用することを検証する。

```ts
expect(seedAppearanceSignature(first.appearanceSeed)).not.toBe(
  seedAppearanceSignature(second.appearanceSeed),
);
```

- [ ] **Step 2: 年度更新後の全新入生レシピテストを書く**

```ts
const transition = advanceAcademicYear(state, gameData, random);
for (const playerId of transition.summary.intakePlayerIds) {
  const player = transition.state.players[playerId]!;
  const school = transition.state.schools[player.career.schoolId]!;
  expect(createPlayerArtRecipe(player, school)).toMatchObject({
    catalogVersion: 1,
    appearanceSeed: player.appearanceSeed,
  });
}
```

- [ ] **Step 3: テスト失敗を確認する**

Run: `npm run test -- tests/unit/domain/generation/generatePlayer.test.ts tests/unit/domain/calendar/academicYearProgression.test.ts`

- [ ] **Step 4: シグネチャ集合を生成処理へ追加する**

`generateAppearanceSeed()` に `excludedAppearanceSignatures` を渡し、seedが一意でもシグネチャが完全一致する場合は再抽選する。

```ts
function generateAppearanceSeed(
  random: RandomSource,
  excludedSeeds: Set<number>,
  excludedSignatures: Set<string>,
): number {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const seed = random.int(1, 2_147_483_647);
    const signature = seedAppearanceSignature(seed);
    if (!excludedSeeds.has(seed) && !excludedSignatures.has(signature)) {
      excludedSeeds.add(seed);
      excludedSignatures.add(signature);
      return seed;
    }
  }
  throw new Error("could not generate a unique player appearance");
}
```

`generateIntake()` は在校生のseedシグネチャを初期集合へ入れる。関数の公開シグネチャは変更しない。

- [ ] **Step 5: 10年進行の外見安定テストを追加する**

- 10年分年度更新する
- 各年の新入生にレシピが存在する
- 同じplayer IDのシグネチャは再計算しても同一
- 全学校の現役人数が既存12〜16名制約内
- 既存の世代級選手周期が維持される

- [ ] **Step 6: テストを実行する**

Run: `npm run test -- tests/unit/domain/generation/generatePlayer.test.ts tests/unit/domain/calendar/academicYearProgression.test.ts tests/unit/domain/appearance/playerAppearance.test.ts`

- [ ] **Step 7: コミットする**

```bash
git add src/domain/generation/generatePlayer.ts src/domain/appearance/playerAppearance.ts tests/unit/domain/generation/generatePlayer.test.ts tests/unit/domain/calendar/academicYearProgression.test.ts tests/unit/domain/appearance/playerAppearance.test.ts
git commit -m "feat: keep generated player appearances distinct across intakes"
```

---

### Task 12: モバイルE2E、失敗検証、性能、文書整理

**Files:**
- Create: `tests/e2e/player-art.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`
- Modify: `tests/e2e/app-shell.spec.ts`
- Modify: `docs/character-assembly.md`
- Modify: `docs/character-world.md`
- Modify: `README.md`
- Modify: `scripts/verify.mjs`

**Interfaces:**
- Verifies all prior tasks; produces no runtime API.

- [ ] **Step 1: 主要4名と一般選手のE2Eを書く**

```ts
test("featured and generated players use raster art", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("featured-player-art").first()).toBeVisible();
  await page.getByRole("button", { name: "選手" }).click();
  await expect(page.getByTestId("generated-player-art").first()).toBeVisible();
  await expect(page.locator("svg[data-testid='player-character']")).toHaveCount(0);
});
```

- [ ] **Step 2: 年度更新とセーブ再読込のE2Eを書く**

テスト用JSONをインポートして年度境界直前から進行し、新入生の `data-art-signature` を取得する。保存、再読込後に同じplayer IDのシグネチャが一致することを確認する。

- [ ] **Step 3: パーツ失敗のE2Eを書く**

`page.route("**/player-parts/v1/**", route => route.abort())` で一般選手素材を失敗させる。

確認項目:

- 壊れた画像アイコンなし
- `generated-player-art` なし
- `player-character` SVGなし
- 選手名と操作ボタンあり
- コンソールエラーの無限発生なし

- [ ] **Step 4: 全幅監査へ480pxとアート要素を追加する**

320、360、390、430、480pxで次を巡回する。

- ホーム
- 選手一覧
- 選手詳細
- 編成
- 育成
- 試合準備
- 試合中
- 試合結果
- 学校
- イベント
- 年度更新

body/document幅、画面外DOM、内部クリップ、アートのコンテナ超過を検査する。

- [ ] **Step 5: 性能上限を検査する**

選手一覧で次を確認する。

```ts
const maxLayers = await page
  .locator("[data-testid='generated-player-art']")
  .evaluateAll((arts) =>
    Math.max(...arts.map((art) => art.querySelectorAll("[data-testid='player-art-layer']").length)),
  );
expect(maxLayers).toBeLessThanOrEqual(10);
```

同一URLへのリクエスト回数が画面内選手数と比例して増えず、共有パーツがブラウザキャッシュされることをネットワークログで確認する。

- [ ] **Step 6: 文書を更新する**

`docs/character-assembly.md` のSVG説明を削除し、次を記載する。

- `appearanceSeed` とWebPレイヤー
- パーツカタログv1の不変性
- 主要4名の専用アート
- 新入生の自動生成
- 読込失敗時の非表示

`docs/character-world.md` とREADMEへ同じ方針を反映する。

- [ ] **Step 7: `verify` にアート禁止検査を追加する**

`scripts/verify.mjs` から次のコマンド相当を実行し、選手SVG参照が復活した場合に失敗させる。

```js
const forbidden = ["PlayerCharacter", "data-testid=\"player-character\""];
```

テスト内の否定検証は除外し、`src` 配下だけを検査する。

- [ ] **Step 8: 全品質ゲートを実行する**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run verify
```

Expected: all commands exit 0.

- [ ] **Step 9: 差分レビューを実行する**

```bash
git status --short
git diff --check
git grep -n "PlayerCharacter\|player-character" -- src || true
git grep -n "TODO\|TBD" -- docs/superpowers src tests || true
```

Expected:

- 一時生成物なし
- whitespace errorなし
- `src` に旧選手SVG参照なし
- 未解決TODO/TBDなし

- [ ] **Step 10: コミットする**

```bash
git add tests/e2e docs README.md scripts/verify.mjs
git commit -m "test: verify long-term generated player art integration"
```

---

## Plan Self-Review

### Spec coverage

- 一般選手のパーツ合成: Tasks 1–3
- 主要4名の専用アート: Task 4
- 固定・一般の共通表示API: Task 5
- 旧選手SVGの完全除去: Tasks 5 and 12
- 濃紺・白・橙のアプリシェル: Task 6
- 選手一覧・詳細・編成: Task 7
- ホーム: Task 8
- イベント・年度更新: Task 9
- 育成・試合・学校: Task 10
- 新入生と長期世代交代: Task 11
- モバイル、失敗時非表示、性能、保存再現: Task 12

### Type consistency

- 全画面は `PlayerArtProps` を利用する
- `PlayerArtVariant` は `card | portrait | full`
- 一般選手は `GeneratedPlayerArt`
- 主要4名は `FeaturedPlayerArt`
- 外見決定は `createPlayerArtRecipe()`
- アセット解決は `resolveGeneratedArtLayers()`
- 読込状態は `useAssetBatchStatus()`

### No placeholders

- 実装対象、型、関数名、テストコマンド、失敗条件、コミット単位を確定済み
- ガチャ、課金、外部AI生成、PC専用UIは計画へ含めない
