# Phase63 — スマホ長時間操作の描画・メモリ基準

## 目的

単発のホーム描画テストに加えて、**同一セッションで画面を繰り返し切り替えた際の性能悪化**を検出する。
既存の試合・週送りの機能テストおよび Phase18/57 の年間soakは残し、ここではブラウザUIの長時間反復を独立して扱う。

## 実行

```bash
npx playwright test tests/e2e/phase63-mobile-long-session.spec.ts --project=mobile-chromium --workers=1
```

通常の `npm run test:e2e` にも含まれる。320×568と430×932は各40回、390×844は150回の画面遷移（5タブ×8/30周）。
初回は全5画面を事前表示して、遅延ロードをメモリ増加と誤認しない。測定後はホーム画面へ戻る。

## 記録内容

- **操作応答**：クリックのキャプチャからナビゲーションの `aria-current` 更新までの時間。中央値・p95
- **描画間隔**：前後各45フレームの `requestAnimationFrame` 間隔p95。参考値のみ
- **メモリ**：Chromium CDPでGC実行後の `JSHeapUsedSize`。初期値、終了値、差
- **DOM**：CDPの `Nodes / Documents / JSEventListeners` の前後比較
- **長タスク**：PerformanceObserverの `longtask` 件数・累積時間（サポート時）
- **状態**：JavaScript例外、横はみ出し、実行中の無限アニメーション

Playwrightの `mobile-long-session.json` 添付と `headless-long-session` annotation に値を保存する。

## 判定

テスト失敗条件は、操作完了の欠落、例外、横はみ出し、無限アニメーション、明確なメモリ・DOM・イベントリスナー増加、または操作応答p95が1,500ms以上の場合。
ヒープ増加は32MiBまたは初期ヒープの60%の大きい方まで、DOMノードは初期値の30%+400まで許容する。
これはCIの安定性を考慮した**大きな退行の検出線**であり、十分な実機性能を保証する目標値ではない。

## 限界・次段階

- ヘッドレスChromiumのメモリとフレーム間隔は実スマホのFPS・RAM消費量とは異なる。
- 今回は画面切替で継続的なUI更新を検査する。週送り・実試合の進行処理は既存の試合E2Eと年次soakで別に検証する。
- 実機（低価格Androidを含む）で30分〜1時間プレイし、フレームp95、入力遅延、メモリ増加、画面のカクつきを確認して予算を調整する。
