import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import type { Player } from "../../../../src/domain/model/Player";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import {
  autoSelectTeam,
  resolveLockedStarters,
} from "../../../../src/domain/team/autoSelectTeam";
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

function createState(seed = "auto-selection") {
  return generateWorld({ seed, userSchool, data });
}

function setRole(player: Player, role: Player["preferredPosition"], score: number): Player {
  return {
    ...player,
    preferredPosition: role,
    positionAptitudes: {
      OH: 20,
      MB: 20,
      OP: 20,
      S: 20,
      L: 20,
      [role]: score,
    },
    abilities: {
      spike: score,
      jump: score,
      receive: score,
      serve: score,
      set: score,
      block: score,
      speed: score,
      stamina: score,
      decision: score,
      mental: score,
    },
    fatigue: 0,
    condition: 100,
    injury: null,
  };
}

function prepareRoleRoster() {
  const state = createState("role-roster");
  const school = state.schools[state.userSchoolId]!;
  const roles: Player["preferredPosition"][] = [
    "S",
    "MB",
    "MB",
    "OH",
    "OH",
    "OP",
    "L",
    "S",
    "MB",
    "OH",
    "OP",
    "L",
  ];

  school.playerIds.forEach((playerId, index) => {
    state.players[playerId] = setRole(
      state.players[playerId]!,
      roles[index]!,
      95 - index,
    );
  });

  return { state, school };
}

describe("autoSelectTeam", () => {
  it("creates a valid six-player rotation, libero, bench, and serving order", () => {
    const { state, school } = prepareRoleRoster();
    const selection = autoSelectTeam({ state, schoolId: school.id });

    expect(selection.rotation).toHaveLength(6);
    expect(selection.liberoPlayerId).not.toBeNull();
    expect(selection.benchPlayerIds).toHaveLength(5);
    expect(selection.servingOrderPlayerIds).toHaveLength(6);
    expect(
      validateTeamSelection({ state, schoolId: school.id, selection }),
    ).toEqual([]);
  });

  it("covers the standard volleyball roles in the rotation", () => {
    const { state, school } = prepareRoleRoster();
    const selection = autoSelectTeam({ state, schoolId: school.id });
    const roleCounts = selection.rotation.reduce<Record<string, number>>(
      (counts, assignment) => {
        const role = state.players[assignment.playerId]!.preferredPosition;
        counts[role] = (counts[role] ?? 0) + 1;
        return counts;
      },
      {},
    );

    expect(roleCounts.S).toBe(1);
    expect(roleCounts.MB).toBe(2);
    expect(roleCounts.OH).toBe(2);
    expect(roleCounts.OP).toBe(1);
    expect(selection.liberoPlayerId).toBe(school.playerIds[6]);
  });

  it("is deterministic for the same state", () => {
    const { state, school } = prepareRoleRoster();

    expect(autoSelectTeam({ state, schoolId: school.id })).toEqual(
      autoSelectTeam({ state: structuredClone(state), schoolId: school.id }),
    );
  });

  it("excludes injured players and severely fatigued players by default", () => {
    const { state, school } = prepareRoleRoster();
    const injuredId = school.playerIds[0]!;
    const exhaustedId = school.playerIds[1]!;
    state.players[injuredId] = {
      ...state.players[injuredId]!,
      injury: {
        injuryId: "injury.ankle",
        severity: "moderate",
        remainingWeeks: 3,
        recurrenceRisk: 20,
      },
    };
    state.players[exhaustedId] = {
      ...state.players[exhaustedId]!,
      fatigue: 90,
    };

    const selection = autoSelectTeam({ state, schoolId: school.id });
    const activeIds = new Set([
      ...selection.rotation.map((assignment) => assignment.playerId),
      selection.liberoPlayerId,
    ]);

    expect(activeIds.has(injuredId)).toBe(false);
    expect(activeIds.has(exhaustedId)).toBe(false);
  });

  it("throws when fewer than seven eligible players remain", () => {
    const { state, school } = prepareRoleRoster();

    school.playerIds.slice(0, 6).forEach((playerId) => {
      state.players[playerId] = {
        ...state.players[playerId]!,
        injury: {
          injuryId: "injury.test",
          severity: "severe",
          remainingWeeks: 8,
          recurrenceRisk: 30,
        },
      };
    });

    expect(() => autoSelectTeam({ state, schoolId: school.id })).toThrow(
      "team selection requires at least seven eligible players",
    );
  });
});

