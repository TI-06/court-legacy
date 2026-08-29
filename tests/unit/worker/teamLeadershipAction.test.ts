import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { setTeamLeadership } from "../../../src/domain/dynamics/setTeamLeadership";
import { playerId } from "../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type {
  CloudGameSnapshot,
  GameStore,
  PersistOperationInput,
  PersistOperationResult,
} from "../../../worker/data/GameStore";
import { applyGameAction } from "../../../worker/game/applyGameAction";
import { createGameActionHandler } from "../../../worker/routes/gameAction";

function createSnapshot(revision = 4): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase7-leadership-action",
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
    revision,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function userRosterIds(snapshot: CloudGameSnapshot) {
  const school = snapshot.state.schools[snapshot.state.userSchoolId];
  if (!school || school.playerIds.length < 2) {
    throw new Error("leadership fixture requires at least two user players");
  }
  return [school.playerIds[0]!, school.playerIds[1]!] as const;
}

function foreignPlayerId(snapshot: CloudGameSnapshot) {
  const foreignSchool = Object.values(snapshot.state.schools).find(
    (school) => school.id !== snapshot.state.userSchoolId,
  );
  if (!foreignSchool?.playerIds[0]) {
    throw new Error("leadership fixture requires a rival player");
  }
  return foreignSchool.playerIds[0];
}

function createStore(snapshot: CloudGameSnapshot): GameStore {
  return {
    getSnapshot: vi.fn(async () => snapshot),
    getOperationResponse: vi.fn(async () => null),
    createGame: vi.fn(async () => {
      throw new Error("not used");
    }),
    applyOperation: vi.fn(
      async (
        input: PersistOperationInput,
      ): Promise<PersistOperationResult> => ({
        response: input.response,
        replayed: false,
      }),
    ),
  };
}

function actionRequest(body: unknown): Request {
  return new Request("https://court-legacy.test/api/game/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("team leadership action", () => {
  it("assigns distinct current user-school players and recalculates cohesion", () => {
    const snapshot = createSnapshot();
    const [captainPlayerId, viceCaptainPlayerId] = userRosterIds(snapshot);
    const before = snapshot.state.teamDynamics.cohesion;

    const applied = applyGameAction(snapshot, {
      type: "set-team-leadership",
      captainPlayerId,
      viceCaptainPlayerId,
    });

    expect(applied.state.teamDynamics.captainPlayerId).toBe(captainPlayerId);
    expect(applied.state.teamDynamics.viceCaptainPlayerId).toBe(
      viceCaptainPlayerId,
    );
    expect(applied.state.schools[applied.state.userSchoolId]?.captainPlayerId).toBe(
      captainPlayerId,
    );
    expect(applied.state.teamDynamics.previousCohesion).toBe(before);
    expect(applied.state.teamDynamics.cohesion).toBeGreaterThanOrEqual(0);
    expect(applied.state.teamDynamics.cohesion).toBeLessThanOrEqual(100);
  });

  it("rejects a foreign or stale captain", () => {
    const snapshot = createSnapshot();
    const [, viceCaptainPlayerId] = userRosterIds(snapshot);

    expect(() =>
      setTeamLeadership(
        snapshot.state,
        foreignPlayerId(snapshot),
        viceCaptainPlayerId,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "team_leadership_invalid_captain" }),
    );

    expect(() =>
      setTeamLeadership(
        snapshot.state,
        playerId("stale-captain"),
        viceCaptainPlayerId,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "team_leadership_invalid_captain" }),
    );
  });

  it("rejects a foreign or stale vice-captain", () => {
    const snapshot = createSnapshot();
    const [captainPlayerId] = userRosterIds(snapshot);

    expect(() =>
      setTeamLeadership(
        snapshot.state,
        captainPlayerId,
        foreignPlayerId(snapshot),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "team_leadership_invalid_vice_captain" }),
    );

    expect(() =>
      setTeamLeadership(
        snapshot.state,
        captainPlayerId,
        playerId("stale-vice-captain"),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "team_leadership_invalid_vice_captain" }),
    );
  });

  it("rejects using the same player for captain and vice-captain", () => {
    const snapshot = createSnapshot();
    const [captainPlayerId] = userRosterIds(snapshot);

    expect(() =>
      setTeamLeadership(
        snapshot.state,
        captainPlayerId,
        captainPlayerId,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "team_leadership_same_player" }),
    );
  });

  it("returns revision_conflict before mutating a stale leadership action", async () => {
    const snapshot = createSnapshot(5);
    const before = structuredClone(snapshot.state);
    const [captainPlayerId, viceCaptainPlayerId] = userRosterIds(snapshot);
    const store = createStore(snapshot);
    const handler = createGameActionHandler(store);

    const response = await handler(
      actionRequest({
        operationId: "leadership-stale-001",
        revision: 4,
        action: {
          type: "set-team-leadership",
          captainPlayerId,
          viceCaptainPlayerId,
        },
      }),
      { id: snapshot.userId },
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("revision_conflict");
    expect(store.applyOperation).not.toHaveBeenCalled();
    expect(snapshot.state).toEqual(before);
  });
});
