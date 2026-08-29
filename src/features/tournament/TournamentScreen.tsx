import { useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import {
  selectNextOfficialEvent,
  selectTournamentStageView,
  type TournamentBracketMatchView,
} from "../../domain/tournament/tournamentSelectors";
import type {
  TournamentCircuit,
  TournamentLevel,
  TournamentRound,
} from "../../domain/tournament/tournamentTypes";
import { BottomSheet } from "../../ui/BottomSheet";
import "../../ui/ui.css";
import "./tournament.css";

interface TournamentScreenProps {
  state: GameState;
  circuit: TournamentCircuit;
  level: TournamentLevel;
  trainingCompleted: boolean;
  pending: boolean;
  onStartOfficialMatch: () => void;
  onBack: () => void;
}

const circuitLabels: Record<TournamentCircuit, string> = {
  interhigh: "インターハイ",
  "spring-high": "春高",
};

const levelLabels: Record<TournamentLevel, string> = {
  prefectural: "県大会",
  national: "全国大会",
};

const roundLabels: Record<TournamentRound, string> = {
  "round-of-16": "1回戦",
  quarterfinal: "準々決勝",
  semifinal: "準決勝",
  final: "決勝",
};

const roundOrder: readonly TournamentRound[] = [
  "round-of-16",
  "quarterfinal",
  "semifinal",
  "final",
];

function statusLabel(status: string): string {
  if (status === "due") return "今週";
  if (status === "eliminated") return "敗退";
  if (status === "champion") return "優勝";
  if (status === "completed") return "終了";
  return "進行中";
}

function entrantName(
  entrant: TournamentBracketMatchView["home"],
): string {
  return entrant?.shortName ?? "未定";
}

function scoreLabel(match: TournamentBracketMatchView): string | null {
  if (match.homeSetsWon === null || match.awaySetsWon === null) {
    return null;
  }
  return `${match.homeSetsWon} - ${match.awaySetsWon}`;
}

export function TournamentScreen({
  state,
  circuit,
  level,
  trainingCompleted,
  pending,
  onStartOfficialMatch,
  onBack,
}: TournamentScreenProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const stage = selectTournamentStageView(state, circuit, level);
  const nextOfficial = selectNextOfficialEvent(state);

  if (!stage) {
    return (
      <main className="app-content tournament-screen">
        <section className="tournament-empty" role="status">
          <strong>大会情報を読み込んでいます…</strong>
          <p>組み合わせが確定すると、ここに大会表が表示されます。</p>
          <button onClick={onBack} type="button">
            試合メニューへ戻る
          </button>
        </section>
      </main>
    );
  }

  const nextMatch =
    nextOfficial?.kind === "match" &&
    nextOfficial.circuit === circuit &&
    nextOfficial.level === level
      ? nextOfficial
      : null;
  const due = nextMatch?.timing === "due";
  const canStart =
    due &&
    trainingCompleted &&
    !pending &&
    stage.status !== "eliminated" &&
    stage.status !== "champion";
  const terminal = stage.status === "eliminated" || stage.status === "champion";

  const requestStart = () => {
    if (!canStart) return;
    if (!state.settings.confirmBeforeOfficialMatch) {
      onStartOfficialMatch();
      return;
    }
    setConfirmationOpen(true);
  };

  const confirmStart = () => {
    if (!canStart) return;
    setConfirmationOpen(false);
    onStartOfficialMatch();
  };

  const timingLabel = nextMatch
    ? nextMatch.timing === "due"
      ? "今週"
      : `あと${nextMatch.weeksUntil}週`
    : statusLabel(stage.status);
  const roundLabel = nextMatch
    ? roundLabels[nextMatch.round]
    : stage.userBestRound
      ? roundLabels[stage.userBestRound]
      : roundLabels["round-of-16"];

  return (
    <main className="app-content tournament-screen">
      <section className="tournament-hero" aria-labelledby="tournament-heading">
        <button className="tournament-back" onClick={onBack} type="button">
          試合メニューへ戻る
        </button>
        <div className="tournament-hero__heading">
          <div>
            <p className="section-kicker">OFFICIAL TOURNAMENT</p>
            <h2 id="tournament-heading">
              {circuitLabels[circuit]} {levelLabels[level]}
            </h2>
          </div>
          <span className={`tournament-status tournament-status--${stage.status}`}>
            {timingLabel}
          </span>
        </div>
        <div className="tournament-next-card">
          <div>
            <span>現在</span>
            <strong>{roundLabel}</strong>
          </div>
          {nextMatch ? (
            <div>
              <span>次戦</span>
              <strong>{nextMatch.opponent.displayName}</strong>
            </div>
          ) : stage.champion ? (
            <div>
              <span>優勝校</span>
              <strong>{stage.champion.displayName}</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="tournament-panel" aria-labelledby="bracket-heading">
        <div className="tournament-section-heading">
          <div>
            <p className="section-kicker">BRACKET</p>
            <h3 id="bracket-heading">大会表</h3>
          </div>
          <span>16校</span>
        </div>
        <div
          className="tournament-bracket-scroll"
          data-testid="tournament-bracket-scroll"
        >
          <div className="tournament-bracket">
            {roundOrder.map((round) => {
              const matches = stage.matches.filter(
                (match) => match.round === round,
              );
              return (
                <section className="tournament-round" key={round}>
                  <h4>
                    {roundLabels[round]}
                    <small>{matches.length}試合</small>
                  </h4>
                  <div className="tournament-round__matches">
                    {matches.map((match) => {
                      const score = scoreLabel(match);
                      return (
                        <article
                          className={`tournament-match-card${
                            match.userInMatch
                              ? " tournament-match-card--user"
                              : ""
                          }`}
                          data-testid="tournament-bracket-match"
                          key={match.id}
                        >
                          {match.userInMatch ? (
                            <span
                              className="tournament-user-marker"
                              data-testid="tournament-user-path"
                            >
                              自校
                            </span>
                          ) : null}
                          <div>
                            <span>{entrantName(match.home)}</span>
                            {score ? <b>{match.homeSetsWon}</b> : null}
                          </div>
                          <div>
                            <span>{entrantName(match.away)}</span>
                            {score ? <b>{match.awaySetsWon}</b> : null}
                          </div>
                          {score ? (
                            <small className="tournament-match-score">
                              {score}
                            </small>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>

      {terminal ? (
        <section className={`tournament-terminal tournament-terminal--${stage.status}`}>
          <span>{stage.status === "champion" ? "優勝" : "敗退"}</span>
          <strong>
            {stage.status === "champion"
              ? `${circuitLabels[circuit]} ${levelLabels[level]}を制覇しました`
              : `${roundLabel}で大会を終えました`}
          </strong>
        </section>
      ) : nextMatch ? (
        <section className="tournament-action" aria-labelledby="official-action-heading">
          <div>
            <p className="section-kicker">NEXT MATCH</p>
            <h3 id="official-action-heading">公式戦</h3>
            <strong>{nextMatch.opponent.displayName}</strong>
            <span>{timingLabel}</span>
          </div>
          {!trainingCompleted && due ? (
            <p className="tournament-training-note">
              今週の練習を完了すると開始できます
            </p>
          ) : null}
          {pending ? (
            <p className="tournament-pending" role="status">
              公式戦を開始しています…
            </p>
          ) : null}
          <button
            className="tournament-start-button"
            disabled={!canStart}
            onClick={requestStart}
            type="button"
          >
            {pending ? "公式戦を開始しています…" : "公式戦を開始"}
          </button>
        </section>
      ) : null}

      <BottomSheet
        description="この試合はサーバー側で対戦相手と結果を確定します。"
        onClose={() => setConfirmationOpen(false)}
        open={confirmationOpen}
        title="公式戦を開始しますか"
      >
        <div className="tournament-confirmation">
          <strong>{nextMatch?.opponent.displayName ?? "対戦相手"}</strong>
          <p>編成と今週の練習内容を確認してから開始してください。</p>
          <button
            className="primary-action"
            disabled={!canStart}
            onClick={confirmStart}
            type="button"
          >
            この試合を開始
          </button>
        </div>
      </BottomSheet>
    </main>
  );
}
