import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { gameData } from "../../../src/app/createDemoGame";
import {
  appendNotification,
  buildCharacterTraitDiscoveredNotification,
  selectHomeCharacterTraitNotifications,
} from "../../../src/domain/notifications/gameNotifications";

function createState() {
  return createInitialGame({
    seed: "phase21-trait-notification",
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
}

describe("Phase21 character trait discovery notifications", () => {
  it("builds player and trait display data from canonical state and registry", () => {
    const state = createState();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const trait = gameData.characterTraits.get("character.training-lover")!;
    const notification = buildCharacterTraitDiscoveredNotification(
      state,
      { playerId, traitId: trait.id },
      gameData,
    );
    expect(notification).toMatchObject({
      type: "character-trait-discovered",
      createdGameDate: state.date,
      academicYearIndex: state.yearIndex,
      weekOfYear: state.calendar.weekOfYear,
      readAtGameDate: null,
      payload: {
        playerId,
        displayName: `${player.lastName} ${player.firstName}`,
        traitId: trait.id,
        traitName: trait.name,
        description: trait.description,
      },
    });
  });

  it("retains only the newest discovery notification of this type", () => {
    const state = createState();
    const [firstPlayerId, secondPlayerId] =
      state.schools[state.userSchoolId]!.playerIds;
    const first = buildCharacterTraitDiscoveredNotification(
      state,
      { playerId: firstPlayerId!, traitId: "character.training-lover" },
      gameData,
    );
    const second = buildCharacterTraitDiscoveredNotification(
      state,
      { playerId: secondPlayerId!, traitId: "character.team-first" },
      gameData,
    );
    const once = appendNotification({ items: [] }, first);
    const twice = appendNotification(once, second);
    const duplicate = appendNotification(twice, second);
    expect(twice.items).toEqual([second]);
    expect(duplicate).toBe(twice);
    expect(selectHomeCharacterTraitNotifications(twice)).toEqual([second]);
  });
});
