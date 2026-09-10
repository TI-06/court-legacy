import type { GameState } from "../model/GameState";
import type {
  CoachDecisionReason,
  MatchCommand,
  MatchEvent,
  MatchRuntimeState,
  MatchState,
} from "../model/Match";
import type { TeamSelection } from "../model/TeamSelection";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type { MatchTacticPlan } from "../team/matchTactics";
import { validateTeamSelection } from "../team/validateTeamSelection";

export class MatchCommandValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MatchCommandValidationError";
  }
}

export interface ApplyMatchCommandInput {
  state: GameState;
  match: MatchState;
  schoolId: SchoolId;
  command: MatchCommand;
}

function fail(code: string, message: string): never {
  throw new MatchCommandValidationError(code, message);
}

function runtimeOrFail(match: MatchState): MatchRuntimeState {
  if (!match.runtime) {
    return fail("match_runtime_missing", "試合中の監督指示情報がありません");
  }
  return match.runtime;
}

function cloneSelection(selection: TeamSelection): TeamSelection {
  return {
    rotation: selection.rotation.map((assignment) => ({ ...assignment })),
    liberoPlayerId: selection.liberoPlayerId,
    benchPlayerIds: [...selection.benchPlayerIds],
    servingOrderPlayerIds: [...selection.servingOrderPlayerIds],
    substitutionPolicy: {
      ...selection.substitutionPolicy,
      starterLockPlayerIds: [
        ...selection.substitutionPolicy.starterLockPlayerIds,
      ],
    },
  };
}

function isMatchSchool(match: MatchState, schoolId: SchoolId): boolean {
  return schoolId === match.homeSchoolId || schoolId === match.awaySchoolId;
}

function selectionForSchool(
  match: MatchState,
  schoolId: SchoolId,
): TeamSelection {
  if (schoolId === match.homeSchoolId) return match.homeSelection;
  if (schoolId === match.awaySchoolId) return match.awaySelection;
  return fail(
    "command_school_not_in_match",
    "この学校は試合に参加していません",
  );
}

function baseSelectionForSchool(
  match: MatchState,
  runtime: MatchRuntimeState,
  schoolId: SchoolId,
): TeamSelection {
  if (schoolId === match.homeSchoolId) return runtime.homeBaseSelection;
  if (schoolId === match.awaySchoolId) return runtime.awayBaseSelection;
  return fail(
    "command_school_not_in_match",
    "この学校は試合に参加していません",
  );
}

function setSelectionForSchool(
  match: MatchState,
  schoolId: SchoolId,
  current: TeamSelection,
  base: TeamSelection,
): void {
  const runtime = runtimeOrFail(match);
  if (schoolId === match.homeSchoolId) {
    match.homeSelection = current;
    runtime.homeBaseSelection = base;
    return;
  }
  if (schoolId === match.awaySchoolId) {
    match.awaySelection = current;
    runtime.awayBaseSelection = base;
    return;
  }
  fail("command_school_not_in_match", "この学校は試合に参加していません");
}

function setTacticsForSchool(
  match: MatchState,
  schoolId: SchoolId,
  plan: MatchTacticPlan,
): void {
  const runtime = runtimeOrFail(match);
  if (schoolId === match.homeSchoolId) {
    runtime.homeTactics = structuredClone(plan);
    return;
  }
  if (schoolId === match.awaySchoolId) {
    runtime.awayTactics = structuredClone(plan);
    return;
  }
  fail("command_school_not_in_match", "この学校は試合に参加していません");
}

function isValidTacticPlan(plan: MatchTacticPlan): boolean {
  return (
    ["safe", "balanced", "aggressive"].includes(plan.serve) &&
    ["side", "balanced", "quick"].includes(plan.attack) &&
    ["commit", "mixed", "read"].includes(plan.block)
  );
}

function ensureCommandAllowed(
  reason: CoachDecisionReason,
  command: MatchCommand,
): void {
  if (reason === "set-break" && command.type === "timeout") {
    fail(
      "command_not_allowed_for_decision",
      "セット間ではタイムアウトを使用できません",
    );
  }
}

function createCommandEvent(
  match: MatchState,
  type: "timeout" | "substitution",
  schoolId: SchoolId,
  actorPlayerId: PlayerId | null,
  targetPlayerId: PlayerId | null,
  detailCode: string,
): MatchEvent {
  const runtime = runtimeOrFail(match);
  return {
    sequence: match.eventLog.length + 1,
    type,
    setNumber: match.currentSetNumber,
    homeScore: runtime.homeScore,
    awayScore: runtime.awayScore,
    actorPlayerId,
    targetPlayerId,
    winnerSchoolId: schoolId,
    detailCode,
  };
}

function replacePlayer(
  selection: TeamSelection,
  outgoingPlayerId: PlayerId,
  incomingPlayerId: PlayerId,
): TeamSelection {
  const next = cloneSelection(selection);
  next.rotation = next.rotation.map((assignment) =>
    assignment.playerId === outgoingPlayerId
      ? { ...assignment, playerId: incomingPlayerId }
      : assignment,
  );
  next.servingOrderPlayerIds = next.servingOrderPlayerIds.map((playerId) =>
    playerId === outgoingPlayerId ? incomingPlayerId : playerId,
  );
  next.benchPlayerIds = next.benchPlayerIds.map((playerId) =>
    playerId === incomingPlayerId ? outgoingPlayerId : playerId,
  );
  return next;
}

