import { fireEvent, render, screen, within } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import { TeamDynamicsPanel } from "../../../../src/features/team/TeamDynamicsPanel";

function playerName(player: { lastName: string; firstName: string }): string {
  return `${player.lastName} ${player.firstName}`;
}

describe("TeamDynamicsPanel", () => {
  it("shows cohesion, leadership, concerns, and suitability with Japanese labels", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const firstId = school.playerIds[0]!;
    const first = state.players[firstId]!;

    state.teamDynamics = {
      ...state.teamDynamics,
      captainPlayerId: null,
      viceCaptainPlayerId: null,
      cohesion: 64,
      previousCohesion: 59,
      cohesionTrend: "rising",
      playerRoles: { [firstId]: "ace" },
      playerConcerns: {
        [firstId]: [{ code: "playing-time", severity: 2 }],
      },
    };
    state.playerRelationships = {};
    for (
      let leftIndex = 0;
      leftIndex < school.playerIds.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < school.playerIds.length;
        rightIndex += 1
      ) {
        const left = school.playerIds[leftIndex]!;
        const right = school.playerIds[rightIndex]!;
        state.playerRelationships[relationshipKey(left, right)] = 85;
      }
    }

    render(
      <TeamDynamicsPanel
        onAssignLeadership={vi.fn()}
        pending={false}
        state={state}
      />,
    );

    expect(screen.getByRole("heading", { name: "チーム状態" })).toBeVisible();
    expect(screen.getByText("役職")).toBeVisible();
    expect(screen.getAllByText("主将適性").length).toBeGreaterThan(0);
    expect(screen.getByText("気になる状態")).toBeVisible();
    for (const english of [
      "TEAM DYNAMICS",
      "LEADERSHIP",
      "SUITABILITY",
      "CONCERNS",
    ]) {
      expect(screen.queryByText(english)).toBeNull();
    }
    const cohesion = screen.getByLabelText("チーム結束力");
    expect(within(cohesion).getByText("64")).toBeVisible();
    expect(within(cohesion).getByText("上向き")).toBeVisible();
    expect(screen.getAllByText("未設定")).toHaveLength(2);
    expect(screen.getByText("関係性 良好")).toBeVisible();
    expect(
      screen.getByText(new RegExp(`${playerName(first)}.*出場機会`)),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "主将適性" })).toBeVisible();
  });

  it("submits only the selected captain and vice-captain ids", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const captainPlayerId = school.playerIds[0]!;
    const viceCaptainPlayerId = school.playerIds[1]!;
    const onAssignLeadership = vi.fn();

    render(
      <TeamDynamicsPanel
        onAssignLeadership={onAssignLeadership}
        pending={false}
        state={state}
      />,
    );

    fireEvent.change(screen.getByLabelText("主将"), {
      target: { value: captainPlayerId },
    });
    fireEvent.change(screen.getByLabelText("副主将"), {
      target: { value: viceCaptainPlayerId },
    });
    fireEvent.click(screen.getByRole("button", { name: "役職を保存" }));

    expect(onAssignLeadership).toHaveBeenCalledWith(
      captainPlayerId,
      viceCaptainPlayerId,
    );
  });
});
