import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  resolveCharacterVisual,
  resolveJerseyNumber,
  resolveSchoolVisualTheme,
} from "../../../../src/domain/appearance/characterWorld";
import type { Player } from "../../../../src/domain/model/Player";
import type { School } from "../../../../src/domain/model/School";

function featuredFixture(schoolName: string, playerName: string) {
  const state = createDemoGame();
  const school = Object.values(state.schools).find(
    (candidate) => candidate.name === schoolName,
  );
  if (!school) {
    throw new Error(`${schoolName} must exist`);
  }
  const player = school.playerIds
    .map((id) => state.players[id])
    .find(
      (candidate) =>
        candidate &&
        `${candidate.lastName} ${candidate.firstName}` === playerName,
    );
  if (!player) {
    throw new Error(`${playerName} must exist`);
  }
  return { school, player };
}

describe("character world visual resolver", () => {
  it("resolves the featured setter with his signature identity", () => {
    const { school, player } = featuredFixture("青嵐高校", "瀬戸 蒼真");

    expect(resolveCharacterVisual(player, school)).toMatchObject({
      characterId: "seto-soma",
      jerseyNumber: 7,
      roleLabel: "司令塔",
      eyeColor: "#79C7E8",
      hairColor: "#101A30",
      schoolMotif: "wave",
    });
  });

  it.each([
    ["青嵐高校", "wave"],
    ["烏峰高校", "wing"],
    ["紅耀高校", "fortress"],
    ["白凪高校", "mist"],
  ] as const)("maps %s to the %s motif", (schoolName, motif) => {
    const state = createDemoGame();
    const school = Object.values(state.schools).find(
      (candidate) => candidate.name === schoolName,
    );

    expect(school).toBeDefined();
    expect(resolveSchoolVisualTheme(school!)).toMatchObject({ motif });
  });

  it("resolves every signature player to a fixed jersey number", () => {
    const fixtures = [
      ["青嵐高校", "瀬戸 蒼真", 7],
      ["烏峰高校", "黒羽 隼斗", 10],
      ["紅耀高校", "火神 蓮", 1],
      ["白凪高校", "白間 湊", 13],
    ] as const;

    for (const [schoolName, playerName, jerseyNumber] of fixtures) {
      const { player } = featuredFixture(schoolName, playerName);
      expect(resolveJerseyNumber(player)).toBe(jerseyNumber);
    }
  });

  it("keeps generated player visuals deterministic", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId] as School;
    const featured = school.playerIds
      .map((id) => state.players[id])
      .find((player) => player?.lastName === "瀬戸");
    const generic = school.playerIds
      .map((id) => state.players[id])
      .find((player) => player && player.id !== featured?.id) as Player;
    const clone: Player = structuredClone(generic);

    expect(resolveCharacterVisual(generic, school)).toEqual(
      resolveCharacterVisual(clone, school),
    );
    expect(resolveJerseyNumber(generic)).toBeGreaterThanOrEqual(1);
    expect(resolveJerseyNumber(generic)).toBeLessThanOrEqual(18);
  });
});
