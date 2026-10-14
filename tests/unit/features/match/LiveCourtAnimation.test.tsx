import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { MatchState } from "../../../../src/domain/model/Match";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { deriveCourtMoment } from "../../../../src/features/match/liveCourtMoment";
import { LiveCourtAnimation } from "../../../../src/features/match/LiveCourtAnimation";

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

  it("never reveals future point effects before the event is shown", () => {
    const props = fixture();
    render(
      <LiveCourtAnimation
        {...props}
        visibleEventIndex={0}
        playing={true}
        reducedMotion={false}
      />,
    );
    expect(screen.queryByTestId("live-court-point-effect")).toBeNull();
    expect(screen.queryByTestId("live-court-special-ability")).toBeNull();
  });

  it("reveals only an authoritative scoring skill and respects reduced motion", () => {
    const props = fixture();
    props.match.eventLog[1]!.scoringSpecialAbilityId = "gold_absolute_ace";
    const { rerender } = render(
      <LiveCourtAnimation
        {...props}
        visibleEventIndex={1}
        playing={true}
        reducedMotion={false}
      />,
    );
    const badge = screen.getByTestId("live-court-special-ability");
    expect(badge).toHaveAttribute("data-skill-id", "gold_absolute_ace");
    expect(badge).toHaveTextContent("絶対的エース");
    expect(badge).toHaveClass("court-live__skill-burst--animate");

    rerender(
      <LiveCourtAnimation
        {...props}
        visibleEventIndex={1}
        playing={true}
        reducedMotion={true}
      />,
    );
    expect(screen.getByTestId("live-court-special-ability")).not.toHaveClass(
      "court-live__skill-burst--animate",
    );

    rerender(
      <LiveCourtAnimation
        {...props}
        visibleEventIndex={0}
        playing={true}
        reducedMotion={false}
      />,
    );
    expect(screen.queryByTestId("live-court-special-ability")).toBeNull();
  });

  it("does not invent a special ability for old logs or invalid IDs", () => {
    const props = fixture();
    const { rerender } = render(
      <LiveCourtAnimation
        {...props}
        visibleEventIndex={1}
        playing={true}
        reducedMotion={false}
      />,
    );
    expect(screen.queryByTestId("live-court-special-ability")).toBeNull();
    props.match.eventLog[1]!.scoringSpecialAbilityId = "not-a-real-skill";
    rerender(
      <LiveCourtAnimation
        {...props}
        visibleEventIndex={1}
        playing={true}
        reducedMotion={false}
      />,
    );
    expect(screen.queryByTestId("live-court-special-ability")).toBeNull();
  });

  it("animates only during playback and never requires save state", () => {
    const props = fixture();
    const { rerender } = render(
      <LiveCourtAnimation
        {...props}
        visibleEventIndex={1}
        playing={true}
        reducedMotion={false}
      />,
    );
    expect(screen.getByRole("region", { name: "試合2Dコート" })).toBeVisible();
    expect(screen.getByTestId("live-court-ball")).toHaveAttribute(
      "data-animated",
      "true",
    );
    expect(screen.getByTestId("live-court")).toHaveAttribute(
      "data-play",
      "attack",
    );
    expect(screen.getByTestId("live-court-point-effect")).toHaveAttribute(
      "data-celebration",
      "spike",
    );
    expect(screen.getByTestId("live-court-active-player")).toHaveClass(
      "court-live__actor--attack",
      "court-live__actor--home",
    );
    rerender(
      <LiveCourtAnimation
        {...props}
        visibleEventIndex={1}
        playing={true}
        reducedMotion={true}
      />,
    );
    expect(screen.getByTestId("live-court-ball")).toHaveAttribute(
      "data-animated",
      "false",
    );
    expect(screen.getByTestId("live-court-active-player")).not.toHaveClass(
      "court-live__actor--attack",
    );
    expect(screen.getByTestId("live-court-point-effect")).not.toHaveClass(
      "court-live__celebration--animate",
    );
  });
});
