import { gameDataBootstrap } from "../../../../src/data/gameData";
import {
  advanceOneWeek,
  isWeeklyActionCompleted,
  markWeeklyActionCompleted,
} from "../../../../src/domain/calendar/weekProgression";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";

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

function createState() {
  return generateWorld({ seed: "week-progression", userSchool, data });
}

describe("weekly progression", () => {
  it("advances the game and calendar dates by seven days", () => {
    const state = createState();
    state.activeMatch = {} as typeof state.activeMatch;

    const result = advanceOneWeek(state);

    expect(result.state.date).toBe("2026-04-08");
    expect(result.state.calendar.currentDate).toBe("2026-04-08");
    expect(result.state.calendar.weekOfYear).toBe(2);
    expect(result.state.activeMatch).toBeNull();
    expect(state.date).toBe("2026-04-01");
  });

  it("selects a new practice opponent for the next week", () => {
    const state = createState();
    const currentOpponent = selectPracticeOpponent(state);

    const nextWeek = advanceOneWeek(state).state;
    const nextOpponent = selectPracticeOpponent(nextWeek);

    expect(nextOpponent.id).not.toBe(currentOpponent.id);
  });

  it("reduces injuries and clears an injury after its final week", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const recoveringId = school.playerIds[0]!;
    const healingId = school.playerIds[1]!;
    state.players[recoveringId] = {
      ...state.players[recoveringId]!,
      injury: {
        injuryId: "injury.ankle",
        severity: "moderate",
        remainingWeeks: 2,
        recurrenceRisk: 20,
      },
    };
    state.players[healingId] = {
      ...state.players[healingId]!,
      injury: {
        injuryId: "injury.finger",
        severity: "minor",
        remainingWeeks: 1,
        recurrenceRisk: 10,
      },
    };

    const result = advanceOneWeek(state);

    expect(result.state.players[recoveringId]!.injury?.remainingWeeks).toBe(1);
    expect(result.state.players[healingId]!.injury).toBeNull();
    expect(result.healedPlayerIds).toContain(healingId);
  });

  it("leaves legacy fatigue and condition unchanged during calendar advancement", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      fatigue: 70,
      condition: 99,
      injury: null,
    };

    const result = advanceOneWeek(state);
    const player = result.state.players[playerId]!;

    expect(player.fatigue).toBe(70);
    expect(player.condition).toBe(99);
    expect(result.recoveredPlayerIds).not.toContain(playerId);
  });

  it("does not apply implicit recovery for legacy resting-player hints", () => {
    const normalState = createState();
    const restingState = structuredClone(normalState);
    const playerId =
      normalState.schools[normalState.userSchoolId]!.playerIds[0]!;
    normalState.players[playerId] = {
      ...normalState.players[playerId]!,
      fatigue: 70,
      condition: 50,
      injury: null,
    };
    restingState.players[playerId] = structuredClone(
      normalState.players[playerId]!,
    );

    const normal = advanceOneWeek(normalState).state.players[playerId]!;
    const rested = advanceOneWeek(restingState, {
      restingPlayerIds: new Set([playerId]),
    }).state.players[playerId]!;

    expect(rested.fatigue).toBe(normal.fatigue);
    expect(rested.condition).toBe(normal.condition);
  });

  it("ignores legacy rest recovery while progressing injury only once", () => {
    const state = createState();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      fatigue: 5,
      condition: 98,
      injury: {
        injuryId: "injury.rest-test",
        severity: "minor",
        remainingWeeks: 2,
        recurrenceRisk: 10,
      },
    };

    const result = advanceOneWeek(state, {
      restingPlayerIds: new Set([playerId]),
    });
    const player = result.state.players[playerId]!;

    expect(player.fatigue).toBe(5);
    expect(player.condition).toBe(98);
    expect(player.injury?.remainingWeeks).toBe(1);
  });

  it("records weekly actions immutably and resets them when the date advances", () => {
    const state = createState();

    const trained = markWeeklyActionCompleted(state, "training");
    const played = markWeeklyActionCompleted(trained, "practice-match");

    expect(isWeeklyActionCompleted(played, "training")).toBe(true);
    expect(isWeeklyActionCompleted(played, "practice-match")).toBe(true);
    expect(isWeeklyActionCompleted(state, "training")).toBe(false);

    const nextWeek = advanceOneWeek(played).state;
    expect(isWeeklyActionCompleted(nextWeek, "training")).toBe(false);
    expect(isWeeklyActionCompleted(nextWeek, "practice-match")).toBe(false);
  });
});
