import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { MatchState } from "../../../../src/domain/model/Match";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import {
  deriveCourtMoment,
  LiveCourtAnimation,
} from "../../../../src/features/match/LiveCourtAnimation";

function fixture() {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  const homeSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const awaySelection = autoSelectTeam({ state, schoolId: opponent.id });
  const match = {
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    servingSchoolId: state.userSchoolId,
    eventLog: [
      {
        sequence: 1,
        type: "attack",
        setNumber: 1,
        homeScore: 0,
        awayScore: 0,
        actorPlayerId: homeSelection.rotation[0]!.playerId,
        targetPlayerId: awaySelection.rotation[0]!.playerId,
        winnerSchoolId: null,
        detailCode: "attack.hit",
      },
      {
        sequence: 2,
        type: "point",
        setNumber: 1,
        homeScore: 1,
        awayScore: 0,
        actorPlayerId: homeSelection.rotation[0]!.playerId,
        targetPlayerId: awaySelection.rotation[0]!.playerId,
        winnerSchoolId: state.userSchoolId,
        detailCode: "point.attack",
      },
    ],
  } as MatchState;
  return { match, homeSelection, awaySelection };
}

describe("Phase60 read-only live court", () => {
  it("derives the displayed attack from the current authoritative point", () => {
    const { match, homeSelection, awaySelection } = fixture();
    expect(deriveCourtMoment(match, 1, homeSelection, awaySelection)).toEqual({
      play: "attack",
      fromHome: true,
      actorSlot: homeSelection.rotation[0]!.slot,
      actorSide: "home",
    });
  });

  it("animates only during playback and never requires save state", () => {
    const props = fixture();
    const { rerender } = render(
      <LiveCourtAnimation
        {...props}
        visibleEventIndex={1}
        homeLabel="自校"
        awayLabel="相手校"
        playing={true}
        reducedMotion={false}
      />,
    );
    expect(screen.getByRole("region", { name: "試合2Dコート" })).toBeVisible();
    expect(screen.getByTestId("live-court-ball")).toHaveAttribute(
      "data-animated",
      "true",
    );
    rerender(
      <LiveCourtAnimation
        {...props}
        visibleEventIndex={1}
        homeLabel="自校"
        awayLabel="相手校"
        playing={true}
        reducedMotion={true}
      />,
    );
    expect(screen.getByTestId("live-court-ball")).toHaveAttribute(
      "data-animated",
      "false",
    );
  });
});
