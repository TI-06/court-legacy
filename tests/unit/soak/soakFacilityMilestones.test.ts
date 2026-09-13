const subjectPath = "../../../src/dev/soak/soakMetrics";

interface FacilityProgress {
  maxObservedLevel: number;
  firstYearByLevel: Record<string, number>;
}

interface FacilityMilestoneSummary {
  facilityMaxLevel: number;
  byFacility: Record<string, FacilityProgress>;
}

interface MetricsSubject {
  summarizeFacilityMilestones(
    yearly: readonly {
      yearIndex: number;
      facilities: Record<string, number>;
    }[],
  ): FacilityMilestoneSummary;
}

async function loadSubject(): Promise<MetricsSubject> {
  return (await import(subjectPath)) as MetricsSubject;
}

describe("Phase18 soak facility milestone reporting", () => {
  it("records the first completed season each crossed facility level is observed", async () => {
    const { summarizeFacilityMilestones } = await loadSubject();

    const summary = summarizeFacilityMilestones([
      {
        yearIndex: 1,
        facilities: { gym: 1, trainingRoom: 1 },
      },
      {
        yearIndex: 2,
        facilities: { gym: 3, trainingRoom: 1 },
      },
      {
        yearIndex: 3,
        facilities: { gym: 3, trainingRoom: 2 },
      },
    ]);

    expect(summary.facilityMaxLevel).toBe(50);
    expect(Object.keys(summary.byFacility)).toEqual(["gym", "trainingRoom"]);
    expect(summary.byFacility.gym).toEqual({
      maxObservedLevel: 3,
      firstYearByLevel: { "1": 1, "2": 2, "3": 2 },
    });
    expect(summary.byFacility.trainingRoom).toEqual({
      maxObservedLevel: 2,
      firstYearByLevel: { "1": 1, "2": 3 },
    });
  });

  it("keeps facility names stable and reports observations below the production cap", async () => {
    const { summarizeFacilityMilestones } = await loadSubject();

    const summary = summarizeFacilityMilestones([
      {
        yearIndex: 4,
        facilities: { studyRoom: 5, gym: 4 },
      },
    ]);

    expect(Object.keys(summary.byFacility)).toEqual(["gym", "studyRoom"]);
    for (const progress of Object.values(summary.byFacility)) {
      expect(progress.maxObservedLevel).toBeLessThanOrEqual(
        summary.facilityMaxLevel,
      );
    }
  });
});
