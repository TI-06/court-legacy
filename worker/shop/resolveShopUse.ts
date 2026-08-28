import { gameDataBootstrap } from "../../src/data/gameData";
import type { GameState } from "../../src/domain/model/GameState";
import type { PlayerId } from "../../src/domain/model/identifiers";
import { playerId } from "../../src/domain/model/identifiers";
import { SeededRandom } from "../../src/domain/random/SeededRandom";
import { getShopItemDefinition } from "../../src/domain/shop/shopCatalog";
import type { ShopUseRequest } from "../../src/domain/shop/shopContracts";
import {
  applyFatigueRecovery,
  isFatigueRecoveryEligible,
  SPECIAL_COACH_ACTIVITY,
  SPECIAL_COACH_FOCUS_ABILITIES,
  TRAINING_CAMP_ACTIVITY,
  TRAINING_CAMP_POSITION_ABILITIES,
} from "../../src/domain/shop/shopEffects";
import {
  resolvePlayerTrainingActivity,
  type PlayerGrowthLog,
} from "../../src/domain/training/resolveWeeklyTraining";
import type { CloudGameSnapshot } from "../data/GameStore";
import type {
  ScoutingCandidateInsight,
  ScoutingCandidatePool,
  ScoutingCandidateTruth,
  ScoutingStore,
} from "../data/ScoutingStore";
import type { ShopUseTargetType } from "../data/ShopStore";
import {
  generateServerScoutingCandidateAtIndex,
  scoutingCycleKey,
} from "../scouting/serverScoutingBoard";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const gameData = gameDataBootstrap.data;

export type ShopUseResolutionErrorCode =
  | "invalid_target"
  | "target_not_found"
  | "effect_already_pending"
  | "scouting_cycle_unavailable";

export class ShopUseResolutionError extends Error {
  constructor(
    public readonly code: ShopUseResolutionErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "ShopUseResolutionError";
  }
}

export interface ResolvedShopUse {
  state: GameState;
  teamSelection: CloudGameSnapshot["teamSelection"];
  targetType: ShopUseTargetType;
  targetId: string | null;
  safeRequest: Record<string, unknown>;
  publicResult: Record<string, unknown>;
  scoutingCycleKey?: string | null;
  scoutingCandidates?: ScoutingCandidateTruth[] | null;
  scoutingInsight?: ScoutingCandidateInsight | null;
}

export interface ResolveShopUseInput {
  snapshot: CloudGameSnapshot;
  request: ShopUseRequest;
  scoutingStore?: ScoutingStore;
}

function cloneBase(snapshot: CloudGameSnapshot): Pick<
  ResolvedShopUse,
  "state" | "teamSelection"
> {
  return {
    state: structuredClone(snapshot.state),
    teamSelection: structuredClone(snapshot.teamSelection),
  };
}

function safeRequest(request: ShopUseRequest): Record<string, unknown> {
  return request.target ? { target: structuredClone(request.target) } : {};
}

function assertTargetMatchesDefinition(request: ShopUseRequest): void {
  const targetKind = getShopItemDefinition(request.itemId).targetKind;
  const target = request.target;

  switch (targetKind) {
    case "none":
    case "team":
    case "next-training":
      if (target !== undefined) {
        throw new ShopUseResolutionError("invalid_target");
      }
      return;
    case "player":
      if (target?.type !== "player") {
        throw new ShopUseResolutionError("invalid_target");
      }
      return;
    case "scouting-candidate":
      if (target?.type !== "scouting-candidate") {
        throw new ShopUseResolutionError("invalid_target");
      }
      return;
    case "special-coach":
      if (target?.type !== "special-coach") {
        throw new ShopUseResolutionError("invalid_target");
      }
      return;
  }
}

function currentSchoolPlayer(
  state: GameState,
  rawPlayerId: string,
): { id: PlayerId; player: GameState["players"][PlayerId] } {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new ShopUseResolutionError("target_not_found");
  }

  const id = playerId(rawPlayerId);
  if (!school.playerIds.includes(id)) {
    throw new ShopUseResolutionError("target_not_found");
  }
  const player = state.players[id];
  if (!player) {
    throw new ShopUseResolutionError("target_not_found");
  }

  return { id, player };
}

async function currentScoutingPool(
  snapshot: CloudGameSnapshot,
  scoutingStore?: ScoutingStore,
): Promise<ScoutingCandidatePool> {
  if (!scoutingStore) {
    throw new ShopUseResolutionError("scouting_cycle_unavailable");
  }

  const cycleKey = scoutingCycleKey(snapshot.state);
  const pool = await scoutingStore.getCandidatePool(snapshot.userId, cycleKey);
  if (!pool) {
    throw new ShopUseResolutionError("scouting_cycle_unavailable");
  }
  return pool;
}

