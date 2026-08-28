import { useRef, useState } from "react";
import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import type {
  GameAction,
  GameActionRequest,
  GameActionResponse,
} from "../../worker/game/actionSchema";
import type { RecoveryCachePort } from "../persistence/RecoveryCache";
import { browserRecoveryCache } from "../persistence/RecoveryCache";
import { ApiError, type GameApiClient } from "../services/api/GameApiClient";

export type OperationState =
  | { status: "idle" }
  | { status: "submitting"; label: string; operationId: string }
  | { status: "success"; label: string }
  | { status: "offline"; label: string; retry: () => void }
  | { status: "error"; label: string; retry: () => void };

interface UseGameSessionInput {
  accessToken: string;
  initialSnapshot: CloudGameSnapshot;
  api: GameApiClient;
  recoveryCache?: RecoveryCachePort;
  createOperationId?: () => string;
}

export interface GameSessionController {
  snapshot: CloudGameSnapshot;
  operation: OperationState;
  runAction(
    action: GameAction,
    label: string,
  ): Promise<GameActionResponse | null>;
  adoptServerSnapshot(
    snapshot: CloudGameSnapshot,
    label?: string,
  ): Promise<void>;
}

function isNetworkAmbiguous(error: unknown): boolean {
  return error instanceof ApiError && error.status === null;
}

function isServerAmbiguous(error: unknown): boolean {
  return error instanceof ApiError && (error.status ?? 0) >= 500;
}

export function useGameSession({
  accessToken,
  initialSnapshot,
  api,
  recoveryCache = browserRecoveryCache,
  createOperationId = () => crypto.randomUUID(),
}: UseGameSessionInput): GameSessionController {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const snapshotRef = useRef(initialSnapshot);
  const actionPendingRef = useRef(false);
  const [operation, setOperation] = useState<OperationState>({
    status: "idle",
  });

  function replaceSnapshot(next: CloudGameSnapshot): void {
    snapshotRef.current = next;
    setSnapshot(next);
  }

  async function writeRecovery(
    nextSnapshot: CloudGameSnapshot,
    pendingOperation: GameActionRequest | null,
  ): Promise<void> {
    try {
      await recoveryCache.write({
        userId: nextSnapshot.userId,
        snapshot: nextSnapshot,
        pendingOperation,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // The cloud remains authoritative even if the local recovery cache fails.
    }
  }

  async function adoptServerSnapshot(
    nextSnapshot: CloudGameSnapshot,
    label = "保存済み",
  ): Promise<void> {
    replaceSnapshot(nextSnapshot);
    await writeRecovery(nextSnapshot, null);
    setOperation({ status: "success", label });
  }

  async function submitRequest(
    request: GameActionRequest,
    label: string,
  ): Promise<GameActionResponse | null> {
    setOperation({
      status: "submitting",
      label,
      operationId: request.operationId,
    });

    try {
      const response = await api.applyAction(accessToken, request);
      replaceSnapshot(response.game);
      await writeRecovery(response.game, null);
      setOperation({ status: "success", label });
      return response;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const latest = await api.bootstrap(accessToken);
          if (latest.status === "ready") {
            replaceSnapshot(latest.game);
            await writeRecovery(latest.game, null);
          }
        } catch {
          // The conflict itself remains visible even if the refresh also fails.
        }
        setOperation({
          status: "error",
          label: "他の端末の更新を読み込みました。もう一度実行してください",
          retry: () => {
            const current = snapshotRef.current;
            void submitRequest(
              {
                operationId: createOperationId(),
                revision: current.revision,
                action: request.action,
              },
              label,
            );
          },
        });
        return null;
      }

      if (isNetworkAmbiguous(error) || isServerAmbiguous(error)) {
        await writeRecovery(snapshotRef.current, request);
        const retry = () => void submitRequest(request, label);
        setOperation(
          isNetworkAmbiguous(error)
            ? { status: "offline", label, retry }
            : { status: "error", label: "保存に失敗しました", retry },
        );
        return null;
      }

      setOperation({
        status: "error",
        label: error instanceof Error ? error.message : "保存に失敗しました",
        retry: () => void submitRequest(request, label),
      });
      return null;
    }
  }

  function runAction(
    action: GameAction,
    label: string,
  ): Promise<GameActionResponse | null> {
    if (actionPendingRef.current) {
      return Promise.resolve(null);
    }

    actionPendingRef.current = true;
    const current = snapshotRef.current;
    return submitRequest(
      {
        operationId: createOperationId(),
        revision: current.revision,
        action,
      },
      label,
    ).finally(() => {
      actionPendingRef.current = false;
    });
  }

  return { snapshot, operation, runAction, adoptServerSnapshot };
}
