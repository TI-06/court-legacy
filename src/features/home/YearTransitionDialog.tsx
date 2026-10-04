import type { AcademicYearTransitionSummary } from "../../domain/calendar/academicYearProgression";
import type { GameState } from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";
import {
  previewSeasonAmbition,
  seasonAmbitionDescriptions,
  seasonAmbitionLabels,
} from "../../domain/season/seasonGoals";
import { seasonGoalFundReward } from "../../domain/season/seasonGoalRewards";
import type {
  SeasonAmbition,
  SeasonGoalDefinition,
} from "../../domain/season/seasonGoalTypes";
import { BottomSheet } from "../../ui/BottomSheet";
import "../../ui/ui.css";
import { buildSeasonResultPresentation } from "../season/seasonResultPresentation";
import "./year-transition-dialog.css";

interface YearTransitionDialogProps {
  state: GameState;
  summary: AcademicYearTransitionSummary;
  onClose: () => void;
  onSelectAmbition?: (ambition: SeasonAmbition) => void;
  ambitionPending?: boolean;
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

function playerDisplayName(player: Player | null): string {
  return player ? `${player.lastName} ${player.firstName}` : "該当なし";
}

function careerImpact(player: Player): number {
  return (
    player.career.appearances * 3 +
    player.career.points +
    player.career.blocks * 2 +
    player.career.serviceAces * 2
  );
}

function rosterAbilityTotal(player: Player): number {
  return Object.values(player.abilities).reduce(
    (total, value) => total + value,
    0,
  );
}

function selectStandoutPlayer(
  state: GameState,
  playerIds: readonly PlayerId[],
  score: (player: Player) => number,
): Player | null {
  return (
    playerIds
      .map((playerId) => state.players[playerId])
      .filter((player): player is Player => Boolean(player))
      .sort(
        (left, right) =>
          score(right) - score(left) || left.id.localeCompare(right.id),
      )[0] ?? null
  );
}

function seasonGoalPreviewLabel(goal: SeasonGoalDefinition): string {
  if (goal.kind === "regional-rank") return `県内${goal.target}位`;
  if (goal.kind === "national-rank") return `全国${goal.target}位`;
  if (goal.kind === "identity-mastery") return `哲学习熟${goal.target}`;
  if (goal.kind === "official-wins") return `公式${goal.target}勝`;
  if (goal.achievement === "national-title") return "全国優勝";
  if (goal.achievement === "national-appearance") return "全国出場";
  return "県優勝";
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
  onSelectAmbition,
  ambitionPending = false,
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
  const standoutGraduate = selectStandoutPlayer(
    state,
    graduatedPlayerIds,
    careerImpact,
  );
  const spotlightIntake = selectStandoutPlayer(
    state,
    intakePlayerIds,
    rosterAbilityTotal,
  );
  const newCaptain = captainPlayerId
    ? (state.players[captainPlayerId] ?? null)
    : null;
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
  const seasonMvp =
    summary.seasonAwards.winners.find((award) => award.category === "mvp") ??
    null;
  const specialistAwards = summary.seasonAwards.winners.filter(
    (award) => award.category !== "mvp",
  );
  const ambitionSelectionPending =
    state.seasonGoals?.ambitionSelectionPending === true;
  const currentAmbition = state.seasonGoals?.ambition ?? "challenge";
  const ambitionOptions = state.seasonGoals
    ? (["steady", "challenge", "bold"] as const).map((ambition) => {
        const preview = previewSeasonAmbition(state, ambition);
        return {
          ambition,
          label: seasonAmbitionLabels[ambition],
          description: seasonAmbitionDescriptions[ambition],
          goals: preview.goals,
          totalReward: preview.goals.reduce(
            (total, goal) => total + seasonGoalFundReward(goal, ambition),
            0,
          ),
        };
      })
    : [];

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
              <div className="year-transition-season__summary">
                <strong>
                  {seasonResult.achievedCount}/{seasonResult.goalCount}目標達成
                </strong>
                <b>目標報酬 +{seasonResult.earnedRewardFunds}</b>
              </div>
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
                    <small>
                      {goal.progressLabel}
                      {goal.achieved ? `・+${goal.rewardFunds}獲得` : ""}
                    </small>
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

        {summary.seasonAwards.winners.length > 0 ? (
          <section aria-label="年間表彰" className="year-transition-awards">
            <div className="year-transition-awards__heading">
              <div>
                <span>SEASON AWARDS</span>
                <h3>{summary.seasonAwards.academicYear}年度 年間表彰</h3>
              </div>
              <small>{summary.seasonAwards.winners.length}部門</small>
            </div>

            {seasonMvp ? (
              <article className="year-transition-awards__mvp">
                <span>MVP</span>
                <div>
                  <strong>{seasonMvp.displayName}</strong>
                  <small>{seasonMvp.metricLabel}</small>
                </div>
              </article>
            ) : null}

            {specialistAwards.length > 0 ? (
              <div className="year-transition-awards__grid">
                {specialistAwards.map((award) => (
                  <article key={award.category}>
                    <span>{award.label}</span>
                    <strong>{award.displayName}</strong>
                    <small>{award.metricLabel}</small>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {ambitionOptions.length > 0 ? (
          <section
            aria-label="新シーズン目標方針"
            className="year-transition-ambition"
          >
            <div className="year-transition-ambition__heading">
              <div>
                <span>NEW SEASON PLAN</span>
                <h3>
                  {ambitionSelectionPending
                    ? "今季の目標方針を選択"
                    : `今季は「${seasonAmbitionLabels[currentAmbition]}」`}
                </h3>
              </div>
              {ambitionSelectionPending ? <b>選択必須</b> : <b>確定済み</b>}
            </div>

            <div className="year-transition-ambition__options">
              {ambitionOptions.map((option) => {
                const selected =
                  !ambitionSelectionPending &&
                  option.ambition === currentAmbition;
                return (
                  <button
                    aria-label={`${option.label}方針を選ぶ`}
                    className={
                      selected
                        ? "year-transition-ambition__option is-selected"
                        : "year-transition-ambition__option"
                    }
                    disabled={
                      ambitionPending ||
                      !ambitionSelectionPending ||
                      !onSelectAmbition
                    }
                    key={option.ambition}
                    onClick={() => onSelectAmbition?.(option.ambition)}
                    type="button"
                  >
                    <div>
                      <strong>{option.label}</strong>
                      {option.ambition === "challenge" ? (
                        <em>おすすめ</em>
                      ) : null}
                      <small>{option.description}</small>
                    </div>
                    <span>
                      {option.goals.map((goal) => (
                        <i key={goal.id}>{seasonGoalPreviewLabel(goal)}</i>
                      ))}
                    </span>
                    <b>最大 +{option.totalReward}</b>
                  </button>
                );
              })}
            </div>
            {ambitionSelectionPending ? (
              <p>方針を保存すると今シーズン中は変更できません。</p>
            ) : null}
          </section>
        ) : null}

        <section
          aria-label="世代交代"
          className="year-transition-generation"
        >
          <div className="year-transition-generation__heading">
            <div>
              <span>GENERATION SHIFT</span>
              <h3>世代交代</h3>
            </div>
            <small>次のチームの軸</small>
          </div>
          <div className="year-transition-generation__grid">
            <article>
              <span>卒業世代の中心</span>
              <strong>{playerDisplayName(standoutGraduate)}</strong>
              <small>
                {standoutGraduate
                  ? `${standoutGraduate.preferredPosition}・通算${standoutGraduate.career.appearances}試合`
                  : "卒業生なし"}
              </small>
            </article>
            <article className="is-captain">
              <span>新主将</span>
              <strong>{playerDisplayName(newCaptain)}</strong>
              <small>
                {newCaptain
                  ? `${newCaptain.preferredPosition}・3年生`
                  : "主将未定"}
              </small>
            </article>
            <article>
              <span>新入生の注目株</span>
              <strong>{playerDisplayName(spotlightIntake)}</strong>
              <small>
                {spotlightIntake
                  ? `${spotlightIntake.preferredPosition}・${spotlightIntake.tier}`
                  : "新入生なし"}
              </small>
            </article>
          </div>
        </section>

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
          disabled={ambitionSelectionPending || ambitionPending}
          onClick={onClose}
          type="button"
        >
          {ambitionPending
            ? "方針を保存中…"
            : ambitionSelectionPending
              ? "目標方針を選んでください"
              : "新年度を始める"}
        </button>
      </div>
    </BottomSheet>
  );
}
