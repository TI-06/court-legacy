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
    seed: "coach-development-directives",
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

describe("coach development directives", () => {
  it("keeps libero specialist training focused on receive, speed, and decision", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      preferredPosition: "L",
    };

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: {
        teamTrainingMenuId: "training.receive",
        individualAssignments: [
          { playerId, instructionId: "instruction.l-specialist" },
        ],
      },
      data,
      random: new SeededRandom("libero-specialist"),
    });

    const log = resolution.result.playerLogs.find(
      (candidate) => candidate.playerId === playerId,
    )!;

    expect(Object.keys(log.abilityChanges).sort()).toEqual(
      ["decision", "receive", "speed"].sort(),
    );
    expect(log.abilityChanges.spike).toBeUndefined();
    expect(log.abilityChanges.serve).toBeUndefined();
  });

  it("switches a capped specialist assignment to overall training", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = state.players[playerId]!;
    state.players[playerId] = {
      ...player,
      preferredPosition: "L",
      abilities: {
        ...player.abilities,
        receive: 100,
        speed: 100,
        decision: 100,
      },
    };

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: {
        teamTrainingMenuId: "training.receive",
        individualAssignments: [
          { playerId, instructionId: "instruction.l-specialist" },
        ],
      },
      data,
      random: new SeededRandom("libero-specialist-cap"),
    });

    expect(
      resolution.result.individualAssignments.find(
        (assignment) => assignment.playerId === playerId,
      )?.instructionId,
    ).toBe("instruction.overall");
    expect(
      resolution.state.weeklySchedule.trainingPlan.individualAssignments.find(
        (assignment) => assignment.playerId === playerId,
      )?.instructionId,
    ).toBe("instruction.overall");
  });
});
