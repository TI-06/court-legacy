import { pvpSeasonId } from "../../src/domain/pvp/season";
import type { PvPStore } from "../data/PvPStore";
import { json } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";

export interface PvpHistoryHandlerDependencies {
  pvpStore: PvPStore;
  now?: () => Date;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseLimit(url: URL): number {
  const raw = url.searchParams.get("limit");
  if (raw === null) return 20;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(30, value));
}

function parseCursor(url: URL): string | null {
  const value = url.searchParams.get("cursor")?.trim() ?? "";
  const separator = value.indexOf("|");
  if (
    separator <= 0 ||
    separator !== value.lastIndexOf("|") ||
    separator === value.length - 1
  ) {
    return null;
  }

  const createdAt = value.slice(0, separator);
  const matchId = value.slice(separator + 1);
  if (Number.isNaN(Date.parse(createdAt)) || !UUID_PATTERN.test(matchId)) {
    return null;
  }
  return value;
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
    const last = history.at(-1);

    return json({
      seasonId,
      history,
      nextCursor:
        history.length === limit && last
          ? `${last.createdAt}|${last.matchId}`
          : null,
    });
  };
}
