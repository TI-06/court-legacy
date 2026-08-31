import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
} from "../../../src/domain/tournament/progressOfficialTournaments";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  gameActionRequestSchema,
  type GameAction,
} from "../../../worker/game/actionSchema";
import {
  applyGameAction,
  GameRuleConflictError,
} from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "practice-scheduling-fixture",
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

function applyUnsafe(
  snapshot: CloudGameSnapshot,
  action: Record<string, unknown>,
) {
  return applyGameAction(snapshot, action as unknown as GameAction);
}

function withIncomingOffer(snapshot: CloudGameSnapshot): CloudGameSnapshot {
  const candidate =
    snapshot.state.weeklySchedule.practiceMatch.outgoingCandidates[0];
  if (!candidate) {
    throw new Error("practice candidate fixture missing");
  }

  return {
    ...snapshot,
    state: {
      ...snapshot.state,
      weeklySchedule: {
        ...snapshot.state.weeklySchedule,
        practiceMatch: {
          ...snapshot.state.weeklySchedule.practiceMatch,
          incomingOffer: {
            schoolId: candidate.schoolId,
            growthRating: candidate.growthRating,
            loadRating: candidate.growthRating,
          },
        },
      },
    },
  };
}

function withCandidateAcceptance(
  snapshot: CloudGameSnapshot,
  acceptancePercent: number,
): CloudGameSnapshot {
  const candidate =
    snapshot.state.weeklySchedule.practiceMatch.outgoingCandidates[0];
  if (!candidate) {
    throw new Error("practice candidate fixture missing");
  }

  return {
    ...snapshot,
    state: {
      ...snapshot.state,
      weeklySchedule: {
        ...snapshot.state.weeklySchedule,
        practiceMatch: {
          ...snapshot.state.weeklySchedule.practiceMatch,
          incomingOffer: null,
          outgoingCandidates:
            snapshot.state.weeklySchedule.practiceMatch.outgoingCandidates.map(
              (entry) =>
                entry.schoolId === candidate.schoolId
                  ? { ...entry, acceptancePercent }
                  : entry,
            ),
        },
      },
    },
  };
}

