import { createDemoGame } from "../../../../src/app/createDemoGame";
import { advanceOneWeek } from "../../../../src/domain/calendar/weekProgression";
import { addWeeks } from "../../../../src/domain/events/eventDate";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import type { GameState } from "../../../../src/domain/model/GameState";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import {
  addSpecialRelationship,
  getRelationshipBond,
  progressSpecialRelationshipsWeekly,
} from "../../../../src/domain/relationships/specialRelationships";
import type { SpecialRelationshipKind } from "../../../../src/domain/relationships/relationshipTypes";

function pairState(kind: SpecialRelationshipKind, score: number) {
  let state = createDemoGame();
  state = {
    ...state,
    date: "2026-04-01",
    calendar: { ...state.calendar, currentDate: "2026-04-01" },
  };
  const school = state.schools[state.userSchoolId]!;
  const [left, right] = school.playerIds;
  if (!left || !right) throw new Error("players missing");
  state.playerRelationships[relationshipKey(left, right)] = score;
  const added = addSpecialRelationship(state, {
    playerIds: [left, right],
    kind,
    establishedDate: state.date,
    ...(kind === "mentor"
      ? { mentorPlayerId: right, protegePlayerId: left }
      : {}),
  });
  return { state: added.state, left, right };
}

function progressWeeks(
  initial: GameState,
  weeks: number,
): { state: GameState; transitions: Array<{ action: string; kind: string }> } {
  let state = initial;
  const transitions: Array<{ action: string; kind: string }> = [];
  for (let index = 0; index < weeks; index += 1) {
    const nextDate = addWeeks(state.date, 1);
    const progressed = progressSpecialRelationshipsWeekly(state, nextDate);
    transitions.push(...progressed.transitions);
    state = {
      ...progressed.state,
      date: nextDate,
      calendar: { ...progressed.state.calendar, currentDate: nextDate },
    };
  }
  return { state, transitions };
}

function setScore(state: GameState, left: PlayerId, right: PlayerId, score: number) {
  return {
    ...state,
    playerRelationships: {
      ...state.playerRelationships,
      [relationshipKey(left, right)]: score,
    },
  };
}

describe("Phase21 special relationship deterioration", () => {
  it("keeps a partner through week 7 and removes it at week 8 below 60", () => {
    const { state, left, right } = pairState("partner", 59);
    const week7 = progressWeeks(state, 7);
    expect(getRelationshipBond(week7.state, left, right)?.tags[0]).toMatchObject({
      kind: "partner",
      belowThresholdSince: "2026-04-01",
    });
    expect(week7.transitions).toHaveLength(0);

    const week8 = progressWeeks(week7.state, 1);
    expect(getRelationshipBond(week8.state, left, right)).toBeNull();
    expect(week8.transitions).toEqual([
      { action: "removed", kind: "partner", playerIds: [left, right].sort() },
    ]);
  });

  it("clears the deterioration timer after recovery before eight weeks", () => {
    const { state, left, right } = pairState("partner", 59);
    const week4 = progressWeeks(state, 4);
    const recovered = setScore(week4.state, left, right, 60);
    const recoveryWeek = progressWeeks(recovered, 1);
    expect(
      getRelationshipBond(recoveryWeek.state, left, right)?.tags[0]?.belowThresholdSince,
    ).toBeNull();

    const lowAgain = setScore(recoveryWeek.state, left, right, 59);
    const week7Again = progressWeeks(lowAgain, 7);
    expect(getRelationshipBond(week7Again.state, left, right)?.tags[0]?.kind).toBe(
      "partner",
    );
  });

  it("uses 50 as the mentor threshold", () => {
    const low = pairState("mentor", 49);
    const removed = progressWeeks(low.state, 8);
    expect(getRelationshipBond(removed.state, low.left, low.right)).toBeNull();
    expect(removed.transitions.at(-1)?.kind).toBe("mentor");

    const safe = pairState("mentor", 50);
    const retained = progressWeeks(safe.state, 12);
    expect(getRelationshipBond(retained.state, safe.left, safe.right)?.tags[0]?.kind).toBe(
      "mentor",
    );
  });

  it("never affinity-degrades a rival", () => {
    const { state, left, right } = pairState("rival", 0);
    const progressed = progressWeeks(state, 20);
    expect(getRelationshipBond(progressed.state, left, right)?.tags[0]).toMatchObject({
      kind: "rival",
      belowThresholdSince: null,
    });
    expect(progressed.transitions).toHaveLength(0);
  });

  it("removes only the degraded tag from a two-tag pair", () => {
    const base = pairState("partner", 59);
    const withRival = addSpecialRelationship(base.state, {
      playerIds: [base.left, base.right],
      kind: "rival",
      establishedDate: base.state.date,
    });
    const progressed = progressWeeks(withRival.state, 8);
    expect(
      getRelationshipBond(progressed.state, base.left, base.right)?.tags.map(
        (tag) => tag.kind,
      ),
    ).toEqual(["rival"]);
    expect(progressed.transitions).toEqual([
      {
        action: "removed",
        kind: "partner",
        playerIds: [base.left, base.right].sort(),
      },
    ]);
  });

  it("surfaces deterioration transitions through advanceOneWeek", () => {
    const { state, left, right } = pairState("partner", 59);
    const key = relationshipKey(left, right);
    const bond = state.playerRelationshipBonds[key]!;
    const primed: GameState = {
      ...state,
      playerRelationshipBonds: {
        ...state.playerRelationshipBonds,
        [key]: {
          ...bond,
          tags: bond.tags.map((tag) => ({
            ...tag,
            belowThresholdSince: addWeeks(state.date, -7),
          })),
        },
      },
    };

    const result = advanceOneWeek(primed);
    expect(result.specialRelationshipTransitions).toEqual([
      { action: "removed", kind: "partner", playerIds: [left, right].sort() },
    ]);
    expect(getRelationshipBond(result.state, left, right)).toBeNull();
  });
});
