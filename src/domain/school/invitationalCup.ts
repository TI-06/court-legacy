import { matchId, type MatchId, type SchoolId } from "../model/identifiers";
import type { GameState } from "../model/GameState";
import type { MatchState } from "../model/Match";
import { calculateSelectionAverageAbility } from "../player/playerDevelopment";
import { legacyReputationFromPoints } from "./reputation";
import { autoSelectTeam } from "../team/autoSelectTeam";

export type InvitationalCupRound = "semifinal" | "final";

export interface InvitationalCupState {
  yearIndex: number;
  tournamentId: string;
  entrantSchoolIds: [SchoolId, SchoolId, SchoolId, SchoolId];
  currentRound: InvitationalCupRound | null;
  currentOpponentSchoolId: SchoolId | null;
  finalOpponentSchoolId: SchoolId;
  championSchoolId: SchoolId | null;
  userEliminated: boolean;
}

function schoolStrength(state: GameState, schoolId: SchoolId): number {
  try {
    return calculateSelectionAverageAbility(
      state,
      autoSelectTeam({ state, schoolId }),
    );
  } catch {
    return 0;
  }
}

function rankedOpponentIds(state: GameState): SchoolId[] {
  return Object.values(state.schools)
    .filter(
      (school) =>
        school.id !== state.userSchoolId &&
        school.playerIds.filter((id) => state.players[id]).length >= 6,
    )
    .map((school) => ({
      schoolId: school.id,
      reputationPoints: school.reputationPoints,
      strength: schoolStrength(state, school.id),
    }))
    .sort(
      (left, right) =>
        right.reputationPoints - left.reputationPoints ||
        right.strength - left.strength ||
        String(left.schoolId).localeCompare(String(right.schoolId)),
    )
    .map((candidate) => candidate.schoolId);
}

function deterministicNpcWinner(
  state: GameState,
  left: SchoolId,
  right: SchoolId,
): SchoolId {
  const leftStrength = schoolStrength(state, left);
  const rightStrength = schoolStrength(state, right);
  if (leftStrength !== rightStrength) {
    return leftStrength > rightStrength ? left : right;
  }
  return String(left).localeCompare(String(right)) <= 0 ? left : right;
}

export function createInvitationalCup(
  state: GameState,
): InvitationalCupState | null {
  const opponents = rankedOpponentIds(state).slice(0, 3);
  if (opponents.length < 3) return null;
  const [semiOpponent, npcA, npcB] = opponents as [
    SchoolId,
    SchoolId,
    SchoolId,
  ];
  const finalOpponentSchoolId = deterministicNpcWinner(state, npcA, npcB);
  return {
    yearIndex: state.yearIndex,
    tournamentId: `invitational:${state.yearIndex}`,
    entrantSchoolIds: [
      state.userSchoolId,
      semiOpponent,
      npcA,
      npcB,
    ],
    currentRound: "semifinal",
    currentOpponentSchoolId: semiOpponent,
    finalOpponentSchoolId,
    championSchoolId: null,
    userEliminated: false,
  };
}

export function activeInvitationalCup(
  state: GameState,
): InvitationalCupState | null {
  const cup = state.schoolManagement.invitationalCup;
  return cup?.yearIndex === state.yearIndex ? cup : null;
}

export function invitationalMatchId(
  cup: InvitationalCupState,
): MatchId | null {
  if (!cup.currentRound || !cup.currentOpponentSchoolId) return null;
  return matchId(
    `${cup.tournamentId}:${cup.currentRound}:${cup.currentOpponentSchoolId}`,
  );
}

export function recordInvitationalOutcome(
  state: GameState,
  match: MatchState,
): GameState {
  const cup = activeInvitationalCup(state);
  const expectedId = cup ? invitationalMatchId(cup) : null;
  if (
    !cup ||
    !expectedId ||
    match.id !== expectedId ||
    match.phase !== "match-complete"
  ) {
    return state;
  }

  const userWon =
    (match.homeSchoolId === state.userSchoolId && match.homeSetsWon === 2) ||
    (match.awaySchoolId === state.userSchoolId && match.awaySetsWon === 2);
  let nextCup: InvitationalCupState;
  let reputationBonus = 0;
  let titleBonus = 0;

  if (cup.currentRound === "semifinal") {
    if (userWon) {
      nextCup = {
        ...cup,
        currentRound: "final",
        currentOpponentSchoolId: cup.finalOpponentSchoolId,
      };
      reputationBonus = 8;
    } else {
      const semifinalWinner = cup.currentOpponentSchoolId!;
      nextCup = {
        ...cup,
        currentRound: null,
        currentOpponentSchoolId: null,
        championSchoolId: deterministicNpcWinner(
          state,
          semifinalWinner,
          cup.finalOpponentSchoolId,
        ),
        userEliminated: true,
      };
    }
  } else {
    nextCup = {
      ...cup,
      currentRound: null,
      currentOpponentSchoolId: null,
      championSchoolId: userWon
        ? state.userSchoolId
        : cup.currentOpponentSchoolId,
      userEliminated: !userWon,
    };
    if (userWon) {
      reputationBonus = 20;
      titleBonus = 1;
    }
  }

  const school = state.schools[state.userSchoolId]!;
  const nextPoints = Math.min(1400, school.reputationPoints + reputationBonus);
  return {
    ...state,
    schools: {
      ...state.schools,
      [school.id]: {
        ...school,
        reputationPoints: nextPoints,
        reputation: legacyReputationFromPoints(nextPoints),
        history: {
          ...school.history,
          invitationalTitles:
            (school.history.invitationalTitles ?? 0) + titleBonus,
        },
      },
    },
    schoolManagement: {
      ...state.schoolManagement,
      invitationalCup: nextCup,
    },
  };
}
