# Court Legacy V2 Phase 4 — 非同期PvP設計

Date: 2026-08-28
Branch: `feature/court-legacy-v2-phase4-async-pvp`
Base: Phase 3 head `b162cd6fb928d6a8d3ff5f7375a592e48870ce40`

## 1. 目的

Phase 4では、他プレイヤーが育成した高校バレーチームと対戦できる非同期PvPを追加する。

リアルタイム同時接続は要求せず、相手がオフラインでも対戦できることを優先する。既存の高校運営・年度進行・選手育成を壊さず、「何年も育てた学校を他プレイヤーの学校と競わせる」長期的な遊びを作る。

MVPで提供するのは以下。

1. 自分のチームをPvP用に公開する
2. 他プレイヤーの公開チーム一覧を見る
3. 公開チームへ挑戦する
4. サーバー側で試合結果を確定する
5. PvPレーティング・勝敗・連勝を更新する
6. シーズンランキングを見る
7. 自分の対戦履歴を見る

## 2. 非対象

Phase 4 MVPでは以下を実装しない。

- リアルタイム同期対戦
- WebSocket / 常時接続
- フレンド・招待コード対戦
- PvP大会・トーナメント
- チャット・スタンプ
- 観戦
- ギルド / クラン
- PvP専用課金
- 複雑なBAN・通報システム

これらはMVPの利用状況を見て後続Phaseへ分離する。

## 3. 採用方式

### 採用: 公開チームSnapshotに挑戦する非同期PvP

各ユーザーは、自分の現在チームをPvP用Snapshotとして明示的に公開・更新する。

対戦時は以下の2つを使用する。

- Challenger: 対戦開始時点のサーバー権威 `game_saves` から取得した現在チーム
- Defender: 相手が最後に公開した `pvp_team_snapshots` の凍結チーム

Defenderの通常セーブを直接読み込まない。

### 不採用案A: リアルタイムPvP

両プレイヤーの同時接続、切断復旧、ターン同期、タイムアウト、再接続、チート対策が必要になり、現在のゲーム構造に対してコストが大きすぎるため不採用。

### 不採用案B: 相手の現在 `game_saves` を直接参照

相手の内部状態・隠し能力・未公開情報とPvP機能の境界が弱くなり、通常セーブ仕様変更にもPvPが強く依存するため不採用。

## 4. セキュリティ境界

PvPはPhase 2/3と同じくサーバー権威を維持する。

ブラウザから以下を受け取って勝敗計算へ使用してはならない。

- Player abilities
- PlayerTier
- potential
- hidden traits
- growth peak
- injury resistance
- condition/fatigueの任意値
- 学校能力・施設能力の任意値
- TeamSelection本体
- 勝敗
- rating差分
- match seed

ブラウザが送信できるのは識別子と現在revisionのみとする。

対戦要求例:

```ts
{
  operationId: string;
  revision: number;
  opponentSnapshotId: string;
}
```

WorkerがChallengerの現在 `game_saves` とDefenderの公開Snapshotを取得し、試合入力・seed・rating差分をすべてサーバー側で決定する。

SupabaseのPvPテーブルはブラウザから直接read/writeさせない。RLSを有効化し、authenticated/anon権限をrevokeし、service role経由のWorkerのみアクセスする。

## 5. PvP Team Snapshot

### 5.1 Snapshotの役割

`pvp_team_snapshots` は通常セーブのコピーではなく、PvP試合に必要な情報だけを凍結したサーバー専用データとする。

保存対象:

- source user id
- source game revision
- source academic year / year index
- user school
- PvPに必要なユーザー校Player群
- TeamSelection
- 戦術・施設など試合計算に必要な学校状態
- 公開用summary
- publishedAt

公開APIで返すのはsummaryのみ。

### 5.2 公開summary

相手一覧・ランキングに返してよい情報:

- snapshotId
- schoolName
- schoolShortName
- reputation rank
- reputation pointsの大まかな表示またはrank
- team power estimate
- academicYear
- publishedAt
- PvP rating
- wins / losses
- win streak

返してはいけない情報:

- 各選手の正確なabilities
- exact potential
- hidden development fields
- tier
- exact internal tactics weights
- internal player IDs一覧
- 通常ゲームの完全GameState

## 6. ID衝突対策

異なるユーザーのGameStateは、内部の `schoolId` / `playerId` が同名になる可能性がある。

既存 `simulateMatch()` は単一GameState内にhome/away双方のSchool/Playerが存在する前提なので、そのまま2つのGameStateをmergeしてはならない。

PvP試合直前にWorker側で `buildPvpSimulationState()` を作り、双方のIDを試合専用namespaceへ再マップする。

例:

```text
challenger:<userId>:<originalSchoolId>
challenger:<userId>:<originalPlayerId>
defender:<snapshotId>:<originalSchoolId>
defender:<snapshotId>:<originalPlayerId>
```

TeamSelection、tactics内Player参照、School.playerIdsも同じmappingで変換する。

