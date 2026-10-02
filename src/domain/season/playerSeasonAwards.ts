import type { GameState } from "../model/GameState";
import type { Player, PlayerSeasonStats } from "../model/Player";
import type { PlayerId } from "../model/identifiers";

export type SeasonAwardCategory =
  "mvp" | "attacker" | "blocker" | "server" | "receiver" | "setter";

export interface SeasonAwardWinner {
  category: SeasonAwardCategory;
  label: string;
  playerId: PlayerId;
  displayName: string;
  metricLabel: string;
  score: number;
}

export interface SeasonAwardSelection {
  academicYear: number;
  winners: SeasonAwardWinner[];
}

interface Candidate {
  player: Player;
  stats: PlayerSeasonStats;
}

const awardLabels: Record<SeasonAwardCategory, string> = {
  mvp: "年間MVP",
  attacker: "ベストアタッカー",
  blocker: "ベストブロッカー",
  server: "ベストサーバー",
  receiver: "ベストレシーバー",
  setter: "ベストセッター",
};

function percentage(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function displayName(player: Player): string {
  return `${player.lastName} ${player.firstName}`;
}

function candidates(state: GameState): Candidate[] {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }
  const academicYear = state.calendar.academicYear;

  return school.playerIds
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player))
    .flatMap((player) => {
      const stats = player.career.seasonStats;
      return stats?.academicYear === academicYear && stats.appearances > 0
        ? [{ player, stats }]
        : [];
    });
}

function winner(
  category: SeasonAwardCategory,
  eligible: readonly Candidate[],
  score: (candidate: Candidate) => number,
  metricLabel: (candidate: Candidate) => string,
): SeasonAwardWinner | null {
  const selected = [...eligible]
    .map((candidate) => ({
      candidate,
      score: score(candidate),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.candidate.stats.appearances - left.candidate.stats.appearances ||
        left.candidate.player.id.localeCompare(right.candidate.player.id),
    )[0];

  if (!selected || selected.score <= 0) return null;

  return {
    category,
    label: awardLabels[category],
    playerId: selected.candidate.player.id,
    displayName: displayName(selected.candidate.player),
    metricLabel: metricLabel(selected.candidate),
    score: selected.score,
  };
}

function mvpScore({ stats }: Candidate): number {
  const attackRate =
    stats.attackAttempts >= 5
      ? percentage(stats.attackPoints, stats.attackAttempts)
      : 0;
  const receiveRate =
    stats.receiveAttempts >= 5
      ? percentage(stats.perfectReceives, stats.receiveAttempts)
      : 0;

  return Math.round(
    stats.points * 4 +
      stats.blocks * 6 +
      stats.serviceAces * 5 +
      stats.defensePoints * 3 +
      stats.idealSets * 1.5 +
      stats.successfulDigs * 2 +
      attackRate * 0.5 +
      receiveRate * 0.35 +
      stats.appearances * 2,
  );
}

export function selectSeasonAwards(state: GameState): SeasonAwardSelection {
  const pool = candidates(state);
  const winners: SeasonAwardWinner[] = [];

  const mvp = winner(
    "mvp",
    pool.filter((candidate) => candidate.stats.appearances >= 2),
    mvpScore,
    ({ stats }) =>
      `${stats.appearances}試合・${stats.points}得点・BLK ${stats.blocks}・ACE ${stats.serviceAces}`,
  );
  if (mvp) winners.push(mvp);

  const attacker = winner(
    "attacker",
    pool.filter(
      (candidate) =>
        candidate.stats.attackAttempts >= 5 && candidate.stats.attackPoints > 0,
    ),
    ({ stats }) =>
      stats.attackPoints * 100 +
      percentage(stats.attackPoints, stats.attackAttempts),
    ({ stats }) =>
      `${stats.attackPoints}/${stats.attackAttempts}・決定率${percentage(
        stats.attackPoints,
        stats.attackAttempts,
      )}%`,
  );
  if (attacker) winners.push(attacker);

  const blocker = winner(
    "blocker",
    pool.filter(
      (candidate) =>
        candidate.stats.appearances >= 2 && candidate.stats.blocks > 0,
    ),
    ({ stats }) => stats.blocks * 100 + stats.appearances,
    ({ stats }) => `${stats.blocks}ブロック`,
  );
  if (blocker) winners.push(blocker);

  const server = winner(
    "server",
    pool.filter(
      (candidate) =>
        candidate.stats.appearances >= 2 && candidate.stats.serviceAces > 0,
    ),
    ({ stats }) => stats.serviceAces * 100 + stats.appearances,
    ({ stats }) => `${stats.serviceAces}サービスエース`,
  );
  if (server) winners.push(server);

  const receiver = winner(
    "receiver",
    pool.filter((candidate) => candidate.stats.receiveAttempts >= 5),
    ({ stats }) =>
      percentage(stats.perfectReceives, stats.receiveAttempts) * 100 +
      stats.receiveAttempts,
    ({ stats }) =>
      `${stats.perfectReceives}/${stats.receiveAttempts}・好返球率${percentage(
        stats.perfectReceives,
        stats.receiveAttempts,
      )}%`,
  );
  if (receiver) winners.push(receiver);

  const setter = winner(
    "setter",
    pool.filter(
      (candidate) =>
        candidate.player.preferredPosition === "S" &&
        candidate.stats.appearances >= 2 &&
        candidate.stats.idealSets > 0,
    ),
    ({ stats }) => stats.idealSets * 100 + stats.appearances,
    ({ stats }) => `${stats.idealSets}好セット`,
  );
  if (setter) winners.push(setter);

  return {
    academicYear: state.calendar.academicYear,
    winners,
  };
}
