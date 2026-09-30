import { createSoakSnapshot } from "../../../src/dev/soak/runBalanceSoak";
import {
  captureSoakSnapshotMetrics,
  formatSoakSnapshotSummary,
} from "../../../src/dev/soak/soakMetrics";

describe("Phase50 special ability soak metrics", () => {
  it("counts only the current user roster by rarity", () => {
    const snapshot = createSoakSnapshot("phase50-special-metrics");
    const state = snapshot.state;
    const school = state.schools[state.userSchoolId]!;
    const playerIds = school.playerIds;

    for (const playerId of playerIds) {
      state.players[playerId] = {
        ...state.players[playerId]!,
        specialAbilityIds: [],
      };
    }

    state.players[playerIds[0]!]!.specialAbilityIds = [
      "attack_course",
      "serve_unstable",
    ];
    state.players[playerIds[1]!]!.specialAbilityIds = ["elite_game_maker"];
    state.players[playerIds[2]!]!.specialAbilityIds = ["gold_court_brain"];

    const metrics = captureSoakSnapshotMetrics(snapshot);

    expect(metrics.userSpecialAbilities).toMatchObject({
      rosterPlayers: playerIds.length,
      normal: 1,
      rare: 1,
      superRare: 1,
      negative: 1,
      playersWithRare: 1,
      playersWithSuperRare: 1,
      playersWithNegative: 1,
    });
    expect(metrics.userSpecialAbilities.perPlayer.count).toBe(playerIds.length);
    expect(metrics.userSpecialAbilities.perPlayer.max).toBe(2);
    expect(formatSoakSnapshotSummary(metrics)).toContain(
      "special=N1/R1/SR1/NEG1",
    );
  });
});
