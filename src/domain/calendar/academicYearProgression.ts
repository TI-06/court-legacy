import type { GameDataRegistry } from "../../data/dataRegistry";
import { assignGenerationalTalent } from "../generation/generateWorld";
import { generateIntake } from "../generation/generatePlayer";
import {
  relationshipKey,
  type GameState,
  type GraduatedPlayerSummary,
} from "../model/GameState";
import type { Grade, Player } from "../model/Player";
import type { School } from "../model/School";
import type { GameDate, PlayerId, SchoolId } from "../model/identifiers";
import { SeededRandom, type RandomSource } from "../random/SeededRandom";
import {
  legacyReputationFromPoints,
  resolveSeasonReputation,
} from "../school/reputation";
import { advanceRivalWorld } from "../world/rivalWorldProgression";
import { advanceOneWeek, type WeekProgressionResult } from "./weekProgression";

export interface AcademicYearTransitionSummary {
  academicYear: number;
  graduatedPlayerIds: PlayerId[];
  intakePlayerIds: PlayerId[];
  graduatedPlayerIdsBySchool: Record<SchoolId, PlayerId[]>;
  intakePlayerIdsBySchool: Record<SchoolId, PlayerId[]>;
  captainPlayerIdsBySchool: Record<SchoolId, PlayerId | null>;
  generationalTalentPlayerId: PlayerId | null;
  generationalTalentSchoolId: SchoolId | null;
}

export interface AdvanceGameWeekResult extends WeekProgressionResult {
  academicYearTransition: AcademicYearTransitionSummary | null;
}

function academicYearStartYear(date: GameDate): number {
  const [yearText, monthText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isSafeInteger(year) || !Number.isSafeInteger(month)) {
    throw new Error(`invalid game date: ${date}`);
  }
  return month >= 4 ? year : year - 1;
}

export function crossesAcademicYear(
  previousDate: GameDate,
  nextDate: GameDate,
): boolean {
  return academicYearStartYear(nextDate) > academicYearStartYear(previousDate);
}

function nextPlayerNumber(players: GameState["players"]): number {
  return (
    Math.max(
      0,
      ...Object.keys(players).map((id) => {
        const match = /player-(\d+)$/.exec(id);
        return match ? Number(match[1]) : 0;
      }),
    ) + 1
  );
}

function graduateSummary(
  player: Player,
  graduationYear: number,
): GraduatedPlayerSummary {
  return {
    playerId: player.id,
    schoolId: player.career.schoolId,
    graduationYear,
    displayName: `${player.lastName} ${player.firstName}`,
    position: player.preferredPosition,
    appearances: player.career.appearances,
    points: player.career.points,
    blocks: player.career.blocks,
    serviceAces: player.career.serviceAces,
    awardIds: [...player.career.awardIds],
  };
}

function captainScore(player: Player): number {
  return (
    player.abilities.mental * 2 +
    player.abilities.decision +
    player.trust +
    player.morale
  );
}

function selectCaptain(
  playerIds: readonly PlayerId[],
  players: GameState["players"],
): PlayerId | null {
  const activePlayers = playerIds
    .map((id) => players[id])
    .filter((player): player is Player => Boolean(player));
  const thirdYears = activePlayers.filter((player) => player.grade === 3);
  const candidates = thirdYears.length > 0 ? thirdYears : activePlayers;
  return (
    [...candidates].sort(
      (left, right) =>
        right.grade - left.grade ||
        captainScore(right) - captainScore(left) ||
        left.id.localeCompare(right.id),
    )[0]?.id ?? null
  );
}

function rebuildRelationships(
  state: GameState,
  random: RandomSource,
): Record<string, number> {
  const relationships: Record<string, number> = {};
  for (const school of Object.values(state.schools)) {
    for (
      let leftIndex = 0;
      leftIndex < school.playerIds.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < school.playerIds.length;
        rightIndex += 1
      ) {
        const left = school.playerIds[leftIndex];
        const right = school.playerIds[rightIndex];
        if (!left || !right) {
          continue;
        }
        const key = relationshipKey(left, right);
        relationships[key] =
          state.playerRelationships[key] ?? random.int(35, 65);
      }
    }
  }
  return relationships;
}