describe("resolveLockedStarters", () => {
  it("keeps eligible locked starters in the rotation", () => {
    const { state, school } = prepareRoleRoster();
    const lockedId = school.playerIds[8]!;
    const base = autoSelectTeam({ state, schoolId: school.id });
    const result = resolveLockedStarters({
      state,
      schoolId: school.id,
      selection: {
        ...base,
        substitutionPolicy: {
          ...base.substitutionPolicy,
          starterLockPlayerIds: [lockedId],
        },
      },
    });

    expect(result.selection.rotation.some((item) => item.playerId === lockedId)).toBe(
      true,
    );
    expect(result.replacements).toEqual([]);
  });

  it("benches an injured locked starter when injury exceptions are enabled", () => {
    const { state, school } = prepareRoleRoster();
    const base = autoSelectTeam({ state, schoolId: school.id });
    const lockedId = base.rotation[0]!.playerId;
    state.players[lockedId] = {
      ...state.players[lockedId]!,
      injury: {
        injuryId: "injury.shoulder",
        severity: "moderate",
        remainingWeeks: 4,
        recurrenceRisk: 25,
      },
    };

    const result = resolveLockedStarters({
      state,
      schoolId: school.id,
      selection: {
        ...base,
        substitutionPolicy: {
          ...base.substitutionPolicy,
          starterLockPlayerIds: [lockedId],
          allowInjuryBenching: true,
        },
      },
    });

    expect(result.selection.rotation.some((item) => item.playerId === lockedId)).toBe(
      false,
    );
    expect(result.replacements).toContainEqual(
      expect.objectContaining({ playerId: lockedId, reason: "injury" }),
    );
  });

  it("keeps an injured locked starter when injury exceptions are disabled", () => {
    const { state, school } = prepareRoleRoster();
    const base = autoSelectTeam({ state, schoolId: school.id });
    const lockedId = base.rotation[0]!.playerId;
    state.players[lockedId] = {
      ...state.players[lockedId]!,
      injury: {
        injuryId: "injury.shoulder",
        severity: "moderate",
        remainingWeeks: 4,
        recurrenceRisk: 25,
      },
    };

    const result = resolveLockedStarters({
      state,
      schoolId: school.id,
      selection: {
        ...base,
        substitutionPolicy: {
          ...base.substitutionPolicy,
          starterLockPlayerIds: [lockedId],
          allowInjuryBenching: false,
        },
      },
    });

    expect(result.selection.rotation.some((item) => item.playerId === lockedId)).toBe(
      true,
    );
  });

  it("benches a severely fatigued locked starter only when enabled", () => {
    const { state, school } = prepareRoleRoster();
    const base = autoSelectTeam({ state, schoolId: school.id });
    const lockedId = base.rotation[0]!.playerId;
    state.players[lockedId] = {
      ...state.players[lockedId]!,
      fatigue: 90,
    };

    const enabled = resolveLockedStarters({
      state,
      schoolId: school.id,
      selection: {
        ...base,
        substitutionPolicy: {
          ...base.substitutionPolicy,
          starterLockPlayerIds: [lockedId],
          allowFatigueBenching: true,
        },
      },
    });
    const disabled = resolveLockedStarters({
      state,
      schoolId: school.id,
      selection: {
        ...base,
        substitutionPolicy: {
          ...base.substitutionPolicy,
          starterLockPlayerIds: [lockedId],
          allowFatigueBenching: false,
        },
      },
    });

    expect(enabled.selection.rotation.some((item) => item.playerId === lockedId)).toBe(
      false,
    );
    expect(enabled.replacements).toContainEqual(
      expect.objectContaining({ playerId: lockedId, reason: "fatigue" }),
    );
    expect(disabled.selection.rotation.some((item) => item.playerId === lockedId)).toBe(
      true,
    );
  });

  it("does not mutate the supplied selection", () => {
    const { state, school } = prepareRoleRoster();
    const base = autoSelectTeam({ state, schoolId: school.id });
    const snapshot = structuredClone(base);

    resolveLockedStarters({ state, schoolId: school.id, selection: base });

    expect(base).toEqual(snapshot);
  });
});
