import { describe, expect, it } from "vitest";
import {
  advanceSoakUntilWeekChanges,
  applySoakManagementPolicy,
  createSoakSnapshot,
} from "../../src/dev/soak/runBalanceSoak";

function funds(snapshot: ReturnType<typeof createSoakSnapshot>): number {
  return snapshot.state.schools[snapshot.state.userSchoolId]!.funds;
}

describe("Phase50 zero-funds diagnosis", () => {
  it("prints the first persistent zero-funds week for phase50-balance-b", () => {
    let snapshot = createSoakSnapshot("phase50-balance-b");
    const targetYearIndex = snapshot.state.yearIndex + 10;
    let completedWeeks = 0;
    let found = false;

    while (
      snapshot.state.yearIndex < targetYearIndex &&
      completedWeeks < 620
    ) {
      const fundsBeforeManagement = funds(snapshot);
      const managed = applySoakManagementPolicy(snapshot);
      snapshot = managed.snapshot;
      const fundsAfterManagement = funds(snapshot);

      if (fundsAfterManagement === 0) {
        console.log(
          "[phase50-funds-diagnosis] " +
            JSON.stringify({
              date: snapshot.state.date,
              yearIndex: snapshot.state.yearIndex,
              academicYear: snapshot.state.calendar.academicYear,
              weekOfYear: snapshot.state.calendar.weekOfYear,
              fundsBeforeManagement,
              fundsAfterManagement,
              managementActionCount: managed.actionCount,
              assistantCoach: snapshot.state.schoolManagement.assistantCoach,
              facilities:
                snapshot.state.schools[snapshot.state.userSchoolId]!.facilities,
              ledger: snapshot.state.schoolManagement.fundsHistory.slice(-15),
            }),
        );
        found = true;
        break;
      }

      const advanced = advanceSoakUntilWeekChanges(snapshot);
      snapshot = advanced.snapshot;
      completedWeeks += 1;
    }

    expect(found).toBe(true);
  });
});
