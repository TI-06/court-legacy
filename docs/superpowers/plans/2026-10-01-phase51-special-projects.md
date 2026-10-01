# Phase51 Special Projects / Endgame Funds Implementation Plan

> Taskごとに独立レビューし、PRを小さく保つ。通常CIを無駄に何度も走らせず、focused test → PR CI → main CIの順で確認する。

**Goal:** 施設Lv50後に、能力値の直接購入ではない高額な資金用途を追加し、長期プレイで資金・施設・実績が再びゲーム上の意思決定になる状態を作る。

**Architecture:** 既存の年間強化予算は維持し、新規 `schoolSpecialProjects` domainを追加する。年度利用履歴は `SchoolManagementState` に最大2IDだけ保持し、イベント予約は既存 `eventMemory.scheduledFollowUps`、遠征は既存practice-match path、試合は既存resumable match engineを再利用する。

**Spec:** `docs/superpowers/specs/2026-10-01-phase51-special-projects-design.md`

## Global Constraints

- 施設上限はLv50のまま。
- 特別事業は年2件まで。
- 同一事業は年1回。
- 既存の年間強化予算は変更しない。
- 特殊能力Rare/Super Rareを資金で確定取得させない。
- save stateはキャリア年数に比例して増やさない。
- 既存セーブ互換を維持する。
- Worker authoritative actionにする。
- mobile-first。横スクロールを作らない。
- Phase50で確定した特殊能力取得率・Super Rare cooldownを壊さない。

---

## PR51-1: 特別事業 Foundation / 契約 / UI骨格

### Task 1: Domain contract

**Create**

- `src/domain/school/schoolSpecialProjects.ts`
- `tests/unit/domain/school/schoolSpecialProjects.test.ts`

**Modify**

- `src/domain/model/SchoolManagement.ts`
- `src/domain/school/schoolEconomy.ts`

**実装**

- `SchoolSpecialProjectId`
- `SchoolSpecialProjectState`
- 静的project definition catalog
- 年2件制限
- 同一年度重複禁止
- 施設/評判/実績unlock評価
- 資金不足判定
- `FundsLedgerKind = "special-project"`
- 購入時の一括debit

**Acceptance**

- 既存saveで `specialProjects === undefined` でも正常。
- 新年度は過年度stateをinactiveとして扱う。
- 2件購入後は3件目を拒否。
- 同一事業2回目を拒否。
- 不足資金ではstateを変更しない。

### Task 2: Authoritative action

**Modify**

- `worker/game/actionSchema.ts`
- `worker/game/applyGameAction.ts`
- `tests/unit/worker/applyGameAction.test.ts`

**Action**

```ts
{
  type: "school-special-project";
  projectId: SchoolSpecialProjectId;
  targetPlayerId?: PlayerId;
  option?: string;
}
```

**Acceptance**

- Worker側で再評価してから購入。
- UIから送ったcostを信用しない。
- 不正project ID / target / optionをreject。
- operation replay/idempotencyは既存game action pathをそのまま利用。

### Task 3: School UI skeleton

**Modify**

- `src/features/school/SchoolScreen.tsx`
- `src/features/school/school-economy.css`
- `src/app/GameApp.tsx`
- `tests/unit/features/school/SchoolScreen.test.tsx`

**UI**

- 運営 > 特別事業 tab
- 年度利用 0/2
- 年間契約 / 特別活動の2セクション
- 1列カード中心
- bottom sheet確認
- 費用、支出後残高、条件、年度残枠を表示

**PR51-1 scope**

最初は購入契約と表示まで。効果はPR51-2/3で個別接続する。

---

## PR51-2: Lv50年間プロジェクト4種

### Task 1: 全国データバンク

**Modify**

- `src/features/match/opponentAnalysis.ts`
- pre-match analysis UI
- focused tests

**Behavior**

- analysisRoom Lv50 + project activeで主力3名の追加情報を表示。
- raw numerical hidden statsではなく能力rank/position/known special abilities。
- match simulation数値自体は変更しない。

### Task 2: 専属メディカルサポート

**Modify**

- `src/domain/training/resolveWeeklyTraining.ts`
- 必要ならrest recovery helper
- focused injury tests

**Behavior**

- 最終training injury risk x0.70。
- 0%にはしない。
- rest時condition recoveryを小幅加算。

### Task 3: OB育成支援

**Modify**

- `src/domain/school/schoolSpecialProjects.ts`
- `worker/game/applyGameAction.ts` training modifier assembly
- training tests

**Behavior**

- grade1/2の通常training +6%。
- grade3対象外。
- camp/match growthへ無条件に重複させない。

### Task 4: 学習サポート

**Modify**

- `src/domain/training/calculateGrowth.ts`
- growth tests

