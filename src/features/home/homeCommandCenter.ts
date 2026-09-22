import type { GameDataRegistry } from "../../data/dataRegistry";
import { isWeeklyActionCompleted } from "../../domain/calendar/weekProgression";
import { selectPlayerConcernGuidance } from "../../domain/dynamics/playerConcernGuidance";
import type { CohesionTrend } from "../../domain/dynamics/teamDynamicsTypes";
import type {
  GameState,
  HistoricalMatchSummary,
} from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { PlayerId, SchoolId } from "../../domain/model/identifiers";
import {
  selectHomeCharacterTraitNotifications,
  selectHomeConcernResolutionNotifications,
  selectHomeDevelopmentGoalAchievementNotifications,
  selectHomeSeasonGoalAchievementNotifications,
  selectHomeSpecialRelationshipNotifications,
  selectHomeTrainingNotifications,
  type CharacterTraitDiscoveredNotification,
  type ConcernResolutionNotification,
  type DevelopmentGoalAchievementNotification,
  type SeasonGoalAchievementNotification,
  type SpecialRelationshipNotification,
  type TrainingResultNotification,
} from "../../domain/notifications/gameNotifications";
import { getPlayerConditionPresentation } from "../../domain/player/playerCondition";
import { calculateSelectionStrength } from "../../domain/selectors/matchSelectors";
import { schoolStrengthToGrade } from "../../domain/selectors/ratingGrades";
import {
  FACILITY_DEFINITIONS,
  evaluateFacilityUpgrade,
} from "../../domain/school/facilityUpgrade";
import { autoSelectTeam } from "../../domain/team/autoSelectTeam";
import { selectNextOfficialEvent } from "../../domain/tournament/tournamentSelectors";
import type {
  TournamentCircuit,
  TournamentLevel,
  TournamentRound,
} from "../../domain/tournament/tournamentTypes";
import { selectPracticeRecommendation } from "../../domain/weekly/practiceMatchPlanning";
import { buildSeasonProgressPresentation } from "../season/seasonProgressPresentation";

export type HomeCommandPriority =
  "critical" | "attention" | "normal" | "complete";

export type HomeCommandAction =
  | { target: "team" }
  | {
      target: "player";
      playerId: PlayerId;
      detail?: "ability" | "growth" | "personality";
    }
  | { target: "school"; view: "facilities" | "staff" | "records" }
  | { target: "scouting" }
  | { target: "practice" }
  | { target: "tournament" }
  | { target: "start-week-match" };

export interface HomeSummary {
  dateLabel: string;
  weekLabel: string;
  schoolName: string;
  strength: number;
  strengthGrade: string;
  condition: {
    label: string;
    icon: string;
    colorToken: string;
  };
  cohesion: number;
  cohesionTrend: CohesionTrend;
  official: null | {
    competitionLabel: string;
    detailLabel: string;
    detailTitle: string | null;
    timingLabel: string;
    due: boolean;
  };
  season: null | {
    academicYear: number;
    ambitionLabel: string;
    remainingRewardFunds: number;
    achievedCount: number;
    goalCount: number;
    primaryGoal: null | {
      label: string;
      progressLabel: string;
      achieved: boolean;
      rewardFunds: number;
    };
    regional: {
      rank: number;
      movement: number;
    };
    national: {
      rank: number;
      movement: number;
    };
  };
}

interface HomeBaseTask {
  id: string;
  priority: HomeCommandPriority;
  category:
    | "official"
    | "practice"
    | "training"
    | "player"
    | "injury"
    | "facility"
    | "staff"
    | "scouting";
  title: string;
  detail: string;
}

export type HomeCommandTask =
  | (HomeBaseTask & {
      kind: "action";
      action?: HomeCommandAction;
      actionLabel?: string;
      complete?: boolean;
    })
  | (HomeBaseTask & {
      kind: "practice-offer";
      offer: {
        schoolId: SchoolId;
        schoolName: string;
        strength: number | null;
        strengthGrade: string | null;
        growthRating: number;
        loadRating: number;
      };
    });

