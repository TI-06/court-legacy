import { pvpSeasonId } from "../../src/domain/pvp/season";
import type { PvPStore } from "../data/PvPStore";
import { json } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";

export interface PvpHistoryHandlerDependencies {
  pvpStore: PvPStore;
  now?: () => Date;
}

function parseLimit(url: URL): number {
  const raw = url.searchParams.get("limit");
  if (raw === null) return 20;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(30, value));
}

function parseCursor(url: URL): string | null {
  const value = url.searchParams.get("cursor")?.trim() ?? "";
  return value.length > 0 ? value : null;
}

export function createPvpHistoryHandler(
  deps: PvpHistoryHandlerDependencies,
): AuthenticatedRequestHandler {
  const now = deps.now ?? (() => new Date());

  return async (request, user) => {
    const url = new URL(request.url);
    const seasonId = pvpSeasonId(now());
    const limit = parseLimit(url);
    const history = await deps.pvpStore.listHistory({
      userId: user.id,
      seasonId,
      cursor: parseCursor(url),
      limit,
    });

    return json({
      seasonId,
      history,
      nextCursor:
        history.length === limit ? (history.at(-1)?.matchId ?? null) : null,
    });
  };
}
