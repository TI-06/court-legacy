import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import type {
  RandomSnapshot,
  RandomSource,
} from "../../../../src/domain/random/SeededRandom";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import {
  resolveWeeklyTraining,
  type WeeklyPlan,
} from "../../../../src/domain/training/resolveWeeklyTraining";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;
const userSchool = {
  name: "蒼波高校",
  shortName: "蒼波",
  regionId: "region.test",
  coachName: "高城 監督",
  uniform: {
    primary: "#173B52",
    secondary: "#F4F7F8",
    accent: "#D89A2B",
  },
};

class FixedRandom implements RandomSource {
  #cursor = 0;

  constructor(private readonly fixedInteger: number) {}

  get cursor(): number {
    return this.#cursor;
  }

  next(): number {
    this.#cursor += 1;
    return Math.max(0, Math.min(0.999999, this.fixedInteger / 100));
  }

  int(minimum: number, maximum: number): number {
    this.#cursor += 1;
    return Math.max(minimum, Math.min(maximum, this.fixedInteger));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("cannot pick from an empty collection");
    }
    return items[0] as T;
  }

  fork(): RandomSource {
    return new FixedRandom(this.fixedInteger);
  }

  snapshot(): RandomSnapshot {
    return { seed: `fixed-${this.fixedInteger}`, cursor: this.#cursor };
  }
}

function createTrainingState() {
  return generateWorld({ seed: "training-world", userSchool, data });
}

function createPlan(playerIds: readonly PlayerId[]): WeeklyPlan {
  return {
    teamTrainingMenuId: "training.spike",
    individualAssignments: [
      { playerId: playerIds[0]!, instructionId: "instruction.serve" },
      { playerId: playerIds[1]!, instructionId: "instruction.receive" },
    ],
  };
}

