import type { GameDataRegistry } from "../../data/dataRegistry";
import {
  calculateDynamicsTrainingModifiers,
  progressWeeklyDynamics,
} from "../dynamics/progressWeeklyDynamics";
import type { GameState } from "../model/GameState";
import {
  ABILITY_KEYS,
  clampAbility,
  type Player,
  type PlayerInjury,
} from "../model/Player";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
import type {
  AbilityKey,
  IndividualTrainingInstructionDefinition,
  PersonalityDefinition,
} from "../validation/gameDataSchema";
import {
  calculateGrowth,
  type AdditionalGrowthModifier,
  type GrowthModifier,
} from "./calculateGrowth";
import {
  calculatePhase12InjuryRisk,
  getWeeklyConditionDrift,
} from "./phase12TrainingRules";

export interface IndividualTrainingAssignment {
  playerId: PlayerId;
  instructionId: string;
}

export interface WeeklyPlan {
  teamTrainingMenuId: string;
  individualAssignments: IndividualTrainingAssignment[];
}

export type ActivitySkipReason = "injured" | "auto-rest" | null;

export interface PlayerGrowthLog {
  playerId: PlayerId;
  abilityChanges: Partial<Record<AbilityKey, number>>;
  totalAbilityGrowth: number;
  fatigueChange: number;
  conditionChange: number;
  trustChange: number;
  academicRestricted: boolean;
  injuryRisk: number;
  injury: PlayerInjury | null;
  skippedReason: ActivitySkipReason;
  modifiers: GrowthModifier[];
}

export interface TrainingResult {
  schoolId: SchoolId;
  teamTrainingMenuId: string;
  individualAssignments: IndividualTrainingAssignment[];
  playerLogs: PlayerGrowthLog[];
  injuredPlayerIds: PlayerId[];
  randomCursor: number;
}

export interface WeeklyTrainingResolution {
  state: GameState;
  result: TrainingResult;
}

export interface ResolveWeeklyTrainingInput {
  state: GameState;
  schoolId: SchoolId;
  plan: WeeklyPlan;
  data: GameDataRegistry;
  random: RandomSource;
  additionalGrowthModifiers?: readonly AdditionalGrowthModifier[];
  restingPlayerIds?: ReadonlySet<PlayerId>;
}

export interface TrainingActivity {
  targetAbilities: readonly AbilityKey[];
  baseGrowth: number;
  fatigue: number;
  injuryRisk: number;
  trustGrowth: number;
}

export interface ResolvePlayerTrainingActivityInput {
  player: Player;
  school: NonNullable<GameState["schools"][SchoolId]>;
  data: GameDataRegistry;
  random: RandomSource;
  activity: TrainingActivity;
  additionalGrowthModifiers?: readonly AdditionalGrowthModifier[];
}

export interface PlayerTrainingActivityResolution {
  player: Player;
  log: PlayerGrowthLog;
}

