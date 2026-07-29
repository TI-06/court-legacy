import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { isEventEligibleForActors } from "../../../../src/domain/events/eventEligibility";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import { matchId } from "../../../../src/domain/model/identifiers";
import type { EventDefinition } from "../../../../src/domain/validation/gameDataSchema";

function eventWithTrigger(
  trigger: EventDefinition["trigger"],
): EventDefinition {
  const base = gameData.events.get("event.receive-breakthrough");
  if (!base) {
    throw new Error("fixture event missing");
  }
  return { ...base, actorCount: 2, trigger, cooldownWeeks: 0 };
}

describe("event eligibility", () => {
  it("matches player, relationship, school, record, match, and tournament conditions", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const [left, right] = school.playerIds;
    if (!left || !right) {
      throw new Error("players missing");
    }
    state.date = "2026-06-10";
    state.calendar.currentDate = state.date;
    state.calendar.activities = [
      {
        id: "qualifier-now",
        date: state.date,
        type: "qualifier",
        title: "県予選",
        mandatory: true,
        matchId: null,
        metadata: {},
      },
    ];
    state.playerRelationships[relationshipKey(left, right)] = 72;
    state.players[left]!.abilities.receive = 75;
    state.players[right]!.abilities.receive = 70;
    state.history.schoolRecordValues["qualifier-wins"] = 3;
    const opponent = Object.values(state.schools).find(
      (candidate) => candidate.id !== state.userSchoolId,
    )!;
    state.history.matches.push({
      matchId: matchId("recent-win"),
      date: "2026-06-03",
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      winnerSchoolId: state.userSchoolId,
      homeSetsWon: 2,
      awaySetsWon: 0,
      tournamentId: "qualifier",
    });

    const event = eventWithTrigger({
      months: [6],
      abilityRanges: { receive: { min: 65 } },
      relationship: { min: 60 },
      schoolReputationMin: 0,
      schoolFundsMin: 0,
      recordKey: "qualifier-wins",
      recordMin: 2,
      recentMatchResult: "win",
      tournamentOnly: true,
      tournamentStages: ["qualifier"],
    });

    expect(isEventEligibleForActors(state, event, [left, right])).toBe(true);
  });

  it("rejects actors when the pair relationship is outside the range", () => {
    const state = createDemoGame();
    const [left, right] = state.schools[state.userSchoolId]!.playerIds;
    if (!left || !right) {
      throw new Error("players missing");
    }
    state.playerRelationships[relationshipKey(left, right)] = 20;

    expect(
      isEventEligibleForActors(
        state,
        eventWithTrigger({ relationship: { min: 60 } }),
        [left, right],
      ),
    ).toBe(false);
  });
});
