# Court Legacy / 継承のコート

男子高校バレー部の監督として、選手の入学・育成・大会・卒業を何年でも繰り返すスマートフォン特化型シミュレーションゲームです。

## Development status

- Milestone: V2 Phase 6 server-authoritative official tournaments
- Runtime: React + TypeScript + Vite
- API/runtime: Cloudflare Workers
- Authentication/database: Supabase Auth + PostgreSQL
- Repository: `TI-06/court-legacy`

Phase 2では、学校評判 E〜SS、選手Tierと長期個体差、評判・実績・設備・監督能力に連動するスカウト確率、不完全情報の候補レポート、サーバー権威の候補保存・獲得・年度入学までを年度進行へ統合しています。

Phase 4では、育成したチームを凍結スナップショットとして公開し、他プレイヤーの公開チームへ非同期で挑戦できるレーティング対人戦を追加しています。試合生成、Elo更新、同一相手の日次回数制限、operation IDによる冪等性、ランキング・履歴の永続化はWorker / PostgreSQL側が権威を持ちます。

Phase 5では、「その他 → ショップ」に年度制のテスト用アイテムショップを追加しています。購入・使用回数、所持数、対象検証、効果値、GameStateやスカウト情報への反映、operation ID冪等性はWorker / PostgreSQL側が権威を持ち、ブラウザは公開ステータスと安全な使用対象だけを送受信します。

Phase 6では、インターハイと春高について県大会→全国大会の公式大会ループを追加しています。ユーザー公式戦は既存の本試合シミュレータを使用し、NPC同士は長期運用向けの軽量な決定論的resolverで進行します。対戦相手、組み合わせ、試合seed、勝敗、学校実績、選手実績、優勝・全国出場判定はWorker側が権威を持ち、ブラウザの公式戦actionは `{ type: "official-match" }` のみです。

## Official tournament schedule

1学年年度は4月1日開始として、公式大会は次の週に進行します。

| 大会 | レベル | 1回戦 | 準々決勝 | 準決勝 | 決勝 |
| --- | --- | ---: | ---: | ---: | ---: |
| インターハイ | 県大会 | 9 | 10 | 11 | 12 |
| インターハイ | 全国大会 | 16 | 17 | 18 | 19 |
| 春高 | 県大会 | 30 | 31 | 32 | 33 |
| 春高 | 全国大会 | 41 | 42 | 43 | 44 |

県大会は現在の16校ワールドを使用します。全国大会は県大会優勝校1校と、年度・大会・slotから決定論的に生成される15校の地域代表guestで構成します。guestは大会内の公開アイデンティティだけを保持し、詳細ロスターはユーザーが対戦する時だけWorker内で一時生成します。guest学校・選手は永続`schools` / `players`には追加しません。

ユーザーが敗退してもセーブデータや年度進行は終了しません。その大会のユーザー必須試合だけが終了し、NPC側のブラケットは自動進行して次の大会・次年度へ継続します。

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

Apply the V2 migrations to the Supabase project in order before using cloud saves, scouting, PvP, or the Phase 5 shop:

1. `supabase/migrations/202608260001_v2_foundation.sql`
2. `supabase/migrations/202608260002_game_operations.sql`
3. `supabase/migrations/202608270003_scouting_candidate_pools.sql`
4. `supabase/migrations/202608280004_async_pvp.sql`
5. `supabase/migrations/202608280005_pvp_history_perspective.sql`
6. `supabase/migrations/202608280006_shop_mvp.sql`

Phase 6 does not add a new Supabase table migration. The serialized `GameState` schema advances from version 2 to version 3 and migrates Phase 5 saves by adding current-year `officialSeason`, canonical bounded `history.officialTournaments`, and guest-safe historical display snapshots without rerolling the existing world or advancing `randomCursor`.

The Phase 1 schema keeps game state behind the Worker, enables RLS on all game tables, does not grant direct browser table access, and applies game mutations with revision checks and operation-id idempotency.

The Phase 2 scouting migration stores the authoritative candidate pool separately from `GameState`. Exact ability values, potential, hidden traits, and other candidate truth are readable only through the Worker/service role. Browser roles have no direct table privileges. Recruitment commits candidate IDs only; the Worker resolves those IDs against the server-side candidate pool when the academic year changes and then enrolls the selected players as new first-years.

Recruitment capacity is checked before a commitment is persisted, including reserving the extra roster slot when a scheduled generational talent may arrive. This prevents a valid scouting action from creating an impossible April rollover.

### Async PvP authority and privacy

`202608280004_async_pvp.sql` adds append-only published team snapshots, seasonal ratings, rated match history, operation idempotency, and atomic rating/match persistence. `202608280005_pvp_history_perspective.sql` normalizes history for both challenger and defender views without inventing a challenger snapshot ID. Rating updates for both users and the match record are committed through the server-side persistence boundary rather than separate browser writes.

The browser may receive only PvP presentation data such as school name, school short name, reputation rank, published team power, rating, wins/losses, streak, sanitized set scores, ranking, and the authenticated user's match history. Exact player abilities, potential, player tier, hidden traits, growth peak, injury resistance, exact tactic weights, frozen opponent players, and full opponent `GameState` remain Worker-only.

