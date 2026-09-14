import type { GameState } from "../../domain/model/GameState";
import type { SchoolId } from "../../domain/model/identifiers";
import {
  buildSchoolRankings,
  type SchoolRankingRow,
} from "../../domain/season/schoolRankings";
import type {
  SeasonGoalResult,
  TournamentAchievementTarget,
} from "../../domain/season/seasonGoalTypes";
import { evaluateSeasonGoals } from "../../domain/season/seasonGoals";
import {
  selectNotableUserMatches,
  selectUserHeadToHeadTable,
  type RivalryLabel,
} from "../../domain/world/rivalryHistory";
import {
  buildSeasonResultPresentation,
  type SeasonResultPresentation,
} from "./seasonResultPresentation";

export interface SeasonProgressGoalPresentation {
  id: string;
  label: string;
  progressLabel: string;
  achieved: boolean;
}

export interface SeasonNearbySchoolPresentation {
  rank: number;
  schoolId: SchoolId;
  displayName: string;
  shortName: string;
  reputationPoints: number;
  isUserSchool: boolean;
}

export interface SeasonRankingPresentation {
  rank: number;
  total: number;
  startingRank: number;
  movement: number;
  nearby: SeasonNearbySchoolPresentation[];
}

export interface SchoolLegacyOpponentPresentation {
  schoolId: SchoolId;
  displayName: string;
  recordLabel: string;
  meetingLabel: string;
  streakLabel: string | null;
  rivalryScore: number;
  labels: RivalryLabel[];
}

export interface SchoolLegacyMatchPresentation {
  matchId: string;
  date: string;
  opponentName: string;
  resultLabel: string;
  reasons: string[];
}

export interface SchoolLegacyPresentation {
  opponents: SchoolLegacyOpponentPresentation[];
  notableMatches: SchoolLegacyMatchPresentation[];
}

export interface SeasonProgressPresentation {
  academicYear: number;
  achievedCount: number;
  goalCount: number;
  goals: SeasonProgressGoalPresentation[];
  regional: SeasonRankingPresentation;
  national: SeasonRankingPresentation;
  archivedSeasons: SeasonResultPresentation[];
  legacy: SchoolLegacyPresentation;
}

const notableReasonLabels = {
  official: "公式戦",
  close: "接戦",
  rival: "因縁",
  "destiny-rival": "宿敵",
  rematch: "再戦",
} as const;

function tournamentGoalLabel(achievement: TournamentAchievementTarget): string {
  if (achievement === "national-title") return "全国大会優勝";
  if (achievement === "national-appearance") return "全国大会出場";
  return "県大会優勝";
}

function goalLabel(goal: SeasonGoalResult): string {
  if (goal.kind === "regional-rank") return `県内${goal.target}位以内`;
  if (goal.kind === "official-wins") return `公式戦${goal.target}勝`;
  return tournamentGoalLabel(goal.achievement);
}

function goalProgressLabel(goal: SeasonGoalResult): string {
  if (goal.kind === "regional-rank") return `現在 ${goal.progress}位`;
  if (goal.kind === "official-wins") {
    return `${goal.progress}/${goal.target}勝`;
  }
  return goal.achieved ? "達成" : "未達成";
}

function nearbyRows(
  rankings: readonly SchoolRankingRow[],
  userSchoolId: SchoolId,
): SeasonNearbySchoolPresentation[] {
  const userIndex = rankings.findIndex((row) => row.schoolId === userSchoolId);
  if (userIndex < 0) {
    throw new Error(`user school is missing from ranking: ${userSchoolId}`);
  }

  const size = Math.min(5, rankings.length);
  const start = Math.max(
    0,
    Math.min(userIndex - Math.floor(size / 2), rankings.length - size),
  );

  return rankings.slice(start, start + size).map((row) => ({
    rank: row.rank,
    schoolId: row.schoolId,
    displayName: row.displayName,
    shortName: row.shortName,
    reputationPoints: row.reputationPoints,
    isUserSchool: row.schoolId === userSchoolId,
  }));
}

