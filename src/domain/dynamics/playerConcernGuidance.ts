import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import type {
  PlayerConcern,
  PlayerConcernCode,
  PlayerRole,
} from "./teamDynamicsTypes";

export interface PlayerConcernGuidance {
  code: PlayerConcernCode;
  severity: 1 | 2 | 3;
  title: string;
  reason: string;
  resolution: string;
  progressLabel: string;
  status: "needs-action" | "improving";
}

const roleLabels: Record<PlayerRole, string> = {
  ace: "エース",
  starter: "先発",
  rotation: "ローテーション",
  development: "育成枠",
  reserve: "控え",
};

function recentUsage(state: GameState, playerId: PlayerId): number {
  return state.teamDynamics.recentOfficialStarterCounts[playerId] ?? 0;
}

function trackedMatches(state: GameState): number {
  return state.teamDynamics.recentOfficialMatchesTracked;
}

function recentOfficialLosses(state: GameState): number {
  const recent = state.history.matches
    .filter(
      (match) =>
        match.tournamentId !== null &&
        (match.homeSchoolId === state.userSchoolId ||
          match.awaySchoolId === state.userSchoolId),
    )
    .slice(-3);

  let losses = 0;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    if (recent[index]!.winnerSchoolId === state.userSchoolId) break;
    losses += 1;
  }
  return losses;
}

export function buildPlayerConcernGuidance(
  state: GameState,
  playerId: PlayerId,
  concern: PlayerConcern,
): PlayerConcernGuidance {
  const player = state.players[playerId];
  if (!player) {
    throw new Error(`player concern references unknown player: ${playerId}`);
  }

  const tracked = trackedMatches(state);
  const usage = recentUsage(state, playerId);

  switch (concern.code) {
    case "playing-time":
      return {
        code: concern.code,
        severity: concern.severity,
        title: "出場機会への不満",
        reason: `直近${tracked}試合の公式戦で起用が少なく、出場機会に不満を感じています。`,
        resolution:
          "公式戦で起用を増やすと、直近の起用状況が更新されて不満が解消しやすくなります。",
        progressLabel: `直近公式戦の起用 ${usage}/${tracked}`,
        status: usage > 0 ? "improving" : "needs-action",
      };

    case "role-mismatch": {
      const role = state.teamDynamics.playerRoles[playerId] ?? "reserve";
      return {
        code: concern.code,
        severity: concern.severity,
        title: "役割への不満",
        reason: `現在の役割は${roleLabels[role]}ですが、チーム内評価に対して役割が小さいと感じています。`,
        resolution:
          "実力に見合う形で先発またはエースとして起用すると、役割への不満が解消します。",
        progressLabel: `現在の役割：${roleLabels[role]}`,
        status: role === "rotation" ? "improving" : "needs-action",
      };
    }

    case "injury-overuse":
      return {
        code: concern.code,
        severity: concern.severity,
        title: "怪我中の起用負荷",
        reason: player.injury
          ? `怪我が残っている状態で、直近${tracked}試合中${usage}試合の公式戦に起用されています。`
          : `怪我明け直後の起用負荷を気にしています。`,
        resolution:
          "怪我中は公式戦で起用しないで休養させると、起用負荷への不満が解消します。",
        progressLabel: `直近公式戦の起用 ${usage}/${tracked}`,
        status: usage === 0 ? "improving" : "needs-action",
      };

    case "team-slump": {
      const losses = recentOfficialLosses(state);
      return {
        code: concern.code,
        severity: concern.severity,
        title: "チーム不調への不満",
        reason: `チームが公式戦で${losses}連敗しており、結果への不安が高まっています。`,
        resolution: "公式戦で勝利して連敗を止めると、この不満は解消します。",
        progressLabel: `公式戦${losses}連敗`,
        status: "needs-action",
      };
    }
  }
}

export function selectPlayerConcernGuidance(
  state: GameState,
  playerId: PlayerId,
): PlayerConcernGuidance[] {
  return (state.teamDynamics.playerConcerns[playerId] ?? []).map((concern) =>
    buildPlayerConcernGuidance(state, playerId, concern),
  );
}