describe("practice-match scheduling authority", () => {
  it("accepts an authoritative incoming offer and reserves the only weekly practice slot", () => {
    const snapshot = withIncomingOffer(createSnapshot());
    const offer = snapshot.state.weeklySchedule.practiceMatch.incomingOffer!;

    const result = applyUnsafe(snapshot, { type: "practice-offer-accept" });

    expect(result.state.weeklySchedule.practiceMatch).toMatchObject({
      incomingOffer: null,
      scheduledOpponentId: offer.schoolId,
      scheduledBy: "incoming",
    });

    const scheduledSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: result.state,
      teamSelection: result.teamSelection,
    };
    expect(() =>
      applyUnsafe(scheduledSnapshot, { type: "practice-offer-accept" }),
    ).toThrowError(GameRuleConflictError);
  });

  it("declines an incoming offer without reserving a practice match", () => {
    const snapshot = withIncomingOffer(createSnapshot());

    const result = applyUnsafe(snapshot, { type: "practice-offer-decline" });

    expect(result.state.weeklySchedule.practiceMatch.incomingOffer).toBeNull();
    expect(
      result.state.weeklySchedule.practiceMatch.scheduledOpponentId,
    ).toBeNull();
    expect(result.state.weeklySchedule.practiceMatch.scheduledBy).toBeNull();
  });

  it("derives an outgoing acceptance on the server and prevents a second scheduled match", () => {
    const snapshot = withCandidateAcceptance(createSnapshot(), 100);
    const candidate =
      snapshot.state.weeklySchedule.practiceMatch.outgoingCandidates[0]!;
    const beforeCursor = snapshot.state.randomCursor;

    const first = applyUnsafe(snapshot, {
      type: "practice-request",
      schoolId: candidate.schoolId,
    });
    const second = applyUnsafe(snapshot, {
      type: "practice-request",
      schoolId: candidate.schoolId,
    });

    expect(first).toEqual(second);
    expect(first.state.randomCursor).toBe(beforeCursor);
    expect(first.state.weeklySchedule.practiceMatch).toMatchObject({
      scheduledOpponentId: candidate.schoolId,
      scheduledBy: "outgoing",
    });
    expect(
      first.state.weeklySchedule.practiceMatch.outgoingCandidates.find(
        (entry) => entry.schoolId === candidate.schoolId,
      )?.status,
    ).toBe("accepted");

    const scheduledSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: first.state,
      teamSelection: first.teamSelection,
    };
    const anotherCandidate =
      first.state.weeklySchedule.practiceMatch.outgoingCandidates.find(
        (entry) => entry.schoolId !== candidate.schoolId,
      )!;
    expect(() =>
      applyUnsafe(scheduledSnapshot, {
        type: "practice-request",
        schoolId: anotherCandidate.schoolId,
      }),
    ).toThrowError(GameRuleConflictError);
  });

  it("keeps a rejected request visible and allows the weekly slot to remain empty", () => {
    const snapshot = withCandidateAcceptance(createSnapshot(), 0);
    const candidate =
      snapshot.state.weeklySchedule.practiceMatch.outgoingCandidates[0]!;

    const result = applyUnsafe(snapshot, {
      type: "practice-request",
      schoolId: candidate.schoolId,
    });

    expect(
      result.state.weeklySchedule.practiceMatch.outgoingCandidates.find(
        (entry) => entry.schoolId === candidate.schoolId,
      )?.status,
    ).toBe("rejected");
    expect(
      result.state.weeklySchedule.practiceMatch.scheduledOpponentId,
    ).toBeNull();
    expect(() =>
      applyUnsafe(
        {
          ...snapshot,
          state: result.state,
          teamSelection: result.teamSelection,
        },
        { type: "practice-request", schoolId: candidate.schoolId },
      ),
    ).toThrowError(GameRuleConflictError);
  });

  it("rejects a school that is not one of the server-generated candidates", () => {
    const snapshot = createSnapshot();
    const candidateIds = new Set(
      snapshot.state.weeklySchedule.practiceMatch.outgoingCandidates.map(
        (candidate) => candidate.schoolId,
      ),
    );
    const arbitrarySchool = Object.values(snapshot.state.schools).find(
      (school) =>
        school.id !== snapshot.state.userSchoolId &&
        !candidateIds.has(school.id),
    );
    if (!arbitrarySchool) {
      throw new Error("arbitrary opponent fixture missing");
    }

    expect(() =>
      applyUnsafe(snapshot, {
        type: "practice-request",
        schoolId: arbitrarySchool.id,
      }),
    ).toThrowError(GameRuleConflictError);
  });

  it("blocks incoming and outgoing scheduling while an official match is due", () => {
    const snapshot = withIncomingOffer(createSnapshot());
    const progressedState = advanceOfficialTournamentsThroughWeek({
      ...snapshot.state,
      calendar: {
        ...snapshot.state.calendar,
        weekOfYear: 9,
      },
    });
    expect(findDueUserOfficialMatch(progressedState)).not.toBeNull();
    const officialSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: {
        ...progressedState,
        weeklySchedule: snapshot.state.weeklySchedule,
      },
    };
    const candidate =
      officialSnapshot.state.weeklySchedule.practiceMatch
        .outgoingCandidates[0]!;

    expect(() =>
      applyUnsafe(officialSnapshot, { type: "practice-offer-accept" }),
    ).toThrowError(GameRuleConflictError);
    expect(() =>
      applyUnsafe(officialSnapshot, {
        type: "practice-request",
        schoolId: candidate.schoolId,
      }),
    ).toThrowError(GameRuleConflictError);
  });

  it("accepts only the minimal scheduling action contract and rejects client-computed results", () => {
    const base = {
      operationId: "operation-practice-001",
      revision: 7,
    };

    expect(
      gameActionRequestSchema.safeParse({
        ...base,
        action: { type: "practice-offer-accept" },
      }).success,
    ).toBe(true);
    expect(
      gameActionRequestSchema.safeParse({
        ...base,
        action: { type: "practice-offer-decline" },
      }).success,
    ).toBe(true);
    expect(
      gameActionRequestSchema.safeParse({
        ...base,
        action: { type: "practice-request", schoolId: "school-002" },
      }).success,
    ).toBe(true);
    expect(
      gameActionRequestSchema.safeParse({
        ...base,
        action: {
          type: "practice-request",
          schoolId: "school-002",
          accepted: true,
          acceptancePercent: 100,
        },
      }).success,
    ).toBe(false);
  });
});
