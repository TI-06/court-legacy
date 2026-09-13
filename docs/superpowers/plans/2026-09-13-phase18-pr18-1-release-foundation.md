# Phase18 PR18-1 Release Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Court Legacy installable as a PWA and update-safe without caching or replaying authoritative game/PvP API traffic, while preserving compatible saves and existing mobile behavior.

**Architecture:** Keep PWA concerns in a small `src/pwa` boundary. `public/sw.js` owns runtime caching behavior and only caches same-origin static GET assets; all `/api/**`, auth/session, and non-GET requests remain network-authoritative. A registration controller exposes a tiny update-ready contract to React, and the app shell shows a controlled refresh action instead of silently activating a waiting worker during gameplay.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4/jsdom, Playwright mobile Chromium, plain Web App Manifest + Service Worker APIs. No PWA dependency is added.

**Spec:** `docs/superpowers/specs/2026-09-13-phase18-release-readiness-design.md`

## Global Constraints

- Preserve existing `viewport-fit=cover` and current mobile layout behavior.
- Do not cache `/api/**`, authentication/session responses, mutations, PvP match status, or PvP command responses.
- Service-worker failure must never be converted into a fake successful game/PvP mutation.
- Preserve Phase16 same-`commandId` retry/idempotency behavior; PR18-1 does not change the PvP command contract.
- Do not change the persisted game-state schema or package version in PR18-1.
- Compatible save data must remain readable after reload and after a simulated client update.
- Keep the existing Pixel 7 Playwright project as the blocking mobile baseline.
- Use TDD for production behavior: RED -> verify intended failure -> minimum GREEN -> refactor -> focused/full verification.

---

### Task 1: Installable manifest and app icons

**Files:**
- Create: `tests/unit/pwa/releaseManifest.test.ts`
- Create: `public/manifest.webmanifest`
- Create: `public/icons/court-legacy-192.svg`
- Create: `public/icons/court-legacy-512.svg`
- Create: `public/icons/court-legacy-maskable-512.svg`
- Modify: `index.html`

**Interfaces:**
- Consumes: Vite `public/` static-file behavior and existing `index.html` theme metadata.
- Produces: `/manifest.webmanifest` plus 192/512/maskable icon references and an HTML manifest link.

- [ ] **Step 1: Write the failing manifest contract test**

Create `tests/unit/pwa/releaseManifest.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

describe("Phase18 release manifest", () => {
  it("links an installable manifest from index.html", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf8");
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('href="/manifest.webmanifest"');
    expect(existsSync(resolve(root, "public/manifest.webmanifest"))).toBe(true);
  });

  it("declares standalone launch metadata and 192/512 icons", () => {
    const path = resolve(root, "public/manifest.webmanifest");
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;

    const manifest = JSON.parse(readFileSync(path, "utf8")) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      scope?: string;
      display?: string;
      theme_color?: string;
      background_color?: string;
      icons?: Array<{ src?: string; sizes?: string; purpose?: string }>;
    };

    expect(manifest.name).toBe("継承のコート");
    expect(manifest.short_name).toBe("継承のコート");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#132536");
    expect(manifest.background_color).toBe("#132536");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192" }),
        expect.objectContaining({ sizes: "512x512" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run the test and prove RED**

Run:

```bash
npm run test -- tests/unit/pwa/releaseManifest.test.ts
```

Expected: assertions fail because `index.html` has no manifest link and `public/manifest.webmanifest` does not exist.

- [ ] **Step 3: Add the minimal install metadata**

Create `public/manifest.webmanifest` with exactly this contract:

```json
{
  "name": "継承のコート",
  "short_name": "継承のコート",
  "description": "男子高校バレー部を何世代にもわたり育てる監督シミュレーションゲーム",
  "lang": "ja",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#132536",
  "background_color": "#132536",
  "icons": [
    {
      "src": "/icons/court-legacy-192.svg",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/icons/court-legacy-512.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/icons/court-legacy-maskable-512.svg",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "maskable"
    }
  ]
}
```

Add three square SVG files with `viewBox="0 0 512 512"`, the existing navy background `#132536`, and a simple volleyball/court mark. The 192 and 512 normal icons may share the same vector artwork. Keep all artwork inside the maskable icon safe zone.

