import type { GameState } from "../../src/domain/model/GameState";
import type {
  CoachDecisionReason,
  MatchCommand,
  MatchEventType,
  MatchPhase,
  MatchState,
} from "../../src/domain/model/Match";
import { matchId, type SchoolId } from "../../src/domain/model/identifiers";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import { applyMatchCommand } from "../../src/domain/match/applyMatchCommand";
import {
  resumeMatch,
  startMatch,
  type AutomaticCoachPolicy,
} from "../../src/domain/match/simulateMatch";
import { SeededRandom } from "../../src/domain/random/SeededRandom";
import type { MatchTacticPlan } from "../../src/domain/team/matchTactics";
import type { CloudGameSnapshot } from "../data/GameStore";
import type { PublishedPvpTeamSnapshot } from "../data/PvPStore";
import { chooseAutomaticDefenderCommand } from "./automaticDefenderCoach";
import { buildPvpSimulationState } from "./buildPvpSimulationState";

export interface PvpPublicMatchEvent {
  sequence: number;
  type: MatchEventType;
  setNumber: number;
  challengerScore: number;
  defenderScore: number;
  winner: "challenger" | "defender" | null;
  detailCode: string;
}

export interface PvpPublicSetState {
  setNumber: number;
  challengerScore: number;
  defenderScore: number;
  completed: boolean;
  winner: "challenger" | "defender" | null;
}

export interface PvpMatchSegment {
  status: "in-progress" | "complete";
  operationId: string;
  matchId: string;
  phase: MatchPhase;
  currentSetNumber: number;
  challengerSetsWon: number;
  defenderSetsWon: number;
  currentScore: {
    challenger: number;
    defender: number;
  };
  challengerSelection: TeamSelection;
  challengerTactics: MatchTacticPlan;
  timeoutAvailable: boolean;
  sets: PvpPublicSetState[];
  pendingDecisionReason: CoachDecisionReason | null;
  events: PvpPublicMatchEvent[];
}

export interface PvpServerMatchSession {
  operationId: string;
  challengerUserId: string;
  defenderUserId: string;
  defenderSnapshotId: string;
  challengerSourceRevision: number;
  seasonId: string;
  challengeDayKey: string;
  matchSeed: string;
  simulationState: GameState;
  challengerSchoolId: SchoolId;
  defenderSchoolId: SchoolId;
  match: MatchState;
  finalized: boolean;
}

export interface StartPvpMatchSessionInput {
  operationId: string;
  challenger: CloudGameSnapshot;
  defender: PublishedPvpTeamSnapshot;
  challengerSourceRevision: number;
  seasonId: string;
  challengeDayKey: string;
  matchSeed: string;
  matchTactics?: MatchTacticPlan;
}

export interface ResumePvpMatchSessionInput {
  session: PvpServerMatchSession;
  command: MatchCommand;
}

export interface PvpMatchSessionStep {
  session: PvpServerMatchSession;
  segment: PvpMatchSegment;
}

function automaticCoachForSession(
  defenderSchoolId: SchoolId,
): AutomaticCoachPolicy {
  return ({ state, match, schoolId, reason }) => {
    if (schoolId !== defenderSchoolId) {
      throw new Error("automatic PvP coach may only control the defender");
    }
    const school = state.schools[schoolId];
    if (!school) {
      throw new Error("PvP defender school is missing from simulation state");
    }
    return chooseAutomaticDefenderCommand({
      school,
      reason,
      timeoutAlreadyUsed:
        match.runtime?.timeoutUsedSchoolIds.includes(schoolId) ?? false,
    });
  };
}

function sideForSchool(
  challengerSchoolId: SchoolId,
  schoolId: SchoolId | null,
): "challenger" | "defender" | null {
  if (schoolId === null) return null;
  return schoolId === challengerSchoolId ? "challenger" : "defender";
}