function promoteGrade(grade: Grade): Grade {
  if (grade === 1) {
    return 2;
  }
  if (grade === 2) {
    return 3;
  }
  throw new Error("third-year players must graduate before promotion");
}

function resolveAnnualSchoolReputation(school: School): School {
  const result = resolveSeasonReputation({
    currentPoints: school.reputationPoints,
    recentSeasonRatings: school.history.recentSeasonRatings ?? [],
    officialWins: school.history.officialWins,
    officialLosses: school.history.officialLosses,
    prefecturalTitles: school.history.prefecturalTitles,
    nationalAppearances: school.history.nationalAppearances,
    nationalTitles: school.history.nationalTitles,
  });

  return {
    ...school,
    reputation: legacyReputationFromPoints(result.points),
    reputationPoints: result.points,
    history: {
      ...school.history,
      recentSeasonRatings: result.recentSeasonRatings,
      peakReputationPoints: Math.max(
        school.history.peakReputationPoints ?? school.reputationPoints,
        result.points,
      ),
    },
  };
}

function restoreCanonicalReputation(
  state: GameState,
  canonicalSchools: GameState["schools"],
): GameState {
  const schools = { ...state.schools };
  for (const school of Object.values(state.schools)) {
    const canonical = canonicalSchools[school.id];
    if (!canonical) {
      continue;
    }
    schools[school.id] = {
      ...school,
      reputation: canonical.reputation,
      reputationPoints: canonical.reputationPoints,
      history: {
        ...school.history,
        recentSeasonRatings: canonical.history.recentSeasonRatings,
        peakReputationPoints: canonical.history.peakReputationPoints,
      },
    };
  }
  return { ...state, schools };
}

