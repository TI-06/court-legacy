import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import { addSpecialRelationship } from "../../../../src/domain/relationships/specialRelationships";
import { selectPlayerRelationships } from "../../../../src/domain/relationships/relationshipPresentation";

describe("Phase21 relationship presentation selector", () => {
  it("uses default 50 for absent affinity and returns current teammates only", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const selectedId = school.playerIds[0]!;
    const teammateId = school.playerIds[1]!;
    delete state.playerRelationships[relationshipKey(selectedId, teammateId)];

    const rows = selectPlayerRelationships(state, selectedId);
    const teammate = rows.find((row) => row.playerId === teammateId);

    expect(rows).toHaveLength(school.playerIds.length - 1);
    expect(rows.some((row) => row.playerId === selectedId)).toBe(false);
    expect(teammate).toMatchObject({ score: 50, label: "普通" });
  });

  it("sorts tagged rows first, then distance from 50, and exposes mentor direction", () => {
    let state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const selectedId = school.playerIds[0]!;
    const rivalId = school.playerIds[1]!;
    const protegeId = school.playerIds[2]!;
    const extremeId = school.playerIds[3]!;
    state.playerRelationships[relationshipKey(selectedId, rivalId)] = 74;
    state.playerRelationships[relationshipKey(selectedId, protegeId)] = 61;
    state.playerRelationships[relationshipKey(selectedId, extremeId)] = 0;

    state = addSpecialRelationship(state, {
      playerIds: [selectedId, rivalId],
      kind: "rival",
      establishedDate: state.date,
    }).state;
    state = addSpecialRelationship(state, {
      playerIds: [selectedId, protegeId],
      kind: "mentor",
      establishedDate: state.date,
      mentorPlayerId: selectedId,
      protegePlayerId: protegeId,
    }).state;

    const rows = selectPlayerRelationships(state, selectedId);

    expect(rows.slice(0, 2).every((row) => row.specialKinds.length > 0)).toBe(true);
    expect(rows[0]?.playerId).toBe(rivalId);
    expect(rows.find((row) => row.playerId === protegeId)).toMatchObject({
      specialKinds: ["mentor"],
      mentorDirection: "mentor",
    });
    const firstUntagged = rows.findIndex((row) => row.specialKinds.length === 0);
    expect(rows[firstUntagged]?.playerId).toBe(extremeId);
  });
});
