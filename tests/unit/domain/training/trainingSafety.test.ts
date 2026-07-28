import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import type {
  RandomSnapshot,
  RandomSource,
} from "../../../../src/domain/random/SeededRandom";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { resolveWeeklyTraining } from "../../../../src/domain/training/resolveWeeklyTraining";

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

class MinimumRandom implements RandomSource {
  #cursor = 0;

  get cursor(): number {
    return this.#cursor;
  }

  next(): number {
    this.#cursor += 1;
    return 0;
  }

  int(minimum: number): number {
    this.#cursor += 1;
    return minimum;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("cannot pick from an empty collection");
    }
    return items[0] as T;
  }

  fork(): RandomSource {
    return new MinimumRandom();
  }

  snapshot(): RandomSnapshot {
    return { seed: "minimum", cursor: this.#cursor };
  }
}

function createState() {
  return generateWorld({ seed: "training-safety", userSchool, data });
}

function createAssignments(playerIds: readonly PlayerId[]) {
  return [
    {
      playerId: playerIds[0]!,
      instructionId: "instruction.mental",
    },
    {
      playerId: playerIds[1]!,
      instructionId: "instruction.serve",
    },
  ];
}

describe("weekly training safety", () => {
  it("never creates a training injury from an activity with zero injury risk", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;

    for (const playerId of school.playerIds) {
      state.players[playerId] = {
        ...state.players[playerId]!,
        fatigue: 100,
        condition: 20,
      };
    }

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: {
        teamTrainingMenuId: "training.recovery",
        individualAssignments: createAssignments(school.playerIds),
      },
      data,
      random: new MinimumRandom(),
    });

    expect(resolution.result.injuredPlayerIds).toEqual([]);
    expect(
      school.playerIds.every(
        (playerId) => resolution.state.players[playerId]?.injury === null,
      ),
    ).toBe(true);
  });

  it("adds only random values consumed during the weekly action", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const initialStateCursor = state.randomCursor;
    const random = new SeededRandom("restored-training-random", 50);
    const initialRandomCursor = random.cursor;

    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: {
        teamTrainingMenuId: "training.spike",
        individualAssignments: createAssignments(school.playerIds),
      },
      data,
      random,
    });
    const consumed = random.cursor - initialRandomCursor;

    expect(consumed).toBeGreaterThan(0);
    expect(resolution.state.randomCursor).toBe(initialStateCursor + consumed);
  });
});
