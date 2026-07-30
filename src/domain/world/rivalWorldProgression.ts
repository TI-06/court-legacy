import type { GameDataRegistry } from "../../data/dataRegistry";
import type { GameState, HistoricalMatchSummary } from "../model/GameState";
import {
  ABILITY_KEYS,
  clampAbility,
  type Player,
  type PlayerAbilities,
} from "../model/Player";
import type {
  School,
  SchoolFacilities,
  SchoolReputation,
} from "../model/School";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";

export const MAX_MATCH_HISTORY = 500;
export const MAX_GRADUATE_HISTORY = 640;
export const MAX_ALUMNI_PER_SCHOOL = 40;
export const MAX_GENERATIONAL_TALENTS = 64;

const DESTINY_RIVAL_THRESHOLD = 60;
const RIVALRY_SCORE_LIMIT = 100;
const SEASON_RATING_WINDOW = 3;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

export function rivalryKey(left: SchoolId, right: SchoolId): string {
  return [left, right].sort().join("::");
}

function reputationFromPoints(points: number): SchoolReputation {
  if (points >= 850) {
    return "elite";
  }
  if (points >= 620) {
    return "national-regular";
  }
  if (points >= 400) {
    return "national-qualifier";
  }
  if (points >= 220) {
    return "prefectural-power";
  }
  if (points >= 80) {
    return "district-contender";
  }
  return "unknown";
}

function isFinalTournament(tournamentId: string | null): boolean {
  return Boolean(tournamentId && /final|決勝/i.test(tournamentId));
}

function priorMeetingCount(
  matches: readonly HistoricalMatchSummary[],
  left: SchoolId,
  right: SchoolId,
): number {
  return matches.filter(
    (match) =>
      rivalryKey(match.homeSchoolId, match.awaySchoolId) ===
      rivalryKey(left, right),
  ).length;
}

function rivalryGain(
  state: GameState,
  summary: HistoricalMatchSummary,
): number {
  const home = state.schools[summary.homeSchoolId];
  const away = state.schools[summary.awaySchoolId];
  if (!home || !away) {
    return 0;
  }

  const loser =
    summary.winnerSchoolId === home.id
      ? away
      : summary.winnerSchoolId === away.id
        ? home
        : null;
  const winner = state.schools[summary.winnerSchoolId];
  const setDifference = Math.abs(summary.homeSetsWon - summary.awaySetsWon);
  const meetings = priorMeetingCount(
    state.history.matches,
    summary.homeSchoolId,
    summary.awaySchoolId,
  );

  let gain = 5;
  if (setDifference <= 1) {
    gain += 5;
  }
  gain += Math.min(8, meetings * 2);
  if (
    winner &&
    loser &&
    loser.reputationPoints - winner.reputationPoints >= 150
  ) {
    gain += 12;
  }
  if (summary.tournamentId) {
    gain += 5;
  }
  if (isFinalTournament(summary.tournamentId)) {
    gain += 8;
  }
  return gain;
}

function updateOfficialRecords(
  schools: GameState["schools"],
  summary: HistoricalMatchSummary,
): GameState["schools"] {
  if (!summary.tournamentId) {
    return schools;
  }
  const home = schools[summary.homeSchoolId];
  const away = schools[summary.awaySchoolId];
  if (!home || !away) {
    return schools;
  }
  const winnerId = summary.winnerSchoolId;
  const loserId = winnerId === home.id ? away.id : home.id;
  const winner = schools[winnerId];
  const loser = schools[loserId];
  if (!winner || !loser) {
    return schools;
  }

  return {
    ...schools,
    [winnerId]: {
      ...winner,
      history: {
        ...winner.history,
        officialWins: winner.history.officialWins + 1,
      },
    },
    [loserId]: {
      ...loser,
      history: {
        ...loser.history,
        officialLosses: loser.history.officialLosses + 1,
      },
    },
  };
}

function destinyRivalSchoolId(
  state: GameState,
  rivalryScores: Readonly<Record<string, number>>,
): SchoolId | null {
  let best: { schoolId: SchoolId; score: number } | null = null;
  for (const [key, score] of Object.entries(rivalryScores)) {
    const [left, right] = key.split("::") as [SchoolId, SchoolId];
    const opponent =
      left === state.userSchoolId
        ? right
        : right === state.userSchoolId
          ? left
          : null;
    if (!opponent || score < DESTINY_RIVAL_THRESHOLD) {
      continue;
    }
    if (
      !best ||
      score > best.score ||
      (score === best.score && opponent.localeCompare(best.schoolId) < 0)
    ) {
      best = { schoolId: opponent, score };
    }
  }
  return best?.schoolId ?? null;
}

