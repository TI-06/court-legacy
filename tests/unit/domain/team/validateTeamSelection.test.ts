import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import type { TeamSelection } from "../../../../src/domain/model/TeamSelection";
import { validateTeamSelection } from "../../../../src/domain/team/validateTeamSelection";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;
const userSchool = {
  name: "蒼波高校",
  shortName: "蒼波",
  regionId: "region.test",
  coachName: "高城 監督",
  uniform: {
    primary: "#173B52",
    secondary: "#F4F7F8",
    accent: "#D89A2B",
  },
};

function createContext() {
  const state = generateWorld({
    seed: "selection-validation",
    userSchool,
    data,
  });
  const school = state.schools[state.userSchoolId]!;
  const ids = school.playerIds;
  const selection: TeamSelection = {
    rotation: ids.slice(0, 6).map((playerId, index) => ({
      slot: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
      playerId,
    })),
    liberoPlayerId: ids[6]!,
    benchPlayerIds: ids.slice(7),
    servingOrderPlayerIds: ids.slice(0, 6),
    substitutionPolicy: {
      starterLockPlayerIds: [ids[0]!],
      allowFatigueBenching: true,
      allowInjuryBenching: true,
      automaticSubstitutions: true,
      automaticSetChanges: false,
    },
  };

  return { state, school, ids, selection };
}

describe("validateTeamSelection", () => {
  it("accepts a complete non-overlapping school selection", () => {
    const { state, school, selection } = createContext();

    expect(
      validateTeamSelection({ state, schoolId: school.id, selection }),
    ).toEqual([]);
  });

  it("reports missing and duplicate rotation slots", () => {
    const { state, school, selection } = createContext();
    selection.rotation = [
      ...selection.rotation.slice(0, 5),
      { slot: 5, playerId: selection.rotation[5]!.playerId },
    ];

    const issues = validateTeamSelection({
      state,
      schoolId: school.id,
      selection,
    });

    expect(issues.map((issue) => issue.code)).toContain("invalid-slot");
  });

  it("reports duplicate rotation players", () => {
    const { state, school, selection } = createContext();
    selection.rotation[1] = {
      ...selection.rotation[1]!,
      playerId: selection.rotation[0]!.playerId,
    };

    const issues = validateTeamSelection({
      state,
      schoolId: school.id,
      selection,
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "duplicate-player",
        playerId: selection.rotation[0]!.playerId,
      }),
    );
  });

  it("reports libero and bench overlap", () => {
    const { state, school, selection } = createContext();
    selection.liberoPlayerId = selection.rotation[0]!.playerId;
    selection.benchPlayerIds = [
      selection.rotation[1]!.playerId,
      selection.rotation[1]!.playerId,
    ];

    const issues = validateTeamSelection({
      state,
      schoolId: school.id,
      selection,
    });
    const codes = issues.map((issue) => issue.code);

    expect(codes).toContain("libero-in-rotation");
    expect(codes).toContain("bench-overlap");
    expect(codes).toContain("duplicate-bench-player");
  });

  it("reports a serving order that does not match the rotation", () => {
    const { state, school, ids, selection } = createContext();
    selection.servingOrderPlayerIds = [
      ...selection.servingOrderPlayerIds.slice(0, 5),
      ids[8]!,
    ];

    const issues = validateTeamSelection({
      state,
      schoolId: school.id,
      selection,
    });

    expect(issues.map((issue) => issue.code)).toContain(
      "serving-order-mismatch",
    );
  });

  it("reports players that do not belong to the school", () => {
    const { state, school, selection } = createContext();
    const rival = Object.values(state.schools).find(
      (candidate) => candidate.id !== school.id,
    )!;
    const outsiderId = rival.playerIds[0]!;
    selection.rotation[0] = {
      ...selection.rotation[0]!,
      playerId: outsiderId,
    };

    const issues = validateTeamSelection({
      state,
      schoolId: school.id,
      selection,
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "player-not-in-school",
        playerId: outsiderId,
      }),
    );
  });

  it("reports unknown player IDs and invalid starter locks", () => {
    const { state, school, selection } = createContext();
    const unknownId = "player-missing" as PlayerId;
    selection.benchPlayerIds = [unknownId];
    selection.substitutionPolicy.starterLockPlayerIds = [
      selection.rotation[0]!.playerId,
      "player-not-selected" as PlayerId,
    ];

    const issues = validateTeamSelection({
      state,
      schoolId: school.id,
      selection,
    });
    const codes = issues.map((issue) => issue.code);

    expect(codes).toContain("unknown-player");
    expect(codes).toContain("invalid-starter-lock");
  });

  it("does not mutate the supplied selection", () => {
    const { state, school, selection } = createContext();
    const snapshot = structuredClone(selection);

    validateTeamSelection({ state, schoolId: school.id, selection });

    expect(selection).toEqual(snapshot);
  });
});
