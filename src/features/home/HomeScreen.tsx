import type { GameState } from "../../domain/model/GameState";

interface HomeScreenProps {
  state: GameState;
  onOpenTraining: () => void;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function HomeScreen({ state, onOpenTraining }: HomeScreenProps) {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }

  const players = school.playerIds
    .map((playerId) => state.players[playerId])
    .filter((player) => Boolean(player));
  const averageFatigue = average(players.map((player) => player!.fatigue));
  const injuredCount = players.filter((player) => player?.injury).length;

  return (
    <main className="app-content">
      <section className="season-card" aria-labelledby="season-heading">
        <div className="season-card__top">
          <div>
            <p className="section-kicker">{state.yearIndex}年目</p>
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
          <span>学校評判</span>
          <strong>{school.reputationPoints}</strong>
          <small>{school.reputation}</small>
        </article>
        <article className="metric-card">
          <span>平均疲労</span>
          <strong>{averageFatigue}</strong>
          <small>{injuredCount > 0 ? `怪我 ${injuredCount}人` : "全員参加可"}</small>
        </article>
        <article className="metric-card">
          <span>部員</span>
          <strong>{players.length}</strong>
          <small>3年生 {players.filter((player) => player?.grade === 3).length}人</small>
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
        <p>チーム練習を1件、異なる選手への個人指示を2件設定します。</p>
        <button className="primary-action" onClick={onOpenTraining} type="button">
          今週の方針を設定
          <span aria-hidden="true">›</span>
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
  );
}
