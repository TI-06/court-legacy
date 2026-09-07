import { describe, expect, it } from "vitest";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { resolveWeeklyTraining } from "../../../../src/domain/training/resolveWeeklyTraining";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;

function createState() {
  return generateWorld({
    seed: "assistant-coach-training",
    data,
    userSchool: {
      name: "蒼波高校",
      shortName: "蒼波",
      regionId: "region.test",
      coachName: "高城 監督",
      uniform: {
        primary: "#173B52",
        secondary: "#F4F7F8",
        accent: "#D89A2B",
      },
    },
  });
}

describe("assistant coach training modifiers", () => {
  it("applies both general and matching specialty growth modifiers", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const attackId = school.playerIds[0]!;
    const defenseId = school.playerIds[1]!;
    state.schoolManagement.assistantCoach = {
      rank: "advanced",
      specialty: "attack",
      contractYearIndex: state.yearIndex,
    };

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: {
        teamTrainingMenuId: "training.spike",
        individualAssignments: [
          { playerId: attackId, instructionId: "instruction.attack" },
          { playerId: defenseId, instructionId: "instruction.defense" },
        ],
      },
      data,
      random: new SeededRandom("assistant-coach-training-result"),
    });

    const attackLog = resolution.result.playerLogs.find(
      (log) => log.playerId === attackId,
    )!;
    const defenseLog = resolution.result.playerLogs.find(
      (log) => log.playerId === defenseId,
    )!;

    expect(
      attackLog.modifiers.some(
        (modifier) =>
          (modifier.code as string) === "assistant-coach" &&
          modifier.percent === 112,
      ),
    ).toBe(true);
    expect(
      attackLog.modifiers.some(
        (modifier) =>
          (modifier.code as string) === "assistant-coach-specialty" &&
          modifier.percent === 122,
      ),
    ).toBe(true);
    expect(
      defenseLog.modifiers.some(
        (modifier) =>
          (modifier.code as string) === "assistant-coach-specialty",
      ),
    ).toBe(false);
  });

  it("adds the master low-condition and first-year modifiers", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const targetId = school.playerIds.find(
      (playerId) => state.players[playerId]?.grade === 1,
    )!;
    const otherId = school.playerIds.find((playerId) => playerId !== targetId)!;
    state.players[targetId] = {
      ...state.players[targetId]!,
      condition: 50,
    };
    state.schoolManagement.assistantCoach = {
      rank: "master",
      specialty: "physical",
      contractYearIndex: state.yearIndex,
    };

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: {
        teamTrainingMenuId: "training.physical",
        individualAssignments: [
          { playerId: targetId, instructionId: "instruction.physical" },
          { playerId: otherId, instructionId: "instruction.defense" },
        ],
      },
      data,
      random: new SeededRandom("assistant-coach-master-result"),
    });

    const targetLog = resolution.result.playerLogs.find(
      (log) => log.playerId === targetId,
    )!;
    const modifierCodes = targetLog.modifiers.map((modifier) =>
      String(modifier.code),
    );

    expect(modifierCodes).toContain("assistant-coach-condition");
    expect(modifierCodes).toContain("assistant-coach-first-year");
  });
});