export function buildPvpPublicSegment(
  session: PvpServerMatchSession,
): PvpMatchSegment {
  const runtime = session.match.runtime;
  if (!runtime) {
    throw new Error("PvP match runtime is missing");
  }
  const pendingDecisionReason =
    session.match.pendingCoachCommandForSchoolId === session.challengerSchoolId
      ? runtime.pendingDecisionReason
      : null;

  return {
    status:
      session.match.phase === "match-complete" ? "complete" : "in-progress",
    operationId: session.operationId,
    matchId: session.match.id,
    phase: session.match.phase,
    currentSetNumber: session.match.currentSetNumber,
    challengerSetsWon: session.match.homeSetsWon,
    defenderSetsWon: session.match.awaySetsWon,
    currentScore: {
      challenger: runtime.homeScore,
      defender: runtime.awayScore,
    },
    challengerSelection: session.match.homeSelection,
    challengerTactics: runtime.homeTactics,
    timeoutAvailable:
      pendingDecisionReason === "opponent-run" &&
      !runtime.timeoutUsedSchoolIds.includes(session.challengerSchoolId),
    sets: session.match.sets.map((set) => ({
      setNumber: set.setNumber,
      challengerScore: set.homeScore,
      defenderScore: set.awayScore,
      completed: set.completed,
      winner: sideForSchool(session.challengerSchoolId, set.winnerSchoolId),
    })),
    pendingDecisionReason,
    events: session.match.eventLog.map((event) => ({
      sequence: event.sequence,
      type: event.type,
      setNumber: event.setNumber,
      challengerScore: event.homeScore,
      defenderScore: event.awayScore,
      winner: sideForSchool(session.challengerSchoolId, event.winnerSchoolId),
      detailCode: event.detailCode,
    })),
  };
}

export function startPvpMatchSession(
  input: StartPvpMatchSessionInput,
): PvpMatchSessionStep {
  const simulation = buildPvpSimulationState({
    challenger: {
      userId: input.challenger.userId,
      state: input.challenger.state,
      teamSelection: input.challenger.teamSelection,
    },
    defender: input.defender,
    matchTactics: input.matchTactics,
  });
  const resolved = startMatch({
    state: simulation.state,
    id: matchId(`pvp:${input.matchSeed}`),
    homeSchoolId: simulation.challengerSchoolId,
    awaySchoolId: simulation.defenderSchoolId,
    homeSelection: simulation.challengerSelection,
    awaySelection: simulation.defenderSelection,
    bestOfSets: 3,
    random: new SeededRandom(input.matchSeed),
    controlledSchoolId: simulation.challengerSchoolId,
    automaticCoachSchoolId: simulation.defenderSchoolId,
    automaticCoach: automaticCoachForSession(simulation.defenderSchoolId),
  });
  const session: PvpServerMatchSession = {
    operationId: input.operationId,
    challengerUserId: input.challenger.userId,
    defenderUserId: input.defender.userId,
    defenderSnapshotId: input.defender.id,
    challengerSourceRevision: input.challengerSourceRevision,
    seasonId: input.seasonId,
    challengeDayKey: input.challengeDayKey,
    matchSeed: input.matchSeed,
    simulationState: simulation.state,
    challengerSchoolId: simulation.challengerSchoolId,
    defenderSchoolId: simulation.defenderSchoolId,
    match: resolved.match,
    finalized: false,
  };

  return { session, segment: buildPvpPublicSegment(session) };
}

export function resumePvpMatchSession(
  input: ResumePvpMatchSessionInput,
): PvpMatchSessionStep {
  if (input.session.finalized) {
    throw new Error("finalized PvP match session cannot be resumed");
  }
  const commandedMatch = applyMatchCommand({
    state: input.session.simulationState,
    match: input.session.match,
    schoolId: input.session.challengerSchoolId,
    command: input.command,
  });
  const resolved = resumeMatch({
    state: input.session.simulationState,
    match: commandedMatch,
    automaticCoachSchoolId: input.session.defenderSchoolId,
    automaticCoach: automaticCoachForSession(input.session.defenderSchoolId),
  });
  const session: PvpServerMatchSession = {
    ...input.session,
    match: resolved.match,
  };

  return { session, segment: buildPvpPublicSegment(session) };
}
