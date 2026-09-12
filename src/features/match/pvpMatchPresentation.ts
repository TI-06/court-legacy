import type { MatchStepResult } from "../../domain/match/simulateMatch";
import type {
  MatchEvent,
  MatchRuntimeState,
  MatchSetState,
  MatchState,
} from "../../domain/model/Match";
import { matchId, schoolId } from "../../domain/model/identifiers";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type {
  PvpChallengeInProgressResponse,
  PvpMatchSegment,
} from "../../domain/pvp/pvpContracts";

const EMPTY_SELECTION: TeamSelection = {
  rotation: [],
  liberoPlayerId: null,
  benchPlayerIds: [],
  servingOrderPlayerIds: [],
  substitutionPolicy: {
    starterLockPlayerIds: [],
    allowFatigueBenching: false,
    allowInjuryBenching: true,
    automaticSubstitutions: false,
    automaticSetChanges: false,
  },
};

const DEFAULT_OPPONENT_TACTICS = {
  serve: "balanced" as const,
  attack: "balanced" as const,
  block: "read" as const,
};

function opponentSchoolId(snapshotId: string) {
  return schoolId(`pvp-opponent:${snapshotId}`);
}

function winnerSchoolId(
  winner: "challenger" | "defender" | null,
  homeSchoolId: ReturnType<typeof schoolId>,
  awaySchoolId: ReturnType<typeof schoolId>,
) {
  if (winner === "challenger") return homeSchoolId;
  if (winner === "defender") return awaySchoolId;
  return null;
}

function setsFromSegment(
  segment: PvpMatchSegment,
  homeSchoolId: ReturnType<typeof schoolId>,
  awaySchoolId: ReturnType<typeof schoolId>,
): MatchSetState[] {
  return segment.sets.map((set) => ({
    setNumber: set.setNumber,
    homeScore: set.challengerScore,
    awayScore: set.defenderScore,
    completed: set.completed,
    winnerSchoolId: winnerSchoolId(set.winner, homeSchoolId, awaySchoolId),
  }));
}

function eventsFromSegment(
  segment: PvpMatchSegment,
  homeSchoolId: ReturnType<typeof schoolId>,
  awaySchoolId: ReturnType<typeof schoolId>,
): MatchEvent[] {
  return segment.events.map((event) => ({
    sequence: event.sequence,
    type: event.type,
    setNumber: event.setNumber,
    homeScore: event.challengerScore,
    awayScore: event.defenderScore,
    actorPlayerId: null,
    targetPlayerId: null,
    winnerSchoolId: winnerSchoolId(event.winner, homeSchoolId, awaySchoolId),
    detailCode: event.detailCode,
  }));
}

function runtimeFromSegment(
  segment: PvpMatchSegment,
  homeSchoolId: ReturnType<typeof schoolId>,
): MatchRuntimeState {
  return {
    controlledSchoolId: homeSchoolId,
    homeScore: segment.currentScore.challenger,
    awayScore: segment.currentScore.defender,
    homeTactics: segment.challengerTactics,
    awayTactics: DEFAULT_OPPONENT_TACTICS,
    homeBaseSelection: segment.challengerSelection,
    awayBaseSelection: EMPTY_SELECTION,
    runWinnerSchoolId: null,
    runLength: 0,
    opponentRunDecisionConsumed: false,
    timeoutUsedSchoolIds: segment.timeoutAvailable ? [] : [homeSchoolId],
    timeoutBoost: null,
    pendingDecisionReason: segment.pendingDecisionReason,
    commandHistory: [],
    ralliesInCurrentSet: 0,
  };
}

export interface PvpMatchScreenPresentation {
  result: MatchStepResult;
  opponent: {
    id: ReturnType<typeof schoolId>;
    name: string;
    shortName: string;
  };
  homeSelection: TeamSelection;
  awaySelection: TeamSelection;
  schoolDisplayNames: Partial<Record<ReturnType<typeof schoolId>, string>>;
}

export function buildPvpMatchScreenPresentation(
  userSchoolId: ReturnType<typeof schoolId>,
  response: PvpChallengeInProgressResponse,
): PvpMatchScreenPresentation {
  const awaySchoolId = opponentSchoolId(response.opponent.snapshotId);
  const segment = response.segment;
  const match: MatchState = {
    id: matchId(segment.matchId),
    homeSchoolId: userSchoolId,
    awaySchoolId,
    homeSelection: segment.challengerSelection,
    awaySelection: EMPTY_SELECTION,
    bestOfSets: 3,
    phase: segment.phase,
    currentSetNumber: segment.currentSetNumber,
    homeSetsWon: segment.challengerSetsWon,
    awaySetsWon: segment.defenderSetsWon,
    sets: setsFromSegment(segment, userSchoolId, awaySchoolId),
    servingSchoolId: userSchoolId,
    pendingCoachCommandForSchoolId: segment.pendingDecisionReason
      ? userSchoolId
      : null,
    eventLog: eventsFromSegment(segment, userSchoolId, awaySchoolId),
    randomSeed: "public-pvp-segment",
    randomCursor: segment.events.length,
    runtime: runtimeFromSegment(segment, userSchoolId),
  };

  return {
    result: { match, analysis: null },
    opponent: {
      id: awaySchoolId,
      name: response.opponent.schoolName,
      shortName: response.opponent.schoolShortName,
    },
    homeSelection: segment.challengerSelection,
    awaySelection: EMPTY_SELECTION,
    schoolDisplayNames: {
      [userSchoolId]: "自校",
      [awaySchoolId]: response.opponent.schoolName,
    },
  };
}
