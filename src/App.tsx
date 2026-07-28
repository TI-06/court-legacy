type IconName = "home" | "team" | "training" | "match" | "school" | "calendar" | "arrow";

interface IconProps {
  name: IconName;
}

function Icon({ name }: IconProps) {
  const paths: Record<IconName, string> = {
    home: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z",
    team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    training: "M6.5 6.5h11v11h-11zM3 9v6M21 9v6M9 3h6M9 21h6",
    match: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Zm10 2h3v2a4 4 0 0 1-4 4M7 6H4v2a4 4 0 0 0 4 4",
    school: "m3 10 9-6 9 6-9 6-9-6Zm3 4v5h12v-5M9 19v-4h6v4",
    calendar: "M6 2v4M18 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v15H3V6a2 2 0 0 1 2-2Z",
    arrow: "m9 18 6-6-6-6",
  };

  return (
    <svg aria-hidden="true" className="icon" fill="none" viewBox="0 0 24 24">
      <path d={paths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

const navigationItems: Array<{ label: string; icon: IconName }> = [
  { label: "ホーム", icon: "home" },
  { label: "チーム", icon: "team" },
  { label: "育成", icon: "training" },
  { label: "試合", icon: "match" },
  { label: "学校", icon: "school" },
];

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">COURT LEGACY</p>
          <h1>継承のコート</h1>
        </div>
        <button aria-label="予定を確認" className="header-action" type="button">
          <Icon name="calendar" />
        </button>
      </header>

      <main className="app-content">
        <section className="season-card" aria-labelledby="season-heading">
          <div className="season-card__top">
            <div>
              <p className="section-kicker">1年目</p>
              <h2 id="season-heading">4月 第1週</h2>
            </div>
            <span className="status-badge">新チーム始動</span>
          </div>
          <div className="next-match">
            <div>
              <span>次の練習試合</span>
              <strong>青凪高校</strong>
            </div>
            <div className="countdown">
              <strong>3</strong>
              <span>週間後</span>
            </div>
          </div>
        </section>

        <section className="metric-grid" aria-label="チーム状況">
          <article className="metric-card">
            <span>チーム評価</span>
            <strong>C</strong>
            <small>県内 12位</small>
          </article>
          <article className="metric-card">
            <span>平均疲労</span>
            <strong>18</strong>
            <small>良好</small>
          </article>
          <article className="metric-card">
            <span>部員</span>
            <strong>12</strong>
            <small>3年生 4人</small>
          </article>
        </section>

        <section className="focus-card" aria-labelledby="focus-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">今週の判断</p>
              <h2 id="focus-heading">練習方針を決める</h2>
            </div>
            <span className="required-label">必須</span>
          </div>
          <p>新入生を確認して、最初のチーム練習と個人指示を設定します。</p>
          <button className="primary-action" type="button">
            今週の方針を設定
            <Icon name="arrow" />
          </button>
        </section>

        <section className="issues" aria-labelledby="issues-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">監督レポート</p>
              <h2 id="issues-heading">現在の課題</h2>
            </div>
            <button className="text-action" type="button">
              詳細
            </button>
          </div>
          <div className="issue-list">
            <article>
              <span className="issue-dot" />
              <div>
                <strong>セッター候補が定まっていません</strong>
                <p>2人の適性を練習で確認しましょう。</p>
              </div>
            </article>
            <article>
              <span className="issue-dot issue-dot--warning" />
              <div>
                <strong>サーブレシーブが不安定です</strong>
                <p>次戦までに守備連携を上げる必要があります。</p>
              </div>
            </article>
          </div>
        </section>
      </main>

      <nav aria-label="主要メニュー" className="bottom-navigation">
        {navigationItems.map((item, index) => (
          <button className={index === 0 ? "nav-item nav-item--active" : "nav-item"} key={item.label} type="button">
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