これによりユーザー間のID衝突を完全に排除してから既存 `simulateMatch()` を再利用する。

## 7. 試合計算

既存 `src/domain/match/simulateMatch.ts` を再利用し、PvP専用の別ルールエンジンを作らない。

MVP:

- best of 3
- home = challenger
- away = defender
- server-derived deterministic seed
- operationIdが同じなら同じ結果を返す

seedは少なくとも以下を含むサーバー生成値から構成する。

- challenger user id
- defender snapshot id
- operation id
- server nonceまたは保存済みmatch seed

初回実行時にseedを確定・保存し、duplicate operationは保存済みresponseを返す。

## 8. レーティング

### 8.1 シーズン

PvPシーズンは実時間のJST月単位とする。

例:

```text
2026-08
2026-09
```

Workerが現在時刻から `seasonId` を決定し、ブラウザ入力は信用しない。

### 8.2 初期値

各シーズン開始時のratingは `1000`。

MVPでは前シーズンratingのcarry-overは行わない。

### 8.3 計算

標準Eloを使用する。

```text
expected = 1 / (1 + 10 ^ ((opponentRating - ownRating) / 400))
delta = round(K * (score - expected))
K = 32
```

volleyballではdrawを扱わず、scoreは勝利=1、敗北=0。

ratingは0未満にしない。

### 8.4 更新項目

- rating
- matches
- wins
- losses
- currentWinStreak
- bestWinStreak
- bestRating

Challenger/Defender双方のratingを1試合で原子的に更新する。

Defenderはオフラインでもratingが変動する。

## 9. 二重実行・連打・不正対策

### 必須

- `operationId` はchallenger user単位でunique
- 同じoperationIdは同じ試合responseを返す
- self match禁止
- 存在しないsnapshot禁止
- 非公開/無効snapshot禁止
- stale challenger revisionは409
- rating更新とmatch保存を同一DB transaction/RPCで確定
- ratingだけ更新されmatchが保存されない中間状態を作らない
- ブラウザからrating deltaを受け取らない
- ブラウザからmatch resultを受け取らない

### レーティング乱用防止

MVPでは同じdefenderへのrated challengeをJST 1日3回までとする。

4回目以降は409 `pvp_daily_opponent_limit` とし、Phase 4 MVPではunrated rematchは実装しない。

この制限もDB側のmatch履歴からサーバー判定する。

## 10. DB設計

### 10.1 `pvp_team_snapshots`

1ユーザーにつきactive snapshotは1件。

主要列:

```text
id uuid pk
user_id uuid unique not null
source_revision bigint not null
source_academic_year integer not null
source_year_index integer not null
school_name text not null
school_short_name text not null
reputation_rank text not null
team_power integer not null
snapshot jsonb not null
is_active boolean not null default true
published_at timestamptz not null
updated_at timestamptz not null
```

`snapshot` はservice roleのみ読み書き可能。

### 10.2 `pvp_ratings`

```text
season_id text not null
user_id uuid not null
rating integer not null default 1000
matches integer not null default 0
wins integer not null default 0
losses integer not null default 0
current_win_streak integer not null default 0
best_win_streak integer not null default 0
best_rating integer not null default 1000
updated_at timestamptz not null
primary key (season_id, user_id)
```

### 10.3 `pvp_matches`

```text
id uuid pk
season_id text not null
operation_id text not null
challenger_user_id uuid not null
defender_user_id uuid not null
defender_snapshot_id uuid not null
challenger_source_revision bigint not null
match_seed text not null
challenger_rating_before integer not null
defender_rating_before integer not null
challenger_rating_after integer not null
defender_rating_after integer not null
winner_user_id uuid not null
result jsonb not null
created_at timestamptz not null
unique (challenger_user_id, operation_id)
```

`result` は試合履歴再表示に必要なサーバー確定結果を保持する。

## 11. Store境界

新規 `PvPStore` interfaceを導入し、routeからSupabase実装を直接触らない。

責務:

- publish/upsert team snapshot
- get active snapshot
- list opponent summaries
- get/create current season rating
- execute atomic rated match persistence
- list ranking
- list user match history
- duplicate operation response read

実装:

- `worker/data/PvPStore.ts`
- `worker/data/SupabasePvPStore.ts`

テストではInMemory/Fake Storeを使える設計にする。

## 12. API

### `POST /api/pvp/team/publish`

Request:

```ts
{
  operationId: string;
  revision: number;
}
```

Behavior:

- auth required
- stale revision => 409
- authoritative snapshotからPvP snapshotを作成
-同revision / 同operationはidempotent
- public summaryを返す

### `GET /api/pvp/opponents`

Query:

```text
cursor?
limit?  // max 30
```

Behavior:

- selfを除外
- active snapshotのみ
- 現在season ratingをjoin
- rating差が近い順を基本に返す
- exact hidden dataは返さない

### `POST /api/pvp/challenge`

Request:

```ts
{
  operationId: string;
  revision: number;
  opponentSnapshotId: string;
}
```

