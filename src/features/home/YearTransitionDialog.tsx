import type { AcademicYearTransitionSummary } from "../../domain/calendar/academicYearProgression";
import type { GameState } from "../../domain/model/GameState";
import type { PlayerId } from "../../domain/model/identifiers";
import { BottomSheet } from "../../ui/BottomSheet";
import "../../ui/ui.css";
import "./year-transition-dialog.css";

interface YearTransitionDialogProps {
  state: GameState;
  summary: AcademicYearTransitionSummary;
  onClose: () => void;
}

function playerName(state: GameState, playerId: PlayerId | null): string {
  const player = playerId ? state.players[playerId] : undefined;
  return player ? `${player.lastName} ${player.firstName}` : "未定";
}

function playerNames(
  state: GameState,
  playerIds: readonly PlayerId[],
): string[] {
  return playerIds
    .map((playerId) => state.players[playerId])
    .filter((player) => Boolean(player))
    .map((player) => `${player!.lastName} ${player!.firstName}`);
}

export function YearTransitionDialog({
  state,
  summary,
  onClose,
}: YearTransitionDialogProps) {
  const userSchool = state.schools[state.userSchoolId];
  if (!userSchool) {
    return null;
  }
  const graduatedPlayerIds =
    summary.graduatedPlayerIdsBySchool[state.userSchoolId] ?? [];
  const intakePlayerIds =
    summary.intakePlayerIdsBySchool[state.userSchoolId] ?? [];
  const captainPlayerId =
    summary.captainPlayerIdsBySchool[state.userSchoolId] ?? null;
  const graduatedNames = playerNames(state, graduatedPlayerIds);
  const intakeNames = playerNames(state, intakePlayerIds);
  const generationalPlayer = summary.generationalTalentPlayerId
    ? state.players[summary.generationalTalentPlayerId]
    : null;
  const generationalSchool = summary.generationalTalentSchoolId
    ? state.schools[summary.generationalTalentSchoolId]
    : null;

  return (
    <BottomSheet
      description="卒業生を送り出し、新入生を迎えて次のシーズンへ進みます。"
      dismissible={false}
      onClose={onClose}
      open
      title={`${summary.academicYear}年目の新年度`}
    >
      <div className="year-transition-body">
        <div className="year-transition-metrics">
          <div>
            <span>卒業</span>
            <strong>{graduatedPlayerIds.length}名</strong>
          </div>
          <div>
            <span>新入生</span>
            <strong>{intakePlayerIds.length}名</strong>
          </div>
          <div>
            <span>部員数</span>
            <strong>{userSchool.playerIds.length}名</strong>
          </div>
        </div>

        <section className="year-transition-section">
          <div className="year-transition-section__heading">
            <h3>新主将</h3>
            <span>3年生</span>
          </div>
          <p className="year-transition-captain">
            {playerName(state, captainPlayerId)}
          </p>
        </section>

        <section className="year-transition-section">
          <h3>卒業生</h3>
          <div className="year-transition-name-list">
            {graduatedNames.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </section>

        <section className="year-transition-section">
          <h3>新入生</h3>
          <div className="year-transition-name-list">
            {intakeNames.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </section>

        {generationalPlayer && generationalSchool ? (
          <section className="year-transition-special">
            <strong>世代級選手が入学</strong>
            <p>
              {generationalSchool.name}・{generationalPlayer.lastName}{" "}
              {generationalPlayer.firstName}（
              {generationalPlayer.preferredPosition}）
            </p>
          </section>
        ) : null}

        <button
          className="year-transition-start"
          onClick={onClose}
          type="button"
        >
          新年度を始める
        </button>
      </div>
    </BottomSheet>
  );
}
