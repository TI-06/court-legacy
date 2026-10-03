import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  calculateTeamIdentityAlignment,
  createDefaultTeamIdentity,
  progressTeamIdentityWeek,
  resolveTeamIdentity,
  setTeamIdentityStyle,
  teamIdentityMasteryTier,
} from "../../../../src/domain/team/teamIdentity";

describe("Phase56 team identity foundation", () => {
  it("resolves legacy saves without a schema migration", () => {
    const state = createDemoGame();
    delete state.teamPlanning.teamIdentity;

    expect(resolveTeamIdentity(state)).toEqual(createDefaultTeamIdentity());
    expect(state.teamPlanning.teamIdentity).toBeUndefined();
  });

  it(
    "changes identity without allowing mastery to carry over at full strength",
    () => {
      const state = createDemoGame();
      state.teamPlanning.teamIdentity = {
        style: "balanced",
        mastery: 88,
        weeksInStyle: 18,
        changeCount: 2,
      };

      const updated = setTeamIdentityStyle(state, "quick-combination");

      expect(updated.teamPlanning.teamIdentity).toEqual({
        style: "quick-combination",
        mastery: 30,
        weeksInStyle: 0,
        changeCount: 3,
      });
      expect(state.teamPlanning.teamIdentity?.style).toBe("balanced");
      expect(setTeamIdentityStyle(updated, "quick-combination")).toBe(updated);
    },
  );

  it(
    "scores tactical alignment by identity without applying a hidden match bonus",
    () => {
      expect(
        calculateTeamIdentityAlignment(
          "serve-block",
          {
            serve: "aggressive",
            attack: "balanced",
            block: "commit",
          },
          "balanced",
        ),
      ).toBe(100);

      expect(
        calculateTeamIdentityAlignment(
          "serve-block",
          {
            serve: "safe",
            attack: "balanced",
            block: "read",
          },
          "balanced",
        ),
      ).toBe(0);

      expect(
        calculateTeamIdentityAlignment(
          "balanced",
          {
            serve: "balanced",
            attack: "balanced",
            block: "mixed",
          },
          "balanced",
        ),
      ).toBe(100);
    },
  );

  it(
    "progresses mastery faster when weekly tactics match the chosen identity",
    () => {
      const aligned = createDemoGame();
      const alignedSchool = aligned.schools[aligned.userSchoolId]!;
      aligned.teamPlanning.teamIdentity = {
        style: "serve-block",
        mastery: 40,
        weeksInStyle: 3,
        changeCount: 1,
      };
      alignedSchool.tactics = {
        ...alignedSchool.tactics,
        serveRisk: 75,
        attackTempo: "balanced",
        blockSystem: "commit",
        defenseBias: "balanced",
      };

      const misaligned = structuredClone(aligned);
      const misalignedSchool = misaligned.schools[misaligned.userSchoolId]!;
      misalignedSchool.tactics = {
        ...misalignedSchool.tactics,
        serveRisk: 25,
        blockSystem: "read",
      };

      const alignedNext = progressTeamIdentityWeek(aligned);
      const misalignedNext = progressTeamIdentityWeek(misaligned);

      expect(alignedNext.teamPlanning.teamIdentity?.mastery).toBe(45);
      expect(misalignedNext.teamPlanning.teamIdentity?.mastery).toBe(42);
      expect(alignedNext.teamPlanning.teamIdentity?.weeksInStyle).toBe(4);
      expect(aligned.teamPlanning.teamIdentity?.mastery).toBe(40);
    },
  );

  it("caps mastery and exposes stable mastery tiers", () => {
    const state = createDemoGame();
    state.teamPlanning.teamIdentity = {
      style: "balanced",
      mastery: 99,
      weeksInStyle: 12,
      changeCount: 0,
    };
    const school = state.schools[state.userSchoolId]!;
    school.tactics = {
      ...school.tactics,
      serveRisk: 50,
      attackTempo: "balanced",
      blockSystem: "mixed",
      defenseBias: "balanced",
    };

    expect(
      progressTeamIdentityWeek(state).teamPlanning.teamIdentity?.mastery,
    ).toBe(100);
    expect(teamIdentityMasteryTier(0)).toBe("forming");
    expect(teamIdentityMasteryTier(30)).toBe("established");
    expect(teamIdentityMasteryTier(60)).toBe("mature");
    expect(teamIdentityMasteryTier(85)).toBe("signature");
  });
});
