import { expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import { deriveMatchTacticPlan } from "../../../../src/domain/team/matchTactics";
import { selectWeekPreMatchPreparation } from "../../../../src/features/match/preMatchPreparation";

it("adds only the known opponent's public team tactics to practice preparation", () => {
  const state = createInitialGame({
    seed: "phase15-pre-match-tactics",
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
  const opponent = Object.values(state.schools).find(
    (school) => school.id !== state.userSchoolId,
  );
  if (!opponent) throw new Error("opponent fixture missing");

  state.weeklySchedule.practiceMatch = {
    ...state.weeklySchedule.practiceMatch,
    scheduledOpponentId: opponent.id,
    scheduledBy: "outgoing",
  };

  const preparation = selectWeekPreMatchPreparation(state);

  expect(preparation).not.toBeNull();
  expect(preparation?.kind).toBe("practice");
  expect(preparation?.opponentTactics).toEqual(
    deriveMatchTacticPlan(opponent.tactics),
  );
  expect(Object.keys(preparation?.opponentTactics ?? {})).toEqual([
    "serve",
    "attack",
    "block",
  ]);
  expect(preparation).not.toHaveProperty("serveTargetPlayerId");
});
