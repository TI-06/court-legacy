import { gameDataBootstrap } from "../../src/data/gameData";
import { advanceGameWeek } from "../../src/domain/calendar/academicYearProgression";
import { isWeeklyActionCompleted } from "../../src/domain/calendar/weekProgression";
import { surfaceWeeklyEvent } from "../../src/domain/events/eventPipeline";
import type { Player } from "../../src/domain/model/Player";
import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";
import { hasRequiredOfficialMatch } from "../../src/domain/tournament/progressOfficialTournaments";
import type { CloudGameSnapshot } from "../data/GameStore";
import type { GameAction } from "./actionSchema";
import {
  applyGameAction,
  GameRuleConflictError,
  type AppliedGameAction,
} from "./applyGameAction";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const gameData = gameDataBootstrap.data;

export interface ServerGameActionContext {
  userIntake?: readonly Player[];
}

export function applyServerGameAction(
  snapshot: CloudGameSnapshot,
  action: GameAction,
  context: ServerGameActionContext = {},
): AppliedGameAction {
  if (action.type !== "advance-week" || context.userIntake === undefined) {
    return applyGameAction(snapshot, action);
  }

  const state = structuredClone(snapshot.state);
  const teamSelection = structuredClone(snapshot.teamSelection);
  if (!isWeeklyActionCompleted(state, "training")) {
    throw new GameRuleConflictError(
      "training_required",
      "週を進める前に今週の練習を完了してください",
    );
  }

  if (hasRequiredOfficialMatch(state)) {
    throw new GameRuleConflictError(
      "official_match_required",
      "週を進める前に現在の公式戦を完了してください",
    );
  }

  try {
    const progression = advanceGameWeek(state, gameData, {
      userIntake: context.userIntake,
    });
    const nextState = progression.academicYearTransition
      ? progression.state
      : surfaceWeeklyEvent(progression.state, gameData);
    const nextSelection = progression.academicYearTransition
      ? autoSelectTeam({ state: nextState, schoolId: nextState.userSchoolId })
      : teamSelection;

    return {
      state: nextState,
      teamSelection: nextSelection,
      outcome: {
        academicYearTransition: progression.academicYearTransition,
        recoveredPlayerIds: progression.recoveredPlayerIds,
        healedPlayerIds: progression.healedPlayerIds,
      },
    };
  } catch (error) {
    if (error instanceof GameRuleConflictError) {
      throw error;
    }
    throw new GameRuleConflictError(
      "advance_week_unavailable",
      error instanceof Error ? error.message : "週を進められません",
    );
  }
}
