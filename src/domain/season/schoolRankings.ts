import type { GameState } from "../model/GameState";
import type { School } from "../model/School";
import type { SchoolId } from "../model/identifiers";
import {
  buildNationalRepresentativeSchools,
  type NationalRepresentativeSchool,
} from "../world/nationalRepresentativeSchools";

export interface SchoolRankingRow {
  rank: number;
  schoolId: SchoolId;
  displayName: string;
  shortName: string;
  regionId: string;
  reputationPoints: number;
  source: "world-school" | "national-representative";
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

type SchoolRankingSource = Pick<GameState, "schools" | "calendar">;

interface RankingCandidate {
  schoolId: SchoolId;
  displayName: string;
  shortName: string;
  regionId: string;
  reputationPoints: number;
  nationalTitles: number;
  nationalAppearances: number;
  prefecturalTitles: number;
  officialWins: number;
  officialLosses: number;
  source: SchoolRankingRow["source"];
}

function worldSchoolCandidate(school: School): RankingCandidate {
  return {
    schoolId: school.id,
    displayName: school.name,
    shortName: school.shortName,
    regionId: school.regionId,
    reputationPoints: school.reputationPoints,
    nationalTitles: school.history.nationalTitles,
    nationalAppearances: school.history.nationalAppearances,
    prefecturalTitles: school.history.prefecturalTitles,
    officialWins: school.history.officialWins,
    officialLosses: school.history.officialLosses,
    source: "world-school",
  };
}

function representativeCandidate(
  school: NationalRepresentativeSchool,
): RankingCandidate {
  return {
    schoolId: school.schoolId,
    displayName: school.displayName,
    shortName: school.shortName,
    regionId: school.regionId,
    reputationPoints: school.reputationPoints,
    nationalTitles: school.nationalTitles,
    nationalAppearances: school.nationalAppearances,
    prefecturalTitles: school.prefecturalTitles,
    officialWins: school.officialWins,
    officialLosses: school.officialLosses,
    source: "national-representative",
  };
}

function compareSchools(
  left: RankingCandidate,
  right: RankingCandidate,
): number {
  return (
    right.reputationPoints - left.reputationPoints ||
    right.nationalTitles - left.nationalTitles ||
    right.nationalAppearances - left.nationalAppearances ||
    right.prefecturalTitles - left.prefecturalTitles ||
    right.officialWins - left.officialWins ||
    left.officialLosses - right.officialLosses ||
    left.schoolId.localeCompare(right.schoolId)
  );
}

function rankingCandidates(
  state: SchoolRankingSource,
  options: SchoolRankingOptions,
): RankingCandidate[] {
  const worldSchools = Object.values(state.schools)
    .filter(
      (school) =>
        options.regionId === undefined || school.regionId === options.regionId,
    )
    .map(worldSchoolCandidate);

  if (options.regionId !== undefined) {
    return worldSchools;
  }

  const modeledRegionIds = new Set(
    Object.values(state.schools).map((school) => school.regionId),
  );
  const representatives = buildNationalRepresentativeSchools({
    academicYear: state.calendar.academicYear,
    excludedRegionIds: modeledRegionIds,
  }).map(representativeCandidate);

  return [...worldSchools, ...representatives];
}

export function buildSchoolRankings(
  state: SchoolRankingSource,
  options: SchoolRankingOptions = {},
): SchoolRankingRow[] {
  return rankingCandidates(state, options)
    .sort(compareSchools)
    .map((school, index) => ({
      rank: index + 1,
      schoolId: school.schoolId,
      displayName: school.displayName,
      shortName: school.shortName,
      regionId: school.regionId,
      reputationPoints: school.reputationPoints,
      source: school.source,
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
  state: SchoolRankingSource,
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