Behavior:

1. duplicate operation確認
2. challenger snapshot/revision確認
3. defender active snapshot取得
4. self match拒否
5. daily same-opponent limit確認
6. namespaced simulation state生成
7. `simulateMatch()` 実行
8. Elo計算
9. match + ratingsをatomic保存
10. sanitized resultを返す

### `GET /api/pvp/ranking`

- current JST seasonのみ
- rating desc
- tie-break: wins desc -> matches asc -> user id stable order
- pagination

### `GET /api/pvp/history`

- authenticated user自身がchallengerまたはdefenderのmatchのみ
- newest first
- summaryを返す

## 13. API Client

`GameApiClient`へPvP methodを追加する。

- `publishPvpTeam`
- `getPvpOpponents`
- `challengePvpTeam`
- `getPvpRanking`
- `getPvpHistory`

本番は `HttpGameApiClient`。

E2E browser adapterにはserver-only `PvPStore` / Supabase実装 / hidden opponent Player dataをimportさせない。

E2E用Opponent fixtureは公開summaryと安全なテスト用試合adapterに分離し、本番PvP server moduleをブラウザbundleへ引き込まない。

## 14. UI

既存Bottom Navは5タブのまま維持する。

`試合`画面内に上部segmented controlを追加する。

```text
[ 通常試合 ] [ 対人戦 ]
```

### 対人戦トップ

上から:

1. 自校PvPカード
   - rating
   - W-L
   - streak
   - 公開Snapshot更新日時
   - `対戦チームを更新`

2. 対戦相手
   - 学校名
   - reputation
   - team power
   - rating
   - W-L
   - `挑戦する`

3. ランキング導線

4. 対戦履歴導線

### 試合中/処理中

既存要件どおり、白画面・無反応時間を作らない。

- 即座にoperation status表示
- `対戦データ確認中`
- `試合をシミュレーション中`
- `レーティングを反映中`

実際のネットワーク処理と厳密な段階同期ができない場合でも、少なくとも「処理中」であることを明示する。

### 結果

- 勝敗
- set score
- 各set点数
- 主な試合分析
- rating before -> after
- rating delta
- `対戦相手一覧へ`
- `通常試合へ戻る`

## 15. エラー表示

ユーザー向け日本語メッセージを用意する。

主なcode:

- `pvp_snapshot_required`
- `pvp_snapshot_unavailable`
- `pvp_self_match`
- `pvp_daily_opponent_limit`
- `pvp_revision_conflict`
- `pvp_match_conflict`
- `pvp_persist_failed`

revision conflict時はPhase 3と同様にlatest authoritative game snapshotを再取得し、画面を復旧可能にする。

## 16. TDD / 検証

実装はRED -> GREEN -> verifyの順で進める。

### Domain tests

- Elo expected/delta
- rating floor
- win/loss streak
- ID namespace remap
- merged PvP simulation stateにID collisionがない
- `simulateMatch()`が両チームで正常実行できる
- 同じseedでdeterministic

### Worker tests

- publish accepts only authoritative game state
- forged fields rejected
- stale revision rejected
- self match rejected
- unknown snapshot rejected
- duplicate operation idempotent
- same opponent daily cap
- match + both ratings atomic result
- browser input cannot choose rating delta/result/seed
- history only returns own matches

### Supabase tests

- migration contains RLS/revoke
- browser roles cannot access raw PvP snapshot
- atomic RPC conflict handling
- unique operation constraint

### UI tests

- match screen normal/PvP switch
- opponent public fields only
- loading visible immediately
- challenge result adopts server response
- API error retry
- revision conflict recovery
- ranking/history navigation

### E2E

最低360pxで:

1. PvPタブを開く
2. 公開Snapshot更新
3. opponent list表示
4. opponentへ挑戦
5. 操作中表示確認
6. result表示
7. rating変化確認
8. historyに試合が出る
9. rankingへ移動
10. 通常試合へ戻れる

既存320/360/390/480pxレイアウト監査を維持する。

最終条件:

- `npm run verify` GREEN
- mobile-e2e GREEN
- no server-only PvP truth imports in browser adapter
- existing scouting hidden-info boundary remains GREEN

## 17. 実装順序

1. Rating domain model / Elo tests
2. PvP snapshot model + namespaced simulation builder
3. `PvPStore` interface
4. Supabase migration + atomic match RPC
5. `SupabasePvPStore`
6. publish route
7. opponent list route
8. challenge route
9. ranking/history routes
10. `GameApiClient` PvP contract
11. Match screen PvP UI
12. browser E2E adapter boundary
13. mobile E2E
14. README / PR documentation

## 18. 完了条件

Phase 4 MVPは、別ユーザーの公開チームが1件以上存在する環境で、認証済みユーザーがスマホから相手を選び、サーバー権威で試合を1回完了し、双方のrating・戦績が二重反映なく更新され、ランキングと履歴に反映されるところまでを完成とする。