function clampState(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function emptyLog(playerId: PlayerId): PlayerGrowthLog {
  return {
    playerId,
    abilityChanges: {},
    totalAbilityGrowth: 0,
    fatigueChange: 0,
    conditionChange: 0,
    trustChange: 0,
    academicRestricted: false,
    injuryRisk: 0,
    injury: null,
    skippedReason: null,
    modifiers: [],
  };
}

function trustChange(base: number, personality: PersonalityDefinition) {
  return Math.round(base * ((100 + personality.relationshipGrowth) / 100));
}

function applyGrowth(
  player: Player,
  targets: readonly AbilityKey[],
  amount: number,
) {
  const abilities = { ...player.abilities };
  const changes: Partial<Record<AbilityKey, number>> = {};
  for (const key of targets) {
    const before = abilities[key];
    const next = clampAbility(before + amount);
    abilities[key] = next;
    changes[key] = next - before;
  }
  return { abilities, changes };
}

function createInjury(risk: number, random: RandomSource): PlayerInjury {
  const severity: PlayerInjury["severity"] =
    risk >= 70 ? "severe" : risk >= 40 ? "moderate" : "minor";
  const remainingWeeks =
    severity === "severe"
      ? random.int(6, 10)
      : severity === "moderate"
        ? random.int(3, 5)
        : random.int(1, 2);
  return {
    injuryId: "injury.training-overuse",
    severity,
    remainingWeeks,
    recurrenceRisk: Math.min(80, 10 + Math.round(risk / 2)),
  };
}

function applyActivity(
  player: Player,
  activity: TrainingActivity,
  school: NonNullable<GameState["schools"][SchoolId]>,
  data: GameDataRegistry,
  random: RandomSource,
  log: PlayerGrowthLog,
  extra: readonly AdditionalGrowthModifier[],
  balanced = false,
): Player {
  if (player.injury) {
    log.skippedReason = "injured";
    return player;
  }

  const growthType = data.growthTypes.get(player.growthTypeId)!;
  const personality = data.personalities.get(player.personalityId)!;
  const growth = calculateGrowth({
    baseGrowth: activity.baseGrowth,
    player,
    school,
    growthType,
    personality,
    additionalModifiers: extra,
  });
  const targets = balanced ? ABILITY_KEYS : activity.targetAbilities;
  const amount = balanced
    ? growth.amount <= 0
      ? 0
      : Math.max(1, Math.round(growth.amount / 3))
    : growth.amount;
  const ability = applyGrowth(player, targets, amount);
  const conditionChange = getWeeklyConditionDrift(random);
  const trust = trustChange(activity.trustGrowth, personality);
  const risk = calculatePhase12InjuryRisk({
    baseRisk: activity.injuryRisk,
    condition: player.condition,
    injuryResistance: player.injuryResistance ?? 50,
    recoveryRoomLevel: school.facilities.recoveryRoom,
  });
  const injury =
    risk > 0 && random.int(1, 100) <= risk ? createInjury(risk, random) : null;

  log.abilityChanges = ability.changes;
  log.totalAbilityGrowth = Object.values(ability.changes).reduce(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  log.conditionChange = conditionChange;
  log.trustChange = trust;
  log.academicRestricted = growth.academicRestricted;
  log.injuryRisk = risk;
  log.injury = injury;
  log.modifiers = growth.modifiers;

  return {
    ...player,
    abilities: ability.abilities,
    condition: clampState(player.condition + conditionChange),
    trust: clampState(player.trust + trust),
    injury,
  };
}

function activityFromInstruction(
  instruction: IndividualTrainingInstructionDefinition,
): TrainingActivity {
  return {
    targetAbilities: instruction.targetAbilities,
    baseGrowth: instruction.baseGrowth,
    fatigue: 0,
    injuryRisk: instruction.injuryRisk,
    trustGrowth: instruction.trustGrowth,
  };
}

function validate(input: ResolveWeeklyTrainingInput) {
  const school = input.state.schools[input.schoolId];
  if (!school) {
    throw new Error(`unknown training school: ${input.schoolId}`);
  }
  if (!input.data.trainingMenus.has(input.plan.teamTrainingMenuId)) {
    throw new Error(
      `unknown team training menu: ${input.plan.teamTrainingMenuId}`,
    );
  }

  const assignedPlayerIds = input.plan.individualAssignments.map(
    (assignment) => assignment.playerId,
  );
  if (new Set(assignedPlayerIds).size !== assignedPlayerIds.length) {
    throw new Error("individual assignments must use distinct players");
  }

  const schoolPlayerIds = new Set(school.playerIds);
  const instructionByPlayerId = new Map<
    PlayerId,
    IndividualTrainingInstructionDefinition
  >();

  for (const id of school.playerIds) {
    const player = input.state.players[id];
    if (!player) {
      throw new Error(`school references unknown player: ${id}`);
    }
    if (!input.data.growthTypes.has(player.growthTypeId)) {
      throw new Error(`unknown player growth type: ${player.growthTypeId}`);
    }
    if (!input.data.personalities.has(player.personalityId)) {
      throw new Error(`unknown player personality: ${player.personalityId}`);
    }
  }

  for (const assignment of input.plan.individualAssignments) {
    if (!schoolPlayerIds.has(assignment.playerId)) {
      throw new Error(
        `individual assignment player is not in school: ${assignment.playerId}`,
      );
    }
    const instruction = input.data.individualTrainingInstructions.get(
      assignment.instructionId,
    );
    if (!instruction) {
      throw new Error(
        `unknown individual training instruction: ${assignment.instructionId}`,
      );
    }
    instructionByPlayerId.set(assignment.playerId, instruction);
  }

  const fallback = input.data.individualTrainingInstructions.get(
    "instruction.overall",
  );
  if (!fallback) {
    throw new Error("missing instruction.overall");
  }

  return { school, instructionByPlayerId, fallback };
}

export function resolvePlayerTrainingActivity(
  input: ResolvePlayerTrainingActivityInput,
): PlayerTrainingActivityResolution {
  const log = emptyLog(input.player.id);
  const player = applyActivity(
    input.player,
    { ...input.activity, fatigue: 0 },
    input.school,
    input.data,
    input.random,
    log,
    input.additionalGrowthModifiers ?? [],
  );
  return { player, log };
}

export function resolveWeeklyTraining(
  input: ResolveWeeklyTrainingInput,
): WeeklyTrainingResolution {
  const validated = validate(input);
  const initialRandomCursor = input.random.cursor;
  const players = { ...input.state.players };
  const logs: PlayerGrowthLog[] = [];
  const injuredPlayerIds: PlayerId[] = [];
  const assignments: IndividualTrainingAssignment[] = [];
  const includeDynamics = input.schoolId === input.state.userSchoolId;

  for (const id of validated.school.playerIds) {
    const original = input.state.players[id]!;
    const log = emptyLog(id);

    if (input.restingPlayerIds?.has(id)) {
      log.skippedReason = "auto-rest";
      players[id] = original;
      logs.push(log);
      continue;
    }

    const instruction =
      validated.instructionByPlayerId.get(id) ?? validated.fallback;
    assignments.push({ playerId: id, instructionId: instruction.id });

    if (original.injury) {
      log.skippedReason = "injured";
      players[id] = original;
      logs.push(log);
      continue;
    }

    if (instruction.id === "instruction.rest") {
      const drift = getWeeklyConditionDrift(input.random);
      const nextCondition = clampState(original.condition + 25 + drift);
      log.conditionChange = nextCondition - original.condition;
      players[id] = { ...original, condition: nextCondition };
      logs.push(log);
      continue;
    }

    const extraModifiers = includeDynamics
      ? [
          ...(input.additionalGrowthModifiers ?? []),
          ...calculateDynamicsTrainingModifiers(original),
        ]
      : (input.additionalGrowthModifiers ?? []);
    const updated = applyActivity(
      original,
      activityFromInstruction(instruction),
      validated.school,
      input.data,
      input.random,
      log,
      extraModifiers,
      instruction.id === "instruction.overall",
    );
    players[id] = updated;
    logs.push(log);
    if (updated.injury && !original.injury) {
      injuredPlayerIds.push(id);
    }
  }

  const consumedRandomValues = input.random.cursor - initialRandomCursor;
  const trainedState = {
    ...input.state,
    players,
    randomCursor: input.state.randomCursor + consumedRandomValues,
  };
  const state = includeDynamics
    ? progressWeeklyDynamics(trainedState)
    : trainedState;

  return {
    state,
    result: {
      schoolId: input.schoolId,
      teamTrainingMenuId: input.plan.teamTrainingMenuId,
      individualAssignments: assignments,
      playerLogs: logs,
      injuredPlayerIds,
      randomCursor: input.random.cursor,
    },
  };
}
