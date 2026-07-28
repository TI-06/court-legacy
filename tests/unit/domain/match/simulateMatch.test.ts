import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generateWorld } from "../../../../src/domain/generation/generateWorld";
import { createAbilities } from "../../../../src/domain/model/Player";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { simulateMatch } from "../../../../src/domain/match/simulateMatch";

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

function createContext(seed = "match-engine") {
  const state = generateWorld({ seed, userSchool, data });
  const homeSchoolId = state.userSchoolId;
  const awaySchool = Object.values(state.schools).find(
    (school) => school.id !== homeSchoolId,
  )!;
  const awaySchoolId = awaySchool.id;
  const homeSelection = autoSelectTeam({ state, schoolId: homeSchoolId });
  const awaySelection = autoSelectTeam({ state, schoolId: awaySchoolId });

  return {
    state,
    homeSchoolId,
    awaySchoolId,
    homeSelection,
    awaySelection,
  };
}

function runMatch(
  seed: string,
  bestOfSets: 3 | 5 = 3,
  context = createContext(`world-${seed}`),
) {
  return simulateMatch({
    state: context.state,
    id: matchId(`match-${seed}`),
    homeSchoolId: context.homeSchoolId,
    awaySchoolId: context.awaySchoolId,
    homeSelection: context.homeSelection,
    awaySelection: context.awaySelection,
    bestOfSets,
    random: new SeededRandom(seed),
  });
}

function assertCompletedSetRules(
  bestOfSets: 3 | 5,
  setNumber: number,
  homeScore: number,
  awayScore: number,
): void {
  const decidingSet = setNumber === bestOfSets;
  const target = decidingSet ? 15 : 25;

  expect(Math.max(homeScore, awayScore)).toBeGreaterThanOrEqual(target);
  expect(Math.abs(homeScore - awayScore)).toBeGreaterThanOrEqual(2);
}

function makeHomeDominant(context: ReturnType<typeof createContext>) {
  const homePlayerIds = context.state.schools[context.homeSchoolId]!.playerIds;
  const awayPlayerIds = context.state.schools[context.awaySchoolId]!.playerIds;

  for (const playerId of homePlayerIds) {
    context.state.players[playerId] = {
      ...context.state.players[playerId]!,
      abilities: createAbilities(96),
      condition: 100,
      fatigue: 0,
      morale: 100,
      injury: null,
      positionAptitudes: {
        OH: 96,
        MB: 96,
        OP: 96,
        S: 96,
        L: 96,
      },
    };
  }

  for (const playerId of awayPlayerIds) {
    context.state.players[playerId] = {
      ...context.state.players[playerId]!,
      abilities: createAbilities(24),
      condition: 55,
      fatigue: 45,
      morale: 45,
      injury: null,
      positionAptitudes: {
        OH: 24,
        MB: 24,
        OP: 24,
        S: 24,
        L: 24,
      },
    };
  }

  context.homeSelection = autoSelectTeam({
    state: context.state,
    schoolId: context.homeSchoolId,
  });
  context.awaySelection = autoSelectTeam({
    state: context.state,
    schoolId: context.awaySchoolId,
  });

  return context;
}

describe("simulateMatch", () => {
  it("completes a best-of-three match when one school wins two sets", () => {
    const { match } = runMatch("best-of-three", 3);

    expect(match.phase).toBe("match-complete");
    expect(Math.max(match.homeSetsWon, match.awaySetsWon)).toBe(2);
    expect(match.sets.length).toBeGreaterThanOrEqual(2);
    expect(match.sets.length).toBeLessThanOrEqual(3);
    expect(match.sets.every((set) => set.completed)).toBe(true);
  });

  it("completes a best-of-five match when one school wins three sets", () => {
    const { match } = runMatch("best-of-five", 5);

    expect(match.phase).toBe("match-complete");
    expect(Math.max(match.homeSetsWon, match.awaySetsWon)).toBe(3);
    expect(match.sets.length).toBeGreaterThanOrEqual(3);
    expect(match.sets.length).toBeLessThanOrEqual(5);
  });

  it("uses 25-point sets, a 15-point deciding set, and a two-point lead", () => {
    const { match } = runMatch("set-rules", 5);

    for (const set of match.sets) {
      assertCompletedSetRules(
        match.bestOfSets,
        set.setNumber,
        set.homeScore,
        set.awayScore,
      );
    }
  });

  it("replays exactly from the same state, selections, seed, and cursor", () => {
    const context = createContext("replay-world");
    const execute = () =>
      simulateMatch({
        state: context.state,
        id: matchId("match-replay"),
        homeSchoolId: context.homeSchoolId,
        awaySchoolId: context.awaySchoolId,
        homeSelection: context.homeSelection,
        awaySelection: context.awaySelection,
        bestOfSets: 3,
        random: new SeededRandom("replay-random", 40),
      });

    expect(execute()).toEqual(execute());
  });

  it("records one point event per rally with contiguous event sequences", () => {
    const { match } = runMatch("event-log", 3);
    const pointEvents = match.eventLog.filter((event) => event.type === "point");
    const totalPoints = match.sets.reduce(
      (sum, set) => sum + set.homeScore + set.awayScore,
      0,
    );

    expect(pointEvents).toHaveLength(totalPoints);
    expect(match.eventLog.map((event) => event.sequence)).toEqual(
      match.eventLog.map((_, index) => index + 1),
    );
    expect(match.eventLog.at(-1)?.type).toBe("match-end");
  });

  it("records rotations when the receiving team wins a rally", () => {
    const { match } = runMatch("side-out-rotations", 3);
    const rotations = match.eventLog.filter(
      (event) => event.type === "rotation",
    );

    expect(rotations.length).toBeGreaterThan(0);
    expect(
      rotations.every(
        (event) =>
          event.detailCode === "rotation.side-out" &&
          event.winnerSchoolId !== null,
      ),
    ).toBe(true);
  });

  it("meaningfully favors a much stronger selected lineup", () => {
    let homeWins = 0;

    for (let index = 0; index < 12; index += 1) {
      const context = makeHomeDominant(createContext(`dominant-world-${index}`));
      const { match, analysis } = runMatch(
        `dominant-match-${index}`,
        3,
        context,
      );
      if (analysis.winnerSchoolId === context.homeSchoolId) {
        homeWins += 1;
      }
      expect(match.phase).toBe("match-complete");
    }

    expect(homeWins).toBeGreaterThanOrEqual(10);
  });

  it("does not mutate the game state or supplied selections", () => {
    const context = createContext("immutability");
    const stateSnapshot = structuredClone(context.state);
    const homeSnapshot = structuredClone(context.homeSelection);
    const awaySnapshot = structuredClone(context.awaySelection);

    runMatch("immutability-match", 3, context);

    expect(context.state).toEqual(stateSnapshot);
    expect(context.homeSelection).toEqual(homeSnapshot);
    expect(context.awaySelection).toEqual(awaySnapshot);
  });

  it("returns explainable winner factors and loser recommendations", () => {
    const { match, analysis } = runMatch("analysis", 3);

    expect(analysis.matchId).toBe(match.id);
    expect([match.homeSchoolId, match.awaySchoolId]).toContain(
      analysis.winnerSchoolId,
    );
    expect(analysis.principalFactors.length).toBeGreaterThanOrEqual(3);
    expect(analysis.recommendations.length).toBeGreaterThanOrEqual(2);
    expect(
      analysis.principalFactors.every(
        (factor) => factor.title.length > 0 && factor.detail.length > 0,
      ),
    ).toBe(true);
  });
});
