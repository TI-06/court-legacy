import type { MatchState } from "../../domain/model/Match";
import type { SchoolId } from "../../domain/model/identifiers";
import type {
  MatchStatSummary,
  PlayerMatchStats,
  TeamMatchStats,
} from "./matchPresentation";
import { ratingToGrade } from "../../domain/selectors/ratingGrades";

export interface MatchPerformanceRating {
  score: number;
  grade: ReturnType<typeof ratingToGrade>;
}

export interface TeamMatchEvaluation extends MatchPerformanceRating {
  attack: MatchPerformanceRating;
  block: MatchPerformanceRating;
  serve: MatchPerformanceRating;
  receive: MatchPerformanceRating;
  strengthAdjustment: number;
}

export interface PlayerMatchEvaluation {
  playerId: PlayerMatchStats["playerId"];
  rated: boolean;
  score: number | null;
  grade: ReturnType<typeof ratingToGrade> | null;
}

export interface MatchReviewEvaluation {
  team: TeamMatchEvaluation;
  players: PlayerMatchEvaluation[];
  teamMvpPlayerId: PlayerMatchStats["playerId"] | null;
}

interface BuildMatchReviewEvaluationArgs {
  match: MatchState;
  summary: MatchStatSummary;
  userSchoolId: SchoolId;
  homeStrength: number;
  awayStrength: number;
}

function clampScore(value: number): number {
  return Math.max(20, Math.min(100, Math.round(value)));
}

function rating(value: number): MatchPerformanceRating {
  const score = clampScore(value);
  return { score, grade: ratingToGrade(score) };
}

function schoolStats(
  summary: MatchStatSummary,
  schoolId: SchoolId,
): TeamMatchStats {
  return summary.home.schoolId === schoolId ? summary.home : summary.away;
}

function schoolStrength(
  match: MatchState,
  schoolId: SchoolId,
  homeStrength: number,
  awayStrength: number,
): number {
  return schoolId === match.homeSchoolId ? homeStrength : awayStrength;
}

function teamEvaluation(
  match: MatchState,
  summary: MatchStatSummary,
  userSchoolId: SchoolId,
  homeStrength: number,
  awayStrength: number,
): TeamMatchEvaluation {
  const user = schoolStats(summary, userSchoolId);
  const opponent =
    summary.home.schoolId === userSchoolId ? summary.away : summary.home;
  const userStrength = schoolStrength(
    match,
    userSchoolId,
    homeStrength,
    awayStrength,
  );
  const opponentSchoolId =
    match.homeSchoolId === userSchoolId
      ? match.awaySchoolId
      : match.homeSchoolId;
  const opponentStrength = schoolStrength(
    match,
    opponentSchoolId,
    homeStrength,
    awayStrength,
  );
  const userWon =
    (match.homeSchoolId === userSchoolId &&
      match.homeSetsWon > match.awaySetsWon) ||
    (match.awaySchoolId === userSchoolId &&
      match.awaySetsWon > match.homeSetsWon);
  const userSets =
    match.homeSchoolId === userSchoolId
      ? match.homeSetsWon
      : match.awaySetsWon;
  const opponentSets =
    match.homeSchoolId === userSchoolId
      ? match.awaySetsWon
      : match.homeSetsWon;

  const attack = rating(
    58 + (user.attackSuccessRate - opponent.attackSuccessRate) * 0.72,
  );
  const block = rating(
    58 + (user.blockPoints - opponent.blockPoints) * 6,
  );
  const serve = rating(
    58 +
      (user.serviceAces - opponent.serviceAces) * 5 -
      (user.serveErrors - opponent.serveErrors) * 3,
  );
  const receive = rating(
    58 + (user.perfectReceiveRate - opponent.perfectReceiveRate) * 0.55,
  );
  const strengthAdjustment = Math.max(
    -8,
    Math.min(8, Math.round((opponentStrength - userStrength) * 0.35)),
  );
  const setMarginAdjustment = (userSets - opponentSets) * 2;
  const resultBase = userWon ? 95 : 45;

  const score = clampScore(
    resultBase * 0.35 +
      attack.score * 0.25 +
      block.score * 0.15 +
      serve.score * 0.12 +
      receive.score * 0.13 +
      strengthAdjustment +
      setMarginAdjustment,
  );

  return {
    score,
    grade: ratingToGrade(score),
    attack,
    block,
    serve,
    receive,
    strengthAdjustment,
  };
}

