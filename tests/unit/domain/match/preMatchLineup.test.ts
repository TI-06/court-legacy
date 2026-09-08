import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import {
  buildPreMatchLineupPreset,
  replacePreMatchPlayer,
} from "../../../../src/domain/match/preMatchLineup";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import type { TeamSelection } from "../../../../src/domain/model/TeamSelection";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { validateTeamSelection } from "../../../../src/domain/team/validateTeamSelection";

function fixture() {
  const state = createInitialGame({
    seed: "pre-match-lineup",
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
  const baseSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  return { state, baseSelection };
}

function activeIds(selection: TeamSelection): PlayerId[] {
  return [
    ...selection.rotation.map((assignment) => assignment.playerId),
    ...(selection.liberoPlayerId ? [selection.liberoPlayerId] : []),
  ];
}

function gradeCount(
  state: ReturnType<typeof createInitialGame>,
  selection: TeamSelection,
  grade: 1 | 2 | 3,
): number {
  return activeIds(selection).filter((id) => state.players[id]?.grade === grade)
    .length;
}

describe("pre-match lineup", () => {
  it.each([1, 2, 3] as const)(
    "builds a valid %s-year-focused lineup without mutating the saved lineup",
    (grade) => {
      const { state, baseSelection } = fixture();
      const before = JSON.stringify(baseSelection);

      const selected = buildPreMatchLineupPreset({
        state,
        schoolId: state.userSchoolId,
        baseSelection,
        preset: `grade-${grade}`,
      });

      expect(
        validateTeamSelection({
          state,
          schoolId: state.userSchoolId,
          selection: selected,
        }),
      ).toEqual([]);
      expect(activeIds(selected)).toHaveLength(7);
      expect(gradeCount(state, selected, grade)).toBeGreaterThanOrEqual(
        gradeCount(state, baseSelection, grade),
      );
      expect(JSON.stringify(baseSelection)).toBe(before);
    },
  );

  it("builds best and condition-priority lineups as valid match-only selections", () => {
    const { state, baseSelection } = fixture();

    for (const preset of ["best", "condition"] as const) {
      const selected = buildPreMatchLineupPreset({
        state,
        schoolId: state.userSchoolId,
        baseSelection,
        preset,
      });
      expect(
        validateTeamSelection({
          state,
          schoolId: state.userSchoolId,
          selection: selected,
        }),
      ).toEqual([]);
      expect(activeIds(selected)).toHaveLength(7);
    }
  });

  it("replaces a rotation player and keeps serving order and bench consistent", () => {
    const { baseSelection } = fixture();
    const outgoing = baseSelection.rotation[0]!.playerId;
    const incoming = baseSelection.benchPlayerIds[0]!;
    const before = JSON.stringify(baseSelection);

    const selected = replacePreMatchPlayer({
      selection: baseSelection,
      outgoingPlayerId: outgoing,
      incomingPlayerId: incoming,
    });

    expect(activeIds(selected)).toContain(incoming);
    expect(activeIds(selected)).not.toContain(outgoing);
    expect(selected.benchPlayerIds).toContain(outgoing);
    expect(selected.benchPlayerIds).not.toContain(incoming);
    expect(selected.servingOrderPlayerIds).toContain(incoming);
    expect(selected.servingOrderPlayerIds).not.toContain(outgoing);
    expect(JSON.stringify(baseSelection)).toBe(before);
  });

  it("replaces the libero without mutating the baseline selection", () => {
    const { baseSelection } = fixture();
    const outgoing = baseSelection.liberoPlayerId!;
    const incoming = baseSelection.benchPlayerIds[0]!;
    const before = JSON.stringify(baseSelection);

    const selected = replacePreMatchPlayer({
      selection: baseSelection,
      outgoingPlayerId: outgoing,
      incomingPlayerId: incoming,
    });

    expect(selected.liberoPlayerId).toBe(incoming);
    expect(selected.benchPlayerIds).toContain(outgoing);
    expect(selected.benchPlayerIds).not.toContain(incoming);
    expect(JSON.stringify(baseSelection)).toBe(before);
  });
});