function applyRivalryChange(
  state: GameState,
  left: SchoolId,
  right: SchoolId,
  amount: number,
): GameState {
  if (left === right || !state.schools[left] || !state.schools[right]) {
    return state;
  }
  const key = rivalryKey(left, right);
  const rivalryScores = {
    ...state.world.rivalryScores,
    [key]: clamp(
      (state.world.rivalryScores[key] ?? 0) + amount,
      0,
      RIVALRY_SCORE_LIMIT,
    ),
  };
  const nextState = {
    ...state,
    world: {
      ...state.world,
      rivalryScores,
    },
  };
  return {
    ...nextState,
    world: {
      ...nextState.world,
      destinyRivalSchoolId: destinyRivalSchoolId(nextState, rivalryScores),
    },
  };
}

export function recordScoutingConflict(
  state: GameState,
  rivalSchoolId: SchoolId,
  intensity = 10,
): GameState {
  if (rivalSchoolId === state.userSchoolId || !state.schools[rivalSchoolId]) {
    return state;
  }
  return applyRivalryChange(
    state,
    state.userSchoolId,
    rivalSchoolId,
    clamp(intensity, 1, 30),
  );
}

export function recordMatchOutcome(
  state: GameState,
  summary: HistoricalMatchSummary,
): GameState {
  if (
    state.history.matches.some((match) => match.matchId === summary.matchId)
  ) {
    return state;
  }
  const rivalryState = applyRivalryChange(
    state,
    summary.homeSchoolId,
    summary.awaySchoolId,
    rivalryGain(state, summary),
  );
  const matches = [...rivalryState.history.matches, summary].slice(
    -MAX_MATCH_HISTORY,
  );
  const schools = updateOfficialRecords(rivalryState.schools, summary);
  return {
    ...rivalryState,
    schools,
    history: {
      ...rivalryState.history,
      matches,
    },
  };
}

function abilityAverage(player: Player): number {
  return (
    ABILITY_KEYS.reduce(
      (total, ability) => total + player.abilities[ability],
      0,
    ) / ABILITY_KEYS.length
  );
}

function teamRating(
  school: School,
  players: Readonly<Record<PlayerId, Player>>,
): number {
  const squad = school.playerIds
    .map((playerId) => players[playerId])
    .filter((player): player is Player => Boolean(player));
  const topPlayers = [...squad]
    .sort((left, right) => abilityAverage(right) - abilityAverage(left))
    .slice(0, 8);
  const playerStrength =
    topPlayers.reduce((total, player) => total + abilityAverage(player), 0) /
    Math.max(1, topPlayers.length);
  const facilityStrength =
    (school.facilities.gym +
      school.facilities.trainingRoom +
      school.facilities.analysisRoom +
      school.facilities.recoveryRoom) *
    1.5;

  return clamp(
    playerStrength * 0.7 +
      school.coach.tactics * 0.12 +
      school.coach.development * 0.1 +
      school.coach.leadership * 0.08 +
      facilityStrength,
    0,
    100,
  );
}

function developRivalPlayer(
  player: Player,
  school: School,
  priorityAbilities: readonly (keyof PlayerAbilities)[],
  random: RandomSource,
): Player {
  const developmentLevel =
    1 +
    Math.floor(
      (school.coach.development +
        school.facilities.trainingRoom * 10 +
        school.facilities.gym * 5) /
        55,
    );
  const gradeBonus = player.grade === 2 ? 1 : 0;
  const abilities = { ...player.abilities };

  for (const ability of ABILITY_KEYS) {
    const prioritized = priorityAbilities.includes(ability);
    const growth = prioritized
      ? developmentLevel + gradeBonus + 1 + random.int(0, 1)
      : Math.max(0, Math.floor(developmentLevel / 2) + random.int(0, 1));
    abilities[ability] = clampAbility(abilities[ability] + growth);
  }

  const recovery = 3 + Math.floor(school.coach.conditioning / 25);
  return {
    ...player,
    abilities,
    fatigue: clamp(player.fatigue - recovery, 0, 100),
    condition: clamp(player.condition + 2, 0, 100),
    morale: clamp(player.morale + random.int(-2, 3), 0, 100),
  };
}

function promoteProspect(
  player: Player,
  school: School,
  priorityAbilities: readonly (keyof PlayerAbilities)[],
): Player {
  const abilities = { ...player.abilities };
  for (const ability of priorityAbilities) {
    abilities[ability] = clampAbility(abilities[ability] + 3);
  }
  return {
    ...player,
    tier: "prospect",
    abilities,
    morale: clamp(player.morale + 5, 0, 100),
    trust: clamp(player.trust + 3, 0, 100),
    hiddenTraitIds: [...new Set([...player.hiddenTraitIds, "world.prospect"])],
    appearanceSeed: player.appearanceSeed + school.history.seasons,
  };
}

function maybePromoteIntakeProspect(
  player: Player,
  school: School,
  priorityAbilities: readonly (keyof PlayerAbilities)[],
  random: RandomSource,
): Player {
  if (player.grade !== 1 || player.tier !== "normal") {
    return player;
  }
  const chance = clamp(
    2 +
      Math.floor(school.reputationPoints / 80) +
      Math.floor(school.coach.scouting / 12) +
      school.facilities.scoutingNetwork * 3,
    2,
    30,
  );
  return random.int(1, 100) <= chance
    ? promoteProspect(player, school, priorityAbilities)
    : player;
}

