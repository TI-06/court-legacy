import { gameDataBootstrap } from "../../../../src/data/gameData";
import { generatePlayer } from "../../../../src/domain/generation/generatePlayer";
import { playerId, schoolId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import {
  buildScoutingBoard,
  createScoutReport,
} from "../../../../src/domain/scouting/scoutReport";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;

function candidate(index: number, tier: "normal" | "elite" | "monster") {
  return generatePlayer({
    id: playerId(`scout-candidate-${index}`),
    schoolId: schoolId("school-candidate-pool"),
    grade: 1,
    enrolledYear: 1,
    tier,
    data,
    random: new SeededRandom(`scout-candidate-${index}`),
    excludedFullNames: new Set(),
  });
}

describe("scoutReport", () => {
  it("shows useful scouting information without leaking exact hidden values or internal tier", () => {
    const player = candidate(1, "monster");
    const report = createScoutReport({
      player,
      middleSchoolAchievement: "prefectural-selection",
      observation: 45,
      scoutingNetworkLevel: 2,
      random: new SeededRandom("report-hidden-values"),
    });
    const serialized = JSON.stringify(report);

    expect(report.candidateId).toBe(player.id);
    expect(report.displayName).toBe(`${player.lastName} ${player.firstName}`);
    expect(report.heightCm).toBe(player.heightCm);
    expect(report.position).toBe(player.preferredPosition);
    expect(report.handedness).toBe(player.handedness);
    expect(report.middleSchoolAchievement).toBe("prefectural-selection");
    expect(report.evaluationStars).toBeGreaterThanOrEqual(1);
    expect(report.evaluationStars).toBeLessThanOrEqual(5);
    expect(report.comments.length).toBeGreaterThan(0);

    expect(serialized).not.toContain('"tier"');
    expect(serialized).not.toContain('"growthPeakGrade"');
    expect(serialized).not.toContain('"injuryResistance"');
    expect(serialized).not.toContain('"hiddenTraitIds"');
    expect(serialized).not.toContain(`"potential":${player.potential}`);
  });

  it("narrows estimated ranges when observation and scouting facilities improve", () => {
    const player = candidate(2, "elite");
    const low = createScoutReport({
      player,
      middleSchoolAchievement: "prefectural-best-eight",
      observation: 20,
      scoutingNetworkLevel: 0,
      random: new SeededRandom("same-report-noise"),
    });
    const high = createScoutReport({
      player,
      middleSchoolAchievement: "prefectural-best-eight",
      observation: 95,
      scoutingNetworkLevel: 5,
      random: new SeededRandom("same-report-noise"),
    });

    expect(high.estimatedOverall.max - high.estimatedOverall.min).toBeLessThan(
      low.estimatedOverall.max - low.estimatedOverall.min,
    );
    expect(high.estimatedPotential.max - high.estimatedPotential.min).toBeLessThan(
      low.estimatedPotential.max - low.estimatedPotential.min,
    );
    expect(high.confidence).toBe("high");
    expect(low.confidence).toBe("low");
  });

  it("is deterministic for the same candidate, information quality, and seed", () => {
    const player = candidate(3, "elite");
    const input = {
      player,
      middleSchoolAchievement: "regional-starter" as const,
      observation: 60,
      scoutingNetworkLevel: 3,
    };

    expect(
      createScoutReport({
        ...input,
        random: new SeededRandom("deterministic-scout-report"),
      }),
    ).toEqual(
      createScoutReport({
        ...input,
        random: new SeededRandom("deterministic-scout-report"),
      }),
    );
  });

  it("builds a board of reports without exposing candidate truth objects", () => {
    const players = [
      candidate(10, "normal"),
      candidate(11, "elite"),
      candidate(12, "monster"),
    ];
    const board = buildScoutingBoard({
      candidates: players.map((player, index) => ({
        player,
        middleSchoolAchievement:
          index === 0
            ? "regional-starter"
            : index === 1
              ? "prefectural-best-eight"
              : "national-event",
      })),
      observation: 70,
      scoutingNetworkLevel: 4,
      random: new SeededRandom("board-seed"),
    });

    expect(board).toHaveLength(3);
    expect(new Set(board.map((report) => report.candidateId)).size).toBe(3);
    expect(JSON.stringify(board)).not.toContain('"abilities"');
    expect(JSON.stringify(board)).not.toContain('"tier"');
  });
});
