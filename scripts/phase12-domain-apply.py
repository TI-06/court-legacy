from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def add_tests() -> None:
    write(
        "tests/unit/domain/player/playerCondition.test.ts",
        '''import { describe, expect, it } from "vitest";
import { getPlayerConditionPresentation } from "../../../../src/domain/player/playerCondition";

describe("playerCondition", () => {
  it.each([
    [100, "絶好調", "red", 1.08],
    [85, "絶好調", "red", 1.08],
    [84, "好調", "green", 1.04],
    [65, "好調", "green", 1.04],
    [64, "普通", "yellow", 1],
    [40, "普通", "yellow", 1],
    [39, "不調", "blue", 0.96],
    [20, "不調", "blue", 0.96],
    [19, "絶不調", "purple", 0.92],
    [0, "絶不調", "purple", 0.92],
  ] as const)(
    "maps condition %i to %s",
    (condition, label, colorToken, matchMultiplier) => {
      const result = getPlayerConditionPresentation(condition);
      expect(result.label).toBe(label);
      expect(result.colorToken).toBe(colorToken);
      expect(result.matchMultiplier).toBe(matchMultiplier);
    },
  );

  it("clamps values outside the internal range", () => {
    expect(getPlayerConditionPresentation(999).label).toBe("絶好調");
    expect(getPlayerConditionPresentation(-999).label).toBe("絶不調");
  });
});
''',
    )
    write(
        "tests/unit/data/phase12TrainingInstructions.test.ts",
        '''import { describe, expect, it } from "vitest";
import { individualTrainingInstructions } from "../../../src/data/individualTrainingInstructions";

describe("Phase 12 individual training instructions", () => {
  it("exposes exactly the six player-facing choices", () => {
    expect(
      individualTrainingInstructions.map(({ id, name }) => ({ id, name })),
    ).toEqual([
      { id: "instruction.overall", name: "全体" },
      { id: "instruction.attack", name: "攻撃" },
      { id: "instruction.defense", name: "守備" },
      { id: "instruction.jump", name: "跳躍" },
      { id: "instruction.fitness", name: "体力" },
      { id: "instruction.rest", name: "休養" },
    ]);
    expect(individualTrainingInstructions.every((item) => item.fatigue === 0)).toBe(
      true,
    );
    expect(
      individualTrainingInstructions.find((item) => item.id === "instruction.rest")
        ?.tags,
    ).toContain("rest");
  });
});
''',
    )
    write(
        "tests/unit/domain/weekly/phase12DefaultWeeklyPlan.test.ts",
        '''import { describe, expect, it } from "vitest";
import { createDefaultWeeklyPlan } from "../../../../src/domain/weekly/createWeeklySchedule";

describe("Phase 12 default weekly plan", () => {
  it("assigns balanced training to every roster player", () => {
    const state = {
      userSchoolId: "school.user",
      schools: {
        "school.user": {
          playerIds: ["player.1", "player.2", "player.3"],
        },
      },
    } as Parameters<typeof createDefaultWeeklyPlan>[0];

    expect(createDefaultWeeklyPlan(state).individualAssignments).toEqual([
      { playerId: "player.1", instructionId: "instruction.overall" },
      { playerId: "player.2", instructionId: "instruction.overall" },
      { playerId: "player.3", instructionId: "instruction.overall" },
    ]);
  });
});
''',
    )


