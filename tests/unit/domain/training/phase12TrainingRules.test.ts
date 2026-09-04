import { describe, expect, it } from "vitest";
import {
  calculatePhase12InjuryRisk,
  getWeeklyConditionDrift,
} from "../../../../src/domain/training/phase12TrainingRules";

describe("Phase 12 training rules", () => {
  it("makes injury risk depend on condition, resistance and recovery room", () => {
    const ordinary = calculatePhase12InjuryRisk({
      baseRisk: 10,
      condition: 50,
      injuryResistance: 50,
      recoveryRoomLevel: 0,
    });
    const protectedPlayer = calculatePhase12InjuryRisk({
      baseRisk: 10,
      condition: 90,
      injuryResistance: 90,
      recoveryRoomLevel: 4,
    });
    const vulnerablePlayer = calculatePhase12InjuryRisk({
      baseRisk: 10,
      condition: 10,
      injuryResistance: 10,
      recoveryRoomLevel: 0,
    });
    expect(protectedPlayer).toBeLessThan(ordinary);
    expect(vulnerablePlayer).toBeGreaterThan(ordinary);
  });
  it("uses one deterministic random value for a -4..4 weekly drift", () => {
    const random = { next: () => 0.5 } as Parameters<
      typeof getWeeklyConditionDrift
    >[0];
    expect(getWeeklyConditionDrift(random)).toBe(0);
  });
});
