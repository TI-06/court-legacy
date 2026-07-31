# 全面UI・選手アート刷新 実装進捗

- Plan: `docs/superpowers/plans/2026-07-31-full-game-ui-refresh.md`
- Branch: `feature/m6-game-ui-refresh`

## Task 1: 決定論的な選手アートレシピ

- Status: complete
- Recipe RED: `91fb0ec3fd7fe4d45f255355c7bf8cd14e2f425f`
- Recipe RED result: missing `playerArtRecipe` module
- Seed signature RED: `c5258458f04c2d045ac7b628784a999bb66c6898`
- Seed signature RED result: missing `seedAppearanceSignature` export
- GREEN: `4342bffaa7ee8181019789ac833f726a7083c4ef`
- Verification: formatting, lint, typecheck, unit tests, build, mobile E2E passed
- Review: specification compliant; no blocking quality findings

## Task 2: WebPパーツカタログと静的マニフェスト

- Status: complete with visual-quality follow-up
- Manifest and catalog: `a036375a8660fe148a477566b8c74c19b933cb2c`
- Binary WebP atlas recovery: `58ea4dfadd3a5020f4143cbe9de8f1952df2d40f`
- GREEN verification: `42f9249bc49def6daf66cbad09fbf4f1a8497e4b`
- Verification: formatting, lint, typecheck, unit tests, build, mobile E2E passed
- Review: deterministic layer resolution, school colors, tier effects, and WebP integrity are covered
- Follow-up: current atlas is an implementation-grade provisional catalog; approved anime-quality parts must replace it before final visual acceptance

## Task 3: アセットロードキャッシュと一般選手レイヤー描画

- Status: complete
- RED: `c7d7c0ff306aa4071c13b8880bb69b24c146055f`
- RED result: missing `assetLoadCache` and `GeneratedPlayerArt` modules
- GREEN: `47608e6f374c3746074c7c5ad52f88ad66077b07`
- Verification: formatting, lint, typecheck, unit tests, build, mobile E2E passed
- Review: duplicate requests are cached; failed or unsupported raster assets keep the complete character hidden; no player SVG fallback is produced

## Task 4: 主要4名の専用アート

- Status: pending