function facilityTotal(facilities: SchoolFacilities): number {
  return Object.values(facilities).reduce((total, level) => total + level, 0);
}

function evolveFacilities(
  facilities: SchoolFacilities,
  recentRating: number,
  funds: number,
  random: RandomSource,
): SchoolFacilities {
  const next = { ...facilities };
  const growthCandidates = [
    "gym",
    "trainingRoom",
    "analysisRoom",
    "recoveryRoom",
    "scoutingNetwork",
  ] as const;
  if (
    recentRating >= 72 &&
    funds >= 300 &&
    random.int(1, 100) <= 45 &&
    facilityTotal(next) < 35
  ) {
    const key = random.pick(growthCandidates);
    next[key] = Math.min(5, next[key] + 1);
  } else if (recentRating <= 42 && funds <= 180 && random.int(1, 100) <= 30) {
    const candidates = growthCandidates.filter((key) => next[key] > 0);
    if (candidates.length > 0) {
      const key = random.pick(candidates);
      next[key] = Math.max(0, next[key] - 1);
    }
  }
  return next;
}

function evolveSchool(
  school: School,
  players: Readonly<Record<PlayerId, Player>>,
  random: RandomSource,
): School {
  const rating = teamRating(school, players);
  const recentSeasonRatings = [
    ...(school.history.recentSeasonRatings ?? []),
    rating,
  ].slice(-SEASON_RATING_WINDOW);
  const recentAverage =
    recentSeasonRatings.reduce((total, value) => total + value, 0) /
    recentSeasonRatings.length;
  const performanceTarget = clamp(
    recentAverage * 7.5 +
      school.coach.network * 1.2 +
      school.coach.charisma * 0.6 +
      school.history.nationalTitles * 25,
    0,
    1000,
  );
  const reputationDelta = clamp(
    (performanceTarget - school.reputationPoints) / 6 + random.int(-8, 8),
    -35,
    35,
  );
  const reputationPoints = clamp(
    school.reputationPoints + reputationDelta,
    0,
    1000,
  );
  const funds = clamp(
    school.funds +
      Math.floor(reputationPoints / 35) +
      Math.floor(recentAverage / 5) -
      10,
    0,
    1_000_000,
  );

  return {
    ...school,
    reputation: reputationFromPoints(reputationPoints),
    reputationPoints,
    funds,
    facilities: evolveFacilities(
      school.facilities,
      recentAverage,
      funds,
      random,
    ),
    history: {
      ...school.history,
      recentSeasonRatings,
      peakReputationPoints: Math.max(
        school.history.peakReputationPoints ?? school.reputationPoints,
        reputationPoints,
      ),
    },
  };
}

function retainBoundedArchives(state: GameState): GameState {
  const schools = { ...state.schools };
  const retainedPlayerIds = new Set<PlayerId>();

  for (const school of Object.values(schools)) {
    const alumniPlayerIds = [...new Set(school.alumniPlayerIds)].slice(
      -MAX_ALUMNI_PER_SCHOOL,
    );
    schools[school.id] = { ...school, alumniPlayerIds };
    for (const playerId of [...school.playerIds, ...alumniPlayerIds]) {
      retainedPlayerIds.add(playerId);
    }
  }

  const players = Object.fromEntries(
    Object.entries(state.players).filter(([playerId]) =>
      retainedPlayerIds.has(playerId as PlayerId),
    ),
  ) as GameState["players"];
  const generationalTalentPlayerIds = state.world.generationalTalentPlayerIds
    .filter((playerId) => retainedPlayerIds.has(playerId))
    .slice(-MAX_GENERATIONAL_TALENTS);

  return {
    ...state,
    schools,
    players,
    history: {
      ...state.history,
      matches: state.history.matches.slice(-MAX_MATCH_HISTORY),
      graduates: state.history.graduates.slice(-MAX_GRADUATE_HISTORY),
    },
    world: {
      ...state.world,
      generationalTalentPlayerIds,
    },
  };
}

export function advanceRivalWorld(
  state: GameState,
  data: GameDataRegistry,
  random: RandomSource,
): GameState {
  const players = { ...state.players };
  const schools = { ...state.schools };

  for (const school of Object.values(state.schools)) {
    if (school.id === state.userSchoolId) {
      continue;
    }
    const archetype = data.schoolArchetypes.get(school.archetypeId);
    if (!archetype) {
      continue;
    }
    const priorityAbilities = archetype.trainingPriorities;
    for (const playerId of school.playerIds) {
      const player = players[playerId];
      if (!player) {
        continue;
      }
      const recruited = maybePromoteIntakeProspect(
        player,
        school,
        priorityAbilities,
        random,
      );
      players[playerId] = developRivalPlayer(
        recruited,
        school,
        priorityAbilities,
        random,
      );
    }
    schools[school.id] = evolveSchool(school, players, random);
  }

  return retainBoundedArchives({
    ...state,
    players,
    schools,
    randomCursor: random.cursor,
  });
}
