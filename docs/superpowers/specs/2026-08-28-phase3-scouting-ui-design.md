# Court Legacy V2 Phase 3 Scouting UI Design

## Goal

Phase 2で完成したサーバー権威のスカウト候補生成・獲得処理を、スマートフォンで実際に操作できるゲームUIへ接続する。

## Scope

このspecはPhase 3全体ではなく、最初の独立サブプロジェクト「スカウトUI」だけを対象とする。大会進行、年間ホーム再設計、演出強化は別planで扱う。

## Navigation

- 下部ナビゲーションは `ホーム / 選手 / 育成 / 試合 / その他` の5タブを維持する。
- `育成` 画面上部に「新入生スカウト」への明確な導線を置く。
- `ホーム` に当年度のスカウト状況を短く表示する導線を追加できる構造にするが、最初の実装では育成画面からの導線を必須とする。
- スカウト画面は `GameApp` 内の専用viewとして表示し、戻る操作で育成へ戻れる。

## Public scouting data

ブラウザへ表示してよい情報は `ScoutReport` のみ。

- candidateId
- displayName
- heightCm
- position
- handedness
- middleSchoolAchievement
- evaluationStars
- estimatedOverall
- estimatedPotential
- confidence
- comments

以下の真値をブラウザ向けレスポンスへ追加しない。

- PlayerTier
- abilitiesの正確値
- potentialの正確値
- trainingEfficiency
- matchConsistency
- bigMatch
- injuryResistance
- leadership
- teamAdaptation
- growthPeakGrade
- hidden trait truth

## API client

`GameApiClient` に以下を追加する。

```ts
export interface ScoutingBoardResponse {
  operationId: string;
  revision: number;
  cycleKey: string;
  reports: ScoutReport[];
}

export interface ScoutingRecruitmentResponse extends PersistedOperationResponse {
  outcome: {
    candidateId: PlayerId;
    committedCandidateIds: PlayerId[];
    cycleKey: string;
  };
}
```

公開メソッド:

```ts
getScoutingBoard(
  accessToken: string,
  request: { operationId: string; revision: number },
  signal?: AbortSignal,
): Promise<ScoutingBoardResponse>;

commitRecruit(
  accessToken: string,
  request: { operationId: string; revision: number; candidateId: PlayerId },
  signal?: AbortSignal,
): Promise<ScoutingRecruitmentResponse>;
```

送信先:

- `POST /api/scouting/board`
- `POST /api/scouting/recruitment`

## UI states

スカウト画面は白画面や無反応を作らない。

- 初期読込: `候補を調査しています…`
- 獲得処理中: `入学交渉を進めています…`
- 読込失敗: エラーメッセージ + `再試行`
- 獲得失敗: candidate card付近または画面上部に理由を表示
- revision conflict: 最新snapshotを再取得して候補を再読込できる状態にする
- capacity reached: `翌年度の選手枠が上限に達しています` をそのまま明示する

## Scouting screen

画面上部:

- タイトル `新入生スカウト`
- 学校評判グレード
- スカウト網Lv
- 監督観察力
- 当年度獲得人数
- 戻るボタン

候補一覧:

- 6候補を縦カードで表示
- 名前、ポジション、身長、利き手、中学実績
- ★1〜5
- 現在能力推定レンジ
- 将来性推定レンジ
- confidenceを `調査精度 低 / 中 / 高` として表示
- 2件のスカウトコメント
- `獲得候補にする` ボタン
- committedCandidateIdsに含まれる候補は `獲得済み` として非活性

候補カードをタップした際はBottomSheetで同じ公開情報を読みやすく拡大表示してよい。最初の実装ではカード内情報だけで判断可能にし、BottomSheetは必須ではない。

## State ownership

- authoritative game snapshotは既存 `useGameSession` が保持する。
- スカウト候補レポートはGameStateへ保存せず、ScoutingScreen用の一時UI stateとする。
- recruitment成功時はレスポンスに含まれる更新済み `game` で既存snapshotを置換する。
- 候補真値は引き続きScoutingStoreだけに存在する。

## Error handling

- ネットワークエラーは安全な日本語メッセージを表示する。
- 409 revision conflictではbootstrapで最新snapshotを取得した後、ユーザーに再試行可能な状態を提供する。
- 409 `candidate_already_committed` は獲得済み状態へ同期する。
- 409 `recruitment_capacity_reached` は定員到達として明示する。
- 不明な500系では `処理に失敗しました。もう一度お試しください` とし、生の例外文字列を表示しない。

## Mobile requirements

- 360px幅でも横スクロールなし。
- 主操作ボタンのタップ領域は最低44px相当。
- 読込中でもGamePageFrameは残し、現在どの画面にいるか分かる。
- operation中の候補ボタン連打を防止する。

## Testing

- API client unit test: path/body/Bearer token/typed error
- ScoutingScreen unit test: 6候補表示、公開情報、獲得済み、loading/error/retry
- GameApp integration test: 育成→スカウト遷移、獲得成功後snapshot更新
- Mobile E2E: スカウト導線が360px相当で操作可能、横溢れなし
- `npm run verify` と mobile E2Eを最終ゲートとする。
