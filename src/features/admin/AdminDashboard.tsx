import { useEffect, useState, type FormEvent } from "react";
import "./admin-dashboard.css";

interface Overview {
  generatedAt: string;
  accounts: { total: number; today: number; new7d: number; new30d: number };
  games: {
    onboarded: number;
    saveUpdated7d: number;
    saveUpdated30d: number;
    averageRevision: number;
    highestRevision: number;
    averageYear: number;
    highestYear: number;
    recordedMatches: number;
    currentPlayers: number;
  };
  activity: { retainedOperations: number; operations7d: number; operations30d: number };
  pvp: { matches: number; activePublishedTeams: number; ratedPlayers: number };
  shop: { purchases: number; uses: number; uses30d: number };
  regions: { name: string; count: number }[];
  daily: { date: string; registrations: number; operations: number }[];
  topItems: { name: string; count: number }[];
}

interface AdminAccount {
  id: string;
  email: string | null;
  loginId: string | null;
  coachName: string | null;
  schoolName: string | null;
  regionId: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  saveUpdatedAt: string | null;
  revision: number | null;
  yearIndex: number | null;
  matches: number;
}

interface AccountsResponse {
  total: number;
  rows: AdminAccount[];
}

type View = "summary" | "accounts" | "play" | "shop";
type LoginState = "checking" | "signed-out" | "signed-in";

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json()) as T & { error?: { message: string } };
  if (!response.ok) {
    const error = new Error(body.error?.message ?? "情報を取得できませんでした");
    if (response.status === 401) error.name = "Unauthorized";
    throw error;
  }
  return body;
}

function numeric(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString("ja-JP") : "—";
}