function rankingPresentation(
  rankings: readonly SchoolRankingRow[],
  userSchoolId: SchoolId,
  currentRank: number,
  startingRank: number,
): SeasonRankingPresentation {
  return {
    rank: currentRank,
    total: rankings.length,
    startingRank,
    movement: startingRank - currentRank,
    nearby: nearbyRows(rankings, userSchoolId),
  };
}

function matchOpponentName(
  state: GameState,
  match: GameState["history"]["matches"][number],
): string {
  const userIsHome = match.homeSchoolId === state.userSchoolId;
  const opponentSchoolId = userIsHome
    ? match.awaySchoolId
    : match.homeSchoolId;
  const persistedName = userIsHome
    ? match.awayDisplayName
    : match.homeDisplayName;
  return (
    persistedName ??
    state.schools[opponentSchoolId]?.shortName ??
    state.schools[opponentSchoolId]?.name ??
    "相手校"
  );
}

function legacyPresentation(state: GameState): SchoolLegacyPresentation {
  const opponents = selectUserHeadToHeadTable(state)
    .slice(0, 5)
    .map((summary) => {
      const school = state.schools[summary.opponentSchoolId];
      const streakLabel = summary.currentStreak
        ? summary.currentStreak.count >= 2
          ? `${summary.currentStreak.count}連${summary.currentStreak.result === "win" ? "勝" : "敗"}中`
          : null
        : null;
      return {
        schoolId: summary.opponentSchoolId,
        displayName: school?.shortName ?? school?.name ?? "相手校",
        recordLabel: `通算 ${summary.wins}勝${summary.losses}敗`,
        meetingLabel: `${summary.totalMeetings}戦・公式${summary.officialMeetings} / 練習${summary.practiceMeetings}`,
        streakLabel,
        rivalryScore: summary.rivalryScore,
        labels: summary.labels,
      } satisfies SchoolLegacyOpponentPresentation;
    });

  const notableMatches = selectNotableUserMatches(state, 5).map((entry) => {
    const userIsHome = entry.match.homeSchoolId === state.userSchoolId;
    const userSetsWon = userIsHome
      ? entry.match.homeSetsWon
      : entry.match.awaySetsWon;
    const opponentSetsWon = userIsHome
      ? entry.match.awaySetsWon
      : entry.match.homeSetsWon;
    const won = entry.match.winnerSchoolId === state.userSchoolId;
    return {
      matchId: String(entry.match.matchId),
      date: entry.match.date,
      opponentName: matchOpponentName(state, entry.match),
      resultLabel: `${won ? "勝利" : "敗戦"} ${userSetsWon}-${opponentSetsWon}`,
      reasons: entry.reasons.map((reason) => notableReasonLabels[reason]),
    } satisfies SchoolLegacyMatchPresentation;
  });

  return { opponents, notableMatches };
}

export function buildSeasonProgressPresentation(
  state: GameState,
): SeasonProgressPresentation | null {
  const seasonGoals = state.seasonGoals;
  if (!seasonGoals) return null;

  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }

  const summary = evaluateSeasonGoals(state, seasonGoals);
  const regionalRankings = buildSchoolRankings(state, {
    regionId: school.regionId,
  });
  const nationalRankings = buildSchoolRankings(state);
  const archivedSeasons = [...(state.history.seasonGoalSeasons ?? [])]
    .reverse()
    .map(buildSeasonResultPresentation);

  return {
    academicYear: summary.academicYear,
    achievedCount: summary.achievedCount,
    goalCount: summary.goalResults.length,
    goals: summary.goalResults.map((goal) => ({
      id: goal.id,
      label: goalLabel(goal),
      progressLabel: goalProgressLabel(goal),
      achieved: goal.achieved,
    })),
    regional: rankingPresentation(
      regionalRankings,
      state.userSchoolId,
      summary.finalRanks.regional,
      summary.startingRanks.regional,
    ),
    national: rankingPresentation(
      nationalRankings,
      state.userSchoolId,
      summary.finalRanks.national,
      summary.startingRanks.national,
    ),
    archivedSeasons,
    legacy: legacyPresentation(state),
  };
}
