import { createDemoGame } from "../../../src/app/createDemoGame";
import { CURRENT_GAME_SCHEMA_VERSION } from "../../../src/domain/model/GameState";
import { matchId, type GameDate } from "../../../src/domain/model/identifiers";
import { startMatch } from "../../../src/domain/match/simulateMatch";
import { SeededRandom } from "../../../src/domain/random/SeededRandom";
import { selectPracticeOpponent } from "../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

describe("game state codec", () => {
  it("round-trips the complete game state without changing values", () => {
    const state = createDemoGame();

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded).toEqual(state);
    expect(decoded).not.toBe(state);
  });

  it("round-trips Phase52 active-match opponent targets for reload recovery", () => {
    const state = createDemoGame();
    const opponent = selectPracticeOpponent(state);
    const homeSelection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });
    const awaySelection = autoSelectTeam({
      state,
      schoolId: opponent.id,
    });
    const started = startMatch({
      state,
      id: matchId("phase52-codec-target"),
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      homeSelection,
      awaySelection,
      bestOfSets: 3,
      random: new SeededRandom("phase52-codec-target"),
      controlledSchoolId: state.userSchoolId,
    });
    if (!started.match.runtime) throw new Error("match runtime missing");
    const serveTargetId = awaySelection.rotation[0]!.playerId;
    const blockTargetId = awaySelection.rotation
      .map((assignment) => assignment.playerId)
      .find((playerId) => {
        const position = state.players[playerId]?.preferredPosition;
        return position === "OH" || position === "MB" || position === "OP";
      });
    if (!blockTargetId) throw new Error("block target fixture missing");

    started.match.runtime.serveTarget = {
      schoolId: state.userSchoolId,
      playerId: serveTargetId,
      ralliesRemaining: 4,
    };
    started.match.runtime.blockTarget = {
      schoolId: state.userSchoolId,
      playerId: blockTargetId,
      ralliesRemaining: 3,
    };
    state.activeMatch = started.match;

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.activeMatch?.runtime?.serveTarget).toEqual({
      schoolId: state.userSchoolId,
      playerId: serveTargetId,
      ralliesRemaining: 4,
    });
    expect(decoded.activeMatch?.runtime?.blockTarget).toEqual({
      schoolId: state.userSchoolId,
      playerId: blockTargetId,
      ralliesRemaining: 3,
    });
  });

  it("round-trips a training-result notification", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const withNotification = {
      ...state,
      notifications: {
        items: [
          {
            id: "training-result:school-user:1:1:2026-04-01",
            type: "training-result" as const,
            createdGameDate: "2026-04-01" as GameDate,
            academicYearIndex: 1,
            weekOfYear: 1,
            readAtGameDate: null,
            payload: {
              teamTrainingMenuName: "基礎練習",
              totalAbilityGrowth: 3,
              totalFatigueChange: 5,
              injuredCount: 0,
              players: [
                {
                  playerId,
                  displayName: `${player.lastName} ${player.firstName}`,
                  grade: player.grade,
                  preferredPosition: player.preferredPosition,
                  totalAbilityGrowth: 3,
                  fatigueChange: 5,
                  conditionChange: 0,
                  trustChange: 1,
                  injured: false,
                  abilityChanges: { jump: 1 },
                  rankUps: [
                    {
                      area: "jump" as const,
                      areaLabel: "跳躍",
                      fromGrade: "E" as const,
                      toGrade: "D" as const,
                    },
                  ],
                  socialGrowth: {
                    contributions: [],
                    rawPercentPoints: 0,
                    appliedPercentPoints: 0,
                    capped: false,
                  },
                },
              ],
            },
          },
        ],
      },
    };

    const decoded = decodeGameState(encodeGameState(withNotification));

    expect(decoded.notifications.items).toEqual(
      withNotification.notifications.items,
    );
  });

  it("round-trips a development-goal achievement notification", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.notifications.items = [
      {
        id: "development-goal-achieved:test",
        type: "development-goal-achieved",
        createdGameDate: state.date,
        academicYearIndex: state.yearIndex,
        weekOfYear: state.calendar.weekOfYear,
        readAtGameDate: null,
        payload: {
          items: [
            {
              playerId,
              displayName: "山田 太郎",
              area: "jump",
              areaLabel: "跳躍",
              targetGrade: "D",
              achievedGrade: "D",
            },
          ],
        },
      },
    ];

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.notifications.items).toEqual(state.notifications.items);
  });

  it("round-trips a season-goal achievement notification", () => {
    const state = createDemoGame();
    state.notifications.items = [
      {
        id: "season-goal-achieved:test",
        type: "season-goal-achieved",
        createdGameDate: state.date,
        academicYearIndex: state.yearIndex,
        weekOfYear: state.calendar.weekOfYear,
        readAtGameDate: null,
        payload: {
          items: [
            {
              goalId: "season:1:official-wins",
              label: "公式戦2勝",
              rewardFunds: 100,
            },
          ],
          totalRewardFunds: 100,
        },
      },
    ];

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.notifications.items).toEqual(state.notifications.items);
  });

  it("rejects malformed notification payloads", () => {
    const state = createDemoGame();

    expect(() =>
      decodeGameState(
        JSON.stringify({
          ...state,
          notifications: {
            items: [
              {
                id: "training-result:school-user:1:1:2026-04-01",
                type: "training-result",
                createdGameDate: "2026-04-01",
                academicYearIndex: 1,
                weekOfYear: 1,
                readAtGameDate: null,
                payload: {
                  teamTrainingMenuName: "基礎練習",
                  totalAbilityGrowth: "client-defined",
                  totalFatigueChange: 5,
                  injuredCount: 0,
                  players: [],
                },
              },
            ],
          },
        }),
      ),
    ).toThrow("セーブデータの形式が正しくありません");
  });

  it("round-trips a pending one-use shop training boost", () => {
    const state = createDemoGame();
    const withBoost = {
      ...state,
      shopEffects: {
        nextTrainingGrowthBoost: {
          percent: 20 as const,
          remainingUses: 1 as const,
          sourceItemId: "training-efficiency-boost" as const,
        },
      },
    };

    const decoded = decodeGameState(encodeGameState(withBoost));

    expect(decoded.shopEffects?.nextTrainingGrowthBoost).toEqual({
      percent: 20,
      remainingUses: 1,
      sourceItemId: "training-efficiency-boost",
    });
  });

  it("round-trips scheduled and completed training camp shop effects", () => {
    const state = createDemoGame();
    state.shopEffects = {
      pendingTrainingCamp: {
        sourceItemId: "training-camp",
        scheduledDate: state.date,
      },
      trainingCampResult: {
        sourceItemId: "training-camp",
        scheduledDate: state.date,
        participantCount: 15,
        grewPlayerCount: 13,
        totalAbilityGrowth: 41,
        topGrowth: [
          {
            playerId: state.schools[state.userSchoolId]!.playerIds[0]!,
            totalAbilityGrowth: 5,
            abilityChanges: { spike: 3, jump: 2 },
          },
        ],
        averageFatigueChange: 11.2,
        injuredPlayerIds: [],
        specialAbilityChanges: [],
      },
    };

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.shopEffects).toEqual(state.shopEffects);
  });

  it("rejects malformed pending shop effects instead of accepting arbitrary values", () => {
    const state = createDemoGame();

    expect(() =>
      decodeGameState(
        JSON.stringify({
          ...state,
          shopEffects: {
            nextTrainingGrowthBoost: {
              percent: 99,
              remainingUses: 4,
              sourceItemId: "client-defined-boost",
            },
          },
        }),
      ),
    ).toThrow("セーブデータの形式が正しくありません");
  });

  it("round-trips compact special abilities and repairs saves that predate them", () => {
    const state = structuredClone(createDemoGame());
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    player.specialAbilityIds = ["serve_stable", "mental_clutch"];
    player.specialAbilityTipLevels = { attack_course: 2 };

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.players[playerId]!.specialAbilityIds).toEqual([
      "serve_stable",
      "mental_clutch",
    ]);
    expect(decoded.players[playerId]!.specialAbilityTipLevels).toEqual({
      attack_course: 2,
    });

    const legacyShape = structuredClone(state);
    delete legacyShape.players[playerId]!.specialAbilityIds;
    delete legacyShape.players[playerId]!.specialAbilityTipLevels;
    const repaired = decodeGameState(JSON.stringify(legacyShape));

    expect(repaired.players[playerId]!.specialAbilityIds).toEqual([]);
    expect(repaired.players[playerId]!.specialAbilityTipLevels).toEqual({});
  });

  it("migrates v9 special ability tips into learned abilities without losing progress", () => {
    const legacy = structuredClone(createDemoGame());
    const playerId = legacy.schools[legacy.userSchoolId]!.playerIds[0]!;
    legacy.schemaVersion = 9;
    legacy.players[playerId]!.specialAbilityIds = [
      "serve_unstable",
      "mental_clutch",
    ];
    legacy.players[playerId]!.specialAbilityTipLevels = {
      serve_stable: 1,
      attack_course: 2,
    };

    const migrated = decodeGameState(JSON.stringify(legacy));
    const player = migrated.players[playerId]!;

    expect(migrated.schemaVersion).toBe(CURRENT_GAME_SCHEMA_VERSION);
    expect(player.specialAbilityIds).toEqual([
      "mental_clutch",
      "attack_course",
      "serve_stable",
    ]);
    expect(player.specialAbilityTipLevels).toEqual({});
  });

  it("repairs current-schema players that predate revealed hidden trait persistence", () => {
    const state = structuredClone(createDemoGame());
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;

    delete player.revealedHiddenTraitIds;
    player.hiddenTraitAssignmentInitialized = true;

    const decoded = decodeGameState(JSON.stringify(state));

    expect(decoded.schemaVersion).toBe(CURRENT_GAME_SCHEMA_VERSION);
    expect(decoded.players[playerId]!.revealedHiddenTraitIds).toEqual([]);
    expect(decoded.players[playerId]!.hiddenTraitAssignmentInitialized).toBe(
      true,
    );
  });

  it("rejects corrupted JSON instead of returning a partial state", () => {
    expect(() => decodeGameState('{"schemaVersion":1')).toThrow(
      "セーブデータを読み取れません",
    );
  });

  it("migrates a legacy unversioned state to the current schema", () => {
    const current = createDemoGame();
    const legacy = {
      ...current,
      schemaVersion: 0,
      settings: {
        matchDisplayMode: current.settings.matchDisplayMode,
        matchPlaybackSpeed: current.settings.matchPlaybackSpeed,
        reducedMotion: current.settings.reducedMotion,
      },
    };

    const migrated = decodeGameState(JSON.stringify(legacy));

    expect(migrated.schemaVersion).toBe(current.schemaVersion);
    expect(migrated.settings.autosaveEnabled).toBe(true);
    expect(migrated.settings.confirmBeforeOfficialMatch).toBe(true);
  });

  it("migrates v6 funds into the current schema without paying the current-year budget again", () => {
    const current = structuredClone(createDemoGame());
    const { schoolManagement, ...legacy } = current;
    expect(schoolManagement).toBeDefined();
    legacy.schemaVersion = 6;
    legacy.schools[legacy.userSchoolId]!.funds = 777;

    const migrated = decodeGameState(JSON.stringify(legacy));

    expect(migrated.schemaVersion).toBe(CURRENT_GAME_SCHEMA_VERSION);
    expect(migrated.schools[migrated.userSchoolId]!.funds).toBe(777);
    expect(migrated.schoolManagement).toEqual({
      assistantCoach: null,
      fundsHistory: [],
      lastAnnualBudgetYearIndex: legacy.yearIndex,
    });
  });

  it("rejects malformed funds ledger entries", () => {
    const state = createDemoGame();

    expect(() =>
      decodeGameState(
        JSON.stringify({
          ...state,
          schoolManagement: {
            ...state.schoolManagement,
            fundsHistory: [
              {
                id: "bad-entry",
                gameDate: state.date,
                academicYearIndex: state.yearIndex,
                kind: "shop-grant",
                amount: 300,
                balanceAfter: -1,
                label: "invalid",
              },
            ],
          },
        }),
      ),
    ).toThrow("セーブデータの形式が正しくありません");
  });

  it("rejects a future schema version", () => {
    const state = createDemoGame();

    expect(() =>
      decodeGameState(
        JSON.stringify({ ...state, schemaVersion: state.schemaVersion + 1 }),
      ),
    ).toThrow("新しいバージョンのセーブデータです");
  });

  it("round-trips development goals while accepting saves that predate the optional field", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.teamPlanning.developmentGoalsByPlayerId = {
      [playerId]: { area: "mental", targetGrade: "S" },
    };

    const decoded = decodeGameState(encodeGameState(state));
    expect(decoded.teamPlanning.developmentGoalsByPlayerId?.[playerId]).toEqual(
      {
        area: "mental",
        targetGrade: "S",
      },
    );

    const legacyShape = structuredClone(state);
    delete legacyShape.teamPlanning.developmentGoalsByPlayerId;
    expect(decodeGameState(JSON.stringify(legacyShape)).teamPlanning).toEqual(
      legacyShape.teamPlanning,
    );
  });
  it("round-trips optional season ambition while accepting the legacy season-goal shape", () => {
    const state = createDemoGame();
    state.seasonGoals = {
      ...state.seasonGoals!,
      ambition: "bold",
      ambitionSelectionPending: true,
    };

    const decoded = decodeGameState(encodeGameState(state));
    expect(decoded.seasonGoals).toMatchObject({
      ambition: "bold",
      ambitionSelectionPending: true,
    });

    const legacy = structuredClone(state);
    delete legacy.seasonGoals!.ambition;
    delete legacy.seasonGoals!.ambitionSelectionPending;
    expect(decodeGameState(JSON.stringify(legacy)).seasonGoals).toEqual(
      legacy.seasonGoals,
    );
  });

  it("round-trips scouting search counters in recruiting state", () => {
    const state = createDemoGame();
    const cycleKey = `${state.userSchoolId}:year-${state.yearIndex}`;
    state.recruiting = {
      cycleKey,
      committedCandidateIds: [],
      visitActionsUsed: 0,
      recommendationUsed: false,
      scoutingSearchesUsed: 3,
      extraScoutingSearchCredits: 2,
      candidateEngagements: {},
    };

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.recruiting).toEqual(state.recruiting);
  });

  it("round-trips optional recruiting engagement while accepting the legacy recruiting shape", () => {
    const state = createDemoGame();
    const candidateId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const cycleKey = `${state.userSchoolId}:year-${state.yearIndex}`;
    state.recruiting = {
      cycleKey,
      committedCandidateIds: [],
      visitActionsUsed: 2,
      recommendationUsed: true,
      candidateEngagements: {
        [candidateId]: {
          interestBonus: 36,
          visits: 1,
          recommendationUsed: true,
        },
      },
    };

    expect(decodeGameState(encodeGameState(state)).recruiting).toEqual(
      state.recruiting,
    );

    const legacy = structuredClone(state);
    legacy.recruiting = {
      cycleKey,
      committedCandidateIds: [],
    };
    expect(decodeGameState(JSON.stringify(legacy)).recruiting).toEqual(
      legacy.recruiting,
    );
  });
});
