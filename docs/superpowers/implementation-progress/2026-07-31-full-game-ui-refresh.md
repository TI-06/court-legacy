# 全面UI・選手アート刷新 実装進捗

- Current plan: `docs/superpowers/plans/2026-08-05-general-player-modular-art.md`
- Branch: `fix/player-art-rendering`
- Pull request: `#28`
- Issue: `#29`

## Task 1: 決定論的な選手アートレシピ

- Status: complete
- `PlayerArtRecipe.catalogVersion = 2`
- 既存の`appearanceSeed`と選手IDから描画専用`variationSalt`を導出
- 保存スキーマを変更せず、同一選手の外見を再現
- 同一チーム内の近似外見を決定論的に抑制

## Task 2: 外見カタログの拡張

- Status: complete
- 顔型4種
- 前髪8種
- 後ろ髪6種
- 目6種
- 眉5種
- 口5種
- 肌色5段階
- 体格4種
- ポーズ4種
- 状態表情を4描画系統へ対応

## Task 3: 独立WebPパーツカタログ

- Status: complete
- 一般選手専用の11アトラスを追加
- 体格、肌、顔陰影、後ろ髪、前髪、目、眉、口、ユニフォーム、装飾、演出を独立化
- 256×384pxタイル、4倍解像度描画、Lanczos縮小
- 寸法、透明背景、空タイル、端切れを自動検証

## Task 4: 独立レイヤー描画

- Status: complete
- `GeneratedPlayerArt`をv2独立レイヤーへ変更
- カード、詳細、編成で同一レシピを共有
- 必須画像の全読込後だけ人物を表示
- 読込失敗時は画像全体を非表示
- SVG・汎用シルエットへのフォールバックなし

## Task 5: 回帰テスト

- Status: implementation complete; final visual gate pending
- 同一seedの決定論的生成
- 異なる外見パーツの独立差分
- 同一チーム内の近似重複抑制
- 画像読込失敗時の全体非表示
- 10年間の年度更新・新入生生成
- 選手一覧、詳細、編成のレシピ共有

## Verification

反映コミット: `46023a26f791447ad1cc09a5be900e5cc89c6e3a`

- Modular WebP generation: PASS
- Modular WebP asset verification: PASS
- Formatting: PASS
- Lint: PASS
- Type check: PASS
- Unit tests: PASS（60 files / 229 tests）
- Production build: PASS
- Standard mobile E2E: running on the latest user-origin commit
- 390px actual-screen review: pending screenshot artifact

## Remaining gate

- 標準CIのmobile E2Eを通過させる
- 390pxの選手一覧・詳細・編成スクリーンショットをレビューする
- Issue #29の受け入れ基準とPR #28を最終更新する
