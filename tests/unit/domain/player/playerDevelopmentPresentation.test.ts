import { createDemoGame } from "../../../../src/app/createDemoGame";
import { getPlayerDevelopmentPresentation } from "../../../../src/domain/player/playerDevelopmentPresentation";

describe("player development presentation", () => {
  it("maps late growth and generational talent to player-facing labels", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const basePlayer = state.players[school.playerIds[0]!]!;
    const player = {
      ...basePlayer,
      growthTypeId: "growth.late",
      tier: "generational" as const,
      potential: 93,
    };

    expect(getPlayerDevelopmentPresentation(player)).toEqual({
      growthLabel: "大器晩成",
      growthDescription:
        "後半ほど伸びやすく、3年時に大きく化ける可能性がある",
      talentLabel: "天才",
      potential: 93,
      potentialGrade: "S",
    });
  });

  it("keeps standard players readable without exaggerating their talent", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const basePlayer = state.players[school.playerIds[0]!]!;
    const player = {
      ...basePlayer,
      growthTypeId: "growth.standard",
      tier: "normal" as const,
      potential: 55,
    };

    expect(getPlayerDevelopmentPresentation(player)).toMatchObject({
      growthLabel: "標準",
      talentLabel: "普通",
      potential: 55,
      potentialGrade: "D",
    });
  });
});
