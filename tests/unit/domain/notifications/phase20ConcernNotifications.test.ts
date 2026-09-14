import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { ResolvedPlayerConcern } from "../../../../src/domain/dynamics/concernResolution";
import {
  appendNotification,
  buildConcernResolutionNotification,
  selectHomeConcernResolutionNotifications,
  selectHomeTrainingNotifications,
  type ConcernResolutionNotification,
  type TrainingResultNotification,
} from "../../../../src/domain/notifications/gameNotifications";
import {
  matchId,
  type GameDate,
} from "../../../../src/domain/model/identifiers";

function trainingNotification(
  id: string,
  weekOfYear: number,
): TrainingResultNotification {
  return {
    id,
    type: "training-result",
    createdGameDate: `2026-04-${String(weekOfYear).padStart(2, "0")}` as GameDate,
    academicYearIndex: 1,
    weekOfYear,
    readAtGameDate: null,
    payload: {
      teamTrainingMenuName: "基礎練習",
      totalAbilityGrowth: 0,
      totalFatigueChange: 0,
      injuredCount: 0,
      players: [],
    },
  };
}

function concernNotification(
  id: string,
  weekOfYear: number,
): ConcernResolutionNotification {
  return {
    id,
    type: "concern-resolution",
    createdGameDate: `2026-05-${String(weekOfYear).padStart(2, "0")}` as GameDate,
    academicYearIndex: 1,
    weekOfYear,
    readAtGameDate: null,
    payload: { items: [] },
  };
}

describe("Phase20 concern resolution notifications", () => {
  it("groups all concerns resolved by one official match into one presentation-safe notification", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerA = state.players[school.playerIds[0]!]!;
    const playerB = state.players[school.playerIds[1]!]!;
    const resolved: ResolvedPlayerConcern[] = [
      { playerId: playerA.id, code: "playing-time" },
      { playerId: playerB.id, code: "team-slump" },
    ];
    const id = matchId("phase20-concern-match");

    const notification = buildConcernResolutionNotification({
      state,
      matchId: id,
      resolved,
    });

    expect(notification.id).toBe(`concern-resolution:${id}`);
    expect(notification.type).toBe("concern-resolution");
    expect(notification.payload.items).toEqual([
      {
        playerId: playerA.id,
        displayName: `${playerA.lastName} ${playerA.firstName}`,
        concernCode: "playing-time",
        concernTitle: "出場機会への不満",
      },
      {
        playerId: playerB.id,
        displayName: `${playerB.lastName} ${playerB.firstName}`,
        concernCode: "team-slump",
        concernTitle: "チーム不調への不満",
      },
    ]);
  });

  it("retains only the newest notification of each supported type", () => {
    const trainingOld = trainingNotification("training-old", 1);
    const concernOld = concernNotification("concern-old", 1);
    const trainingNew = trainingNotification("training-new", 2);
    const concernNew = concernNotification("concern-new", 2);

    let state = appendNotification({ items: [] }, trainingOld);
    state = appendNotification(state, concernOld);
    state = appendNotification(state, trainingNew);
    state = appendNotification(state, concernNew);

    expect(state.items).toHaveLength(2);
    expect(selectHomeTrainingNotifications(state).map((item) => item.id)).toEqual([
      "training-new",
    ]);
    expect(
      selectHomeConcernResolutionNotifications(state).map((item) => item.id),
    ).toEqual(["concern-new"]);
  });

  it("does not evict the other notification type and ignores duplicate ids", () => {
    const training = trainingNotification("training-current", 3);
    const concern = concernNotification("concern-current", 3);

    const both = appendNotification(
      appendNotification({ items: [] }, training),
      concern,
    );
    const duplicate = appendNotification(both, concern);

    expect(duplicate).toEqual(both);
    expect(duplicate.items.map((item) => item.id).sort()).toEqual([
      "concern-current",
      "training-current",
    ]);
  });
});
