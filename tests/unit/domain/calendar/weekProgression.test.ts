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

  it("recovers fatigue and condition without leaving the zero to one hundred range", () => {
    const state = createState();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    state.players[playerId] = {
      ...state.players[playerId]!,
      fatigue: 70,
      condition: 99,
    };

    const result = advanceOneWeek(state);
    const player = result.state.players[playerId]!;

    expect(player.fatigue).toBeLessThan(70);
    expect(player.fatigue).toBeGreaterThanOrEqual(0);
    expect(player.condition).toBe(100);
    expect(result.recoveredPlayerIds).toContain(playerId);
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
