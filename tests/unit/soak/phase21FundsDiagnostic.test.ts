import { runBalanceSoak } from "../../../src/dev/soak/runBalanceSoak";

describe("Phase21 soak funds diagnostic", () => {
  it("prints the release-a funds ledger around the observed minimum", () => {
    const result = runBalanceSoak({ seed: "phase18-release-a", preset: "smoke" });
    const school = result.snapshot.state.schools[result.snapshot.state.userSchoolId]!;
    const minimum = result.report.yearly[0]!.fundsMin;
    const relevant = result.snapshot.state.schoolManagement.fundsHistory.filter(
      (entry) => entry.balanceAfter <= 350 || entry.amount < 0,
    );

    console.info(
      "PHASE21_FUNDS_DIAGNOSTIC",
      JSON.stringify({ minimum, finalFunds: school.funds, relevant }, null, 2),
    );

    expect(minimum).toBeGreaterThan(0);
  });
});
