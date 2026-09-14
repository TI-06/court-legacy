import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import type {
  GameDate,
  SchoolId,
} from "../../../../src/domain/model/identifiers";
import { rivalryKey } from "../../../../src/domain/world/rivalWorldProgression";
import * as practicePlanning from "../../../../src/domain/weekly/practiceMatchPlanning";

interface IncomingOfferHistoryEntry {
  schoolId: SchoolId;
  surfacedDate: GameDate;
}

const completionApi = practicePlanning as unknown as {
  wasIncomingOfferRecentlySurfaced?: (
    history: readonly IncomingOfferHistoryEntry[],
    schoolId: SchoolId,
    currentDate: GameDate,
    cooldownDays?: number,
  ) => boolean;
};

function eliteState(): GameState {
  const state = structuredClone(createDemoGame());
  const home = state.schools[state.userSchoolId]!;
  state.schools[state.userSchoolId] = {
    ...home,
    reputation: "elite",
  };
  return state;
}

function withDate(state: GameState, date: GameDate): GameState {
  return {
    ...state,
    date,
    calendar: {
      ...state.calendar,
      currentDate: date,
    },
  };
}

function equalizeSchoolStrengths(state: GameState): GameState {
  const next = structuredClone(state);
  const home = next.schools[next.userSchoolId]!;
  const referencePlayer = next.players[home.playerIds[0]!]!;

  for (const player of Object.values(next.players)) {
    player.abilities = { ...referencePlayer.abilities };
    player.condition = referencePlayer.condition;
    player.fatigue = referencePlayer.fatigue;
    player.injury = referencePlayer.injury;
  }
  for (const school of Object.values(next.schools)) {
    school.reputationPoints = home.reputationPoints;
    school.coach = structuredClone(home.coach);
    school.facilities = structuredClone(home.facilities);
  }
  return next;
}

function setCanonicalOfferHistory(
  state: GameState,
  entries: readonly IncomingOfferHistoryEntry[],
): GameState {
  const weeklySchedule = {
    ...state.weeklySchedule,
    incomingPracticeOfferHistory: entries.map((entry) => ({ ...entry })),
  };
  return { ...state, weeklySchedule } as unknown as GameState;
}

function offerIdsAcrossApril(state: GameState): SchoolId[] {
  const offers: SchoolId[] = [];
  for (let day = 1; day <= 28; day += 1) {
    const dated = withDate(
      state,
      `2026-04-${String(day).padStart(2, "0")}` as GameDate,
    );
    const offer = practicePlanning.buildPracticePlanning(dated).incomingOffer;
    if (offer) offers.push(offer.schoolId);
  }
  return offers;
}

describe("Phase20-3 completion contract", () => {
  it("blocks the same incoming school through day 56 and releases it on day 57", () => {
    expect(completionApi.wasIncomingOfferRecentlySurfaced).toBeTypeOf(
      "function",
    );
    const helper = completionApi.wasIncomingOfferRecentlySurfaced;
    if (!helper) return;

    const schoolId = "school-002" as SchoolId;
    expect(
      helper(
        [{ schoolId, surfacedDate: "2026-02-11" as GameDate }],
        schoolId,
        "2026-04-01" as GameDate,
      ),
    ).toBe(true);
    expect(
      helper(
        [{ schoolId, surfacedDate: "2026-02-04" as GameDate }],
        schoolId,
        "2026-04-01" as GameDate,
      ),
    ).toBe(true);
    expect(
      helper(
        [{ schoolId, surfacedDate: "2026-02-03" as GameDate }],
        schoolId,
        "2026-04-01" as GameDate,
      ),
    ).toBe(false);
  });

  it("lets eligible rivalry context alter the deterministic incoming-offer pool", () => {
    const neutral = setCanonicalOfferHistory(
      equalizeSchoolStrengths(eliteState()),
      [],
    );
    const opponentIds = Object.keys(neutral.schools)
      .filter((schoolId) => schoolId !== neutral.userSchoolId)
      .sort() as SchoolId[];
    const rivalId = opponentIds.at(-1)!;

    neutral.world = {
      ...neutral.world,
      rivalryScores: {},
      destinyRivalSchoolId: null,
    };
    const neutralOffers = offerIdsAcrossApril(neutral);
    expect(neutralOffers).not.toContain(rivalId);

    const rivalryAware = structuredClone(neutral);
    rivalryAware.world = {
      ...rivalryAware.world,
      rivalryScores: {
        [rivalryKey(rivalryAware.userSchoolId, rivalId)]: 100,
      },
      destinyRivalSchoolId: rivalId,
    };
    const rivalryOffers = offerIdsAcrossApril(rivalryAware);

    expect(
      rivalryOffers.filter((schoolId) => schoolId === rivalId).length,
    ).toBeGreaterThan(
      neutralOffers.filter((schoolId) => schoolId === rivalId).length,
    );
  });

  it("keeps a recently surfaced destiny rival blocked while alternatives exist", () => {
    const state = equalizeSchoolStrengths(eliteState());
    const rivalId = Object.keys(state.schools)
      .filter((schoolId) => schoolId !== state.userSchoolId)
      .sort()
      .at(-1)! as SchoolId;
    state.world = {
      ...state.world,
      rivalryScores: { [rivalryKey(state.userSchoolId, rivalId)]: 100 },
      destinyRivalSchoolId: rivalId,
    };
    const withRecentRival = setCanonicalOfferHistory(state, [
      { schoolId: rivalId, surfacedDate: "2026-03-20" as GameDate },
    ]);

    expect(offerIdsAcrossApril(withRecentRival)).not.toContain(rivalId);
  });
});
