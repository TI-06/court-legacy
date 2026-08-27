# Court Legacy / 継承のコート

男子高校バレー部の監督として、選手の入学・育成・大会・卒業を何年でも繰り返すスマートフォン特化型シミュレーションゲームです。

## Development status

- Milestone: V2 Phase 1 foundation
- Runtime: React + TypeScript + Vite
- API/runtime: Cloudflare Workers
- Authentication/database: Supabase Auth + PostgreSQL
- Repository: `TI-06/court-legacy`

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

Apply the Phase 1 migrations to the Supabase project in order before using cloud saves:

1. `supabase/migrations/202608260001_v2_foundation.sql`
2. `supabase/migrations/202608260002_game_operations.sql`

The Phase 1 schema keeps game state behind the Worker, enables RLS on all game tables, does not grant direct browser table access, and applies game mutations with revision checks and operation-id idempotency.

Configure the intended sign-in providers in Supabase Auth. Google is the primary OAuth provider; email authentication remains available as the secondary login path.

## E2E authentication

Playwright uses the dedicated Vite `e2e` mode and `.env.e2e`. This bypass is test-only and is not used by `npm run build` or production deployment.
