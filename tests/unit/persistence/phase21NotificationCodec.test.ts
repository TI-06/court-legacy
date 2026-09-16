import { createDemoGame } from "../../../src/app/createDemoGame";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

describe("Phase21 notification codec", () => {
  it("round-trips relationship social growth metadata in training notifications", () => {
    const state = createDemoGame();
    const playerIds = state.schools[state.userSchoolId]!.playerIds;
    const playerId = playerIds[0]!;
    const relatedPlayerId = playerIds[1]!;
    const player = state.players[playerId]!;

    state.notifications.items = [
      {
        id: "training-result:phase21-social-growth",
        type: "training-result",
        createdGameDate: state.date,
        academicYearIndex: state.yearIndex,
        weekOfYear: state.calendar.weekOfYear,
        readAtGameDate: null,
        payload: {
          teamTrainingMenuName: "基礎練習",
          totalAbilityGrowth: 1,
          totalFatigueChange: 0,
          injuredCount: 0,
          players: [
            {
              playerId,
              displayName: `${player.lastName} ${player.firstName}`,
              grade: player.grade,
              preferredPosition: player.preferredPosition,
              totalAbilityGrowth: 1,
              fatigueChange: 0,
              conditionChange: 0,
              trustChange: 0,
              injured: false,
              abilityChanges: {},
              socialGrowth: {
                contributions: [
                  {
                    code: "relationship-partner",
                    label: "相棒",
                    percentPoints: 3,
                    relatedPlayerId,
                  },
                ],
                rawPercentPoints: 3,
                appliedPercentPoints: 3,
                capped: false,
              },
            },
          ],
        },
      },
    ];

    expect(decodeGameState(encodeGameState(state)).notifications).toEqual(
      state.notifications,
    );
  });

  it("round-trips character trait discovery notifications", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;

    state.notifications.items = [
      {
        id: "character-trait-discovered:phase21",
        type: "character-trait-discovered",
        createdGameDate: state.date,
        academicYearIndex: state.yearIndex,
        weekOfYear: state.calendar.weekOfYear,
        readAtGameDate: null,
        payload: {
          playerId,
          displayName: `${player.lastName} ${player.firstName}`,
          traitId: "character.caring",
          traitName: "面倒見がいい",
          description: "仲間への気配りが自然にできる。",
        },
      },
    ];

    expect(decodeGameState(encodeGameState(state)).notifications).toEqual(
      state.notifications,
    );
  });
});
