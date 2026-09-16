import { createInitialGame } from "../../../../src/app/createInitialGame";
import { loadGameData } from "../../../../src/data/dataRegistry";
import { rawGameData } from "../../../../src/data/rawGameData";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import { discoverEligibleCharacterTraits } from "../../../../src/domain/player/characterTraitDiscovery";

const data = loadGameData(rawGameData);

function createState() {
  const state = createInitialGame({
    seed: "phase21-character-discovery",
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

function assignOnly(
  state: ReturnType<typeof createState>,
  playerId: PlayerId,
  traitId: string,
) {
  const player = state.players[playerId]!;
  player.hiddenTraitIds = [traitId];
  player.revealedHiddenTraitIds = [];
  return player;
}

function userPlayerIds(state: ReturnType<typeof createState>) {
  return state.schools[state.userSchoolId]!.playerIds;
}

describe("Phase21 character trait discovery", () => {
  it("discovers trust-min exactly at the configured boundary", () => {
    const state = createState();
    const playerId = userPlayerIds(state)[0]!;
    const player = assignOnly(state, playerId, "character.training-lover");
    player.trust = 64;
    const below = discoverEligibleCharacterTraits(state, data);
    expect(below.discoveries).toEqual([]);
    below.state.players[playerId]!.trust = 65;
    const atBoundary = discoverEligibleCharacterTraits(below.state, data);
    expect(atBoundary.discoveries).toEqual([
      { playerId, traitId: "character.training-lover" },
    ]);
    expect(atBoundary.state.players[playerId]!.revealedHiddenTraitIds).toEqual([
      "character.training-lover",
    ]);
  });

  it("discovers appearances-min exactly at the configured boundary", () => {
    const state = createState();
    const playerId = userPlayerIds(state)[0]!;
    const player = assignOnly(state, playerId, "character.resilient");
    player.career.appearances = 5;
    expect(discoverEligibleCharacterTraits(state, data).discoveries).toEqual(
      [],
    );
    player.career.appearances = 6;
    expect(discoverEligibleCharacterTraits(state, data).discoveries).toEqual([
      { playerId, traitId: "character.resilient" },
    ]);
  });

  it("discovers captaincy for captain or vice captain", () => {
    const state = createState();
    const [captainId, viceCaptainId] = userPlayerIds(state);
    const captain = assignOnly(state, captainId!, "character.spotlight");
    const viceCaptain = assignOnly(
      state,
      viceCaptainId!,
      "character.clutch-support",
    );
    captain.career.appearances = 0;
    viceCaptain.career.appearances = 0;
    const result = discoverEligibleCharacterTraits(state, data, {
      captainPlayerId: captainId,
      viceCaptainPlayerId: viceCaptainId,
    });
    expect(result.discoveries.map((item) => item.playerId).sort()).toEqual(
      [captainId, viceCaptainId].sort(),
    );
  });

  it("discovers a requested active special relationship kind", () => {
    const state = createState();
    const [leftId, rightId] = userPlayerIds(state);
    assignOnly(state, leftId!, "character.competitive-growth");
    const key = relationshipKey(leftId!, rightId!);
    state.playerRelationshipBonds[key] = {
      playerIds: [leftId!, rightId!].sort() as [PlayerId, PlayerId],
      tags: [
        {
          kind: "rival",
          establishedDate: state.date,
          sourceEventId: null,
          lastReinforcedDate: state.date,
          belowThresholdSince: null,
        },
      ],
    };
    expect(discoverEligibleCharacterTraits(state, data).discoveries).toEqual([
      { playerId: leftId, traitId: "character.competitive-growth" },
    ]);
  });

  it("discovers event-tag only when the current event supplies the configured tag", () => {
    const state = createState();
    const playerId = userPlayerIds(state)[0]!;
    const player = assignOnly(state, playerId, "character.analytical");
    player.career.appearances = 0;
    expect(discoverEligibleCharacterTraits(state, data).discoveries).toEqual(
      [],
    );
    expect(
      discoverEligibleCharacterTraits(state, data, {
        eventTags: ["analysis"],
      }).discoveries,
    ).toEqual([{ playerId, traitId: "character.analytical" }]);
  });

  it("does not rediscover revealed or unassigned traits and repairs the revealed subset invariant", () => {
    const state = createState();
    const [revealedId, unassignedId] = userPlayerIds(state);
    const revealed = assignOnly(state, revealedId!, "character.training-lover");
    revealed.trust = 100;
    revealed.revealedHiddenTraitIds = [
      "character.training-lover",
      "character.orphan",
    ];
    const unassigned = state.players[unassignedId!]!;
    unassigned.revealedHiddenTraitIds = ["character.orphan"];
    const result = discoverEligibleCharacterTraits(state, data);
    expect(result.discoveries).toEqual([]);
    expect(result.state.players[revealedId!]!.revealedHiddenTraitIds).toEqual([
      "character.training-lover",
    ]);
    expect(result.state.players[unassignedId!]!.revealedHiddenTraitIds).toEqual(
      [],
    );
  });

  it("orders simultaneous discoveries by player id then trait id", () => {
    const state = createState();
    const ids = userPlayerIds(state).slice(0, 2).sort();
    const first = assignOnly(state, ids[0]!, "character.training-lover");
    const second = assignOnly(state, ids[1]!, "character.team-first");
    first.trust = 100;
    second.trust = 100;
    const result = discoverEligibleCharacterTraits(state, data);
    expect(result.discoveries).toEqual([
      { playerId: ids[0], traitId: "character.training-lover" },
      { playerId: ids[1], traitId: "character.team-first" },
    ]);
  });
});
