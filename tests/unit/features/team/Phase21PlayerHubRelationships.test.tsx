import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import { addSpecialRelationship } from "../../../../src/domain/relationships/specialRelationships";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../../src/features/team/PlayerHubScreen";

describe("Phase21 Player Hub relationships", () => {
  it("shows teammate affinity, accessible gauge, and special relationship tags", () => {
    let state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const selectedId = school.playerIds[0]!;
    const teammateId = school.playerIds[1]!;
    const selected = state.players[selectedId]!;
    const teammate = state.players[teammateId]!;
    state.playerRelationships[relationshipKey(selectedId, teammateId)] = 74;
    state = addSpecialRelationship(state, {
      playerIds: [selectedId, teammateId],
      kind: "rival",
      establishedDate: state.date,
    }).state;

    render(
      <PlayerHubScreen
        data={gameData}
        initialPlayerId={selectedId}
        onAssignLeadership={vi.fn()}
        onChange={vi.fn()}
        selection={autoSelectTeam({ state, schoolId: state.userSchoolId })}
        state={state}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: `${selected.lastName} ${selected.firstName}`,
      }),
    ).toBeVisible();
    const region = screen.getByRole("region", { name: "人間関係" });
    expect(within(region).getByText("人間関係")).toBeVisible();
    const teammateName = `${teammate.lastName} ${teammate.firstName}`;
    const teammateRow = within(region)
      .getByText(teammateName)
      .closest("article");
    expect(teammateRow).not.toBeNull();
    const relationship = within(teammateRow!);
    expect(relationship.getByText(teammateName)).toBeVisible();
    expect(relationship.getByText("好相性")).toBeVisible();
    expect(
      relationship.getByRole("meter", { name: "関係値 74" }),
    ).toHaveAttribute("aria-valuenow", "74");
    expect(relationship.getByText("ライバル")).toBeVisible();
  });
});
