from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one replacement, found {count}")
    file.write_text(text.replace(old, new, 1))


player_development = '''import type { GameDataRegistry } from "../../data/dataRegistry";
import type { MatchState } from "../model/Match";
import {
  clampAbility,
  type Grade,
  type Player,
} from "../model/Player";
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
  return clampAbility(82 + safePotential * 0.14 + abilityCeilingTierBonus(tier));
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

  const lost = input.match.homeSchoolId === input.state.userSchoolId
    ? input.match.awaySetsWon > input.match.homeSetsWon
    : input.match.homeSetsWon > input.match.awaySetsWon;
  const players = { ...input.state.players };
  let changed = false;

  for (const id of matchParticipants(input.match, input.selection)) {
    const current = input.state.players[id];
    if (!current || current.career.schoolId !== input.state.userSchoolId) continue;
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
'''
Path("src/domain/player/playerDevelopment.ts").write_text(player_development)

replace_once(
    "src/domain/training/resolveWeeklyTraining.ts",
    '''import {
  ABILITY_KEYS,
  clampAbility,
  type Player,
  type PlayerInjury,
} from "../model/Player";
import type { PlayerId, SchoolId } from "../model/identifiers";''',
    '''import {
  ABILITY_KEYS,
  type Player,
  type PlayerInjury,
} from "../model/Player";
import type { PlayerId, SchoolId } from "../model/identifiers";
import { applyLongTermAbilityGrowth } from "../player/playerDevelopment";''',
)
replace_once(
    "src/domain/training/resolveWeeklyTraining.ts",
    '''function abilityCeilingTierBonus(tier: Player["tier"]): number {
  if (tier === "generational") return 4;
  if (tier === "monster") return 3;
  if (tier === "elite") return 2;
  if (tier === "promising" || tier === "prospect") return 1;
  return 0;
}

export function applyLongTermAbilityGrowth(
  before: number,
  amount: number,
  potential: number | undefined,
  tier: Player["tier"],
): number {
  const current = clampAbility(before);
  if (amount <= 0) return current;

  const safePotential = Math.max(0, Math.min(100, potential ?? 75));
  const ceiling = clampAbility(
    82 + safePotential * 0.14 + abilityCeilingTierBonus(tier),
  );
  if (current >= ceiling) return current;

  const scale =
    current >= 95 ? 0.15 : current >= 90 ? 0.3 : current >= 80 ? 0.6 : 1;
  let adjustedGrowth = Math.max(1, Math.round(amount * scale));
  if (ceiling - current <= 2) {
    adjustedGrowth = Math.min(adjustedGrowth, 1);
  }
  return Math.min(ceiling, current + adjustedGrowth);
}
''',
    '''export { applyLongTermAbilityGrowth } from "../player/playerDevelopment";
''',
)

replace_once(
    "src/domain/training/calculateGrowth.ts",
    '''function averageAbility(player: Player): number {
  const values = Object.values(player.abilities);
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function longTermDevelopmentMultiplier(player: Player): number {
  const overall = averageAbility(player);
  const potential = Math.max(0, Math.min(100, player.potential ?? 75));
  const potentialCeiling = Math.max(
    88,
    Math.min(100, Math.round(84 + potential * 0.16)),
  );

  if (overall >= potentialCeiling) return 0;
  if (overall >= 95) return 10;
  if (overall >= 90) return 25;
  if (overall >= 80) return 55;
  return 100;
}

''',
    "",
)
replace_once(
    "src/domain/training/calculateGrowth.ts",
    '''  const development = longTermDevelopmentMultiplier(input.player);
''',
    "",
)
replace_once(
    "src/domain/training/calculateGrowth.ts",
    '''  const unrestrictedAmount = Math.max(
    0,
    Math.round(
      ((input.baseGrowth * growthMultiplier) / 4) * (development / 100),
    ),
  );''',
    '''  const unrestrictedAmount = Math.max(
    0,
    Math.round((input.baseGrowth * growthMultiplier) / 4),
  );''',
)

calc_test = Path("tests/unit/domain/training/calculateGrowth.test.ts")
text = calc_test.read_text()
start = text.index('  it("slows growth sharply after a player reaches the nineties"')
end = text.index('  it("ignores legacy fatigue while keeping academic restriction active"', start)
replacement = '''  it("leaves long-term ceiling enforcement to the canonical player policy", () => {
    const common = {
      baseGrowth: 40,
      school: createSchool({
        coach: { ...createSchool().coach, development: 80 },
        facilities: { ...createSchool().facilities, trainingRoom: 20 },
      }),
      growthType: data.growthTypes.get("growth.standard")!,
      personality: data.personalities.get("personality.calm")!,
    };
    const developing = calculateGrowth({
      ...common,
      player: createPlayer({ abilities: abilities(75), potential: 70 }),
    });
    const advanced = calculateGrowth({
      ...common,
      player: createPlayer({ abilities: abilities(92), potential: 70 }),
    });

    expect(advanced.amount).toBe(developing.amount);
  });

'''
calc_test.write_text(text[:start] + replacement + text[end:])

replace_once(
    "worker/game/applyGameAction.ts",
    '''import type { Player } from "../../src/domain/model/Player";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";''',
    '''import type { Player } from "../../src/domain/model/Player";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import {
  applyUserMatchExperience,
  calculateSelectionAverageAbility,
} from "../../src/domain/player/playerDevelopment";''',
)
replace_once(
    "worker/game/applyGameAction.ts",
    '''function consumeNextTrainingGrowthBoost(state: GameState): GameState {''',
    '''function applyCompletedSoloMatchExperience(
  state: GameState,
  strengthState: GameState,
  match: SimulateMatchResult["match"],
): GameState {
  const userIsHome = match.homeSchoolId === state.userSchoolId;
  const userSelection = userIsHome ? match.homeSelection : match.awaySelection;
  const opponentSelection = userIsHome ? match.awaySelection : match.homeSelection;
  const userStrength = calculateSelectionAverageAbility(
    strengthState,
    userSelection,
  );
  const opponentStrength = calculateSelectionAverageAbility(
    strengthState,
    opponentSelection,
  );
  return applyUserMatchExperience({
    state,
    data: gameData,
    match,
    selection: userSelection,
    strongerOpponent: opponentStrength > userStrength + 2,
  });
}

function consumeNextTrainingGrowthBoost(state: GameState): GameState {''',
)
replace_once(
    "worker/game/applyGameAction.ts",
    '''    const recorded = recordMatchOutcome(matchState, {
      matchId: simulation.match.id,''',
    '''    const experiencedState = applyCompletedSoloMatchExperience(
      matchState,
      matchState,
      simulation.match,
    );
    const recorded = recordMatchOutcome(experiencedState, {
      matchId: simulation.match.id,''',
)
replace_once(
    "worker/game/applyGameAction.ts",
    '''    const recorded = recordMatchOutcome(resumedState, {
      matchId: simulation.match.id,''',
    '''    const experiencedState = applyCompletedSoloMatchExperience(
      resumedState,
      resumedState,
      simulation.match,
    );
    const recorded = recordMatchOutcome(experiencedState, {
      matchId: simulation.match.id,''',
)
replace_once(
    "worker/game/applyGameAction.ts",
    '''    const recorded = recordOfficialTournamentOutcome({
      state: resumedState,
      circuit: due.circuit,''',
    '''    const experiencedState = applyCompletedSoloMatchExperience(
      resumedState,
      context.state,
      simulation.match,
    );
    const recorded = recordOfficialTournamentOutcome({
      state: experiencedState,
      circuit: due.circuit,''',
)

print("phase19 player-growth patch applied")
