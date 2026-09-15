import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { gameData } from "../../../src/app/createDemoGame";
import { addWeeks } from "../../../src/domain/events/eventDate";
import { relationshipKey } from "../../../src/domain/model/GameState";
import { eventId } from "../../../src/domain/model/identifiers";
import { addSpecialRelationship } from "../../../src/domain/relationships/specialRelationships";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyGameAction } from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase21-relationship-notice",
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
  return {
    userId: "user-123",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 7,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

describe("Phase21 authoritative relationship notifications", () => {
  it("persists one compact notice when an event establishes a special relationship", () => {
    const snapshot = createSnapshot();
    const event = gameData.events.get("event.position-rivalry");
    if (!event) throw new Error("relationship event missing");
    const choice = event.choices.find((candidate) => candidate.id === "competition");
    if (!choice) throw new Error("competition choice missing");
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const [left, right] = school.playerIds;
    if (!left || !right) throw new Error("players missing");
    snapshot.state.pendingEvent = {
      eventId: eventId(event.id),
      actorPlayerIds: [left, right],
      targetSchoolId: null,
      surfacedDate: snapshot.state.date,
      choiceIds: [choice.id],
      chainId: null,
      chainStage: null,
    };

    const result = applyGameAction(snapshot, {
      type: "event-choice",
      choiceId: choice.id,
    });
    const notices = result.state.notifications.items.filter(
      (item) => item.type === "special-relationship",
    );

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      type: "special-relationship",
      payload: {
        action: "established",
        kind: "rival",
      },
    });
  });

  it("persists one compact notice when weekly deterioration removes a bond", () => {
    const snapshot = createSnapshot();
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const [left, right] = school.playerIds;
    if (!left || !right) throw new Error("players missing");
    snapshot.state.playerRelationships[relationshipKey(left, right)] = 59;
    const added = addSpecialRelationship(snapshot.state, {
      playerIds: [left, right],
      kind: "partner",
      establishedDate: snapshot.state.date,
    });
    const key = relationshipKey(left, right);
    const bond = added.state.playerRelationshipBonds[key]!;
    snapshot.state = {
      ...added.state,
      playerRelationshipBonds: {
        ...added.state.playerRelationshipBonds,
        [key]: {
          ...bond,
          tags: bond.tags.map((tag) => ({
            ...tag,
            belowThresholdSince: addWeeks(snapshot.state.date, -7),
          })),
        },
      },
    };

    const result = applyGameAction(snapshot, { type: "advance-week" });
    const notice = result.state.notifications.items.find(
      (item) => item.type === "special-relationship",
    );

    expect(notice).toMatchObject({
      type: "special-relationship",
      payload: {
        action: "removed",
        kind: "partner",
      },
    });
  });
});
