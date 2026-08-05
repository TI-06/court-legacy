# General Player Modular Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining general-player portrait derivation with deterministic independent raster parts for face, hair, eyes, brows, mouth, skin, body, pose, uniform, expression, and accessories while preserving save compatibility and the existing featured-player assets.

**Architecture:** Keep `Player.appearanceSeed` and the persisted game schema unchanged. `playerAppearance.ts` continues deriving stable semantic traits, `playerArtRecipe.ts` converts them into a versioned render recipe, and `generatedArtManifest.ts` maps each trait to independent transparent WebP atlas tiles. Rendering remains CSS background/mask based, but every visual category gets its own layer and source rectangle instead of collapsing face and posture traits into one derived base portrait.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, Testing Library, Playwright, Python 3 with Pillow for asset generation, GitHub Actions CI.

## Global Constraints

- Preserve `Player`, `School`, and `GameState` persistence schemas.
- Preserve existing `appearanceSeed` values and deterministic reload behavior.
- Featured players continue using dedicated WebP assets.
- Generated player rendering must not use SVG or silhouette fallbacks.
- Required asset failure hides the entire generated image.
- No runtime network image dependency.
- Mobile layouts must remain valid from 320px through 480px.
- `npm run verify` and `npm run test:e2e` must pass before completion.

---

## File Structure

- `src/domain/appearance/playerAppearance.ts`: semantic appearance traits derived from the existing seed and player attributes.
- `src/domain/appearance/playerArtRecipe.ts`: versioned render recipe and deterministic diversity salt.
- `src/domain/appearance/playerArtDiversity.ts`: roster-level near-duplicate detection and stable recipe adjustment.
- `src/ui/player-art/generatedArtManifest.ts`: independent atlas metadata and render-layer resolver.
- `src/ui/player-art/GeneratedPlayerArt.tsx`: asset loading and ordered layer rendering.
- `src/ui/player-art/player-art.css`: layer positioning and expression-safe visual adjustments.
- `scripts/generate_general_player_modular_atlases.py`: reproducible transparent WebP atlas generator.
- `scripts/verify_general_player_modular_atlases.py`: atlas dimensions, alpha, tile occupancy, and manifest contract verification.
- `tests/unit/domain/appearance/playerAppearance.test.ts`: trait catalog and determinism tests.
- `tests/unit/domain/appearance/playerArtRecipe.test.ts`: recipe version and identity tests.
- `tests/unit/domain/appearance/playerArtDiversity.test.ts`: same-team collision suppression tests.
- `tests/unit/ui/player-art/generatedArtManifest.test.ts`: independent-layer and source-rect tests.
- `tests/unit/ui/player-art/GeneratedPlayerArt.test.tsx`: load/failure/render tests.
- `tests/e2e/general-player-art.spec.ts`: game-screen WebP and visual diversity assertions.
- `tests/e2e/mobile-layout-audit.spec.ts`: 320/360/390/480px regression coverage.

---

### Task 1: Version the recipe and add stable diversity adjustment

**Files:**
- Modify: `src/domain/appearance/playerArtRecipe.ts`
- Create: `src/domain/appearance/playerArtDiversity.ts`
- Modify: `tests/unit/domain/appearance/playerArtRecipe.test.ts`
- Create: `tests/unit/domain/appearance/playerArtDiversity.test.ts`

**Interfaces:**
- Consumes: `createPlayerArtRecipe(player, school)` and existing `PlayerArtRecipe` traits.
- Produces: `resolveDistinctPlayerArtRecipes(players, school): Map<string, PlayerArtRecipe>` and `visualPartSignature(recipe): string`.

- [ ] **Step 1: Write failing recipe-version and diversity tests**

```ts
expect(createPlayerArtRecipe(player, school).catalogVersion).toBe(2);

const recipes = resolveDistinctPlayerArtRecipes(players, school);
const signatures = players.map((player) =>
  visualPartSignature(recipes.get(player.id)!),
);
expect(new Set(signatures).size).toBeGreaterThanOrEqual(
  Math.ceil(players.length * 0.85),
);
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npx vitest run tests/unit/domain/appearance/playerArtRecipe.test.ts tests/unit/domain/appearance/playerArtDiversity.test.ts`

Expected: FAIL because catalog version 2 and diversity APIs do not exist.

- [ ] **Step 3: Add a non-persisted deterministic `variationSalt`**

```ts
export interface PlayerArtRecipe {
  catalogVersion: 2;
  variationSalt: number;
  // existing fields remain unchanged
}
```

`variationSalt` starts from a stable hash of `player.id`, `appearanceSeed`, and school ID/name. It is render-only and is never written to persistence.

- [ ] **Step 4: Implement roster collision resolution**

