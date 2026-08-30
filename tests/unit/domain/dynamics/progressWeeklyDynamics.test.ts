import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import {
  calculateDynamicsTrainingModifiers,
  progressWeeklyDynamics,
} from "../../../../src/domain/dynamics/progressWeeklyDynamics";

function createState() {
  return createInitialGame({
    seed: "phase7-weekly-dynamics",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
}

function firstUserPlayerId(state: ReturnType<typeof createState>) {
  const school = state.schools[state.userSchoolId];
  if (!school?.playerIds[0]) {
    throw new Error("weekly dynamics fixture requires a user player");
  }
  return school.playerIds[0];
}

describe("weekly team dynamics progression", () => {
  it("bounds combined concern penalties to four morale and trust points per week", () => {
    const state = createState();
    const playerId = firstUserPlayerId(state);
    state.players[playerId] = {
      ...state.players[playerId]!,
      morale: 50,
      trust: 50,
    };
    state.teamDynamics = {
      ...state.teamDynamics,
      playerConcerns: {
        [playerId]: [
          { code: "playing-time", severity: 3 },
          { code: "role-mismatch", severity: 3 },
        ],
      },
    };
    const before = structuredClone(state);

    const next = progressWeeklyDynamics(state);

    expect(next.players[playerId]!.morale).toBe(46);
    expect(next.players[playerId]!.trust).toBe(46);
    expect(state).toEqual(before);
  });

  it("mildly recovers players without concerns toward neutral fifty", () => {
    const state = createState();
    const playerId = firstUserPlayerId(state);
    state.players[playerId] = {
      ...state.players[playerId]!,
      morale: 40,
      trust: 60,
    };
    state.teamDynamics = {
      ...state.teamDynamics,
      playerConcerns: {},
    };

    const next = progressWeeklyDynamics(state);

    expect(next.players[playerId]!.morale).toBe(41);
    expect(next.players[playerId]!.trust).toBe(59);
  });

  it("clamps morale and trust to the zero-to-one-hundred range", () => {
    const state = createState();
    const playerId = firstUserPlayerId(state);
    state.players[playerId] = {
      ...state.players[playerId]!,
      morale: 1,
      trust: 2,
    };
    state.teamDynamics = {
      ...state.teamDynamics,
      playerConcerns: {
        [playerId]: [
          { code: "playing-time", severity: 3 },
          { code: "injury-overuse", severity: 3 },
        ],
      },
    };

    const next = progressWeeklyDynamics(state);

    expect(next.players[playerId]!.morale).toBe(0);
    expect(next.players[playerId]!.trust).toBe(0);
  });

  it("maps morale and trust independently to bounded 95..105 training modifiers", () => {
    expect(
      calculateDynamicsTrainingModifiers({ morale: 0, trust: 100 }),
    ).toEqual([
      { code: "morale", label: "士気", percent: 95 },
      { code: "trust", label: "信頼", percent: 105 },
    ]);
    expect(
      calculateDynamicsTrainingModifiers({ morale: 50, trust: 50 }),
    ).toEqual([
      { code: "morale", label: "士気", percent: 100 },
      { code: "trust", label: "信頼", percent: 100 },
    ]);
  });
});
