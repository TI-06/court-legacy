import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import type { GameAction } from "../../worker/game/actionSchema";
import { applyGameAction } from "../../worker/game/applyGameAction";
import {
  evaluateFacilityUpgrade,
  type FacilityUpgradeLevels,
} from "../../src/domain/school/facilityUpgrade";
import {
  advanceSoakUntilWeekChanges,
  createSoakSnapshot,
} from "../../src/dev/soak/runBalanceSoak";

const enabled = process.env.PHASE19_FACILITY_FOCUS_RUN === "1";
const describeSoak = enabled ? describe : describe.skip;
const RESERVE_FUNDS = 300;
const TARGET_FACILITY = "trainingRoom" as const;
const BULK_OPTIONS: readonly FacilityUpgradeLevels[] = [10, 5, 1];
const MAX_SEASONS = 30;

if (enabled) {
  vi.setConfig({ testTimeout: 300_000 });
}

function applyAction(
  snapshot: CloudGameSnapshot,
  action: GameAction,
): CloudGameSnapshot {
  const applied = applyGameAction(snapshot, action);
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    state: applied.state,
    teamSelection: applied.teamSelection,
  };
}

function applyFocusedFacilityUpgrade(snapshot: CloudGameSnapshot): {
  snapshot: CloudGameSnapshot;
  levels: FacilityUpgradeLevels | null;
} {
  if (
    snapshot.state.pendingEvent ||
    (snapshot.state.activeMatch &&
      snapshot.state.activeMatch.phase !== "match-complete")
  ) {
    return { snapshot, levels: null };
  }

  for (const levels of BULK_OPTIONS) {
    const evaluation = evaluateFacilityUpgrade(
      snapshot.state,
      snapshot.state.userSchoolId,
      TARGET_FACILITY,
      levels,
    );
    if (evaluation.allowed && evaluation.fundsAfter >= RESERVE_FUNDS) {
      return {
        snapshot: applyAction(snapshot, {
          type: "facility-upgrade",
          facility: TARGET_FACILITY,
          levels,
        }),
        levels,
      };
    }
  }

  return { snapshot, levels: null };
}

describeSoak("Phase19 focused facility reachability", () => {
  it("can reach Lv.50 within 30 seasons through authoritative actions without debt", () => {
    let snapshot = createSoakSnapshot("phase19-facility-focus");
    const startingYearIndex = snapshot.state.yearIndex;
    const targetYearIndex = startingYearIndex + MAX_SEASONS;
    let completedWeeks = 0;
    let upgradeActions = 0;
    const bulkCounts: Record<FacilityUpgradeLevels, number> = {
      1: 0,
      5: 0,
      10: 0,
    };

    while (
      snapshot.state.schools[snapshot.state.userSchoolId]!.facilities[
        TARGET_FACILITY
      ] < 50 &&
      snapshot.state.yearIndex < targetYearIndex
    ) {
      const managed = applyFocusedFacilityUpgrade(snapshot);
      snapshot = managed.snapshot;
      if (managed.levels) {
        upgradeActions += 1;
        bulkCounts[managed.levels] += 1;
      }

      const advanced = advanceSoakUntilWeekChanges(snapshot);
      snapshot = advanced.snapshot;
      completedWeeks += 1;

      const funds = snapshot.state.schools[snapshot.state.userSchoolId]!.funds;
      expect(funds).toBeGreaterThanOrEqual(0);
      if (completedWeeks > MAX_SEASONS * 60 + 4) {
        throw new Error("focused facility soak exceeded the 30-season week guard");
      }
    }

    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const reachedYear = snapshot.state.yearIndex - startingYearIndex + 1;

    console.info(
      `[phase19-facility-focus] level=${school.facilities[TARGET_FACILITY]} reachedYear=${reachedYear} weeks=${completedWeeks} upgradeActions=${upgradeActions} funds=${school.funds} bulk=${JSON.stringify(bulkCounts)}`,
    );

    expect(school.facilities[TARGET_FACILITY]).toBe(50);
    expect(snapshot.state.yearIndex).toBeLessThanOrEqual(targetYearIndex);
    expect(upgradeActions).toBeGreaterThan(0);
    expect(school.funds).toBeGreaterThanOrEqual(0);
  });
});
