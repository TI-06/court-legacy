import { crossesAcademicYear } from "../../src/domain/calendar/academicYearProgression";
import { nextWeekDate } from "../../src/domain/calendar/weekProgression";
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
import { compactGameSnapshot } from "../game/compactGameSnapshot";
import { buildJsonStateDelta } from "../data/stateDelta";
import {
  buildJsonStatePatch,
  buildJsonStatePatchWithCollapsedRoot,
} from "../data/statePatch";
import { json, jsonError } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";
import {
  recoverCommittedCandidateTruth,
  scoutingCycleKey,
} from "../scouting/serverScoutingBoard";

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

function gameRuleConflict(error: GameRuleConflictError): Response {
  return jsonError(409, error.code, error.message);
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
  return crossesAcademicYear(
    snapshot.state.date,
    nextWeekDate(snapshot.state.date),
  );
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
  const persistedById = new Map(
    (recruiting.committedCandidates ?? []).map((candidate) => [
      candidate.player.id,
      candidate.player,
    ]),
  );
  const poolById = new Map(
    (pool?.candidates ?? []).map((candidate) => [
      candidate.player.id,
      candidate.player,
    ]),
  );
  const userIntake: Player[] = [];
  for (const candidateId of recruiting.committedCandidateIds) {
    const candidate =
      persistedById.get(candidateId) ??
      poolById.get(candidateId) ??
      recoverCommittedCandidateTruth(snapshot.state, candidateId)?.player;
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

    const loadedSnapshot = await store.getSnapshot(user.id);
    if (!loadedSnapshot) {
      return jsonError(
        409,
        "game_not_initialized",
        "学校データを作成してください",
      );
    }
    const snapshot = compactGameSnapshot(loadedSnapshot);
    if (snapshot.revision !== actionRequest.revision) {
      const cached = await store.getOperationResponse(
        user.id,
        actionRequest.operationId,
      );
      if (cached) {
        return json(cached);
      }
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
        return gameRuleConflict(error);
      }
      throw error;
    }

    const isMidMatchCommand =
      actionRequest.action.type === "match-command" &&
      applied.state.activeMatch?.phase !== "match-complete";
    const persistedState =
      applied.state.activeMatch?.phase === "match-complete" &&
      applied.state.activeMatch.eventLog.length > 0
        ? {
            ...applied.state,
            activeMatch: {
              ...applied.state.activeMatch,
              eventLog: [],
            },
          }
        : applied.state;
    const activeMatchChanged =
      loadedSnapshot.state.activeMatch !== persistedState.activeMatch;
    const statePatch = activeMatchChanged
      ? buildJsonStatePatchWithCollapsedRoot(
          loadedSnapshot.state as unknown as Record<string, unknown>,
          persistedState as unknown as Record<string, unknown>,
          "activeMatch",
        )
      : buildJsonStatePatch(loadedSnapshot.state, persistedState);
    const stateDelta = isMidMatchCommand
      ? undefined
      : buildJsonStateDelta(
          loadedSnapshot.state as unknown as Record<string, unknown>,
          persistedState as unknown as Record<string, unknown>,
        );
    const response: PersistedOperationResponse = {
      game: {
        ...snapshot,
        revision: snapshot.revision + 1,
        state: persistedState,
        teamSelection: applied.teamSelection,
      },
      operationId: actionRequest.operationId,
    };
    if (!isMidMatchCommand && applied.outcome !== undefined) {
      response.outcome = applied.outcome;
    }

    try {
      const persisted = await store.applyOperation({
        userId: user.id,
        operationId: actionRequest.operationId,
        expectedRevision: snapshot.revision,
        previousState: loadedSnapshot.state,
        state: persistedState,
        statePatch,
        stateDelta,
        preferDelta: isMidMatchCommand,
        teamSelection: applied.teamSelection,
        response,
      });
      if (persisted.replayed) {
        return json(persisted.response);
      }
      return json({
        operationId: actionRequest.operationId,
        gameDelta: {
          userId: snapshot.userId,
          schoolDbId: snapshot.schoolDbId,
          revision: snapshot.revision + 1,
          ...(isMidMatchCommand
            ? { statePatch }
            : { stateDelta: stateDelta! }),
          teamSelection: applied.teamSelection,
        },
        ...(!isMidMatchCommand && applied.outcome !== undefined
          ? { outcome: applied.outcome }
          : {}),
      });
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        return revisionConflict();
      }
      throw error;
    }
  };
}
