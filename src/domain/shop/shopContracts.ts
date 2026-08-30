import { z } from "zod";
import { SPECIAL_COACH_FOCUS_ABILITIES } from "./shopEffects";
import { SHOP_ITEM_IDS, type ShopItemId } from "./shopCatalog";

const operationIdSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(120));

const shopItemIdSchema = z.enum(SHOP_ITEM_IDS);
const specialCoachFocusSchema = z.enum(
  Object.keys(SPECIAL_COACH_FOCUS_ABILITIES) as [
    keyof typeof SPECIAL_COACH_FOCUS_ABILITIES,
    ...(keyof typeof SPECIAL_COACH_FOCUS_ABILITIES)[],
  ],
);

const playerTargetSchema = z
  .object({
    type: z.literal("player"),
    playerId: z.string().trim().min(1).max(160),
  })
  .strict();

const scoutingCandidateTargetSchema = z
  .object({
    type: z.literal("scouting-candidate"),
    candidateId: z.string().trim().min(1).max(160),
  })
  .strict();

const specialCoachTargetSchema = z
  .object({
    type: z.literal("special-coach"),
    playerId: z.string().trim().min(1).max(160),
    focus: specialCoachFocusSchema,
  })
  .strict();

export const shopUseTargetSchema = z.discriminatedUnion("type", [
  playerTargetSchema,
  scoutingCandidateTargetSchema,
  specialCoachTargetSchema,
]);

export const shopPurchaseRequestSchema = z
  .object({
    operationId: operationIdSchema,
    revision: z.number().int().positive(),
    itemId: shopItemIdSchema,
  })
  .strict();

export const shopUseRequestSchema = z
  .object({
    operationId: operationIdSchema,
    revision: z.number().int().positive(),
    itemId: shopItemIdSchema,
    target: shopUseTargetSchema.optional(),
  })
  .strict();

export type ShopPurchaseRequest = z.infer<typeof shopPurchaseRequestSchema>;
export type ShopUseRequest = z.infer<typeof shopUseRequestSchema>;
export type ShopUseTarget = z.infer<typeof shopUseTargetSchema>;

export type ShopBlockedReason =
  | "item_disabled"
  | "purchase_limit_reached"
  | "use_limit_reached"
  | "inventory_empty";

export interface ShopPublicStatusItem {
  itemId: ShopItemId;
  displayName: string;
  description: string;
  priceYen: 0;
  annualPurchaseLimit: number;
  annualUseLimit: number;
  purchasedCount: number;
  usedCount: number;
  quantityOwned: number;
  canPurchase: boolean;
  purchaseBlockedReason: ShopBlockedReason | null;
  canUse: boolean;
  useBlockedReason: ShopBlockedReason | null;
}

export interface ShopStatusResponse {
  revision: number;
  academicYearIndex: number;
  items: ShopPublicStatusItem[];
}

export interface ShopMutationResponseBase {
  operationId: string;
  revision: number;
  academicYearIndex: number;
  itemId: ShopItemId;
  quantityOwned: number;
  purchasedCount: number;
  usedCount: number;
}

export interface ShopPurchaseResponse extends ShopMutationResponseBase {
  operationType: "purchase";
}

export interface ShopUseResponse extends ShopMutationResponseBase {
  operationType: "use";
  result: Record<string, unknown>;
}
