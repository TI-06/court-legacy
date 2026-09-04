import { fireEvent, render, screen, within } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { getPlayerConditionPresentation } from "../../../../src/domain/player/playerCondition";
import { getPlayerDevelopmentPresentation } from "../../../../src/domain/player/playerDevelopmentPresentation";
import { calculatePlayerDisplayPower } from "../../../../src/domain/selectors/playerPresentation";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../../src/features/team/PlayerHubScreen";

function renderPlayerHub(
  state = createDemoGame(),
  onAssignLeadership = vi.fn(),
) {
  const selection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const view = render(
    <PlayerHubScreen
      onAssignLeadership={onAssignLeadership}
      onChange={vi.fn()}
      selection={selection}
      state={state}
    />,
  );

  return { state, selection, view, onAssignLeadership };
}

describe("PlayerHubScreen", () => {
  it("renders a dense portrait-free mobile roster with growth and talent labels", () => {
    const { state, view } = renderPlayerHub();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    const condition = getPlayerConditionPresentation(player.condition);
    const development = getPlayerDevelopmentPresentation(player);
    const rows = screen.getAllByTestId("roster-player-row");

    expect(rows).toHaveLength(school.playerIds.length);
    expect(view.container.querySelector("img")).toBeNull();
    expect(screen.getByText("登録選手")).toBeVisible();
    expect(view.container.querySelector(".player-roster__header")).toBeNull();
    expect(screen.queryByText("PLAYER ROSTER")).toBeNull();

    const firstRow = rows[0]!;
    expect(within(firstRow).getByText("1")).toBeVisible();
    expect(
      within(firstRow).getByText(`${player.lastName} ${player.firstName}`),
    ).toBeVisible();
    expect(
      within(firstRow).getByText(
        `${player.grade}年・${player.preferredPosition}・${player.heightCm}cm`,
      ),
    ).toBeVisible();
    expect(
      within(firstRow).getByText(
        `${development.growthLabel}・${development.talentLabel}`,
      ),
    ).toBeVisible();
    expect(within(firstRow).getByText("総合")).toBeVisible();
    expect(
      within(firstRow).getByText(
        String(Math.round(calculatePlayerDisplayPower(player) / 100)),
      ),
    ).toBeVisible();
    expect(within(firstRow).getByTitle(condition.label)).toBeVisible();
    expect(within(firstRow).getByText(condition.label)).toBeVisible();
  });

  it("opens a compact player detail with growth type, talent and potential", () => {
    const { state, view } = renderPlayerHub();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    const development = getPlayerDevelopmentPresentation(player);

    expect(screen.getByRole("heading", { name: "選手一覧" })).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: `選手詳細 ${player.lastName} ${player.firstName}`,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: `${player.lastName} ${player.firstName}`,
      }),
    ).toBeVisible();
    expect(screen.getByText("総合力")).toBeVisible();
    expect(
      screen.getByText(
        `${player.grade}年・${player.preferredPosition}・${player.heightCm}cm`,
      ),
    ).toBeVisible();
    const developmentRegion = screen.getByRole("region", {
      name: "成長タイプと才能",
    });
    expect(within(developmentRegion).getByText("成長タイプ")).toBeVisible();
    expect(
      within(developmentRegion).getByText(development.growthLabel),
    ).toBeVisible();
    expect(within(developmentRegion).getByText("才能")).toBeVisible();
    expect(
      within(developmentRegion).getByText(development.talentLabel),
    ).toBeVisible();
    if (development.potential !== null) {
      expect(
        within(developmentRegion).getByText(
          `将来性 ${development.potentialGrade}・${development.potential}`,
        ),
      ).toBeVisible();
    }
    expect(screen.queryByText(player.reading)).toBeNull();
    expect(view.container.querySelector(".player-detail__hero")).toBeNull();
    expect(
      view.container.querySelector(".player-detail__summary"),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "選手一覧へ戻る" }));
    expect(screen.getByRole("heading", { name: "選手一覧" })).toBeVisible();
  });

  it("keeps the existing lineup editor available", () => {
    renderPlayerHub();

    fireEvent.click(screen.getByRole("button", { name: "編成" }));
    expect(screen.getByRole("heading", { name: "チーム編成" })).toBeVisible();
  });

  it("opens team dynamics management and submits leadership ids", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const captainPlayerId = school.playerIds[0]!;
    const viceCaptainPlayerId = school.playerIds[1]!;
    const onAssignLeadership = vi.fn();
    renderPlayerHub(state, onAssignLeadership);

    fireEvent.click(screen.getByRole("button", { name: "チーム状態" }));
    expect(screen.getByRole("heading", { name: "チーム状態" })).toBeVisible();

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

  it("shows the player's role, trust, morale, and current concern", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = state.players[playerId]!;
    state.teamDynamics = {
      ...state.teamDynamics,
      playerRoles: { [playerId]: "ace" },
      playerConcerns: {
        [playerId]: [{ code: "playing-time", severity: 2 }],
      },
    };
    renderPlayerHub(state);

    fireEvent.click(
      screen.getByRole("button", {
        name: `選手詳細 ${player.lastName} ${player.firstName}`,
      }),
    );

    expect(screen.getByText("エース")).toBeVisible();
    expect(screen.getByText("信頼")).toBeVisible();
    expect(screen.getByText(String(player.trust))).toBeVisible();
    expect(screen.getByText(/出場機会/)).toBeVisible();
  });
});
