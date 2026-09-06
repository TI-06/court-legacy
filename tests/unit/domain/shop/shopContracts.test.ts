import { describe, expect, it } from "vitest";
import {
  shopPurchaseRequestSchema,
  shopUseRequestSchema,
} from "../../../../src/domain/shop/shopContracts";

describe("Phase 5 shop browser contracts", () => {
  it("accepts only operation id, revision, and item id for purchases", () => {
    expect(
      shopPurchaseRequestSchema.safeParse({
        operationId: "purchase-op-001",
        revision: 7,
        itemId: "fatigue-recovery",
      }).success,
    ).toBe(true);

    expect(
      shopPurchaseRequestSchema.safeParse({
        operationId: "purchase-op-001",
        revision: 7,
        itemId: "fatigue-recovery",
        priceYen: 0,
      }).success,
    ).toBe(false);
  });

  it("accepts all immediate fund grant product ids", () => {
    for (const itemId of [
      "funds-grant-300",
      "funds-grant-1000",
      "funds-grant-3000",
    ]) {
      expect(
        shopPurchaseRequestSchema.safeParse({
          operationId: `purchase-${itemId}`,
          revision: 7,
          itemId,
        }).success,
      ).toBe(true);
    }
  });

  it("accepts player, scouting candidate, and special coach targets only", () => {
    for (const target of [
      { type: "player", playerId: "player-1" },
      { type: "scouting-candidate", candidateId: "candidate-1" },
      { type: "special-coach", playerId: "player-1", focus: "spike" },
    ]) {
      expect(
        shopUseRequestSchema.safeParse({
          operationId: "use-op-001",
          revision: 8,
          itemId: "fatigue-recovery",
          target,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects client-controlled effect values and malformed target payloads", () => {
    expect(
      shopUseRequestSchema.safeParse({
        operationId: "use-op-001",
        revision: 8,
        itemId: "fatigue-recovery",
        target: { type: "player", playerId: "player-1" },
        fatigueRecovery: 100,
      }).success,
    ).toBe(false);

    expect(
      shopUseRequestSchema.safeParse({
        operationId: "use-op-002",
        revision: 8,
        itemId: "special-coach",
        target: {
          type: "special-coach",
          playerId: "player-1",
          focus: "all-abilities",
        },
      }).success,
    ).toBe(false);
  });

  it("allows target omission for items whose server definition needs no target", () => {
    expect(
      shopUseRequestSchema.safeParse({
        operationId: "use-op-003",
        revision: 8,
        itemId: "training-camp",
      }).success,
    ).toBe(true);
  });
});
