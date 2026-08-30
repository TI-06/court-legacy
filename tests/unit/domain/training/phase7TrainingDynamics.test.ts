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
    seed: "phase7-training-dynamics",
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
    data,
  });
}

describe("training dynamics integration", () => {
  it("adds per-player morale and trust modifiers and progresses dynamics after training", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const targetId = school.playerIds[0]!;
    state.players[targetId] = {
      ...state.players[targetId]!,
      morale: 0,
      trust: 100,
      academic: 20,
      fatigue: 0,
      condition: 100,
    };
    const beforeCohesion = state.teamDynamics.cohesion;

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: {
        teamTrainingMenuId: "training.spike",
        individualAssignments: [
          {
            playerId: school.playerIds[0]!,
            instructionId: "instruction.serve",
          },
          {
            playerId: school.playerIds[1]!,
            instructionId: "instruction.receive",
          },
        ],
      },
      data,
      random: new SeededRandom("phase7-training-dynamics-run"),
    });
    const log = resolution.result.playerLogs.find(
      (entry) => entry.playerId === targetId,
    )!;

    expect(log.modifiers).toEqual(
      expect.arrayContaining([
        { code: "morale", label: "士気", percent: 95 },
        { code: "trust", label: "信頼", percent: 105 },
      ]),
    );
    expect(log.academicRestricted).toBe(true);
    expect(log.modifiers.at(-1)?.code).toBe("academic");
    expect(resolution.state.players[targetId]!.morale).toBe(1);
    expect(resolution.state.players[targetId]!.trust).toBe(99);
    expect(resolution.state.teamDynamics.previousCohesion).toBe(beforeCohesion);
    expect(resolution.state.teamDynamics.cohesion).toBeGreaterThanOrEqual(0);
    expect(resolution.state.teamDynamics.cohesion).toBeLessThanOrEqual(100);
  });
});
