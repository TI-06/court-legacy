import type { AcademicYearTransitionSummary } from "../../domain/calendar/academicYearProgression";
import type { GameState } from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";
import { BottomSheet } from "../../ui/BottomSheet";
import "../../ui/ui.css";
import { buildSeasonResultPresentation } from "../season/seasonResultPresentation";
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
    .filter((player): player is Player => Boolean(player))
    .map((player) => `${player.lastName} ${player.firstName}`);
}

function rankMovementLabel(movement: number): string {
  if (movement > 0) return `▲${movement}`;
  if (movement < 0) return `▼${Math.abs(movement)}`;
  return "→0";
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
  const archivedSeason = state.history.seasonGoalSeasons?.at(-1);
  const seasonResult = archivedSeason
    ? buildSeasonResultPresentation(archivedSeason)
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
        {seasonResult ? (
          <section
            aria-label="シーズン振り返り"
            className="year-transition-season"
          >
            <div className="year-transition-season__heading">
              <div>
                <span>SEASON RESULT</span>
                <h3>{seasonResult.academicYear}年目 シーズン結果</h3>
              </div>
              <strong>
                {seasonResult.achievedCount}/{seasonResult.goalCount}目標達成
              </strong>
            </div>

            <div className="year-transition-season__ranks">
              <article>
                <span>
                  県内 {seasonResult.regional.startingRank}位 →{" "}
                  {seasonResult.regional.finalRank}位
                </span>
                <b
                  className={
                    seasonResult.regional.movement < 0 ? "is-down" : undefined
                  }
                >
                  {rankMovementLabel(seasonResult.regional.movement)}
                </b>
              </article>
              <article>
                <span>
                  全国 {seasonResult.national.startingRank}位 →{" "}
                  {seasonResult.national.finalRank}位
                </span>
                <b
                  className={
                    seasonResult.national.movement < 0 ? "is-down" : undefined
                  }
                >
                  {rankMovementLabel(seasonResult.national.movement)}
                </b>
              </article>
            </div>

            <div className="year-transition-season__goals">
              {seasonResult.goals.map((goal) => (
                <article
                  className={goal.achieved ? "is-achieved" : undefined}
                  key={goal.id}
                >
                  <div>
                    <strong>{goal.label}</strong>
                    <small>{goal.progressLabel}</small>
                  </div>
                  <b aria-label={goal.achieved ? "達成済み" : "未達成"}>
                    {goal.achieved ? "✓" : "—"}
                  </b>
                </article>
              ))}
            </div>

            <div className="year-transition-season__deltas">
              <span>
                公式戦<strong>{seasonResult.deltas.officialWins}勝</strong>
              </span>
              <span>
                県優勝<strong>{seasonResult.deltas.prefecturalTitles}回</strong>
              </span>
              <span>
                全国出場
                <strong>{seasonResult.deltas.nationalAppearances}回</strong>
              </span>
            </div>
          </section>
        ) : null}

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
