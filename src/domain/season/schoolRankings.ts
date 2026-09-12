import type { GameState } from "../model/GameState";
import type { School } from "../model/School";
import type { SchoolId } from "../model/identifiers";

export interface SchoolRankingRow {
  rank: number;
  schoolId: SchoolId;
  displayName: string;
  shortName: string;
  regionId: string;
  reputationPoints: number;
}

export interface SchoolRankingOptions {
  regionId?: string;
}

export interface SchoolRankingSnapshot {
  regional: {
    rank: number;
    total: number;
  };
  national: {
    rank: number;
    total: number;
  };
}

function compareSchools(left: School, right: School): number {
  return (
    right.reputationPoints - left.reputationPoints ||
    right.history.nationalTitles - left.history.nationalTitles ||
    right.history.nationalAppearances - left.history.nationalAppearances ||
    right.history.prefecturalTitles - left.history.prefecturalTitles ||
    right.history.officialWins - left.history.officialWins ||
    left.history.officialLosses - right.history.officialLosses ||
    left.id.localeCompare(right.id)
  );
}

export function buildSchoolRankings(
  state: Pick<GameState, "schools">,
  options: SchoolRankingOptions = {},
): SchoolRankingRow[] {
  return Object.values(state.schools)
    .filter(
      (school) =>
        options.regionId === undefined || school.regionId === options.regionId,
    )
    .sort(compareSchools)
    .map((school, index) => ({
      rank: index + 1,
      schoolId: school.id,
      displayName: school.name,
      shortName: school.shortName,
      regionId: school.regionId,
      reputationPoints: school.reputationPoints,
    }));
}

function rankForSchool(
  rankings: readonly SchoolRankingRow[],
  schoolId: SchoolId,
): number {
  const row = rankings.find((candidate) => candidate.schoolId === schoolId);
  if (!row) {
    throw new Error(`school is missing from ranking: ${schoolId}`);
  }
  return row.rank;
}

export function schoolRankingSnapshot(
  state: Pick<GameState, "schools">,
  schoolId: SchoolId,
): SchoolRankingSnapshot {
  const school = state.schools[schoolId];
  if (!school) {
    throw new Error(`school not found: ${schoolId}`);
  }

  const national = buildSchoolRankings(state);
  const regional = buildSchoolRankings(state, { regionId: school.regionId });

  return {
    regional: {
      rank: rankForSchool(regional, schoolId),
      total: regional.length,
    },
    national: {
      rank: rankForSchool(national, schoolId),
      total: national.length,
    },
  };
}
