# Court Legacy V2 Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the character-art/local-slot architecture and deliver a mandatory-login, cloud-saved V2 foundation with a responsive information-first UI and server-authoritative game mutations.

**Architecture:** Keep the tested deterministic domain engine, but move authenticated mutations behind the existing Cloudflare Worker. Supabase provides Auth and PostgreSQL; the browser holds only the publishable key, while the Worker holds the secret key and verifies Supabase JWTs against JWKS before loading or changing a user's game. Phase 1 stores the evolving `GameState` as a revisioned JSON snapshot for a safe migration boundary; Phase 2 will normalize recruiting, player-history, and long-term simulation records.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Cloudflare Workers/Wrangler 4, Supabase Auth/PostgreSQL, `@supabase/supabase-js`, `jose`, Zod 4, Vitest 4, Testing Library, Playwright 1.50.

**Spec:** `docs/superpowers/specs/2026-08-26-court-legacy-v2-rebuild-design.md`

## Global Constraints

- Production game access requires authentication; no guest play.
- Google OAuth is primary login; email login uses Supabase passwordless OTP/magic-link flow.
- Browser configuration uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` only.
- Worker configuration uses `SUPABASE_URL` and `SUPABASE_SECRET_KEY`; the secret key must never be bundled into the browser.
- Worker verifies bearer tokens with Supabase JWKS and requires issuer `${SUPABASE_URL}/auth/v1` and audience `authenticated`.
- One authenticated user owns one active school/game in Phase 1.
- All authoritative mutations pass through `/api/*`; the client never writes game tables directly.
- Every mutation carries `operationId` and `revision`; duplicate `operationId` calls are idempotent and stale revisions return HTTP 409.
- The browser must show visible feedback within 300 ms after any async action begins.
- No blank-screen loading states. Startup, login, onboarding, cloud load, save, retry, and game actions all have explicit visible status.
- Character portraits, fixed featured-player art, generated player-art atlases, and asset-loading UI dependencies are removed.
- Player lists default to text, number, position, grade, height, condition, rating, and tags.
- Ranked PvP and shop are not implemented in Phase 1; their server-authoritative boundaries are preserved for later phases.
- Existing deterministic domain tests are preserved unless the tested behavior is explicitly removed by the V2 spec.
- TDD is mandatory for behavior changes; every task ends with focused verification before commit.

---

## File Structure Locked by This Plan

### Browser application

- `src/App.tsx` — composition only; renders `AppBootstrap` with production services.
- `src/app/AppBootstrap.tsx` — resolves auth, bootstrap, onboarding, online/offline startup states.
- `src/app/GameApp.tsx` — authenticated navigation shell and feature composition.
- `src/app/useGameSession.ts` — revisioned server state, mutation lifecycle, retry/idempotency, recovery-cache integration.
- `src/app/createInitialGame.ts` — generic initial world creation; no featured-school dependency.
- `src/services/auth/AuthClient.ts` — browser auth port and `AuthSession` contract.
- `src/services/auth/SupabaseAuthClient.ts` — Google and email-OTP Supabase implementation.
- `src/services/api/GameApiClient.ts` — typed HTTP client for bootstrap, onboarding, and game actions.
- `src/features/auth/LoginScreen.tsx` — mandatory-login screen.
- `src/features/onboarding/SchoolSetupScreen.tsx` — first-school setup.
- `src/features/more/MoreScreen.tsx` — school/settings/logout entry point replacing save-sheet navigation.
- `src/persistence/RecoveryCache.ts` — single per-user local recovery snapshot and pending-operation record; not save slots.
- `src/ui/status/OperationStatusBar.tsx` — visible save/action/offline/error/retry state.
- `src/ui/shell/*` — refactored V2 header/navigation/frame.

### Worker

- `worker/env.ts` — exact Worker environment contract.
- `worker/http/json.ts` — JSON response/error helpers.
- `worker/auth/verifyAccessToken.ts` — JWKS JWT verification.
- `worker/data/GameStore.ts` — persistence port.
- `worker/data/SupabaseGameStore.ts` — Supabase-backed implementation.
- `worker/data/createSupabaseAdmin.ts` — secret-key server client.
- `worker/game/actionSchema.ts` — Zod discriminated union for game mutations.
- `worker/game/applyGameAction.ts` — pure authoritative mutation dispatcher using existing domain functions.
- `worker/routes/bootstrap.ts` — authenticated startup response.
- `worker/routes/onboarding.ts` — create profile/school/initial game.
- `worker/routes/gameAction.ts` — revision/idempotency guarded mutation endpoint.
- `worker/router.ts` — request routing and dependency injection.
- `worker/index.ts` — production dependency composition only.

### Database

- `supabase/migrations/202608260001_v2_foundation.sql` — Phase 1 schema, RLS, atomic onboarding RPC.

### Tests

- `tests/unit/worker/*` — auth/router/store/action behavior using fakes.
- `tests/unit/services/*` — browser auth/API contracts.
- `tests/unit/app/*` — bootstrap/session/status behavior.
- `tests/e2e/v2-auth-game-flow.spec.ts` — login → onboarding → game mutation → persisted reload.
- `tests/e2e/v2-operation-feedback.spec.ts` — <300 ms visible operation feedback and retry behavior.
- `tests/e2e/mobile-layout-audit.spec.ts` — update to V2 shell and portrait-free roster.

---

### Task 1: Remove the featured-character subsystem without damaging the simulation engine

**Files:**
- Modify: `src/app/createDemoGame.ts` → replace with `src/app/createInitialGame.ts`
- Modify: `src/domain/generation/generateWorld.ts`
- Modify: `src/domain/generation/generatePlayer.ts`
- Modify: `src/domain/model/Player.ts`
- Delete: `src/domain/generation/featuredWorldCatalog.ts`
- Delete: `src/domain/appearance/characterWorld.ts`
- Delete: `src/domain/appearance/playerAppearance.ts`
- Delete: `src/domain/appearance/playerArtRecipe.ts`
- Delete: `src/assets/characters/**`
- Delete: `src/assets/player-parts/**`
- Delete: `src/ui/FeaturedPlayerHero.tsx`
- Delete: `src/ui/featured-player-hero.css`
- Delete: `src/ui/player-art/**`
- Delete: `scripts/art-source/**`
- Delete: `scripts/generate_character_art_assets.py`
- Delete: `scripts/generate_character_art_assets_hq.py`
- Delete: `scripts/generate_character_art_from_full_sources.py`
- Delete: `scripts/generate_player_parts_atlas.py`
- Delete: `docs/character-art-quality-review.md`
- Delete: `docs/character-assembly.md`
- Delete: `docs/character-world.md`
- Delete: `tests/unit/domain/appearance/**`
- Delete: `tests/unit/ui/player-art/**`
- Modify: `tests/unit/domain/generation/generateWorld.test.ts`
- Modify: `tests/unit/domain/generation/generatePlayer.test.ts`

**Interfaces:**
- Produces: `createInitialGame(input: InitialGameSetup): GameState`
- Produces: `InitialGameSetup = { seed: string; schoolName: string; schoolShortName: string; coachName: string; regionId: string; uniform: UniformColors }`
- Preserves: `generateWorld({ seed, data, userSchool }): GameState`

- [ ] **Step 1: Replace featured-world expectations with generic-world tests**

Add tests asserting that a custom school name/coach is preserved, 15 unique rival schools are created, no player is injected from a featured catalog, and identical seed/input gives identical output.

```ts
const first = createInitialGame({
  seed: "user-123:2026",
  schoolName: "青葉高校",
  schoolShortName: "青葉",
  coachName: "高橋 監督",
  regionId: "region.chiba",
  uniform: { primary: "#17365D", secondary: "#FFFFFF", accent: "#D99B2B" },
});
const second = createInitialGame({
  seed: "user-123:2026",
  schoolName: "青葉高校",
  schoolShortName: "青葉",
  coachName: "高橋 監督",
  regionId: "region.chiba",
  uniform: { primary: "#17365D", secondary: "#FFFFFF", accent: "#D99B2B" },
});
expect(first).toEqual(second);
expect(first.schools[first.userSchoolId]?.name).toBe("青葉高校");
expect(Object.keys(first.schools)).toHaveLength(16);
```

- [ ] **Step 2: Run the focused tests and verify they fail for the featured-world coupling**

Run: `npm test -- tests/unit/domain/generation/generateWorld.test.ts tests/unit/domain/generation/generatePlayer.test.ts`

Expected: FAIL because `createInitialGame` does not exist and `generateWorld` still imports/applies featured profiles.

- [ ] **Step 3: Implement generic initial-world creation and remove art-only player state**

Create `src/app/createInitialGame.ts` with the exact public signature above. Remove `FEATURED_SCHOOL_SETUPS`, `findFeaturedSchoolSetup`, and `applyFeaturedPlayerProfile` from `generateWorld.ts`. Remove `appearanceSeed` and appearance-only uniqueness parameters from `Player`/generation if repository search confirms they have no remaining non-art use after UI deletion.

- [ ] **Step 4: Delete art/rendering assets, generators, docs, and their tests**

Delete only the paths listed in this task. Preserve historical `docs/superpowers/specs/*` and `docs/superpowers/plans/*` as design history.

- [ ] **Step 5: Verify no active source references the removed subsystem**

Run:

```bash
rg "FeaturedPlayer|PlayerArt|featuredWorldCatalog|characterWorld|playerAppearance|playerArtRecipe|assets/characters|player-parts|appearanceSeed" src tests scripts
```

Expected: no matches. If `appearanceSeed` still has a genuine non-art use, keep the field and document that use in the commit instead of deleting it.

Run: `npm test -- tests/unit/domain/generation tests/unit/domain/match tests/unit/domain/calendar`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove character art subsystem"
```

---

### Task 2: Add Supabase dependencies, environment contracts, and Phase 1 database schema

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.env.example`
- Create: `.dev.vars.example`
- Create: `worker/env.ts`
- Create: `supabase/migrations/202608260001_v2_foundation.sql`
- Modify: `README.md`

**Interfaces:**
- Browser env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Worker env: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- Database tables: `profiles`, `schools`, `game_saves`, `game_operations`
- Database RPC: `create_v2_game(p_user_id uuid, p_display_name text, p_school_name text, p_school_short_name text, p_coach_name text, p_region_id text, p_state jsonb, p_team_selection jsonb) returns table(school_id uuid, revision bigint)`

- [ ] **Step 1: Install current Supabase/JWT libraries**

Run:

```bash
npm install @supabase/supabase-js jose
```

Expected: `package.json` and lockfile contain both runtime dependencies.

- [ ] **Step 2: Add environment type and examples**

`worker/env.ts`:

```ts
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
}
```

`.env.example`:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`.dev.vars.example`:

```dotenv
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

- [ ] **Step 3: Write the exact Phase 1 migration**

The migration creates UUID-backed profile/school rows, one game save per user, idempotency records keyed by `(user_id, operation_id)`, `revision bigint not null default 1`, `state jsonb not null`, and `team_selection jsonb not null`. Add indexes on `schools.user_id`, `game_saves.school_id`, and `game_operations.created_at`. Enable RLS on all four tables. Revoke direct table mutations from `anon` and `authenticated`; Phase 1 game data goes through the Worker. Create `create_v2_game(...)` as a `security definer` function that atomically inserts profile, school, and initial save, then revoke execution from `public`, `anon`, and `authenticated` and grant execution to `service_role`.

- [ ] **Step 4: Add README setup with current key names**

Document that browser code receives only the publishable key, Worker secrets are installed with `wrangler secret put SUPABASE_SECRET_KEY`, and Google/email providers are configured in Supabase Auth. Do not document legacy `anon`/`service_role` keys as application configuration.

- [ ] **Step 5: Verify configuration compiles**

Run: `npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example .dev.vars.example worker/env.ts supabase/migrations/202608260001_v2_foundation.sql README.md
git commit -m "chore: add Supabase V2 foundation"
```

---

### Task 3: Build Worker authentication and dependency-injected routing

**Files:**
- Create: `worker/http/json.ts`
- Create: `worker/auth/verifyAccessToken.ts`
- Create: `worker/router.ts`
- Modify: `worker/index.ts`
- Create: `tests/unit/worker/verifyAccessToken.test.ts`
- Create: `tests/unit/worker/router.test.ts`

**Interfaces:**

```ts
export interface AuthenticatedUser { id: string }
export type VerifyAccessToken = (token: string) => Promise<AuthenticatedUser>;
export interface WorkerDependencies { verifyAccessToken: VerifyAccessToken; store: GameStore }
export function createRouter(deps: WorkerDependencies): (request: Request) => Promise<Response>;
```

- [ ] **Step 1: Write failing router/auth tests**

Cover `/api/health` without auth, protected endpoint without bearer token returns 401 JSON, malformed authorization returns 401, and a fake verifier injects `user.id` into protected handlers.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/unit/worker/router.test.ts tests/unit/worker/verifyAccessToken.test.ts`

Expected: FAIL because router/auth modules do not exist.

- [ ] **Step 3: Implement JWT verification with JWKS**

Use `jose`:

```ts
const jwks = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
const { payload } = await jwtVerify(token, jwks, {
  issuer: `${env.SUPABASE_URL}/auth/v1`,
  audience: "authenticated",
});
if (typeof payload.sub !== "string") throw new Error("missing subject");
return { id: payload.sub };
```

Cache the JWKS resolver per Worker isolate rather than recreating it for every request.

- [ ] **Step 4: Implement JSON helpers and router**

`json.ts` exports `json(data, init?)` and `jsonError(status, code, message)`. `createRouter` handles `OPTIONS`, `/api/health`, then authenticates all remaining `/api/*` routes. Unknown API routes return `{ error: { code: "not_found", message: "API route not found" } }` with 404.

- [ ] **Step 5: Compose production dependencies in `worker/index.ts`**

`worker/index.ts` creates the Supabase store and verifier from `Env`, creates the router, and delegates `fetch`. Keep domain/business logic out of `index.ts`.

- [ ] **Step 6: Verify tests and typecheck**

Run: `npm test -- tests/unit/worker && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker tests/unit/worker
git commit -m "feat: add authenticated Worker router"
```

---

### Task 4: Implement cloud bootstrap and atomic onboarding

**Files:**
- Create: `worker/data/GameStore.ts`
- Create: `worker/data/createSupabaseAdmin.ts`
- Create: `worker/data/SupabaseGameStore.ts`
- Create: `worker/routes/bootstrap.ts`
- Create: `worker/routes/onboarding.ts`
- Modify: `worker/router.ts`
- Create: `tests/unit/worker/bootstrap.test.ts`
- Create: `tests/unit/worker/onboarding.test.ts`

**Interfaces:**

```ts
export interface CloudGameSnapshot {
  userId: string;
  schoolDbId: string;
  revision: number;
  state: GameState;
  teamSelection: TeamSelection;
}

export interface GameStore {
  getSnapshot(userId: string): Promise<CloudGameSnapshot | null>;
  createGame(input: CreateCloudGameInput): Promise<CloudGameSnapshot>;
  applyOperation(input: PersistOperationInput): Promise<CloudGameSnapshot>;
}
```

Bootstrap response is exactly one of:

```ts
{ status: "needs-onboarding" }
{ status: "ready"; game: CloudGameSnapshot }
```

- [ ] **Step 1: Write failing bootstrap and onboarding tests using an in-memory `GameStore`**

Tests: no save → `needs-onboarding`; existing save → `ready`; onboarding validates trimmed display/school/coach names and allowed region; duplicate onboarding returns 409 `game_already_exists`.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- tests/unit/worker/bootstrap.test.ts tests/unit/worker/onboarding.test.ts`

Expected: FAIL because routes/store do not exist.

- [ ] **Step 3: Implement Supabase admin client and store reads**

`createSupabaseAdmin(env)` calls:

```ts
createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

`getSnapshot(userId)` selects only the authenticated user's `game_saves` row and maps `state`, `team_selection`, and `revision` through Zod/codec validation before returning it.

- [ ] **Step 4: Implement onboarding route**

Validate body with Zod, derive a deterministic initial seed from authenticated user id plus a server-side creation nonce/date string, call `createInitialGame`, compute `autoSelectTeam`, then call the atomic `create_v2_game` RPC. Return `{ status: "ready", game }` with HTTP 201.

- [ ] **Step 5: Register routes**

- `GET /api/bootstrap`
- `POST /api/onboarding`

Both use the already-verified authenticated user from the router.

- [ ] **Step 6: Verify**

Run: `npm test -- tests/unit/worker && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker tests/unit/worker
git commit -m "feat: add cloud bootstrap and onboarding"
```

---

### Task 5: Move game mutations behind one revisioned, idempotent Worker action endpoint

**Files:**
- Create: `worker/game/actionSchema.ts`
- Create: `worker/game/applyGameAction.ts`
- Create: `worker/routes/gameAction.ts`
- Modify: `worker/data/GameStore.ts`
- Modify: `worker/data/SupabaseGameStore.ts`
- Modify: `worker/router.ts`
- Create: `tests/unit/worker/applyGameAction.test.ts`
- Create: `tests/unit/worker/gameAction.test.ts`

**Interfaces:**

```ts
export type GameAction =
  | { type: "training"; plan: WeeklyPlan }
  | { type: "team-selection"; selection: TeamSelection }
  | { type: "practice-match" }
  | { type: "advance-week" }
  | { type: "facility-upgrade"; facility: FacilityKey }
  | { type: "event-choice"; choiceId: string };

export interface GameActionRequest {
  operationId: string;
  revision: number;
  action: GameAction;
}

export interface GameActionResponse {
  game: CloudGameSnapshot;
  operationId: string;
  outcome?: unknown;
}
```

- [ ] **Step 1: Write failing pure dispatcher tests**

For each action, verify legal state transition, illegal duplicate weekly action rejection, deterministic practice-match result for the same snapshot, invalid team selection rejection, and no mutation of input objects.

- [ ] **Step 2: Write failing route tests**

Cover: expected revision succeeds and increments by exactly 1; stale revision returns 409 `revision_conflict`; duplicate `operationId` returns the previously persisted response without a second mutation; another user's operation cannot access the row.

- [ ] **Step 3: Run tests and verify failure**

Run: `npm test -- tests/unit/worker/applyGameAction.test.ts tests/unit/worker/gameAction.test.ts`

Expected: FAIL because action dispatcher/route do not exist.

- [ ] **Step 4: Implement `applyGameAction` by moving current `App.tsx` mutation logic server-side**

Reuse existing functions: `resolveWeeklyTraining`, `markWeeklyActionCompleted`, `simulateMatch`, `recordMatchOutcome`, `advanceGameWeek`, `surfaceWeeklyEvent`, `upgradeFacility`, `resolveEventChoice`, `validateTeamSelection`. Use the snapshot's `teamSelection`, `seed`, and `randomCursor`; do not accept computed match results or player stat changes from the client.

- [ ] **Step 5: Implement atomic persistence semantics**

`SupabaseGameStore.applyOperation` must persist only when `game_saves.revision = input.expectedRevision`. The SQL path records `(user_id, operation_id)` and resulting revision in the same transaction/RPC so a network retry cannot apply twice. Return 409 if revision was stale and no matching idempotency record exists.

- [ ] **Step 6: Register `POST /api/game/action` and structured errors**

Response codes:
- 200 success/idempotent replay
- 400 invalid action/body
- 401 unauthenticated
- 409 revision conflict/game rule conflict
- 500 unexpected server failure with non-sensitive message

- [ ] **Step 7: Verify full domain + Worker tests**

Run: `npm test -- tests/unit/domain tests/unit/worker`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add worker tests/unit/worker
git commit -m "feat: make game actions server authoritative"
```

---

### Task 6: Add browser auth port and mandatory login UI

**Files:**
- Create: `src/services/auth/AuthClient.ts`
- Create: `src/services/auth/SupabaseAuthClient.ts`
- Create: `src/features/auth/LoginScreen.tsx`
- Create: `src/features/auth/auth.css`
- Create: `tests/unit/services/SupabaseAuthClient.test.ts`
- Create: `tests/unit/features/auth/LoginScreen.test.tsx`

**Interfaces:**

```ts
export interface AuthSession {
  userId: string;
  email: string | null;
  accessToken: string;
}

export interface AuthClient {
  getSession(): Promise<AuthSession | null>;
  subscribe(listener: (session: AuthSession | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
}
```

- [ ] **Step 1: Write failing auth and login-screen tests**

Verify signed-out UI shows Google and email options; Google click exposes `Googleで始める` pending state immediately; email submits a normalized address and displays `ログイン用メールを送信しました`; errors stay visible with retry-able controls.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/unit/services/SupabaseAuthClient.test.ts tests/unit/features/auth/LoginScreen.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement Supabase auth adapter**

Create the browser Supabase client using only `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Google uses `signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })`. Email uses `signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })`. Map Supabase sessions into the `AuthSession` contract and expose `onAuthStateChange` through `subscribe`.

- [ ] **Step 4: Implement accessible login UI with explicit states**

Use `aria-live="polite"` for status, disable only the active submit control, preserve the other login method while one action fails, and never render a blank auth screen while session lookup is occurring.

- [ ] **Step 5: Verify**

Run: `npm test -- tests/unit/services tests/unit/features/auth && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/auth src/features/auth tests/unit/services tests/unit/features/auth
git commit -m "feat: add mandatory Supabase login"
```

---

### Task 7: Add typed game API client, authenticated bootstrap, and onboarding UI

**Files:**
- Create: `src/services/api/GameApiClient.ts`
- Create: `src/app/AppBootstrap.tsx`
- Create: `src/features/onboarding/SchoolSetupScreen.tsx`
- Create: `src/features/onboarding/onboarding.css`
- Modify: `src/App.tsx`
- Create: `tests/unit/services/GameApiClient.test.ts`
- Create: `tests/unit/app/AppBootstrap.test.tsx`
- Create: `tests/unit/features/onboarding/SchoolSetupScreen.test.tsx`

**Interfaces:**

```ts
export interface GameApiClient {
  bootstrap(accessToken: string): Promise<BootstrapResponse>;
  onboard(accessToken: string, input: OnboardingInput): Promise<ReadyBootstrapResponse>;
  applyAction(accessToken: string, request: GameActionRequest): Promise<GameActionResponse>;
}
```

`AppBootstrap` states are exactly `checking-auth`, `signed-out`, `loading-cloud`, `needs-onboarding`, `ready`, `offline-cache`, `fatal-error`.

- [ ] **Step 1: Write failing API client tests**

Verify bearer token header, JSON parsing, 401 handling, 409 structured error mapping, network error mapping, and `AbortSignal` support.

- [ ] **Step 2: Write failing bootstrap/onboarding UI tests**

Verify startup immediately displays `アカウントを確認しています…`; authenticated startup displays `学校データを読み込んでいます…`; no game displays setup form; successful setup enters game; failure displays retry without erasing entered school fields.

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- tests/unit/services/GameApiClient.test.ts tests/unit/app/AppBootstrap.test.tsx tests/unit/features/onboarding/SchoolSetupScreen.test.tsx`

Expected: FAIL.

- [ ] **Step 4: Implement typed API error model and client**

Use an `ApiError` carrying `status`, `code`, and user-safe `message`. Do not expose raw server stack traces.

- [ ] **Step 5: Implement `AppBootstrap` state machine**

Subscribe to auth changes. A null session renders `LoginScreen`; a session triggers `/api/bootstrap`; `needs-onboarding` renders `SchoolSetupScreen`; `ready` passes the snapshot to `GameApp`. Abort obsolete bootstrap requests when auth changes.

- [ ] **Step 6: Reduce `src/App.tsx` to composition**

`App.tsx` constructs `SupabaseAuthClient` and `GameApiClient` once, then renders `<AppBootstrap auth={auth} api={api} />`. Remove demo-game startup and IndexedDB slot restore from `App.tsx`.

- [ ] **Step 7: Verify**

Run: `npm test -- tests/unit/app tests/unit/services tests/unit/features/auth tests/unit/features/onboarding && npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/app/AppBootstrap.tsx src/services/api src/features/onboarding tests/unit
git commit -m "feat: add authenticated game bootstrap"
```

---

### Task 8: Replace three save slots with one recovery cache and visible operation state

**Files:**
- Delete: `src/features/save/SaveSheet.tsx`
- Delete: `src/features/save/save-sheet.css`
- Delete: `src/persistence/GameRepository.ts`
- Delete: `src/persistence/IndexedDbGameRepository.ts`
- Delete: `src/persistence/backupRotation.ts`
- Delete: `tests/unit/features/save/SaveSheet.test.tsx`
- Delete: `tests/unit/persistence/backupRotation.test.ts`
- Create: `src/persistence/RecoveryCache.ts`
- Create: `src/app/useGameSession.ts`
- Create: `src/ui/status/OperationStatusBar.tsx`
- Create: `src/ui/status/operation-status.css`
- Create: `tests/unit/persistence/RecoveryCache.test.ts`
- Create: `tests/unit/app/useGameSession.test.tsx`
- Create: `tests/unit/ui/OperationStatusBar.test.tsx`

**Interfaces:**

```ts
export type OperationState =
  | { status: "idle" }
  | { status: "submitting"; label: string; operationId: string }
  | { status: "success"; label: string }
  | { status: "offline"; label: string; retry: () => void }
  | { status: "error"; label: string; retry: () => void };

export interface RecoveryRecord {
  userId: string;
  snapshot: CloudGameSnapshot;
  pendingOperation: GameActionRequest | null;
  updatedAt: string;
}
```

- [ ] **Step 1: Write failing recovery/session tests**

Verify one cache record per user, snapshot replacement rather than slot rotation, mutation sets `submitting` synchronously, success replaces revision/state and cache, network ambiguity preserves the same `operationId` for retry, and 409 triggers a cloud reload path rather than overwriting the server.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- tests/unit/persistence/RecoveryCache.test.ts tests/unit/app/useGameSession.test.tsx tests/unit/ui/OperationStatusBar.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement `RecoveryCache` using a single IndexedDB store**

Database: `court-legacy-v2`, store: `recovery`, key: authenticated `userId`. Store only the latest authoritative snapshot plus an unresolved request for same-id retry. No manual slots, copy, rename, rotation, or user-facing save sheet.

- [ ] **Step 4: Implement `useGameSession`**

`runAction(action, label)` generates one `crypto.randomUUID()`, sets operation state before awaiting fetch, sends current revision, writes successful snapshot to recovery cache, and creates a retry closure that reuses the exact same request object on network/5xx ambiguity.

- [ ] **Step 5: Implement status bar**

Render `保存中…`, `保存済み ✓`, `オフライン / 再試行`, or error text with a real button. Use `role="status"`/`aria-live`. Do not cover the whole screen.

- [ ] **Step 6: Delete slot-save implementation and verify references**

Run:

```bash
rg "SaveSheet|SaveSlotId|browserGameRepository|IndexedDbGameRepository|backupRotation|slot-1|slot-2|slot-3" src tests
```

Expected: no active-code matches.

- [ ] **Step 7: Verify**

Run: `npm test -- tests/unit/persistence tests/unit/app tests/unit/ui && npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: replace save slots with cloud recovery state"
```

---

### Task 9: Build the information-first V2 shell and portrait-free roster

**Files:**
- Create: `src/app/GameApp.tsx`
- Modify: `src/ui/shell/GamePageFrame.tsx`
- Modify: `src/ui/shell/GameHeader.tsx`
- Modify: `src/ui/shell/BottomGameNav.tsx`
- Modify: `src/ui/shell/appNavigation.ts`
- Modify: `src/app/app-shell.css`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/home.css`
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/player-hub.css`
- Create: `src/features/more/MoreScreen.tsx`
- Create: `src/features/more/more.css`
- Modify: `tests/unit/App.test.tsx`
- Modify: `tests/unit/features/home/HomeScreen.test.tsx`
- Modify: `tests/unit/features/team/PlayerHubScreen.test.tsx`
- Modify: `tests/unit/ui/shell/BottomGameNav.test.tsx`

**Interfaces:**
- Main tabs: `home | team | training | match | more`
- Header always shows school name, academic year/date, reputation label, and `OperationStatusBar`.
- `MoreScreen` exposes School and logout; PvP/records/shop are not fake clickable features in Phase 1.

- [ ] **Step 1: Rewrite shell/roster tests first**

Assert five main tabs, no save button/sheet, no `<img>` or player-art component in roster, player rows show number/name/grade/position/height/overall/condition, and header includes visible operation state.

- [ ] **Step 2: Run tests to verify current UI fails V2 expectations**

Run: `npm test -- tests/unit/App.test.tsx tests/unit/features/home/HomeScreen.test.tsx tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/ui/shell/BottomGameNav.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement `GameApp` and V2 navigation**

Move authenticated game navigation out of old `App.tsx`. Keep current feature screens where their logic remains useful, but all mutations are supplied as callbacks from `useGameSession` rather than directly changing authoritative `GameState`.

- [ ] **Step 4: Redesign Home as dashboard cards**

Top priority: next match/next required action, current week, team strength/condition, noteworthy pending event. Remove featured-character hero layouts.

- [ ] **Step 5: Redesign player hub as dense responsive list/table**

Desktop uses columns; mobile uses stacked rows. No character image request is made. Use semantic buttons/rows and make the selected player's details readable without overlaying critical controls.

- [ ] **Step 6: Implement More screen and logout**

More contains School details/facility navigation and account/logout. Do not render disabled placeholders for PvP/shop as if they are usable.

- [ ] **Step 7: Verify UI tests and build**

Run: `npm test -- tests/unit/features tests/unit/ui tests/unit/App.test.tsx && npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/GameApp.tsx src/ui src/features tests/unit
git commit -m "feat: replace character UI with V2 game shell"
```

---

### Task 10: Wire training, team, match, facility, week, and event actions to the server session

**Files:**
- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/training/TrainingScreen.tsx`
- Modify: `src/features/match/MatchScreen.tsx`
- Modify: `src/features/school/SchoolScreen.tsx`
- Modify: `src/features/home/EventDialog.tsx`
- Modify: `src/features/calendar/CalendarSheet.tsx`
- Modify: affected CSS files
- Modify: `tests/unit/features/training/TrainingFlow.test.tsx`
- Modify: `tests/unit/features/match/AppMatchFlow.test.tsx`
- Modify: `tests/unit/features/school/AppSchoolCalendarFlow.test.tsx`
- Modify: `tests/unit/features/home/EventDialog.test.tsx`

**Interfaces:**
- UI never calls `resolveWeeklyTraining`, `simulateMatch`, `upgradeFacility`, `advanceGameWeek`, or `resolveEventChoice` directly.
- UI calls `runAction(GameAction, JapaneseStatusLabel)`.

- [ ] **Step 1: Change feature tests to assert request intent rather than local mutation**

Examples:

```ts
expect(runAction).toHaveBeenCalledWith(
  { type: "training", plan: expectedPlan },
  "練習結果を保存しています…",
);
```

and:

```ts
expect(runAction).toHaveBeenCalledWith(
  { type: "practice-match" },
  "試合を計算しています…",
);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/unit/features/training tests/unit/features/match tests/unit/features/school tests/unit/features/home`

Expected: FAIL because current `App.tsx` still owns local mutations.

- [ ] **Step 3: Wire all six mutation families to `useGameSession`**

Use exact labels:
- training: `練習結果を保存しています…`
- team: `スタメンを保存しています…`
- match: `試合を計算しています…`
- facility: `施設を更新しています…`
- advance week: `次の週へ進めています…`
- event: `イベント結果を保存しています…`

Disable only the action currently being submitted when duplicate submission would be unsafe. Navigation and unrelated read-only UI remain usable.

- [ ] **Step 4: Render server-returned outcomes**

Training result, practice match result, and year transition summary come from `GameActionResponse.outcome`; do not rerun the simulation client-side to recreate them.

- [ ] **Step 5: Verify no authoritative game mutation remains in browser feature code**

Run:

```bash
rg "resolveWeeklyTraining|simulateMatch|upgradeFacility\(|advanceGameWeek|resolveEventChoice|markWeeklyActionCompleted" src/App.tsx src/app src/features
```

Expected: no calls in browser app/features; type-only imports are acceptable if needed for display contracts.

- [ ] **Step 6: Verify feature tests**

Run: `npm test -- tests/unit/features tests/unit/app && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app src/features tests/unit/features tests/unit/app
git commit -m "feat: route game mutations through cloud session"
```

---

### Task 11: Add deterministic E2E auth adapter and V2 end-to-end flows

**Files:**
- Create: `src/services/auth/MockAuthClient.ts`
- Create: `src/services/auth/createAuthClient.ts`
- Modify: `src/App.tsx`
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Delete: `tests/e2e/save-recovery.spec.ts`
- Create: `tests/e2e/v2-auth-game-flow.spec.ts`
- Create: `tests/e2e/v2-operation-feedback.spec.ts`
- Modify: `tests/e2e/app-shell.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`
- Modify: other old E2E expectations that reference removed character/save UI

**Interfaces:**
- Production auth driver: Supabase only.
- E2E auth driver is enabled only by `VITE_AUTH_DRIVER=mock` in the dedicated E2E build command and returns a fixed non-production token `e2e-user-token`.
- Worker/API responses in Playwright are intercepted at the browser network layer; production Worker auth bypass is never added.

- [ ] **Step 1: Write E2E flow around mocked browser auth/API responses**

Flow:
1. login screen appears
2. click test login via mock auth
3. `/api/bootstrap` returns `needs-onboarding`
4. submit school setup
5. onboarding returns revision 1 snapshot
6. run training; status appears immediately
7. action returns revision 2
8. reload; bootstrap returns revision 2 and same school

- [ ] **Step 2: Add feedback timing E2E**

Intercept `/api/game/action` and delay 800 ms. After clicking an action, assert the relevant Japanese pending label becomes visible within 300 ms, remains until the response, and then changes to `保存済み ✓`.

- [ ] **Step 3: Implement mock auth adapter behind build-time factory**

`createAuthClient()` statically imports production Supabase auth for normal builds. The mock implementation is selected only when `import.meta.env.VITE_AUTH_DRIVER === "mock"`; production documentation and deploy command never set this variable.

- [ ] **Step 4: Add `build:e2e`/Playwright startup**

Use a cross-platform Node helper script rather than shell-only env assignment if CI runs on multiple OSes. The script sets `VITE_AUTH_DRIVER=mock` for the E2E build and starts preview. Do not modify production `npm run build` or `npm run deploy` to enable mock auth.

- [ ] **Step 5: Update existing E2E selectors to V2 semantics**

Remove assertions for featured portraits, image atlas loading, save slots, and old tab labels. Preserve yearly progression and event behavior where still valid.

- [ ] **Step 6: Run E2E desktop and mobile**

Run: `npm run test:e2e`

Expected: PASS including the 300 ms feedback assertion.

- [ ] **Step 7: Commit**

```bash
git add package.json playwright.config.ts src/services/auth src/App.tsx tests/e2e
git commit -m "test: cover V2 auth cloud and operation UX"
```

---

### Task 12: Final cleanup, security scan, and Phase 1 acceptance verification

**Files:**
- Modify: `README.md`
- Modify: `scripts/verify.mjs`
- Modify: `.github/workflows/ci.yml` if E2E build command changed
- Modify: any remaining source/test files found by the acceptance scan

**Interfaces:**
- No new runtime interface; this task locks the Phase 1 acceptance boundary consumed by Phase 2.

- [ ] **Step 1: Add V2 structural checks to `scripts/verify.mjs`**

Verify required files exist (`AppBootstrap`, `useGameSession`, Worker auth/routes, migration) and forbidden production paths/import strings do not exist (`src/ui/player-art`, `src/assets/characters`, `src/assets/player-parts`, `SaveSheet`, `IndexedDbGameRepository`, `featuredWorldCatalog`).

- [ ] **Step 2: Run secret/config scan**

Run:

```bash
rg "sb_secret_|service_role|SUPABASE_SECRET_KEY|VITE_SUPABASE" src worker . --glob '!node_modules/**' --glob '!docs/**'
```

Expected:
- `SUPABASE_SECRET_KEY` only in Worker env/example/server composition.
- `VITE_SUPABASE_*` only in browser auth/config/example.
- no actual `sb_secret_...` value committed.
- no `service_role` application key value committed.

- [ ] **Step 3: Run obsolete-architecture scan**

Run:

```bash
rg "FeaturedPlayer|PlayerArt|SaveSheet|SaveSlotId|slot-1|slot-2|slot-3|featuredWorldCatalog|characterWorld|playerAppearance|playerArtRecipe" src tests scripts
```

Expected: no active-code matches.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run verify
npm run test:e2e
```

Expected: all commands PASS.

- [ ] **Step 5: Manual acceptance checklist**

Verify in desktop and mobile browsers:
- signed-out user cannot enter game
- startup always shows a status instead of a white screen
- first account creates exactly one school
- reload restores cloud snapshot
- training/match/week/facility/event/team mutation visibly starts immediately
- failed network action shows retry
- retry reuses operation id and does not double-apply
- stale revision does not overwrite newer server state
- no player portrait/atlas network requests occur
- no save-slot UI exists
- unrelated navigation remains usable while an isolated action is pending

- [ ] **Step 6: Update README Phase 1 architecture and setup**

Document production auth, local Worker secrets, Supabase migration application, cloud save behavior, recovery-cache purpose, and commands for normal/E2E verification.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: verify Court Legacy V2 foundation"
```

---

## Phase 1 Acceptance Boundary for Later Plans

Phase 2 may start only when all of these are true:

1. `AppBootstrap` owns mandatory authentication/bootstrap/onboarding state.
2. `useGameSession` is the only browser entry point for authoritative game mutations.
3. `/api/game/action` is revisioned, idempotent, authenticated, and server-authoritative.
4. `GameStore` hides Supabase persistence details from game routes.
5. The browser has no Supabase secret key and no direct game-table writes.
6. The character-art subsystem and local save-slot subsystem are absent.
7. `createInitialGame` and `applyGameAction` are deterministic and tested.
8. Recovery cache is a single per-user safety cache, not an alternate source of truth.
9. V2 shell uses `home/team/training/match/more` and the roster is portrait-free.
10. All async operations show visible status within 300 ms.
11. Unit, integration, build, verify, and Playwright suites pass.

## Self-Review Results

- **Spec coverage:** Phase 1 covers art removal, V2 shell, mandatory account, cloud save, one-account/one-school, server authority, revision conflict, local recovery cache, visible loading/error/retry states, and preservation of existing domain simulation. PvP, recruiting V2, historical normalization, and shop are deliberately deferred to their approved later phases.
- **Placeholder scan:** No `TBD`, `TODO`, unspecified error-handling step, or “similar to task N” instruction remains.
- **Type consistency:** `CloudGameSnapshot`, `GameStore`, `GameActionRequest`, `GameActionResponse`, `AuthSession`, `AuthClient`, `GameApiClient`, and `OperationState` are defined once in earlier tasks and consumed by later tasks under the same names.
- **Risk check:** Phase 1 intentionally uses revisioned JSON snapshots to avoid simultaneously rewriting the simulation model and online architecture. Phase 2 can normalize recruiting/player/history tables after the cloud boundary is proven.
- **Security check:** Browser publishable key and Worker secret key are separated; JWT verification happens before protected routes; game mutation inputs never accept authoritative computed results from the browser.