export type HomeCommandNews =
  | {
      id: string;
      kind: "training-result";
      title: string;
      detail: string;
      notification: TrainingResultNotification;
    }
  | {
      id: string;
      kind: "concern-resolution";
      title: string;
      detail: string;
      notification: ConcernResolutionNotification;
    }
  | {
      id: string;
      kind: "special-relationship";
      title: string;
      detail: string;
      notification: SpecialRelationshipNotification;
    }
  | {
      id: string;
      kind: "character-trait-discovered";
      title: string;
      detail: string;
      notification: CharacterTraitDiscoveredNotification;
    }
  | {
      id: string;
      kind: "development-goal-achieved";
      title: string;
      detail: string;
      notification: DevelopmentGoalAchievementNotification;
    }
  | {
      id: string;
      kind: "season-goal-achieved";
      title: string;
      detail: string;
      notification: SeasonGoalAchievementNotification;
    }
  | {
      id: string;
      kind: "growth";
      title: string;
      detail: string;
      playerId: PlayerId;
    }
  | { id: string; kind: "match"; title: string; detail: string }
  | { id: string; kind: "cohesion"; title: string; detail: string };

export interface HomeCommandCenterModel {
  summary: HomeSummary;
  tasks: HomeCommandTask[];
  news: HomeCommandNews[];
  advance: {
    requiresConfirmation: boolean;
    reason: "practice-offer" | null;
  };
}

interface TaskCandidate {
  task: HomeCommandTask;
  order: number;
}

interface NewsCandidate {
  news: HomeCommandNews;
  order: number;
}

const priorityWeight: Record<HomeCommandPriority, number> = {
  critical: 0,
  attention: 1,
  normal: 2,
  complete: 3,
};

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

const cohesionTrendLabels: Record<CohesionTrend, string> = {
  rising: "上向き",
  stable: "横ばい",
  falling: "低下",
};

const practiceTierLabels = {
  same: "同格",
  stronger: "格上",
  challenge: "強豪",
} as const;

