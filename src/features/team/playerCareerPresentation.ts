import type { Player } from "../../domain/model/Player";

export interface PlayerSeasonPresentation {
  academicYear: number;
  appearances: number;
  setsPlayed: number;
  points: number;
  blocks: number;
  serviceAces: number;
  attackSuccessRate: number;
  attackAttempts: number;
  perfectReceiveRate: number;
  receiveAttempts: number;
}

export interface PlayerAwardPresentation {
  id: string;
  academicYear: number | null;
  label: string;
}

export interface PlayerCareerPresentation {
  appearances: number;
  setsPlayed: number;
  points: number;
  blocks: number;
  serviceAces: number;
  pointsPerAppearance: number;
  captainSeasons: number;
  awardCount: number;
  awards: PlayerAwardPresentation[];
  bestTournamentResultLabel: string;
}

const seasonAwardLabels: Record<string, string> = {
  mvp: "年間MVP",
  attacker: "ベストアタッカー",
  blocker: "ベストブロッカー",
  server: "ベストサーバー",
  receiver: "ベストレシーバー",
  setter: "ベストセッター",
};

function awardPresentation(awardId: string): PlayerAwardPresentation {
  const match = /^season:(\d+):([a-z-]+)$/.exec(awardId);
  if (!match) {
    return {
      id: awardId,
      academicYear: null,
      label: "表彰",
    };
  }

  const academicYear = Number(match[1]);
  const category = match[2] ?? "";
  return {
    id: awardId,
    academicYear: Number.isSafeInteger(academicYear) ? academicYear : null,
    label: seasonAwardLabels[category] ?? "年間表彰",
  };
}

function awardPresentations(
  awardIds: readonly string[],
): PlayerAwardPresentation[] {
  return awardIds
    .map(awardPresentation)
    .sort(
      (left, right) =>
        (right.academicYear ?? -1) - (left.academicYear ?? -1) ||
        left.label.localeCompare(right.label) ||
        left.id.localeCompare(right.id),
    );
}

const tournamentResultLabels: Record<string, string> = {
  "spring-high:national:champion": "春高 全国優勝",
  "interhigh:national:champion": "インターハイ 全国優勝",
  "national:finalist": "全国大会 準優勝",
  "national:semifinalist": "全国大会 ベスト4",
  "national:quarterfinalist": "全国大会 ベスト8",
  "national:participant": "全国大会 出場",
  "prefectural:champion": "県大会 優勝",
  "prefectural:finalist": "県大会 準優勝",
  "prefectural:semifinalist": "県大会 ベスト4",
  "prefectural:quarterfinalist": "県大会 ベスト8",
  "prefectural:participant": "県大会 出場",
};

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function percentage(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : Math.round((numerator / denominator) * 100);
}

export function buildPlayerSeasonPresentation(
  player: Player,
  academicYear: number,
): PlayerSeasonPresentation {
  const stats =
    player.career.seasonStats?.academicYear === academicYear
      ? player.career.seasonStats
      : null;

  return {
    academicYear,
    appearances: stats?.appearances ?? 0,
    setsPlayed: stats?.setsPlayed ?? 0,
    points: stats?.points ?? 0,
    blocks: stats?.blocks ?? 0,
    serviceAces: stats?.serviceAces ?? 0,
    attackSuccessRate: percentage(
      stats?.attackPoints ?? 0,
      stats?.attackAttempts ?? 0,
    ),
    attackAttempts: stats?.attackAttempts ?? 0,
    perfectReceiveRate: percentage(
      stats?.perfectReceives ?? 0,
      stats?.receiveAttempts ?? 0,
    ),
    receiveAttempts: stats?.receiveAttempts ?? 0,
  };
}

export function buildPlayerCareerPresentation(
  player: Player,
): PlayerCareerPresentation {
  const career = player.career;
  return {
    appearances: career.appearances,
    setsPlayed: career.setsPlayed,
    points: career.points,
    blocks: career.blocks,
    serviceAces: career.serviceAces,
    pointsPerAppearance:
      career.appearances > 0 ? roundOne(career.points / career.appearances) : 0,
    captainSeasons: career.captainSeasons,
    awardCount: career.awardIds.length,
    awards: awardPresentations(career.awardIds),
    bestTournamentResultLabel: career.bestTournamentResultId
      ? (tournamentResultLabels[career.bestTournamentResultId] ??
        "公式大会 記録あり")
      : "記録なし",
  };
}
