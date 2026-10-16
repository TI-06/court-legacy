# 運営管理画面（Phase68）

## 起動

ゲームの公開URLに `?admin=1` を追加すると、通常ゲームとは別のPC向け管理ログイン画面を表示します。

- 管理者ID（初期設定）: `admin`
- 初期パスワード（指定値）: `admintest`
- URLパラメータは表示切替だけです。認証情報やログイン済みの扱いはURLで渡しません。
- 管理者情報はゲームユーザーのSupabase認証と独立しています。

## 公開画面

- 管理画面: https://court-legacy.utiltoools.workers.dev/?admin=1
- 公開API: https://court-legacy.utiltoools.workers.dev/api/health
- 通常ゲーム画面は変更せず、URL末尾の `?admin=1` の場合だけ管理ログイン画面に切り替えます。

## 初回設定（デプロイ担当者）

1. Supabaseに `supabase/migrations/202610170001_admin_dashboard.sql` を適用します（**適用済み**）。
2. [Cloudflareダッシュボード](https://dash.cloudflare.com/)で **Workers & Pages → court-legacy → Settings → Variables and Secrets** を開きます。
3. 下記2項目を **Secret（暗号化されたシークレット）** タイプで追加します。通常のPlaintext変数には登録しないでください。

   | 変数名                 | 値                             | 登録方法 |
   | ---------------------- | ------------------------------ | -------- |
   | `ADMIN_PASSWORD`       | テスト時のみ指定値 `admintest` | Secret   |
   | `ADMIN_SESSION_SECRET` | 32文字以上のランダム文字列     | Secret   |

4. `ADMIN_SESSION_SECRET` はWindowsでも `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` で生成できます。ここで生成した値はGitHubやチャットに貼らず、Cloudflareだけに登録します。
5. **Deploy** でシークレットを反映します（main の最新コードも公開済みか確認）。
6. ローカルPCで `npm run admin:check` を実行し、3つの検査がすべて「正常」であることを確認します。
7. 管理画面URLを開いてログインし、件数が表示されることを確認します。

GitHubの `main` は既存のCloudflare Git連携によって自動ビルド・デプロイされる構成です。コード反映と**シークレット登録は別の作業**です。

**公開運用前に必ず `admintest` を長く予測しにくいパスワードへ変更してください。** この組み合わせはテスト用としてのみ使用してください。

### 公開確認コマンド

```bash
npm run admin:check
# 別環境を確認する場合
npm run admin:check -- https://example.workers.dev
```

このチェックはGETリクエストのみ使用し、パスワードの送信・ログイン試行・ユーザーデータ変更を一切しません。

| 終了コード | 意味                                              |
| ---------- | ------------------------------------------------- |
| 0          | 公開Worker、管理API、未認証アクセス制御が正常     |
| 1          | Worker未応答・予期しないレスポンス                |
| 2          | 管理APIは配信済みだが、Cloudflare Secretsが未設定 |
| 3          | 管理APIが公開されていない（古いデプロイ等）       |

## 管理画面の見方

- **ダッシュボード**: 登録数、ゲーム作成数、最近のセーブ更新、保存中の試合記録、PvP対戦、アイテム使用、登録・操作日別チャート、地域、人気アイテム
- **アカウント一覧**: ID / メール / 学校 / 監督 / 地域 / 登録・最終ログイン / 最終セーブ / リビジョン / 経過年数 / 保存済み試合、検索と25件ずつのページ送り
- **プレイ・対戦分析**: セーブ更新7日・30日、平均/最大進行年数、試合記録、PvP公開数、ランキング参加人数、保管中の操作数
- **アイテム分析**: 購入・使用・過去30日使用、使用上位10種類

## 数字の意味と制約

- アカウント数は Supabase Auth の `auth.users` を母数にしています。ゲーム作成前のアカウントも含みます。
- 「7日/30日以内のセーブ更新」は最新のセーブ時刻によるユーザー数であり、厳密なDAU/MAUやログイン回数ではありません。
- ゲーム操作の件数は `game_operations` の**現時点で保持されている履歴**を対象にします。運用中に古い操作履歴が削除されるため累積値ではありません。
- 「保存済み試合記録」は現在保存されている `history.matches` の合計です。履歴の保存件数上限によって過去の全試合を含まない場合があります。
- アカウントのメールなど個人情報を含むため、管理APIはサーバー側で認証検証し、ブラウザの通常Supabaseクライアントから管理テーブルへアクセスできません。

## 安全対策

- パスワードと署名鍵はCloudflare Worker secretsで管理。JavaScriptバンドル・Gitに埋め込みません。
- HttpOnly + SameSite=Strict + HTTPS時Secureの2時間有効署名Cookie。Cookie改ざん・期限切れは拒否します。
- ログインはSame-Originチェック、IP単位で15分あたり5回まで（DB原子的更新）です。
- 管理側は集計・閲覧のみ。ユーザーのセーブ更新や削除のAPIは実装しません。
- ダッシュボードAPIレスポンスは `Cache-Control: no-store`。セッションはログアウトでCookie失効します。