function shortDate(value: string): string {
  const [, month, day] = value.split("-").map(Number);
  if (!month || !day) return value;
  return `${month}/${day}`;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function schoolStrength(state: GameState, schoolId: SchoolId): number | null {
  const school = state.schools[schoolId];
  if (!school) return null;
  return calculateSelectionStrength(
    state,
    autoSelectTeam({ state, schoolId: school.id }),
  );
}

function latestUserMatch(state: GameState): HistoricalMatchSummary | null {
  return (
    [...state.history.matches]
      .filter(
        (match) =>
          match.homeSchoolId === state.userSchoolId ||
          match.awaySchoolId === state.userSchoolId,
      )
      .sort(
        (left, right) =>
          right.date.localeCompare(left.date) ||
          String(left.matchId).localeCompare(String(right.matchId)),
      )[0] ?? null
  );
}

function matchSchoolName(
  state: GameState,
  match: HistoricalMatchSummary,
  side: "home" | "away",
): string {
  const schoolId = side === "home" ? match.homeSchoolId : match.awaySchoolId;
  const persisted =
    side === "home" ? match.homeDisplayName : match.awayDisplayName;
  return persisted ?? state.schools[schoolId]?.shortName ?? "相手校";
}

function buildSummary(
  state: GameState,
  homeStrength: number,
  players: readonly Player[],
): HomeSummary {
  const school = state.schools[state.userSchoolId];
  if (!school) throw new Error(`user school not found: ${state.userSchoolId}`);

  const condition = getPlayerConditionPresentation(
    average(players.map((player) => player.condition)),
  );
  const nextOfficial = selectNextOfficialEvent(state);
  const official = nextOfficial
    ? nextOfficial.kind === "match"
      ? {
          competitionLabel: `${circuitLabels[nextOfficial.circuit]} ${levelLabels[nextOfficial.level]}`,
          detailLabel: `${roundLabels[nextOfficial.round]} vs ${nextOfficial.opponent.shortName}`,
          detailTitle: nextOfficial.opponent.displayName,
          timingLabel:
            nextOfficial.timing === "due"
              ? "今週"
              : `あと${nextOfficial.weeksUntil}週`,
          due: nextOfficial.timing === "due",
        }
      : {
          competitionLabel: `${circuitLabels[nextOfficial.circuit]} ${levelLabels[nextOfficial.level]}`,
          detailLabel: `第${nextOfficial.scheduledWeek}週 開幕`,
          detailTitle: null,
          timingLabel: `あと${nextOfficial.weeksUntil}週`,
          due: false,
        }
    : null;
  const seasonProgress = buildSeasonProgressPresentation(state);
  const primaryGoal = seasonProgress
    ? (seasonProgress.goals.find((goal) => !goal.achieved) ??
      seasonProgress.goals[0] ??
      null)
    : null;

  return {
    dateLabel: shortDate(state.date),
    weekLabel: `第${state.calendar.weekOfYear}週`,
    schoolName: school.shortName || school.name,
    strength: homeStrength,
    strengthGrade: schoolStrengthToGrade(homeStrength),
    condition: {
      label: condition.label,
      icon: condition.icon,
      colorToken: condition.colorToken,
    },
    cohesion: state.teamDynamics.cohesion,
    cohesionTrend: state.teamDynamics.cohesionTrend,
    official,
    season: seasonProgress
      ? {
          academicYear: seasonProgress.academicYear,
          ambitionLabel: seasonProgress.ambitionLabel,
          remainingRewardFunds: seasonProgress.remainingRewardFunds,
          achievedCount: seasonProgress.achievedCount,
          goalCount: seasonProgress.goalCount,
          primaryGoal,
          regional: {
            rank: seasonProgress.regional.rank,
            movement: seasonProgress.regional.movement,
          },
          national: {
            rank: seasonProgress.national.rank,
            movement: seasonProgress.national.movement,
          },
        }
      : null,
  };
}

function playerConcernTasks(state: GameState): TaskCandidate[] {
  const school = state.schools[state.userSchoolId];
  if (!school) return [];

  const candidates = school.playerIds.flatMap((playerId) => {
    const player = state.players[playerId];
    if (!player) return [];
    const guidance = [...selectPlayerConcernGuidance(state, playerId)].sort(
      (left, right) =>
        right.severity - left.severity || left.code.localeCompare(right.code),
    )[0];
    return guidance ? [{ player, guidance }] : [];
  });

  return candidates
    .sort(
      (left, right) =>
        right.guidance.severity - left.guidance.severity ||
        right.player.grade - left.player.grade ||
        String(left.player.id).localeCompare(String(right.player.id)),
    )
    .slice(0, 2)
    .map(({ player, guidance }, index) => ({
      order: 20 + index,
      task: {
        id: `player-concern:${player.id}:${guidance.code}`,
        kind: "action",
        priority: "attention",
        category: "player",
        title: "選手から相談",
        detail: `${player.lastName} ${player.firstName}・${guidance.title}・${guidance.progressLabel}・${guidance.resolution}`,
        action: { target: "player", playerId: player.id },
        actionLabel: "確認",
        complete: false,
      },
    }));
}

function injuryTask(players: readonly Player[]): TaskCandidate | null {
  const injured = players
    .filter((player) => player.injury)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  if (injured.length === 0) return null;

  if (injured.length === 1) {
    const player = injured[0]!;
    return {
      order: 30,
      task: {
        id: `injury:${player.id}`,
        kind: "action",
        priority: "attention",
        category: "injury",
        title: "注意",
        detail: `${player.lastName} ${player.firstName}・怪我・あと${player.injury!.remainingWeeks}週`,
        action: { target: "player", playerId: player.id },
        actionLabel: "確認",
        complete: false,
      },
    };
  }

  return {
    order: 30,
    task: {
      id: "injury:multiple",
      kind: "action",
      priority: "attention",
      category: "injury",
      title: `怪我人 ${injured.length}名`,
      detail: "選手の状態を確認してください",
      action: { target: "team" },
      actionLabel: "選手を確認",
      complete: false,
    },
  };
}

function buildTasks(
  state: GameState,
  data: Pick<
    GameDataRegistry,
    "trainingMenus" | "individualTrainingInstructions"
  >,
  players: readonly Player[],
): HomeCommandTask[] {
  const school = state.schools[state.userSchoolId];
  if (!school) return [];
  const candidates: TaskCandidate[] = [];
  const nextOfficial = selectNextOfficialEvent(state);

  if (nextOfficial?.kind === "match" && nextOfficial.timing === "due") {
    candidates.push({
      order: 0,
      task: {
        id: `official:${nextOfficial.matchId}`,
        kind: "action",
        priority: "critical",
        category: "official",
        title: "公式戦",
        detail: `${levelLabels[nextOfficial.level]} ${roundLabels[nextOfficial.round]}・vs ${nextOfficial.opponent.shortName}`,
        action: { target: "start-week-match" },
        actionLabel: "試合準備",
        complete: false,
      },
    });
  }

  const practice = state.weeklySchedule.practiceMatch;
  if (practice.incomingOffer && !practice.scheduledOpponentId) {
    const offerSchool = state.schools[practice.incomingOffer.schoolId];
    const strength = schoolStrength(state, practice.incomingOffer.schoolId);
    candidates.push({
      order: 10,
      task: {
        id: `practice-offer:${practice.incomingOffer.schoolId}`,
        kind: "practice-offer",
        priority: "critical",
        category: "practice",
        title: "練習試合の申し込み",
        detail: `${offerSchool?.shortName ?? offerSchool?.name ?? "相手校"}から申し込み`,
        offer: {
          schoolId: practice.incomingOffer.schoolId,
          schoolName: offerSchool?.shortName ?? offerSchool?.name ?? "相手校",
          strength,
          strengthGrade:
            strength === null ? null : schoolStrengthToGrade(strength),
          growthRating: practice.incomingOffer.growthRating,
          loadRating: practice.incomingOffer.loadRating,
        },
      },
    });
  }

  if (!practice.incomingOffer && !practice.scheduledOpponentId) {
    const recommendation = selectPracticeRecommendation(state);
    if (recommendation) {
      const opponent = state.schools[recommendation.candidate.schoolId];
      candidates.push({
        order: 35,
        task: {
          id: `practice-recommendation:${recommendation.candidate.schoolId}`,
          kind: "action",
          priority: "normal",
          category: "practice",
          title: "今週の練習試合候補",
          detail: `${state.seasonGoals?.ambition === "steady" ? "安定" : state.seasonGoals?.ambition === "bold" ? "野心" : "挑戦"}方針・${opponent?.shortName ?? opponent?.name ?? "相手校"}・${practiceTierLabels[recommendation.tier]}・成立 ${recommendation.candidate.acceptancePercent}%・成長 ${recommendation.candidate.growthRating}/5`,
          action: { target: "practice" },
          actionLabel: "候補を見る",
          complete: false,
        },
      });
    }
  }

  candidates.push(...playerConcernTasks(state));
  const injury = injuryTask(players);
  if (injury) candidates.push(injury);

  const practiceCompleted = isWeeklyActionCompleted(state, "practice-match");
  if (practice.scheduledOpponentId && !practiceCompleted) {
    const opponent = state.schools[practice.scheduledOpponentId];
    candidates.push({
      order: 40,
      task: {
        id: `practice:${practice.scheduledOpponentId}`,
        kind: "action",
        priority: "normal",
        category: "practice",
        title: "練習試合",
        detail: `vs ${opponent?.shortName ?? opponent?.name ?? "相手校"}`,
        action: { target: "practice" },
        actionLabel: "試合",
        complete: false,
      },
    });
  }

  const trainingCompleted = isWeeklyActionCompleted(state, "training");
  const assignmentByPlayerId = new Map(
    state.weeklySchedule.trainingPlan.individualAssignments
      .filter((assignment) => school.playerIds.includes(assignment.playerId))
      .map((assignment) => [assignment.playerId, assignment.instructionId]),
  );
  const instructionCounts = new Map<string, { name: string; count: number }>();
  let configuredCount = 0;
  for (const playerId of school.playerIds) {
    const instructionId = assignmentByPlayerId.get(playerId);
    if (!instructionId) continue;
    const instruction = data.individualTrainingInstructions.get(instructionId);
    if (!instruction) continue;
    configuredCount += 1;
    const current = instructionCounts.get(instruction.id);
    instructionCounts.set(instruction.id, {
      name: instruction.name,
      count: (current?.count ?? 0) + 1,
    });
  }
  const unconfiguredCount = school.playerIds.length - configuredCount;
  const individualSummary = [...instructionCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, summary]) => `${summary.name} ${summary.count}名`);
  if (unconfiguredCount > 0) {
    individualSummary.push(`未設定 ${unconfiguredCount}名`);
  }
  individualSummary.push(
    `設定済み ${configuredCount}/${school.playerIds.length}名`,
  );
  const needsIndividualSetup = !trainingCompleted && unconfiguredCount > 0;
  candidates.push({
    order: 50,
    task: {
      id: "training:weekly",
      kind: "action",
      priority: trainingCompleted ? "complete" : "normal",
      category: "training",
      title: "個人練習",
      detail: trainingCompleted
        ? `${individualSummary.join("・")}・今週分完了 ✓`
        : individualSummary.join("・"),
      action: needsIndividualSetup ? { target: "team" } : undefined,
      actionLabel: needsIndividualSetup ? "個人練習を設定" : undefined,
      complete: trainingCompleted,
    },
  });

  const affordableFacilities = FACILITY_DEFINITIONS.filter(
    (definition) =>
      evaluateFacilityUpgrade(state, school.id, definition.key).allowed,
  );
  if (affordableFacilities.length > 0) {
    candidates.push({
      order: 60,
      task: {
        id: "facility:affordable",
        kind: "action",
        priority: "normal",
        category: "facility",
        title: `強化可能な設備 ${affordableFacilities.length}件`,
        detail: "学校設備を強化できます",
        action: { target: "school", view: "facilities" },
        actionLabel: "設備を見る",
        complete: false,
      },
    });
  }

  const contract = state.schoolManagement.assistantCoach;
  const hasCurrentCoach = contract?.contractYearIndex === state.yearIndex;
  if (
    !hasCurrentCoach &&
    state.calendar.weekOfYear >= 1 &&
    state.calendar.weekOfYear <= 8
  ) {
    candidates.push({
      order: 70,
      task: {
        id: "staff:assistant-coach",
        kind: "action",
        priority: "normal",
        category: "staff",
        title: "年間コーチ未契約",
        detail: "年度前半にスタッフ契約を確認できます",
        action: { target: "school", view: "staff" },
        actionLabel: "スタッフを見る",
        complete: false,
      },
    });
  }

  return candidates
    .sort(
      (left, right) =>
        priorityWeight[left.task.priority] -
          priorityWeight[right.task.priority] ||
        left.order - right.order ||
        left.task.id.localeCompare(right.task.id),
    )
    .slice(0, 5)
    .map((candidate) => candidate.task);
}