PvP requests also cannot choose the active season or determine a match result. The Worker derives the current JST season, validates the challenger revision and active defender snapshot, creates the deterministic match input/seed, enforces the same-opponent daily limit, and persists the canonical result. Reusing the same challenge `operationId` returns the stored result instead of applying the rating twice.

### Phase 5 shop authority and payments

`202608280006_shop_mvp.sql` adds the enabled shop catalog, yearly inventory/counters, purchase/use history, and operation ledger. Shop tables and mutation procedures are service-role boundaries: the browser does not write inventory, counters, effect values, scouting truth, or transaction rows directly.

Shop purchase/use requests carry a fresh `operationId`, the current game revision, an item ID, and only the safe target discriminator required by that item. Prices, annual limits, target class, effect constants, scouting precision changes, player mutations, and the next-training boost are resolved on the trusted side. Unknown network results may retry the same operation ID; a successful replay returns the stored result rather than granting or applying the item twice.

Phase 5 is **not a real-payment implementation**. Every current item is fixed at `¥0`, no card/wallet/payment-provider flow is connected, and the `shop_transactions` table records only the zero-yen test grant. Real-money billing must be designed as a separate phase with provider-side verification before any paid item can exist.

Transient shop metadata is not part of published PvP snapshots. Inventory, yearly counters, shop operation history, scouting insights, and `shopEffects` remain outside public PvP DTOs; only permanent player changes already committed to the base player state may influence a later PvP snapshot.

### Phase 6 tournament authority and persistence

Official tournament state is server-authoritative. The browser cannot choose an opponent, bracket position, round, match seed, score, championship, qualification, record increment, or reputation outcome. A due official match must follow the shared operation ledger and revision check; ambiguous network/server results retry the exact same operation request so the match cannot be applied twice.

Current-year detailed bracket state lives in `GameState.officialSeason`. Historical stage summaries are appended to bounded `history.officialTournaments`. Match history stores immutable display-name snapshots when a transient national guest is involved, so old results remain readable without adding guest schools or players to the persistent world.

Persistent world schools still receive authoritative official wins/losses when they play a transient guest in an NPC-only national match. This is intentionally handled separately from rivalry updates because a guest has no permanent school identity.

Tournament counters feed the existing annual school-reputation resolver. Prefectural titles, national appearances, national titles, and official wins/losses therefore influence future reputation and downstream scouting quality without introducing a second tournament-only reputation system.

### Deployment order

For a Phase 6 deployment, keep the saved-state migration and Worker authority compatible before exposing the tournament UI:

1. Apply all existing Supabase migrations through `202608280006_shop_mvp.sql`.
2. Confirm the Worker has `SUPABASE_URL` and the elevated `SUPABASE_SECRET_KEY` secret.
3. Deploy the Worker containing schema-v3 migration, tournament progression, official-match action, guest materialization, and authoritative record/stat handling.
4. Run `npm run verify` and `npm run test:e2e` against the release candidate.
5. Deploy the browser build with the Home/Match tournament entry and mobile bracket UI only after the Worker is compatible with schema v3.

Configure the intended sign-in providers in Supabase Auth. Google is the primary OAuth provider; email authentication remains available as the secondary login path.

## Long-run verification

The unit suite includes deterministic 30-year and bounded 100-year world simulations. Phase 2 also exercises 30 consecutive recruiting cycles to verify that annual candidate generation, enrollment, graduation, recruiting-state reset, and user-school roster bounds continue to work across generations.

Phase 4 adds deterministic high-volume Elo verification to ensure ratings never become negative, wins/losses remain consistent with match counts, win streaks remain bounded, and repeated operation IDs are tallied only once in the stress ledger. Worker route/store tests separately verify real challenge replay idempotency and atomic persistence behavior.

Phase 5 adds shop rule/store/route coverage for annual limits, revision conflicts, operation replay, rollback behavior, safe target validation, server-owned effects, year rollover, and PvP leakage regression. Mobile E2E covers the zero-yen purchase/use flow, retry/revision recovery, scouting research/appraisal, one-shot training boost behavior, and supported narrow viewport widths.

Phase 6 adds a separate official-tournament soak. The 30-year run verifies deterministic completion of both Interhigh and Spring High every year and compares canonical tournament history plus school official records across identical seeds. The 100-year run verifies bounded tournament history, bounded match history, current-year-only detailed bracket state, no stuck user-required stage, and zero persistent guest school/player IDs. Security regressions also verify that server-only guest materialization/result authority is not imported into browser dependency assembly and that tournament/guest/shop transient state is not included in published PvP snapshots.

Official-tournament mobile E2E covers 320/360/390/480px body overflow safety, internal bracket scrolling, the weekly training gate, visible authoritative processing states, committed result persistence/reload, elimination continuity, and national guest presentation without a persistent guest roster.

## E2E authentication

Playwright uses the dedicated Vite `e2e` mode and `.env.e2e`. This bypass is test-only and is not used by `npm run build` or production deployment.
