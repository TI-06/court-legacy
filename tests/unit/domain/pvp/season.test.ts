import { pvpJstDayKey, pvpSeasonId } from "../../../../src/domain/pvp/season";

describe("PvP JST time keys", () => {
  it("changes season at the JST month boundary rather than the UTC boundary", () => {
    expect(pvpSeasonId(new Date("2026-08-31T14:59:59.000Z"))).toBe("2026-08");
    expect(pvpSeasonId(new Date("2026-08-31T15:00:00.000Z"))).toBe("2026-09");
  });

  it("changes daily limit key at JST midnight", () => {
    expect(pvpJstDayKey(new Date("2026-08-28T14:59:59.000Z"))).toBe("2026-08-28");
    expect(pvpJstDayKey(new Date("2026-08-28T15:00:00.000Z"))).toBe("2026-08-29");
  });
});