function buildNews(state: GameState): HomeCommandNews[] {
  const candidates: NewsCandidate[] = [];
  const notification = selectHomeTrainingNotifications(state.notifications)[0];
  const concernResolution = selectHomeConcernResolutionNotifications(
    state.notifications,
  )[0];
  const specialRelationship = selectHomeSpecialRelationshipNotifications(
    state.notifications,
  )[0];
  const characterTraitDiscovery = selectHomeCharacterTraitNotifications(
    state.notifications,
  )[0];
  const developmentGoalAchievement =
    selectHomeDevelopmentGoalAchievementNotifications(state.notifications)[0];
  const seasonGoalAchievement = selectHomeSeasonGoalAchievementNotifications(
    state.notifications,
  )[0];

  if (seasonGoalAchievement) {
    const items = seasonGoalAchievement.payload.items;
    candidates.push({
      order: seasonGoalAchievement.readAtGameDate === null ? -2 : 38,
      news: {
        id: `news:season-goal:${seasonGoalAchievement.id}`,
        kind: "season-goal-achieved",
        title: "シーズン目標達成！",
        detail:
          items.length === 1
            ? `${items[0]!.label}・年度末 +${items[0]!.rewardFunds}`
            : `${items.length}目標達成・年度末 +${seasonGoalAchievement.payload.totalRewardFunds}`,
        notification: seasonGoalAchievement,
      },
    });
  }

  if (developmentGoalAchievement) {
    const items = developmentGoalAchievement.payload.items;
    candidates.push({
      order: developmentGoalAchievement.readAtGameDate === null ? -1 : 39,
      news: {
        id: `news:development-goal:${developmentGoalAchievement.id}`,
        kind: "development-goal-achieved",
        title: "育成目標達成！",
        detail:
          items.length === 1
            ? `${items[0]!.displayName}・${items[0]!.areaLabel} ${items[0]!.targetGrade}達成`
            : `${items.length}人が育成目標を達成`,
        notification: developmentGoalAchievement,
      },
    });
  }

  if (concernResolution) {
    candidates.push({
      order: concernResolution.readAtGameDate === null ? 1 : 41,
      news: {
        id: `news:concern:${concernResolution.id}`,
        kind: "concern-resolution",
        title: "選手の不満が解消",
        detail: concernResolution.payload.items
          .map((item) => `${item.displayName}・${item.concernTitle}`)
          .join(" / "),
        notification: concernResolution,
      },
    });
  }

  if (specialRelationship) {
    const actionLabel =
      specialRelationship.payload.action === "established" ? "成立" : "解消";
    candidates.push({
      order: specialRelationship.readAtGameDate === null ? 2 : 42,
      news: {
        id: `news:relationship:${specialRelationship.id}`,
        kind: "special-relationship",
        title: `${specialRelationship.payload.kindLabel}関係が${actionLabel}`,
        detail: `${specialRelationship.payload.displayNames[0]} × ${specialRelationship.payload.displayNames[1]}`,
        notification: specialRelationship,
      },
    });
  }

  if (characterTraitDiscovery) {
    candidates.push({
      order: characterTraitDiscovery.readAtGameDate === null ? 3 : 43,
      news: {
        id: `news:character-trait:${characterTraitDiscovery.id}`,
        kind: "character-trait-discovered",
        title: "新しい個性を発見！",
        detail: `${characterTraitDiscovery.payload.displayName}・${characterTraitDiscovery.payload.traitName}`,
        notification: characterTraitDiscovery,
      },
    });
  }

  if (notification) {
    const rankUps = notification.payload.players.flatMap((player) =>
      (player.rankUps ?? []).map((rankUp) => ({
        displayName: player.displayName,
        ...rankUp,
      })),
    );
    const firstRankUp = rankUps[0];
    candidates.push({
      order: notification.readAtGameDate === null ? 0 : 40,
      news: {
        id: `news:training:${notification.id}`,
        kind: "training-result",
        title: rankUps.length > 0 ? "能力ランクアップ！" : "今週の練習",
        detail: firstRankUp
          ? `${firstRankUp.displayName}・${firstRankUp.areaLabel} ${firstRankUp.fromGrade}→${firstRankUp.toGrade}${rankUps.length > 1 ? `・ほか${rankUps.length - 1}件` : ""}`
          : `${notification.payload.teamTrainingMenuName}・成長 ${signed(notification.payload.totalAbilityGrowth)}・怪我 ${notification.payload.injuredCount}人`,
        notification,
      },
    });
  }

  const latestMatch = latestUserMatch(state);
  if (latestMatch) {
    const userWasHome = latestMatch.homeSchoolId === state.userSchoolId;
    const userSets = userWasHome
      ? latestMatch.homeSetsWon
      : latestMatch.awaySetsWon;
    const opponentSets = userWasHome
      ? latestMatch.awaySetsWon
      : latestMatch.homeSetsWon;
    const opponentName = matchSchoolName(
      state,
      latestMatch,
      userWasHome ? "away" : "home",
    );
    const won = latestMatch.winnerSchoolId === state.userSchoolId;
    candidates.push({
      order: 10,
      news: {
        id: `news:match:${latestMatch.matchId}`,
        kind: "match",
        title: "前節",
        detail: `${won ? "○" : "●"} ${userSets}-${opponentSets} ${opponentName}`,
      },
    });
  }

  if (notification) {
    const growth = [...notification.payload.players]
      .filter((player) => player.totalAbilityGrowth >= 5)
      .sort(
        (left, right) =>
          right.totalAbilityGrowth - left.totalAbilityGrowth ||
          String(left.playerId).localeCompare(String(right.playerId)),
      )[0];
    if (growth) {
      candidates.push({
        order: 20,
        news: {
          id: `news:growth:${notification.id}:${growth.playerId}`,
          kind: "growth",
          title: "急成長",
          detail: `${growth.displayName}・今週 ${signed(growth.totalAbilityGrowth)}`,
          playerId: growth.playerId,
        },
      });
    }
  }

  const cohesionDelta =
    state.teamDynamics.cohesion - state.teamDynamics.previousCohesion;
  if (Math.abs(cohesionDelta) >= 3) {
    candidates.push({
      order: 30,
      news: {
        id: `news:cohesion:${state.yearIndex}:${state.calendar.weekOfYear}:${state.teamDynamics.previousCohesion}:${state.teamDynamics.cohesion}`,
        kind: "cohesion",
        title: "チーム状態",
        detail: `結束 ${state.teamDynamics.previousCohesion} → ${state.teamDynamics.cohesion}・${cohesionTrendLabels[state.teamDynamics.cohesionTrend]}`,
      },
    });
  }

  return candidates
    .sort(
      (left, right) =>
        left.order - right.order || left.news.id.localeCompare(right.news.id),
    )
    .slice(0, 3)
    .map((candidate) => candidate.news);
}

export function selectHomeCommandCenter(input: {
  state: GameState;
  data: Pick<
    GameDataRegistry,
    "trainingMenus" | "individualTrainingInstructions"
  >;
  homeStrength: number;
}): HomeCommandCenterModel {
  const school = input.state.schools[input.state.userSchoolId];
  if (!school) {
    throw new Error(`user school not found: ${input.state.userSchoolId}`);
  }
  const players = school.playerIds
    .map((playerId) => input.state.players[playerId])
    .filter((player): player is Player => Boolean(player));
  const unansweredOffer = Boolean(
    input.state.weeklySchedule.practiceMatch.incomingOffer &&
    !input.state.weeklySchedule.practiceMatch.scheduledOpponentId,
  );

  return {
    summary: buildSummary(input.state, input.homeStrength, players),
    tasks: buildTasks(input.state, input.data, players),
    news: buildNews(input.state),
    advance: {
      requiresConfirmation: unansweredOffer,
      reason: unansweredOffer ? "practice-offer" : null,
    },
  };
}