Add this to the existing `<head>` in `index.html` without changing the existing viewport/theme/description tags:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run test -- tests/unit/pwa/releaseManifest.test.ts
npm run typecheck
npm run build
```

Expected: all three exit 0 and the production `dist/` contains `manifest.webmanifest` and referenced icons.

- [ ] **Step 5: Commit Task 1**

```bash
git add index.html public/manifest.webmanifest public/icons tests/unit/pwa/releaseManifest.test.ts
git commit -m "feat: add phase18 PWA manifest"
```

---

### Task 2: Service-worker cache policy with API/PvP network authority

**Files:**
- Create: `src/pwa/cachePolicy.ts`
- Create: `tests/unit/pwa/cachePolicy.test.ts`
- Create: `public/sw.js`

**Interfaces:**
- Produces: `classifyRequestForCache(request: Pick<Request, "method" | "url">): "network-only" | "static-cache"` for unit-level policy verification.
- `public/sw.js` mirrors the same policy: only same-origin GET static assets may enter Cache Storage.

- [ ] **Step 1: Write the failing cache-policy test**

Create `tests/unit/pwa/cachePolicy.test.ts`:

```ts
import { classifyRequestForCache } from "../../../src/pwa/cachePolicy";

function request(path: string, method = "GET") {
  return { method, url: `https://court-legacy.test${path}` };
}

describe("PWA cache policy", () => {
  it.each([
    ["/api/bootstrap", "GET"],
    ["/api/game/action", "POST"],
    ["/api/pvp/challenges", "POST"],
    ["/api/pvp/challenges/op-1", "GET"],
    ["/api/pvp/challenges/op-1/commands", "POST"],
    ["/api/shop/purchase", "POST"],
  ])("keeps %s %s network-authoritative", (path, method) => {
    expect(classifyRequestForCache(request(path, method))).toBe("network-only");
  });

  it.each([
    "/assets/index-ABC123.js",
    "/assets/index-ABC123.css",
    "/icons/court-legacy-192.svg",
  ])("allows static GET asset %s to use the static cache", (path) => {
    expect(classifyRequestForCache(request(path))).toBe("static-cache");
  });
});
```

- [ ] **Step 2: Run and prove RED**

```bash
npm run test -- tests/unit/pwa/cachePolicy.test.ts
```

Expected: module import fails because `src/pwa/cachePolicy.ts` does not exist. This RED is accepted for this first behavior because the production API itself is the missing unit under test; immediately proceed to the minimum implementation.

- [ ] **Step 3: Implement the minimum policy module**

Create `src/pwa/cachePolicy.ts`:

```ts
export type PwaCacheMode = "network-only" | "static-cache";

export function classifyRequestForCache(
  request: Pick<Request, "method" | "url">,
): PwaCacheMode {
  if (request.method !== "GET") return "network-only";

  const url = new URL(request.url, globalThis.location?.origin ?? "https://local.invalid");
  if (url.pathname.startsWith("/api/")) return "network-only";

  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/")
  ) {
    return "static-cache";
  }

  return "network-only";
}
```

- [ ] **Step 4: Implement `public/sw.js` with the same boundary**

The worker must:

```js
const STATIC_CACHE = "court-legacy-static-v1";

function isCacheableStaticRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  if (!isCacheableStaticRequest(event.request)) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    }),
  );
});
```

Do not register a fetch handler for `/api/**` or non-GET requests. Do not use an offline-success fallback for mutations.

- [ ] **Step 5: Verify GREEN and existing PvP client contract**

```bash
npm run test -- tests/unit/pwa/cachePolicy.test.ts tests/unit/services/Phase16PvpGameApiClient.test.ts tests/unit/app/GameApp.pvp.test.tsx
npm run typecheck
```

Expected: all exit 0.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/pwa/cachePolicy.ts public/sw.js tests/unit/pwa/cachePolicy.test.ts
git commit -m "feat: keep authoritative APIs outside PWA cache"
```

---

### Task 3: Controlled service-worker registration and update-ready UI

**Files:**
- Create: `src/pwa/registerServiceWorker.ts`
- Create: `src/pwa/useAppUpdate.ts`
- Create: `src/pwa/AppUpdateBanner.tsx`
- Create: `src/pwa/app-update-banner.css`
- Create: `tests/unit/pwa/registerServiceWorker.test.ts`
- Create: `tests/unit/pwa/AppUpdateBanner.test.tsx`
- Modify: `src/main.tsx`
- Modify: `src/app/ApplicationRoot.tsx`

**Interfaces:**
- Produces: `registerServiceWorker(onUpdateReady: () => void): Promise<ServiceWorkerRegistration | null>`.
- Produces: `requestWaitingWorkerActivation(registration: ServiceWorkerRegistration): void` which posts `{ type: "SKIP_WAITING" }` only when the user explicitly accepts refresh.
- `public/sw.js` must handle `SKIP_WAITING` and call `self.skipWaiting()`.
- `AppUpdateBanner` receives `updateReady`, `onRefresh`, and renders a non-modal status/action outside the game command pipeline.

- [ ] **Step 1: Write failing registration tests**

Cover these behaviors in `tests/unit/pwa/registerServiceWorker.test.ts`:

```ts
it("does nothing when service workers are unavailable", async () => {
  expect(await registerServiceWorker(() => undefined, {} as Navigator)).toBeNull();
});

it("registers /sw.js and reports a waiting worker as update-ready", async () => {
  const onUpdateReady = vi.fn();
  // navigator.serviceWorker.register resolves a registration whose waiting member exists
  await registerServiceWorker(onUpdateReady, fakeNavigator);
  expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  expect(onUpdateReady).toHaveBeenCalledTimes(1);
});
```

Use dependency injection in the exported function signature so tests do not mutate the real `navigator` object:

```ts
registerServiceWorker(onUpdateReady, navigatorLike = globalThis.navigator)
```

- [ ] **Step 2: Run and prove RED**

```bash
npm run test -- tests/unit/pwa/registerServiceWorker.test.ts
```

Expected: missing module/API under test.

- [ ] **Step 3: Implement registration/update detection**

The implementation must register `/sw.js`, report an already-waiting worker immediately, and listen for `updatefound` -> installing worker `statechange` -> `installed` while an existing controller is present. It must not call `skipWaiting()` automatically.

- [ ] **Step 4: Write failing update-banner test**

Create `tests/unit/pwa/AppUpdateBanner.test.tsx` asserting:

```ts
render(<AppUpdateBanner updateReady onRefresh={onRefresh} />);
expect(screen.getByRole("status")).toHaveTextContent("新しいバージョンを利用できます");
await user.click(screen.getByRole("button", { name: "更新して再読み込み" }));
expect(onRefresh).toHaveBeenCalledTimes(1);
```

Also assert `updateReady={false}` renders nothing.

- [ ] **Step 5: Implement root integration**

- Register the service worker from `src/main.tsx` after the root mount.
- Keep update state in a focused `useAppUpdate` hook or provider-local state; do not add it to `GameApp`'s match command state.
- Render `AppUpdateBanner` around `ApplicationRoot` so login/loading/game screens all receive the update affordance.
- On user refresh: post `SKIP_WAITING` to the waiting worker, then reload only after `controllerchange` or after confirming no waiting worker remains.
- Add the message handler to `public/sw.js`:

```js
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
```

- [ ] **Step 6: Verify GREEN**

```bash
npm run test -- tests/unit/pwa/registerServiceWorker.test.ts tests/unit/pwa/AppUpdateBanner.test.tsx tests/unit/app/ApplicationRoot.test.ts
npm run typecheck
```

Expected: all exit 0.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/main.tsx src/app/ApplicationRoot.tsx src/pwa public/sw.js tests/unit/pwa
git commit -m "feat: add controlled PWA update lifecycle"
```

---

### Task 4: Save compatibility and no new client-side save namespace

**Files:**
- Modify: `tests/unit/persistence/gameStateCodec.test.ts` only if an existing assertion can directly express compatibility.
- Create: `tests/unit/pwa/saveCompatibility.test.ts` when the PWA-specific boundary needs an isolated test.
- Do not modify: `src/persistence/gameStateCodec.ts` unless a real regression is exposed.

**Interfaces:**
- Consumes: existing `gameStateCodec` encode/decode behavior and cloud-first bootstrap.
- Produces: regression evidence that the PWA shell/update path does not introduce a second local save key or rewrite malformed data.

- [ ] **Step 1: Add a compatibility regression test**

Use the existing codec fixture/builders from `tests/unit/persistence/gameStateCodec.test.ts`. Assert that encode -> decode returns the same supported game state before and after importing/initializing the PWA registration module. The PWA module must not touch game-state persistence.

Also add a source-level contract test to `tests/unit/pwa/saveCompatibility.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PWA save compatibility", () => {
  it("keeps the service worker independent from game save storage", () => {
    const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).not.toMatch(/localStorage|indexedDB|gameState|saveGame|snapshot/i);
  });
});
```

- [ ] **Step 2: Run the focused tests**

```bash
npm run test -- tests/unit/pwa/saveCompatibility.test.ts tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase17GameStateCodec.test.ts
```

Expected: GREEN. If this step exposes an actual codec regression, stop and fix it with its own RED/GREEN cycle; do not add a schema migration merely for PWA.

- [ ] **Step 3: Commit Task 4**

```bash
git add tests/unit/pwa/saveCompatibility.test.ts tests/unit/persistence
git commit -m "test: lock PWA save compatibility"
```

---

### Task 5: Production/mobile install and API-cache E2E contract

**Files:**
- Create: `tests/e2e/phase18-release-foundation.spec.ts`
- Modify only if required by an exposed bug: `playwright.config.ts`

**Interfaces:**
- Consumes: production `preview:e2e`, manifest, service worker, current Pixel 7 project.
- Produces: browser-level release-foundation evidence without duplicating PR18-3's full critical gameplay journey.

- [ ] **Step 1: Write the release-foundation E2E test**

The spec must verify from the running app:

```ts
test("exposes install metadata on the mobile production shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );

  const response = await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
});
```

Add a second test that fetches `/sw.js` and asserts the script contains an explicit `/api/` network-authoritative guard and does not contain a broad `caches.match(event.request)` handler before that guard.

- [ ] **Step 2: Run E2E and prove behavior**

```bash
npm run test:e2e -- tests/e2e/phase18-release-foundation.spec.ts
```

Expected: GREEN after Tasks 1-4. If RED, fix only the concrete production-shell mismatch exposed by the test.

- [ ] **Step 3: Run PR18-1 focused regression matrix**

```bash
npm run test -- tests/unit/pwa tests/unit/services/Phase16PvpGameApiClient.test.ts tests/unit/services/GameApiClient.pvp.test.ts tests/unit/app/GameApp.pvp.test.tsx tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase17GameStateCodec.test.ts
npm run typecheck
npm run build
npm run test:e2e -- tests/e2e/phase18-release-foundation.spec.ts tests/e2e/phase16-match-command-ux.spec.ts
```

Expected: all commands exit 0.

- [ ] **Step 4: Run repository gates**

```bash
npm run verify
npm run test:e2e
```

Expected: both exit 0.

- [ ] **Step 5: Commit Task 5**

```bash
git add tests/e2e/phase18-release-foundation.spec.ts

git commit -m "test: cover phase18 release foundation"
```

---

### Task 6: PR18-1 review and merge gate

**Files:**
- Review all PR18-1 changed files.
- No new production behavior should be added during this task without a fresh RED test.

- [ ] **Step 1: Review the diff against the Phase18 spec**

Confirm all of the following:

- manifest/install metadata exists;
- 192/512 install icons exist;
- service worker caches only safe same-origin static GET assets;
- `/api/**` and all mutations remain network-authoritative;
- update activation is user-controlled rather than automatic during gameplay;
- no save schema/storage namespace change was introduced;
- Phase16 PvP same-commandId/idempotency tests remain unchanged and green;
- package version remains `0.0.0` for PR18-4 to own.

- [ ] **Step 2: Capture fresh verification evidence**

Use the latest CI run plus fresh local/focused commands where available. Do not claim PR18-1 complete from code inspection alone.

- [ ] **Step 3: Open PR18-1**

Title:

```text
feat: add phase18 release foundation
```

Body must summarize manifest/PWA behavior, API cache exclusions, controlled update lifecycle, save compatibility evidence, and exact verification commands/results.