export function advanceAcademicYear(
  state: GameState,
  data: GameDataRegistry,
  random: RandomSource,
): { state: GameState; summary: AcademicYearTransitionSummary } {
  const nextAcademicYear = state.calendar.academicYear + 1;
  const generationalTalentDue =
    nextAcademicYear >= state.world.nextGenerationalTalentYear;
  const maximumBaseRosterSize = generationalTalentDue ? 15 : 16;
  const players = { ...state.players };
  const schools = Object.fromEntries(
    Object.values(state.schools).map((school) => {
      const resolved = resolveAnnualSchoolReputation(school);
      return [resolved.id, resolved];
    }),
  ) as GameState["schools"];
  const graduatedPlayerIds: PlayerId[] = [];
  const intakePlayerIds: PlayerId[] = [];
  const graduatedPlayerIdsBySchool = {} as Record<SchoolId, PlayerId[]>;
  const intakePlayerIdsBySchool = {} as Record<SchoolId, PlayerId[]>;
  const captainPlayerIdsBySchool = {} as Record<SchoolId, PlayerId | null>;
  const graduatedSummaries: GraduatedPlayerSummary[] = [];
  let playerNumber = nextPlayerNumber(players);

  for (const school of Object.values(schools)) {
    const graduates: PlayerId[] = [];
    const returningPlayerIds: PlayerId[] = [];

    for (const playerId of school.playerIds) {
      const player = players[playerId];
      if (!player) {
        continue;
      }
      if (player.grade === 3) {
        graduates.push(playerId);
        graduatedPlayerIds.push(playerId);
        graduatedSummaries.push(graduateSummary(player, nextAcademicYear));
      } else {
        players[playerId] = { ...player, grade: promoteGrade(player.grade) };
        returningPlayerIds.push(playerId);
      }
    }

    const desiredIntakeCount = random.int(4, 7);
    const availableRosterSlots = Math.max(
      0,
      maximumBaseRosterSize - returningPlayerIds.length,
    );
    const intakeCount = Math.min(desiredIntakeCount, availableRosterSlots);
    const intake = generateIntake({
      schoolId: school.id,
      academicYear: nextAcademicYear,
      firstPlayerNumber: playerNumber,
      data,
      random,
      count: intakeCount,
      currentPlayers: returningPlayerIds
        .map((playerId) => players[playerId])
        .filter((player): player is Player => Boolean(player)),
    });
    playerNumber += intake.length;
    for (const player of intake) {
      players[player.id] = player;
      intakePlayerIds.push(player.id);
    }
    const activePlayerIds = [
      ...returningPlayerIds,
      ...intake.map((player) => player.id),
    ];
    const captainPlayerId = selectCaptain(activePlayerIds, players);
    if (captainPlayerId) {
      const captain = players[captainPlayerId];
      if (captain) {
        players[captainPlayerId] = {
          ...captain,
          career: {
            ...captain.career,
            captainSeasons: captain.career.captainSeasons + 1,
          },
        };
      }
    }

    graduatedPlayerIdsBySchool[school.id] = graduates;
    intakePlayerIdsBySchool[school.id] = intake.map((player) => player.id);
    captainPlayerIdsBySchool[school.id] = captainPlayerId;
    schools[school.id] = {
      ...school,
      playerIds: activePlayerIds,
      alumniPlayerIds: [...new Set([...school.alumniPlayerIds, ...graduates])],
      captainPlayerId,
      history: {
        ...school.history,
        seasons: school.history.seasons + 1,
      },
    };
  }

  let nextState: GameState = {
    ...state,
    yearIndex: state.yearIndex + 1,
    schools,
    players,
    activeMatch: null,
    pendingEvent: null,
    history: {
      ...state.history,
      graduates: [...state.history.graduates, ...graduatedSummaries],
    },
    calendar: {
      ...state.calendar,
      academicYear: nextAcademicYear,
      weekOfYear: 1,
      currentDate: state.date,
      completedActivityIds: state.calendar.completedActivityIds.filter(
        (id) => !id.startsWith("week:"),
      ),
    },
  };

  let generationalTalentPlayerId: PlayerId | null = null;
  let generationalTalentSchoolId: SchoolId | null = null;
  if (generationalTalentDue) {
    const assignment = assignGenerationalTalent({
      state: nextState,
      academicYear: nextAcademicYear,
      random,
      data,
    });
    generationalTalentPlayerId = assignment.player.id;
    generationalTalentSchoolId = assignment.schoolId;
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [assignment.player.id]: assignment.player,
      },
      schools: {
        ...nextState.schools,
        [assignment.schoolId]: {
          ...nextState.schools[assignment.schoolId],
          playerIds: [
            ...nextState.schools[assignment.schoolId].playerIds,
            assignment.player.id,
          ],
        },
      },
      world: {
        ...nextState.world,
        nextGenerationalTalentYear: assignment.nextGenerationalTalentYear,
        generationalTalentPlayerIds: [
          ...nextState.world.generationalTalentPlayerIds,
          assignment.player.id,
        ],
      },
    };
    intakePlayerIds.push(assignment.player.id);
    intakePlayerIdsBySchool[assignment.schoolId] = [
      ...intakePlayerIdsBySchool[assignment.schoolId],
      assignment.player.id,
    ];
  }

  nextState = advanceRivalWorld(nextState, data, random);
  nextState = restoreCanonicalReputation(nextState, schools);
  const playerRelationships = rebuildRelationships(nextState, random);
  nextState = {
    ...nextState,
    randomCursor: random.cursor,
    playerRelationships,
  };

  return {
    state: nextState,
    summary: {
      academicYear: nextAcademicYear,
      graduatedPlayerIds,
      intakePlayerIds,
      graduatedPlayerIdsBySchool,
      intakePlayerIdsBySchool,
      captainPlayerIdsBySchool,
      generationalTalentPlayerId,
      generationalTalentSchoolId,
    },
  };
}

export function advanceGameWeek(
  state: GameState,
  data: GameDataRegistry,
): AdvanceGameWeekResult {
  const weekly = advanceOneWeek(state);
  if (!crossesAcademicYear(state.date, weekly.state.date)) {
    return { ...weekly, academicYearTransition: null };
  }

  const random = new SeededRandom(weekly.state.seed, weekly.state.randomCursor);
  const transition = advanceAcademicYear(weekly.state, data, random);
  return {
    ...weekly,
    state: transition.state,
    academicYearTransition: transition.summary,
  };
}