**Behavior**

- academic <30 の50%制限を75%へ。
- academic 30〜39 = 75%を維持。
- academic >=40 = 100%を維持。

### PR51-2 regression

- training focused tests
- opponent analysis tests
- 1-season deterministic comparison
- Phase50 special ability focused tests

---

## PR51-3: 高額な体験型プロジェクト3種

### Task 1: 全国強豪遠征

**Modify**

- `src/domain/weekly/practiceMatchScheduling.ts`
- `src/domain/school/schoolSpecialProjects.ts`
- Worker action tests
- Practice UI tests

**Behavior**

- official match必須週は購入不可。
- 練習試合予約済みなら購入不可。
- national-regular / eliteから高戦力かつ直近対戦を避けて1校選択。
- accepted practice matchとしてschedule。
- 実際の試合処理は既存resumable practice matchを完全再利用。

### Task 2: 大学チーム合同練習

**Create**

- one-shot special training resolver
- result presentation type/test

**Behavior**

- 購入時は予約のみ。
- 翌週に攻撃/守備/フィジカルを選択して実施。
- 全体に中程度growth opportunity。
- fatigueも発生。
- regular weekly trainingを置き換えず、効果量で上位互換化しすぎない。

### Task 3: トップチーム講習

**Create**

- `src/data/events/phase51-top-team-clinic.json` など必要最小限のevent data
- event schema/data tests

**Behavior**

- 購入時にtargetPlayerIdを指定。
- `eventMemory.scheduledFollowUps` へ翌週eventを予約。
- actorPlayerIdsは指定選手を固定。
- Normal特殊能力の確率取得。
- Rare/Super Rareの直接付与は禁止。

### PR51-3 regression

- reload/save後も予約活動が維持される。
- target卒業/不在時は安全にcancelまたはfallback。
- activeMatchや週進行をロックしない。
- save payloadの増加がbounded。

---

## PR51-4: 全国招待大会

### Task 1: Invitational domain

**Create**

- bounded invitational tournament state
- 4校選出
- semifinal/final progression
- focused domain tests

**Selection**

- user school + high reputation CPU 3校
- 同一校重複なし
- national representative / rival balance dataを再利用
- guest opponent生成が必要なら既存materializeGuestOpponentを再利用

### Task 2: Resumable match integration

**Modify**

- `worker/game/applyGameAction.ts`
- match presentation/router
- related tests

**Behavior**

- semifinal/finalとも既存startMatch/resumeMatch/match-commandを利用。
- official tournament stateは汚さない。
- activeMatch recoveryと競合しない。
- reload後も同じ招待大会を再開できる。

### Task 3: Result / legacy

**Modify**

- `SchoolHistorySummary` optional field if needed
- result UI

**Rewards**

- reputation
- match experience
- existing match special ability判定
- invitational title count
- 大額のfunds rewardは付けない。

---

## PR51-5: Long-run balance / performance / polish

### Task 1: Soak policy extension

**Modify**

- `src/dev/soak/runBalanceSoak.ts`
- soak metrics/tests

**Policy**

- Lv50解禁後、reserveを守りつつ年最大2事業を選択。
- 年間投資と特別事業の両方を実際に使う。
- 高額資金sinkが30年で機能するか確認。

### Task 2: Balance metrics

確認対象:

- zeroFundWeeks
- final funds / yearly min / yearly max
- special project purchase count
- special project type distribution
- user strength vs national p90
- Normal/Rare/Super Rare acquisition flow
- injury count
- facility milestone
- save JSON size

### Target

- management policy起因のpersistent zero fundsなし。
- 高資金seedで特別事業が実際に購入される。
- 30年後に数万〜数十万の未使用資金が常態化しない。
- user strengthがnational p90 +10を恒常的に超えない。
- Super Rare頻度がPhase50の範囲から暴走しない。
- save sizeが特別事業履歴に比例して増えない。

### Task 3: Mobile / E2E

- 390px以下で横スクロールなし。
- 8事業を一覧しても縦カードが崩れない。
- bottom sheetの確定ボタンがfooterに隠れない。
- locked / insufficient / completed / cap reachedの状態が判別可能。

### Task 4: Final gates

1. focused domain/worker/UI tests
2. typecheck + format
3. 10-season x2 seed
4. 30-season x4 seed
5. full `npm run verify`
6. PR CI
7. squash merge
8. main CI

## 推奨実装順

1. PR51-1 Foundation
2. PR51-2 年間4事業
3. PR51-3 遠征/合同練習/講習
4. PR51-4 招待大会
5. PR51-5 長期バランス

PR51-4は最も大きいため、PR51-1〜3を先に完全GREENにしてから着手する。