async function resolveExtraCandidate(
  input: ResolveShopUseInput,
): Promise<ResolvedShopUse> {
  const pool = await currentScoutingPool(input.snapshot, input.scoutingStore);
  const generated = generateServerScoutingCandidateAtIndex(
    input.snapshot.state,
    7,
  );
  const alreadyPresent = pool.candidates.some(
    (candidate) => candidate.player.id === generated.player.id,
  );
  const candidates = alreadyPresent
    ? structuredClone(pool.candidates)
    : [...structuredClone(pool.candidates), generated];
  const base = cloneBase(input.snapshot);

  return {
    ...base,
    targetType: "none",
    targetId: null,
    safeRequest: {},
    publicResult: {
      candidateCount: candidates.length,
      addedCandidateId: generated.player.id,
    },
    scoutingCycleKey: pool.cycleKey,
    scoutingCandidates: candidates,
    scoutingInsight: null,
  };
}

function findInsight(
  insights: readonly ScoutingCandidateInsight[],
  candidateId: PlayerId,
): ScoutingCandidateInsight {
  return (
    insights.find((insight) => insight.candidateId === candidateId) ?? {
      candidateId,
      overallPrecision: "normal",
      potentialPrecision: "normal",
    }
  );
}

async function resolveScoutingInsight(
  input: ResolveShopUseInput,
): Promise<ResolvedShopUse> {
  if (input.request.target?.type !== "scouting-candidate") {
    throw new ShopUseResolutionError("invalid_target");
  }
  const store = input.scoutingStore;
  const pool = await currentScoutingPool(input.snapshot, store);
  const candidate = pool.candidates.find(
    (entry) => entry.player.id === input.request.target?.candidateId,
  );
  if (!candidate) {
    throw new ShopUseResolutionError("target_not_found");
  }
  if (!store) {
    throw new ShopUseResolutionError("scouting_cycle_unavailable");
  }

  const insights = await store.listCandidateInsights(
    input.snapshot.userId,
    pool.cycleKey,
  );
  const existing = findInsight(insights, candidate.player.id);
  const insight: ScoutingCandidateInsight =
    input.request.itemId === "scout-research"
      ? {
          candidateId: candidate.player.id,
          overallPrecision: "researched",
          potentialPrecision:
            existing.potentialPrecision === "appraised"
              ? "appraised"
              : "researched",
        }
      : {
          candidateId: candidate.player.id,
          overallPrecision: existing.overallPrecision,
          potentialPrecision: "appraised",
        };
  const base = cloneBase(input.snapshot);

  return {
    ...base,
    targetType: "scouting-candidate",
    targetId: candidate.player.id,
    safeRequest: safeRequest(input.request),
    publicResult: { ...insight },
    scoutingCycleKey: pool.cycleKey,
    scoutingCandidates: null,
    scoutingInsight: insight,
  };
}

function resolveFatigueRecovery(input: ResolveShopUseInput): ResolvedShopUse {
  if (input.request.target?.type !== "player") {
    throw new ShopUseResolutionError("invalid_target");
  }
  const base = cloneBase(input.snapshot);
  const target = currentSchoolPlayer(
    base.state,
    input.request.target.playerId,
  );
  if (!isFatigueRecoveryEligible(target.player)) {
    throw new ShopUseResolutionError("invalid_target");
  }

  const recovered = applyFatigueRecovery(target.player);
  base.state.players[target.id] = recovered.player;

  return {
    ...base,
    targetType: "player",
    targetId: target.id,
    safeRequest: safeRequest(input.request),
    publicResult: {
      playerId: target.id,
      before: recovered.before,
      after: recovered.after,
    },
  };
}

function shopRandom(state: GameState, request: ShopUseRequest): SeededRandom {
  return new SeededRandom(
    `${state.seed}:shop:${request.itemId}:${request.operationId}`,
    state.randomCursor,
  );
}

function updateRandomCursor(
  state: GameState,
  random: SeededRandom,
  initialCursor: number,
): void {
  state.randomCursor += random.cursor - initialCursor;
}

