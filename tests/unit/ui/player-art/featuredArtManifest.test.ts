import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { Player } from "../../../../src/domain/model/Player";
import type { School } from "../../../../src/domain/model/School";
import {
  FEATURED_ART_VARIANTS,
  resolveFeaturedArtUrl,
} from "../../../../src/ui/player-art/featuredArtManifest";

function featuredPlayers(): Array<{ player: Player; school: School }> {
  const state = createDemoGame();
  const names = new Set([
    "黒羽 隼斗",
    "瀬戸 蒼真",
    "火神 蓮",
    "白間 湊",
  ]);

  return Object.values(state.players)
    .filter((player) => names.has(`${player.lastName} ${player.firstName}`))
    .map((player) => ({
      player,
      school: state.schools[player.career.schoolId]!,
    }));
}

describe("featured player art manifest", () => {
  it("resolves every required WebP variant for the four featured players", () => {
    const players = featuredPlayers();

    expect(players).toHaveLength(4);
    for (const { player, school } of players) {
      for (const variant of FEATURED_ART_VARIANTS) {
        expect(resolveFeaturedArtUrl(player, school, variant)).toMatch(
          /\.webp(?:\?.*)?$/,
        );
      }
    }
  });

  it("returns null for a generated player", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const featuredIds = new Set(featuredPlayers().map(({ player }) => player.id));
    const player = school.playerIds
      .map((playerId) => state.players[playerId])
      .find((candidate) => candidate && !featuredIds.has(candidate.id));

    expect(player).toBeDefined();
    expect(resolveFeaturedArtUrl(player!, school, "full")).toBeNull();
  });
});
