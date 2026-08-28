# Court Legacy / 継承のコート

男子高校バレー部の監督として、選手の入学・育成・大会・卒業を何年でも繰り返すスマートフォン特化型シミュレーションゲームです。

## Development status

- Milestone: V2 Phase 4 async PvP
- Runtime: React + TypeScript + Vite
- API/runtime: Cloudflare Workers
- Authentication/database: Supabase Auth + PostgreSQL
- Repository: `TI-06/court-legacy`

Phase 2では、学校評判 E〜SS、選手Tierと長期個体差、評判・実績・設備・監督能力に連動するスカウト確率、不完全情報の候補レポート、サーバー権威の候補保存・獲得・年度入学までを年度進行へ統合しています。

Phase 4では、育成したチームを凍結スナップショットとして公開し、他プレイヤーの公開チームへ非同期で挑戦できるレーティング対人戦を追加しています。試合生成、Elo更新、同一相手の日次回数制限、operation IDによる冪等性、ランキング・履歴の永続化はWorker / PostgreSQL側が権威を持ちます。

## Commands

```bash
npm ci
npm run dev
npm run verify
npm run test:e2e
```

`npm run verify` checks formatting, lint, TypeScript, the V2 architecture guard, production dependency vulnerabilities at high severity or above, unit tests, and the production build.

## Supabase configuration

V2 production play requires an authenticated account. The browser receives only a Supabase **publishable key**. Elevated credentials are Worker-only and must never be bundled into the client.

Create a local browser environment file from `.env.example`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Create local Worker variables from `.dev.vars.example`:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

For a deployed Cloudflare Worker, configure `SUPABASE_URL` as a Worker environment variable and store the elevated key as a secret:

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
```

Do not place `SUPABASE_SECRET_KEY` in any `VITE_*` variable, committed file, or browser bundle.

Apply the V2 migrations to the Supabase project in order before using cloud saves, scouting, or PvP:

1. `supabase/migrations/202608260001_v2_foundation.sql`
2. `supabase/migrations/202608260002_game_operations.sql`
3. `supabase/migrations/202608270003_scouting_candidate_pools.sql`
4. `supabase/migrations/202608280004_async_pvp.sql`

The Phase 1 schema keeps game state behind the Worker, enables RLS on all game tables, does not grant direct browser table access, and applies game mutations with revision checks and operation-id idempotency.

The Phase 2 scouting migration stores the authoritative candidate pool separately from `GameState`. Exact ability values, potential, hidden traits, and other candidate truth are readable only through the Worker/service role. Browser roles have no direct table privileges. Recruitment commits candidate IDs only; the Worker resolves those IDs against the server-side candidate pool when the academic year changes and then enrolls the selected players as new first-years.

Recruitment capacity is checked before a commitment is persisted, including reserving the extra roster slot when a scheduled generational talent may arrive. This prevents a valid scouting action from creating an impossible April rollover.

### Async PvP authority and privacy

`202608280004_async_pvp.sql` adds append-only published team snapshots, seasonal ratings, rated match history, operation idempotency, and atomic rating/match persistence. Rating updates for both users and the match record are committed through the server-side persistence boundary rather than separate browser writes.

The browser may receive only PvP presentation data such as school name, school short name, reputation rank, published team power, rating, wins/losses, streak, sanitized set scores, ranking, and the authenticated user's match history. Exact player abilities, potential, player tier, hidden traits, growth peak, injury resistance, exact tactic weights, frozen opponent players, and full opponent `GameState` remain Worker-only.

PvP requests also cannot choose the active season or determine a match result. The Worker derives the current JST season, validates the challenger revision and active defender snapshot, creates the deterministic match input/seed, enforces the same-opponent daily limit, and persists the canonical result. Reusing the same challenge `operationId` returns the stored result instead of applying the rating twice.

### Deployment order

For a Phase 4 deployment, keep the database and Worker compatible before exposing the browser UI:

1. Apply all Supabase migrations through `202608280004_async_pvp.sql`.
2. Confirm the Worker has `SUPABASE_URL` and the elevated `SUPABASE_SECRET_KEY` secret.
3. Deploy the Cloudflare Worker with the PvP routes and store implementation.
4. Run `npm run verify` and `npm run test:e2e` against the release candidate.
5. Deploy the browser build only after the Worker endpoints are available.

Configure the intended sign-in providers in Supabase Auth. Google is the primary OAuth provider; email authentication remains available as the secondary login path.

## Long-run verification

The unit suite includes deterministic 30-year and bounded 100-year world simulations. Phase 2 also exercises 30 consecutive recruiting cycles to verify that annual candidate generation, enrollment, graduation, recruiting-state reset, and user-school roster bounds continue to work across generations.

Phase 4 adds deterministic high-volume Elo verification to ensure ratings never become negative, wins/losses remain consistent with match counts, win streaks remain bounded, and repeated operation IDs are tallied only once in the stress ledger. Worker route/store tests separately verify real challenge replay idempotency and atomic persistence behavior.

## E2E authentication

Playwright uses the dedicated Vite `e2e` mode and `.env.e2e`. This bypass is test-only and is not used by `npm run build` or production deployment.
