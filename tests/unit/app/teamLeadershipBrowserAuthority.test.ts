import { describe, expect, it } from "vitest";
import { gameActionRequestSchema } from "../../../worker/game/actionSchema";

describe("team leadership browser authority boundary", () => {
  const request = {
    operationId: "leadership-browser-001",
    revision: 4,
    action: {
      type: "set-team-leadership",
      captainPlayerId: "player-001",
      viceCaptainPlayerId: "player-002",
    },
  };

  it("accepts only captain and vice-captain ids as leadership inputs", () => {
    expect(gameActionRequestSchema.safeParse(request).success).toBe(true);
  });

  it.each([
    "cohesion",
    "suitability",
    "effect",
    "playerRoles",
    "playerConcerns",
  ])("rejects browser-computed %s authority", (field) => {
    expect(
      gameActionRequestSchema.safeParse({
        ...request,
        action: {
          ...request.action,
          [field]: field === "cohesion" ? 100 : {},
        },
      }).success,
    ).toBe(false);
  });
});
