import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { MatchState } from "../../../../src/domain/model/Match";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import {
  courtTrajectory,
  deriveCourtMoment,
  deriveCourtRally,
} from "../../../../src/features/match/liveCourtMoment";
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

  it("derives a bounded, past-only serve/receive/set/attack rally", () => {
    const { match, homeSelection, awaySelection } = fixture();
    const serve = match.eventLog[0]!;
    const point = match.eventLog[1]!;
    match.eventLog = [
      { ...serve, sequence: 1, type: "serve" },
      {
        ...serve,
        sequence: 2,
        type: "receive",
        actorPlayerId: awaySelection.rotation[1]!.playerId,
      },
      { ...serve, sequence: 3, type: "set" },
      { ...serve, sequence: 4, type: "attack" },
      { ...point, sequence: 5 },
      { ...serve, sequence: 6, type: "serve", setNumber: 2 },
    ];
    expect(
      deriveCourtRally(match, 3, homeSelection, awaySelection).map(
        (step) => step.play,
      ),
    ).toEqual(["attack"]);
    const rally = deriveCourtRally(match, 4, homeSelection, awaySelection);
    expect(rally.map((step) => step.play)).toEqual([
      "serve",
      "receive",
      "set",
      "attack",
    ]);
    expect(rally.map((step) => step.sequence)).toEqual([1, 2, 3, 4]);
    expect(rally[1]!.fromHome).toBe(false);
    expect(deriveCourtRally(match, 5, homeSelection, awaySelection)).toHaveLength(
      1,
    );

    const { rerender } = render(
      <LiveCourtAnimation
        match={match}
        homeSelection={homeSelection}
        awaySelection={awaySelection}
        visibleEventIndex={4}
        playing={true}
        reducedMotion={false}
      />,
    );
    expect(screen.getAllByTestId("live-court-rally-trail")).toHaveLength(4);
    expect(screen.getByTestId("live-court-rally-steps")).toHaveTextContent(
      "サーブ → レシーブ → トス → スパイク",
    );
    expect(screen.getByTestId("live-court-ball")).toHaveAttribute(
      "data-motion",
      "attack",
    );
    rerender(
      <LiveCourtAnimation
        match={match}
        homeSelection={homeSelection}
        awaySelection={awaySelection}
        visibleEventIndex={3}
        playing={false}
        reducedMotion={true}
      />,
    );
    expect(screen.getAllByTestId("live-court-rally-trail")).toHaveLength(1);
    expect(screen.getByTestId("live-court-ball").querySelector("animateMotion")).toBeNull();
  });

  it("uses distinct ball trajectories without crossing the net for set/receive/block", () => {
    for (const play of ["receive", "set", "block"] as const) {
      const home = courtTrajectory(play, true)!;
      const away = courtTrajectory(play, false)!;
      expect(home.startX).toBeLessThan(180);
      expect(home.endX).toBeLessThan(180);
      expect(away.startX).toBeGreaterThan(180);
      expect(away.endX).toBeGreaterThan(180);
      expect(home.path).not.toEqual(away.path);
    }
    for (const play of ["serve", "attack"] as const) {
      expect(courtTrajectory(play, true)!.endX).toBeGreaterThan(180);
      expect(courtTrajectory(play, false)!.endX).toBeLessThan(180);
    }
    expect(courtTrajectory("rally", true)).toBeNull();
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
