import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import { loadGameData } from "../../../../src/data/dataRegistry";
import { rawGameData } from "../../../../src/data/rawGameData";
import { resolveEventChoice } from "../../../../src/domain/events/resolveEventChoice";
import { eventId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import type { EventDefinition } from "../../../../src/domain/validation/gameDataSchema";

const baseData = loadGameData(rawGameData);

function createState() {
  const state = createInitialGame({
    seed: "phase21-event-discovery",
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
  for (const player of Object.values(state.players)) {
    player.hiddenTraitIds = [];
    player.revealedHiddenTraitIds = [];
    player.hiddenTraitAssignmentInitialized = true;
  }
  return state;
}

describe("Phase21 event-tag character trait discovery", () => {
  it("reveals an assigned event-tag trait from the resolved event context", () => {
    const state = createState();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    player.hiddenTraitIds = ["character.analytical"];
    player.revealedHiddenTraitIds = [];
    player.career.appearances = 0;

    const event: EventDefinition = {
      id: "event.phase21-analysis-reveal",
      version: 1,
      category: "individual",
      title: "映像分析",
      bodyTemplate: "映像を見返した。",
      tags: ["analysis"],
      trigger: {},
      weight: 1,
      cooldownWeeks: 0,
      oncePerCareer: false,
      actorCount: 1,
      choices: [
        {
          id: "observe",
          label: "分析する",
          detail: "映像を確認する",
          effects: [{ type: "trust-change", amount: 0 }],
        },
        {
          id: "skip",
          label: "切り上げる",
          detail: "今日はここまでにする",
          effects: [{ type: "morale-change", amount: 0 }],
        },
      ],
    };
    const data = {
      ...baseData,
      events: new Map([...baseData.events, [event.id, event]]),
    };
    state.pendingEvent = {
      eventId: eventId(event.id),
      actorPlayerIds: [playerId],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: event.choices.map((choice) => choice.id),
      chainId: null,
      chainStage: null,
    };

    const result = resolveEventChoice(
      state,
      "observe",
      data,
      new SeededRandom(state.seed, state.randomCursor),
    );

    expect(result.characterTraitDiscoveries).toEqual([
      { playerId, traitId: "character.analytical" },
    ]);
    expect(result.state.players[playerId]!.revealedHiddenTraitIds).toEqual([
      "character.analytical",
    ]);
    expect(result.occurrence.visibleResultCodes).not.toContain(
      "character.analytical",
    );
  });
});
