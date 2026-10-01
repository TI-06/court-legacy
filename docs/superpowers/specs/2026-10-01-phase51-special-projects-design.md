# Phase51 特別事業 / エンドゲーム資金用途 設計

更新日: 2026-10-01

## 目的

Phase51では、施設Lv50到達後にも資金を貯める・使う意味を残す。

既存の「年間強化予算」はLv50施設に対応する恒常的な年間投資として維持し、Phase51はその上位レイヤーとして高額・回数制限付きの「特別事業」を追加する。

狙いは、資金を能力値へ直接変換することではなく、強豪との対戦機会、育成環境、怪我対策、特殊能力イベント、情報優位、学校の実績へ変換すること。

## 設計原則

- 施設Lv50はそのまま上限。Lv51以降は作らない。
- 特別事業は1年度につき合計2件まで。
- 同じ事業は同年度に1回まで。
- 事業費は750〜1,800。
- 購入時点で能力値を直接加算しない。
- 年間効果、試合機会、翌週イベント、育成機会として効果を返す。
- 既存の年間強化予算、ショップ、練習試合、特殊能力、公式戦ロジックを再利用する。
- actionはWorker authoritative。ブラウザだけで資金や効果を変更しない。
- セーブ肥大化を避け、年度ごとの状態は定数サイズにする。
- 既存セーブはそのままロード可能にする。

## 既存機能との住み分け

### 年間強化予算

既存の年間強化予算は以下を担当する。

- trainingRoom Lv50: 育成重点
- gym Lv50: 外部専門コーチ
- dormitory Lv50: 強化合宿予算
- scoutingNetwork Lv50: スカウト遠征予算

Phase51ではこれを置き換えない。

### 特別事業

Phase51では、特に既存の年間強化予算で直接使い道を持たない施設を中心にする。

- analysisRoom
- recoveryRoom
- alumniAssociation
- studyRoom

さらに複数Lv50施設と学校実績を条件に、強豪遠征などの上位事業を解禁する。

## 年間ルール

```ts
export type SchoolSpecialProjectId =
  | "national-data-bank"
  | "medical-support"
  | "alumni-development"
  | "academic-support"
  | "elite-expedition"
  | "university-joint-training"
  | "top-team-clinic"
  | "invitational-cup";

export interface SchoolSpecialProjectState {
  yearIndex: number;
  purchasedProjectIds: SchoolSpecialProjectId[];
}
```

- `SchoolManagementState.specialProjects?` として任意追加する。
- `yearIndex !== state.yearIndex` の古い状態は無効扱い。
- 新年度に履歴配列を積み増さず、最初の購入時に現年度の状態へ置換する。
- `purchasedProjectIds.length <= 2`。
- 同一ID重複禁止。
- イベント系事業の予約は既存 `eventMemory.scheduledFollowUps` を利用する。
- 招待大会のみ必要ならboundedなcurrent tournament stateを別途追加する。
- optional field追加で既存save compatibilityを維持し、不要ならschemaVersionは上げない。

## 特別事業一覧

### 1. 全国データバンク

- ID: `national-data-bank`
- 費用: 900
- 解禁: analysisRoom Lv50
- 種別: 年間契約
- 効果:
  - 試合前分析に「主力選手情報」を追加。
  - 相手スタメンのうち主力3名について能力ランク、ポジション、判明している特殊能力を表示。
  - 数値を直接上げない。
- 意図:
  - analysisRoom Lv50は現状すでに分析score上限へ届くため、単なるscore加算ではなく情報量を増やす。

### 2. 専属メディカルサポート

- ID: `medical-support`
- 費用: 1,000
- 解禁: recoveryRoom Lv50
- 種別: 年間契約
- 効果:
  - 通常練習の最終怪我率を70%へ補正。
  - 休養対象選手のcondition回復量を少し強化する。
- 意図:
  - 怪我を完全無効化しない。
  - 高負荷練習、合宿の判断価値は残す。

### 3. OB育成支援プログラム

- ID: `alumni-development`
- 費用: 900
- 解禁: alumniAssociation Lv50
- 種別: 年間契約
- 効果:
  - 1年生・2年生の通常練習成長 +6%。
  - 3年生には適用しない。
- 意図:
  - 即時能力購入ではなく、次世代育成へ資金を使う。
  - 長期プレイの世代交代と相性を持たせる。

### 4. 学習サポート

- ID: `academic-support`
- 費用: 750
- 解禁: studyRoom Lv50
- 種別: 年間契約
- 効果:
  - 学業値30未満の練習倍率50%を75%まで救済。
  - 30〜39の75%、40以上の100%はそのまま。
- 意図:
  - 学業パラメータを無効化せず、最悪ペナルティだけを緩和する。

### 5. 全国強豪遠征

- ID: `elite-expedition`
- 費用: 1,200
- 解禁:
  - analysisRoom Lv50
  - scoutingNetwork Lv50
  - reputationPoints >= 400