describe("resolveWeeklyTraining", () => {
  it("changes only team targets for a player without an individual assignment", () => {
    const state = createTrainingState();
    const school = state.schools[state.userSchoolId]!;
    const plan = createPlan(school.playerIds);
    const untouchedId = school.playerIds[2]!;
    const before = structuredClone(state.players[untouchedId]!);

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan,
      data,
      random: new SeededRandom("weekly-targets"),
    });
    const after = resolution.state.players[untouchedId]!;

    expect(after.abilities.spike).toBeGreaterThanOrEqual(
      before.abilities.spike,
    );
    expect(after.abilities.jump).toBeGreaterThanOrEqual(before.abilities.jump);
    for (const ability of [
      "receive",
      "serve",
      "set",
      "block",
      "speed",
      "stamina",
      "decision",
      "mental",
    ] as const) {
      expect(after.abilities[ability]).toBe(before.abilities[ability]);
    }
    expect(resolution.result.playerLogs).toHaveLength(12);
    expect(
      resolution.result.playerLogs.find((log) => log.playerId === untouchedId)
        ?.modifiers.length,
    ).toBeGreaterThan(0);
    expect(state.players[untouchedId]).toEqual(before);
  });

  it("keeps all ability values as integers from zero to one hundred", () => {
    const state = createTrainingState();
    const school = state.schools[state.userSchoolId]!;
    const cappedId = school.playerIds[2]!;
    state.players[cappedId] = {
      ...state.players[cappedId]!,
      abilities: {
        ...state.players[cappedId]!.abilities,
        spike: 99,
        jump: 100,
      },
    };

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: createPlan(school.playerIds),
      data,
      random: new SeededRandom("weekly-cap"),
    });

    for (const player of Object.values(resolution.state.players)) {
      for (const value of Object.values(player.abilities)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("uses recovery training to reduce fatigue and improve condition", () => {
    const state = createTrainingState();
    const school = state.schools[state.userSchoolId]!;
    const recoveredId = school.playerIds[2]!;
    state.players[recoveredId] = {
      ...state.players[recoveredId]!,
      fatigue: 70,
      condition: 55,
    };
    const plan = createPlan(school.playerIds);
    plan.teamTrainingMenuId = "training.recovery";

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan,
      data,
      random: new FixedRandom(100),
    });
    const recovered = resolution.state.players[recoveredId]!;

    expect(recovered.fatigue).toBeLessThan(70);
    expect(recovered.condition).toBeGreaterThan(55);
  });

  it("marks low-academic players as restricted and reduces their growth", () => {
    const state = createTrainingState();
    const school = state.schools[state.userSchoolId]!;
    const restrictedId = school.playerIds[2]!;
    const unrestrictedId = school.playerIds[3]!;
    const sharedAbilities = structuredClone(
      state.players[restrictedId]!.abilities,
    );
    state.players[restrictedId] = {
      ...state.players[restrictedId]!,
      academic: 20,
      fatigue: 0,
      condition: 100,
      abilities: sharedAbilities,
      growthTypeId: "growth.standard",
      personalityId: "personality.calm",
    };
    state.players[unrestrictedId] = {
      ...state.players[unrestrictedId]!,
      academic: 80,
      fatigue: 0,
      condition: 100,
      abilities: structuredClone(sharedAbilities),
      growthTypeId: "growth.standard",
      personalityId: "personality.calm",
    };

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: createPlan(school.playerIds),
      data,
      random: new FixedRandom(100),
    });
    const restrictedLog = resolution.result.playerLogs.find(
      (log) => log.playerId === restrictedId,
    )!;
    const unrestrictedLog = resolution.result.playerLogs.find(
      (log) => log.playerId === unrestrictedId,
    )!;

    expect(restrictedLog.academicRestricted).toBe(true);
    expect(restrictedLog.totalAbilityGrowth).toBeLessThan(
      unrestrictedLog.totalAbilityGrowth,
    );
  });

  it("creates an injury from high training risk through the injected random source", () => {
    const state = createTrainingState();
    const school = state.schools[state.userSchoolId]!;
    const targetId = school.playerIds[2]!;
    state.players[targetId] = {
      ...state.players[targetId]!,
      fatigue: 100,
      condition: 40,
    };
    const plan = createPlan(school.playerIds);
    plan.teamTrainingMenuId = "training.physical";

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan,
      data,
      random: new FixedRandom(1),
    });

    expect(resolution.state.players[targetId]!.injury).not.toBeNull();
    expect(resolution.result.injuredPlayerIds).toContain(targetId);
  });

  it("skips ordinary growth for an already injured player", () => {
    const state = createTrainingState();
    const school = state.schools[state.userSchoolId]!;
    const injuredId = school.playerIds[2]!;
    const before = structuredClone(state.players[injuredId]!);
    state.players[injuredId] = {
      ...state.players[injuredId]!,
      injury: {
        injuryId: "injury.ankle",
        severity: "moderate",
        remainingWeeks: 3,
        recurrenceRisk: 20,
      },
    };

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: createPlan(school.playerIds),
      data,
      random: new FixedRandom(100),
    });
    const log = resolution.result.playerLogs.find(
      (entry) => entry.playerId === injuredId,
    )!;

    expect(resolution.state.players[injuredId]!.abilities).toEqual(
      before.abilities,
    );
    expect(log.skippedReason).toBe("injured");
  });

  it("rejects an invalid plan without partially changing the input state", () => {
    const state = createTrainingState();
    const school = state.schools[state.userSchoolId]!;
    const snapshot = structuredClone(state);
    const duplicateId = school.playerIds[0]!;

    expect(() =>
      resolveWeeklyTraining({
        state,
        schoolId: state.userSchoolId,
        plan: {
          teamTrainingMenuId: "training.spike",
          individualAssignments: [
            { playerId: duplicateId, instructionId: "instruction.serve" },
            { playerId: duplicateId, instructionId: "instruction.receive" },
          ],
        },
        data,
        random: new SeededRandom("invalid-plan"),
      }),
    ).toThrow("individual assignments must use distinct players");
    expect(state).toEqual(snapshot);
  });

  it("reproduces the same weekly outcome from the same state and seed", () => {
    const firstState = createTrainingState();
    const secondState = structuredClone(firstState);
    const school = firstState.schools[firstState.userSchoolId]!;
    const plan = createPlan(school.playerIds);

    const first = resolveWeeklyTraining({
      state: firstState,
      schoolId: firstState.userSchoolId,
      plan,
      data,
      random: new SeededRandom("reproducible-training"),
    });
    const second = resolveWeeklyTraining({
      state: secondState,
      schoolId: secondState.userSchoolId,
      plan,
      data,
      random: new SeededRandom("reproducible-training"),
    });

    expect(first).toEqual(second);
  });
});
