import type { GameState } from "../../src/domain/model/GameState";
import type {
  CoachDecisionReason,
  MatchCommand,
  MatchEventType,
  MatchPhase,
  MatchState,
} from "../../src/domain/model/Match";
import {
  matchId,
  playerId,
  type PlayerId,
  type SchoolId,
} from "../../src/domain/model/identifiers";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import {
  applyMatchCommand,
  MatchCommandValidationError,
} from "../../src/domain/match/applyMatchCommand";
import {
  resumeMatch,
  startMatch,
  type AutomaticCoachPolicy,
} from "../../src/domain/match/simulateMatch";
import { SeededRandom } from "../../src/domain/random/SeededRandom";
import type { MatchTacticPlan } from "../../src/domain/team/matchTactics";
import type { PvpPublicOpponentTarget } from "../../src/domain/pvp/pvpContracts";
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
  opponentTargets?: PvpPublicOpponentTarget[];
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

const PUBLIC_TARGET_PREFIX = "pvp-public:";

function publicCourtTargetId(slot: number): PlayerId {
  return playerId(`${PUBLIC_TARGET_PREFIX}r${slot}`);
}

function publicLiberoTargetId(): PlayerId {
  return playerId(`${PUBLIC_TARGET_PREFIX}libero`);
}

function publicOpponentTargets(
  session: PvpServerMatchSession,
): PvpPublicOpponentTarget[] {
  const targets: PvpPublicOpponentTarget[] =
    session.match.awaySelection.rotation
      .slice()
      .sort((left, right) => left.slot - right.slot)
      .flatMap((assignment) => {
        const player = session.simulationState.players[assignment.playerId];
        if (!player) return [];
        return [
          {
            playerId: publicCourtTargetId(assignment.slot),
            firstName: player.firstName,
            lastName: player.lastName,
            preferredPosition: player.preferredPosition,
            role: "court" as const,
          },
        ];
      });

  const liberoId = session.match.awaySelection.liberoPlayerId;
  if (
    liberoId &&
    !session.match.awaySelection.rotation.some(
      (assignment) => assignment.playerId === liberoId,
    )
  ) {
    const libero = session.simulationState.players[liberoId];
    if (libero) {
      targets.push({
        playerId: publicLiberoTargetId(),
        firstName: libero.firstName,
        lastName: libero.lastName,
        preferredPosition: libero.preferredPosition,
        role: "libero",
      });
    }
  }

  return targets;
}

function internalOpponentTargetId(
  session: PvpServerMatchSession,
  publicId: PlayerId,
): PlayerId | null {
  const raw = String(publicId);
  if (raw === `${PUBLIC_TARGET_PREFIX}libero`) {
    return session.match.awaySelection.liberoPlayerId;
  }
  const match = /^pvp-public:r([1-6])$/.exec(raw);
  if (!match) return null;
  const slot = Number(match[1]);
  return (
    session.match.awaySelection.rotation.find(
      (assignment) => assignment.slot === slot,
    )?.playerId ?? null
  );
}

function resolvePublicTargetCommand(
  session: PvpServerMatchSession,
  command: MatchCommand,
): MatchCommand {
  if (
    command.type !== "target-serve-receiver" &&
    command.type !== "mark-opponent-attacker"
  ) {
    return command;
  }
  const internalPlayerId = internalOpponentTargetId(session, command.playerId);
  if (!internalPlayerId) {
    throw new MatchCommandValidationError(
      "pvp_target_unavailable",
      "指定した相手選手は現在ターゲットにできません",
    );
  }
  return {
    ...command,
    playerId: internalPlayerId,
  };
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
    opponentTargets: publicOpponentTargets(session),
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
    command: resolvePublicTargetCommand(input.session, input.command),
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
