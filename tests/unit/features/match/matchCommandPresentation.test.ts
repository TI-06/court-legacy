import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { startMatch } from "../../../../src/domain/match/simulateMatch";
import {
  matchId,
  type PlayerId,
} from "../../../../src/domain/model/identifiers";
import type {
  MatchCommandRecord,
  MatchEvent,
} from "../../../../src/domain/model/Match";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { buildMatchCommandImpactRows } from "../../../../src/features/match/matchCommandPresentation";

function playerName(
  state: ReturnType<typeof createDemoGame>,
  playerId: PlayerId,
): string {
  const player = state.players[playerId];
  if (!player) throw new Error(`player fixture missing: ${playerId}`);
  return `${player.lastName} ${player.firstName}`;
}

function fixture() {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  const homeSelection = autoSelectTeam({ state, schoolId: state.userSchoolId });
  const awaySelection = autoSelectTeam({ state, schoolId: opponent.id });
  const started = startMatch({
    state,
    id: matchId("phase16-command-presentation"),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    homeSelection,
    awaySelection,
    bestOfSets: 3,
    random: new SeededRandom("phase16-command-presentation"),
    controlledSchoolId: state.userSchoolId,
  });
  const match = structuredClone(started.match);
  const runtime = match.runtime;
  if (!runtime) throw new Error("runtime fixture missing");

  const outgoingPlayerId = homeSelection.rotation[0]!.playerId;
  const incomingPlayerId = homeSelection.benchPlayerIds[0]!;
  const boundary = match.eventLog.at(-1)?.sequence ?? 0;

  const records: MatchCommandRecord[] = [
    {
      sequence: 1,
      schoolId: state.userSchoolId,
      setNumber: 1,
      homeScore: 8,
      awayScore: 12,
      decisionReason: "opponent-run",
      command: { type: "timeout" },
      eventSequence: boundary,
    },
    {
      sequence: 2,
      schoolId: state.userSchoolId,
      setNumber: 1,
      homeScore: 14,
      awayScore: 14,
      decisionReason: "opponent-run",
      command: {
        type: "set-match-tactics",
        plan: { serve: "aggressive", attack: "quick", block: "commit" },
      },
      eventSequence: boundary + 5,
    },
    {
      sequence: 3,
      schoolId: state.userSchoolId,
      setNumber: 2,
      homeScore: 0,
      awayScore: 0,
      decisionReason: "set-break",
      command: {
        type: "substitute",
        outgoingPlayerId,
        incomingPlayerId,
      },
      eventSequence: boundary + 7,
    },
    {
      sequence: 4,
      schoolId: state.userSchoolId,
      setNumber: 2,
      homeScore: 0,
      awayScore: 0,
      decisionReason: "set-break",
      command: { type: "continue" },
      eventSequence: boundary + 7,
    },
  ];
  runtime.commandHistory = records;

  const winners = [
    state.userSchoolId,
    opponent.id,
    state.userSchoolId,
    state.userSchoolId,
    opponent.id,
    opponent.id,
    state.userSchoolId,
  ];
  const observedEvents: MatchEvent[] = winners.map((winnerSchoolId, index) => ({
    sequence: boundary + index + 1,
    type: "point",
    setNumber: 1,
    homeScore: 9 + index,
    awayScore: 12,
    actorPlayerId: null,
    targetPlayerId: null,
    winnerSchoolId,
    detailCode: "phase16-test-point",
  }));
  match.eventLog.push(...observedEvents);

  return {
    state,
    match,
    outgoingPlayerId,
    incomingPlayerId,
  };
}

describe("Phase16 match command presentation", () => {
  it("returns factual command labels, recorded score, and bounded observed point splits", () => {
    const { state, match, outgoingPlayerId, incomingPlayerId } = fixture();

    const rows = buildMatchCommandImpactRows(state, match);

    expect(
      rows.map(({ commandLabel }: { commandLabel: string }) => commandLabel),
    ).toEqual([
      "タイムアウト",
      "戦術変更",
      `${playerName(state, outgoingPlayerId)} → ${playerName(state, incomingPlayerId)}`,
      "このまま続ける",
    ]);
    expect(rows[0]).toMatchObject({
      setNumber: 1,
      homeScore: 8,
      awayScore: 12,
      observedRallies: 5,
      schoolPoints: 3,
      opponentPoints: 2,
    });
    expect(rows[1]).toMatchObject({
      setNumber: 1,
      homeScore: 14,
      awayScore: 14,
      observedRallies: 2,
      schoolPoints: 1,
      opponentPoints: 1,
    });
    expect(rows[2]).toMatchObject({ observedRallies: 0 });
    expect(rows[3]).toMatchObject({ observedRallies: 0 });
  });

  it("never invents causal wording for observed post-command results", () => {
    const { state, match } = fixture();
    const text = JSON.stringify(buildMatchCommandImpactRows(state, match));

    expect(text).not.toContain("効果で");
    expect(text).not.toContain("逆転させた");
    expect(text).not.toContain("成功させた");
  });
});
