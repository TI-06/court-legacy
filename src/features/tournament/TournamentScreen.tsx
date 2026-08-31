import { useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import {
  selectNextOfficialEvent,
  selectTournamentStageView,
} from "../../domain/tournament/tournamentSelectors";
import type {
  TournamentCircuit,
  TournamentLevel,
  TournamentRound,
} from "../../domain/tournament/tournamentTypes";
import { BottomSheet } from "../../ui/BottomSheet";
import "../../ui/ui.css";
import { TournamentMatchRow } from "./TournamentMatchRow";
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
  if (status === "upcoming") return "開催前";
  return "進行中";
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
  const stage = selectTournamentStageView(state, circuit, level);
  const nextOfficial = selectNextOfficialEvent(state);
  const initialRound: TournamentRound =
    nextOfficial?.kind === "match" &&
    nextOfficial.circuit === circuit &&
    nextOfficial.level === level
      ? nextOfficial.round
      : (stage?.userBestRound ?? "round-of-16");
  const [selectedRound, setSelectedRound] =
    useState<TournamentRound>(initialRound);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

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
  const visibleMatches = stage.matches
    .filter((match) => match.round === selectedRound)
    .sort((left, right) => Number(right.userInMatch) - Number(left.userInMatch));

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
      <section className="tournament-header" aria-labelledby="tournament-heading">
        <div className="tournament-header__top">
          <button
            aria-label="試合メニューへ戻る"
            className="tournament-back"
            onClick={onBack}
            type="button"
          >
            ←
          </button>
          <div className="tournament-header__title">
            <h2 id="tournament-heading">
              {circuitLabels[circuit]} {levelLabels[level]}
            </h2>
            <span>{stage.entrants.length}校</span>
          </div>
          <strong className={`tournament-status tournament-status--${stage.status}`}>
            {timingLabel}
          </strong>
        </div>

        <div className="tournament-position-strip">
          <div>
            <span>現在</span>
            <strong>{roundLabel}</strong>
          </div>
          {nextMatch ? (
            <div>
              <span>次戦</span>
              <strong title={nextMatch.opponent.displayName}>
                {nextMatch.opponent.shortName}
              </strong>
            </div>
          ) : stage.champion ? (
            <div>
              <span>優勝校</span>
              <strong title={stage.champion.displayName}>
                {stage.champion.shortName}
              </strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="tournament-panel" aria-labelledby="bracket-heading">
        <div
          className="tournament-round-tabs"
          role="group"
          aria-label="表示するラウンド"
        >
          {roundOrder.map((round) => (
            <button
              aria-pressed={selectedRound === round}
              key={round}
              onClick={() => setSelectedRound(round)}
              type="button"
            >
              {roundLabels[round]}
            </button>
          ))}
        </div>

        <div className="tournament-round-heading">
          <h3 id="bracket-heading">{roundLabels[selectedRound]}</h3>
          <span>{visibleMatches.length}試合</span>
        </div>

        <div className="tournament-round__matches">
          {visibleMatches.map((match) => {
            const isCurrentUserMatch = nextMatch?.matchId === match.id;
            const inlineAction =
              isCurrentUserMatch && due ? (
                <>
                  {!trainingCompleted ? (
                    <p className="tournament-training-note">
                      今週の練習を完了すると開始できます
                    </p>
                  ) : null}
                  {pending ? (
                    <p className="tournament-pending" role="status">
                      <strong>公式戦を開始しています…</strong>
                      <span>試合結果と大会結果を保存しています…</span>
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
                </>
              ) : null;

            return (
              <TournamentMatchRow
                action={inlineAction}
                key={match.id}
                match={match}
                userEntrantId={stage.userEntrantId}
              />
            );
          })}
        </div>
      </section>

      {terminal ? (
        <section
          className={`tournament-terminal tournament-terminal--${stage.status}`}
        >
          <span>{stage.status === "champion" ? "優勝" : "敗退"}</span>
          <strong>
            {stage.status === "champion"
              ? `${circuitLabels[circuit]} ${levelLabels[level]}を制覇しました`
              : `${roundLabel}で大会を終えました`}
          </strong>
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
