# キャラクターアート品質レビュー

## 結論

主要4選手は専用WebPを継続利用する。一般選手・新入生・ライバル校選手は、固定キャラクターの完成絵を縮小・色替えする方式から、一般選手専用の独立WebPパーツを決定論的に合成する方式へ移行した。

`appearanceSeed`と選手IDから同一人物の外見を再現しながら、同一チーム内で外見パーツの組み合わせが重複した場合は、保存データを変更せずに描画用の`variationSalt`で衝突を回避する。

## 実装対象

- `src/assets/player-parts/v2/**`
- `scripts/generate_general_player_modular_atlases.py`
- `scripts/verify_general_player_modular_atlases.py`
- `src/domain/appearance/playerAppearance.ts`
- `src/domain/appearance/playerArtRecipe.ts`
- `src/domain/appearance/playerArtDiversity.ts`
- `src/ui/player-art/generatedArtManifest.ts`
- `src/ui/player-art/GeneratedPlayerArt.tsx`
- 選手一覧、選手詳細、編成画面

## 独立パーツ構成

一般選手は次の透過WebPアトラスを個別レイヤーとして合成する。

- 体格・ポーズ
- 肌・顔型
- 顔の陰影
- 後ろ髪
- 前髪
- 目
- 眉
- 口
- ユニフォーム本体・差し色
- 装飾
- レアリティ演出

外見カタログは、顔型4種、前髪8種、後ろ髪6種、目6種、眉5種、口5種、肌色5段階、体格4種、ポーズ4種を持つ。表情はゲーム内状態を、通常・集中・喜び・悔しさの描画系統へ対応させる。

## 描画仕様

- `PlayerArtRecipe.catalogVersion`は`2`とする。
- 選手一覧・詳細・編成は同じ重複抑制済みレシピを共有する。
- 学校色、ユニフォーム柄、背番号は選手・学校データから描画する。
- 固定4名は専用WebPを優先する。
- 一般選手画像にSVGや汎用シルエットを使用しない。
- 必須アトラスが1つでも読み込めない場合は、壊れた中間状態や別人物を表示せず画像全体を非表示にする。
- 選手能力、試合、育成、年度更新、セーブスキーマは変更しない。

## アセット品質検証

生成スクリプトは256×384pxを1タイルとして、4倍解像度で線・陰影を描画し、Lanczosで縮小して透過WebPを出力する。

検証スクリプトは次を自動確認する。

- 必須11アトラスの存在
- アトラス寸法とタイル数
- RGBA・透明背景
- 必須タイルの空画像防止
- 安全マージン外への描画と端切れ防止

## 検証結果

反映コミット`46023a26f791447ad1cc09a5be900e5cc89c6e3a`で次を確認した。

- 11種類の独立WebPアトラス生成: PASS
- アトラス寸法・透明度・空タイル・端切れ検証: PASS
- format: PASS
- lint: PASS
- typecheck: PASS
- unit tests: PASS（60ファイル・229件）
- production build: PASS

モバイルE2E、320 / 360 / 390 / 480pxレイアウト監査、390px実画面レビューは標準CIとスクリーンショット確認で最終判定する。