function validateSubstitution(
  state: GameState,
  schoolId: SchoolId,
  current: TeamSelection,
  base: TeamSelection,
  outgoingPlayerId: PlayerId,
  incomingPlayerId: PlayerId,
): { current: TeamSelection; base: TeamSelection } {
  if (!current.rotation.some((item) => item.playerId === outgoingPlayerId)) {
    return fail(
      "substitution_outgoing_not_on_court",
      "交代する選手は現在コート上の6人から選んでください",
    );
  }
  if (!current.benchPlayerIds.includes(incomingPlayerId)) {
    return fail(
      "substitution_incoming_not_on_bench",
      "交代で入る選手は現在のベンチから選んでください",
    );
  }
  if (outgoingPlayerId === incomingPlayerId) {
    return fail(
      "substitution_same_player",
      "同じ選手同士を交代させることはできません",
    );
  }

  const nextCurrent = replacePlayer(
    current,
    outgoingPlayerId,
    incomingPlayerId,
  );
  const nextBase = replacePlayer(base, outgoingPlayerId, incomingPlayerId);
  const currentIssues = validateTeamSelection({
    state,
    schoolId,
    selection: nextCurrent,
  });
  if (currentIssues.length > 0) {
    return fail("invalid_match_substitution", currentIssues[0]!.message);
  }
  const baseIssues = validateTeamSelection({
    state,
    schoolId,
    selection: nextBase,
  });
  if (baseIssues.length > 0) {
    return fail("invalid_match_substitution", baseIssues[0]!.message);
  }

  return { current: nextCurrent, base: nextBase };
}

export function applyMatchCommand(input: ApplyMatchCommandInput): MatchState {
  const match = structuredClone(input.match) as MatchState;
  const runtime = runtimeOrFail(match);

  if (match.phase !== "coach-decision") {
    return fail(
      "match_not_waiting_for_command",
      "現在は監督指示を受け付けるタイミングではありません",
    );
  }
  if (!isMatchSchool(match, input.schoolId)) {
    return fail(
      "command_school_not_in_match",
      "この学校は試合に参加していません",
    );
  }
  if (match.pendingCoachCommandForSchoolId !== input.schoolId) {
    return fail(
      "command_school_not_pending",
      "この学校の監督指示待ちではありません",
    );
  }
  const reason = runtime.pendingDecisionReason;
  if (!reason) {
    return fail(
      "decision_reason_missing",
      "監督指示が必要になった理由を確認できません",
    );
  }
  ensureCommandAllowed(reason, input.command);

  const historyEventSequence = match.eventLog.length;

  switch (input.command.type) {
    case "timeout": {
      if (runtime.timeoutUsedSchoolIds.includes(input.schoolId)) {
        return fail(
          "timeout_already_used",
          "このセットではすでにタイムアウトを使用しています",
        );
      }
      runtime.timeoutUsedSchoolIds.push(input.schoolId);
      runtime.timeoutBoost = {
        schoolId: input.schoolId,
        ralliesRemaining: 5,
      };
      match.eventLog.push(
        createCommandEvent(
          match,
          "timeout",
          input.schoolId,
          null,
          null,
          "timeout.coach-command",
        ),
      );
      break;
    }
    case "set-match-tactics": {
      if (!isValidTacticPlan(input.command.plan)) {
        return fail("invalid_match_tactics", "試合中戦術の指定が不正です");
      }
      setTacticsForSchool(match, input.schoolId, input.command.plan);
      break;
    }
    case "substitute": {
      const current = selectionForSchool(match, input.schoolId);
      const base = baseSelectionForSchool(match, runtime, input.schoolId);
      const replacement = validateSubstitution(
        input.state,
        input.schoolId,
        current,
        base,
        input.command.outgoingPlayerId,
        input.command.incomingPlayerId,
      );
      setSelectionForSchool(
        match,
        input.schoolId,
        replacement.current,
        replacement.base,
      );
      match.eventLog.push(
        createCommandEvent(
          match,
          "substitution",
          input.schoolId,
          input.command.incomingPlayerId,
          input.command.outgoingPlayerId,
          "substitution.coach-command",
        ),
      );
      break;
    }
    case "continue":
      break;
  }

  runtime.commandHistory.push({
    sequence: runtime.commandHistory.length + 1,
    schoolId: input.schoolId,
    setNumber: match.currentSetNumber,
    homeScore: runtime.homeScore,
    awayScore: runtime.awayScore,
    decisionReason: reason,
    command: structuredClone(input.command),
    eventSequence: historyEventSequence,
  });

  if (reason === "opponent-run") {
    runtime.opponentRunDecisionConsumed = true;
    match.phase = "set-in-progress";
  } else {
    match.phase = "set-complete";
  }
  match.pendingCoachCommandForSchoolId = null;
  runtime.pendingDecisionReason = null;

  return match;
}