- 種別: 特別活動
- 効果:
  - 現在公式戦必須週でなく、練習試合未予約の場合のみ購入可能。
  - national-regular / elite級から、最近対戦していない高戦力校を決定的に選択。
  - 練習試合を確定状態で予約する。
  - 試合経験値、格上補正、特殊能力判定は既存match pathをそのまま使う。
- 意図:
  - 資金を「強い相手と戦える権利」に変換する。

### 6. 大学チーム合同練習

- ID: `university-joint-training`
- 費用: 1,300
- 解禁:
  - gym Lv50
  - trainingRoom Lv50
  - dormitory Lv50
  - reputationPoints >= 620
- 種別: 特別活動
- 効果:
  - 翌週に専用合同練習を予約。
  - 通常の週練習とは別の専用resolutionを使用。
  - 攻撃 / 守備 / フィジカルからテーマを選択。
  - 全体に中程度の育成機会を与えるが、即時購入時には能力を増やさない。
  - 疲労も発生し、無料の上位互換にはしない。
- 意図:
  - 中盤以降の高額なチーム全体育成イベント。

### 7. トップチーム講習

- ID: `top-team-clinic`
- 費用: 1,500
- 解禁:
  - gym Lv50
  - analysisRoom Lv50
  - reputationPoints >= 620
- 種別: 特別活動
- 対象: 選手1名を指定
- 効果:
  - 対象選手を固定した翌週イベントを予約。
  - ポジション/希望分野に応じたNormal特殊能力の取得チャンス。
  - Rare / Super Rareを金で確定取得させない。
- 意図:
  - 主力選手への高額投資だが、結果はイベントとして確率を残す。

### 8. 全国招待大会

- ID: `invitational-cup`
- 費用: 1,800
- 解禁:
  - gym Lv50
  - analysisRoom Lv50
  - reputationPoints >= 850
  - 全国大会優勝1回以上
- 種別: エンドゲーム大会
- 効果:
  - 4校のミニトーナメント。
  - 自校 + national-regular / elite級3校。
  - 準決勝、決勝を既存resumable match engineで実行。
  - 報酬は主に評判・実績・特殊能力機会。
  - 大きな資金還元は行わず、資金sinkとして成立させる。
- 履歴:
  - 必要なら `school.history.invitationalTitles?: number` をoptional追加。
- 意図:
  - 全国優勝後にも挑戦する理由を作る最終エンドコンテンツ。

## UI

学校 > 運営に `特別事業` タブを追加する。

### ヘッダー

- 特別事業
- 年度利用 `0 / 2`
- 現在資金
- 「高額な年間契約・特別活動。年度ごとに2件まで」の短い説明

### カード

カードはスマホで1列を基本にする。

表示項目:

- 事業名
- 費用
- 効果
- 解禁条件
- 状態
  - 利用可能
  - 条件未達
  - 資金不足
  - 今年度実施済み
  - 年度上限2件到達

購入前にbottom sheetで以下を確認する。

- 支出額
- 支出後残高
- 効果
- 年度残り枠
- 対象指定が必要な場合は対象選手

## バランス

### 経済

現行のelite年度予算は1,570。
alumniAssociation Lv50の年度補助は800。
合計2,370が基礎的な高実績校の年度収入目安。

既存年間強化予算4カテゴリを最大構成で買うと最大2,200。

したがってPhase51を750〜1,800、年2件までにすることで、

- 毎年すべてを買えない。
- 既存年間投資との優先順位が生まれる。
- 長期で貯まりすぎた資金を使える。
- 一時的な資金不足もプレイヤー判断として成立する。

### 育成

- 年間型の成長補正は最大でも+6%程度。
- 怪我率は0にしない。
- 学習支援は最悪ペナルティの緩和のみ。
- 特殊能力はNormalの確率取得まで。Rare/Super Rareの確定購入は禁止。
- 招待大会や遠征は既存match経験値を利用し、別の能力値報酬を重ねすぎない。

## 保存・性能

- `specialProjects` は現年度の最大2IDだけ。キャリア年数に比例して増えない。
- 長期履歴は既存fundsHistory/event historyの上限を維持。
- 事業定義は静的カタログに置き、説明文・コスト・条件をセーブしない。
- 事業購入actionで全player cloneを行わない。
- 年間modifierは対象処理の計算時だけ参照する。
- 招待大会stateも1大会分だけのbounded dataにする。
- 10年/30年soakでsave sizeとaction performanceを確認する。

## 成功条件

- Lv50到達後に毎年複数の意味ある資金用途がある。
- 何でも買える状態ではなく選択が必要。
- 「資金 = 能力値購入」にならない。
- 既存年間投資と役割が重複しない。
- 30年プレイでもspecial project stateが肥大化しない。
- 既存セーブを初期化せず利用できる。
