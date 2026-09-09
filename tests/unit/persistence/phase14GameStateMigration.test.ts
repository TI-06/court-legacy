import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { decodeGameState } from "../../../src/persistence/gameStateCodec";

describe("Phase 14 game-state migration", () => {
  it("migrates v7 saves to v8 without inventing player growth history", () => {
    const legacy = structuredClone(createDemoGame()) as unknown as Record<
      string,
      unknown
    >;
    legacy.schemaVersion = 7;

    const history = legacy.history as Record<string, unknown>;
    delete history.playerDevelopmentWeeks;
    delete legacy.teamPlanning;

    const migrated = decodeGameState(JSON.stringify(legacy)) as unknown as {
      schemaVersion: number;
      history: { playerDevelopmentWeeks: unknown[] };
      teamPlanning: {
        developmentPriorityPlayerIds: unknown[];
        savedLineups: unknown[];
      };
    };

    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.history.playerDevelopmentWeeks).toEqual([]);
    expect(migrated.teamPlanning).toEqual({
      developmentPriorityPlayerIds: [],
      savedLineups: [],
    });
  });

  it("keeps v6 school management while continuing through the v8 migration", () => {
    const current = structuredClone(createDemoGame()) as unknown as Record<
      string,
      unknown
    >;
    const schoolManagement = current.schoolManagement;
    expect(schoolManagement).toBeDefined();
    delete current.schoolManagement;
    delete current.teamPlanning;
    current.schemaVersion = 6;
    const history = current.history as Record<string, unknown>;
    delete history.playerDevelopmentWeeks;

    const schools = current.schools as Record<string, { funds: number }>;
    const userSchoolId = current.userSchoolId as string;
    schools[userSchoolId]!.funds = 777;

    const migrated = decodeGameState(JSON.stringify(current)) as unknown as {
      schemaVersion: number;
      yearIndex: number;
      userSchoolId: string;
      schools: Record<string, { funds: number }>;
      schoolManagement: unknown;
      history: { playerDevelopmentWeeks: unknown[] };
      teamPlanning: unknown;
    };

    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.schools[migrated.userSchoolId]!.funds).toBe(777);
    expect(migrated.schoolManagement).toEqual({
      assistantCoach: null,
      fundsHistory: [],
      lastAnnualBudgetYearIndex: migrated.yearIndex,
    });
    expect(migrated.history.playerDevelopmentWeeks).toEqual([]);
    expect(migrated.teamPlanning).toEqual({
      developmentPriorityPlayerIds: [],
      savedLineups: [],
    });
  });
});