function trainingCampSummary(logs: readonly PlayerGrowthLog[]) {
  const participants = logs.filter((log) => log.skippedReason === null);
  const totalAbilityGrowth = participants.reduce(
    (sum, log) => sum + log.totalAbilityGrowth,
    0,
  );
  const averageFatigueChange =
    participants.length === 0
      ? 0
      : Math.round(
          (participants.reduce((sum, log) => sum + log.fatigueChange, 0) /
            participants.length) *
            10,
        ) / 10;
  const topGrowth = [...participants]
    .sort((left, right) => right.totalAbilityGrowth - left.totalAbilityGrowth)
    .slice(0, 3)
    .map((log) => ({
      playerId: log.playerId,
      totalAbilityGrowth: log.totalAbilityGrowth,
      abilityChanges: log.abilityChanges,
    }));

  return {
    participantCount: participants.length,
    grewPlayerCount: participants.filter((log) => log.totalAbilityGrowth > 0)
      .length,
    totalAbilityGrowth,
    topGrowth,
    averageFatigueChange,
    injuredPlayerIds: participants
      .filter((log) => log.injury !== null)
      .map((log) => log.playerId),
  };
}

function resolveTrainingCamp(input: ResolveShopUseInput): ResolvedShopUse {
  const base = cloneBase(input.snapshot);
  const school = base.state.schools[base.state.userSchoolId];
  if (!school) {
    throw new ShopUseResolutionError("target_not_found");
  }
  const random = shopRandom(base.state, input.request);
  const initialCursor = random.cursor;
  const logs: PlayerGrowthLog[] = [];

  for (const id of school.playerIds) {
    const player = base.state.players[id];
    if (!player) {
      throw new ShopUseResolutionError("target_not_found");
    }
    const resolved = resolvePlayerTrainingActivity({
      player,
      school,
      data: gameData,
      random,
      activity: {
        targetAbilities:
          TRAINING_CAMP_POSITION_ABILITIES[player.preferredPosition],
        ...TRAINING_CAMP_ACTIVITY,
      },
    });
    base.state.players[id] = resolved.player;
    logs.push(resolved.log);
  }
  updateRandomCursor(base.state, random, initialCursor);

  return {
    ...base,
    targetType: "team",
    targetId: null,
    safeRequest: {},
    publicResult: trainingCampSummary(logs),
  };
}

function resolveSpecialCoach(input: ResolveShopUseInput): ResolvedShopUse {
  if (input.request.target?.type !== "special-coach") {
    throw new ShopUseResolutionError("invalid_target");
  }
  const base = cloneBase(input.snapshot);
  const target = currentSchoolPlayer(
    base.state,
    input.request.target.playerId,
  );
  if (target.player.injury) {
    throw new ShopUseResolutionError("invalid_target");
  }
  const school = base.state.schools[base.state.userSchoolId];
  if (!school) {
    throw new ShopUseResolutionError("target_not_found");
  }
  const random = shopRandom(base.state, input.request);
  const initialCursor = random.cursor;
  const resolved = resolvePlayerTrainingActivity({
    player: target.player,
    school,
    data: gameData,
    random,
    activity: {
      targetAbilities:
        SPECIAL_COACH_FOCUS_ABILITIES[input.request.target.focus],
      ...SPECIAL_COACH_ACTIVITY,
    },
  });
  base.state.players[target.id] = resolved.player;
  updateRandomCursor(base.state, random, initialCursor);

  return {
    ...base,
    targetType: "special-coach",
    targetId: target.id,
    safeRequest: safeRequest(input.request),
    publicResult: {
      playerId: target.id,
      focus: input.request.target.focus,
      totalAbilityGrowth: resolved.log.totalAbilityGrowth,
      abilityChanges: resolved.log.abilityChanges,
      fatigueChange: resolved.log.fatigueChange,
      conditionChange: resolved.log.conditionChange,
      injury: resolved.log.injury,
    },
  };
}

function resolveTrainingEfficiencyBoost(
  input: ResolveShopUseInput,
): ResolvedShopUse {
  const base = cloneBase(input.snapshot);
  if (base.state.shopEffects?.nextTrainingGrowthBoost) {
    throw new ShopUseResolutionError("effect_already_pending");
  }

  base.state.shopEffects = {
    ...base.state.shopEffects,
    nextTrainingGrowthBoost: {
      percent: 20,
      remainingUses: 1,
      sourceItemId: "training-efficiency-boost",
    },
  };

  return {
    ...base,
    targetType: "next-training",
    targetId: null,
    safeRequest: {},
    publicResult: { pending: true, percent: 20 },
  };
}

export async function resolveShopUse(
  input: ResolveShopUseInput,
): Promise<ResolvedShopUse> {
  assertTargetMatchesDefinition(input.request);

  switch (input.request.itemId) {
    case "extra-scout-candidate":
      return resolveExtraCandidate(input);
    case "scout-research":
    case "potential-appraisal":
      return resolveScoutingInsight(input);
    case "training-camp":
      return resolveTrainingCamp(input);
    case "fatigue-recovery":
      return resolveFatigueRecovery(input);
    case "special-coach":
      return resolveSpecialCoach(input);
    case "training-efficiency-boost":
      return resolveTrainingEfficiencyBoost(input);
  }
}
