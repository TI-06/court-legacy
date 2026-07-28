import type { GameDataRegistry } from "../../data/dataRegistry";
import type { GameState } from "../model/GameState";
import {
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
  TrainingMenuDefinition,
} from "../validation/gameDataSchema";
import {
  calculateGrowth,
  type GrowthModifier,
} from "./calculateGrowth";

export interface IndividualTrainingAssignment {
  playerId: PlayerId;
  instructionId: string;
}

export interface WeeklyPlan {
  teamTrainingMenuId: string;
  individualAssignments: IndividualTrainingAssignment[];
}

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
  skippedReason: "injured" | null;
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
}

interface TrainingActivity {
  targetAbilities: readonly AbilityKey[];
  baseGrowth: number;
  fatigue: number;
  injuryRisk: number;
  trustGrowth: number;
}

function clampStateValue(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function validateWeeklyPlan(input: ResolveWeeklyTrainingInput): {
  schoolPlayerIds: Set<PlayerId>;
  menu: TrainingMenuDefinition;
  instructions: Map<PlayerId, IndividualTrainingInstructionDefinition>;
} {
  const school = input.state.schools[input.schoolId];
  if (!school) {
    throw new Error(`unknown training school: ${input.schoolId}`);
  }

  const menu = input.data.trainingMenus.get(input.plan.teamTrainingMenuId);
  if (!menu) {
    throw new Error(
      `unknown team training menu: ${input.plan.teamTrainingMenuId}`,
    );
  }

  if (input.plan.individualAssignments.length !== 2) {
    throw new Error("weekly plan requires exactly two individual assignments");
  }

  const assignmentPlayerIds = input.plan.individualAssignments.map(
    (assignment) => assignment.playerId,
  );
  if (new Set(assignmentPlayerIds).size !== assignmentPlayerIds.length) {
    throw new Error("individual assignments must use distinct players");
  }

  const schoolPlayerIds = new Set(school.playerIds);
  const instructions = new Map<
    PlayerId,
    IndividualTrainingInstructionDefinition
  >();

  for (const assignment of input.plan.individualAssignments) {
    if (!schoolPlayerIds.has(assignment.playerId)) {
      throw new Error(
        `individual assignment player is not in school: ${assignment.playerId}`,
      );
    }
    if (!input.state.players[assignment.playerId]) {
      throw new Error(`unknown individual assignment player: ${assignment.playerId}`);
    }

    const instruction = input.data.individualTrainingInstructions.get(
      assignment.instructionId,
    );
    if (!instruction) {
      throw new Error(
        `unknown individual training instruction: ${assignment.instructionId}`,
      );
    }
    instructions.set(assignment.playerId, instruction);
  }

  return { schoolPlayerIds, menu, instructions };
}

function activityFromMenu(menu: TrainingMenuDefinition): TrainingActivity {
  return {
    targetAbilities: menu.targetAbilities,
    baseGrowth: menu.baseGrowth,
    fatigue: menu.fatigue,
    injuryRisk: menu.injuryRisk,
    trustGrowth: menu.relationshipGrowth,
  };
}

function activityFromInstruction(
  instruction: IndividualTrainingInstructionDefinition,
): TrainingActivity {
  return {
    targetAbilities: instruction.targetAbilities,
    baseGrowth: instruction.baseGrowth,
    fatigue: instruction.fatigue,
    injuryRisk: instruction.injuryRisk,
    trustGrowth: instruction.trustGrowth,
  };
}

function calculateFatigueChange(
  player: Player,
  activityFatigue: number,
  conditioning: number,
  recoveryRoomLevel: number,
): number {
  if (activityFatigue < 0) {
    return Math.round(activityFatigue * (1 + recoveryRoomLevel * 0.08));
  }

  const resistancePercent = Math.max(
    60,
    Math.min(110, 120 - player.abilities.stamina * 0.35 - conditioning * 0.15),
  );
  return Math.max(0, Math.round(activityFatigue * (resistancePercent / 100)));
}

function calculateConditionChange(fatigueChange: number): number {
  if (fatigueChange < 0) {
    return Math.max(1, Math.ceil(Math.abs(fatigueChange) / 3));
  }
  if (fatigueChange > 0) {
    return -Math.max(1, Math.ceil(fatigueChange / 4));
  }
  return 0;
}

function calculateTrustChange(
  baseTrustGrowth: number,
  personality: PersonalityDefinition,
): number {
  return Math.round(
    baseTrustGrowth * ((100 + personality.relationshipGrowth) / 100),
  );
}

function applyAbilityGrowth(
  player: Player,
  targets: readonly AbilityKey[],
  amount: number,
): {
  abilities: Player["abilities"];
  changes: Partial<Record<AbilityKey, number>>;
} {
  const abilities = { ...player.abilities };
  const changes: Partial<Record<AbilityKey, number>> = {};

  for (const ability of targets) {
    const previous = abilities[ability];
    const next = clampAbility(previous + amount);
    abilities[ability] = next;
    changes[ability] = next - previous;
  }

  return { abilities, changes };
}

function mergeChanges(
  target: Partial<Record<AbilityKey, number>>,
  additions: Partial<Record<AbilityKey, number>>,
): void {
  for (const [ability, amount] of Object.entries(additions) as Array<
    [AbilityKey, number]
  >) {
    target[ability] = (target[ability] ?? 0) + amount;
  }
}

function calculateInjuryRisk(
  player: Player,
  activity: TrainingActivity,
  fatigueChange: number,
  conditioning: number,
  recoveryRoomLevel: number,
): number {
  return Math.max(
    0,
    Math.min(
      90,
      Math.round(
        activity.injuryRisk +
          player.fatigue / 5 +
          Math.max(0, fatigueChange - 5) -
          conditioning / 10 -
          recoveryRoomLevel * 2,
      ),
    ),
  );
}

function createTrainingInjury(
  risk: number,
  random: RandomSource,
): PlayerInjury {
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

function applyActivity(
  player: Player,
  activity: TrainingActivity,
  school: NonNullable<GameState["schools"][SchoolId]>,
  data: GameDataRegistry,
  random: RandomSource,
  log: PlayerGrowthLog,
): Player {
  if (player.injury) {
    log.skippedReason = "injured";
    return player;
  }

  const growthType = data.growthTypes.get(player.growthTypeId);
  const personality = data.personalities.get(player.personalityId);
  if (!growthType) {
    throw new Error(`unknown player growth type: ${player.growthTypeId}`);
  }
  if (!personality) {
    throw new Error(`unknown player personality: ${player.personalityId}`);
  }

  const growth = calculateGrowth({
    baseGrowth: activity.baseGrowth,
    player,
    school,
    growthType,
    personality,
  });
  const abilityResult = applyAbilityGrowth(
    player,
    activity.targetAbilities,
    growth.amount,
  );
  const fatigueChange = calculateFatigueChange(
    player,
    activity.fatigue,
    school.coach.conditioning,
    school.facilities.recoveryRoom,
  );
  const conditionChange = calculateConditionChange(fatigueChange);
  const trustChange = calculateTrustChange(activity.trustGrowth, personality);
  const injuryRisk = calculateInjuryRisk(
    player,
    activity,
    fatigueChange,
    school.coach.conditioning,
    school.facilities.recoveryRoom,
  );
  const injury =
    injuryRisk > 0 && random.int(1, 100) <= injuryRisk
      ? createTrainingInjury(injuryRisk, random)
      : null;

  mergeChanges(log.abilityChanges, abilityResult.changes);
  log.totalAbilityGrowth = Object.values(log.abilityChanges).reduce(
    (sum, amount) => sum + (amount ?? 0),
    0,
  );
  log.fatigueChange += fatigueChange;
  log.conditionChange += conditionChange;
  log.trustChange += trustChange;
  log.academicRestricted ||= growth.academicRestricted;
  log.injuryRisk = Math.max(log.injuryRisk, injuryRisk);
  log.injury = injury ?? log.injury;
  if (log.modifiers.length === 0) {
    log.modifiers = growth.modifiers;
  }

  return {
    ...player,
    abilities: abilityResult.abilities,
    fatigue: clampStateValue(player.fatigue + fatigueChange),
    condition: clampStateValue(player.condition + conditionChange),
    trust: clampStateValue(player.trust + trustChange),
    injury,
  };
}

export function resolveWeeklyTraining(
  input: ResolveWeeklyTrainingInput,
): WeeklyTrainingResolution {
  const validated = validateWeeklyPlan(input);
  const school = input.state.schools[input.schoolId]!;
  const players = { ...input.state.players };
  const playerLogs: PlayerGrowthLog[] = [];
  const injuredPlayerIds: PlayerId[] = [];

  for (const playerId of school.playerIds) {
    const original = input.state.players[playerId];
    if (!original) {
      throw new Error(`school references unknown player: ${playerId}`);
    }

    const log = emptyLog(playerId);
    let updated = applyActivity(
      original,
      activityFromMenu(validated.menu),
      school,
      input.data,
      input.random,
      log,
    );
    const instruction = validated.instructions.get(playerId);
    if (instruction && !updated.injury) {
      updated = applyActivity(
        updated,
        activityFromInstruction(instruction),
        school,
        input.data,
        input.random,
        log,
      );
    }

    players[playerId] = updated;
    playerLogs.push(log);
    if (updated.injury && !original.injury) {
      injuredPlayerIds.push(playerId);
    }
  }

  return {
    state: {
      ...input.state,
      players,
      randomCursor: input.state.randomCursor + input.random.cursor,
    },
    result: {
      schoolId: input.schoolId,
      teamTrainingMenuId: input.plan.teamTrainingMenuId,
      individualAssignments: input.plan.individualAssignments.map(
        (assignment) => ({ ...assignment }),
      ),
      playerLogs,
      injuredPlayerIds,
      randomCursor: input.random.cursor,
    },
  };
}