def apply_production() -> None:
    write(
        "src/domain/player/playerCondition.ts",
        '''export type PlayerConditionLevel =
  | "excellent"
  | "good"
  | "normal"
  | "poor"
  | "terrible";

export type PlayerConditionColorToken =
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "purple";

export interface PlayerConditionPresentation {
  level: PlayerConditionLevel;
  label: "絶好調" | "好調" | "普通" | "不調" | "絶不調";
  icon: "😄" | "🙂" | "😐" | "☹️" | "😣";
  colorToken: PlayerConditionColorToken;
  matchMultiplier: 1.08 | 1.04 | 1 | 0.96 | 0.92;
}

function clampCondition(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getPlayerConditionPresentation(
  rawCondition: number,
): PlayerConditionPresentation {
  const condition = clampCondition(rawCondition);
  if (condition >= 85) {
    return {
      level: "excellent",
      label: "絶好調",
      icon: "😄",
      colorToken: "red",
      matchMultiplier: 1.08,
    };
  }
  if (condition >= 65) {
    return {
      level: "good",
      label: "好調",
      icon: "🙂",
      colorToken: "green",
      matchMultiplier: 1.04,
    };
  }
  if (condition >= 40) {
    return {
      level: "normal",
      label: "普通",
      icon: "😐",
      colorToken: "yellow",
      matchMultiplier: 1,
    };
  }
  if (condition >= 20) {
    return {
      level: "poor",
      label: "不調",
      icon: "☹️",
      colorToken: "blue",
      matchMultiplier: 0.96,
    };
  }
  return {
    level: "terrible",
    label: "絶不調",
    icon: "😣",
    colorToken: "purple",
    matchMultiplier: 0.92,
  };
}

export function getConditionMatchMultiplier(condition: number): number {
  return getPlayerConditionPresentation(condition).matchMultiplier;
}
''',
    )
    write(
        "src/data/individualTrainingInstructions.ts",
        '''import type { IndividualTrainingInstructionDefinition } from "../domain/validation/gameDataSchema";

export const individualTrainingInstructions: IndividualTrainingInstructionDefinition[] =
  [
    {
      id: "instruction.overall",
      name: "全体",
      description: "基礎をバランスよく積み上げ、総合的な成長を狙う。",
      targetAbilities: ["spike", "receive", "serve"],
      baseGrowth: 4,
      fatigue: 0,
      injuryRisk: 2,
      trustGrowth: 2,
      tags: ["balanced", "individual"],
    },
    {
      id: "instruction.attack",
      name: "攻撃",
      description: "スパイクとサーブ、攻撃判断を重点的に磨く。",
      targetAbilities: ["spike", "serve", "decision"],
      baseGrowth: 7,
      fatigue: 0,
      injuryRisk: 5,
      trustGrowth: 2,
      tags: ["attack", "individual"],
    },
    {
      id: "instruction.defense",
      name: "守備",
      description: "レシーブ、ブロック、初動の速さを重点的に磨く。",
      targetAbilities: ["receive", "block", "speed"],
      baseGrowth: 6,
      fatigue: 0,
      injuryRisk: 3,
      trustGrowth: 3,
      tags: ["defense", "individual"],
    },
    {
      id: "instruction.jump",
      name: "跳躍",
      description: "ジャンプ力を軸にブロックと打点を伸ばす。",
      targetAbilities: ["jump", "block", "spike"],
      baseGrowth: 6,
      fatigue: 0,
      injuryRisk: 6,
      trustGrowth: 2,
      tags: ["jump", "individual"],
    },
    {
      id: "instruction.fitness",
      name: "体力",
      description: "スタミナ、スピード、メンタルの土台を鍛える。",
      targetAbilities: ["stamina", "speed", "mental"],
      baseGrowth: 6,
      fatigue: 0,
      injuryRisk: 2,
      trustGrowth: 2,
      tags: ["fitness", "individual"],
    },
    {
      id: "instruction.rest",
      name: "休養",
      description: "能力練習を休み、調子を大きく上向かせる。",
      targetAbilities: ["mental"],
      baseGrowth: 1,
      fatigue: 0,
      injuryRisk: 0,
      trustGrowth: 1,
      tags: ["rest", "condition", "individual"],
    },
  ];
''',
    )
    write(
        "src/domain/weekly/createWeeklySchedule.ts",
        '''import type { WeeklyPlan } from "../training/resolveWeeklyTraining";
import {
  buildInitialPracticePlanning,
  type PracticePlanningSource,
} from "./practiceMatchPlanning";
import type { WeeklyScheduleState } from "./weeklyScheduleTypes";

type WeeklyScheduleSource = PracticePlanningSource;

export function createDefaultWeeklyPlan(
  state: Pick<WeeklyScheduleSource, "userSchoolId" | "schools">,
): WeeklyPlan {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("weekly schedule requires the user school");
  }
  if (school.playerIds.length === 0) {
    throw new Error("weekly schedule requires at least one user player");
  }

  return {
    teamTrainingMenuId: "training.spike",
    individualAssignments: school.playerIds.map((playerId) => ({
      playerId,
      instructionId: "instruction.overall",
    })),
  };
}

export function createInitialWeeklySchedule(
  state: WeeklyScheduleSource,
): WeeklyScheduleState {
  const practicePlanning = buildInitialPracticePlanning(state);

  return {
    trainingPlan: createDefaultWeeklyPlan(state),
    practiceMatch: {
      ...practicePlanning,
      scheduledOpponentId: null,
      scheduledBy: null,
    },
    recentPracticeMatches: [],
    latestReport: null,
  };
}
''',
    )


if len(sys.argv) != 2 or sys.argv[1] not in {"tests", "production"}:
    raise SystemExit("usage: phase12-domain-apply.py tests|production")

if sys.argv[1] == "tests":
    add_tests()
else:
    apply_production()
