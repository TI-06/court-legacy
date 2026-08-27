import { crossesAcademicYear } from "../../src/domain/calendar/academicYearProgression";
import { advanceOneWeek } from "../../src/domain/calendar/weekProgression";
import type { Player } from "../../src/domain/model/Player";
import type { GameStore, PersistedOperationResponse } from "../data/GameStore";
import { RevisionConflictError } from "../data/GameStore";
import type { ScoutingStore } from "../data/ScoutingStore";
import {
  gameActionRequestSchema,
  type GameActionRequest,
} from "../game/actionSchema";
import { GameRuleConflictError } from "../game/applyGameAction";
import { applyServerGameAction } from "../game/applyServerGameAction";
import { json, jsonError } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";
import { scoutingCycleKey } from "../scouting/serverScoutingBoard";

function invalidAction(): Response {
  return jsonError(400, "invalid_action", "操作内容を確認してください");
}

function revisionConflict(): Response {
  return jsonError(
    409,
    "revision_conflict",
    "別の端末または操作でデータが更新されています",
  );
}

function gameRuleConflict(): Response {
  return jsonError(
    409,
    "game_rule_conflict",
    "現在の状態ではこの操作を実行できません",
  );
}

function recruitmentDataUnavailable(): Response {
  return jsonError(
    409,
    "recruitment_data_unavailable",
    "獲得済み候補の情報を確認できません",
  );
}

function willCrossAcademicYear(
  snapshot: Awaited<ReturnType<GameStore["getSnapshot"]>>,
): boolean {
  if (!snapshot) {
    return false;
  }
  const weekly = advanceOneWeek(snapshot.state);
  return crossesAcademicYear(snapshot.state.date, weekly.state.date);
}

async function resolveCommittedIntake(
  snapshot: NonNullable<Awaited<ReturnType<GameStore["getSnapshot"]>>>,
  userId: string,
  scoutingStore?: ScoutingStore,
): Promise<{ userIntake?: Player[]; error?: Response }> {
  const recruiting = snapshot.state.recruiting;
  if (
    !recruiting ||
    recruiting.committedCandidateIds.length === 0 ||
    !willCrossAcademicYear(snapshot)
  ) {
    return {};
  }
  if (!scoutingStore) {
    return { error: recruitmentDataUnavailable() };
  }

  const cycleKey = scoutingCycleKey(snapshot.state);
  if (recruiting.cycleKey !== cycleKey) {
    return { error: recruitmentDataUnavailable() };
  }

  const pool = await scoutingStore.getCandidatePool(userId, cycleKey);
  if (!pool) {
    return { error: recruitmentDataUnavailable() };
  }

  const candidatesById = new Map(
    pool.candidates.map((candidate) => [candidate.player.id, candidate.player]),
  );
  const userIntake: Player[] = [];
  for (const candidateId of recruiting.committedCandidateIds) {
    const candidate = candidatesById.get(candidateId);
    if (!candidate) {
      return { error: recruitmentDataUnavailable() };
    }
    userIntake.push(candidate);
  }

  return { userIntake };
}

export function createGameActionHandler(
  store: GameStore,
  scoutingStore?: ScoutingStore,
): AuthenticatedRequestHandler {
  return async (request, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidAction();
    }

    const parsed = gameActionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return invalidAction();
    }
    const actionRequest = parsed.data as unknown as GameActionRequest;

    const cached = await store.getOperationResponse(
      user.id,
      actionRequest.operationId,
    );
    if (cached) {
      return json(cached);
    }

    const snapshot = await store.getSnapshot(user.id);
    if (!snapshot) {
      return jsonError(
        409,
        "game_not_initialized",
        "学校データを作成してください",
      );
    }
    if (snapshot.revision !== actionRequest.revision) {
      return revisionConflict();
    }

    const recruitingContext =
      actionRequest.action.type === "advance-week"
        ? await resolveCommittedIntake(snapshot, user.id, scoutingStore)
        : {};
    if (recruitingContext.error) {
      return recruitingContext.error;
    }

    let applied;
    try {
      applied = applyServerGameAction(snapshot, actionRequest.action, {
        userIntake: recruitingContext.userIntake,
      });
    } catch (error) {
      if (error instanceof GameRuleConflictError) {
        return gameRuleConflict();
      }
      throw error;
    }

    const response: PersistedOperationResponse = {
      game: {
        ...snapshot,
        revision: snapshot.revision + 1,
        state: applied.state,
        teamSelection: applied.teamSelection,
      },
      operationId: actionRequest.operationId,
    };
    if (applied.outcome !== undefined) {
      response.outcome = applied.outcome;
    }

    try {
      const persisted = await store.applyOperation({
        userId: user.id,
        operationId: actionRequest.operationId,
        expectedRevision: snapshot.revision,
        state: applied.state,
        teamSelection: applied.teamSelection,
        response,
      });
      return json(persisted.response);
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        return revisionConflict();
      }
      throw error;
    }
  };
}