function activitySample(player: PlayerMatchStats): number {
  return (
    player.attackAttempts +
    player.receiveAttempts +
    player.points +
    player.defensePoints
  );
}

function playerScore(
  player: PlayerMatchStats,
  userTeam: TeamMatchStats,
  opponentTeam: TeamMatchStats,
): number {
  const pointImpact = Math.min(30, player.points * 3.5);
  const blockImpact = Math.min(24, player.blockPoints * 7);
  const serveImpact = Math.min(18, player.serviceAces * 6);
  const defenseImpact = Math.min(16, player.defensePoints * 5);
  const receiveVolume = Math.min(14, player.receiveAttempts * 1.4);

  switch (player.position) {
    case "OH":
      return (
        38 +
        pointImpact * 0.45 +
        player.attackSuccessRate * 0.28 +
        player.perfectReceiveRate * 0.18 +
        blockImpact * 0.18 +
        serveImpact * 0.15
      );
    case "OP":
      return (
        40 +
        pointImpact * 0.55 +
        player.attackSuccessRate * 0.32 +
        blockImpact * 0.25 +
        serveImpact * 0.16
      );
    case "MB":
      return (
        40 +
        blockImpact * 0.65 +
        player.attackSuccessRate * 0.3 +
        pointImpact * 0.32 +
        serveImpact * 0.1
      );
    case "S":
      return (
        42 +
        userTeam.attackSuccessRate * 0.33 +
        Math.max(
          -8,
          Math.min(
            8,
            (userTeam.attackSuccessRate - opponentTeam.attackSuccessRate) * 0.25,
          ),
        ) +
        serveImpact * 0.25 +
        defenseImpact * 0.35 +
        player.perfectReceiveRate * 0.08
      );
    case "L":
      return (
        40 +
        player.perfectReceiveRate * 0.42 +
        receiveVolume * 0.7 +
        defenseImpact * 0.55
      );
  }
}

export function buildMatchReviewEvaluation({
  match,
  summary,
  userSchoolId,
  homeStrength,
  awayStrength,
}: BuildMatchReviewEvaluationArgs): MatchReviewEvaluation {
  const userTeam = schoolStats(summary, userSchoolId);
  const opponentTeam =
    summary.home.schoolId === userSchoolId ? summary.away : summary.home;
  const userPlayers = summary.players.filter(
    (player) => player.schoolId === userSchoolId,
  );
  const players = userPlayers.map((player) => {
    const rated = activitySample(player) > 0;
    if (!rated) {
      return {
        playerId: player.playerId,
        rated: false,
        score: null,
        grade: null,
      };
    }

    const score = clampScore(playerScore(player, userTeam, opponentTeam));
    return {
      playerId: player.playerId,
      rated: true,
      score,
      grade: ratingToGrade(score),
    };
  });

  const teamMvp =
    [...players]
      .filter(
        (
          player,
        ): player is PlayerMatchEvaluation & {
          score: number;
          grade: ReturnType<typeof ratingToGrade>;
        } => player.rated && player.score !== null && player.grade !== null,
      )
      .sort((first, second) => {
        if (second.score !== first.score) return second.score - first.score;
        return first.playerId.localeCompare(second.playerId);
      })[0] ?? null;

  return {
    team: teamEvaluation(
      match,
      summary,
      userSchoolId,
      homeStrength,
      awayStrength,
    ),
    players,
    teamMvpPlayerId: teamMvp?.playerId ?? null,
  };
}
