import type { GameState } from "../model/GameState";
import type { Player } from "../model/Player";
import type { TeamSelection } from "../model/TeamSelection";
import type { PlayerId } from "../model/identifiers";
import { calculatePlayerDisplayPower } from "../selectors/playerPresentation";
import type {
  PlayerConcern,
  PlayerRole,
  TeamDynamicsState,
} from "./teamDynamicsTypes";

const MAX_USAGE_WINDOW = 8;
const STRONG_PLAYER_COUNT = 7;

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function userRosterPlayers(state: GameState): Player[] {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    return [];
  }

  return school.playerIds
    .map((id) => state.players[id])
    .filter((player): player is Player => Boolean(player));
}

function sortPlayersByPower(players: readonly Player[]): Player[] {
  return [...players].sort((left, right) => {
    const difference =
      calculatePlayerDisplayPower(right) - calculatePlayerDisplayPower(left);
    return difference !== 0 ? difference : left.id.localeCompare(right.id);
  });
}

function starterIds(selection: TeamSelection): Set<PlayerId> {
  const ids = selection.rotation.map((assignment) => assignment.playerId);
  if (selection.liberoPlayerId) {
    ids.push(selection.liberoPlayerId);
  }
  return new Set(ids);
}

function recentUsageCount(
  dynamics: Pick<TeamDynamicsState, "recentOfficialStarterCounts">,
  playerId: PlayerId,
): number {
  return dynamics.recentOfficialStarterCounts[playerId] ?? 0;
}

function hasDevelopmentValue(player: Player): boolean {
  if (player.grade === 3) {
    return false;
  }

  const displayPower = calculatePlayerDisplayPower(player) / 100;
  return (player.potential ?? displayPower) >= 60;
}

export interface DerivePlayerRolesInput {
  state: GameState;
  selection: TeamSelection;
  dynamics: Pick<
    TeamDynamicsState,
    "recentOfficialStarterCounts" | "recentOfficialMatchesTracked"
  >;
}

export function derivePlayerRoles({
  state,
  selection,
  dynamics,
}: DerivePlayerRolesInput): Partial<Record<PlayerId, PlayerRole>> {
  const ranked = sortPlayersByPower(userRosterPlayers(state));
  const currentStarters = starterIds(selection);
  const roles: Partial<Record<PlayerId, PlayerRole>> = {};

  ranked.forEach((player, rankIndex) => {
    if (rankIndex === 0) {
      roles[player.id] = "ace";
      return;
    }
    if (currentStarters.has(player.id)) {
      roles[player.id] = "starter";
      return;
    }
    if (
      rankIndex < STRONG_PLAYER_COUNT ||
      recentUsageCount(dynamics, player.id) > 0
    ) {
      roles[player.id] = "rotation";
      return;
    }
    if (hasDevelopmentValue(player)) {
      roles[player.id] = "development";
      return;
    }
    roles[player.id] = "reserve";
  });

  return roles;
}

export function updateRecentOfficialUsage(
  dynamics: TeamDynamicsState,
  starterPlayerIds: readonly PlayerId[],
): TeamDynamicsState {
  const counts: Partial<Record<PlayerId, number>> = {};
  const windowAlreadyFull =
    dynamics.recentOfficialMatchesTracked >= MAX_USAGE_WINDOW;

  for (const [id, rawCount] of Object.entries(
    dynamics.recentOfficialStarterCounts,
  )) {
    const count = Math.max(0, Math.min(MAX_USAGE_WINDOW, rawCount ?? 0));
    const nextCount = windowAlreadyFull ? Math.max(0, count - 1) : count;
    if (nextCount > 0) {
      counts[id as PlayerId] = nextCount;
    }
  }

  for (const id of new Set(starterPlayerIds)) {
    counts[id] = Math.min(MAX_USAGE_WINDOW, (counts[id] ?? 0) + 1);
  }

  return {
    ...dynamics,
    recentOfficialStarterCounts: counts,
    recentOfficialMatchesTracked: Math.min(
      MAX_USAGE_WINDOW,
      dynamics.recentOfficialMatchesTracked + 1,
    ),
  };
}

export function calculateLineupContinuity(
  dynamics: Pick<
    TeamDynamicsState,
    "recentOfficialStarterCounts" | "recentOfficialMatchesTracked"
  >,
  currentStarterIds: readonly PlayerId[],
): number {
  const tracked = dynamics.recentOfficialMatchesTracked;
  const uniqueStarters = [...new Set(currentStarterIds)];
  if (tracked <= 0 || uniqueStarters.length === 0) {
    return 50;
  }

  const total = uniqueStarters.reduce(
    (sum, id) => sum + Math.min(tracked, recentUsageCount(dynamics, id)),
    0,
  );
  return clamp100((total / (tracked * uniqueStarters.length)) * 100);
}

function pushConcern(
  concerns: Partial<Record<PlayerId, PlayerConcern[]>>,
  playerId: PlayerId,
  concern: PlayerConcern,
): void {
  const current = concerns[playerId] ?? [];
  if (!current.some((entry) => entry.code === concern.code)) {
    concerns[playerId] = [...current, concern];
  }
}

function hasThreeGameOfficialSlump(state: GameState): boolean {
  const recentOfficialMatches = state.history.matches
    .filter(
      (match) =>
        match.tournamentId !== null &&
        (match.homeSchoolId === state.userSchoolId ||
          match.awaySchoolId === state.userSchoolId),
    )
    .slice(-3);

  return (
    recentOfficialMatches.length === 3 &&
    recentOfficialMatches.every(
      (match) => match.winnerSchoolId !== state.userSchoolId,
    )
  );
}

export function derivePlayerConcerns(
  state: GameState,
  roles: Partial<Record<PlayerId, PlayerRole>>,
  dynamics: Pick<
    TeamDynamicsState,
    "recentOfficialStarterCounts" | "recentOfficialMatchesTracked"
  >,
): Partial<Record<PlayerId, PlayerConcern[]>> {
  const roster = userRosterPlayers(state);
  const ranked = sortPlayersByPower(roster);
  const rankByPlayer = new Map(
    ranked.map((player, index) => [player.id, index + 1] as const),
  );
  const concerns: Partial<Record<PlayerId, PlayerConcern[]>> = {};
  const tracked = dynamics.recentOfficialMatchesTracked;

  for (const player of roster) {
    const role = roles[player.id];
    const usage = recentUsageCount(dynamics, player.id);
    const rank = rankByPlayer.get(player.id) ?? Number.POSITIVE_INFINITY;

    if (
      tracked >= 4 &&
      (role === "ace" || role === "starter") &&
      usage / tracked <= 0.25
    ) {
      pushConcern(concerns, player.id, {
        code: "playing-time",
        severity: usage === 0 ? 3 : 2,
      });
    }

    if (
      tracked >= 3 &&
      rank <= STRONG_PLAYER_COUNT &&
      role !== "ace" &&
      role !== "starter"
    ) {
      pushConcern(concerns, player.id, {
        code: "role-mismatch",
        severity: rank <= 3 ? 2 : 1,
      });
    }

    if (player.injury && usage > 0) {
      pushConcern(concerns, player.id, {
        code: "injury-overuse",
        severity: 2,
      });
    }
  }

  if (hasThreeGameOfficialSlump(state)) {
    for (const player of roster) {
      pushConcern(concerns, player.id, {
        code: "team-slump",
        severity: 1,
      });
    }
  }

  return concerns;
}
