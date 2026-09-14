import type { GameDataRegistry } from "../../data/dataRegistry";
import type { MatchState } from "../model/Match";
import { clampAbility, type Grade, type Player } from "../model/Player";
import type { GameState } from "../model/GameState";
import type { PlayerId } from "../model/identifiers";
import type { TeamSelection } from "../model/TeamSelection";
import type {
  AbilityKey,
  GrowthTypeDefinition,
} from "../validation/gameDataSchema";

function abilityCeilingTierBonus(tier: Player["tier"]): number {
  if (tier === "generational") return 4;
  if (tier === "monster") return 3;
  if (tier === "elite") return 2;
  if (tier === "promising" || tier === "prospect") return 1;
  return 0;
}

export function calculateLongTermAbilityCeiling(
  potential: number | undefined,
  tier: Player["tier"],
): number {
  const safePotential = Math.max(0, Math.min(100, potential ?? 75));
  return clampAbility(
    82 + safePotential * 0.14 + abilityCeilingTierBonus(tier),
  );
}

export function applyLongTermAbilityGrowth(
  before: number,
  amount: number,
  potential: number | undefined,
  tier: Player["tier"],
): number {
  const current = clampAbility(before);
  if (amount <= 0) return current;

  const ceiling = calculateLongTermAbilityCeiling(potential, tier);
  if (current >= ceiling) return current;

  const scale =
    current >= 95 ? 0.15 : current >= 90 ? 0.3 : current >= 80 ? 0.6 : 1;
  let adjustedGrowth = Math.max(1, Math.round(amount * scale));
  if (ceiling - current <= 2) {
    adjustedGrowth = Math.min(adjustedGrowth, 1);
  }
  return Math.min(ceiling, current + adjustedGrowth);
}

export function growthGradeMultiplier(
  grade: Grade,
  growthType: GrowthTypeDefinition,
): number {
  if (grade === 1) return growthType.gradeMultipliers.grade1;
  if (grade === 2) return growthType.gradeMultipliers.grade2;
  return growthType.gradeMultipliers.grade3;
}

export interface MatchExperienceAmountInput {
  player: Player;
  growthType: GrowthTypeDefinition;
  lost: boolean;
  strongerOpponent: boolean;
}

export function calculateMatchExperienceAmount(
  input: MatchExperienceAmountInput,
): number {
  const grade = growthGradeMultiplier(input.player.grade, input.growthType);
  const score = (grade * input.growthType.matchMultiplier) / 10_000;
  let amount = score >= 1.25 ? 2 : score >= 0.65 ? 1 : 0;

  if (input.growthType.id === "growth.adversity") {
    amount = 1;
    if (input.lost || input.strongerOpponent) amount += 1;
  }

  return Math.max(0, Math.min(2, amount));
}

function selectionPlayerIds(selection: TeamSelection): PlayerId[] {
  const ids = selection.rotation.map((assignment) => assignment.playerId);
  if (selection.liberoPlayerId) ids.push(selection.liberoPlayerId);
  return [...new Set(ids)];
}

export function calculateSelectionAverageAbility(
  state: GameState,
  selection: TeamSelection,
): number {
  const players = selectionPlayerIds(selection)
    .map((id) => state.players[id])
    .filter((player): player is Player => Boolean(player));
  if (players.length === 0) return 0;

  const total = players.reduce((teamTotal, player) => {
    const abilities = Object.values(player.abilities);
    return (
      teamTotal +
      abilities.reduce((sum, value) => sum + value, 0) / abilities.length
    );
  }, 0);
  return total / players.length;
}

function matchParticipants(
  match: MatchState,
  selection: TeamSelection,
): PlayerId[] {
  const roster = new Set<PlayerId>([
    ...selection.rotation.map((assignment) => assignment.playerId),
    ...selection.benchPlayerIds,
  ]);
  if (selection.liberoPlayerId) roster.add(selection.liberoPlayerId);

  const participants = new Set<PlayerId>(selectionPlayerIds(selection));
  for (const event of match.eventLog) {
    if (event.actorPlayerId && roster.has(event.actorPlayerId)) {
      participants.add(event.actorPlayerId);
    }
    if (event.targetPlayerId && roster.has(event.targetPlayerId)) {
      participants.add(event.targetPlayerId);
    }
  }
  return [...participants];
}

function matchGrowthTargets(player: Player): readonly AbilityKey[] {
  const coreByPosition: Record<Player["preferredPosition"], AbilityKey> = {
    OH: "spike",
    MB: "block",
    OP: "spike",
    S: "set",
    L: "receive",
  };
  return ["decision", coreByPosition[player.preferredPosition]];
}

export interface ApplyUserMatchExperienceInput {
  state: GameState;
  data: GameDataRegistry;
  match: MatchState;
  selection: TeamSelection;
  strongerOpponent: boolean;
}

export function applyUserMatchExperience(
  input: ApplyUserMatchExperienceInput,
): GameState {
  if (input.match.phase !== "match-complete") return input.state;

  const lost =
    input.match.homeSchoolId === input.state.userSchoolId
      ? input.match.awaySetsWon > input.match.homeSetsWon
      : input.match.homeSetsWon > input.match.awaySetsWon;
  const players = { ...input.state.players };
  let changed = false;

  for (const id of matchParticipants(input.match, input.selection)) {
    const current = input.state.players[id];
    if (!current || current.career.schoolId !== input.state.userSchoolId)
      continue;
    const growthType = input.data.growthTypes.get(current.growthTypeId);
    if (!growthType) continue;

    const amount = calculateMatchExperienceAmount({
      player: current,
      growthType,
      lost,
      strongerOpponent: input.strongerOpponent,
    });
    if (amount <= 0) continue;

    const abilities = { ...current.abilities };
    for (const key of matchGrowthTargets(current)) {
      abilities[key] = applyLongTermAbilityGrowth(
        abilities[key],
        amount,
        current.potential,
        current.tier,
      );
    }
    players[id] = { ...current, abilities };
    changed = true;
  }

  return changed ? { ...input.state, players } : input.state;
}
