import { createDemoGame } from "../../../../src/app/createDemoGame";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import { calculateRelationshipTrainingModifier } from "../../../../src/domain/training/relationshipTrainingModifiers";

function fixture() {
  const state = structuredClone(createDemoGame());
  const ids = state.schools[state.userSchoolId]!.playerIds.slice(0, 3) as [
    PlayerId,
    PlayerId,
    PlayerId,
  ];
  state.playerRelationshipBonds = {};
  return { state, ids };
}

function tagBase(state: ReturnType<typeof createDemoGame>) {
  return {
    establishedDate: state.date,
    sourceEventId: null,
    lastReinforcedDate: state.date,
    belowThresholdSince: null,
  } as const;
}

describe("Phase21 relationship training modifiers", () => {
  it("gives both active partner participants +3 percentage points", () => {
    const {
      state,
      ids: [left, right],
    } = fixture();
    state.playerRelationshipBonds[relationshipKey(left, right)] = {
      playerIds: [left, right].sort() as [PlayerId, PlayerId],
      tags: [{ ...tagBase(state), kind: "partner" }],
    };
    const active = new Set<PlayerId>([left, right]);

    expect(calculateRelationshipTrainingModifier(state, left, active)).toEqual({
      contributions: [
        {
          code: "relationship-partner",
          label: "相棒",
          percentPoints: 3,
          relatedPlayerId: right,
        },
      ],
      rawPercentPoints: 3,
      appliedPercentPoints: 3,
      capped: false,
    });
    expect(
      calculateRelationshipTrainingModifier(state, right, active)
        .appliedPercentPoints,
    ).toBe(3);
  });

  it("gives mentor bonus only to the active protege", () => {
    const {
      state,
      ids: [mentor, protege],
    } = fixture();
    state.playerRelationshipBonds[relationshipKey(mentor, protege)] = {
      playerIds: [mentor, protege].sort() as [PlayerId, PlayerId],
      tags: [
        {
          ...tagBase(state),
          kind: "mentor",
          mentorPlayerId: mentor,
          protegePlayerId: protege,
        },
      ],
    };
    const active = new Set<PlayerId>([mentor, protege]);

    expect(
      calculateRelationshipTrainingModifier(state, mentor, active)
        .appliedPercentPoints,
    ).toBe(0);
    expect(
      calculateRelationshipTrainingModifier(state, protege, active)
        .contributions,
    ).toEqual([
      {
        code: "relationship-mentor",
        label: "師弟",
        percentPoints: 4,
        relatedPlayerId: mentor,
      },
    ]);
  });

  it("gives rival bonus only when both active rivals share preferredPosition", () => {
    const {
      state,
      ids: [left, right],
    } = fixture();
    state.playerRelationshipBonds[relationshipKey(left, right)] = {
      playerIds: [left, right].sort() as [PlayerId, PlayerId],
      tags: [{ ...tagBase(state), kind: "rival" }],
    };
    const active = new Set<PlayerId>([left, right]);
    state.players[right]!.preferredPosition =
      state.players[left]!.preferredPosition;

    expect(
      calculateRelationshipTrainingModifier(state, left, active)
        .appliedPercentPoints,
    ).toBe(3);

    state.players[right]!.preferredPosition =
      state.players[left]!.preferredPosition === "OH" ? "MB" : "OH";
    expect(
      calculateRelationshipTrainingModifier(state, left, active)
        .appliedPercentPoints,
    ).toBe(0);
  });

  it("does not enable a social bonus when the counterpart is inactive", () => {
    const {
      state,
      ids: [left, right],
    } = fixture();
    state.playerRelationshipBonds[relationshipKey(left, right)] = {
      playerIds: [left, right].sort() as [PlayerId, PlayerId],
      tags: [{ ...tagBase(state), kind: "partner" }],
    };

    expect(
      calculateRelationshipTrainingModifier(
        state,
        left,
        new Set<PlayerId>([left]),
      ).appliedPercentPoints,
    ).toBe(0);
  });

  it("adds contributions but caps the applied social bonus at +5", () => {
    const {
      state,
      ids: [mentor, protege],
    } = fixture();
    const key = relationshipKey(mentor, protege);
    state.playerRelationshipBonds[key] = {
      playerIds: [mentor, protege].sort() as [PlayerId, PlayerId],
      tags: [
        { ...tagBase(state), kind: "partner" },
        {
          ...tagBase(state),
          kind: "mentor",
          mentorPlayerId: mentor,
          protegePlayerId: protege,
        },
      ],
    };

    expect(
      calculateRelationshipTrainingModifier(
        state,
        protege,
        new Set<PlayerId>([mentor, protege]),
      ),
    ).toEqual({
      contributions: [
        {
          code: "relationship-mentor",
          label: "師弟",
          percentPoints: 4,
          relatedPlayerId: mentor,
        },
        {
          code: "relationship-partner",
          label: "相棒",
          percentPoints: 3,
          relatedPlayerId: mentor,
        },
      ],
      rawPercentPoints: 7,
      appliedPercentPoints: 5,
      capped: true,
    });
  });
});