function datetime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function Metric({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <article className="admin-metric">
      <span>{label}</span>
      <strong>{numeric(value)}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

function DailyChart({ daily }: { daily: Overview["daily"] }) {
  const max = Math.max(1, ...daily.map((day) => Math.max(day.registrations, day.operations)));
  return (
    <div className="admin-chart" aria-label="直近30日間の新規登録と保管中の操作記録">
      {daily.map((day) => (
        <div
          className="admin-chart__day"
          key={day.date}
          title={`${day.date}　新規登録 ${day.registrations}件 / 操作記録 ${day.operations}件`}
        >
          <div className="admin-chart__bars">
            <span
              className="admin-chart__bar admin-chart__bar--users"
              style={{ height: `${(day.registrations / max) * 100}%` }}
            />
            <span
              className="admin-chart__bar admin-chart__bar--actions"
              style={{ height: `${(day.operations / max) * 100}%` }}
            />
          </div>
          <small>{day.date.slice(8)}</small>
        </div>
      ))}
    </div>
  );
}

function Ranking({ entries, empty }: { entries: { name: string; count: number }[]; empty: string }) {
  const highest = Math.max(1, ...entries.map((entry) => entry.count));
  if (!entries.length) return <p className="admin-empty">{empty}</p>;
  return (
    <div className="admin-ranking">
      {entries.map((entry, index) => (
        <div className="admin-ranking__row" key={`${entry.name}-${index}`}>
          <div className="admin-ranking__caption">
            <span>{entry.name}</span>
            <strong>{numeric(entry.count)}</strong>
          </div>
          <div className="admin-ranking__track">
            <div style={{ width: `${(entry.count / highest) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminDashboard() {
  const [loginState, setLoginState] = useState<LoginState>("checking");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("summary");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountsResponse | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    let active = true;
    void adminFetch<{ authenticated: boolean }>("/api/admin/session")
      .then((result) => {
        if (active) setLoginState(result.authenticated ? "signed-in" : "signed-out");
      })
      .catch((cause: unknown) => {
        if (active) {
          setLoginState("signed-out");
          setError(cause instanceof Error ? cause.message : "管理画面を開けませんでした");
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loginState !== "signed-in") return;
    const abort = new AbortController();
    setOverviewLoading(true);
    void adminFetch<Overview>("/api/admin/overview", { signal: abort.signal })
      .then((result) => { if (!abort.signal.aborted) setOverview(result); })
      .catch((cause: unknown) => {
        if (abort.signal.aborted) return;
        if (cause instanceof Error && cause.name === "Unauthorized") setLoginState("signed-out");
        setError(cause instanceof Error ? cause.message : "集計に失敗しました");
      })
      .finally(() => { if (!abort.signal.aborted) setOverviewLoading(false); });
    return () => abort.abort();
  }, [loginState]);

  useEffect(() => {
    if (loginState !== "signed-in") return;
    const abort = new AbortController();
    setAccountsLoading(true);
    const params = new URLSearchParams({ search, offset: String(offset) });
    void adminFetch<AccountsResponse>(`/api/admin/accounts?${params.toString()}`, { signal: abort.signal })
      .then((result) => { if (!abort.signal.aborted) setAccounts(result); })
      .catch((cause: unknown) => {
        if (abort.signal.aborted) return;
        if (cause instanceof Error && cause.name === "Unauthorized") setLoginState("signed-out");
        setError(cause instanceof Error ? cause.message : "一覧を取得できません");
      })
      .finally(() => { if (!abort.signal.aborted) setAccountsLoading(false); });
    return () => abort.abort();
  }, [loginState, search, offset]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (signingIn) return;
    setError(null);
    setSigningIn(true);
    try {
      await adminFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setPassword("");
      setLoginState("signed-in");
      setView("summary");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ログインできませんでした");
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    try { await adminFetch("/api/admin/logout", { method: "POST" }); }
    catch { /* The local view closes even if the network is unavailable. */ }
    setOverview(null);
    setAccounts(null);
    setPassword("");
    setLoginState("signed-out");
  };

  const refresh = () => {
    setError(null);
    setOverviewLoading(true);
    void adminFetch<Overview>("/api/admin/overview")
      .then(setOverview)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "更新できませんでした"))
      .finally(() => setOverviewLoading(false));
  };

  if (loginState !== "signed-in") {
    return (
      <main className="admin-login">
        <form className="admin-login__card" onSubmit={(event) => void login(event)}>
          <span className="admin-eyebrow">COURT LEGACY / ADMIN</span>
          <h1>管理画面</h1>
          <p>管理者アカウントでログイン</p>
          {loginState === "checking" ? (
            <p role="status">認証を確認中…</p>
          ) : (
            <>
              <label htmlFor="admin-username">管理者ID</label>
              <input
                autoComplete="username"
                id="admin-username"
                onChange={(event) => setUsername(event.target.value)}
                required
                value={username}
              />
              <label htmlFor="admin-password">パスワード</label>
              <input
                autoComplete="current-password"
                id="admin-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              {error ? <p className="admin-error" role="alert">{error}</p> : null}
              <button disabled={signingIn} type="submit">
                {signingIn ? "確認中…" : "ログイン"}
              </button>
            </>
          )}
          <a href="/">ゲームへ戻る</a>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <span className="admin-eyebrow">COURT LEGACY</span>
          <strong>運営管理</strong>
          <small>ADMIN CONSOLE</small>
        </div>
        <nav aria-label="管理メニュー">
          {([
            ["summary", "ダッシュボード"],
            ["accounts", "アカウント一覧"],
            ["play", "プレイ・対戦分析"],
            ["shop", "アイテム分析"],
          ] as const).map(([id, label]) => (
            <button
              aria-current={view === id ? "page" : undefined}
              key={id}
              onClick={() => setView(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar__bottom">
          <a href="/">ゲームへ戻る ↗</a>
          <button onClick={() => void logout()} type="button">ログアウト</button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">OPERATIONS / OVERVIEW</span>
            <h1>{({
              summary: "ダッシュボード",
              accounts: "アカウント一覧",
              play: "プレイ・対戦分析",
              shop: "アイテム分析",
            } as const)[view]}</h1>
            <p>{overview ? `最終集計 ${datetime(overview.generatedAt)}` : "データを取得しています"}</p>
          </div>
          <button disabled={overviewLoading} onClick={refresh} type="button">
            {overviewLoading ? "更新中…" : "データ更新"}
          </button>
        </header>

        {error ? <p className="admin-error" role="alert">{error}</p> : null}

        {!overview ? (
          <section className="admin-panel" role="status">
            {overviewLoading ? "集計データを読み込んでいます…" : "集計データを取得できませんでした"}
          </section>
        ) : (
          <>
            {view === "summary" ? (
              <>
                <div className="admin-metrics">
                  <Metric label="登録アカウント" value={overview.accounts.total} note="全登録ユーザー" />
                  <Metric label="ゲーム開始済み" value={overview.games.onboarded} note="セーブデータあり" />
                  <Metric label="7日以内のセーブ更新" value={overview.games.saveUpdated7d} note="最新セーブ日時で判定" />
                  <Metric label="30日以内の新規登録" value={overview.accounts.new30d} />
                  <Metric label="保存済み試合記録" value={overview.games.recordedMatches} note="現在のセーブ内の試合数" />
                  <Metric label="PvP対戦総数" value={overview.pvp.matches} />
                  <Metric label="アイテム使用数" value={overview.shop.uses} />
                  <Metric label="最高到達年数" value={overview.games.highestYear} />
                </div>

                <section className="admin-panel">
                  <div className="admin-panel__heading">
                    <h2>登録・操作の推移</h2>
                    <span>直近30日 / 日別</span>
                  </div>
                  <div className="admin-legend">
                    <span className="admin-legend__users">新規登録</span>
                    <span className="admin-legend__actions">操作記録（保存中）</span>
                  </div>
                  <DailyChart daily={overview.daily} />
                  <p className="admin-note">操作記録は保存期間により削除されるため、過去の累計操作数ではありません。</p>
                </section>

                <div className="admin-two-columns">
                  <section className="admin-panel">
                    <div className="admin-panel__heading"><h2>地域別の登録校</h2></div>
                    <Ranking entries={overview.regions} empty="学校データはまだありません" />
                  </section>
                  <section className="admin-panel">
                    <div className="admin-panel__heading"><h2>使用アイテム TOP10</h2></div>
                    <Ranking entries={overview.topItems} empty="使用履歴はまだありません" />
                  </section>
                </div>
              </>
            ) : null}

            {view === "accounts" ? (
              <section className="admin-panel">
                <div className="admin-panel__heading">
                  <h2>登録アカウント</h2>
                  <strong>{numeric(accounts?.total)} 件</strong>
                </div>
                <form className="admin-search" onSubmit={(event) => {
                  event.preventDefault();
                  setOffset(0);
                  setSearch(searchText.trim());
                }}>
                  <input
                    aria-label="アカウントを検索"
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="ログインID・メール・学校名で検索"
                    value={searchText}
                  />
                  <button type="submit">検索</button>
                  <button type="button" onClick={() => { setSearchText(""); setSearch(""); setOffset(0); }}>クリア</button>
                </form>
                <div className="admin-table-scroller">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ログインID</th><th>メールアドレス</th><th>学校 / 監督</th>
                        <th>地域</th><th>登録日時</th><th>最終ログイン</th>
                        <th>最終セーブ</th><th>更新回数</th><th>年数</th><th>試合記録</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(accounts?.rows ?? []).map((account) => (
                        <tr key={account.id}>
                          <td><strong>{account.loginId ?? "—"}</strong></td>
                          <td>{account.email ?? "—"}</td>
                          <td>{account.schoolName ?? "未作成"}<small>{account.coachName ?? ""}</small></td>
                          <td>{account.regionId ?? "—"}</td>
                          <td>{datetime(account.createdAt)}</td>
                          <td>{datetime(account.lastSignInAt)}</td>
                          <td>{datetime(account.saveUpdatedAt)}</td>
                          <td>{numeric(account.revision)}</td>
                          <td>{numeric(account.yearIndex)}</td>
                          <td>{numeric(account.matches)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {accountsLoading ? <p role="status">アカウントを読み込み中…</p> : null}
                  {!accountsLoading && accounts?.rows.length === 0 ? <p className="admin-empty">該当するアカウントはありません</p> : null}
                </div>
                <div className="admin-pagination">
                  <span>{numeric(accounts?.total)} 件中 {accounts?.total ? offset + 1 : 0}–{Math.min(offset + pageSize, accounts?.total ?? 0)} 件</span>
                  <button disabled={accountsLoading || offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))} type="button">前へ</button>
                  <button disabled={accountsLoading || offset + pageSize >= (accounts?.total ?? 0)} onClick={() => setOffset(offset + pageSize)} type="button">次へ</button>
                </div>
              </section>
            ) : null}

            {view === "play" ? (
              <>
                <div className="admin-metrics">
                  <Metric label="7日以内のセーブ更新" value={overview.games.saveUpdated7d} />
                  <Metric label="30日以内のセーブ更新" value={overview.games.saveUpdated30d} />
                  <Metric label="セーブ平均リビジョン" value={overview.games.averageRevision} />
                  <Metric label="最大リビジョン" value={overview.games.highestRevision} />
                  <Metric label="平均到達年数" value={overview.games.averageYear} />
                  <Metric label="最高到達年数" value={overview.games.highestYear} />
                  <Metric label="現在の選手データ数" value={overview.games.currentPlayers} />
                  <Metric label="保存済み試合記録" value={overview.games.recordedMatches} />
                  <Metric label="PvP公開中チーム" value={overview.pvp.activePublishedTeams} />
                  <Metric label="PvPレーティング保有者" value={overview.pvp.ratedPlayers} />
                  <Metric label="PvP対戦総数" value={overview.pvp.matches} />
                  <Metric label="保管中のゲーム操作" value={overview.activity.retainedOperations} />
                  <Metric label="7日以内の操作記録" value={overview.activity.operations7d} />
                  <Metric label="30日以内の操作記録" value={overview.activity.operations30d} />
                </div>
                <p className="admin-note">利用人数は最終セーブ更新日時ベースです。ログイン人数・実際のDAU/MAUとは異なります。</p>
              </>
            ) : null}

            {view === "shop" ? (
              <>
                <div className="admin-metrics">
                  <Metric label="アイテム購入数" value={overview.shop.purchases} />
                  <Metric label="アイテム使用数" value={overview.shop.uses} />
                  <Metric label="直近30日の使用" value={overview.shop.uses30d} />
                </div>
                <section className="admin-panel">
                  <div className="admin-panel__heading"><h2>アイテム使用ランキング</h2></div>
                  <Ranking entries={overview.topItems} empty="アイテムの使用履歴はありません" />
                </section>
              </>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
