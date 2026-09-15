import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { archiveGraduatingRelationships } from "../../../../src/domain/calendar/academicYearProgression";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import { addSpecialRelationship } from "../../../../src/domain/relationships/specialRelationships";

describe("Phase21 relationship graduation legacy", () => {
  it("archives a graduate-returner bond with names, score, tags, and date", () => {
    let state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const graduateId = school.playerIds[0]!;
    const returnerId = school.playerIds[1]!;
    const graduate = state.players[graduateId]!;
    const returner = state.players[returnerId]!;
    const key = relationshipKey(graduateId, returnerId);
    state.playerRelationships[key] = 82;
    state = addSpecialRelationship(state, {
      playerIds: [graduateId, returnerId],
      kind: "partner",
      establishedDate: state.date,
    }).state;

    const result = archiveGraduatingRelationships(
      state,
      [graduateId],
      state.date,
    );

    expect(result.playerRelationshipBonds[key]).toBeUndefined();
    expect(result.history.relationshipLegacyHistory.at(-1)).toMatchObject({
      playerIds: [graduateId, returnerId].sort(),
      displayNames: [
        `${graduate.lastName} ${graduate.firstName}`,
        `${returner.lastName} ${returner.firstName}`,
      ],
      finalRelationshipScore: 82,
      archivedDate: state.date,
      tags: [{ kind: "partner" }],
    });
  });

  it("archives one bond only once when both players graduate", () => {
    let state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const leftId = school.playerIds[0]!;
    const rightId = school.playerIds[1]!;
    state = addSpecialRelationship(state, {
      playerIds: [leftId, rightId],
      kind: "rival",
      establishedDate: state.date,
    }).state;

    const result = archiveGraduatingRelationships(
      state,
      [leftId, rightId],
      state.date,
    );

    expect(result.history.relationshipLegacyHistory).toHaveLength(1);
    expect(result.history.relationshipLegacyHistory[0]?.playerIds).toEqual(
      [leftId, rightId].sort(),
    );
  });

  it("removes every active bond that still references a graduate", () => {
    let state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const graduateId = school.playerIds[0]!;
    const firstReturnerId = school.playerIds[1]!;
    const secondReturnerId = school.playerIds[2]!;
    state = addSpecialRelationship(state, {
      playerIds: [graduateId, firstReturnerId],
      kind: "rival",
      establishedDate: state.date,
    }).state;
    state = addSpecialRelationship(state, {
      playerIds: [graduateId, secondReturnerId],
      kind: "partner",
      establishedDate: state.date,
    }).state;
    state = addSpecialRelationship(state, {
      playerIds: [firstReturnerId, secondReturnerId],
      kind: "rival",
      establishedDate: state.date,
    }).state;

    const result = archiveGraduatingRelationships(
      state,
      [graduateId],
      state.date,
    );

    expect(
      Object.values(result.playerRelationshipBonds).some((bond) =>
        bond.playerIds.includes(graduateId),
      ),
    ).toBe(false);
    expect(
      result.playerRelationshipBonds[
        relationshipKey(firstReturnerId, secondReturnerId)
      ],
    ).toBeDefined();
  });

  it("keeps only the newest 200 archived relationship records", () => {
    let state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const graduateId = school.playerIds[0]!;
    const returnerId = school.playerIds[1]!;
    state = addSpecialRelationship(state, {
      playerIds: [graduateId, returnerId],
      kind: "mentor",
      establishedDate: state.date,
      mentorPlayerId: graduateId,
      protegePlayerId: returnerId,
    }).state;
    state.history.relationshipLegacyHistory = Array.from(
      { length: 200 },
      (_, index) => ({
        playerIds: [graduateId, returnerId].sort() as [
          typeof graduateId,
          typeof returnerId,
        ],
        displayNames: [`old-${index}`, "other"] as [string, string],
        tags: [],
        finalRelationshipScore: 50,
        archivedDate: state.date,
      }),
    );

    const result = archiveGraduatingRelationships(
      state,
      [graduateId],
      state.date,
    );

    expect(result.history.relationshipLegacyHistory).toHaveLength(200);
    expect(result.history.relationshipLegacyHistory[0]?.displayNames[0]).toBe(
      "old-1",
    );
    expect(result.history.relationshipLegacyHistory.at(-1)?.displayNames[0]).toBe(
      `${state.players[graduateId]!.lastName} ${state.players[graduateId]!.firstName}`,
    );
  });
});
