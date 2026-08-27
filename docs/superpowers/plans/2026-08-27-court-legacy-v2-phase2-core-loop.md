# Court Legacy V2 Phase 2 Core Loop Implementation Plan

**Goal:** 学校評判・選手バリエーション・スカウト・新入生獲得を年度進行へ統合し、何十年でも「結果→評判→候補変化→世代交代」が循環するV2の長期運営ループを完成させる。

## Phase 2 task order

1. 学校評判 E〜SS
2. 選手Tier・長期個体差
3. 評判連動のスカウト確率モデル
4. 不完全情報のスカウト候補ボード
5. サーバー権威のスカウト操作
6. 新入生獲得
7. 年度進行への統合
8. 長期シミュレーション・モバイルE2E検証

## Global constraints

- 舞台は高校男子バレーで、原則3年間在籍する。
- 毎年度3年生が卒業し、新1年生が入学する。
- 学校・監督・歴代記録は継続し、年数上限を設けない。
- 学校評判、実績、設備、監督能力などがスカウトへ影響する。
- 天才・怪物クラスは強豪校でも確定出現させない。
- 重要なゲーム更新はWorker経由でサーバー権威とする。
- 非同期操作は必ず即時状態を表示し、白画面・無反応を作らない。
- `npm run verify` と mobile E2E を常にGREENに保つ。

## Task 1: Reputation engine and E–SS presentation

- `reputationPoints` を評判の正本とする。
- 表示グレードは `E | D | C | B | A | S | SS`。
- シーズン実績から0〜100の評価を作る。
- 直近5年評価と長期評判を合成する。
- 評判ポイントは0〜1400に制限する。
- 年度更新時に全校の評判を確定する。
- 既存の `School.reputation` は互換ラベルとして維持する。
- 旧ライバル校専用評判更新との二重更新を禁止する。

## Completed Phase 2 scope

- Player Tierを `normal | promising | elite | generational | monster` を中心に拡張し、既存互換の `prospect` を維持した。
- potential、training efficiency、試合安定度、大舞台適性、怪我耐性、リーダーシップ、チーム適応、成長ピーク学年を選手個体差として追加した。
- 学校評判、直近成績、監督能力、スカウト網、寮などから候補Tier確率を決定するモデルを追加した。
- スカウト画面向け公開レポートでは推定レンジだけを返し、正確な能力、potential、hidden traits等の真値を公開しない。
- 候補の真値は `scouting_candidate_pools` に保存し、browser rolesの直接アクセスを禁止した。
- 候補獲得はcandidate IDだけをGameStateへコミットし、revisionとoperation IDによる競合・重複防止を維持した。
- 翌年度ロスターの受入可能人数を獲得時に検証し、天才選手発生予定年は追加1枠を予約する。
- 年度更新時のみWorkerが候補IDをサーバー側真値へ解決し、新1年生として登録する。通常週はScoutingStoreを参照しない。
- 年度更新後は前年のrecruiting状態をクリアし、新しいスカウトサイクルへ移行する。
- 30年間の採用込み長期soakと100年間のworld soakで、世代交代、ロスター上限、評判値、履歴上限を検証する。
