import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { resolveEventChoice } from "../../../../src/domain/events/resolveEventChoice";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import { eventId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import type { GameDataRegistry } from "../../../../src/data/dataRegistry";
import type { EventDefinition } from "../../../../src/domain/validation/gameDataSchema";

const effectEvent: EventDefinition = {
  id: "event.effect-fixture",
  version: 1,
  category: "relationship",
  title: "効果確認",
  bodyTemplate: "{{player}}と{{player2}}の出来事。",
  tags: ["test"],
  trigger: {},
  weight: 1,
  cooldownWeeks: 0,
  oncePerCareer: true,
  actorCount: 2,
  choices: [
    {
      id: "apply",
      label: "実行",
      detail: "複数効果を適用する。",
      effects: [
        { type: "ability-change", ability: "receive", amount: 3 },
        { type: "morale-change", amount: 5 },
        { type: "fatigue-change", amount: 4 },
        { type: "trust-change", amount: 6 },
        { type: "relationship-change", amount: 8 },
        { type: "reputation-change", amount: 4 },
        { type: "funds-change", amount: 20 },
        { type: "facility-change", facility: "analysisRoom", amount: 1 },
      ],
      followUp: {
        eventId: "event.position-trial-result",
        afterWeeks: 2,
        probability: 100,
      },
    },
    {
      id: "injury",
      label: "負傷",
      detail: "負傷効果を確認する。",
      effects: [
        {
          type: "injury-set",
          severity: "minor",
          weeks: 2,
          recurrenceRisk: 10,
        },
      ],
    },
    {
      id: "overspend",
      label: "全額支出",
      detail: "所持資金を超える支出を確認する。",
      effects: [{ type: "funds-change", amount: -99999 }],
    },
  ],
};

function registryWithFixture(): GameDataRegistry {
  return {
    ...gameData,
    events: new Map([...gameData.events, [effectEvent.id, effectEvent]]),
  };
}

describe("event resolution", () => {
  it("applies typed effects, schedules follow-up, and stores visible history", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const [left, right] = school.playerIds;
    if (!left || !right) {
      throw new Error("players missing");
    }
    const leftBefore = state.players[left]!;
    const fundsBefore = school.funds;
    const facilityBefore = school.facilities.analysisRoom;
    const relationship = relationshipKey(left, right);
    state.playerRelationships[relationship] = 50;
    state.pendingEvent = {
      eventId: eventId(effectEvent.id),
      actorPlayerIds: [left, right],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: ["apply", "injury"],
      chainId: null,
      chainStage: null,
    };

    const result = resolveEventChoice(
      state,
      "apply",
      registryWithFixture(),
      new SeededRandom(state.seed, state.randomCursor),
    );

    expect(result.state.pendingEvent).toBeNull();
    expect(result.state.players[left]!.abilities.receive).toBe(
      Math.min(100, leftBefore.abilities.receive + 3),
    );
    expect(result.state.players[left]!.morale).toBe(
      Math.min(100, leftBefore.morale + 5),
    );
    expect(result.state.playerRelationships[relationship]).toBe(58);
    expect(result.state.schools[state.userSchoolId]!.funds).toBe(
      fundsBefore + 20,
    );
    expect(result.state.schoolManagement.fundsHistory.at(-1)).toMatchObject({
      kind: "event",
      amount: 20,
      balanceAfter: fundsBefore + 20,
      relatedId: effectEvent.id,
    });
    expect(
      result.state.schools[state.userSchoolId]!.facilities.analysisRoom,
    ).toBe(Math.min(5, facilityBefore + 1));
    expect(result.state.eventMemory.history).toHaveLength(1);
    expect(result.occurrence.visibleResultCodes).toContain("連携 +8");
    expect(result.state.eventMemory.scheduledFollowUps).toHaveLength(1);
    expect(result.state.eventMemory.occurredCareerKeys).toHaveLength(1);
  });

  it("floors an oversized event debit at zero and records only the applied debit", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const [left, right] = school.playerIds;
    if (!left || !right) {
      throw new Error("players missing");
    }
    const fundsBefore = school.funds;
    state.pendingEvent = {
      eventId: eventId(effectEvent.id),
      actorPlayerIds: [left, right],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: ["overspend"],
      chainId: null,
      chainStage: null,
    };

    const result = resolveEventChoice(
      state,
      "overspend",
      registryWithFixture(),
      new SeededRandom(state.seed, state.randomCursor),
    );

    expect(result.state.schools[state.userSchoolId]!.funds).toBe(0);
    expect(result.occurrence.visibleResultCodes).toContain(
      `資金 -${fundsBefore}`,
    );
    expect(result.state.schoolManagement.fundsHistory.at(-1)).toMatchObject({
      kind: "event",
      amount: -fundsBefore,
      balanceAfter: 0,
      relatedId: effectEvent.id,
    });
  });
});