Sort players by ID, build each base recipe, and retry salts `0..15` until the part signature does not collide with an already-used signature. Preserve height band, body type, school colors, jersey number, tier, and injury/fatigue expression.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/unit/domain/appearance/playerArtRecipe.test.ts tests/unit/domain/appearance/playerArtDiversity.test.ts`

Expected: PASS.

Commit: `feat: add deterministic player art diversity resolver`

---

### Task 2: Expand semantic catalogs to Issue #29 minimums

**Files:**
- Modify: `src/domain/appearance/playerAppearance.ts`
- Modify: `tests/unit/domain/appearance/playerAppearance.test.ts`

**Interfaces:**
- Consumes: existing `appearanceSeed`, position, height, body type, fatigue, morale, condition, and injury.
- Produces: at least 4 face shapes, 8 front-hair styles, 6 back-hair styles, 6 eye styles, 5 brow styles, 5 mouth styles, 5 skin tones, 4 poses, and 4 expression families.

- [ ] **Step 1: Write failing catalog-cardinality tests**

```ts
const appearances = Array.from({ length: 2048 }, (_, seed) =>
  assemblePlayerAppearance({ ...player, appearanceSeed: seed }),
);
expect(new Set(appearances.map((item) => item.frontHairStyle)).size).toBeGreaterThanOrEqual(8);
expect(new Set(appearances.map((item) => item.backHairStyle)).size).toBeGreaterThanOrEqual(6);
expect(new Set(appearances.map((item) => item.eyeStyle)).size).toBeGreaterThanOrEqual(6);
expect(new Set(appearances.map((item) => item.browStyle)).size).toBeGreaterThanOrEqual(5);
expect(new Set(appearances.map((item) => item.mouthStyle)).size).toBeGreaterThanOrEqual(5);
```

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run tests/unit/domain/appearance/playerAppearance.test.ts`

Expected: FAIL because the expanded fields/catalog sizes do not exist.

- [ ] **Step 3: Split hair into front/back traits and extend facial catalogs**

Add `frontHairStyle`, `backHairStyle`, six eye styles, five brow styles, five mouth styles, and four expression render families (`neutral`, `focused`, `joy`, `frustrated`) while keeping the existing gameplay expression values available for state semantics.

- [ ] **Step 4: Add position/body weighted selection without changing seeds**

Use deterministic weighted indexes: setters/liberos favor ready/upright poses, middle blockers favor tall/towering body anchors, and all selections remain reproducible from `appearanceSeed`.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/unit/domain/appearance/playerAppearance.test.ts`

Expected: PASS.

Commit: `feat: expand generated player appearance catalog`

---

### Task 3: Generate independent transparent WebP atlases

**Files:**
- Create: `scripts/generate_general_player_modular_atlases.py`
- Create: `scripts/verify_general_player_modular_atlases.py`
- Create/Replace binary assets under: `src/assets/player-parts/v2/`
- Modify: `package.json`
- Test: `tests/unit/ui/player-art/atlasData.test.ts`

**Interfaces:**
- Produces these bundled assets with 256×384 tiles and fixed metadata:
  - `body-atlas.webp`
  - `skin-atlas.webp`
  - `face-shadow-atlas.webp`
  - `back-hair-atlas.webp`
  - `front-hair-atlas.webp`
  - `eyes-atlas.webp`
  - `brows-atlas.webp`
  - `mouths-atlas.webp`
  - `uniform-atlas.webp`
  - `accessory-atlas.webp`
  - `effect-atlas.webp`

- [ ] **Step 1: Write failing atlas contract tests**

```ts
expect(GENERATED_ART_CATALOG_VERSION).toBe(2);
expect(ATLAS_TILE.width).toBe(256);
expect(ATLAS_TILE.height).toBe(384);
expect(REQUIRED_GENERATED_ART_ATLASES).toHaveLength(11);
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/unit/ui/player-art/atlasData.test.ts`

Expected: FAIL because the v2 atlas contract is absent.

- [ ] **Step 3: Implement supersampled raster generation**

Draw every part at 4× resolution with anti-aliased outlines, cel-shaded highlights/shadows, aligned anchors, transparent backgrounds, and no embedded text or jersey numbers. Downsample with Lanczos and save lossless WebP.

- [ ] **Step 4: Implement asset verification**

The verifier must reject wrong dimensions, missing alpha, empty required tiles, edge-clipped occupied pixels, and tiles containing opaque pixels outside the safe 8px margin.

- [ ] **Step 5: Add scripts**

```json
"art:generate": "python scripts/generate_general_player_modular_atlases.py",
"art:verify": "python scripts/verify_general_player_modular_atlases.py"
```

- [ ] **Step 6: Generate, verify, test, and commit**

Run:

```bash
npm run art:generate
npm run art:verify
npx vitest run tests/unit/ui/player-art/atlasData.test.ts
```

Expected: all commands PASS.

Commit: `feat: add modular generated player art atlases`

---

### Task 4: Resolve and render independent layers

**Files:**
- Modify: `src/ui/player-art/generatedArtManifest.ts`
- Modify: `src/ui/player-art/GeneratedPlayerArt.tsx`
- Modify: `src/ui/player-art/player-art.css`
- Modify: `tests/unit/ui/player-art/generatedArtManifest.test.ts`
- Modify: `tests/unit/ui/player-art/GeneratedPlayerArt.test.tsx`

**Interfaces:**
- `resolveGeneratedArtLayers(recipe)` returns ordered slots:
  `body`, `skin`, `face-shadow`, `back-hair`, `uniform-primary`, `uniform-accent`, `front-hair`, `eyes`, `brows`, `mouth`, optional `accessory`, optional `effect`.

- [ ] **Step 1: Write failing independent-layer tests**

```ts
expect(resolveGeneratedArtLayers(recipe).map((layer) => layer.slot)).toEqual([
  "body",
  "skin",
  "face-shadow",
  "back-hair",
  "uniform-primary",
  "uniform-accent",
  "front-hair",
  "eyes",
  "brows",
  "mouth",
]);
```

Change one trait at a time and assert only the corresponding source rectangle changes.

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/unit/ui/player-art/generatedArtManifest.test.ts tests/unit/ui/player-art/GeneratedPlayerArt.test.tsx`

