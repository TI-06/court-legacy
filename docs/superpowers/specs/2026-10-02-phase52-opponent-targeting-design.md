# Phase52 対戦相手ターゲット指示 設計

更新日: 2026-10-02

## 目的

Phase52では、試合中の監督操作に「相手の誰を狙うか」を追加する。

Phase16で実装済みの以下は維持する。

- タイムアウト
- 戦術変更
- 選手交代
- 自校選手への攻撃集中
- 自校選手への声かけ
- スキップ / 続行

Phase52はこれらに重ねて、相手個人を対象にした一時指示を追加する。

## 新規指示

### サーブで狙う

- 相手コート上の選手から1名を指定。
- 5ラリーだけ有効。
- 指定中はその選手がレシーブ対象になる確率を上げる。
- 永続の `School.tactics.serveTargetPlayerId` は変更しない。
- リベロも指定可。
- 相手選手の非公開能力値はUIへ出さない。

### ブロックで警戒

- 相手コート上の攻撃参加可能選手から1名を指定。
- 5ラリーだけ有効。
- 指定選手が攻撃した場合だけブロック対応へ小さな補正。
- 永続のblock systemは変更しない。
- リベロは指定不可。
- セッターは原則対象外。OH / MB / OP を基本対象とする。

## 指示タイミング

使用可能:

- opponent-run
- mid-set
- critical-score

使用不可:

- set-break

理由:

- 一時指示は5ラリーだけ。
- セット間で設定してもbeginNextSet時に消える構造にしない。
- セット間は既存の戦術変更 / 交代へ集中させる。

## Match runtime

```ts
interface MatchRuntimeState {
  // existing
  attackerFocus?: {
    schoolId: SchoolId;
    playerId: PlayerId;
    ralliesRemaining: number;
  } | null;

  encouragementBoost?: {
    schoolId: SchoolId;
    playerId: PlayerId;
    ralliesRemaining: number;
  } | null;

  // Phase52
  serveTarget?: {
    schoolId: SchoolId;
    playerId: PlayerId;
    ralliesRemaining: number;
  } | null;

  blockTarget?: {
    schoolId: SchoolId;
    playerId: PlayerId;
    ralliesRemaining: number;
  } | null;
}
```

- runtime限定。
- persistent School.tacticsは変更しない。
- set開始時にclear。
- 1ラリーごとに残り回数を減らす。
- activeMatch保存によりreload後も維持。

## MatchCommand

```ts
type MatchCommand =
  | ...
  | { type: "target-serve-receiver"; playerId: PlayerId }
  | { type: "mark-opponent-attacker"; playerId: PlayerId };
```

## Validation

### target-serve-receiver

- opponent school playerであること。
- 現在コート上またはliberoであること。
- injuryなど既存のselection整合性を満たすこと。

### mark-opponent-attacker

- opponent school playerであること。
- 現在rotation内にいること。
- OH / MB / OP のいずれかであること。

不正な対象は明示的にrejectし、activeMatch / randomCursorを変更しない。

## Simulation effect

### Serve target

既存の `chooseReceiver` は永続 `serveTargetPlayerId` を72%で優先している。

Phase52ではmatch runtimeの一時targetを優先する。

- runtime target active: 82%
- runtime targetなし: 永続target 72%
- target不在時: 通常weighted selection

一時targetはpersistent targetより優先する。

### Block target

指定対象が実際にattackerとして選ばれた場合のみ:

- blockPower +6

指定対象以外への攻撃では補正なし。

狙いは「完全封殺」ではなく、警戒の成果が少し出る程度。

## UI

監督指示に `相手を狙う` を追加。

BottomSheet内に2セクション:

### サーブで狙う

- 相手の現在コート上 + libero
- 名前
- ポジション
- 現在コート / liberoの表示
- 能力値やhidden traitは表示しない

### ブロックで警戒

- OH / MB / OP
- 名前
- ポジション
- 能力値は表示しない

ボタン形式にしてnative selectは使わない。

## 表示

試合中の有効指示表示:

- `○○をサーブで狙う 残り4ラリー`
- `○○をブロック警戒 残り3ラリー`

試合結果の監督采配:

- 指示時点score
- 指示名
- その後最大5ラリーのpoint split

「指示が勝因」とは表現しない。

## PvP privacy

- 相手選手の公開identityのみ利用。
- abilities / hidden traits / raw private metricsを表示しない。
- defender側の非公開情報をclientへ追加しない。
- challengerが指定できるのはpublicly visible opponent player idのみ。

## 保存・性能

- activeMatch runtimeに最大2個の小さなtarget objectを追加するだけ。
- career historyには積まない。
- commandHistoryは既存bounded match local履歴。
- save肥大化への影響は無視できるレベルにする。

## 成功条件

1. サーブtargetがfuture ralliesだけに影響する。
2. block targetが指定attackerの攻撃時だけ効く。
3. reload後も残りラリー数を維持する。
4. set終了でclear。
5. persistent tacticsを書き換えない。
6. PvP private dataを追加しない。
7. 既存timeout / tactics / substitution / attack focus / encouragementを壊さない。
