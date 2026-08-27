import { z } from "zod";
import type {
  GameStore,
  PersistedOperationResponse,
} from "../data/GameStore";
import { RevisionConflictError } from "../data/GameStore";
import type { ScoutingStore } from "../data/ScoutingStore";
import { json, jsonError } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";
import { scoutingCycleKey } from "../scouting/serverScoutingBoard";

const requestSchema = z
  .object({
    operationId: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1).max(120)),
    revision: z.number().int().positive(),
    candidateId: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1).max(160)),
  })
  .strict();

export interface ScoutingRecruitmentHandlerDependencies {
  gameStore: GameStore;
  scoutingStore: ScoutingStore;
}

function invalidRequest(): Response {
  return jsonError(
    400,
    "invalid_recruitment_request",
    "獲得候補を確認してください",
  );
}

function revisionConflict(): Response {
  return jsonError(
    409,
    "revision_conflict",
    "別の端末または操作でデータが更新されています",
  );
}

function scoutingBoardRequired(): Response {
  return jsonError(
    409,
    "scouting_board_required",
    "先にスカウト候補を確認してください",
  );
}

function candidateUnavailable(): Response {
  return jsonError(
    409,
    "candidate_unavailable",
    "この候補は現在のスカウト候補に含まれていません",
  );
}

function candidateAlreadyCommitted(): Response {
  return jsonError(
    409,
    "candidate_already_committed",
    "この候補はすでに獲得済みです",
  );
}

export function createScoutingRecruitmentHandler(
  deps: ScoutingRecruitmentHandlerDependencies,
): AuthenticatedRequestHandler {
  return async (request, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidRequest();
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return invalidRequest();
    }

    const cached = await deps.gameStore.getOperationResponse(
      user.id,
      parsed.data.operationId,
    );
    if (cached) {
      return json(cached);
    }

    const snapshot = await deps.gameStore.getSnapshot(user.id);
    if (!snapshot) {
      return jsonError(
        409,
        "game_not_initialized",
        "学校データを作成してください",
      );
    }
    if (snapshot.revision !== parsed.data.revision) {
      return revisionConflict();
    }

    const cycleKey = scoutingCycleKey(snapshot.state);
    const pool = await deps.scoutingStore.getCandidatePool(user.id, cycleKey);
    if (!pool) {
      return scoutingBoardRequired();
    }

    const candidate = pool.candidates.find(
      (entry) => entry.player.id === parsed.data.candidateId,
    );
    if (!candidate) {
      return candidateUnavailable();
    }

    const currentCommitments =
      snapshot.state.recruiting?.cycleKey === cycleKey
        ? snapshot.state.recruiting.committedCandidateIds
        : [];
    if (currentCommitments.includes(candidate.player.id)) {
      return candidateAlreadyCommitted();
    }

    const committedCandidateIds = [...currentCommitments, candidate.player.id];
    const nextState = {
      ...snapshot.state,
      recruiting: {
        cycleKey,
        committedCandidateIds,
      },
    };
    const outcome = {
      candidateId: candidate.player.id,
      committedCandidateIds,
      cycleKey,
    };
    const response: PersistedOperationResponse = {
      game: {
        ...snapshot,
        revision: snapshot.revision + 1,
        state: nextState,
      },
      operationId: parsed.data.operationId,
      outcome,
    };

    try {
      const persisted = await deps.gameStore.applyOperation({
        userId: user.id,
        operationId: parsed.data.operationId,
        expectedRevision: snapshot.revision,
        state: nextState,
        teamSelection: snapshot.teamSelection,
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