Expected: FAIL because the current resolver emits combined base portrait layers.

- [ ] **Step 3: Implement v2 atlas imports and tile mapping**

Map each semantic trait directly to its atlas tile. Skin and uniform layers use masks with deterministic colors; eyes/brows/mouth and face shadows are image layers; hair masks use the recipe hair color.

- [ ] **Step 4: Preserve all-or-nothing loading**

Deduplicate atlas URLs before loading. Render no DOM until every required v2 asset is loaded; render no fallback on failure or missing CSS mask support.

- [ ] **Step 5: Add expression layer selection**

Map gameplay expressions to one of four visual expression rows without changing player state: neutral, focused, joy, frustrated.

- [ ] **Step 6: Run tests and commit**

Run: `npx vitest run tests/unit/ui/player-art/generatedArtManifest.test.ts tests/unit/ui/player-art/GeneratedPlayerArt.test.tsx`

Expected: PASS.

Commit: `feat: render generated players from independent raster parts`

---

### Task 5: Apply roster diversity and complete regression coverage

**Files:**
- Modify player-list/team components that render roster cards to pass a resolved recipe override.
- Modify: `src/ui/player-art/PlayerArt.tsx`
- Modify: `src/ui/player-art/GeneratedPlayerArt.tsx`
- Modify: `tests/e2e/general-player-art.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`
- Modify: `docs/character-art-quality-review.md`
- Modify: `docs/superpowers/implementation-progress/2026-07-31-full-game-ui-refresh.md`

**Interfaces:**
- `PlayerArt` accepts optional `recipeOverride?: PlayerArtRecipe`.
- Roster screens compute one `Map<playerId, PlayerArtRecipe>` per school and reuse it across card/detail/lineup views.

- [ ] **Step 1: Write failing UI/E2E assertions**

Assert generated roster cards expose at least ten independent layer elements, no SVG, valid loaded backgrounds/masks, and at least 85% distinct `data-art-signature` values among generated players.

- [ ] **Step 2: Verify focused tests fail**

Run:

```bash
npx vitest run tests/unit/ui/player-art
npx playwright test tests/e2e/general-player-art.spec.ts
```

Expected: FAIL until recipe overrides and v2 layers are connected.

- [ ] **Step 3: Integrate roster-level recipes**

Compute stable distinct recipes at the player hub boundary and pass them to all generated-player art instances. Featured-player routing remains unchanged.

- [ ] **Step 4: Add ten-season determinism coverage**

Advance or generate ten seasons using existing deterministic generation helpers and assert every generated player produces a valid catalog-v2 recipe and a non-empty independent layer set.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm run art:verify
npm run verify
npm run test:e2e
```

Expected: PASS with zero failures.

- [ ] **Step 6: Review actual 390px roster/detail screenshots**

Confirm face readability, hair separation, body/pose differences, expression consistency, no clipping, and acceptable quality beside featured players. Fix any visual defects and rerun full verification.

- [ ] **Step 7: Update Issue #29 and PR #28**

Mark implemented checkboxes, attach the final verification evidence, update PR scope, and leave Issue #29 open only if an acceptance criterion still fails.

Commit: `test: complete modular player art regression coverage`

---

## Self-Review

- Spec coverage: recipe expansion, independent parts, atlas generation/verification, rendering, mobile UI, duplicate suppression, ten-season stability, failure behavior, and full CI are covered.
- Placeholder scan: no TBD/TODO/“similar to” implementation placeholders remain.
- Type consistency: `PlayerArtRecipe.catalogVersion = 2`, `variationSalt`, `resolveDistinctPlayerArtRecipes`, `visualPartSignature`, and `recipeOverride` are used consistently across tasks.

## Execution Mode

The user requested continuous execution, so this plan will be executed inline with `superpowers:executing-plans`, using TDD checkpoints and GitHub Actions as the authoritative verification environment.
